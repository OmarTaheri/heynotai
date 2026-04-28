import type { ScanEntry } from './types';

// Discriminated union of every message that crosses content ↔ background ↔ popup.
// Senders and receivers can narrow by `type` for full type safety.
export type ExtensionMessage =
  | { type: 'SCAN_COMPLETE'; payload: ScanEntry }
  | { type: 'RESCAN' }
  | { type: 'PIN_STATE'; tabId: number; pinned: boolean };

export function sendMessage(msg: ExtensionMessage) {
  return chrome.runtime.sendMessage(msg);
}

export function sendToTab(tabId: number, msg: ExtensionMessage) {
  return chrome.tabs.sendMessage(tabId, msg);
}
