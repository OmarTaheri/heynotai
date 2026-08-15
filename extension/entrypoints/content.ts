import { extensionFlag, type ExtensionFlagId } from '@heynotai/shared';
import { detectionFromScan } from '@/lib/detector';
import {
  canonicalPageUrl,
  classifyPage as classifyPageInput,
  normalizeHost,
  type PageInfo,
  type Platform,
  type Surface,
} from '@/lib/page-classify';
import { shouldAutoScan as evaluateScanGate, type ScanPrefs } from '@/lib/scan-gate';
import {
  sendMessage,
  type ExtensionMessage,
  type PageInfoPayload,
} from '@/lib/messaging';
import type { ScanDetection, ScanEntry, ScanState } from '@/lib/types';
import { extractYoutubeMeta } from '@/lib/youtube-meta';
import '@/styles/content.css';

function pageInfoPayload(info: PageInfo | null): PageInfoPayload {
  const url = canonicalPageUrl(info, window.location.href);
  const host = window.location.hostname.replace(/^www\./, '');
  if (!info) return { platform: 'other', surface: null, url, host };
  const payload: PageInfoPayload = {
    platform: info.platform,
    surface: info.surface,
    url,
    host,
  };
  if (info.platform === 'youtube' && info.surface === 'videos') {
    const yt = extractYoutubeMeta(info.mediaId);
    if (yt) payload.youtube = yt;
  }
  return payload;
}

interface CachedPrefs extends ScanPrefs {
  /** Named behaviour toggles from the website's Extension page. See
   *  `EXTENSION_FLAG_IDS` in @heynotai/shared for the ids that matter. */
  flags?: Record<string, boolean>;
}

