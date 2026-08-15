import { describe, expect, it } from 'vitest';
import type { PageInfo } from './page-classify';
import { shouldAutoScan, type ScanPrefs } from './scan-gate';

const YT_VIDEO: PageInfo = {
  platform: 'youtube',
  surface: 'videos',
  mediaId: 'abc',
};
const YT_SHORT: PageInfo = {
  platform: 'youtube',
  surface: 'reels',
  mediaId: 'abc',
};
const ARTICLE: PageInfo = {
  platform: 'other',
  surface: null,
  mediaId: 'https://news.example/a',
};

function prefs(overrides: Partial<ScanPrefs> = {}): ScanPrefs {
  return {
    scanMode: 'allowlist',
    platforms: {
      youtube: { enabled: true, surfaces: { videos: true, reels: true } },
      instagram: { enabled: true, surfaces: { posts: true, reels: true } },
      facebook: { enabled: true, surfaces: { posts: true, reels: true } },
    },
    sites: [],
    ...overrides,
  };
}

describe('shouldAutoScan — safety defaults', () => {
  it('refuses to scan before prefs have loaded', () => {
    expect(shouldAutoScan(YT_VIDEO, null, 'youtube.com')).toEqual({
      allow: false,
      reason: 'prefs_not_loaded',
    });
  });

  it('never auto-scans in manual mode, on any surface', () => {
    const p = prefs({ scanMode: 'manual' });
    expect(shouldAutoScan(YT_VIDEO, p, 'youtube.com').allow).toBe(false);
    expect(shouldAutoScan(YT_SHORT, p, 'youtube.com').allow).toBe(false);
    expect(shouldAutoScan(ARTICLE, p, 'news.example').reason).toBe(
      'scan_mode_manual',
    );
  });
});

describe('shouldAutoScan — platform gating', () => {
  it('scans an enabled platform + enabled surface in allowlist mode', () => {
    expect(shouldAutoScan(YT_VIDEO, prefs(), 'youtube.com')).toEqual({
      allow: true,
      reason: 'allowlist_match',
    });
  });

  it('blocks when the platform master toggle is off', () => {
    const p = prefs({
      platforms: {
        youtube: { enabled: false, surfaces: { videos: true, reels: true } },
      },
    });
    expect(shouldAutoScan(YT_VIDEO, p, 'youtube.com')).toEqual({
      allow: false,
      reason: 'platform_disabled',
    });
  });

  it('blocks when only the specific surface is off', () => {
    const p = prefs({
      platforms: {
        youtube: { enabled: true, surfaces: { videos: false, reels: true } },
      },
    });
    expect(shouldAutoScan(YT_VIDEO, p, 'youtube.com').reason).toBe(
      'surface_disabled',
    );
    // …while the sibling surface still scans.
    expect(shouldAutoScan(YT_SHORT, p, 'youtube.com').allow).toBe(true);
  });

  it('blocks a platform missing from prefs entirely', () => {
    const p = prefs({ platforms: {} });
    expect(shouldAutoScan(YT_VIDEO, p, 'youtube.com')).toEqual({
      allow: false,
      reason: 'platform_unknown',
    });
  });

  it('lets a platform pause win over everything-mode', () => {
    // The per-platform toggle would be cosmetic otherwise.
    const p = prefs({
      scanMode: 'everything',
      platforms: {
        youtube: { enabled: false, surfaces: { videos: true, reels: true } },
      },
    });
    expect(shouldAutoScan(YT_VIDEO, p, 'youtube.com').reason).toBe(
      'platform_disabled',
    );
  });

  it('ignores the surface toggle in everything-mode when the platform is on', () => {
    const p = prefs({
      scanMode: 'everything',
      platforms: {
        youtube: { enabled: true, surfaces: { videos: false, reels: false } },
      },
    });
    expect(shouldAutoScan(YT_VIDEO, p, 'youtube.com')).toEqual({
      allow: true,
      reason: 'mode_everything',
    });
  });
});

describe('shouldAutoScan — ordinary websites', () => {
  it('scans an allow-listed site', () => {
    const p = prefs({ sites: [{ host: 'news.example', enabled: true }] });
    expect(shouldAutoScan(ARTICLE, p, 'news.example')).toEqual({
      allow: true,
      reason: 'site_allowlist_match',
    });
  });

  it('distinguishes a paused rule from no rule at all', () => {
    const paused = prefs({ sites: [{ host: 'news.example', enabled: false }] });
    expect(shouldAutoScan(ARTICLE, paused, 'news.example').reason).toBe(
      'site_disabled',
    );
    expect(shouldAutoScan(ARTICLE, prefs(), 'news.example').reason).toBe(
      'site_not_allowlisted',
    );
  });

  it('matches an allow-list rule against subdomains', () => {
    const p = prefs({ sites: [{ host: 'example.com', enabled: true }] });
    expect(shouldAutoScan(ARTICLE, p, 'blog.example.com').allow).toBe(true);
  });

  it('scans any readable page in everything-mode', () => {
    const p = prefs({ scanMode: 'everything' });
    expect(shouldAutoScan(ARTICLE, p, 'anything.example')).toEqual({
      allow: true,
      reason: 'mode_everything',
    });
  });

  it('skips allow-list entries with a blank host', () => {
    const p = prefs({ sites: [{ host: '', enabled: true }] });
    expect(shouldAutoScan(ARTICLE, p, 'news.example').allow).toBe(false);
  });
});
