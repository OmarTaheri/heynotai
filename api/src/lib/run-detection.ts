/* Background detection runner.
 *
 *  `scans/create` and `scans/rescan` both persist a `status: "queued"`
 *  row first and return immediately, then call `runDetectionInBackground`
 *  to do the actual HF call without blocking the request. The runner
 *  flips the row to `scanning` while it works, then `done` (with the
 *  real verdict) or `failed` (with an `error` JSON blob) when it finishes.
 *
 *  The frontend editor polls the row by id and swaps in the result
 *  once status leaves `queued`/`scanning`.
 *
 *  Logs are noisy on purpose — these runs are async and silent failures
 *  are the worst UX. Every transition (queued→scanning, →done, →failed)
 *  emits a line so a tail of the api log tells the full story. */

import { pbAdmin } from "./pb-admin.js";
import {
  DetectorError,
  getDetector,
  type DetectorInput,
  type DetectorProvider,
  type ScanKind,
} from "../detectors/index.js";
import { aiPctFromResult } from "../detectors/types.js";
import type { EngineResultEntry } from "../routes/scans/shape.js";

export type RunDetectionInput = {
  scanId: string;
  kind: ScanKind;
  detectorInput: DetectorInput;
  provider?: DetectorProvider;
  hfToken: string;
  hfModelId: string;
  velmaApiKey?: string;
  modelSlug: string;
  videoFrameModelId?: string;
  videoFrameCount?: number;
  /** Already-deducted token cost — written on the row at create time so
   *  parallel scans can't double-spend the user's monthly budget. We
   *  zero it here on failure. */
  tokensCharged: number;
};

/** Fire-and-forget. Catches its own errors so an unhandled rejection
 *  can't crash the api process. The route layer should `void` this. */
export function runDetectionInBackground(input: RunDetectionInput): void {
  void execute(input).catch((err) => {
    console.error(`[scan ${input.scanId}] runDetectionInBackground unexpected`, err);
  });
}

async function execute(input: RunDetectionInput): Promise<void> {
  const tag = `[scan ${input.scanId}]`;
  console.log(
    `${tag} start kind=${input.kind} model=${input.modelSlug} provider=${input.provider ?? "hf-inference"} ` +
      `hfModel=${input.hfModelId || "(none)"} videoFrameModel=${input.videoFrameModelId ?? "—"} ` +
      `input=${describeInput(input.detectorInput)}`,
  );

  const admin = await pbAdmin();
  const startedAt = new Date();

  try {
    await admin.collection("scans").update(input.scanId, {
      status: "scanning",
      scanStartedAt: startedAt.toISOString(),
    });
    console.log(`${tag} status=scanning`);
  } catch (err) {
    console.error(`${tag} could not mark scanning`, err);
    return;
  }

  try {
    const detector = getDetector(input.kind, input.provider);
    const result = await detector(input.detectorInput, {
      provider: input.provider,
      hfToken: input.hfToken,
      hfModelId: input.hfModelId,
      velmaApiKey: input.velmaApiKey,
      videoFrameModelId: input.videoFrameModelId,
      videoFrameCount: input.videoFrameCount,
    });
    const completedAt = new Date();

    const aiPct = aiPctFromResult(result);
    console.log(
      `${tag} done verdict=${result.verdict} confidence=${result.confidence} aiPct=${aiPct} ` +
        `model=${result.model} took=${result.durationMs}ms`,
    );

    // Merge this run into the per-engine cache. Re-fetch the row first
    // so a concurrent rescan (different engine, same scan) doesn't
    // clobber its sibling entry by writing a stale snapshot.
    let engineResults: Record<string, EngineResultEntry> = {};
    try {
      const fresh = await admin.collection("scans").getOne(input.scanId);
      if (fresh.engineResults && typeof fresh.engineResults === "object") {
        engineResults = fresh.engineResults as Record<string, EngineResultEntry>;
      }
    } catch (err) {
      console.warn(`${tag} engineResults pre-read failed; starting empty`, err);
    }
    engineResults[input.modelSlug] = {
      aiPct,
      verdict: result.verdict,
      confidence: result.confidence,
      model: result.model,
      flags: [],
      breakdown: null,
      scanCompletedAt: completedAt.toISOString(),
      scanDurationMs: result.durationMs,
      creditsUsed: input.tokensCharged,
    };

    await admin.collection("scans").update(input.scanId, {
      status: "done",
      verdict: result.verdict,
      confidence: result.confidence,
      aiPct,
      model: result.model,
      engineId: input.modelSlug,
      scanCompletedAt: completedAt.toISOString(),
      scanDurationMs: result.durationMs,
      analysis: { providerRaw: result.rawProviderResponse },
      analysisVersion: 1,
      engineResults,
    });
    console.log(`${tag} persisted ✓ engines=${Object.keys(engineResults).length}`);
  } catch (err) {
    const detail =
      err instanceof DetectorError
        ? { code: "provider_error", status: err.status, message: err.providerMessage }
        : { code: "internal_error", message: err instanceof Error ? err.message : String(err) };
    console.error(`${tag} FAILED`, detail);
    if (!(err instanceof DetectorError)) {
      // Non-detector errors (network, ffmpeg crash, etc.) — print stack
      // too so we can chase root cause from the log alone.
      console.error(`${tag} stack`, err);
    }
    try {
      await admin.collection("scans").update(input.scanId, {
        status: "failed",
        // Refund tokens — we charged at create time so parallel scans
        // can't race the budget check.
        creditsUsed: 0,
        error: detail,
        scanCompletedAt: new Date().toISOString(),
      });
      console.log(`${tag} status=failed (tokens refunded)`);
    } catch (writeErr) {
      console.error(`${tag} could not mark failed`, writeErr);
    }
  }
}

function describeInput(input: DetectorInput): string {
  if (input.kind === "txt") {
    return `text(${input.text.length} chars)`;
  }
  return `${input.kind}(${input.bytes.byteLength} bytes, mime=${input.mime})`;
}
