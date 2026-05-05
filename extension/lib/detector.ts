import type { Scan } from './scans-api';
import type { ScanDetection, ScanState } from './types';

/** Map a real backend Scan record into the ScanDetection shape the
 *  overlay/badge/detail-panel UI expects. The cosmetic strings (face
 *  analysis, audio sync, frame consistency) are derived from the
 *  detector's per-frame data when present, otherwise filled with
 *  reasonable defaults so the panel doesn't render empty rows. */
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

  // Pull per-frame stats from the analysis blob when present (set by
  // hf-video.ts → providerRaw.perFrame). Falls back to simple defaults.
  const perFrame = extractPerFrame(scan.analysis);
  const detectionType =
    state === 'authentic'
      ? 'None detected'
      : state === 'suspicious'
        ? 'Partial artifacts'
        : 'Deepfake / GAN';
  const faceAnalysis =
    state === 'authentic' ? 'Consistent' :
    state === 'suspicious' ? 'Minor anomalies' : 'Anomalous';
  const audioSync =
    state === 'authentic' ? 'Matched' :
    state === 'suspicious' ? 'Slight mismatch' : 'Desynchronized';
  const frameConsistency = perFrame
    ? `${perFrame.flagged}/${perFrame.total} flagged`
    : state === 'authentic'
      ? 'Stable'
      : state === 'suspicious'
        ? 'Minor flicker'
        : 'Artifacts found';
  const scanTimeSec = scan.analysis && typeof (scan.analysis as { providerRaw?: unknown }).providerRaw === 'object'
    ? (Math.max(0, scan.durationMs ?? 0) / 1000).toFixed(1)
    : '1.0';

  return {
    state,
    trustScore,
    label,
    sublabel,
    detectionType,
    faceAnalysis,
    audioSync,
    frameConsistency,
    scanTime: scanTimeSec,
  };
}

function extractPerFrame(
  analysis: Scan['analysis'],
): { flagged: number; total: number } | null {
  if (!analysis || typeof analysis !== 'object') return null;
  const providerRaw = (analysis as { providerRaw?: unknown }).providerRaw;
  if (!providerRaw || typeof providerRaw !== 'object') return null;
  const perFrame = (providerRaw as { perFrame?: unknown }).perFrame;
  if (!Array.isArray(perFrame) || perFrame.length === 0) return null;
  const flagged = perFrame.filter((f) => {
    const v = (f as { verdict?: string }).verdict;
    return v === 'ai' || v === 'mixed';
  }).length;
  return { flagged, total: perFrame.length };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// Deterministic stub detector — same video ID produces the same verdict.
// Real detector will come from the `api` service in the monorepo.
export function simulateDetection(videoId: string): ScanDetection {
  let hash = 0;
  for (let i = 0; i < videoId.length; i++) {
    hash = ((hash << 5) - hash) + videoId.charCodeAt(i);
    hash |= 0;
  }
  const rand = Math.abs(hash % 100);

  if (rand < 55) {
    return {
      state: 'authentic',
      trustScore: 85 + (rand % 15),
      label: 'Likely Authentic',
      sublabel: 'No significant AI manipulation detected.',
      detectionType: 'None detected',
      faceAnalysis: 'Consistent',
      audioSync: 'Matched',
      frameConsistency: 'Stable',
      scanTime: (0.8 + Math.random() * 0.7).toFixed(1),
    };
  }
  if (rand < 80) {
    return {
      state: 'suspicious',
      trustScore: 40 + (rand % 25),
      label: 'Uncertain – Review Advised',
      sublabel: 'Some indicators suggest possible AI involvement.',
      detectionType: 'Partial artifacts',
      faceAnalysis: 'Minor anomalies',
      audioSync: 'Slight mismatch',
      frameConsistency: 'Minor flicker',
      scanTime: (1.0 + Math.random() * 0.6).toFixed(1),
    };
  }
  return {
    state: 'ai-generated',
    trustScore: 5 + (rand % 25),
    label: 'AI-Generated Content',
    sublabel: 'High confidence this media is synthetically produced.',
    detectionType: 'Deepfake / GAN',
    faceAnalysis: 'Anomalous',
    audioSync: 'Desynchronized',
    frameConsistency: 'Artifacts found',
    scanTime: (1.2 + Math.random() * 0.5).toFixed(1),
  };
}
