"use client";

import type { Plan } from "@heynotai/shared";
import { backend } from "./backend";
import type { Engine, EngineType, TokenUsage } from "./models-data";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

function authHeaders(): Record<string, string> {
  const token = backend.authStore.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type ApiCatalogEntry = {
  slug: string;
  name: string;
  type: EngineType;
  description: string;
  accuracy: number;
  tokenCost: number;
  costUnit: "per_scan" | "per_minute";
  tier: Plan;
};

/** Wire format → frontend `Engine`. The catalog API hides credentials,
 *  per-plan gating, and HF model ids; we only render what's needed for
 *  the picker UI. The row's `tier` flows through so the EngineRow can
 *  compute lock state against the current user's plan. */
function adapt(entry: ApiCatalogEntry, isDefault: boolean): Engine {
  return {
    id: entry.slug,
    name: entry.name,
    badges: isDefault ? ["default", "recommended"] : [],
    description: entry.description,
    accuracy: entry.accuracy,
    cost: {
      value: entry.tokenCost,
      unit: entry.costUnit === "per_minute" ? "/ minute" : "/ scan",
      tone: entry.tokenCost >= 8 ? "high" : "neutral",
    },
    tier: entry.tier ?? "check",
  };
}

export type ModelsCatalog = {
  engines: Record<EngineType, Engine[]>;
  defaults: Record<EngineType, string>;
};

/** Returns `null` when the catalog could not be loaded, so callers can
 *  say so instead of falling back to a hard-coded engine list. An
 *  unreachable API used to leave the Models page showing seeded engines
 *  the backend has never heard of. */
export async function fetchModelsCatalog(): Promise<ModelsCatalog | null> {
  const [modelsRes, defaultsRes] = await Promise.all([
    fetch(`${API_URL}/models`, { headers: authHeaders() }),
    fetch(`${API_URL}/models/defaults`, { headers: authHeaders() }),
  ]).catch(() => [null, null] as const);
  if (!modelsRes?.ok || !defaultsRes?.ok) {
    return null;
  }
  const modelsBody = (await modelsRes.json()) as {
    models: Record<EngineType, ApiCatalogEntry[]>;
  };
  const defaultsBody = (await defaultsRes.json()) as {
    defaults: Partial<Record<EngineType, string>>;
  };
  const engines: Record<EngineType, Engine[]> = { txt: [], img: [], aud: [], vid: [] };
  const defaults: Record<EngineType, string> = { txt: "", img: "", aud: "", vid: "" };
  (Object.keys(engines) as EngineType[]).forEach((type) => {
    const list = modelsBody.models?.[type] ?? [];
    const defaultSlug = defaultsBody.defaults?.[type] ?? list[0]?.slug ?? "";
    defaults[type] = defaultSlug;
    engines[type] = list.map((entry) => adapt(entry, entry.slug === defaultSlug));
  });
  return { engines, defaults };
}

export async function fetchMonthlyUsage(): Promise<TokenUsage | null> {
  const res = await fetch(`${API_URL}/me/usage`, {
    headers: authHeaders(),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json()) as {
    used: number;
    total: number | null;
    segments: { type: EngineType; value: number }[];
    resetsOn: string;
    avgPerDay: number;
  };
  return {
    used: body.used,
    total: body.total,
    resetsOn: body.resetsOn,
    avgPerDay: body.avgPerDay,
    segments: body.segments,
  };
}
