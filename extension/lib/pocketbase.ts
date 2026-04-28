import PocketBase, { BaseAuthStore, type AuthRecord } from 'pocketbase';

/* The extension lives across multiple processes (drawer iframe,
 * background service worker, content scripts) and reloads on each
 * extension update. Using `chrome.storage.local` for the auth token
 * means every surface — including the background worker — can read
 * the same credentials, and tokens survive extension reloads.
 *
 * `BaseAuthStore` gives us the mutation hooks (save, clear, onChange)
 * the SDK calls; we override the storage-side accessors. */

const STORAGE_KEY = 'pb_auth';
const PB_URL =
  (import.meta.env.VITE_POCKETBASE_URL as string | undefined) ??
  'http://127.0.0.1:8090';

class ChromeAuthStore extends BaseAuthStore {
  constructor() {
    super();
    void this.initialLoad();
    chrome.storage?.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const c = changes[STORAGE_KEY];
      if (!c) return;
      this.applyFromStorage(c.newValue);
    });
  }

  private async initialLoad(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      this.applyFromStorage(stored[STORAGE_KEY]);
    } catch {
      // chrome.storage unavailable (e.g. running in plain dev) — fall through
    }
  }

  private applyFromStorage(value: unknown): void {
    if (!value || typeof value !== 'object') {
      // Clear in-memory state. Use the parent setter to fire onChange.
      super.save('', null);
      return;
    }
    const { token, record } = value as {
      token: string;
      record: AuthRecord | null;
    };
    super.save(token ?? '', record ?? null);
  }

  override save(token: string, record: AuthRecord | null): void {
    super.save(token, record);
    void chrome.storage?.local.set({ [STORAGE_KEY]: { token, record } });
  }

  override clear(): void {
    super.clear();
    void chrome.storage?.local.remove(STORAGE_KEY);
  }
}

export const pb = new PocketBase(PB_URL, new ChromeAuthStore());

export function avatarUrl(record: AuthRecord | null): string | null {
  if (!record) return null;
  const avatar = (record as unknown as { avatar?: string }).avatar;
  if (!avatar) return null;
  return pb.files.getURL(
    record as unknown as Record<string, unknown>,
    avatar,
  );
}
