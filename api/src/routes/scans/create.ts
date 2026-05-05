import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { requireAuth } from "../../middleware/auth.js";
import { pbAdmin } from "../../lib/pb-admin.js";
import { getMonthlyUsage } from "../../lib/usage.js";
import { runDetectionInBackground } from "../../lib/run-detection.js";
import type { DetectorInput, DetectorProvider, ScanKind } from "../../detectors/index.js";
import {
  createScanFormSchema,
  isAllowedMime,
  MAX_FILE_BYTES,
  type ScanType,
} from "./validators.js";
import { serializeScan } from "./shape.js";

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
  const pb = c.get("pb");
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
    modelSlug: typeof body.modelSlug === "string" ? body.modelSlug : undefined,
  });
  if (!parsed.success) {
    return c.json({ error: "invalid_body", issues: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;

  const present = [!!input.content, !!input.sourceUrl, !!file].filter(Boolean).length;
  if (present !== 1) {
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

  // ── Resolve model + token ─────────────────────────────────────────
  const admin = await pbAdmin();
  const modelRow = await resolveModel(admin, kind, input.modelSlug, user);
  if (!modelRow) return c.json({ error: "no_model_available", type }, 404);
  if (modelRow.enabled === false) return c.json({ error: "model_disabled", slug: modelRow.slug }, 403);
  if (
    Array.isArray(modelRow.plansAllowed) &&
    !modelRow.plansAllowed.includes(String(user.plan ?? "check"))
  ) {
    return c.json({ error: "plan_not_allowed", slug: modelRow.slug }, 403);
  }
  // PB returns "" (empty string) for unset select fields, so `??`
  // wouldn't fall through to the default. Treat anything that isn't
  // a known non-HF provider as `hf-inference`.
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

  // ── Plan budget — charge upfront so parallel scans can't double-spend ─
  const usage = await getMonthlyUsage(pb, {
    id: user.id,
    plan: user.plan as string | undefined,
  });
  const tokenCost = typeof modelRow.tokenCost === "number" ? modelRow.tokenCost : 1;
  const tokensRequired =
    modelRow.costUnit === "per_minute"
      ? tokenCost * Math.max(1, Math.ceil(estimateMinutes(file)))
      : tokenCost;
  if (usage.total !== null && usage.used + tokensRequired > usage.total) {
    return c.json(
      { error: "insufficient_tokens", required: tokensRequired, remaining: usage.total - usage.used },
      402,
    );
  }

  // ── Build detector input (buffer file bytes for the bg task) ──────
  let detectorInput: DetectorInput;
  if (kind === "txt") {
    if (!input.content) {
      return c.json({ error: "invalid_body", issues: { _: ["text scan requires content"] } }, 400);
    }
    detectorInput = { kind: "txt", text: input.content };
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
  if (kind === "vid") {
    const frameSlug = modelRow.videoFrameModelSlug;
    if (!frameSlug) {
      return c.json({ error: "model_misconfigured", detail: "video model missing videoFrameModelSlug" }, 500);
    }
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
  // Charge the full cost now — refunded by the background runner if it fails.
  form.append("creditsUsed", String(tokensRequired));
  // engineId carries the model slug from the moment of creation so the
  // editor knows which model the user picked even before the verdict lands.
  form.append("engineId", modelRow.slug);
  form.append("visibility", "private");
  form.append("version", "1");

  let record;
  try {
    record = await pb.collection("scans").create(form);
  } catch (err) {
    const detail =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "create_failed";
    console.error(`[scans/create] PB create failed`, detail, err);
    return c.json({ error: "create_failed", detail }, 500);
  }

  console.log(
    `[scans/create] queued scan ${record.id} type=${type} model=${modelRow.slug} ` +
      `hfModel=${modelRow.hfModelId || "(none)"} cost=${tokensRequired} user=${user.id}`,
  );

  // ── Kick off detection in the background ──────────────────────────
  runDetectionInBackground({
    scanId: record.id,
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

  return c.json(serializeScan(record, pb), 201);
});

type DetectionModelRow = {
  id: string;
  slug: string;
  type: string;
  enabled?: boolean;
  provider?: string;
  hfModelId?: string;
  videoFrameModelSlug?: string;
  videoFrameCount?: number;
  tokenCost?: number;
  costUnit?: string;
  plansAllowed?: string[];
  defaultForPlans?: string[];
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

  const plan = String(user.plan ?? "check");
  const records = (await admin
    .collection("detection_models")
    .getFullList({
      filter: `enabled = true && type = "${kind}" && plansAllowed ~ "${plan}"`,
      sort: "-accuracy",
      requestKey: null,
    })) as unknown as DetectionModelRow[];
  if (records.length === 0) return null;
  const flagged = records.find(
    (r) => Array.isArray(r.defaultForPlans) && r.defaultForPlans.includes(plan),
  );
  return flagged ?? records[0];
}

async function loadHuggingfaceToken(
  admin: Awaited<ReturnType<typeof pbAdmin>>,
): Promise<string> {
  try {
    const list = await admin
      .collection("service_secrets")
      .getList(1, 1, { sort: "-created" });
    const row = list.items[0];
    const tok = (row?.huggingfaceToken as string | undefined)?.trim();
    return tok ?? "";
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
    const row = list.items[0];
    const tok = (row?.velmaApiKey as string | undefined)?.trim();
    return tok ?? "";
  } catch {
    return "";
  }
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
