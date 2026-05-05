"use client";

import { ClientResponseError, type RecordModel } from "pocketbase";
import { pb } from "./pocketbase";
import { recordActivity } from "./collection-activities";
import type { CollectionItem } from "./collections-data";
import { detectorDisplayName } from "./detector-display";
import { formatRelative, scanToLibraryItem } from "./library-data";
import type { EngineResultEntry, Scan } from "./scan-types";

/** Wire shape for `collection_items` rows. The `expand.scanId` is the
 *  full scan record so the detail page can render confidence bars and
 *  metadata without a second roundtrip. */
export type CollectionItemRecord = RecordModel & {
  collection: string;
  scanId: string;
  addedBy: string;
  expand?: {
    scanId?: RecordModel & Partial<Scan>;
    collection?: RecordModel & { slug?: string; title?: string };
  };
};

/** Lightweight pointer the editor breadcrumb needs to render the
 *  linked collection (and route to its detail page on click). */
export type ScanCollectionRef = {
  id: string;
  slug: string;
  title: string;
};

/** Items for the table on a single collection detail page. Owner sees
 *  everything; accepted members see everything (PB rule does the work
 *  — this just expands the relation). */
export async function listCollectionItems(
  collectionId: string,
): Promise<CollectionItemRecord[]> {
  return pb.collection("collection_items").getFullList<CollectionItemRecord>({
    filter: pb.filter("collection = {:cid}", { cid: collectionId }),
    sort: "-created",
    expand: "scanId",
  });
}

/** Add a batch of scans to a collection. Skips scans that are already
 *  in the collection (PB unique index will reject those anyway). */
export async function addScansToCollection(opts: {
  collectionId: string;
  addedBy: string;
  scanIds: string[];
}): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;
  // PB's JS SDK auto-cancels concurrent requests that share a request
  // key. `Promise.all` over `create` would assign the same key to every
  // call and only the last one would land — pass `requestKey: null` to
  // opt each call out of the dedup pool so they all complete.
  const addedScanIds: string[] = [];
  await Promise.all(
    opts.scanIds.map(async (scanId) => {
      try {
        await pb.collection("collection_items").create(
          {
            collection: opts.collectionId,
            scanId,
            addedBy: opts.addedBy,
          },
          { requestKey: null },
        );
        added += 1;
        addedScanIds.push(scanId);
      } catch (err) {
        if (isDuplicate(err)) {
          skipped += 1;
          return;
        }
        throw err;
      }
    }),
  );
  if (added > 0) {
    void recordActivity({
      collectionId: opts.collectionId,
      actorId: opts.addedBy,
      type: "item.added",
      payload: { count: added, scanIds: addedScanIds },
    });
  }
  return { added, skipped };
}

/** Remove an item from a collection. Caller passes the collection +
 *  actor + (optional) scan title so an `item.removed` activity row can
 *  be appended after a successful delete. */
export async function removeItem(
  itemId: string,
  ctx: { collectionId: string; actorId: string; scanTitle?: string },
): Promise<void> {
  await pb.collection("collection_items").delete(itemId);
  void recordActivity({
    collectionId: ctx.collectionId,
    actorId: ctx.actorId,
    type: "item.removed",
    payload: ctx.scanTitle ? { scanTitle: ctx.scanTitle } : {},
  });
}

/** Resolve the collection a scan currently belongs to. The editor uses
 *  a single-link UX, so it only needs the first row — multi-link can
 *  exist in the data but isn't surfaced from the breadcrumb. PB rules
 *  scope the read to records the caller is allowed to see, so a 404
 *  here genuinely means "not linked (to anything you can see)". */
export async function getScanCollection(
  scanId: string,
): Promise<ScanCollectionRef | null> {
  try {
    const row = await pb
      .collection("collection_items")
      .getFirstListItem<CollectionItemRecord>(
        pb.filter("scanId = {:sid}", { sid: scanId }),
        { expand: "collection", requestKey: null },
      );
    const c = row.expand?.collection;
    if (!c) return null;
    return { id: c.id, slug: c.slug ?? "", title: c.title ?? "" };
  } catch (err) {
    if (err instanceof ClientResponseError && err.status === 404) return null;
    throw err;
  }
}

/** Batch variant of `getScanCollection` for tables (Recent activity,
 *  Library). One PocketBase round trip with `scanId IN (...)` expressed
 *  as an OR'd filter, then bucketed into a Map<scanId, ref>. If a scan
 *  has multiple links, the most recently created one wins (matches the
 *  single-link UX surfaced elsewhere). Returns an empty map for an
 *  empty input or on auth/permission errors so the caller can render
 *  rows without a collection segment instead of failing the whole list. */
export async function getScanCollections(
  scanIds: string[],
): Promise<Map<string, ScanCollectionRef>> {
  const out = new Map<string, ScanCollectionRef>();
  const ids = Array.from(new Set(scanIds.filter(Boolean)));
  if (ids.length === 0) return out;

  const placeholders = ids.map((_, i) => `scanId = {:s${i}}`).join(" || ");
  const params: Record<string, string> = {};
  ids.forEach((id, i) => {
    params[`s${i}`] = id;
  });

  try {
    const rows = await pb
      .collection("collection_items")
      .getFullList<CollectionItemRecord>({
        filter: pb.filter(placeholders, params),
        expand: "collection",
        sort: "-created",
        requestKey: null,
      });
    for (const row of rows) {
      if (out.has(row.scanId)) continue;
      const c = row.expand?.collection;
      if (!c) continue;
      out.set(row.scanId, {
        id: c.id,
        slug: c.slug ?? "",
        title: c.title ?? "",
      });
    }
  } catch {
    // Empty map on failure — table rows just won't show the collection
    // segment, rather than the whole table failing to render.
  }
  return out;
}

