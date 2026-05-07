import type { RecordModel } from "pocketbase";
import { env } from "../../env.js";

/** Per-engine cached result. The scans collection stores a map keyed by
 *  the engine slug (`engineId`) so that switching the model picker in
 *  the editor surfaces a previously-tested engine's verdict instantly,
 *  without burning tokens on a redundant rescan. The top-level fields
 *  (`verdict`, `aiPct`, `engineId`, …) always reflect the *latest* run;
 *  this map preserves the others. */
export interface EngineResultEntry {
  aiPct: number;
  verdict: string;
  confidence: number;
  model: string;
  flags: unknown[];
  breakdown: { gen: number; match: number; plag: number } | null;
  scanCompletedAt: string;
  scanDurationMs: number;
  /** Tokens charged for *this* engine's run. Preserved per-engine so a
   *  scan that swept 3 models keeps the cost of all 3, even though the
   *  top-level `creditsUsed` only reflects the most recent run. */
  creditsUsed: number;
}

/** Wire shape returned to the frontend. Mirrors the PB record but
 *  materializes `fileUrl` so the client doesn't need to know how to
 *  build PB file URLs.
 *
 *  We construct the URL manually against `POCKETBASE_PUBLIC_URL`
 *  instead of `pb.files.getURL` so deployed environments can keep an
 *  internal `POCKETBASE_URL` (used by the api server to talk to PB)
 *  separate from the publicly reachable host the browser needs to
 *  load `<img>` tags. Falls back to `POCKETBASE_URL` for dev where
 *  both are the same. */
export interface SerializedScan {
  id: string;
  created: string;
  updated: string;
  userId: string;
  archived: boolean;
  pinned: boolean;

  title: string;
  /** Per-user 1-based sequence assigned at create time. Display-only —
   *  the editor uses it for the "#N no title" placeholder when `title`
   *  is empty. May be 0 on rows that predate the field or whose
   *  create-time max-lookup failed. */
  number: number;
  type: string;
  subtype: string;
  origin: string;
  status: string;

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

  verdict: string;
  confidence: number;
  /** Unified 0..100 "AI-generated" probability across all detector
   *  shapes. Computed from verdict+confidence in run-detection.ts so
   *  every model speaks the same number to the client. */
  aiPct: number;
  model: string;
  engineId: string;
  scanStartedAt: string;
  scanCompletedAt: string;
  scanDurationMs: number;
  breakdown: { gen: number; match: number; plag: number } | null;
  flags: unknown[];
  /** Per-engine result history. Keyed by engine slug. Empty `{}` for
   *  scans that haven't completed any detection yet. Old rows that
   *  predate this field also serialize as `{}` — the frontend
   *  synthesizes a single entry from the top-level fields in that case. */
  engineResults: Record<string, EngineResultEntry>;
  analysis: Record<string, unknown> | null;
  analysisVersion: number;
  error: Record<string, unknown> | null;

  visibility: string;
  shareToken: string;

  tags: string[];
  notes: string;
  collectionRef: string;
  creditsUsed: number;

  parentScanId: string;
  version: number;
}

function publicFileUrl(record: RecordModel, filename: string): string {
  const base = env.POCKETBASE_PUBLIC_URL ?? env.POCKETBASE_URL;
  return `${base.replace(/\/$/, "")}/api/files/${record.collectionId}/${record.id}/${encodeURIComponent(filename)}`;
}

export function serializeScan(record: RecordModel): SerializedScan {
  const file: string = record.file ?? "";
  return {
    id: record.id,
    created: record.created,
    updated: record.updated,
    userId: record.userId ?? "",
    archived: !!record.archived,
    pinned: !!record.pinned,

    title: record.title ?? "",
    number: Number(record.number ?? 0),
    type: record.type ?? "",
    subtype: record.subtype ?? "",
    origin: record.origin ?? "",
    status: record.status ?? "",

    content: record.content ?? "",
    file,
    fileUrl: file ? publicFileUrl(record, file) : null,
    sourceUrl: record.sourceUrl ?? "",
    mimeType: record.mimeType ?? "",
    sizeBytes: Number(record.sizeBytes ?? 0),
    fileHash: record.fileHash ?? "",
    durationMs: Number(record.durationMs ?? 0),
    wordCount: Number(record.wordCount ?? 0),
    language: record.language ?? "",
    thumbUrl: record.thumbUrl ?? "",

    verdict: record.verdict ?? "unknown",
    confidence: Number(record.confidence ?? 0),
    aiPct: Number(record.aiPct ?? 0),
    model: record.model ?? "",
    engineId: record.engineId ?? "",
    scanStartedAt: record.scanStartedAt ?? "",
    scanCompletedAt: record.scanCompletedAt ?? "",
    scanDurationMs: Number(record.scanDurationMs ?? 0),
    breakdown: (record.breakdown ?? null) as SerializedScan["breakdown"],
    flags: Array.isArray(record.flags) ? record.flags : [],
    engineResults:
      record.engineResults && typeof record.engineResults === "object"
        ? (record.engineResults as Record<string, EngineResultEntry>)
        : {},
    analysis: (record.analysis ?? null) as SerializedScan["analysis"],
    analysisVersion: Number(record.analysisVersion ?? 1),
    error: (record.error ?? null) as SerializedScan["error"],

    visibility: record.visibility ?? "private",
    shareToken: record.shareToken ?? "",

    tags: Array.isArray(record.tags) ? record.tags : [],
    notes: record.notes ?? "",
    collectionRef: record.collectionRef ?? "",
    creditsUsed: Number(record.creditsUsed ?? 0),

    parentScanId: record.parentScanId ?? "",
    version: Number(record.version ?? 1),
  };
}
