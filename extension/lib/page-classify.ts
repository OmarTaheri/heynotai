/** Pure page classification for the content script.
 *
 *  Extracted from `entrypoints/content.ts` so the rules can be tested
 *  without a DOM: given a hostname, a path, and a search string, decide
 *  which platform/surface the user is on and what the media id is.
 *
 *  The one piece that genuinely needs the DOM — picking the visible reel
 *  card on a Facebook feed URL that carries no id — is injected as a
 *  callback rather than reached for directly.
 */

export type Platform = 'youtube' | 'instagram' | 'facebook' | 'other';
export type Surface = 'videos' | 'reels' | 'posts' | null;

export interface PageInfo {
  platform: Platform;
  surface: Surface;
  mediaId: string;
}

export interface ClassifyInput {
  /** Hostname with any leading `www.` already acceptable — stripped here. */
  hostname: string;
  pathname: string;
  /** `location.search`, including the leading `?`. */
  search?: string;
  /** Full href, used as the media id for unrecognised (`other`) pages. */
  href: string;
  /** Resolves the visible Facebook reel card's `data-video-id` when the
   *  URL is a bare `/reels` feed. Returns null when nothing matches. */
  visibleReelId?: () => string | null;
}

export function normalizeHost(hostname: string): string {
  return hostname.replace(/^www\./, '');
}

/** Returns null when the page is on a supported platform but not on a
 *  scannable surface (a YouTube channel page, an Instagram profile).
 *  Unrecognised hosts classify as `other`, which the text-scan path
 *  handles. */
export function classifyPage(input: ClassifyInput): PageInfo | null {
  const host = normalizeHost(input.hostname);
  const path = input.pathname;

  if (host.endsWith('youtube.com')) {
    if (path === '/watch' || path.startsWith('/watch')) {
      const id = new URLSearchParams(input.search ?? '').get('v');
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
        // Feed view (no id in the URL) — fall back to the most visible
        // reel card on the page.
        id = input.visibleReelId?.() ?? '';
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
      // FB post URLs vary too much for a clean id — use the path so we
      // still detect SPA changes between distinct posts.
      return { platform: 'facebook', surface: 'posts', mediaId: path };
    }
    return null;
  }

  return { platform: 'other', surface: null, mediaId: input.href };
}

/** Canonical URL for a classified page. YouTube watch pages strip query
 *  params like `?t=10s` and playlist trackers, which vary freely on the
 *  same video and would otherwise look like navigation. */
export function canonicalPageUrl(info: PageInfo | null, href: string): string {
  if (info?.platform === 'youtube' && info.surface === 'videos') {
    return `https://www.youtube.com/watch?v=${info.mediaId}`;
  }
  if (info?.platform === 'youtube' && info.surface === 'reels') {
    return `https://www.youtube.com/shorts/${info.mediaId}`;
  }
  return href;
}

/** Does an allow-list entry cover this host? Accepts an exact match, a
 *  subdomain of the rule, or a `*.example.com` wildcard. */
export function hostMatches(pattern: string, host: string): boolean {
  const rule = normalizeHost(pattern.trim().toLowerCase());
  const current = normalizeHost(host.trim().toLowerCase());
  if (rule.startsWith('*.')) {
    const bare = rule.slice(2);
    return current === bare || current.endsWith(`.${bare}`);
  }
  return current === rule || current.endsWith(`.${rule}`);
}
