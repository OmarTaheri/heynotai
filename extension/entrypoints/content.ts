import { detectionFromScan, simulateDetection } from '@/lib/detector';
import { pushScan } from '@/lib/storage';
import {
  sendMessage,
  type ExtensionMessage,
  type PageInfoPayload,
  type YoutubeMeta,
} from '@/lib/messaging';
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

/** Pull video + channel metadata from the YouTube watch page DOM. Used
 *  to replace the drawer's hardcoded sample data with real values. All
 *  selectors are best-effort and fall back to '' so a YouTube redesign
 *  degrades to partial data instead of breaking the drawer. */
function extractYoutubeMeta(videoId: string): YoutubeMeta | null {
  // Title — `meta[itemprop="name"]` is the most stable (SEO-stable),
  // h1 inside ytd-watch-metadata is the visual one.
  const title =
    text('meta[itemprop="name"]', 'content') ||
    text('h1.ytd-watch-metadata yt-formatted-string') ||
    text('h1.title.style-scope.ytd-video-primary-info-renderer') ||
    document.title.replace(/ - YouTube$/, '').trim();

  // Channel — link inside #upload-info / #owner.
  const channelLinkEl = document.querySelector<HTMLAnchorElement>(
    'ytd-channel-name a, #owner #channel-name a, #upload-info ytd-channel-name a',
  );
  const channelName =
    channelLinkEl?.textContent?.trim() ||
    text('span[itemprop="author"] link[itemprop="name"]', 'content') ||
    '';

  // Handle — extract from /@handle in the channel link href.
  const channelHandle = (() => {
    const href = channelLinkEl?.getAttribute('href') || '';
    const m = href.match(/\/@([^/?#]+)/);
    return m ? `@${m[1]}` : '';
  })();

  const channelVerified = !!document.querySelector(
    'ytd-channel-name .badge.verified, ytd-channel-name [aria-label*="Verified"], ytd-channel-name [aria-label*="erified"]',
  );

  // Subscriber count — youtube renders this as "128K subscribers"
  // inside #owner-sub-count.
  const channelSubs = text('#owner-sub-count') || '';

  // Duration — pull from the <video> element's metadata if loaded;
  // fall back to the duration meta tag (ISO 8601 like "PT12M4S").
  const videoEl = document.querySelector<HTMLVideoElement>('video.html5-main-video, video');
  let duration = '';
  if (videoEl && Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
    duration = formatSecondsClock(videoEl.duration);
  } else {
    const iso = text('meta[itemprop="duration"]', 'content');
    if (iso) duration = isoDurationToClock(iso);
  }

  // Views — `#info span` with `views` text. The watch page exposes a
  // raw count in `meta[itemprop="interactionCount"]`; format that for
  // a friendlier display.
  let views = '';
  const viewCountRaw = text('meta[itemprop="interactionCount"]', 'content');
  if (viewCountRaw) {
    const n = Number.parseInt(viewCountRaw, 10);
    if (Number.isFinite(n)) views = `${formatCount(n)} views`;
  }
  if (!views) {
    const infoText = Array.from(
      document.querySelectorAll<HTMLElement>('#info span, ytd-watch-info-text span'),
    )
      .map((el) => el.textContent?.trim() || '')
      .find((t) => /views/i.test(t));
    if (infoText) views = infoText;
  }

  // Age — `meta[itemprop="datePublished"]` is the publish date; format
  // as "Nd ago". Falls back to whatever YouTube renders inline.
  let age = '';
  const datePublished = text('meta[itemprop="datePublished"]', 'content');
  if (datePublished) {
    const ts = Date.parse(datePublished);
    if (Number.isFinite(ts)) age = formatRelativeAge(ts);
  }
  if (!age) {
    const ageInline = Array.from(
      document.querySelectorAll<HTMLElement>('#info span, ytd-watch-info-text span'),
    )
      .map((el) => el.textContent?.trim() || '')
      .find((t) => /\bago\b/i.test(t));
    if (ageInline) age = ageInline;
  }

  // If we got nothing meaningful yet, signal "not ready" so the drawer
  // keeps any prior payload instead of replacing with empty fields.
  // Title is the most reliable — if even that's missing, bail.
  if (!title) return null;

  return {
    videoId,
    title,
    channelName,
    channelHandle,
    channelVerified,
    channelSubs,
    duration,
    views,
    age,
  };
}

function text(selector: string, attr?: string): string {
  const el = document.querySelector(selector);
  if (!el) return '';
  if (attr) return el.getAttribute(attr) || '';
  return el.textContent?.trim() || '';
}

function formatSecondsClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function isoDurationToClock(iso: string): string {
  // Parses YouTube's ISO 8601 like PT12M4S / PT1H2M3S.
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(iso);
  if (!m) return '';
  const h = Number.parseInt(m[1] || '0', 10);
  const min = Number.parseInt(m[2] || '0', 10);
  const sec = Number.parseInt(m[3] || '0', 10);
  return formatSecondsClock(h * 3600 + min * 60 + sec);
}

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

function formatRelativeAge(ts: number): string {
  const ms = Date.now() - ts;
  if (ms < 0) return 'just now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
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
      if (changes.extensionPrefs) {
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
      // YouTube scans require auth — they hit the real backend.
      // When the user isn't signed in, stay quiet: no overlay, no
      // badge, nothing. The previous behavior fell back to a
      // deterministic mock, which made the extension look like it
      // was checking the video when it wasn't.
      if (info.platform === 'youtube' && !isAuthed) {
        cleanup();
        currentMediaId = null;
        return;
      }
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
        // Scrape video + channel meta once, at click/scan time —
        // YouTube has fully hydrated by the time the user (or
        // auto-scan logic) actually triggers a check, which is
        // more reliable than the on-page-load timing of broadcasts.
        const ytMeta = extractYoutubeMeta(info.mediaId);
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
                url: window.location.href,
                host: window.location.hostname.replace(/^www\./, ''),
                youtube: ytMeta,
              },
            });
          } catch {}
        }
        try {
          sendMessage({
            type: 'YT_SCAN_REQUEST',
            url: window.location.href,
            mediaId: info.mediaId,
            title: ytMeta?.title,
          });
        } catch {
          // Background SW unreachable. Don't simulate — the user's
          // expectation is "checking with heynotai", not a fake
          // verdict. Tear down the overlay instead.
          cleanup();
          currentMediaId = null;
          isScanning = false;
          pendingScanMediaId = null;
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


    // ── Init ────────────────────────────────────────────
    void Promise.all([loadPrefs(), loadAuth()]).then(() => {
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
          // Real backend couldn't deliver a verdict (api down, yt-dlp
          // not installed, scan timed out, etc.). Tear the overlay
          // down so the page doesn't sit with a pinwheeling badge —
          // we'd rather show nothing than a fake verdict.
          console.warn('[heynotai] backend scan failed', m.error);
          cleanup();
          currentMediaId = null;
          isScanning = false;
          pendingScanMediaId = null;
          return;
        }
        if (msg?.type === 'YT_SCAN_AUTH_REQUIRED') {
          // The user signed out between scan dispatch and verdict, or
          // the cached `isAuthed` was stale. Either way: no overlay,
          // no fake verdict — same as the pre-flight gate.
          console.info('[heynotai] sign-in required for backend scans');
          cleanup();
          currentMediaId = null;
          isScanning = false;
          pendingScanMediaId = null;
          return;
        }
      });
    });
  },
});