/** Project the raw join row + expanded scan into the row shape the
 *  CollectionItemsTable renders. Falls back to placeholder text when
 *  the expand didn't come through (e.g. the scan was deleted). */
export function adaptItemRecord(record: CollectionItemRecord): CollectionItem {
  const scan = record.expand?.scanId as
    | (RecordModel & Partial<Scan>)
    | undefined;
  if (!scan) {
    return {
      id: record.id,
      scanId: "",
      type: "txt",
      name: "Removed scan",
      origin: "up",
      meta: {},
      confidence: 0,
      aiPct: 0,
      model: "—",
      detector: "—",
      when: formatRelative(record.created as string),
      status: "failed",
      whenIso: (record.created as string) ?? "",
      tokensUsed: 0,
    };
  }
  const projected = scanToLibraryItem({
    id: scan.id,
    created: (scan.created as string) ?? "",
    updated: (scan.updated as string) ?? "",
    userId: (scan.userId as string) ?? "",
    archived: !!scan.archived,
    pinned: !!scan.pinned,
    title: (scan.title as string) ?? "",
    number: Number(scan.number ?? 0),
    type: (scan.type as Scan["type"]) ?? "txt",
    subtype: (scan.subtype as string) ?? "",
    origin: (scan.origin as Scan["origin"]) ?? "upload",
    status: (scan.status as Scan["status"]) ?? "done",
    content: (scan.content as string) ?? "",
    file: (scan.file as string) ?? "",
    fileUrl: null,
    sourceUrl: (scan.sourceUrl as string) ?? "",
    mimeType: (scan.mimeType as string) ?? "",
    sizeBytes: Number(scan.sizeBytes ?? 0),
    fileHash: (scan.fileHash as string) ?? "",
    durationMs: Number(scan.durationMs ?? 0),
    wordCount: Number(scan.wordCount ?? 0),
    language: (scan.language as string) ?? "",
    thumbUrl: (scan.thumbUrl as string) ?? "",
    verdict: (scan.verdict as Scan["verdict"]) ?? "unknown",
    confidence: Number(scan.confidence ?? 0),
    aiPct: Number(scan.aiPct ?? 0),
    model: (scan.model as string) ?? "",
    engineId: (scan.engineId as string) ?? "",
    scanStartedAt: (scan.scanStartedAt as string) ?? "",
    scanCompletedAt: (scan.scanCompletedAt as string) ?? "",
    scanDurationMs: Number(scan.scanDurationMs ?? 0),
    breakdown: null,
    flags: [],
    engineResults: {},
    analysis: (scan.analysis ?? null) as Record<string, unknown> | null,
    analysisVersion: 1,
    error: null,
    visibility: (scan.visibility as Scan["visibility"]) ?? "private",
    shareToken: (scan.shareToken as string) ?? "",
    tags: [],
    notes: "",
    collectionRef: "",
    creditsUsed: 0,
    parentScanId: "",
    version: 1,
  });

  const engineId = projected.engineId ?? "";
  const status = (scan.status as Scan["status"]) ?? "done";
  const completedIso = (scan.scanCompletedAt as string) ?? "";
  const createdIso = (scan.created as string) ?? "";
  return {
    id: record.id,
    scanId: scan.id ?? "",
    type: projected.type,
    name: projected.name,
    origin: projected.origin,
    meta: projected.meta,
    link: projected.link,
    confidence: projected.confidence,
    aiPct: projected.aiPct ?? projected.confidence,
    model: projected.model,
    detector: detectorDisplayName(engineId, projected.model),
    when: projected.when,
    status,
    whenIso: completedIso || createdIso,
    tokensUsed: tokensFromScan(scan),
  };
}

/** Total tokens consumed across every engine that's been run on this
 *  scan. Prefers the per-engine sum from `engineResults` (preserves cost
 *  across rescans), with a fallback to the top-level `creditsUsed` for
 *  legacy rows that predate the per-engine field. */
function tokensFromScan(scan: RecordModel & Partial<Scan>): number {
  const map = scan.engineResults;
  if (map && typeof map === "object") {
    let sum = 0;
    for (const entry of Object.values(map) as Array<Partial<EngineResultEntry>>) {
      sum += Number(entry?.creditsUsed ?? 0);
    }
    if (sum > 0) return sum;
  }
  return Number(scan.creditsUsed ?? 0);
}

function isDuplicate(err: unknown): boolean {
  if (!(err instanceof ClientResponseError)) return false;
  if (err.status !== 400) return false;
  const data = err.response?.data as
    | Record<string, { code?: string }>
    | undefined;
  if (!data) return false;
  return Object.values(data).some(
    (field) => field?.code === "validation_not_unique",
  );
}
