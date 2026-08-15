import { describe, expect, it } from 'vitest';
import { describeScanError } from './scan-error';

describe('describeScanError', () => {
  it('explains a too-long video and converts the seconds to minutes', () => {
    const { title, body } = describeScanError('youtube_too_long:4044');
    expect(title).toBe('Video is too long');
    expect(body).toContain('67 min');
  });

  it('handles the too-long code with no duration attached', () => {
    expect(describeScanError('youtube_too_long').body).toContain(
      'per-scan limit',
    );
  });

  it('explains the platforms that have no downloader yet', () => {
    const { title, body } = describeScanError('platform_not_supported');
    expect(title).toContain("isn't supported yet");
    expect(body).toContain('Instagram and Facebook');
    // Points at the path that does work on those pages.
    expect(body).toContain('right-click');
  });

  it('explains a page with nothing readable on it', () => {
    expect(describeScanError('no_readable_text').title).toBe(
      'Nothing to check on this page',
    );
  });

  it('covers every code the pipeline can emit', () => {
    const codes = [
      'youtube_download_failed',
      'detection_failed',
      'auth_required',
      'rate_limited',
      'tokens_exhausted',
      'cancelled',
      'content_script_missing',
      'container_not_found',
      'platform_not_supported',
      'no_readable_text',
    ];
    for (const code of codes) {
      const { title, body } = describeScanError(code);
      // A recognised code must never fall through to the raw-code branch.
      expect(title).not.toBe('Scan failed');
      expect(body).not.toBe(code);
      expect(body.length).toBeGreaterThan(20);
    }
  });

  it('surfaces an unrecognised code verbatim so it can be reported', () => {
    const { title, body } = describeScanError('some_new_backend_code');
    expect(title).toBe('Scan failed');
    expect(body).toBe('some_new_backend_code');
  });
});
