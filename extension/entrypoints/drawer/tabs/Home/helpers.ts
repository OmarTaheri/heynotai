import type { IconName } from '@/components/Icon';
import {
  YOUTUBE_CONTENT,
  FACEBOOK_CONTENT,
  INSTAGRAM_CONTENT,
  type PlatformContent,
} from '@/lib/sample-data';
import type { Platform } from '@/lib/platform';
import type { YoutubeMeta } from '@/lib/messaging';
import { FRONTEND_URL } from '@/lib/scans-api';
import type { Scan } from '@/lib/scans-api';
import type { Verdict } from '@/lib/types';

export function platformIcon(p: string): IconName {
  return p === 'facebook' || p === 'youtube' || p === 'instagram'
    ? (p as IconName)
    : 'globe';
}

export function contentFor(p: Platform, yt?: YoutubeMeta): PlatformContent | null {
  if (p === 'youtube')   return youtubeContentFromMeta(yt);
  if (p === 'facebook')  return FACEBOOK_CONTENT;
  if (p === 'instagram') return INSTAGRAM_CONTENT;
  return null;
}

/** Build the drawer's YouTube content card from real DOM-scraped meta.
 *  When `meta` is undefined (YouTube hasn't hydrated yet, or we're on
 *  a non-watch page), we still return a card so the layout doesn't
 *  jump — fields fall back to '—' to make missing data visible rather
 *  than masked behind sample text. */
export function youtubeContentFromMeta(meta: YoutubeMeta | undefined): PlatformContent {
  // Use the sample as a base for fields we don't yet derive from real
  // data (verdict, score, signals — those come from the scan record).
  const base = YOUTUBE_CONTENT;
  if (!meta) {
    return {
      ...base,
      title: '—',
      author: '—',
      meta: '—',
      creator: {
        ...base.creator,
        displayName: '—',
        handle: '—',
        sub: '—',
        // Zero the historical stats so CreatorCard's `hasStats` gate
        // hides the rows. Otherwise the sample 47/29/71% leaks through
        // before YouTube meta has hydrated and the user sees fake
        // numbers in the channel card.
        scanned: 0,
        flagged: 0,
        avgAi: 0,
        lastChecked: '',
      },
    };
  }

  const metaParts = [meta.duration, meta.views, meta.age].filter(Boolean);

  return {
    ...base,
    title: meta.title,
    author: meta.channelHandle || meta.channelName,
    meta: metaParts.join(' · ') || '—',
    creator: {
      ...base.creator,
      displayName: meta.channelName || '—',
      handle: meta.channelHandle || '',
      verified: meta.channelVerified,
      sub: meta.channelSubs || '',
      // Stats below are not derivable from a single page view —
      // they'd require querying the user's historical scans by
      // channel. Until that lands, hide the rows by zeroing them
      // out; CreatorCard renders blanks for zeros below.
      scanned: 0,
      avgAi: 0,
      flagged: 0,
      lastChecked: '',
    },
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
