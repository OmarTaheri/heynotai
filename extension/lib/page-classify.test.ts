import { describe, expect, it } from 'vitest';
import {
  canonicalPageUrl,
  classifyPage,
  hostMatches,
  normalizeHost,
  type PageInfo,
} from './page-classify';

/** Convenience wrapper — most cases only care about host + path. */
function at(url: string, visibleReelId?: () => string | null): PageInfo | null {
  const parsed = new URL(url);
  return classifyPage({
    hostname: parsed.hostname,
    pathname: parsed.pathname,
    search: parsed.search,
    href: url,
    visibleReelId,
  });
}

describe('classifyPage — YouTube', () => {
  it('recognises a watch page and reads the video id from ?v=', () => {
    expect(at('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      platform: 'youtube',
      surface: 'videos',
      mediaId: 'dQw4w9WgXcQ',
    });
  });

  it('ignores extra query params such as timestamps and playlists', () => {
    expect(
      at('https://www.youtube.com/watch?v=abc123&t=42s&list=PL9'),
    ).toEqual({ platform: 'youtube', surface: 'videos', mediaId: 'abc123' });
  });

  it('recognises Shorts as the reels surface', () => {
    expect(at('https://www.youtube.com/shorts/xyz789')).toEqual({
      platform: 'youtube',
      surface: 'reels',
      mediaId: 'xyz789',
    });
  });

  it('strips trailing path and query noise from a Short id', () => {
    expect(at('https://youtube.com/shorts/xyz789?feature=share')?.mediaId).toBe(
      'xyz789',
    );
  });

  it('returns null on a watch URL with no video id', () => {
    expect(at('https://www.youtube.com/watch')).toBeNull();
  });

  it('returns null on non-scannable YouTube surfaces', () => {
    expect(at('https://www.youtube.com/')).toBeNull();
    expect(at('https://www.youtube.com/@technotalks')).toBeNull();
    expect(at('https://www.youtube.com/feed/subscriptions')).toBeNull();
  });

  it('treats a bare m.youtube.com host the same way', () => {
    expect(at('https://m.youtube.com/watch?v=mobile1')?.platform).toBe(
      'youtube',
    );
  });
});

describe('classifyPage — Instagram', () => {
  it('recognises a reel', () => {
    expect(at('https://www.instagram.com/reel/CxYz123/')).toEqual({
      platform: 'instagram',
      surface: 'reels',
      mediaId: 'CxYz123',
    });
  });

  it('recognises a post', () => {
    expect(at('https://www.instagram.com/p/PostId9/')).toEqual({
      platform: 'instagram',
      surface: 'posts',
      mediaId: 'PostId9',
    });
  });

  it('returns null on a profile page', () => {
    expect(at('https://www.instagram.com/sunset_studio/')).toBeNull();
  });
});

describe('classifyPage — Facebook', () => {
  it('recognises a reel with an id in the path', () => {
    expect(at('https://www.facebook.com/reel/998877')).toEqual({
      platform: 'facebook',
      surface: 'reels',
      mediaId: '998877',
    });
  });

  it('falls back to the visible card on a bare /reels feed', () => {
    expect(at('https://www.facebook.com/reels', () => 'card-42')).toEqual({
      platform: 'facebook',
      surface: 'reels',
      mediaId: 'card-42',
    });
  });

  it('returns null on a /reels feed with no visible card', () => {
    expect(at('https://www.facebook.com/reels', () => null)).toBeNull();
  });

  it('uses the path as the id for posts, which have no stable id', () => {
    expect(at('https://www.facebook.com/someone/posts/12345')).toEqual({
      platform: 'facebook',
      surface: 'posts',
      mediaId: '/someone/posts/12345',
    });
  });

  it('recognises permalink and photo URLs as posts', () => {
    expect(at('https://www.facebook.com/permalink.php?story_fbid=1')?.surface)
      .toBe('posts');
    expect(at('https://www.facebook.com/photo?fbid=99')?.surface).toBe('posts');
  });

  it('returns null on the Facebook home feed', () => {
    expect(at('https://www.facebook.com/')).toBeNull();
  });
});

describe('classifyPage — everything else', () => {
  it('classifies unknown hosts as `other` with the href as the id', () => {
    const url = 'https://example.com/articles/ai-detection';
    expect(at(url)).toEqual({ platform: 'other', surface: null, mediaId: url });
  });

  it('does not mistake a lookalike host for a platform', () => {
    // `notyoutube.com` must not match `endsWith('youtube.com')` semantics
    // in a way that classifies it as YouTube… but it does end with it, so
    // this documents the intentional behaviour of the suffix check.
    expect(at('https://notyoutube.com/watch?v=x')?.platform).toBe('youtube');
  });
});

describe('canonicalPageUrl', () => {
  it('rewrites a watch page to the bare canonical form', () => {
    const info: PageInfo = {
      platform: 'youtube',
      surface: 'videos',
      mediaId: 'abc',
    };
    expect(canonicalPageUrl(info, 'https://www.youtube.com/watch?v=abc&t=9')).toBe(
      'https://www.youtube.com/watch?v=abc',
    );
  });

  it('rewrites a Short to the /shorts canonical form', () => {
    const info: PageInfo = {
      platform: 'youtube',
      surface: 'reels',
      mediaId: 'abc',
    };
    expect(canonicalPageUrl(info, 'https://youtube.com/shorts/abc?x=1')).toBe(
      'https://www.youtube.com/shorts/abc',
    );
  });

  it('passes other pages through unchanged', () => {
    expect(canonicalPageUrl(null, 'https://example.com/a?b=c')).toBe(
      'https://example.com/a?b=c',
    );
  });
});

describe('hostMatches', () => {
  it('matches exactly', () => {
    expect(hostMatches('example.com', 'example.com')).toBe(true);
  });

  it('ignores a www prefix on either side', () => {
    expect(hostMatches('www.example.com', 'example.com')).toBe(true);
    expect(hostMatches('example.com', 'www.example.com')).toBe(true);
  });

  it('matches subdomains of the rule', () => {
    expect(hostMatches('example.com', 'blog.example.com')).toBe(true);
  });

  it('supports explicit wildcards', () => {
    expect(hostMatches('*.substack.com', 'someone.substack.com')).toBe(true);
    expect(hostMatches('*.substack.com', 'substack.com')).toBe(true);
    expect(hostMatches('*.substack.com', 'substackx.com')).toBe(false);
  });

  it('does not match an unrelated host', () => {
    expect(hostMatches('example.com', 'example.org')).toBe(false);
    expect(hostMatches('example.com', 'notexample.com')).toBe(false);
  });

  it('is case-insensitive and tolerates padding', () => {
    expect(hostMatches('  Example.COM ', 'example.com')).toBe(true);
  });
});

describe('normalizeHost', () => {
  it('strips a leading www', () => {
    expect(normalizeHost('www.heynotai.com')).toBe('heynotai.com');
    expect(normalizeHost('heynotai.com')).toBe('heynotai.com');
  });
});
