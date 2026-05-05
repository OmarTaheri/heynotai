import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth.js";
import { pbAdmin } from "../../lib/pb-admin.js";
import { getMonthlyUsage } from "../../lib/usage.js";
import { runDetectionInBackground } from "../../lib/run-detection.js";
import { isPlan, PLAN_RANK, tierFromRow, type Plan } from "../../lib/plans.js";
import type { DetectorInput, DetectorProvider, ScanKind } from "../../detectors/index.js";
import type { ScanType } from "./validators.js";
import { serializeScan } from "./shape.js";

export const rescan = new Hono();

rescan.use("*", requireAuth);

const DETECTOR_KINDS: ScanKind[] = ["txt", "img", "aud", "vid"];

/** Re-runs detection on an existing scan **in place** — same row, same
 *  id, same URL on the editor. We clear the verdict, flip the row back
 *  to `status: "queued"`, and let `runDetectionInBackground` walk it
 *  through `scanning` → `done`/`failed` while the editor polls the same
 *  scan id. No new row is created, no `parentScanId` chain.
 *
 *  Accepts an optional `modelSlug` from the form body so the user can
 *  pick a different engine in the editor's dropdown and re-test against
 *  it without re-uploading. */
rescan.post("/:id/rescan", async (c) => {
  const pb = c.get("pb");
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);

  let parent;
  try {
    parent = await pb.collection("scans").getOne(c.req.param("id"));
  } catch {
    return c.json({ error: "not_found" }, 404);
  }

  // ── Read optional modelSlug override ──────────────────────────────
  let modelSlug: string | undefined;
  try {
    const body = await c.req.parseBody();
    if (typeof body.modelSlug === "string" && body.modelSlug.trim()) {
      modelSlug = body.modelSlug.trim();
    }
  } catch {
    // empty body is fine — fall back to plan default
  }

  const type = parent.type as ScanType;
  if (!DETECTOR_KINDS.includes(type as ScanKind)) {
    return c.json({ error: "unsupported_scan_type", type }, 400);
  }
  const kind = type as ScanKind;

  // ── Resolve model + token ─────────────────────────────────────────
  const admin = await pbAdmin();
  const modelRow = await resolveModel(admin, kind, modelSlug, user);
  if (!modelRow) return c.json({ error: "no_model_available", type }, 404);
  if (modelRow.enabled === false) {
    return c.json({ error: "model_disabled", slug: modelRow.slug }, 403);
  }
  const userPlan: Plan = isPlan(user.plan) ? user.plan : "check";
  const modelTier = tierFromRow(modelRow);
  if (PLAN_RANK[modelTier] > PLAN_RANK[userPlan]) {
    return c.json(
      { error: "plan_not_allowed", slug: modelRow.slug, upgradeTo: modelTier },
      403,
    );
  }
  // PB returns "" for unset select fields — `??` would let it through.
  const rawProvider = String(modelRow.provider ?? "").trim();
  const provider: DetectorProvider = rawProvider === "velma" ? "velma" : "hf-inference";
  const hfToken = provider === "hf-inference" ? await loadHuggingfaceToken(admin) : "";
  if (provider === "hf-inference" && !hfToken) {
    return c.json({ error: "detection_unconfigured" }, 503);
  }
  const velmaApiKey = provider === "velma" ? await loadVelmaApiKey(admin) : "";
  if (provider === "velma" && !velmaApiKey) {
    return c.json({ error: "detection_unconfigured", provider: "velma" }, 503);
  }

  // ── Build detector input from the parent ──────────────────────────
  let detectorInput: DetectorInput;
  if (kind === "txt") {
    if (!parent.content) {
      return c.json({ error: "parent_missing_content" }, 400);
    }
    detectorInput = { kind: "txt", text: parent.content as string };
  } else {
    if (!parent.file) {
      return c.json({ error: "parent_missing_file" }, 400);
    }
    const url = pb.files.getURL(parent, parent.file);
    const r = await fetch(url);
    if (!r.ok) {
      return c.json({ error: "parent_file_unreadable" }, 502);
    }
    const blob = await r.blob();
    const buf = Buffer.from(await blob.arrayBuffer());
    detectorInput = { kind, bytes: buf, mime: parent.mimeType || blob.type } as DetectorInput;
  }

  // ── Plan budget — refund the parent's existing creditsUsed before
  //    checking the new cost. We're overwriting the same row, so the
  //    monthly tally should reflect the new cost only, not old + new. ─
  const usage = await getMonthlyUsage(pb, {
    id: user.id,
    plan: user.plan as string | undefined,
  });
  const tokenCost = typeof modelRow.tokenCost === "number" ? modelRow.tokenCost : 1;
  const tokensRequired =
    modelRow.costUnit === "per_minute"
      ? tokenCost * Math.max(1, Math.ceil((parent.sizeBytes ?? 0) / (3 * 1024 * 1024)))
      : tokenCost;
  const previousCost =
    typeof parent.creditsUsed === "number" ? parent.creditsUsed : 0;
  const projectedUsed = usage.used - previousCost + tokensRequired;
  if (usage.total !== null && projectedUsed > usage.total) {
    return c.json(
      {
        error: "insufficient_tokens",
        required: tokensRequired,
        remaining: usage.total - (usage.used - previousCost),
      },
      402,
    );
  }

  // ── Resolve video frame model ─────────────────────────────────────
  let videoFrameModelId: string | undefined;
  let videoFrameCount: number | undefined;
  if (kind === "vid") {
    const frameSlug = modelRow.videoFrameModelSlug;
    if (!frameSlug) return c.json({ error: "model_misconfigured" }, 500);
    let frameRow: DetectionModelRow | null = null;
    try {
      frameRow = (await admin
        .collection("detection_models")
        .getFirstListItem(`slug = "${frameSlug}"`)) as unknown as DetectionModelRow;
    } catch {}
    if (!frameRow?.hfModelId) return c.json({ error: "model_misconfigured" }, 500);
    videoFrameModelId = frameRow.hfModelId;
    videoFrameCount =
      typeof modelRow.videoFrameCount === "number" ? modelRow.videoFrameCount : undefined;
  }

  // ── Update the existing row in place. Clear the prior verdict so the
  //    editor's `scanToResult` doesn't render stale data while the new
  //    HF call is in flight. The PB JS SDK accepts JSON for non-file
  //    updates — we have no new file to upload here. ──────────────────
  // Preserve client-extracted metadata (image width/height) across the
  // rescan; the underlying file hasn't changed. Provider-derived fields
  // (`providerRaw`) are dropped — `run-detection` will re-merge them.
  const preservedAnalysis: Record<string, unknown> = {};
  if (parent.analysis && typeof parent.analysis === "object") {
    const a = parent.analysis as Record<string, unknown>;
    if (typeof a.width === "number") preservedAnalysis.width = a.width;
    if (typeof a.height === "number") preservedAnalysis.height = a.height;
  }
  const nextAnalysis =
    Object.keys(preservedAnalysis).length > 0 ? preservedAnalysis : null;
  let updated;
  try {
    updated = await pb.collection("scans").update(parent.id, {
      status: "queued",
      engineId: modelRow.slug,
      creditsUsed: tokensRequired,
      verdict: "",
      confidence: 0,
      model: "",
      analysis: nextAnalysis,
      error: null,
      scanStartedAt: null,
      scanCompletedAt: null,
      scanDurationMs: 0,
    });
  } catch (err) {
    console.error(`[scans/rescan] PB update failed`, err);
    return c.json({ error: "rescan_failed" }, 500);
  }

  console.log(
    `[scans/rescan] re-queued scan ${parent.id} type=${type} model=${modelRow.slug} ` +
      `cost=${tokensRequired} (was ${previousCost}) user=${user.id}`,
  );

  runDetectionInBackground({
    scanId: parent.id,
    kind,
    detectorInput,
    provider,
    hfToken,
    hfModelId: modelRow.hfModelId ?? "",
    velmaApiKey,
    modelSlug: modelRow.slug,
    videoFrameModelId,
    videoFrameCount,
    tokensCharged: tokensRequired,
  });

  return c.json(serializeScan(updated, pb), 200);
});

type DetectionModelRow = {
  id: string;
  slug: string;
  enabled?: boolean;
  provider?: string;
  hfModelId?: string;
  videoFrameModelSlug?: string;
  videoFrameCount?: number;
  tokenCost?: number;
  costUnit?: string;
  tier?: string;
  plansAllowed?: string[];
};

async function resolveModel(
  admin: Awaited<ReturnType<typeof pbAdmin>>,
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

  // No slug supplied → cheapest in-tier model. Same downgrade-safe
  // path as `routes/scans/create.ts`.
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

async function loadHuggingfaceToken(
  admin: Awaited<ReturnType<typeof pbAdmin>>,
): Promise<string> {
  try {
    const list = await admin
      .collection("service_secrets")
      .getList(1, 1, { sort: "-created" });
    return ((list.items[0]?.huggingfaceToken as string | undefined) ?? "").trim();
  } catch {
    return "";
  }
}

async function loadVelmaApiKey(
  admin: Awaited<ReturnType<typeof pbAdmin>>,
): Promise<string> {
  try {
    const list = await admin
      .collection("service_secrets")
      .getList(1, 1, { sort: "-created" });
    return ((list.items[0]?.velmaApiKey as string | undefined) ?? "").trim();
  } catch {
    return "";
  }
}
