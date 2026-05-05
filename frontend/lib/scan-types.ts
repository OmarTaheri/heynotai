/**
 * Wire shape for a saved scan record. Mirrors the API's `serializeScan`
 * output (`api/src/routes/scans/shape.ts`) — keep in sync.
 */

import type { AiFlag, ScanResult } from "./detection-types";

export type ScanType = "txt" | "img" | "aud" | "vid" | "web" | "soc";
export type ScanOrigin =
  | "paste"
  | "link"
  | "upload"
  | "record"
  | "ext"
  | "url"
  | "mon";
export type ScanStatus = "queued" | "scanning" | "done" | "failed";
export type ScanVerdict = "human" | "ai" | "mixed" | "unknown";
export type ScanVisibility = "private" | "unlisted" | "public";

export interface ScanBreakdown {
  gen: number;
  match: number;
  plag: number;
}

/** Per-engine cached result. The api persists a `Record<engineSlug,
 *  EngineResultEntry>` on each scan row so the editor can flip between
 *  previously-tested engines without burning tokens on a redundant
 *  rescan. The top-level scan fields (`verdict`, `aiPct`, …) always
 *  reflect the *latest* run; this map preserves the others. */
export interface EngineResultEntry {
  aiPct: number;
  verdict: ScanVerdict;
  confidence: number;
  model: string;
  flags: AiFlag[];
  breakdown: ScanBreakdown | null;
  scanCompletedAt: string;
  scanDurationMs: number;
  /** Tokens charged for this engine's run. Lets the UI sum cost across
   *  every engine that's been tried on the row — the top-level
   *  `scan.creditsUsed` only reflects the latest run. */
  creditsUsed: number;
}

export interface Scan {
  id: string;
  created: string;
  updated: string;
  userId: string;
  archived: boolean;
  pinned: boolean;

  title: string;
  /** Per-user 1-based sequence assigned by the api at create time.
   *  Drives the editor's "#N no title" placeholder when `title` is
   *  empty. `0` on synthetic scans and on legacy rows whose number
   *  wasn't backfilled. */
  number: number;
  type: ScanType;
  subtype: string;
  origin: ScanOrigin;
  status: ScanStatus;

  content: string;
  file: string;
  fileUrl: string | null;
  sourceUrl: string;
  mimeType: string;
  sizeBytes: number;
  fileHash: string;
  durationMs: number;
  wordCount: number;
  language: string;
  thumbUrl: string;

  verdict: ScanVerdict;
  confidence: number;
  /** Unified AI-generated probability 0-100, computed by the api from
   *  verdict + confidence so every model speaks the same number. */
  aiPct: number;
  model: string;
  engineId: string;
  scanStartedAt: string;
  scanCompletedAt: string;
  scanDurationMs: number;
  breakdown: ScanBreakdown | null;
  flags: AiFlag[];
  /** Per-engine result history keyed by engine slug. Populated on
   *  successful detections only (failures don't write here). May be
   *  empty or missing on legacy rows that predate the field — use
   *  `synthesizeEngineResults` to derive a single entry from the
   *  top-level fields in that case. */
  engineResults: Record<string, EngineResultEntry>;
  analysis: Record<string, unknown> | null;
  analysisVersion: number;
  error: Record<string, unknown> | null;

  visibility: ScanVisibility;
  shareToken: string;

  tags: string[];
  notes: string;
  collectionRef: string;
  creditsUsed: number;

  parentScanId: string;
  version: number;
}

/** Display label used by the editor when a scan has no user-set title.
 *  Falls back to "#— no title" for synthetic / unsaved scans (number=0)
 *  so we never lie about being "#1". */
export function placeholderTitle(scan: Pick<Scan, "number">): string {
  return scan.number > 0 ? `#${scan.number} no title` : "#— no title";
}

