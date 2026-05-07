import type { ExtensionMessage } from '@/lib/messaging';
import type { Scan } from '@/lib/scans-api';
import type { ScanState } from '@/lib/types';
import { getPinnedTabs, setPinnedTab } from '@/lib/storage';

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:8787';

// PB REST is hit directly (not via SDK) so the SW stays small —
// `auth-state.tsx` mirrors the bearer token into chrome.storage.local
// for exactly this purpose. Used to look up an existing successful
// scan for a YouTube URL before creating a new one, so revisiting a
// video reuses the prior verdict instead of re-billing.
const PB_URL =
  (import.meta.env.VITE_POCKETBASE_URL as string | undefined) ??
  'http://127.0.0.1:8090';

// Keep this aligned with MAX_CONTENT_BYTES in api/src/routes/scans/validators.ts
// — the server rejects above 1_000_000, so trimming here gives the user a
// graceful capped scan instead of a 400.
const MAX_TEXT_BYTES = 1_000_000;

const TEXT_SCAN_POLL_INTERVAL_MS = 1500;
const TEXT_SCAN_POLL_MAX_ATTEMPTS = 30; // 45s — fine for text/HF inference

// YouTube scans add a yt-dlp download + frame-by-frame classification on
// top of the HF round-trip, so they need a much longer ceiling. 120
// attempts × 1.5s = 180s total, matching the editor's POLL_TIMEOUT_MS.
const YT_SCAN_POLL_MAX_ATTEMPTS = 120;

interface StoredAuth {
  token: string;
  userId: string;
  plan: string;
}

