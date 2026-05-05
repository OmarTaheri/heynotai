import type { ScanEntry } from './types';
import type { Scan } from './scans-api';

// Page state shared between content script and drawer — minimal subset
// of PlatformInfo (drawer reads platform/surface/url/host from this).
export interface PageInfoPayload {
  platform: 'youtube' | 'instagram' | 'facebook' | 'other';
  surface: 'videos' | 'reels' | 'posts' | null;
  url: string;
  host: string;
}

export interface QueryStateResponse {
  scanning: boolean;
  scanned: boolean;
  lastResult?: ScanEntry;
  pageInfo: PageInfoPayload;
}

// Discriminated union of every message that crosses content ↔ background ↔ popup.
// Senders and receivers can narrow by `type` for full type safety.
export type ExtensionMessage =
  | { type: 'SCAN_COMPLETE'; payload: ScanEntry }
  | { type: 'SCAN_STARTED' }
  | { type: 'PAGE_CHANGED'; payload: PageInfoPayload }
  | { type: 'QUERY_STATE' }
  | { type: 'RESCAN' }
  | { type: 'MANUAL_SCAN' }
  | { type: 'PIN_STATE'; tabId: number; pinned: boolean }
  // Right-click "AI check this text" lifecycle. Origin: background SW
  // (driven by chrome.contextMenus.onClicked) → text-overlay content
  // script. Each tab has at most one in-flight scan.
  | { type: 'TEXT_SCAN_STARTED' }
  | { type: 'TEXT_SCAN_COMPLETE'; scan: Scan }
  | { type: 'TEXT_SCAN_FAILED'; error: string }
  | { type: 'TEXT_AI_CHECK_AUTH_REQUIRED' }
  // YouTube scan lifecycle. Content script asks the background SW to
  // run a real backend scan against the video URL; the SW POSTs to
  // /scans, polls until done, then pushes the verdict back.
  // `mediaId` (the YouTube video id) lets the content script ignore
  // late responses for a previous video the user has already scrolled
  // past.
  | { type: 'YT_SCAN_REQUEST'; url: string; mediaId: string }
  | { type: 'YT_SCAN_COMPLETE'; scan: Scan; mediaId: string }
  | { type: 'YT_SCAN_FAILED'; error: string; mediaId: string }
  | { type: 'YT_SCAN_AUTH_REQUIRED'; mediaId: string }
  // Open the floating drawer on the current tab (used by the sign-in
  // CTA inside the text-overlay pill). Background owns drawer
  // injection, so content scripts route through this.
  | { type: 'OPEN_DRAWER' };

export function sendMessage(msg: ExtensionMessage) {
  return chrome.runtime.sendMessage(msg);
}

export function sendToTab(tabId: number, msg: ExtensionMessage) {
  return chrome.tabs.sendMessage(tabId, msg);
}
