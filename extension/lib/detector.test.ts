import { describe, expect, it } from 'vitest';
import { detectionFromScan } from './detector';
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
    sizeBytes: 0,
    durationMs: 724_000,
    wordCount: 0,
    verdict: 'ai',
    confidence: 92,
    aiPct: 92,
    model: 'Wvolf/ViT_Deepfake_Detection',
    engineId: 'vit-deepfake',
    scanDurationMs: 3200,
    analysis: null,
    flags: [],
    file: '',
    content: '',
    ...overrides,
  } as Scan;
}

describe('detectionFromScan — verdict mapping', () => {
  it('maps an AI verdict to the alarming overlay state', () => {
    const d = detectionFromScan(scan({ verdict: 'ai', aiPct: 92 }));
    expect(d.state).toBe('ai-generated');
    expect(d.trustScore).toBe(8);
    expect(d.label).toBe('AI-Generated Content');
  });

  it('maps a human verdict to the authentic state', () => {
    const d = detectionFromScan(scan({ verdict: 'human', aiPct: 3 }));
    expect(d.state).toBe('authentic');
    expect(d.trustScore).toBe(97);
  });

  it('maps a mixed verdict to the cautionary state', () => {
    const d = detectionFromScan(scan({ verdict: 'mixed', aiPct: 55 }));
    expect(d.state).toBe('suspicious');
    expect(d.label).toContain('Uncertain');
  });

  it('falls back to suspicious for an unrecognised verdict', () => {
    const d = detectionFromScan(scan({ verdict: 'unknown' as Scan['verdict'] }));
    expect(d.state).toBe('suspicious');
    expect(d.sublabel).toContain('unavailable');
  });

  it('clamps an out-of-range score instead of trusting it', () => {
    expect(detectionFromScan(scan({ aiPct: 140 })).trustScore).toBe(0);
    expect(detectionFromScan(scan({ aiPct: -10 })).trustScore).toBe(100);
  });
});

describe('detectionFromScan — honest detail rows', () => {
  it('names the model that produced the verdict', () => {
    expect(detectionFromScan(scan()).detectionType).toBe(
      'Wvolf/ViT_Deepfake_Detection',
    );
  });

  it('falls back to the engine slug, then to a plain admission', () => {
    expect(detectionFromScan(scan({ model: '' })).detectionType).toBe(
      'vit-deepfake',
    );
    expect(
      detectionFromScan(scan({ model: '', engineId: '' })).detectionType,
    ).toBe('Unknown detector');
  });

  it('reports the detector runtime, not the length of the video', () => {
    // Regression: this used to read `durationMs`, so a 12-minute video
    // claimed a 724-second scan.
    expect(detectionFromScan(scan()).scanTime).toBe('3.2s');
  });

  it('says "Not provided" rather than 0.0s when no runtime was reported', () => {
    expect(detectionFromScan(scan({ scanDurationMs: 0 })).scanTime).toBe(
      'Not provided',
    );
  });

  it('does not claim face or audio analysis that never ran', () => {
    const d = detectionFromScan(scan());
    expect(d.faceAnalysis).toBe('Not analyzed');
    expect(d.audioSync).toBe('Not analyzed');
  });

  it('reports frame consistency only from real per-frame data', () => {
    expect(detectionFromScan(scan()).frameConsistency).toBe('Not provided');
    const withFrames = detectionFromScan(
      scan({
        analysis: {
          providerRaw: {
            perFrame: [{ verdict: 'ai' }, { verdict: 'human' }],
          },
        },
      }),
    );
    expect(withFrames.frameConsistency).toBe('1/2 flagged');
  });
});
