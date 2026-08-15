import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { requireAuth } from "../../middleware/auth.js";
import { getAdminStore } from "../../lib/admin-store.js";
import { getMonthlyUsage } from "../../lib/usage.js";
import { runDetectionInBackground } from "../../lib/run-detection.js";
import { isPlan, PLAN_RANK, tierFromRow, type Plan } from "../../lib/plans.js";
import { isYoutubeUrl, probeYoutubeDuration } from "../../lib/youtube-download.js";
import type { DetectorInput, ScanKind } from "../../detectors/index.js";
import {
  createScanFormSchema,
  isAllowedMime,
  MAX_FILE_BYTES,
  type ScanType,
} from "./validators.js";
import { serializeScan } from "./shape.js";
import {
  reserveModelUsage,
  UsageLimitError,
} from "../../services/usage-ledger.js";

export const create = new Hono();

create.use(
  "*",
  bodyLimit({
    maxSize: MAX_FILE_BYTES + 1024,
    onError: (c) =>
      c.json({ error: "payload_too_large", limitBytes: MAX_FILE_BYTES }, 413),
  }),
);
create.use("*", requireAuth);

const DETECTOR_KINDS: ScanKind[] = ["txt", "img", "aud", "vid"];

// TODO(rate-limit): per-user create-throttle. A logged-in user can spam
// 256MB uploads today. Defer to a follow-up.
create.post("/", async (c) => {
  const store = c.get("store");
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await c.req.parseBody();
  } catch {
    return c.json({ error: "invalid_body" }, 400);
  }

  const file = body.file instanceof File ? body.file : null;
  const parsed = createScanFormSchema.safeParse({
    type: body.type,
    origin: body.origin,
    title: typeof body.title === "string" ? body.title : undefined,
    content: typeof body.content === "string" ? body.content : undefined,
    sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : undefined,
    subtype: typeof body.subtype === "string" ? body.subtype : undefined,
    modelSlug: typeof body.modelSlug === "string" ? body.modelSlug : undefined,
    width: typeof body.width === "string" ? body.width : undefined,
    height: typeof body.height === "string" ? body.height : undefined,
  });
  if (!parsed.success) {
    return c.json({ error: "invalid_body", issues: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;

  // YouTube URL flow: `type=vid + sourceUrl + no file` — backend resolves
  // the URL to bytes during the background run. All other modalities
  // still require the canonical "exactly one of content/sourceUrl/file"
  // presence so we don't silently change the contract for upload-based
  // scans.
  const isYoutubeVidScan =
    input.type === "vid" &&
    !!input.sourceUrl &&
    !file &&
    isYoutubeUrl(input.sourceUrl);

  const present = [!!input.content, !!input.sourceUrl, !!file].filter(Boolean).length;
  if (!isYoutubeVidScan && present !== 1) {
    return c.json(
      { error: "invalid_body", issues: { _: ["exactly one of content / sourceUrl / file is required"] } },
      400,
    );
  }

  if (file) {
    if (file.size > MAX_FILE_BYTES) {
      return c.json({ error: "payload_too_large", limitBytes: MAX_FILE_BYTES }, 413);
    }
    if (!isAllowedMime(file.type)) {
      return c.json({ error: "unsupported_media_type", mime: file.type }, 415);
    }
  }

  const type = input.type as ScanType;
  if (!DETECTOR_KINDS.includes(type as ScanKind)) {
    return c.json({ error: "unsupported_scan_type", type }, 400);
  }
  const kind = type as ScanKind;

  // Dedup by (userId, type, sourceUrl): if a non-failed scan already exists
  // for this URL, return it instead of creating a duplicate. Catches both
  // already-finished scans (re-visiting the same video) and concurrent
  // in-flight ones (multi-tab YouTube auto-scan, frontend retries while
  // a queued row is still spinning). `failed` rows are deliberately
  // excluded so the user can retry after a transient detector failure.
  const dedupUrl = input.sourceUrl?.trim();
  if (dedupUrl) {
    try {
      const existing = await store.collection("scans").getFirstListItem(
        `userId = "${user.id}" && type = "${type}" && ` +
          `sourceUrl = "${dedupUrl.replace(/"/g, '\\"')}" && status != "failed"`,
        { sort: "-created", requestKey: null },
      );
      return c.json(serializeScan(existing), 200);
    } catch {
      // No existing scan — fall through to the normal create path.
    }
  }

  // ── Resolve model + token ─────────────────────────────────────────
  const admin = await getAdminStore();
  const modelRow = await resolveModel(admin, kind, input.modelSlug, user);
  if (!modelRow) return c.json({ error: "no_model_available", type }, 404);
  if (modelRow.enabled === false) return c.json({ error: "model_disabled", slug: modelRow.slug }, 403);
  const userPlan: Plan = isPlan(user.plan) ? user.plan : "check";
  const modelTier = tierFromRow(modelRow);
  if (PLAN_RANK[modelTier] > PLAN_RANK[userPlan]) {
    return c.json(
      { error: "plan_not_allowed", slug: modelRow.slug, upgradeTo: modelTier },
      403,
    );
  }
  // ── Plan budget — charge upfront so parallel scans can't double-spend ─
  const usage = await getMonthlyUsage(store, {
    id: user.id,
    plan: user.plan as string | undefined,
  });
  const tokenCost = typeof modelRow.tokenCost === "number" ? modelRow.tokenCost : 1;

  // For per-minute pricing on a YouTube URL we need to know the duration
  // BEFORE charging — otherwise a 10-minute video scans for the same
  // cost as a 30-second upload. Probe is a metadata-only yt-dlp call so
  // it's fast enough to inline. Failures here charge a conservative 1
  // minute; the full download will fail loudly later if the URL is bad.
  let estimatedMinutes = 1;
  if (modelRow.costUnit === "per_minute") {
    if (file) {
      estimatedMinutes = Math.max(1, Math.ceil(estimateMinutes(file)));
    } else if (isYoutubeVidScan) {
      try {
        const seconds = await probeYoutubeDuration(input.sourceUrl!);
        estimatedMinutes = Math.max(1, Math.ceil(seconds / 60));
      } catch {
        estimatedMinutes = 1;
      }
    }
  }
  const tokensRequired =
    modelRow.costUnit === "per_minute" ? tokenCost * estimatedMinutes : tokenCost;
  if (usage.total !== null && usage.used + tokensRequired > usage.total) {
    return c.json(
      { error: "insufficient_tokens", required: tokensRequired, remaining: usage.total - usage.used },
      402,
    );
  }

  // ── Build detector input (buffer file bytes for the bg task) ──────
  let detectorInput: DetectorInput;
  let pendingSourceUrl: string | undefined;
  if (kind === "txt") {
    if (!input.content) {
      return c.json({ error: "invalid_body", issues: { _: ["text scan requires content"] } }, 400);
    }
    detectorInput = { kind: "txt", text: input.content };
  } else if (isYoutubeVidScan) {
    // Placeholder bytes — the runner resolves the URL before calling
    // the detector. Detector contract stays "bytes in", which means
    // hf-video.ts doesn't need to know anything about YouTube.
    detectorInput = { kind: "vid", bytes: Buffer.alloc(0), mime: "video/mp4" };
    pendingSourceUrl = input.sourceUrl!;
  } else {
    if (!file) {
      return c.json(
        { error: "invalid_body", issues: { _: [`${kind} scan requires a file upload`] } },
        400,
      );
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    detectorInput = { kind, bytes, mime: file.type } as DetectorInput;
  }

  // ── Resolve video frame model ahead of background dispatch ────────
  let videoFrameModelId: string | undefined;
  let videoFrameCount: number | undefined;
  if (kind === "vid" && modelRow.videoFrameModelSlug) {
    const frameSlug = modelRow.videoFrameModelSlug;
    let frameRow: DetectionModelRow | null = null;
    try {
      frameRow = (await admin
        .collection("detection_models")
        .getFirstListItem(`slug = "${frameSlug}"`)) as unknown as DetectionModelRow;
    } catch {}
    if (!frameRow?.hfModelId) {
      return c.json({ error: "model_misconfigured", detail: `frame model "${frameSlug}" missing` }, 500);
    }
    videoFrameModelId = frameRow.hfModelId;
    videoFrameCount =
      typeof modelRow.videoFrameCount === "number" ? modelRow.videoFrameCount : undefined;
  }

  // ── Persist queued row ────────────────────────────────────────────
  const title =
    input.title?.trim() ||
    deriveTitle({
      content: input.content,
      fileName: file?.name,
      sourceUrl: input.sourceUrl,
    });

  const wordCount = input.content
    ? input.content.trim() === ""
      ? 0
      : input.content.trim().split(/\s+/).length
    : 0;

  // Per-user 1-based sequence used as the editor's "#N no title" label.
  // Computed via max(number)+1 — races across simultaneous creates can
  // produce duplicate values, but `number` is display-only (not a
  // uniqueness invariant) so we accept that over locking.
  let nextNumber = 0;
  try {
    const last = await admin.collection("scans").getList(1, 1, {
      filter: `userId = "${user.id}"`,
      sort: "-number",
      requestKey: null,
    });
    nextNumber = (Number(last.items[0]?.number) || 0) + 1;
  } catch {
    nextNumber = 0;
  }

  const form = new FormData();
  form.append("userId", user.id);
  form.append("title", title);
  form.append("number", String(nextNumber));
  form.append("type", type);
  if (input.subtype) form.append("subtype", input.subtype);
  form.append("origin", input.origin);
  form.append("status", "queued");
  if (input.content) form.append("content", input.content);
  if (input.sourceUrl) form.append("sourceUrl", input.sourceUrl);
  if (file) {
    form.append("file", file);
    form.append("mimeType", file.type || "");
    form.append("sizeBytes", String(file.size));
  } else if (input.content) {
    form.append("mimeType", "text/plain");
    form.append("sizeBytes", String(new TextEncoder().encode(input.content).length));
  }
  if (wordCount > 0) form.append("wordCount", String(wordCount));
  // Land client-extracted image dimensions on the row at queue time so
  // the activity table shows `W × H` immediately. The detector merges
  // this with `providerRaw` when it completes; rescan preserves it.
  if (kind === "img" && input.width && input.height) {
    form.append(
      "analysis",
      JSON.stringify({ width: input.width, height: input.height }),
    );
    form.append("analysisVersion", "1");
  }
  // Charge the full cost now — refunded by the background runner if it fails.
  form.append("creditsUsed", String(tokensRequired));
  // engineId carries the model slug from the moment of creation so the
  // editor knows which model the user picked even before the verdict lands.
  form.append("engineId", modelRow.slug);
  form.append("visibility", "private");
  form.append("version", "1");
  // Written explicitly so the row carries the field the library filter
  // reads. Without it the record has no `archived` key and every
  // equality test against it fails.
  form.append("archived", "false");
  form.append("pinned", "false");

  let record;
  try {
    record = await store.collection("scans").create(form);
  } catch (err) {
    const detail =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "create_failed";
    console.error(`[scans/create] backend create failed`, detail, err);
    return c.json({ error: "create_failed", detail }, 500);
  }

  let usageReservation;
  try {
    usageReservation = await reserveModelUsage({
      userId: user.id,
      modelId: modelRow.id,
      scanId: record.id,
      credits: tokensRequired,
      limit: usage.total,
      modality: kind,
    });
  } catch (error) {
    await store.collection("scans").delete(record.id).catch(() => undefined);
    if (error instanceof UsageLimitError) {
      return c.json({
        error: "insufficient_tokens",
        required: error.required,
        remaining: error.remaining,
      }, 402);
    }
    console.error("[scans/create] usage reservation failed", error);
    return c.json({ error: "usage_reservation_failed" }, 503);
  }

  console.log(
    `[scans/create] queued scan ${record.id} type=${type} model=${modelRow.slug} ` +
      `hfModel=${modelRow.hfModelId || "(none)"} cost=${tokensRequired} user=${user.id}`,
  );

  // ── Kick off detection in the background ──────────────────────────
  runDetectionInBackground({
    scanId: record.id,
    userId: user.id,
    kind,
    detectorInput,
    modelId: modelRow.id,
    modelSlug: modelRow.slug,
    videoFrameModelId,
    videoFrameCount,
    tokensCharged: tokensRequired,
    usageReservationKey: usageReservation.key,
    pendingSourceUrl,
  });

  return c.json(serializeScan(record), 201);
});

type DetectionModelRow = {
  id: string;
  slug: string;
  type: string;
  enabled?: boolean;
  hfModelId?: string;
  videoFrameModelSlug?: string;
  videoFrameCount?: number;
  tokenCost?: number;
  costUnit?: string;
  tier?: string;
  plansAllowed?: string[];
};

async function resolveModel(
  admin: Awaited<ReturnType<typeof getAdminStore>>,
  kind: ScanKind,
  explicitSlug: string | undefined,
  user: { plan?: unknown } | Record<string, unknown>,
): Promise<DetectionModelRow | null> {
  if (explicitSlug) {
    try {
      return (await admin
        .collection("detection_models")
        .getFirstListItem(`slug = "${explicitSlug}"`)) as unknown as DetectionModelRow;
    } catch {
      return null;
    }
  }

  // No slug supplied → pick the cheapest in-tier model for this
  // modality. Acts as the downgrade-fallback path: a user whose
  // stored model is now above their plan still gets a legal default
  // (the picker UIs send modelSlug only when the user picks one).
  const plan: Plan = isPlan(user.plan) ? user.plan : "check";
  const records = (await admin
    .collection("detection_models")
    .getFullList({
      filter: `enabled = true && type = "${kind}"`,
      sort: "tokenCost,accuracy",
      requestKey: null,
    })) as unknown as DetectionModelRow[];
  return records.find((r) => PLAN_RANK[tierFromRow(r)] <= PLAN_RANK[plan]) ?? null;
}

function estimateMinutes(file: File | null): number {
  if (!file) return 1;
  const mb = file.size / (1024 * 1024);
  return Math.max(1, Math.ceil(mb / 3));
}

function deriveTitle(input: {
  content?: string;
  fileName?: string;
  sourceUrl?: string;
}): string {
  if (input.content) {
    const flat = input.content.replace(/\s+/g, " ").trim();
    return flat.length === 0
      ? "Untitled scan"
      : flat.length > 60
        ? flat.slice(0, 57) + "…"
        : flat;
  }
  if (input.fileName) return input.fileName;
  if (input.sourceUrl) return input.sourceUrl;
  return "Untitled scan";
}
