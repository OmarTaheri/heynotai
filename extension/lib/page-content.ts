import type { Scan } from './scans-api';
import type { Verdict } from './types';

/** The card the drawer's Home tab renders for the page you're on.
 *
 *  Every field is derived from something we actually observed: the host
 *  page's DOM (title / channel) or the backend scan record (verdict,
 *  detector, timings). This module replaces `sample-data.ts`, whose
 *  fixtures used to supply the signal rows — a scan of any YouTube video
 *  reported "Voice cloning · ElevenLabs-like · 84% conf" regardless of
 *  what the detector returned. */
export interface Signal {
  label: string;
  value: string;
  hint?: string;
  verdict?: Verdict;
}

export interface Creator {
  displayName: string;
  handle: string;
  verified?: boolean;
  /** "128K subs" / "42K followers" — blank when the page didn't expose it. */
  sub?: string;
}

export interface PageContent {
  title: string;
  /** @handle or channel name. */
  author: string;
  /** Duration, post type, timestamp — whatever the page exposed. */
  meta: string;
  /** One-line summary of the verdict, shown under the score. */
  tagline: string;
  signals: Signal[];
  creator: Creator | null;
  creatorCardTitle: string;
}

const PLACEHOLDER = '—';

export function verdictOf(pct: number): Verdict {
  return pct >= 70 ? 'ai' : pct >= 40 ? 'mixed' : 'human';
}

/** Signal rows for a finished scan. Anything the provider did not
 *  report is left out rather than filled in — an absent row is honest,
 *  a fabricated one is not. */
export function signalsFromScan(scan: Scan | null): Signal[] {
  if (!scan) {
    return [{ label: 'Status', value: 'Not checked yet' }];
  }
  if (scan.status === 'queued' || scan.status === 'scanning') {
    return [{ label: 'Status', value: 'Detector still running' }];
  }
  if (scan.status === 'failed') {
    return [{ label: 'Status', value: 'Scan failed', verdict: 'ai' }];
  }

  const aiPct = clampPct(scan.aiPct);
  const verdict = verdictOf(aiPct);
  const signals: Signal[] = [
    { label: 'AI likelihood', value: `${aiPct}%`, verdict },
    { label: 'Confidence', value: `${clampPct(scan.confidence)}%` },
    { label: 'Detector', value: detectorLabel(scan) },
  ];

  const frames = perFrameCounts(scan.analysis);
  if (frames) {
    signals.push({
      label: 'Frames analyzed',
      value: String(frames.total),
      hint: `${frames.flagged} flagged`,
    });
  }

  const scanMs = scanDurationMs(scan);
  if (scanMs > 0) {
    signals.push({ label: 'Scan time', value: `${(scanMs / 1000).toFixed(1)}s` });
  }

  return signals;
}

/** Short verdict sentence for the summary block. */
export function taglineFromScan(scan: Scan | null): string {
  if (!scan) return 'Run a check to see what the detector finds.';
  if (scan.status === 'queued' || scan.status === 'scanning') {
    return 'Waiting on the detector…';
  }
  if (scan.status === 'failed') return 'The detector could not finish this scan.';
  const model = detectorLabel(scan);
  switch (scan.verdict) {
    case 'ai':
      return `${model} rated this likely AI-generated.`;
    case 'human':
      return `${model} found no strong AI signal.`;
    case 'mixed':
      return `${model} was undecided — treat this as unverified.`;
    default:
      return `${model} returned no usable verdict.`;
  }
}

/** The engine that produced the verdict. Shown verbatim so the user can
 *  check which model actually ran instead of trusting a bare percentage. */
export function detectorLabel(scan: Scan): string {
  const model = (scan.model ?? '').trim();
  if (model) return model;
  const engine = (scan as { engineId?: string }).engineId ?? '';
  return engine.trim() || 'unknown detector';
}

function scanDurationMs(scan: Scan): number {
  const value = (scan as { scanDurationMs?: unknown }).scanDurationMs;
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function perFrameCounts(
  analysis: Scan['analysis'],
): { flagged: number; total: number } | null {
  if (!analysis || typeof analysis !== 'object') return null;
  const providerRaw = (analysis as { providerRaw?: unknown }).providerRaw;
  if (!providerRaw || typeof providerRaw !== 'object') return null;
  const perFrame = (providerRaw as { perFrame?: unknown }).perFrame;
  if (!Array.isArray(perFrame) || perFrame.length === 0) return null;
  const flagged = perFrame.filter((frame) => {
    const v = (frame as { verdict?: string }).verdict;
    return v === 'ai' || v === 'mixed';
  }).length;
  return { flagged, total: perFrame.length };
}

export function clampPct(value: number | undefined): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export { PLACEHOLDER };
