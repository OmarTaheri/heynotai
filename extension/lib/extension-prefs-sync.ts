import type { ExtensionPrefs } from '@heynotai/shared';
import { pb } from './pocketbase';

const COLL = 'extension_prefs';

const DEFAULTS: Omit<ExtensionPrefs, 'userId' | 'id'> = {
  mode: 'normal',
  autoModelMode: false,
  scanMode: 'allowlist',
  sites: [],
  platforms: { facebook: true, youtube: true, instagram: true },
  notifications: { desktop: true, sound: false, threshold: 70 },
  privacy: { cloud: true, cache: true, shareSignals: false },
  hotkeys: [],
  flags: {},
};

export async function loadExtensionPrefs(): Promise<ExtensionPrefs | null> {
  if (!pb.authStore.isValid) return null;
  const userId = pb.authStore.record!.id;
  try {
    return (await pb
      .collection(COLL)
      .getFirstListItem<ExtensionPrefs>(`userId="${userId}"`));
  } catch {
    try {
      return (await pb
        .collection(COLL)
        .create<ExtensionPrefs>({ userId, ...DEFAULTS })) as ExtensionPrefs;
    } catch {
      return null;
    }
  }
}

export async function saveExtensionPrefs(
  patch: Partial<ExtensionPrefs>,
): Promise<ExtensionPrefs | null> {
  if (!pb.authStore.isValid) return null;
  const current = await loadExtensionPrefs();
  if (!current) return null;
  return (await pb
    .collection(COLL)
    .update<ExtensionPrefs>(
      (current as { id: string }).id,
      patch,
    )) as ExtensionPrefs;
}

export async function subscribeExtensionPrefs(
  cb: (prefs: ExtensionPrefs) => void,
): Promise<() => void> {
  const current = await loadExtensionPrefs();
  if (!current) return () => undefined;
  const id = (current as { id: string }).id;
  await pb.collection(COLL).subscribe(id, (e) => {
    if (e.action === 'update') cb(e.record as unknown as ExtensionPrefs);
  });
  return () => {
    void pb.collection(COLL).unsubscribe(id);
  };
}