export interface ScansListPage {
  items: Scan[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

/** Build a synthetic Scan record for the legacy showcase routes
 *  (`/editor`, `/editor/audio`, …) that don't have a saved row to load.
 *  `id` is empty so editor clients know to use the local mock for
 *  re-scans instead of hitting the API. */
export function syntheticScan(input: {
  type: ScanType;
  title?: string;
  content?: string;
  fileUrl?: string;
  durationMs?: number;
  origin?: ScanOrigin;
}): Scan {
  return {
    id: "",
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    userId: "",
    archived: false,
    pinned: false,
    title: input.title ?? "",
    number: 0,
    type: input.type,
    subtype: "",
    origin: input.origin ?? "paste",
    status: "done",
    content: input.content ?? "",
    file: "",
    fileUrl: input.fileUrl ?? null,
    sourceUrl: "",
    mimeType: "",
    sizeBytes: 0,
    fileHash: "",
    durationMs: input.durationMs ?? 0,
    wordCount: 0,
    language: "",
    thumbUrl: "",
    verdict: "unknown",
    confidence: 0,
    aiPct: 0,
    model: "",
    engineId: "",
    scanStartedAt: "",
    scanCompletedAt: "",
    scanDurationMs: 0,
    breakdown: null,
    flags: [],
    engineResults: {},
    analysis: null,
    analysisVersion: 1,
    error: null,
    visibility: "private",
    shareToken: "",
    tags: [],
    notes: "",
    collectionRef: "",
    creditsUsed: 0,
    parentScanId: "",
    version: 1,
  };
}

function clamp0to100(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Wrap a freshly-computed local mock `ScanResult` (from `scan-mock.ts`)
 *  into the `EngineResultEntry` shape the editor caches keyed by engine
 *  slug. Used by the synthetic editor flows that don't hit the api. */
export function scanResultToEngineEntry(
  result: ScanResult,
  scanDurationMs: number,
): EngineResultEntry {
  const aiPct = result.aiPct;
  const verdict: ScanVerdict =
    aiPct >= 70 ? "ai" : aiPct >= 40 ? "mixed" : "human";
  const b = result.breakdown;
  return {
    aiPct,
    verdict,
    confidence: aiPct,
    model: "local-mock",
    flags: result.flags,
    breakdown: b
      ? { gen: b.gen, match: b.match ?? 0, plag: b.plag ?? 0 }
      : null,
    scanCompletedAt: new Date().toISOString(),
    scanDurationMs,
    creditsUsed: 0,
  };
}

/** Project a single per-engine cache entry into the in-memory
 *  ScanResult the editor panel expects. Same shape as `scanToResult`
 *  but driven by an `EngineResultEntry` instead of the top-level scan
 *  fields, so the editor can render arbitrary engines from
 *  `scan.engineResults`. */
export function engineResultToScanResult(entry: EngineResultEntry): ScanResult | null {
  const verdict = entry.verdict;
  if (verdict === "ai" || verdict === "mixed" || verdict === "human") {
    const aiPct = clamp0to100(Number(entry.aiPct ?? 0));
    return {
      authenticity: 100 - aiPct,
      aiPct,
      flags: entry.flags ?? [],
    };
  }

  if (entry.breakdown) {
    const b = entry.breakdown;
    const authenticity = Math.max(
      0,
      Math.min(100, Math.round(100 - b.gen * 0.6 - b.match * 0.25 - b.plag * 0.4)),
    );
    return {
      authenticity,
      aiPct: clamp0to100(b.gen),
      breakdown: b,
      flags: entry.flags ?? [],
    };
  }
  return null;
}

/** Read `scan.engineResults` and, when it's empty/missing but the row
 *  has a usable top-level result, synthesize a single entry under
 *  `scan.engineId`. Keeps pre-migration scan rows working in the
 *  editor without a backfill pass. */
export function synthesizeEngineResults(
  scan: Scan,
): Record<string, EngineResultEntry> {
  const existing =
    scan.engineResults && typeof scan.engineResults === "object"
      ? scan.engineResults
      : {};
  if (Object.keys(existing).length > 0) return existing;
  if (scan.status !== "done") return {};
  const slug = scan.engineId;
  if (!slug) return {};
  if (
    scan.verdict !== "ai" &&
    scan.verdict !== "mixed" &&
    scan.verdict !== "human"
  ) {
    return {};
  }
  return {
    [slug]: {
      aiPct: clamp0to100(Number(scan.aiPct ?? 0)),
      verdict: scan.verdict,
      confidence: Number(scan.confidence ?? 0),
      model: scan.model ?? "",
      flags: scan.flags ?? [],
      breakdown: scan.breakdown,
      scanCompletedAt: scan.scanCompletedAt ?? "",
      scanDurationMs: Number(scan.scanDurationMs ?? 0),
      creditsUsed: Number(scan.creditsUsed ?? 0),
    },
  };
}

export type ScanError = {
  code?: string;
  message?: string;
  status?: number;
};

/** Pull the structured error blob the api writes onto failed scans. The
 *  shape isn't strict — some failures store `{ code, message, status }`,
 *  others just a free-form string. Normalize so the editor can render
 *  *something* useful. */
export function extractScanError(scan: Scan): ScanError {
  const raw = scan.error;
  if (!raw) return { message: "Detection failed (no details from provider)." };
  if (typeof raw === "string") return { message: raw };
  if (typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    return {
      code: typeof r.code === "string" ? r.code : undefined,
      message:
        typeof r.message === "string"
          ? r.message
          : typeof r.detail === "string"
            ? (r.detail as string)
            : "Detection failed.",
      status: typeof r.status === "number" ? r.status : undefined,
    };
  }
  return { message: "Detection failed." };
}