/** The detail panel is built with innerHTML, and some of its values now
 *  come from the provider (the model id on the Detector row). Escape
 *  before interpolating so a hostile model name can't inject markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractPageText(): string {
  const text = document.body?.innerText?.replace(/\n{3,}/g, '\n\n').trim() ?? '';
  return text.slice(0, 1_000_000);
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  cssInjectionMode: 'manifest',

  main() {
    // ── Install marker ───────────────────────────────────
    // Stamp the document root so heynotai.com can tell whether this
    // browser actually has the extension, and which version. The
    // website's /app/extension page reads this; before it existed the
    // page hard-coded "Active · synced 12 seconds ago · v2.4.1"
    // whether or not anything was installed.
    try {
      const root = document.documentElement;
      root.setAttribute(
        'data-heynotai-extension',
        chrome.runtime.getManifest().version,
      );
      root.setAttribute('data-heynotai-extension-id', chrome.runtime.id);
    } catch {
      // Non-extension context (unit tests, plain-browser preview).
    }

    // ── State ────────────────────────────────────────────
    let currentMediaId: string | null = null;
    let borderEl: HTMLDivElement | null = null;
    let badgeEl: HTMLDivElement | null = null;
    let panelEl: HTMLDivElement | null = null;
    let panelOpen = false;
    let actionBtnEl: HTMLElement | null = null;
    let attachedContainer: HTMLElement | null = null;
    let cachedPrefs: CachedPrefs | null = null;
    // Mirrors heynotai_auth in chrome.storage.local so we can cheaply
    // gate the YouTube scan path without an async storage round-trip on
    // every URL change. Updated by chrome.storage.onChanged below.
    let isAuthed = false;
    // Scan-state mirror so the drawer can ask "what happened on this tab
    // before I opened?" via QUERY_STATE.
    let isScanning = false;
    let lastScanResult: ScanEntry | null = null;
    let lastScanDetection: ScanDetection | null = null;
    let lastPageInfo: PageInfo | null = null;
    // mediaId of the in-flight backend scan so a verdict that arrives
    // late (after the user scrolled to the next video) can be ignored.
    let pendingScanMediaId: string | null = null;
    // Snapshot of the PageInfo at scan-start. Used on YT_SCAN_COMPLETE
    // when classifyPage() can't confirm the current page (e.g. YouTube
    // SPA navigation has the DOM in a transient state, or the user is
    // on a surface variant — Music, embed — where selectors don't
    // match). Without this fallback the verdict was dropped silently
    // and the drawer stuck on "Analyzing video…" forever.
    let pendingScanInfo: PageInfo | null = null;

    const badgeLabels: Record<ScanState | 'scanning', string> = {
      scanning: 'Scanning…',
      authentic: 'Authentic',
      suspicious: 'Uncertain',
      'ai-generated': 'AI Detected',
    };

    // ── Page classification ─────────────────────────────
    // Rules live in lib/page-classify.ts so they can be unit-tested
    // without a DOM; only the Facebook feed fallback needs one.
    function classifyPage(): PageInfo | null {
      return classifyPageInput({
        hostname: window.location.hostname,
        pathname: window.location.pathname,
        search: window.location.search,
        href: window.location.href,
        visibleReelId: () =>
          findVisibleReelCard()?.getAttribute('data-video-id') ?? null,
      });
    }

    // Pick the [data-video-id] card that occupies the most of the
    // viewport — this is FB's stable anchor for an individual reel,
    // and a feed view stacks several of them so we have to compare.
    function findVisibleReelCard(): HTMLElement | null {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>('[data-video-id]'),
      );
      let bestCard: HTMLElement | null = null;
      let bestArea = 0;
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        if (r.height < 200 || r.width < 100) continue;
        const visibleH = Math.max(
          0,
          Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0),
        );
        const area = visibleH * Math.min(r.width, window.innerWidth);
        if (area > bestArea) {
          bestArea = area;
          bestCard = c;
        }
      }
      return bestCard;
    }

    // ── Container resolution per surface ────────────────
    function findVisibleVideo(): HTMLVideoElement | null {
      const videos = Array.from(document.querySelectorAll('video'));
      let bestVideo: HTMLVideoElement | null = null;
      let bestArea = 0;
      for (const v of videos) {
        const r = v.getBoundingClientRect();
        const visible =
          r.bottom > 0 && r.right > 0 &&
          r.top < window.innerHeight && r.left < window.innerWidth &&
          r.width > 80 && r.height > 80;
        if (!visible) continue;
        const area = r.width * r.height;
        if (area > bestArea) {
          bestArea = area;
          bestVideo = v as HTMLVideoElement;
        }
      }
      if (bestVideo) return bestVideo;
      return (videos[0] as HTMLVideoElement) ?? null;
    }

    // Walk up from the visible video looking for a stable, reel-sized
    // ancestor. IG and FB rebrand DOM frequently, so heuristics by size
    // are more durable than data-attribute selectors.
    function findReelContainer(): HTMLElement | null {
      const video = findVisibleVideo();
      if (!video) return null;
      let el: HTMLElement | null = video.parentElement;
      let lastReasonable: HTMLElement | null = video.parentElement;
      let depth = 0;
      while (el && el !== document.body && depth < 8) {
        const r = el.getBoundingClientRect();
        // Reel containers are tall portrait blocks. Once we walk past
        // one, the next ancestor is usually the page's outer scroller —
        // stop there and return the last good one.
        if (r.height >= 360 && r.width >= 200 && r.height < window.innerHeight * 1.2) {
          lastReasonable = el;
        }
        if (r.height > window.innerHeight * 1.4) break;
        el = el.parentElement;
        depth += 1;
      }
      return lastReasonable;
    }

    function getContainer(info: PageInfo): HTMLElement | null {
      if (info.platform === 'youtube' && info.surface === 'videos') {
        return (
          document.querySelector<HTMLElement>('#movie_player') ||
          document.querySelector<HTMLElement>('.html5-video-player') ||
          document.querySelector<HTMLElement>('#player-container-inner')
        );
      }
      if (info.platform === 'youtube' && info.surface === 'reels') {
        return (
          document.querySelector<HTMLElement>(
            'ytd-reel-video-renderer[is-active] .html5-video-player',
          ) ||
          document.querySelector<HTMLElement>(
            'ytd-reel-video-renderer[is-active]',
          ) ||
          document.querySelector<HTMLElement>('#shorts-player') ||
          document.querySelector<HTMLElement>('ytd-shorts')
        );
      }
      if (info.platform === 'instagram' && info.surface === 'reels') {
        return findReelContainer();
      }
      if (info.platform === 'instagram' && info.surface === 'posts') {
        return (
          document.querySelector<HTMLElement>('article[role="presentation"]') ||
          document.querySelector<HTMLElement>('article')
        );
      }
      if (info.platform === 'facebook' && info.surface === 'reels') {
        // FB reel cards carry their own data-video-id matching the URL
        // slug — most reliable anchor across FB's frequent DOM
        // refactors. Fall back to walking up from the visible video,
        // then to the heuristic parent walk.
        if (info.mediaId) {
          const exact = document.querySelector<HTMLElement>(
            `[data-video-id="${CSS.escape(info.mediaId)}"]`,
          );
          if (exact) return exact;
        }
        const video = findVisibleVideo();
        if (video) {
          const card = video.closest<HTMLElement>('[data-video-id]');
          if (card) return card;
        }
        const card = findVisibleReelCard();
        if (card) return card;
        return findReelContainer();
      }
      if (info.platform === 'facebook' && info.surface === 'posts') {
        return (
          document.querySelector<HTMLElement>('[role="article"]') ||
          document.querySelector<HTMLElement>('[data-pagelet="FeedUnit_0"]')
        );
      }
      return null;
    }

    /** Behaviour flag with its documented default applied. */
    function flag(id: ExtensionFlagId): boolean {
      return extensionFlag(cachedPrefs?.flags, id);
    }

    /** Verbose tracing, gated on the "Show debug overlay" toggle. The
     *  scan path used to log unconditionally on every page. */
    function debugLog(...args: unknown[]): void {
      if (flag('debug')) console.info(...args);
    }

    // ── Prefs gating (chrome.storage.local mirrored by drawer) ──
    async function loadPrefs(): Promise<void> {
      try {
        const out = await chrome.storage.local.get('extensionPrefs');
        cachedPrefs = (out.extensionPrefs as CachedPrefs | undefined) ?? null;
      } catch {
        cachedPrefs = null;
      }
      debugLog('[heynotai/scan] prefs loaded', {
        scanMode: cachedPrefs?.scanMode,
        platforms: cachedPrefs?.platforms,
      });
    }

    // ── Auth gating ──────────────────────────────────────
    // Read the stored auth blob mirrored by the drawer's auth-state.tsx.
    // We only need to know "is there a non-empty token", not the value
    // itself — the background SW reads the actual token when calling
    // /scans. Keeping this boolean cached avoids an async hop every time
    // the user navigates between videos.
    async function loadAuth(): Promise<void> {
      try {
        const out = await chrome.storage.local.get('heynotai_auth');
        const auth = out.heynotai_auth as { token?: string } | undefined;
        isAuthed = !!auth?.token && auth.token.length > 0;
      } catch {
        isAuthed = false;
      }
    }

    /** Decide whether the content script should auto-fire a scan for the
     *  current page. The policy itself lives in lib/scan-gate.ts; this
     *  just feeds it the cached prefs and the current host. The returned
     *  `reason` names the gate that decided, so a blocked scan can be
     *  explained instead of vanishing silently. */
    function shouldAutoScan(info: PageInfo) {
      return evaluateScanGate(
        info,
        cachedPrefs,
        normalizeHost(window.location.hostname),
      );
    }

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.extensionPrefs) {
        cachedPrefs =
          (changes.extensionPrefs.newValue as CachedPrefs | undefined) ?? null;
        debugLog('[heynotai/scan] prefs updated', {
          scanMode: cachedPrefs?.scanMode,
          platforms: cachedPrefs?.platforms,
        });
        const info = classifyPage();
        if (!info) return;
        const decision = shouldAutoScan(info);
        debugLog('[heynotai/scan] re-evaluating after prefs change', {
          info,
          decision,
        });
        if (decision.allow) {
          if (!borderEl) {
            currentMediaId = null;
            runScan();
          }
        } else {
          // Pref change disabled scanning for this surface. If a scan
          // was in flight, cancel it and tell the drawer — otherwise
          // its `scanning=true` state stays stuck forever (no
          // SCAN_COMPLETE will ever arrive for this scan).
          const wasScanning = isScanning;
          cleanup();
          currentMediaId = null;
          if (wasScanning) {
            isScanning = false;
            pendingScanMediaId = null;
            pendingScanInfo = null;
            try { sendMessage({ type: 'SCAN_FAILED', error: 'cancelled' }); } catch {}
          }
        }
      }
      if (changes.heynotai_auth) {
        const next = changes.heynotai_auth.newValue as { token?: string } | undefined;
        const wasAuthed = isAuthed;
        isAuthed = !!next?.token && next.token.length > 0;
        // Auth flipped on (sign-in via drawer): retry the scan that we
        // skipped earlier. Auth flipped off (sign-out): clear any
        // overlay so a stale verdict doesn't linger.
        if (!wasAuthed && isAuthed) {
          currentMediaId = null;
          runScan();
        } else if (wasAuthed && !isAuthed) {
          cleanup();
          currentMediaId = null;
          lastScanResult = null;
          lastScanDetection = null;
        }
      }
    });

    // Broadcast the current page's classification so the drawer (if
    // open) can update its main view without re-querying chrome.tabs.
    function broadcastPageInfo() {
      const info = classifyPage();
      // New media → drop any stale "scanned" state so the drawer
      // doesn't keep showing the previous video's verdict.
      if (info && (!lastPageInfo || lastPageInfo.mediaId !== info.mediaId)) {
        lastScanResult = null;
      } else if (!info) {
        lastScanResult = null;
      }
      lastPageInfo = info;
      try {
        sendMessage({ type: 'PAGE_CHANGED', payload: pageInfoPayload(info) });
      } catch {}
      // YouTube loads watch-page metadata asynchronously — the title,
      // channel name, view count, etc. show up over the first few
      // seconds. Re-broadcast a couple of times so the drawer's card
      // gets populated even if the user opens it before YouTube has
      // hydrated. Skipped for non-YouTube to avoid pointless work.
      if (info?.platform === 'youtube' && info.surface === 'videos') {
        const settle = (delayMs: number) =>
          setTimeout(() => {
            const stillSame = classifyPage();
            if (!stillSame || stillSame.mediaId !== info.mediaId) return;
            try {
              sendMessage({ type: 'PAGE_CHANGED', payload: pageInfoPayload(stillSame) });
            } catch {}
          }, delayMs);
        settle(1500);
        settle(3500);
      }
    }

    // ── Overlay ─────────────────────────────────────────
    // Gated on the "Inline verdict overlays" toggle. With it off the
    // scan still runs and the drawer still shows the verdict; the page
    // just isn't decorated.
    function injectOverlay(container: HTMLElement, surface: Surface) {
      if (!flag('inline-overlay')) return;
      attachedContainer = container;
      container.classList.add('hn-video-container-positioned');
      if (surface === 'reels') container.classList.add('hn-vertical');

      borderEl = document.createElement('div');
      borderEl.id = 'heynotai-border';
      borderEl.className =
        surface === 'reels' ? 'hn-scanning hn-vertical' : 'hn-scanning';
      container.appendChild(borderEl);

      badgeEl = document.createElement('div');
      badgeEl.id = 'heynotai-badge';
      badgeEl.className =
        surface === 'reels' ? 'hn-scanning hn-vertical' : 'hn-scanning';
      badgeEl.innerHTML = `
        <span class="hn-badge-dot"></span>
        <span class="hn-badge-label">${badgeLabels.scanning}</span>
      `;
      badgeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDetailPanel();
      });
      container.appendChild(badgeEl);
    }

    function updateOverlay(result: ScanDetection, surface: Surface) {
      if (!borderEl || !badgeEl) return;
      const verticalSuffix = surface === 'reels' ? ' hn-vertical' : '';
      const stateClass = `hn-${result.state}${verticalSuffix}`;
      borderEl.className = stateClass;
      badgeEl.className = stateClass;
      const label = badgeEl.querySelector<HTMLElement>('.hn-badge-label');
      if (label) label.textContent = badgeLabels[result.state];
      badgeEl.style.animation = 'none';
      void badgeEl.offsetHeight;
      badgeEl.style.animation = '';
    }

    function toggleDetailPanel() {
      if (panelOpen) closeDetailPanel();
      else openDetailPanel();
    }

    function openDetailPanel(_anchorEl?: HTMLElement) {
      const info = classifyPage();
      if (!info) return;
      // Never invent a verdict while a real scan is pending or unavailable.
      if (!lastScanDetection || info.mediaId !== lastScanResult?.videoId) return;
      const result = lastScanDetection;

      if (badgeEl) badgeEl.style.display = 'none';

      const colorClass =
        result.state === 'authentic' ? 'hn-green' :
        result.state === 'suspicious' ? 'hn-yellow' :
        'hn-red';

      const verdictIcon =
        result.state === 'authentic'
          ? '<svg viewBox="0 0 20 20" fill="none"><path d="M5 10.5l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          : result.state === 'suspicious'
          ? '<svg viewBox="0 0 20 20" fill="none"><path d="M8 7a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2.5 1.5-2.5 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="14.5" r="1" fill="currentColor"/></svg>'
          : '<svg viewBox="0 0 20 20" fill="none"><path d="M10 5.5v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="14" r="1" fill="currentColor"/></svg>';

      const backdrop = document.createElement('div');
      backdrop.id = 'heynotai-backdrop';
      backdrop.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDetailPanel();
      });
      document.body.appendChild(backdrop);

      panelEl = document.createElement('div');
      panelEl.id = 'heynotai-detail-panel';
      panelEl.innerHTML = `
        <div class="hn-panel-header">
          <div class="hn-logo-text">
            <svg class="hn-icon" viewBox="0 0 56 56" fill="none"><path d="M28 14C17 14 7.4 21.6 4 28c3.4 6.4 13 14 24 14s20.6-7.6 24-14c-3.4-6.4-13-14-24-14Z" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="28" cy="28" r="7" stroke="currentColor" stroke-width="3.5"/><circle cx="28" cy="28" r="2.5" fill="currentColor"/></svg>
            <span class="hn-logo-word" aria-label="heynotai">
              <span class="hn-logo-hey">hey</span>
              <span class="hn-logo-not"><span class="hn-logo-not-inner">not</span></span>
              <span class="hn-logo-ai">
                <span class="hn-logo-strike" aria-hidden="true"></span>ai
              </span>
            </span>
          </div>
          <button class="hn-panel-close-btn" id="hn-close-panel" aria-label="Close panel">
            <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="hn-panel-body">
          <div class="hn-panel-verdict">
            <div class="hn-verdict-icon ${colorClass}">${verdictIcon}</div>
            <div class="hn-verdict-text">
              <h3>${result.label}</h3>
              <p>${result.sublabel}</p>
            </div>
          </div>
          <div class="hn-trust-section">
            <div class="hn-trust-label">
              <span>Trust Score</span>
              <span class="hn-trust-score-value">${result.trustScore}/100</span>
            </div>
            <div class="hn-trust-bar">
              <div class="hn-trust-bar-fill ${colorClass}" style="width: ${result.trustScore}%"></div>
            </div>
          </div>
          <div class="hn-details-list">
            <div class="hn-detail-row"><span class="hn-detail-label">Detector</span><span class="hn-detail-value">${escapeHtml(result.detectionType)}</span></div>
            <div class="hn-detail-row"><span class="hn-detail-label">Face Analysis</span><span class="hn-detail-value">${escapeHtml(result.faceAnalysis)}</span></div>
            <div class="hn-detail-row"><span class="hn-detail-label">Audio Sync</span><span class="hn-detail-value">${escapeHtml(result.audioSync)}</span></div>
            <div class="hn-detail-row"><span class="hn-detail-label">Frame Consistency</span><span class="hn-detail-value">${escapeHtml(result.frameConsistency)}</span></div>
            <div class="hn-detail-row"><span class="hn-detail-label">Scan Time</span><span class="hn-detail-value">${escapeHtml(result.scanTime)}</span></div>
          </div>
        </div>
      `;

      document.body.appendChild(panelEl);
      panelOpen = true;

      const logoWord = panelEl.querySelector<HTMLElement>('.hn-logo-word');
      if (logoWord) {
        setTimeout(() => logoWord.classList.add('is-closed'), 1000);
      }

      panelEl.querySelector('#hn-close-panel')?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDetailPanel();
      });

      setTimeout(() => {
        document.addEventListener('keydown', escapeHandler);
      }, 100);
    }

    function closeDetailPanel() {
      const backdrop = document.getElementById('heynotai-backdrop');
      if (backdrop) {
        backdrop.classList.add('hn-closing');
        setTimeout(() => backdrop.remove(), 320);
      }
      if (panelEl) {
        panelEl.classList.add('hn-closing');
        const el = panelEl;
        setTimeout(() => {
          el.remove();
          panelEl = null;
        }, 320);
      }
      panelOpen = false;
      if (badgeEl) badgeEl.style.display = '';
      document.removeEventListener('keydown', escapeHandler);
    }

    function escapeHandler(e: KeyboardEvent) {
      if (e.key === 'Escape' && panelOpen) closeDetailPanel();
    }

    const HN_EYE_SVG = `
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" style="display:inherit;width:100%;height:100%">
        <path d="M12 5C7 5 2.7 8.4 1 12c1.7 3.6 6 7 11 7s9.3-3.4 11-7c-1.7-3.6-6-7-11-7z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
      </svg>
    `;

    function injectActionButton(result: ScanDetection, retries = 0): void {
      if (retries > 10) return;

      if (actionBtnEl) {
        actionBtnEl.remove();
        actionBtnEl = null;
      }

      const container = document.querySelector('#top-level-buttons-computed');
      if (!container) {
        setTimeout(() => injectActionButton(result, retries + 1), 500);
        return;
      }

      actionBtnEl = document.createElement('yt-button-view-model') as HTMLElement;
      actionBtnEl.className = 'ytd-menu-renderer';
      actionBtnEl.id = 'heynotai-action-wrapper';
      actionBtnEl.style.marginLeft = '8px';

      const innerWrap = document.createElement('button-view-model');
      innerWrap.className = 'ytSpecButtonViewModelHost style-scope ytd-menu-renderer';

      const btn = document.createElement('button');
      btn.className =
        'yt-spec-button-shape-next yt-spec-button-shape-next--tonal ' +
        'yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m ' +
        'yt-spec-button-shape-next--icon-leading ' +
        'yt-spec-button-shape-next--enable-backdrop-filter-experiment';
      btn.setAttribute('aria-label', `heynotai trust score: ${result.trustScore}%`);
      btn.innerHTML = `
        <div aria-hidden="true" class="yt-spec-button-shape-next__icon">
          <div style="width:24px;height:24px;display:block">${HN_EYE_SVG}</div>
        </div>
        <div class="yt-spec-button-shape-next__button-text-content">${result.trustScore}%</div>
        <yt-touch-feedback-shape aria-hidden="true" class="yt-spec-touch-feedback-shape yt-spec-touch-feedback-shape--touch-response">
          <div class="yt-spec-touch-feedback-shape__stroke"></div>
          <div class="yt-spec-touch-feedback-shape__fill"></div>
        </yt-touch-feedback-shape>
      `;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (panelOpen) closeDetailPanel();
        else openDetailPanel(btn);
      });

      innerWrap.appendChild(btn);
      actionBtnEl.appendChild(innerWrap);
      container.appendChild(actionBtnEl);
    }

    function cleanup() {
      borderEl?.remove(); borderEl = null;
      badgeEl?.remove();  badgeEl = null;
      panelEl?.remove();  panelEl = null; panelOpen = false;
      document.getElementById('heynotai-backdrop')?.remove();
      actionBtnEl?.remove(); actionBtnEl = null;
      document.removeEventListener('keydown', escapeHandler);
      if (attachedContainer) {
        attachedContainer.classList.remove('hn-video-container-positioned');
        attachedContainer.classList.remove('hn-vertical');
        attachedContainer = null;
      }
    }

    // ── Scan dispatch ───────────────────────────────────
    function runScan(force = false) {
      const info = classifyPage();
      if (!info) {
        debugLog('[heynotai/scan] runScan skipped: not on a supported page', {
          host: window.location.hostname,
          path: window.location.pathname,
        });
        cleanup();
        currentMediaId = null;
        return;
      }

      const decision = shouldAutoScan(info);
      debugLog('[heynotai/scan] runScan', { force, info, decision });

      // Auto-scan denied (platform/surface paused). The drawer owns
      // the manual-check UI now — no in-page floating button. Just
      // clean up any leftover overlay so the page is unobstructed.
      if (!force && !decision.allow) {
        debugLog('[heynotai/scan] auto-scan blocked', {
          reason: decision.reason,
          info,
        });
        if (info.mediaId !== currentMediaId || borderEl || badgeEl) {
          cleanup();
          currentMediaId = info.mediaId;
        }
        return;
      }

      if (info.platform === 'other') {
        const text = extractPageText();
        if (!text) {
          try { sendMessage({ type: 'SCAN_FAILED', error: 'no_readable_text' }); } catch {}
          return;
        }
        currentMediaId = info.mediaId;
        isScanning = true;
        try { sendMessage({ type: 'SCAN_STARTED' }); } catch {}
        try {
          sendMessage({
            type: 'PAGE_TEXT_SCAN_REQUEST',
            text,
            title: document.title || window.location.hostname,
            url: window.location.href,
          });
        } catch {
          isScanning = false;
          try { sendMessage({ type: 'SCAN_FAILED', error: 'scan_dispatch_failed' }); } catch {}
        }
        return;
      }

      if (info.mediaId === currentMediaId && borderEl) return;

      cleanup();
      currentMediaId = info.mediaId;
      mountWithRetry(info, force);
    }

    // `userInitiated` rides along to the backend so a signed-out
    // auto-scan can stay silent instead of opening the drawer.
    function mountWithRetry(info: PageInfo, userInitiated: boolean, retries = 0) {
      if (retries > 12) {
        console.warn('[heynotai/scan] mountWithRetry gave up — container never appeared', {
          platform: info.platform,
          surface: info.surface,
          mediaId: info.mediaId,
        });
        // Tell the drawer we bailed so its scanning UI doesn't spin
        // forever. Without this the user sees "Analyzing video…" with
        // no API call ever firing — exactly the symptom we're tracing.
        try { sendMessage({ type: 'SCAN_FAILED', error: 'container_not_found' }); } catch {}
        return;
      }
      const container = getContainer(info);
      if (!container) {
        setTimeout(() => mountWithRetry(info, userInitiated, retries + 1), 500);
        return;
      }

      // Container is in the DOM — commit to scanning state. Tell the
      // drawer so it can mirror the scanning UI alongside the page
      // overlay.
      debugLog('[heynotai/scan] mountWithRetry committing', {
        platform: info.platform,
        surface: info.surface,
        mediaId: info.mediaId,
      });
      isScanning = true;
      pendingScanMediaId = info.mediaId;
      pendingScanInfo = info;
      try { sendMessage({ type: 'SCAN_STARTED' }); } catch {}

      injectOverlay(container, info.surface);

      // YouTube scans flow through the real backend (yt-dlp →
      // hf-video → backend). The verdict arrives asynchronously via
      // YT_SCAN_COMPLETE in the message listener below. Other
      // platforms (IG/FB) report unsupported until a real downloader exists.
      if (info.platform === 'youtube') {
        // Scrape video + channel meta once, at click/scan time —
        // YouTube has fully hydrated by the time the user (or
        // auto-scan logic) actually triggers a check, which is
        // more reliable than the on-page-load timing of broadcasts.
        const ytMeta = extractYoutubeMeta(info.mediaId);
        // Canonical URL — strip ?t=12s, /shorts vs /watch trackers,
        // playlist IDs, etc. so a revisit to the same video reuses
        // the prior backend scan record instead of creating a new one.
        const canonicalUrl = `https://www.youtube.com/watch?v=${info.mediaId}`;
        // Re-broadcast PAGE_CHANGED with the freshly-captured meta so
        // the drawer's video header + channel card show exactly the
        // data the backend is about to receive — no risk of the
        // drawer reading a partially-hydrated DOM snapshot from an
        // earlier broadcast.
        if (ytMeta) {
          try {
            sendMessage({
              type: 'PAGE_CHANGED',
              payload: {
                platform: 'youtube',
                surface: info.surface,
                url: canonicalUrl,
                host: window.location.hostname.replace(/^www\./, ''),
                youtube: ytMeta,
              },
            });
          } catch {}
        }
        try {
          debugLog('[heynotai/scan] dispatching YT_SCAN_REQUEST', {
            url: canonicalUrl,
            mediaId: info.mediaId,
          });
          sendMessage({
            type: 'YT_SCAN_REQUEST',
            url: canonicalUrl,
            mediaId: info.mediaId,
            title: ytMeta?.title,
            userInitiated,
          });
        } catch (err) {
          // Background SW unreachable. Don't simulate — the user's
          // expectation is "checking with heynotai", not a fake
          // verdict. Tear down the overlay instead.
          console.warn('[heynotai/scan] YT_SCAN_REQUEST dispatch failed', err);
          cleanup();
          currentMediaId = null;
          isScanning = false;
          pendingScanMediaId = null;
          pendingScanInfo = null;
        }
        return;
      }

      // These sources need a server-side downloader before they can be
      // analyzed honestly. Do not substitute a deterministic fake verdict.
      isScanning = false;
      pendingScanMediaId = null;
      pendingScanInfo = null;
      cleanup();
      try { sendMessage({ type: 'SCAN_FAILED', error: 'platform_not_supported' }); } catch {}
    }

    function applyDetectionResult(
      info: PageInfo,
      result: ScanDetection,
      scanId?: string,
    ) {
      updateOverlay(result, info.surface);

      if (info.platform === 'youtube' && info.surface === 'videos') {
        injectActionButton(result);
      }

      // Authentic verdicts fade out after a beat so a clean page isn't
      // permanently decorated — unless the user asked to keep seeing
      // them ("Show authentic verdicts too").
      if (result.state === 'authentic' && !flag('show-authentic')) {
        setTimeout(() => {
          borderEl?.classList.add('hn-hidden');
          badgeEl?.classList.add('hn-hidden');
        }, 3000);
      }

      const entry: ScanEntry = {
        videoId: info.mediaId,
        title: document.title.replace(' - YouTube', ''),
        result: result.state,
        trustScore: result.trustScore,
        timestamp: Date.now(),
        url: window.location.href,
        scanId,
      };

      isScanning = false;
      pendingScanMediaId = null;
      pendingScanInfo = null;
      lastScanResult = entry;
      lastScanDetection = result;
      // backend is now the source of truth for scan history (queried by
      // both surfaces via useScansLive); the chrome.storage.local
      // mirror was never read back and has been removed.
      try { sendMessage({ type: 'SCAN_COMPLETE', payload: entry }); } catch {}
    }


    // ── Init ────────────────────────────────────────────
    void Promise.all([loadPrefs(), loadAuth()]).then(() => {
      broadcastPageInfo();

      let lastUrl = location.href;
      const checkUrlChange = () => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          broadcastPageInfo();
          setTimeout(() => runScan(), 800);
        }
      };
      setInterval(checkUrlChange, 500);
      window.addEventListener('yt-navigate-finish', checkUrlChange);

      if (document.readyState === 'complete') {
        setTimeout(() => runScan(), 1000);
      } else {
        window.addEventListener('load', () => setTimeout(() => runScan(), 1000));
      }

      window.addEventListener('popstate', () => {
        broadcastPageInfo();
        setTimeout(() => runScan(), 800);
      });

      chrome.runtime.onMessage.addListener((msg: ExtensionMessage | { type: string } | undefined, _sender, sendResponse) => {
        if (msg?.type === 'QUERY_STATE') {
          sendResponse({
            scanning: isScanning,
            scanned: !!lastScanResult,
            lastResult: lastScanResult ?? undefined,
            pageInfo: pageInfoPayload(lastPageInfo ?? classifyPage()),
          });
          return; // sync response
        }
        if (msg?.type === 'RESCAN' || msg?.type === 'MANUAL_SCAN') {
          debugLog('[heynotai/scan] manual scan request received', {
            type: msg.type,
          });
          currentMediaId = null;
          runScan(true);
          return;
        }
        if (msg?.type === 'YT_SCAN_COMPLETE') {
          const m = msg as ExtensionMessage & { type: 'YT_SCAN_COMPLETE' };
          debugLog('[heynotai/scan] YT_SCAN_COMPLETE received', {
            mediaId: m.mediaId,
            verdict: m.scan?.verdict,
            pendingScanMediaId,
          });
          // Drop late responses — the user navigated to a different
          // video before this one finished. pendingScanMediaId is the
          // authoritative "is this scan still relevant" signal; if it
          // matches, trust it. classifyPage() can be transiently null
          // mid-SPA-nav, which previously caused the result to be
          // silently dropped and the drawer stuck on "Analyzing".
          if (pendingScanMediaId && m.mediaId !== pendingScanMediaId) {
            debugLog('[heynotai/scan] dropping stale verdict', {
              expected: pendingScanMediaId,
              got: m.mediaId,
            });
            return;
          }
          const info =
            pendingScanInfo && pendingScanInfo.mediaId === m.mediaId
              ? pendingScanInfo
              : classifyPage();
          if (!info || info.mediaId !== m.mediaId) {
            debugLog('[heynotai/scan] dropping verdict — page no longer matches', {
              info,
              mediaId: m.mediaId,
            });
            return;
          }
          const detection = detectionFromScan(m.scan);
          debugLog('[heynotai/scan] applying detection result', {
            mediaId: m.mediaId,
            state: detection.state,
          });
          applyDetectionResult(info, detection, m.scan?.id);
          return;
        }
        if (msg?.type === 'YT_SCAN_FAILED') {
          const m = msg as ExtensionMessage & { type: 'YT_SCAN_FAILED' };
          if (pendingScanMediaId && m.mediaId !== pendingScanMediaId) return;
          console.warn('[heynotai] backend scan failed', m.error);

          try { sendMessage({ type: 'SCAN_FAILED', error: m.error }); } catch {}

          if (badgeEl) {
            if (borderEl) {
              borderEl.className = 'hn-ai-generated';
            }
            badgeEl.className = 'hn-ai-generated';
            const label = badgeEl.querySelector<HTMLElement>('.hn-badge-label');
            if (label) label.textContent = 'Scan Failed';
            badgeEl.style.animation = 'none';

            setTimeout(() => {
              cleanup();
              currentMediaId = null;
              isScanning = false;
              pendingScanMediaId = null;
              pendingScanInfo = null;
              runScan();
            }, 3000);
          } else {
            cleanup();
            currentMediaId = null;
            isScanning = false;
            pendingScanMediaId = null;
            pendingScanInfo = null;
            runScan();
          }
          return;
        }
        if (msg?.type === 'YT_SCAN_AUTH_REQUIRED') {
          const m = msg as ExtensionMessage & { type: 'YT_SCAN_AUTH_REQUIRED' };
          // The user signed out between scan dispatch and verdict, or
          // the cached `isAuthed` was stale. Either way: no overlay,
          // no fake verdict — same as the pre-flight gate.
          console.info('[heynotai] sign-in required for backend scans');
          cleanup();
          currentMediaId = null;
          isScanning = false;
          pendingScanMediaId = null;
          pendingScanInfo = null;
          try { sendMessage({ type: 'SCAN_FAILED' }); } catch {}
          // Only surface the sign-in screen when the user actually asked
          // for this scan. Auto-scan fires on every YouTube SPA
          // navigation, so opening the drawer here made the extension
          // appear to pop open at random while browsing.
          if (m.userInitiated) {
            try { sendMessage({ type: 'OPEN_DRAWER' }); } catch {}
          }
          return;
        }
      });
    });
  },
});
