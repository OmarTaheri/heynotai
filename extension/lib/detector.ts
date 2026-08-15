import type { Scan } from './scans-api';
import type { ScanDetection, ScanState } from './types';

/** Map a real backend scan into the overlay shape. Values the provider did
 * not actually measure are explicitly marked unavailable. */
export function detectionFromScan(scan: Scan): ScanDetection {
  const aiPct = clamp(Math.round(scan.aiPct ?? 0), 0, 100);
  const trustScore = 100 - aiPct;

  let state: ScanState;
  let label: string;
  let sublabel: string;
  if (scan.verdict === 'human') {
    state = 'authentic';
    label = 'Likely Authentic';
    sublabel = 'No significant AI manipulation detected.';
  } else if (scan.verdict === 'mixed') {
    state = 'suspicious';
    label = 'Uncertain – Review Advised';
    sublabel = 'Some indicators suggest possible AI involvement.';
  } else if (scan.verdict === 'ai') {
    state = 'ai-generated';
    label = 'AI-Generated Content';
    sublabel = 'High confidence this media is synthetically produced.';
  } else {
    state = 'suspicious';
    label = 'Uncertain';
    sublabel = 'Detection result unavailable.';
  }

  const perFrame = extractPerFrame(scan.analysis);
  // `scanDurationMs` is how long the detector took. The previous code
  // read `durationMs`, which is the *media* length — a 12-minute video
  // reported a 724-second scan time.
  const scanMs = Number(scan.scanDurationMs ?? 0);
  const scanTimeSec =
    Number.isFinite(scanMs) && scanMs > 0
      ? `${(scanMs / 1000).toFixed(1)}s`
      : 'Not provided';

  return {
    state,
    trustScore,
    label,
    sublabel,
    // Name the engine that produced this verdict. "Model classification"
    // told the user nothing about whether a model had actually run.
    detectionType: detectorName(scan),
    faceAnalysis: 'Not analyzed',
    audioSync: 'Not analyzed',
    frameConsistency: perFrame
      ? `${perFrame.flagged}/${perFrame.total} flagged`
      : 'Not provided',
    scanTime: scanTimeSec,
  };
}

function detectorName(scan: Scan): string {
  const model = (scan.model ?? '').trim();
  if (model) return model;
  const engine = (scan.engineId ?? '').trim();
  return engine || 'Unknown detector';
}

function extractPerFrame(
  analysis: Scan['analysis'],
): { flagged: number; total: number } | null {
  if (!analysis || typeof analysis !== 'object') return null;
  const providerRaw = (analysis as { providerRaw?: unknown }).providerRaw;
  if (!providerRaw || typeof providerRaw !== 'object') return null;
  const perFrame = (providerRaw as { perFrame?: unknown }).perFrame;
  if (!Array.isArray(perFrame) || perFrame.length === 0) return null;
  const flagged = perFrame.filter((frame) => {
    const verdict = (frame as { verdict?: string }).verdict;
    return verdict === 'ai' || verdict === 'mixed';
  }).length;
  return { flagged, total: perFrame.length };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
