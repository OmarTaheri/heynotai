import { describe, expect, it } from 'vitest';
import {
  clampPct,
  detectorLabel,
  signalsFromScan,
  taglineFromScan,
  verdictOf,
} from './page-content';
import type { Scan } from './scans-api';

function scan(overrides: Partial<Scan> = {}): Scan {
  return {
    id: 'scan1',
    created: '2026-08-15T00:00:00.000Z',
    title: 'A video',
    type: 'vid',
    subtype: 'yt-vid',
    origin: 'ext',
    status: 'done',
    sourceUrl: 'https://www.youtube.com/watch?v=abc',
    mimeType: 'video/mp4',
    sizeBytes: 1024,
    durationMs: 724_000,
    wordCount: 0,
    verdict: 'ai',
    confidence: 92,
    aiPct: 92,
    model: 'fakespot-ai/roberta-base-ai-text-detection-v1',
    engineId: 'fakespot-roberta',
    scanDurationMs: 4465,
    analysis: null,
    flags: [],
    file: '',
    content: '',
    ...overrides,
  } as Scan;
}

describe('signalsFromScan — lifecycle states', () => {
  it('says nothing has been checked when there is no scan', () => {
    expect(signalsFromScan(null)).toEqual([
      { label: 'Status', value: 'Not checked yet' },
    ]);
  });

  it('reports an in-flight scan for queued and scanning rows', () => {
    for (const status of ['queued', 'scanning'] as const) {
      expect(signalsFromScan(scan({ status }))).toEqual([
        { label: 'Status', value: 'Detector still running' },
      ]);
    }
  });

  it('reports a failure without inventing a score', () => {
    const signals = signalsFromScan(scan({ status: 'failed' }));
    expect(signals).toEqual([
      { label: 'Status', value: 'Scan failed', verdict: 'ai' },
    ]);
    expect(signals.some((s) => s.label === 'AI likelihood')).toBe(false);
  });
});

describe('signalsFromScan — completed scans', () => {
  it('reports the real score, confidence, and detector', () => {
    const signals = signalsFromScan(scan());
    expect(signals).toContainEqual({
      label: 'AI likelihood',
      value: '92%',
      verdict: 'ai',
    });
    expect(signals).toContainEqual({ label: 'Confidence', value: '92%' });
    expect(signals).toContainEqual({
      label: 'Detector',
      value: 'fakespot-ai/roberta-base-ai-text-detection-v1',
    });
  });

  it('uses the detector runtime, not the media length, for scan time', () => {
    // durationMs is 724s of video; scanDurationMs is the 4.5s HTTP call.
    const signals = signalsFromScan(scan());
    expect(signals).toContainEqual({ label: 'Scan time', value: '4.5s' });
  });

  it('omits scan time when the provider did not report one', () => {
    const signals = signalsFromScan(scan({ scanDurationMs: 0 }));
    expect(signals.some((s) => s.label === 'Scan time')).toBe(false);
  });

  it('surfaces per-frame counts only when the provider returned them', () => {
    const withFrames = signalsFromScan(
      scan({
        analysis: {
          providerRaw: {
            perFrame: [
              { verdict: 'ai' },
              { verdict: 'human' },
              { verdict: 'mixed' },
            ],
          },
        },
      }),
    );
    expect(withFrames).toContainEqual({
      label: 'Frames analyzed',
      value: '3',
      hint: '2 flagged',
    });

    expect(
      signalsFromScan(scan()).some((s) => s.label === 'Frames analyzed'),
    ).toBe(false);
    expect(
      signalsFromScan(scan({ analysis: { providerRaw: {} } })).some(
        (s) => s.label === 'Frames analyzed',
      ),
    ).toBe(false);
  });

  it('never emits a signal the scan record cannot back', () => {
    // Regression guard for the fixture era, when every YouTube scan
    // reported "Voice cloning · ElevenLabs-like · 84% conf".
    const labels = signalsFromScan(scan()).map((s) => s.label);
    expect(labels).not.toContain('Voice cloning');
    expect(labels).not.toContain('Face analysis');
    expect(labels).not.toContain('Lip-sync drift');
  });
});

describe('detectorLabel', () => {
  it('prefers the provider-reported model id', () => {
    expect(detectorLabel(scan())).toBe(
      'fakespot-ai/roberta-base-ai-text-detection-v1',
    );
  });

  it('falls back to the engine slug before the verdict lands', () => {
    expect(detectorLabel(scan({ model: '' }))).toBe('fakespot-roberta');
  });

  it('says so plainly when neither is known', () => {
    expect(detectorLabel(scan({ model: '', engineId: '' }))).toBe(
      'unknown detector',
    );
  });
});

describe('taglineFromScan', () => {
  it('names the detector in the verdict sentence', () => {
    expect(taglineFromScan(scan())).toContain('fakespot-ai/');
    expect(taglineFromScan(scan())).toContain('likely AI-generated');
  });

  it('has a distinct line per verdict', () => {
    expect(taglineFromScan(scan({ verdict: 'human' }))).toContain(
      'no strong AI signal',
    );
    expect(taglineFromScan(scan({ verdict: 'mixed' }))).toContain('undecided');
  });

  it('does not claim a verdict while the scan is still running', () => {
    expect(taglineFromScan(scan({ status: 'scanning' }))).toBe(
      'Waiting on the detector…',
    );
    expect(taglineFromScan(null)).toContain('Run a check');
  });
});

describe('verdictOf + clampPct', () => {
  it('uses the same thresholds as the backend (40 / 70)', () => {
    expect(verdictOf(0)).toBe('human');
    expect(verdictOf(39)).toBe('human');
    expect(verdictOf(40)).toBe('mixed');
    expect(verdictOf(69)).toBe('mixed');
    expect(verdictOf(70)).toBe('ai');
    expect(verdictOf(100)).toBe('ai');
  });

  it('clamps and rounds percentages into 0–100', () => {
    expect(clampPct(99.99)).toBe(100);
    expect(clampPct(-5)).toBe(0);
    expect(clampPct(140)).toBe(100);
    expect(clampPct(undefined)).toBe(0);
    expect(clampPct(Number.NaN)).toBe(0);
  });
});
