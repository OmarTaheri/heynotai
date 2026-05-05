import type { Plan } from '@heynotai/shared';
import { pb } from './pocketbase';

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:8787';

export type EngineType = 'txt' | 'img' | 'aud' | 'vid';
export type EngineCostUnit = '/ scan' | '/ minute';

export interface Engine {
  id: string;
  name: string;
  description: string;
  accuracy: number;
  cost: { value: number; unit: EngineCostUnit; tone: 'neutral' | 'high' };
  isDefault: boolean;
  /** Plan tier required to use this engine. Mirrors the API's
   *  `tier` field on `detection_models`. */
  tier: Plan;
}

export interface ModelsCatalog {
  engines: Record<EngineType, Engine[]>;
  defaults: Record<EngineType, string>;
}

const EMPTY: ModelsCatalog = {
  engines: { txt: [], img: [], aud: [], vid: [] },
  defaults: { txt: '', img: '', aud: '', vid: '' },
};

interface ApiCatalogEntry {
  slug: string;
  name: string;
  type: EngineType;
  description: string;
  accuracy: number;
  tokenCost: number;
  costUnit: 'per_scan' | 'per_minute';
  tier: Plan;
}

function authHeaders(): Record<string, string> {
  const t = pb.authStore.token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function adapt(entry: ApiCatalogEntry, isDefault: boolean): Engine {
  return {
    id: entry.slug,
    name: entry.name,
    description: entry.description,
    accuracy: entry.accuracy,
    cost: {
      value: entry.tokenCost,
      unit: entry.costUnit === 'per_minute' ? '/ minute' : '/ scan',
      tone: entry.tokenCost >= 8 ? 'high' : 'neutral',
    },
    isDefault,
    tier: entry.tier ?? 'check',
  };
}

export async function fetchModelsCatalog(): Promise<ModelsCatalog> {
  try {
    const [mRes, dRes] = await Promise.all([
      fetch(`${API_URL}/models`, { headers: authHeaders() }),
      fetch(`${API_URL}/models/defaults`, { headers: authHeaders() }),
    ]);
    if (!mRes.ok || !dRes.ok) return EMPTY;

    const mBody = (await mRes.json()) as {
      models: Record<EngineType, ApiCatalogEntry[]>;
    };
    const dBody = (await dRes.json()) as {
      defaults: Partial<Record<EngineType, string>>;
    };

    const engines: Record<EngineType, Engine[]> = {
      txt: [], img: [], aud: [], vid: [],
    };
    const defaults: Record<EngineType, string> = {
      txt: '', img: '', aud: '', vid: '',
    };
    (Object.keys(engines) as EngineType[]).forEach((type) => {
      const list = mBody.models?.[type] ?? [];
      const defaultSlug = dBody.defaults?.[type] ?? list[0]?.slug ?? '';
      defaults[type] = defaultSlug;
      // API already sorts cheapest-first within type, but sort here
      // defensively so the picker order is invariant of network state.
      engines[type] = list
        .slice()
        .sort((a, b) => a.tokenCost - b.tokenCost)
        .map((entry) => adapt(entry, entry.slug === defaultSlug));
    });
    return { engines, defaults };
  } catch {
    return EMPTY;
  }
}
