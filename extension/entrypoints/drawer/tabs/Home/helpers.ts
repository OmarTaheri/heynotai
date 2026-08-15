import type { IconName } from '@/components/Icon';
import type { Platform } from '@/lib/platform';
import type { YoutubeMeta } from '@/lib/messaging';
import { FRONTEND_URL } from '@/lib/scans-api';
import type { Scan } from '@/lib/scans-api';
import {
  PLACEHOLDER,
  signalsFromScan,
  taglineFromScan,
  type PageContent,
} from '@/lib/page-content';
import type { Verdict } from '@/lib/types';

export type { PageContent, Signal, Creator } from '@/lib/page-content';
export { detectorLabel, clampPct } from '@/lib/page-content';

export function platformIcon(p: string): IconName {
  return p === 'facebook' || p === 'youtube' || p === 'instagram'
    ? (p as IconName)
    : 'globe';
}

/** Build the drawer's content card for the current page.
 *
 *  Only YouTube has a metadata scraper (`extractYoutubeMeta`), so it is
 *  the only platform that gets a titled card. Instagram and Facebook
 *  return `null`: the content script reports `platform_not_supported`
 *  for both, and this used to hand back a fully-populated fixture
 *  (creator stats, "Voice cloning · ElevenLabs-like", a 92% score) that
 *  had nothing to do with the page on screen. */
export function contentFor(
  p: Platform,
  yt: YoutubeMeta | undefined,
  scan: Scan | null,
): PageContent | null {
  if (p === 'youtube') return youtubeContentFromMeta(yt, scan);
  return null;
}

/** Build the YouTube card from real DOM-scraped meta plus whatever the
 *  backend scan reported. When `meta` is undefined (YouTube hasn't
 *  hydrated yet, or we're on a non-watch page) fields fall back to an
 *  em-dash so missing data is visible rather than masked. */
export function youtubeContentFromMeta(
  meta: YoutubeMeta | undefined,
  scan: Scan | null,
): PageContent {
  const signals = signalsFromScan(scan);
  const tagline = taglineFromScan(scan);

  if (!meta) {
    return {
      title: PLACEHOLDER,
      author: PLACEHOLDER,
      meta: PLACEHOLDER,
      tagline,
      signals,
      creator: null,
      creatorCardTitle: 'Channel',
    };
  }

  const metaParts = [meta.duration, meta.views, meta.age].filter(Boolean);

  return {
    title: meta.title || PLACEHOLDER,
    author: meta.channelHandle || meta.channelName || PLACEHOLDER,
    meta: metaParts.join(' · ') || PLACEHOLDER,
    tagline,
    signals,
    creator: meta.channelName
      ? {
          displayName: meta.channelName,
          handle: meta.channelHandle || '',
          verified: meta.channelVerified,
          sub: meta.channelSubs || '',
        }
      : null,
    creatorCardTitle: 'Channel',
  };
}

export function contentNoun(p: Platform): string {
  if (p === 'youtube')   return 'video';
  if (p === 'instagram') return 'reel';
  if (p === 'facebook')  return 'post';
  return 'page';
}

export function verdictOf(pct: number): Verdict {
  return pct >= 50 ? 'ai' : pct >= 25 ? 'mixed' : 'human';
}

export function colorVarOf(v: Verdict) {
  return v === 'ai' ? 'var(--ai)' : v === 'human' ? 'var(--human)' : 'var(--mixed)';
}

export function verdictFromScan(scan: Scan): Verdict {
  const v = scan.verdict;
  if (v === 'human' || v === 'ai' || v === 'mixed') return v;
  return 'mixed';
}

export function relativeTime(iso: string): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const delta = Date.now() - ts;
  const sec = Math.round(delta / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return day === 1 ? 'yesterday' : `${day}d ago`;
}

export function openEditor(id: string) {
  const url = `${FRONTEND_URL}/editor/${encodeURIComponent(id)}`;
  if (chrome?.tabs?.create) chrome.tabs.create({ url });
  else window.open(url, '_blank', 'noopener,noreferrer');
}

export function verdictHeadline(scan: Scan): string {
  switch (scan.verdict) {
    case 'human': return 'human-written';
    case 'ai':    return 'AI-generated';
    case 'mixed': return 'mixed signals';
    default:      return 'unclear';
  }
}

export function detectionsCount(scan: Scan): number {
  return Array.isArray(scan.flags) ? scan.flags.length : 0;
}

export function hostMatches(pattern: string, host: string): boolean {
  const p = pattern.replace(/^www\./, '');
  const h = host.replace(/^www\./, '');
  if (p === h) return true;
  if (p.startsWith('*.')) {
    const bare = p.slice(2);
    return h === bare || h.endsWith('.' + bare);
  }
  return h === p || h.endsWith('.' + p);
}
