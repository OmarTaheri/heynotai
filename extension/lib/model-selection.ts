/* Per-modality detection-model choice, mirrored into
 * chrome.storage.local so the background service worker can read it
 * without pulling in the backend SDK.
 *
 * The drawer's Models tab owns the write side; the SW owns the read
 * side (it stamps `modelSlug` onto every POST /scans it makes). Before
 * this existed the picker was cosmetic — the API always fell back to
 * "cheapest in-tier model for this modality" no matter what the user
 * selected.
 *
 * `auto: true` deliberately stores *no* slug on the request: the API's
 * own default-resolution is plan-aware, so letting it choose keeps the
 * selection valid across upgrades and downgrades.
 */

export type EngineType = 'txt' | 'img' | 'aud' | 'vid';

export const MODEL_SELECTION_KEY = 'heynotai_models';

export interface ModelSelection {
  /** Auto mode — let the API pick the best in-tier model per modality. */
  auto: boolean;
  /** Explicit slug per modality. Empty string means "no choice yet". */
  selected: Record<EngineType, string>;
}

export const EMPTY_MODEL_SELECTION: ModelSelection = {
  auto: false,
  selected: { txt: '', img: '', aud: '', vid: '' },
};

function normalize(raw: unknown): ModelSelection {
  if (!raw || typeof raw !== 'object') return EMPTY_MODEL_SELECTION;
  const value = raw as Partial<ModelSelection>;
  const source = (value.selected ?? {}) as Partial<Record<EngineType, unknown>>;
  const selected: Record<EngineType, string> = { txt: '', img: '', aud: '', vid: '' };
  (Object.keys(selected) as EngineType[]).forEach((type) => {
    const slug = source[type];
    if (typeof slug === 'string') selected[type] = slug;
  });
  return { auto: value.auto === true, selected };
}

export async function loadModelSelection(): Promise<ModelSelection> {
  try {
    const stored = await chrome.storage.local.get(MODEL_SELECTION_KEY);
    return normalize(stored[MODEL_SELECTION_KEY]);
  } catch {
    // Plain-browser previews have no chrome.storage.
    return EMPTY_MODEL_SELECTION;
  }
}

export async function saveModelSelection(next: ModelSelection): Promise<void> {
  try {
    await chrome.storage.local.set({ [MODEL_SELECTION_KEY]: normalize(next) });
  } catch {
    /* non-extension context — nothing to persist to */
  }
}

/** Slug the SW should send for a scan of this modality, or `undefined`
 *  when the API should choose (auto mode, or nothing picked yet). */
export async function slugForKind(kind: EngineType): Promise<string | undefined> {
  const selection = await loadModelSelection();
  if (selection.auto) return undefined;
  const slug = selection.selected[kind]?.trim();
  return slug ? slug : undefined;
}
