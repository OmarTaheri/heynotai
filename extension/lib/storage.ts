import type { ScanEntry, Theme } from './types';

// Typed wrapper over chrome.storage.local so callers don't pass keys as strings
// and don't get `any` back.

export interface StorageShape {
  scanHistory: ScanEntry[];
  onboarded: boolean;
  theme: Theme;
  appliedTheme: 'light' | 'dark';
  pinnedTabs: Record<number, boolean>;
}

export async function get<K extends keyof StorageShape>(
  key: K,
): Promise<StorageShape[K] | undefined> {
  const out = await chrome.storage.local.get(key);
  return out[key] as StorageShape[K] | undefined;
}

export async function set<K extends keyof StorageShape>(
  key: K,
  value: StorageShape[K],
): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getPinnedTabs(): Promise<Record<number, boolean>> {
  return (await get('pinnedTabs')) ?? {};
}

export async function setPinnedTab(tabId: number, pinned: boolean): Promise<void> {
  const current = await getPinnedTabs();
  if (pinned) current[tabId] = true;
  else delete current[tabId];
  await set('pinnedTabs', current);
}

export async function pushScan(entry: ScanEntry, maxHistory = 50): Promise<void> {
  const existing = (await get('scanHistory')) ?? [];
  const next = [entry, ...existing].slice(0, maxHistory);
  await set('scanHistory', next);
}
