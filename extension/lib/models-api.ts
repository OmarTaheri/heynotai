import type { Plan } from '@heynotai/shared';
import { backend, backendReady } from './backend';
import type { EngineType } from './model-selection';

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:8787';

export type { EngineType };
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
  /** Non-null when the catalog could not be loaded at all. Lets the UI
   *  tell "this modality has no models yet" (a real, permanent state —
   *  audio currently has none enabled) apart from "the request failed",
   *  which is retryable. Previously both collapsed into an empty
   *  catalog and the tab always claimed there were no models. */
  error: string | null;
}

const EMPTY: ModelsCatalog = {
  engines: { txt: [], img: [], aud: [], vid: [] },
  defaults: { txt: '', img: '', aud: '', vid: '' },
  error: null,
};

function failed(error: string): ModelsCatalog {
  return { ...EMPTY, engines: { txt: [], img: [], aud: [], vid: [] }, error };
}

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
  const t = backend.authStore.token;
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
  // The bearer token is restored from chrome.storage asynchronously.
  // Reading `authStore.token` before that resolves sent an anonymous
  // request, `/models` answered 401, and the tab rendered "no models
  // available" for a signed-in user — the single most common way this
  // panel came up empty.
  await backendReady;
  if (!backend.authStore.token) return failed('signed_out');
  try {
    const [mRes, dRes] = await Promise.all([
      fetch(`${API_URL}/models`, { headers: authHeaders() }),
      fetch(`${API_URL}/models/defaults`, { headers: authHeaders() }),
    ]);
    if (!mRes.ok) return failed(mRes.status === 401 ? 'signed_out' : `http_${mRes.status}`);
    if (!dRes.ok) return failed(dRes.status === 401 ? 'signed_out' : `http_${dRes.status}`);

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
    return { engines, defaults, error: null };
  } catch {
    return failed('network');
  }
}
