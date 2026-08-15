import type { ScanEntry } from './types';
import type { Scan } from './scans-api';

// Real metadata scraped from the YouTube watch page DOM by content.ts.
// All fields are best-effort — selectors might miss when YouTube ships
// a redesign. Drawer falls back to "—" for missing values.
export interface YoutubeMeta {
  videoId: string;
  title: string;
  channelName: string;
  channelHandle: string;     // e.g. "@technotalks" (with leading @)
  channelVerified: boolean;
  channelSubs: string;       // raw text e.g. "128K subscribers"
  duration: string;          // mm:ss e.g. "12:04"
  views: string;             // raw text e.g. "14K views"
  age: string;               // relative e.g. "2 days ago"
}

// Page state shared between content script and drawer — minimal subset
// of PlatformInfo (drawer reads platform/surface/url/host from this).
export interface PageInfoPayload {
  platform: 'youtube' | 'instagram' | 'facebook' | 'other';
  surface: 'videos' | 'reels' | 'posts' | null;
  url: string;
  host: string;
  // Populated only when platform === 'youtube' AND the DOM has
  // already rendered enough metadata. Drawer keeps the previous
  // values when this is omitted on a re-broadcast.
  youtube?: YoutubeMeta;
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
  | { type: 'SCAN_FAILED'; error?: string }
  | { type: 'PAGE_CHANGED'; payload: PageInfoPayload }
  | { type: 'QUERY_STATE' }
  | { type: 'RESCAN' }
  | { type: 'MANUAL_SCAN' }
  | { type: 'PIN_STATE'; tabId: number; pinned: boolean }
  // Drawer → SW. Manual-scan dispatch routed via the SW so it can
  // re-inject content.js if the tab somehow lost it (extension reload
  // while the page was already open). The SW resolves with
  // { ok: boolean } once it has either delivered MANUAL_SCAN to the
  // content script or given up.
  | { type: 'TRIGGER_MANUAL_SCAN'; tabId: number }
  | { type: 'PAGE_TEXT_SCAN_REQUEST'; text: string; title: string; url: string }
  // Right-click "AI check this text" lifecycle. Origin: background SW
  // (driven by chrome.contextMenus.onClicked). Sent twice: once to the
  // tab (drives the in-page pill) and once over runtime.sendMessage
  // (drives the drawer's loading/result card). `tabId` is populated
  // only on the runtime broadcast — the drawer uses it to ignore
  // lifecycle events from other tabs, which it can't do via
  // `sender.tab` because the SW isn't a tab. Each tab has at most one
  // in-flight selection scan.
  | { type: 'TEXT_SCAN_STARTED'; tabId?: number }
  | { type: 'TEXT_SCAN_COMPLETE'; scan: Scan; tabId?: number }
  | { type: 'TEXT_SCAN_FAILED'; error: string; tabId?: number }
  | { type: 'TEXT_AI_CHECK_AUTH_REQUIRED'; tabId?: number }
  // Drawer → SW, on mount. Answers "is a right-click text scan already
  // running on my tab?" so opening the drawer mid-scan shows the
  // loading card instead of the idle UI. Responds with
  // `{ scanning: boolean }`.
  | { type: 'QUERY_TEXT_SCAN'; tabId: number }
  // Content script → SW. Pushed on every `contextmenu` event so the SW
  // has the up-to-date selection (with newlines preserved) by the time
  // chrome.contextMenus.onClicked fires. `info.selectionText` from the
  // contextMenus API normalizes whitespace in some Chrome builds, which
  // collapses bullet lists and paragraph breaks into one line.
  | { type: 'TEXT_SELECTION_PRIMED'; text: string }
  // YouTube scan lifecycle. Content script asks the background SW to
  // run a real backend scan against the video URL; the SW POSTs to
  // /scans, polls until done, then pushes the verdict back.
  // `mediaId` (the YouTube video id) lets the content script ignore
  // late responses for a previous video the user has already scrolled
  // past. `title` is the scraped video title — passed up so the
  // activity table shows readable rows instead of the raw URL.
  // `userInitiated` separates a scan the user asked for (rescan button,
  // manual check) from one that fired automatically on SPA navigation.
  // Only a scan the user asked for may interrupt the page — see
  // YT_SCAN_AUTH_REQUIRED.
  | {
      type: 'YT_SCAN_REQUEST';
      url: string;
      mediaId: string;
      title?: string;
      userInitiated: boolean;
    }
  | { type: 'YT_SCAN_COMPLETE'; scan: Scan; mediaId: string }
  | { type: 'YT_SCAN_FAILED'; error: string; mediaId: string }
  | { type: 'YT_SCAN_AUTH_REQUIRED'; mediaId: string; userInitiated: boolean }
  // Open the floating drawer on the current tab (used by the sign-in
  // CTA inside the text-overlay pill). Background owns drawer
  // injection, so content scripts route through this. This opens and
  // never closes: an already-open drawer stays open.
  | { type: 'OPEN_DRAWER' };

export function sendMessage(msg: ExtensionMessage) {
  return chrome.runtime.sendMessage(msg);
}

export function sendToTab(tabId: number, msg: ExtensionMessage) {
  return chrome.tabs.sendMessage(tabId, msg);
}