export default defineBackground(() => {
  const badgeConfig: Record<ScanState, { text: string; color: string }> = {
    authentic:      { text: '✓', color: '#16a34a' },
    suspicious:     { text: '?', color: '#d97706' },
    'ai-generated': { text: '!', color: '#dc2626' },
  };

  // Track in-flight text scans by tabId so a second right-click during
  // a slow scan can cancel and replace the first.
  const inFlightTextScans = new Map<number, AbortController>();

  // Latest selection text primed by the text-overlay content script on
  // its `contextmenu` listener. We prefer this over `info.selectionText`
  // from chrome.contextMenus.onClicked, which collapses newlines in
  // some Chrome builds — the editor then renders bullet lists and
  // paragraph breaks as a single mashed paragraph. Cleared per-tab on
  // navigation / close.
  const primedTextSelections = new Map<number, string>();

  // Same pattern for YouTube scans — when the user navigates from one
  // /watch URL to another the previous scan must be cancelled so its
  // late-arriving verdict doesn't paint the wrong video. Tracked by
  // tabId so each tab has at most one in-flight scan.
  const inFlightYouTubeScans = new Map<number, AbortController>();

  // Per-tab interval handle for the animated "scanning" badge that
  // cycles · / ·· / ··· while a text scan is running. Cleared as soon
  // as we get a verdict or an error.
  const textScanBadgeAnimations = new Map<number, ReturnType<typeof setInterval>>();
  const SCAN_BADGE_FRAMES = ['·', '··', '···'];
  const SCAN_BADGE_COLOR = '#5b5cff';
  const VERDICT_BADGE_TEXT: Record<string, { text: string; color: string }> = {
    human: { text: '✓', color: '#16a34a' },
    ai:    { text: '!', color: '#dc2626' },
    mixed: { text: '~', color: '#d97706' },
  };

  function startTextScanBadge(tabId: number) {
    stopTextScanBadge(tabId);
    chrome.action.setBadgeBackgroundColor({ color: SCAN_BADGE_COLOR, tabId });
    chrome.action.setBadgeTextColor({ color: '#ffffff', tabId });
    let i = 0;
    chrome.action.setBadgeText({ text: SCAN_BADGE_FRAMES[0]!, tabId });
    const handle = setInterval(() => {
      i = (i + 1) % SCAN_BADGE_FRAMES.length;
      chrome.action.setBadgeText({ text: SCAN_BADGE_FRAMES[i]!, tabId });
    }, 450);
    textScanBadgeAnimations.set(tabId, handle);
  }

  function stopTextScanBadge(tabId: number) {
    const handle = textScanBadgeAnimations.get(tabId);
    if (handle != null) {
      clearInterval(handle);
      textScanBadgeAnimations.delete(tabId);
    }
  }

  function setTextScanVerdictBadge(tabId: number, verdict: string) {
    stopTextScanBadge(tabId);
    const cfg = VERDICT_BADGE_TEXT[verdict] ?? VERDICT_BADGE_TEXT.mixed!;
    chrome.action.setBadgeText({ text: cfg.text, tabId });
    chrome.action.setBadgeBackgroundColor({ color: cfg.color, tabId });
    chrome.action.setBadgeTextColor({ color: '#ffffff', tabId });
  }

  function clearTextScanBadge(tabId: number) {
    stopTextScanBadge(tabId);
    chrome.action.setBadgeText({ text: '', tabId });
  }

  function isInjectableUrl(url: string | undefined): boolean {
    if (!url) return false;
    return !(
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:')
    );
  }

  // Pages where the content script may have left a verdict badge — used to
  // decide whether to keep the action badge on tab updates.
  function isSupportedScanUrl(url: string | undefined): boolean {
    if (!url) return false;
    return (
      /^https?:\/\/([^/]+\.)?youtube\.com\/(watch|shorts\/)/.test(url) ||
      /^https?:\/\/([^/]+\.)?instagram\.com\/(p|reel|reels)\//.test(url) ||
      /^https?:\/\/([^/]+\.)?facebook\.com\/(reel|reels|posts|permalink|photo)\//.test(url) ||
      /^https?:\/\/([^/]+\.)?facebook\.com\/[^/]+\/posts\//.test(url)
    );
  }

  // Six right-click entries — one per surface the content script can scan.
  // Wrapped in removeAll so the call is idempotent across SW restarts.
  function setupContextMenus() {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'hn-yt-video',
        title: 'Check this video with heynotai',
        contexts: ['page', 'video', 'frame'],
        documentUrlPatterns: ['*://*.youtube.com/watch*'],
      });
      chrome.contextMenus.create({
        id: 'hn-yt-short',
        title: 'Check this Short with heynotai',
        contexts: ['page', 'video', 'frame'],
        documentUrlPatterns: ['*://*.youtube.com/shorts/*'],
      });
      chrome.contextMenus.create({
        id: 'hn-ig-post',
        title: 'Check this post with heynotai',
        contexts: ['page', 'image', 'video'],
        documentUrlPatterns: ['*://*.instagram.com/p/*'],
      });
      chrome.contextMenus.create({
        id: 'hn-ig-reel',
        title: 'Check this reel with heynotai',
        contexts: ['page', 'video'],
        documentUrlPatterns: [
          '*://*.instagram.com/reel/*',
          '*://*.instagram.com/reels/*',
        ],
      });
      chrome.contextMenus.create({
        id: 'hn-fb-post',
        title: 'Check this post with heynotai',
        contexts: ['page', 'image', 'video'],
        documentUrlPatterns: [
          '*://*.facebook.com/*/posts/*',
          '*://*.facebook.com/permalink*',
          '*://*.facebook.com/photo*',
          '*://*.facebook.com/posts/*',
        ],
      });
      chrome.contextMenus.create({
        id: 'hn-fb-reel',
        title: 'Check this reel with heynotai',
        contexts: ['page', 'video'],
        documentUrlPatterns: [
          '*://*.facebook.com/reel/*',
          '*://*.facebook.com/reels/*',
        ],
      });
      // Text-selection AI check — site-agnostic. No documentUrlPatterns
      // so this entry shows up on any page where the user has text
      // highlighted. The handler below routes by menuItemId.
      chrome.contextMenus.create({
        id: 'hn-text-selection',
        title: 'AI check this text with heynotai',
        contexts: ['selection'],
      });
    });
  }

  chrome.runtime.onInstalled.addListener(setupContextMenus);
  // Service worker can be torn down between events; recreate on every
  // SW load so reloads-during-dev keep the menu populated.
  setupContextMenus();

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (tab?.id == null) return;
    if (info.menuItemId === 'hn-text-selection') {
      // Prefer the content-script-primed selection (newlines intact);
      // fall back to info.selectionText for the rare case where the
      // contextmenu listener never ran (e.g. extension just installed
      // and content script hasn't loaded into this tab yet).
      const primed = primedTextSelections.get(tab.id);
      primedTextSelections.delete(tab.id);
      const selection = primed ?? info.selectionText ?? '';
      runTextScan(tab.id, selection).catch(() => {
        // Errors surface to the user via TEXT_SCAN_FAILED inside
        // runTextScan; nothing else to do here.
      });
      return;
    }
    chrome.tabs
      .sendMessage(tab.id, { type: 'MANUAL_SCAN' })
      .catch(() => {
        // Content script may not be ready (e.g. user clicked before
        // document_idle finished). Nothing actionable.
      });
  });

  async function runTextScan(tabId: number, rawText: string) {
    const text = rawText.trim();
    if (!text) return;
    const trimmed =
      text.length > MAX_TEXT_BYTES ? text.slice(0, MAX_TEXT_BYTES) : text;

    // Cancel any previous in-flight scan for this tab so the latest
    // right-click always wins.
    inFlightTextScans.get(tabId)?.abort();
    const controller = new AbortController();
    inFlightTextScans.set(tabId, controller);

    const auth = await loadAuth();
    if (!auth) {
      sendTabMessage(tabId, { type: 'TEXT_AI_CHECK_AUTH_REQUIRED' });
      inFlightTextScans.delete(tabId);
      return;
    }

    sendTabMessage(tabId, { type: 'TEXT_SCAN_STARTED' });
    startTextScanBadge(tabId);

    try {
      const created = await createTextScan(trimmed, auth.token, controller.signal);
      const finalScan = await pollScan(created.id, auth.token, controller.signal);
      if (finalScan.status === 'failed') {
        sendTabMessage(tabId, {
          type: 'TEXT_SCAN_FAILED',
          error: 'detection_failed',
        });
        clearTextScanBadge(tabId);
      } else {
        sendTabMessage(tabId, { type: 'TEXT_SCAN_COMPLETE', scan: finalScan });
        setTextScanVerdictBadge(tabId, finalScan.verdict);
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // Replaced by a newer scan — let the new run own the badge.
        return;
      }
      const message = err instanceof Error ? err.message : 'unknown_error';
      sendTabMessage(tabId, { type: 'TEXT_SCAN_FAILED', error: message });
      clearTextScanBadge(tabId);
    } finally {
      if (inFlightTextScans.get(tabId) === controller) {
        inFlightTextScans.delete(tabId);
      }
    }
  }

  async function loadAuth(): Promise<StoredAuth | null> {
    const stored = await chrome.storage.local.get('heynotai_auth');
    const raw = stored.heynotai_auth as Partial<StoredAuth> | undefined;
    if (!raw || typeof raw.token !== 'string' || raw.token.length === 0) {
      return null;
    }
    return {
      token: raw.token,
      userId: raw.userId ?? '',
      plan: raw.plan ?? 'check',
    };
  }

  async function createTextScan(
    text: string,
    token: string,
    signal: AbortSignal,
  ): Promise<Scan> {
    const form = new FormData();
    form.set('type', 'txt');
    form.set('origin', 'ext');
    form.set('content', text);
    const r = await fetch(`${API_URL}/scans`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal,
    });
    if (!r.ok) {
      const reason = await safeReadError(r);
      throw new Error(`scans_create_${r.status}_${reason}`);
    }
    return (await r.json()) as Scan;
  }

  async function pollScan(
    id: string,
    token: string,
    signal: AbortSignal,
    maxAttempts: number = TEXT_SCAN_POLL_MAX_ATTEMPTS,
  ): Promise<Scan> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Sleep first so we give the API a moment to enqueue. The first
      // create response often already has status="queued", so polling
      // immediately would race the worker with no benefit.
      await sleep(TEXT_SCAN_POLL_INTERVAL_MS, signal);
      const r = await fetch(`${API_URL}/scans/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!r.ok) {
        // Transient failures (e.g. 502) shouldn't kill the whole scan —
        // keep polling unless we've burned through all attempts.
        if (attempt === maxAttempts - 1) {
          throw new Error(`scans_get_${r.status}`);
        }
        continue;
      }
      const scan = (await r.json()) as Scan;
      if (scan.status === 'done' || scan.status === 'failed') {
        return scan;
      }
    }
    throw new Error('scans_timeout');
  }

  async function runYouTubeScan(
    tabId: number,
    url: string,
    mediaId: string,
    title?: string,
  ) {
    console.info('[heynotai/sw] runYouTubeScan starting', { tabId, url, mediaId });
    // Cancel any previous in-flight scan for this tab — the user has
    // either rescanned or navigated to a different video, and we don't
    // want two polling loops eating the auth token's budget.
    inFlightYouTubeScans.get(tabId)?.abort();
    const controller = new AbortController();
    inFlightYouTubeScans.set(tabId, controller);

    const auth = await loadAuth();
    if (!auth) {
      console.warn('[heynotai/sw] no auth — telling content script', { tabId, mediaId });
      sendTabMessage(tabId, { type: 'YT_SCAN_AUTH_REQUIRED', mediaId });
      inFlightYouTubeScans.delete(tabId);
      return;
    }

    try {
      // Cache hit short-circuits the create+poll loop. Reuses any prior
      // scan for this canonical YouTube URL that hasn't failed —
      // includes in-flight rows so concurrent tabs (or a re-mount during
      // a still-spinning scan) join the existing run instead of
      // creating duplicate `scans` rows. `failed` is excluded so the
      // user can retry after a detector failure.
      const cached = await findExistingYouTubeScan(
        url,
        auth.token,
        controller.signal,
      );
      let scanId: string;
      if (cached) {
        console.info('[heynotai/sw] cache hit', {
          scanId: cached.id,
          status: cached.status,
        });
        if (cached.status === 'done') {
          sendTabMessage(tabId, {
            type: 'YT_SCAN_COMPLETE',
            scan: cached,
            mediaId,
          });
          return;
        }
        // queued / scanning → poll the existing record.
        scanId = cached.id;
      } else {
        console.info('[heynotai/sw] no cache — POST /scans', { url, mediaId });
        const created = await createYouTubeScan(url, title, auth.token, controller.signal);
        console.info('[heynotai/sw] /scans created', { scanId: created.id });
        scanId = created.id;
      }
      const finalScan = await pollScan(
        scanId,
        auth.token,
        controller.signal,
        YT_SCAN_POLL_MAX_ATTEMPTS,
      );
      console.info('[heynotai/sw] poll finished', {
        tabId,
        scanId: finalScan.id,
        status: finalScan.status,
        verdict: finalScan.verdict,
      });
      if (finalScan.status === 'failed') {
        sendTabMessage(tabId, {
          type: 'YT_SCAN_FAILED',
          error: 'detection_failed',
          mediaId,
        });
      } else {
        sendTabMessage(tabId, { type: 'YT_SCAN_COMPLETE', scan: finalScan, mediaId });
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // Replaced by a newer scan — let the new run own the messaging.
        return;
      }
      const message = err instanceof Error ? err.message : 'unknown_error';
      sendTabMessage(tabId, { type: 'YT_SCAN_FAILED', error: message, mediaId });
    } finally {
      if (inFlightYouTubeScans.get(tabId) === controller) {
        inFlightYouTubeScans.delete(tabId);
      }
    }
  }

  /** PB REST lookup for the most recent non-failed scan with the given
   *  YouTube source URL. Picks up both completed (`done`) and in-flight
   *  (`queued` / `scanning`) rows so the caller can either reuse the
   *  verdict or join the existing poll loop instead of POSTing a
   *  duplicate `scans` row. Returns null on miss / 401 / 404 — the
   *  caller falls through to the normal create+poll flow. The
   *  response shape matches the SW's existing `Scan` type because
   *  PB's record is what the API also returns. */
  async function findExistingYouTubeScan(
    sourceUrl: string,
    token: string,
    signal: AbortSignal,
  ): Promise<Scan | null> {
    const filter = `sourceUrl="${sourceUrl.replace(/"/g, '\\"')}" && status!="failed"`;
    const params = new URLSearchParams({
      filter,
      sort: '-created',
      perPage: '1',
    });
    try {
      const r = await fetch(
        `${PB_URL}/api/collections/scans/records?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal,
        },
      );
      if (!r.ok) return null;
      const body = (await r.json()) as { items?: Scan[] };
      return body.items?.[0] ?? null;
    } catch {
      // Network blip / aborted scan — fall through to live scan.
      return null;
    }
  }

  async function createYouTubeScan(
    url: string,
    title: string | undefined,
    token: string,
    signal: AbortSignal,
  ): Promise<Scan> {
    const form = new FormData();
    form.set('type', 'vid');
    form.set('subtype', 'yt-vid');
    form.set('origin', 'ext');
    form.set('sourceUrl', url);
    // The activity table key column is `scan.title`. Without this the
    // backend's deriveTitle falls back to the URL, which renders as a
    // long unreadable string in the table.
    if (title && title.trim()) form.set('title', title.trim());
    const r = await fetch(`${API_URL}/scans`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal,
    });
    if (!r.ok) {
      const reason = await safeReadError(r);
      throw new Error(`scans_create_${r.status}_${reason}`);
    }
    return (await r.json()) as Scan;
  }

  function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new Error('aborted'));
      const t = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(t);
        reject(new Error('aborted'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  async function safeReadError(r: Response): Promise<string> {
    try {
      const body = await r.json();
      if (body && typeof body.error === 'string') return body.error;
    } catch {}
    return 'unknown';
  }

  function sendTabMessage(tabId: number, msg: ExtensionMessage) {
    chrome.tabs.sendMessage(tabId, msg).then(
      () => {
        console.info('[heynotai/sw] sendTabMessage delivered', {
          tabId,
          type: msg.type,
        });
      },
      async (err) => {
        // Content script not present — most often happens when the
        // extension was reloaded after the page was already open. For
        // verdict messages (YT_SCAN_COMPLETE / FAILED), re-inject the
        // content script and retry once so the user actually sees the
        // result instead of the overlay spinning forever.
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn('[heynotai/sw] sendTabMessage failed', {
          tabId,
          type: msg.type,
          err: errMsg,
        });
        const isVerdict =
          msg.type === 'YT_SCAN_COMPLETE' ||
          msg.type === 'YT_SCAN_FAILED' ||
          msg.type === 'YT_SCAN_AUTH_REQUIRED';
        if (!isVerdict) return;
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content-scripts/content.js'],
          });
          await new Promise((r) => setTimeout(r, 700));
          await chrome.tabs.sendMessage(tabId, msg);
          console.info('[heynotai/sw] sendTabMessage delivered (after inject)', {
            tabId,
            type: msg.type,
          });
        } catch (retryErr) {
          console.warn('[heynotai/sw] verdict redelivery failed', {
            tabId,
            type: msg.type,
            err: retryErr instanceof Error ? retryErr.message : String(retryErr),
          });
          // Last-ditch: broadcast to extension contexts (drawer) so the
          // user at least sees that the verdict landed in PB even if
          // the in-page overlay can't be updated.
          if (msg.type === 'YT_SCAN_COMPLETE') {
            chrome.runtime
              .sendMessage({
                type: 'SCAN_COMPLETE',
                payload: {
                  videoId: msg.scan.id,
                  title: msg.scan.title ?? '',
                  result:
                    msg.scan.verdict === 'ai'
                      ? 'ai-generated'
                      : msg.scan.verdict === 'human'
                        ? 'authentic'
                        : 'suspicious',
                  trustScore: 100 - (msg.scan.aiPct ?? 0),
                  timestamp: Date.now(),
                  url: msg.scan.sourceUrl ?? '',
                },
              })
              .catch(() => {});
          } else if (msg.type === 'YT_SCAN_FAILED') {
            chrome.runtime
              .sendMessage({ type: 'SCAN_FAILED', error: msg.error })
              .catch(() => {});
          }
        }
      },
    );
  }

  /** Deliver a MANUAL_SCAN to a tab's content script. If the content
   *  script isn't present (extension was reloaded after the page
   *  loaded, etc.), inject content.js programmatically and retry once.
   *  On total failure broadcast SCAN_FAILED via runtime.sendMessage so
   *  the drawer can roll back its optimistic scanning UI. */
  async function triggerManualScan(tabId: number): Promise<void> {
    // Step 1 — direct delivery, in case the content script is already
    // running.
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'MANUAL_SCAN' });
      console.info('[heynotai/sw] MANUAL_SCAN delivered (no inject)', { tabId });
      return;
    } catch (err) {
      console.info('[heynotai/sw] direct delivery failed — will inject', {
        tabId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    // Step 2 — programmatically inject content.js, then retry. Path is
    // relative to the extension's web_accessible_resources output —
    // matches the build artifact in `.output/chrome-mv3/`.
    try {
      const injectResults = await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/content.js'],
      });
      console.info('[heynotai/sw] content.js injected', {
        tabId,
        frames: injectResults?.length ?? 0,
      });
      // The freshly-loaded content script adds its onMessage listener
      // inside a post-loadPrefs() promise chain, so give it a tick.
      await new Promise((r) => setTimeout(r, 700));
      await chrome.tabs.sendMessage(tabId, { type: 'MANUAL_SCAN' });
      console.info('[heynotai/sw] MANUAL_SCAN delivered (after inject)', { tabId });
    } catch (err) {
      console.warn('[heynotai/sw] inject + retry failed', {
        tabId,
        err: err instanceof Error ? err.message : String(err),
      });
      // Notify the drawer so its scanning UI doesn't spin forever.
      chrome.runtime
        .sendMessage({ type: 'SCAN_FAILED', error: 'content_script_missing' })
        .catch(() => {});
    }
  }

  async function injectDrawer(tabId: number, fromAutoReopen: boolean) {
    const popupUrl = chrome.runtime.getURL('drawer.html');
    const pinned = await getPinnedTabs();
    const initialPinned = pinned[tabId] === true;
    const { appliedTheme } = await chrome.storage.local.get('appliedTheme');
    const theme: 'light' | 'dark' = appliedTheme === 'dark' ? 'dark' : 'light';
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        args: [popupUrl, tabId, initialPinned, fromAutoReopen, theme],
        func: toggleHeynotaiDrawer,
      });
    } catch {
      // Chrome blocks injection on error pages, chrome://, web store, etc.
      // Nothing actionable — fail silently.
    }
  }

  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id || !isInjectableUrl(tab.url)) return;
    injectDrawer(tab.id, false);
  });

  console.info('[heynotai/sw] booted', {
    version: chrome.runtime.getManifest().version,
  });

  chrome.runtime.onMessage.addListener((msg: ExtensionMessage, sender) => {
    console.info('[heynotai/sw] message', {
      type: msg?.type,
      fromTab: sender.tab?.id ?? null,
    });
    if (msg.type === 'SCAN_COMPLETE' && sender.tab?.id != null) {
      const cfg = badgeConfig[msg.payload.result] ?? badgeConfig.authentic;
      const tabId = sender.tab.id;
      chrome.action.setBadgeText({ text: cfg.text, tabId });
      chrome.action.setBadgeBackgroundColor({ color: cfg.color, tabId });
      chrome.action.setBadgeTextColor({ color: '#ffffff', tabId });
    }
    if (msg.type === 'PIN_STATE') {
      setPinnedTab(msg.tabId, msg.pinned);
    }
    if (msg.type === 'TEXT_SELECTION_PRIMED' && sender.tab?.id != null) {
      primedTextSelections.set(sender.tab.id, msg.text);
    }
    if (msg.type === 'OPEN_DRAWER' && sender.tab?.id != null) {
      if (isInjectableUrl(sender.tab.url)) {
        injectDrawer(sender.tab.id, false);
      }
    }
    if (msg.type === 'TRIGGER_MANUAL_SCAN') {
      console.info('[heynotai/sw] TRIGGER_MANUAL_SCAN', { tabId: msg.tabId });
      // Fire-and-forget: don't rely on async sendResponse (MV3 SWs have
      // quirks around it). Status is broadcast back via SCAN_STARTED
      // (from the freshly-running content script) or SCAN_FAILED (if
      // the inject + retry both fail).
      void triggerManualScan(msg.tabId);
      return;
    }
    if (msg.type === 'YT_SCAN_REQUEST' && sender.tab?.id != null) {
      console.info('[heynotai/sw] YT_SCAN_REQUEST received', {
        tabId: sender.tab.id,
        url: msg.url,
        mediaId: msg.mediaId,
      });
      runYouTubeScan(sender.tab.id, msg.url, msg.mediaId, msg.title).catch((err) => {
        // runYouTubeScan handles its own error reporting via
        // YT_SCAN_FAILED. Anything reaching here would be a bug.
        console.warn('[heynotai/sw] runYouTubeScan threw', err);
      });
    }
    // NOTE: we used to abort in-flight scans on PAGE_CHANGED here, but
    // the content script re-broadcasts PAGE_CHANGED at t=1.5s and
    // t=3.5s after a YouTube page change to pick up late-rendered DOM
    // metadata. Those settle broadcasts hit *during* a scan and were
    // killing it ~1.5s in. The abort path is now handled where it
    // belongs: at the top of runYouTubeScan (new YT_SCAN_REQUEST kills
    // the previous one) and in tabs.onRemoved (tab close). Stale
    // verdicts from a no-longer-current video are filtered out by the
    // mediaId guard in content.ts.
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && !isSupportedScanUrl(changeInfo.url)) {
      chrome.action.setBadgeText({ text: '', tabId });
    }
    if (changeInfo.status !== 'complete') return;
    if (!isInjectableUrl(tab.url)) return;
    const pinned = await getPinnedTabs();
    if (pinned[tabId]) injectDrawer(tabId, true);
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    setPinnedTab(tabId, false);
    inFlightTextScans.get(tabId)?.abort();
    inFlightTextScans.delete(tabId);
    inFlightYouTubeScans.get(tabId)?.abort();
    inFlightYouTubeScans.delete(tabId);
    primedTextSelections.delete(tabId);
    stopTextScanBadge(tabId);
  });
});

/* ── Drawer toggle (host-page injection) ─────────────────────────
   Builds the floating drawer + a small vertical control rail beside it.
   Rail buttons (top → bottom): close, pin, refresh, dock-side.
   - Close   → slide-out + remove + unpin.
   - Pin     → toggles a "pinned" flag (persisted via PIN_STATE message).
   - Refresh → reloads the iframe.
   - Dock    → swaps the drawer between the left and right edges of
               the viewport via a single transform value driven from
               --hn-x; the rail's own side flips automatically.

   Arguments (passed via chrome.scripting.executeScript args):
   - popupUrl:       URL of the drawer HTML
   - tabId:          the tab this drawer lives on (for pin persistence)
   - initialPinned:  whether the pin button should start active
   - fromAutoReopen: true when injected because the tab was pinned on
                     load — in that case, don't toggle-close an existing
                     drawer, just early-return. */
function toggleHeynotaiDrawer(
  popupUrl: string,
  tabId: number,
  initialPinned: boolean,
  fromAutoReopen: boolean,
  initialTheme: 'light' | 'dark',
) {
  const ROOT_ID = 'heynotai-drawer-root';
  const STYLE_ID = 'heynotai-drawer-style';
  const existing = document.getElementById(ROOT_ID);

  const closeNow = (el: HTMLElement) => {
    const side = el.dataset.side === 'left' ? 'left' : 'right';
    el.style.setProperty(
      '--hn-x',
      side === 'right' ? '100vw' : '-100%',
    );
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 500);
  };

  if (existing) {
    if (fromAutoReopen) return;
    closeNow(existing);
    return;
  }

  // Mount target. We previously appended to <html> as a sibling of
  // <body>, but that location is non-standard and YouTube's watch
  // pages (in particular theatre/ambient mode and SPA navigations)
  // route clicks past elements that aren't body descendants. Pick
  // <body> when it exists so the drawer participates in the normal
  // hit-testing tree like any other floating UI.
  const mount: HTMLElement = document.body ?? document.documentElement;

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        position: fixed;
        top: 0;
        left: 0;
        width: min(440px, 92vw);
        height: 100vh;
        z-index: 2147483647;
        background: #f3f0e8;
        opacity: 0;
        --hn-x: 100vw;
        transform: translateX(var(--hn-x));
        transition:
          transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
          opacity   0.4s ease;
        will-change: transform, opacity;
        /* Defensive: some hosts (YouTube watch pages, FB feed) ship
           rules like \`iframe, [role="dialog"] { pointer-events: none }\`
           that win specificity against an injected element. Force
           interactivity so clicks always land on our drawer instead
           of falling through to the page underneath. */
        pointer-events: auto !important;
      }
      #${ROOT_ID}[data-theme="dark"] { background: #0f1013; }
      #${ROOT_ID}[data-side="right"] {
        border-left: 1px solid rgba(0,0,0,0.12);
        box-shadow: -24px 0 60px rgba(0,0,0,0.32),
                    -6px 0 14px rgba(0,0,0,0.18);
      }
      #${ROOT_ID}[data-side="left"] {
        border-right: 1px solid rgba(0,0,0,0.12);
        box-shadow: 24px 0 60px rgba(0,0,0,0.32),
                    6px 0 14px rgba(0,0,0,0.18);
      }
      #${ROOT_ID} > iframe {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
        background: transparent;
        pointer-events: auto !important;
      }

      /* Vertical control rail — matches the extension's .icon-btn design
         language (warm neutrals, 28×28 buttons, 7px radius, 14px icons). */
      #${ROOT_ID} .hn-rail {
        position: absolute;
        top: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        width: 36px;
        padding: 4px;
        background: #ffffff;
        border-radius: 12px;
        box-shadow:
          0 20px 60px rgba(20,18,10,0.18),
          0 2px 6px rgba(20,18,10,0.06),
          0 0 0 1px rgba(26,25,22,0.09);
        z-index: 1;
        pointer-events: auto !important;
      }
      #${ROOT_ID} .hn-rail button { pointer-events: auto !important; }
      #${ROOT_ID}[data-side="right"] .hn-rail { left: -44px; }
      #${ROOT_ID}[data-side="left"]  .hn-rail { right: -44px; }

      #${ROOT_ID} .hn-rail button {
        appearance: none;
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: 0;
        border-radius: 7px;
        color: #5b5749;
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease;
        padding: 0;
      }
      #${ROOT_ID} .hn-rail button:hover,
      #${ROOT_ID} .hn-rail button.is-active {
        background: #f1ede4;
        color: #1a1916;
      }
      #${ROOT_ID} .hn-rail svg {
        width: 14px;
        height: 14px;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
        transition: transform 0.18s ease;
      }
      #${ROOT_ID} .hn-rail button[data-action="pin"].is-active svg {
        transform: rotate(-20deg);
        fill: currentColor;
        stroke: none;
      }

      #${ROOT_ID}[data-theme="dark"] .hn-rail {
        background: #17191e;
        box-shadow:
          0 20px 60px rgba(0,0,0,0.55),
          0 0 0 1px rgba(255,255,255,0.07);
      }
      #${ROOT_ID}[data-theme="dark"] .hn-rail button { color: #a5a39a; }
      #${ROOT_ID}[data-theme="dark"] .hn-rail button:hover,
      #${ROOT_ID}[data-theme="dark"] .hn-rail button.is-active {
        background: #0b0c0f;
        color: #ecebe5;
      }

      @media (prefers-reduced-motion: reduce) {
        #${ROOT_ID} { transition-duration: 0.01ms !important; }
      }
    `;
    mount.appendChild(style);
  }

  // ── Build the drawer + rail ──
  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.dataset.side = 'right';
  root.dataset.theme = initialTheme;
  root.style.setProperty('--hn-x', '100vw'); // start off-screen right

  const iframe = document.createElement('iframe');
  // Pass tabId + current host URL so the drawer can classify the page
  // without needing the `tabs` permission (only `activeTab` is granted,
  // which doesn't help when the drawer is in a non-active tab via pin).
  iframe.src = `${popupUrl}?tabId=${tabId}&url=${encodeURIComponent(window.location.href)}`;
  iframe.setAttribute('allow', 'clipboard-write');
  root.appendChild(iframe);

  // Rail with the four control buttons. SVG paths are inline so the
  // injected drawer doesn't need any external icon font.
  const rail = document.createElement('div');
  rail.className = 'hn-rail';
  rail.innerHTML = `
    <button type="button" data-action="close" title="Close" aria-label="Close">
      <svg viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
    <button type="button" data-action="pin" title="Pin" aria-label="Pin">
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 17v5"/>
        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
      </svg>
    </button>
    <button type="button" data-action="refresh" title="Refresh" aria-label="Refresh">
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
        <path d="M21 3v5h-5"/>
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
        <path d="M3 21v-5h5"/>
      </svg>
    </button>
    <button type="button" data-action="dock" title="Dock to other side" aria-label="Dock to other side">
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2"/>
        <path d="M14 4v16"/>
      </svg>
    </button>
  `;
  root.appendChild(rail);

  if (initialPinned) {
    root.toggleAttribute('data-pinned', true);
    const pinBtn = rail.querySelector<HTMLButtonElement>('button[data-action="pin"]');
    pinBtn?.classList.add('is-active');
  }

  // Inline `pointer-events: auto !important` on every interactive
  // element. Inline styles with `important` priority beat any host
  // page CSS regardless of selector specificity — required because
  // YouTube's watch page ships rules that, on top of normal hit
  // testing, were eating clicks on the drawer iframe.
  root.style.setProperty('pointer-events', 'auto', 'important');
  iframe.style.setProperty('pointer-events', 'auto', 'important');
  rail.style.setProperty('pointer-events', 'auto', 'important');
  rail.querySelectorAll('button').forEach((btn) => {
    btn.style.setProperty('pointer-events', 'auto', 'important');
  });

  mount.appendChild(root);

  // Slide in: flip --hn-x on next frame so the transition catches.
  requestAnimationFrame(() => {
    root.style.setProperty('--hn-x', 'calc(100vw - 100%)'); // dock right
    root.style.opacity = '1';
  });

  const sendPinState = (pinned: boolean) => {
    try {
      chrome.runtime.sendMessage({ type: 'PIN_STATE', tabId, pinned });
    } catch {}
  };

  // ── Rail button handlers ──
  rail.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'close') {
      sendPinState(false);
      closeNow(root);
      cleanup();
      return;
    }

    if (action === 'pin') {
      const nowPinned = !root.hasAttribute('data-pinned');
      btn.classList.toggle('is-active', nowPinned);
      root.toggleAttribute('data-pinned', nowPinned);
      sendPinState(nowPinned);
      return;
    }

    if (action === 'refresh') {
      // Re-assigning .src forces a reload even if same URL.
      iframe.src = iframe.src;
      // Brief flash on the button so the action feels acknowledged.
      btn.classList.add('is-active');
      setTimeout(() => btn.classList.remove('is-active'), 350);
      return;
    }

    if (action === 'dock') {
      const next = root.dataset.side === 'right' ? 'left' : 'right';
      root.dataset.side = next;
      // For left: x = 0; for right: x = (100vw - drawer width)
      root.style.setProperty(
        '--hn-x',
        next === 'right' ? 'calc(100vw - 100%)' : '0px',
      );
      btn.classList.toggle('is-active', next === 'left');
      return;
    }
  });

  // ── Iframe → parent message bridge ──
  const onMessage = (ev: MessageEvent) => {
    if (ev.data === 'heynotai:close-drawer') {
      const el = document.getElementById(ROOT_ID);
      if (el) closeNow(el as HTMLElement);
      sendPinState(false);
      cleanup();
      return;
    }
    if (ev.data && typeof ev.data === 'object' && ev.data.type === 'heynotai:theme') {
      const next = ev.data.theme === 'dark' ? 'dark' : 'light';
      root.dataset.theme = next;
    }
  };
  const cleanup = () => window.removeEventListener('message', onMessage);
  window.addEventListener('message', onMessage);
}
