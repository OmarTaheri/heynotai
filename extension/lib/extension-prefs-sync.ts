import {
  DEFAULT_EXTENSION_PREFS,
  migrateLegacyPlatforms,
  type ExtensionPrefs,
} from '@heynotai/shared';
import { backend } from './backend';

const COLL = 'extension_prefs';

/** Force every consumer to see the canonical nested `platforms` shape,
 *  regardless of what's persisted in the row. Old rows from before
 *  v2 stored a flat `Record<PlatformKey, boolean>`. */
function normalize(record: ExtensionPrefs): ExtensionPrefs {
  return {
    ...record,
    platforms: migrateLegacyPlatforms(record.platforms),
  };
}

export async function loadExtensionPrefs(): Promise<ExtensionPrefs | null> {
  if (!backend.authStore.isValid) return null;
  const userId = backend.authStore.record!.id;
  try {
    const row = await backend
      .collection(COLL)
      .getFirstListItem<ExtensionPrefs>(`userId="${userId}"`);
    return normalize(row);
  } catch {
    try {
      const row = await backend
        .collection(COLL)
        .create<ExtensionPrefs>({ userId, ...DEFAULT_EXTENSION_PREFS });
      return normalize(row);
    } catch {
      return null;
    }
  }
}

export async function saveExtensionPrefs(
  patch: Partial<ExtensionPrefs>,
): Promise<ExtensionPrefs | null> {
  if (!backend.authStore.isValid) return null;
  const current = await loadExtensionPrefs();
  if (!current) return null;
  const row = await backend
    .collection(COLL)
    .update<ExtensionPrefs>((current as { id: string }).id, patch);
  return normalize(row);
}

export async function subscribeExtensionPrefs(
  cb: (prefs: ExtensionPrefs) => void,
): Promise<() => void> {
  const current = await loadExtensionPrefs();
  if (!current) return () => undefined;
  const id = (current as { id: string }).id;
  await backend.collection(COLL).subscribe(id, (e) => {
    if (e.action === 'update') cb(normalize(e.record as unknown as ExtensionPrefs));
  });
  return () => {
    void backend.collection(COLL).unsubscribe(id);
  };
}
