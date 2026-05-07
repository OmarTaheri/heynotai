import type { YoutubeMeta } from './messaging';

/** Pull video + channel metadata from the YouTube watch page DOM. Used
 *  to replace the drawer's hardcoded sample data with real values. All
 *  selectors are best-effort and fall back to '' so a YouTube redesign
 *  degrades to partial data instead of breaking the drawer. */
export function extractYoutubeMeta(videoId: string): YoutubeMeta | null {
  // Bail when the DOM still reflects the previous video — happens
  // mid-SPA-navigation between watch pages, where the URL (and thus
  // classifyPage's mediaId) has flipped to the new video but the
  // metadata DOM is still the old one. ytd-watch-flexy[video-id] is
  // the authoritative current video; meta[itemprop="videoId"] is a
  // fallback for redesigns that drop the flexy wrapper. Returning
  // null here makes runScan skip the title and lets the backend's
  // URL-derived fallback take over, which is correct (just URL-y) —
  // far better than persisting the previous video's title in PB.
  const flexyId =
    document
      .querySelector('ytd-watch-flexy[video-id]')
      ?.getAttribute('video-id') || '';
  const metaVideoId = text('meta[itemprop="videoId"]', 'content');
  const domVideoId = flexyId || metaVideoId;
  if (domVideoId && domVideoId !== videoId) return null;

  // Title — `meta[itemprop="name"]` is the most stable (SEO-stable),
  // h1 inside ytd-watch-metadata is the visual one. The bare
  // `yt-formatted-string.ytd-watch-metadata[title]` selector covers
  // future redesigns that drop the h1 wrapper but keep the component.
  const title =
    text('meta[itemprop="name"]', 'content') ||
    text('h1.ytd-watch-metadata yt-formatted-string') ||
    text('yt-formatted-string.ytd-watch-metadata[title]', 'title') ||
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
