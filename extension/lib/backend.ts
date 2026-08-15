import {
  BackendAuthStore,
  BackendClient,
  type AuthPersistence,
  type AuthRecord,
} from '@heynotai/shared';

const STORAGE_KEY = 'heynotai_backend_auth';
const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:8787';

class ChromePersistence implements AuthPersistence {
  load() {
    // chrome.storage is asynchronous; `hydrateFromChrome` runs immediately
    // after construction and updates the in-memory store when it resolves.
    return null;
  }

  save(
    token: string,
    record: AuthRecord | null,
    refreshToken = '',
  ): void {
    void chrome.storage?.local.set({
      [STORAGE_KEY]: { token, refreshToken, record },
    });
  }

  clear(): void {
    void chrome.storage?.local.remove(STORAGE_KEY);
  }
}

const authStore = new BackendAuthStore(new ChromePersistence());

async function hydrateFromChrome(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const value = stored[STORAGE_KEY] as
      | { token?: unknown; refreshToken?: unknown; record?: unknown }
      | undefined;
    authStore.hydrate(
      typeof value?.token === 'string' ? value.token : '',
      value?.record && typeof value.record === 'object'
        ? (value.record as AuthRecord)
        : null,
      typeof value?.refreshToken === 'string' ? value.refreshToken : '',
    );
  } catch {
    // Plain-browser previews do not expose chrome.storage.
  }
}

export const backendReady = hydrateFromChrome();

if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const changed = changes[STORAGE_KEY];
    if (!changed) return;
    const value = changed.newValue as
      | { token?: unknown; refreshToken?: unknown; record?: unknown }
      | undefined;
    authStore.hydrate(
      typeof value?.token === 'string' ? value.token : '',
      value?.record && typeof value.record === 'object'
        ? (value.record as AuthRecord)
        : null,
      typeof value?.refreshToken === 'string' ? value.refreshToken : '',
    );
  });
}

export const backend = new BackendClient(API_URL, authStore);
export type { AuthRecord };

export function avatarUrl(record: AuthRecord | null): string | null {
  if (!record) return null;
  const avatar = (record as { avatar?: string }).avatar;
  if (!avatar) return null;
  return backend.files.getURL(record, avatar);
}
