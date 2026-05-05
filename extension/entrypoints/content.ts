import { detectionFromScan, simulateDetection } from '@/lib/detector';
import { pushScan } from '@/lib/storage';
import { sendMessage, type ExtensionMessage, type PageInfoPayload } from '@/lib/messaging';
import type { ScanDetection, ScanEntry, ScanState } from '@/lib/types';
import '@/styles/content.css';

type Platform = 'youtube' | 'instagram' | 'facebook';
type Surface = 'videos' | 'reels' | 'posts';

interface PageInfo {
  platform: Platform;
  surface: Surface;
  mediaId: string;
}

function pageInfoPayload(info: PageInfo | null): PageInfoPayload {
  const url = window.location.href;
  const host = window.location.hostname.replace(/^www\./, '');
  if (!info) return { platform: 'other', surface: null, url, host };
  return { platform: info.platform, surface: info.surface, url, host };
}

interface CachedPrefs {
  platforms?: Record<
    string,
    { enabled?: boolean; surfaces?: Record<string, boolean> }
  >;
  scanMode?: 'allowlist' | 'manual' | 'everything';
}

export default defineContentScript({
  matches: [
    '*://*.youtube.com/*',
    '*://*.instagram.com/*',
    '*://*.facebook.com/*',
  ],
  runAt: 'document_idle',
  cssInjectionMode: 'manifest',

  main() {
    // ── State ────────────────────────────────────────────
    let currentMediaId: string | null = null;
    let borderEl: HTMLDivElement | null = null;
    let badgeEl: HTMLDivElement | null = null;
    let panelEl: HTMLDivElement | null = null;
    let panelOpen = false;
    let actionBtnEl: HTMLElement | null = null;
    let attachedContainer: HTMLElement | null = null;
    let cachedPrefs: CachedPrefs | null = null;
    // Scan-state mirror so the drawer can ask "what happened on this tab
    // before I opened?" via QUERY_STATE.
    let isScanning = false;
    let lastScanResult: ScanEntry | null = null;
    let lastScanDetection: ScanDetection | null = null;
    let lastPageInfo: PageInfo | null = null;
    // mediaId of the in-flight backend scan so a verdict that arrives
    // late (after the user scrolled to the next video) can be ignored.
    let pendingScanMediaId: string | null = null;

    const badgeLabels: Record<ScanState | 'scanning', string> = {
      scanning: 'Scanning…',
      authentic: 'Authentic',
      suspicious: 'Uncertain',
      'ai-generated': 'AI Detected',
    };

    // ── Page classification ─────────────────────────────
    function classifyPage(): PageInfo | null {
      const host = window.location.hostname.replace(/^www\./, '');
      const path = window.location.pathname;

      if (host.endsWith('youtube.com')) {
        if (path === '/watch' || path.startsWith('/watch')) {
          const id = new URLSearchParams(window.location.search).get('v');
          if (!id) return null;
          return { platform: 'youtube', surface: 'videos', mediaId: id };
        }
        if (path.startsWith('/shorts/')) {
          const id = path.split('/shorts/')[1]?.split(/[/?#]/)[0] ?? '';
          if (!id) return null;
          return { platform: 'youtube', surface: 'reels', mediaId: id };
        }
        return null;
      }

      if (host.endsWith('instagram.com')) {
        if (path.startsWith('/reel/') || path.startsWith('/reels/')) {
          const parts = path.split('/').filter(Boolean);
          const id = parts[1] ?? '';
          if (!id) return null;
          return { platform: 'instagram', surface: 'reels', mediaId: id };
        }
        if (path.startsWith('/p/')) {
          const id = path.split('/p/')[1]?.split(/[/?#]/)[0] ?? '';
          if (!id) return null;
          return { platform: 'instagram', surface: 'posts', mediaId: id };
        }
        return null;
      }

      if (host.endsWith('facebook.com')) {
        const isReelPath =
          path.startsWith('/reel/') ||
          path.startsWith('/reels/') ||
          path === '/reel' ||
          path === '/reels';
        if (isReelPath) {
          const parts = path.split('/').filter(Boolean);
          let id = parts[1] ?? '';
          if (!id) {
            // Feed view (no ID in the URL) — pick the most visible
            // reel card on the page and use its data-video-id.
            const card = findVisibleReelCard();
            id = card?.getAttribute('data-video-id') ?? '';
          }
          if (!id) return null;
          return { platform: 'facebook', surface: 'reels', mediaId: id };
        }
        if (
          /^\/[^/]+\/posts\//.test(path) ||
          path.startsWith('/permalink') ||
          path.startsWith('/photo') ||
          path.startsWith('/posts/')
        ) {
          // FB post URLs vary too much for a clean ID — use the path so
          // we still detect SPA changes between distinct posts.
          return { platform: 'facebook', surface: 'posts', mediaId: path };
        }
        return null;
      }

      return null;
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

    // ── Prefs gating (chrome.storage.local mirrored by drawer) ──
    async function loadPrefs(): Promise<void> {
      try {
        const out = await chrome.storage.local.get('extensionPrefs');
        cachedPrefs = (out.extensionPrefs as CachedPrefs | undefined) ?? null;
      } catch {
        cachedPrefs = null;
      }
    }

    function shouldAutoScan(info: PageInfo): boolean {
      const prefs = cachedPrefs;
      // Default-on until the drawer ever runs to seed prefs (fresh
      // install before first drawer open).
      if (!prefs) return true;
      if (prefs.scanMode === 'manual') return false;
      const p = prefs.platforms?.[info.platform];
      if (!p) return true; // unknown platform key — treat as default-on
      if (p.enabled !== true) return false;
      return p.surfaces?.[info.surface] === true;
    }

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (!changes.extensionPrefs) return;
      cachedPrefs =
        (changes.extensionPrefs.newValue as CachedPrefs | undefined) ?? null;
      const info = classifyPage();
      if (!info) return;
      if (shouldAutoScan(info)) {
        if (!borderEl) {
          currentMediaId = null;
          runScan();
        }
      } else {
        cleanup();
        currentMediaId = null;
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
    }

    // ── Overlay ─────────────────────────────────────────
    function injectOverlay(container: HTMLElement, surface: Surface) {
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
      // Prefer the cached real-backend detection (populated for YouTube
      // scans that completed). Fall back to the deterministic stub for
      // platforms that still simulate (IG/FB) or for the brief window
      // before a real verdict has landed.
      const result =
        lastScanDetection && info.mediaId === lastScanResult?.videoId
          ? lastScanDetection
          : simulateDetection(info.mediaId);

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
            <div class="hn-detail-row"><span class="hn-detail-label">Detection Type</span><span class="hn-detail-value">${result.detectionType}</span></div>
            <div class="hn-detail-row"><span class="hn-detail-label">Face Analysis</span><span class="hn-detail-value">${result.faceAnalysis}</span></div>
            <div class="hn-detail-row"><span class="hn-detail-label">Audio Sync</span><span class="hn-detail-value">${result.audioSync}</span></div>
            <div class="hn-detail-row"><span class="hn-detail-label">Frame Consistency</span><span class="hn-detail-value">${result.frameConsistency}</span></div>
            <div class="hn-detail-row"><span class="hn-detail-label">Scan Time</span><span class="hn-detail-value">${result.scanTime}s</span></div>
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
        cleanup();
        currentMediaId = null;
        return;
      }

      if (!force && !shouldAutoScan(info)) {
        cleanup();
        currentMediaId = null;
        return;
      }

      if (info.mediaId === currentMediaId && borderEl) return;

      cleanup();
      currentMediaId = info.mediaId;
      mountWithRetry(info);
    }

    function mountWithRetry(info: PageInfo, retries = 0) {
      if (retries > 12) return;
      const container = getContainer(info);
      if (!container) {
        setTimeout(() => mountWithRetry(info, retries + 1), 500);
        return;
      }

      // Container is in the DOM — commit to scanning state. Tell the
      // drawer so it can mirror the scanning UI alongside the page
      // overlay.
      isScanning = true;
      pendingScanMediaId = info.mediaId;
      try { sendMessage({ type: 'SCAN_STARTED' }); } catch {}

      injectOverlay(container, info.surface);

      // YouTube scans flow through the real backend (yt-dlp →
      // hf-video → PB). The verdict arrives asynchronously via
      // YT_SCAN_COMPLETE in the message listener below. Other
      // platforms (IG/FB) still use the deterministic mock.
      if (info.platform === 'youtube') {
        try {
          sendMessage({
            type: 'YT_SCAN_REQUEST',
            url: window.location.href,
            mediaId: info.mediaId,
          });
        } catch {
          // Background SW unreachable — fall back to the simulator so
          // the overlay still resolves to *something* instead of
          // pinwheeling forever.
          simulateAndApply(info);
        }
        return;
      }

      // IG/FB simulation path — kept until those platforms get the
      // same backend treatment.
      const scanDelay = 1000 + Math.random() * 1000;
      setTimeout(() => simulateAndApply(info), scanDelay);
    }

    function simulateAndApply(info: PageInfo) {
      const result = simulateDetection(info.mediaId);
      applyDetectionResult(info, result);
    }

    function applyDetectionResult(info: PageInfo, result: ScanDetection) {
      updateOverlay(result, info.surface);

      if (info.platform === 'youtube' && info.surface === 'videos') {
        injectActionButton(result);
      }

      if (result.state === 'authentic') {
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
      };

      isScanning = false;
      pendingScanMediaId = null;
      lastScanResult = entry;
      lastScanDetection = result;
      void pushScan(entry);
      try { sendMessage({ type: 'SCAN_COMPLETE', payload: entry }); } catch {}
    }

    function applyScanFailure(info: PageInfo, _error: string) {
      // Render a "suspicious" state rather than a dedicated error look —
      // failure is rare and the user shouldn't be left staring at a
      // pinwheeling border. The detail panel will still show the
      // simulated stub data; future polish can surface the error.
      const result: ScanDetection = {
        state: 'suspicious',
        trustScore: 50,
        label: 'Scan Unavailable',
        sublabel: 'We could not analyze this video right now.',
        detectionType: 'Unavailable',
        faceAnalysis: '—',
        audioSync: '—',
        frameConsistency: '—',
        scanTime: '0.0',
      };
      applyDetectionResult(info, result);
    }

    // ── Init ────────────────────────────────────────────
    void loadPrefs().then(() => {
      broadcastPageInfo();

      let lastUrl = location.href;
      const observer = new MutationObserver(() => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          broadcastPageInfo();
          setTimeout(() => runScan(), 800);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

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
          currentMediaId = null;
          runScan(true);
          return;
        }
        if (msg?.type === 'YT_SCAN_COMPLETE') {
          const m = msg as ExtensionMessage & { type: 'YT_SCAN_COMPLETE' };
          // Drop late responses — the user navigated to a different
          // video before this one finished.
          if (pendingScanMediaId && m.mediaId !== pendingScanMediaId) return;
          const info = classifyPage();
          if (!info || info.mediaId !== m.mediaId) return;
          const detection = detectionFromScan(m.scan);
          applyDetectionResult(info, detection);
          return;
        }
        if (msg?.type === 'YT_SCAN_FAILED') {
          const m = msg as ExtensionMessage & { type: 'YT_SCAN_FAILED' };
          if (pendingScanMediaId && m.mediaId !== pendingScanMediaId) return;
          const info = classifyPage();
          if (!info || info.mediaId !== m.mediaId) return;
          applyScanFailure(info, m.error);
          return;
        }
        if (msg?.type === 'YT_SCAN_AUTH_REQUIRED') {
          const m = msg as ExtensionMessage & { type: 'YT_SCAN_AUTH_REQUIRED' };
          if (pendingScanMediaId && m.mediaId !== pendingScanMediaId) return;
          const info = classifyPage();
          if (!info || info.mediaId !== m.mediaId) return;
          // Treat auth-required like a soft failure — the badge stops
          // pinwheeling so the page doesn't look broken. The user can
          // sign in via the drawer.
          applyScanFailure(info, 'auth_required');
          return;
        }
      });
    });
  },
});
