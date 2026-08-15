import { getAdminStore } from "./admin-store.js";
import { downloadYoutubeVideo } from "./youtube-download.js";
import {
  DetectorError,
  getDetector,
  type DetectorInput,
  type ScanKind,
} from "../detectors/index.js";
import { aiPctFromResult, type DetectorResult } from "../detectors/types.js";
import {
  executeModel,
  loadRuntimeBinding,
  ModelRuntimeError,
  resolveProviderCredential,
  type CanonicalModelResult,
  type RuntimeInput,
} from "../model-runtime/index.js";
import type { EngineResultEntry } from "../routes/scans/shape.js";
import { writeStructuredLog } from "../services/structured-log.js";
import { refundModelUsage } from "../services/usage-ledger.js";

export type RunDetectionInput = {
  scanId: string;
  userId?: string;
  kind: ScanKind;
  detectorInput: DetectorInput;
  modelId: string;
  modelSlug: string;
  /** The built-in video-frame pipeline still delegates each frame to its
   * configured image model. Generic video HTTP models do not use these. */
  videoFrameModelId?: string;
  videoFrameCount?: number;
  tokensCharged: number;
  usageReservationKey?: string;
  /** YouTube videos are downloaded once, then cached in the scan's file row. */
  pendingSourceUrl?: string;
};

/** Fire-and-forget compatibility entry point. The durable scan_jobs table
 * records queued work; this process executes immediately for low latency. */
export function runDetectionInBackground(input: RunDetectionInput): void {
  void execute(input).catch(async (error) => {
    console.error(`[scan ${input.scanId}] unexpected detection failure`, error);
    await writeStructuredLog({
      level: "fatal",
      service: "worker",
      event: "model.run_unexpected",
      message: "Detection runner exited unexpectedly",
      userId: input.userId,
      scanId: input.scanId,
      modelId: input.modelId,
      errorCode: "run_unexpected",
      context: { error },
    });
  });
}

async function execute(input: RunDetectionInput): Promise<void> {
  const admin = await getAdminStore();
  const startedAt = new Date();
  let providerId: string | undefined;

  await writeStructuredLog({
    service: "worker",
    event: "model.run_started",
    message: `Started ${input.kind} detection with ${input.modelSlug}`,
    userId: input.userId,
    scanId: input.scanId,
    modelId: input.modelId,
    context: { kind: input.kind, input: describeInput(input.detectorInput) },
  });

  try {
    await admin.collection("scans").update(input.scanId, {
      status: "scanning",
      scanStartedAt: startedAt.toISOString(),
    });
  } catch (error) {
    await writeStructuredLog({
      level: "error",
      service: "worker",
      event: "scan.state_failed",
      message: "Could not mark scan as scanning",
      userId: input.userId,
      scanId: input.scanId,
      modelId: input.modelId,
      errorCode: "scan_state_write_failed",
      context: { error },
    });
    return;
  }

  let detectorInput = input.detectorInput;
  if (input.pendingSourceUrl && input.kind === "vid") {
    try {
      const download = await downloadYoutubeVideo(input.pendingSourceUrl);
      detectorInput = {
        kind: "vid",
        bytes: download.bytes,
        mime: download.mime,
        durationSec: download.durationSec,
      };

      try {
        const cacheForm = new FormData();
        cacheForm.append(
          "file",
          new File([new Uint8Array(download.bytes)], `yt-${input.scanId}.mp4`, {
            type: download.mime,
          }),
        );
        cacheForm.append("mimeType", download.mime);
        cacheForm.append("sizeBytes", String(download.bytes.byteLength));
        if (download.durationSec > 0) {
          cacheForm.append("durationMs", String(Math.round(download.durationSec * 1000)));
        }
        await admin.collection("scans").update(input.scanId, cacheForm);
      } catch (error) {
        await writeStructuredLog({
          level: "warn",
          service: "worker",
          event: "scan.source_cache_failed",
          message: "Detection will continue, but downloaded media was not cached",
          userId: input.userId,
          scanId: input.scanId,
          modelId: input.modelId,
          errorCode: "source_cache_failed",
          context: { error },
        });
      }
    } catch (error) {
      await failRun(admin, input, error, "youtube_download_failed", providerId);
      return;
    }
  }

  try {
    const binding = await loadRuntimeBinding(input.modelId);
    providerId = binding.provider.id;
    const usesVideoFramePipeline =
      binding.model.runtimeConfig?.pipeline === "video-frames";

    let result: DetectorResult | CanonicalModelResult;
    if (usesVideoFramePipeline) {
      if (input.kind !== "vid" || !input.videoFrameModelId) {
        throw new ModelRuntimeError(
          "video_pipeline_misconfigured",
          "Video frame pipeline is missing its frame model",
          500,
        );
      }
      const detector = getDetector("vid", "hf-inference");
      result = await detector(detectorInput, {
        provider: "hf-inference",
        hfToken: resolveProviderCredential(binding.provider) ?? "",
        hfModelId: binding.model.externalModelId ?? "",
        videoFrameModelId: input.videoFrameModelId,
        videoFrameCount: input.videoFrameCount,
      });
    } else {
      result = await executeModel(
        binding.provider,
        binding.model,
        toRuntimeInput(detectorInput),
      );
    }

    const completedAt = new Date();
    const aiPct = "aiProbability" in result
      ? result.aiProbability
      : aiPctFromResult(result);

    let engineResults: Record<string, EngineResultEntry> = {};
    let previousAnalysis: Record<string, unknown> = {};
    try {
      const fresh = await admin.collection("scans").getOne(input.scanId);
      if (fresh.engineResults && typeof fresh.engineResults === "object") {
        engineResults = fresh.engineResults as Record<string, EngineResultEntry>;
      }
      if (fresh.analysis && typeof fresh.analysis === "object") {
        previousAnalysis = fresh.analysis as Record<string, unknown>;
      }
    } catch (error) {
      await writeStructuredLog({
        level: "warn",
        service: "worker",
        event: "scan.merge_read_failed",
        message: "Could not read existing engine results before merge",
        userId: input.userId,
        scanId: input.scanId,
        modelId: input.modelId,
        providerId,
        context: { error },
      });
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
      analysis: {
        ...previousAnalysis,
        providerRaw: boundedProviderRaw(result.rawProviderResponse),
      },
      analysisVersion: 1,
      engineResults,
    });

    await writeStructuredLog({
      service: "worker",
      event: "model.run_completed",
      message: `Completed ${input.kind} detection with ${input.modelSlug}`,
      userId: input.userId,
      scanId: input.scanId,
      modelId: input.modelId,
      providerId,
      durationMs: result.durationMs,
      context: { verdict: result.verdict, confidence: result.confidence, aiPct },
    });
  } catch (error) {
    await failRun(admin, input, error, "provider_error", providerId);
  }
}

async function failRun(
  admin: Awaited<ReturnType<typeof getAdminStore>>,
  input: RunDetectionInput,
  error: unknown,
  fallbackCode: string,
  providerId?: string,
): Promise<void> {
  const detail = errorDetail(error, fallbackCode);
  await refundModelUsage(input.usageReservationKey, detail.code).catch((refundError) => {
    detail.persistenceError = refundError instanceof Error
      ? refundError.message
      : String(refundError);
  });
  try {
    await admin.collection("scans").update(input.scanId, {
      status: "failed",
      creditsUsed: 0,
      error: detail,
      scanCompletedAt: new Date().toISOString(),
    });
  } catch (writeError) {
    detail.persistenceError = writeError instanceof Error ? writeError.message : String(writeError);
  }
  await writeStructuredLog({
    level: "error",
    service: "worker",
    event: "model.run_failed",
    message: `Detection failed for ${input.modelSlug}`,
    userId: input.userId,
    scanId: input.scanId,
    modelId: input.modelId,
    providerId,
    durationMs: null,
    errorCode: detail.code,
    context: { error, status: detail.status },
  });
}

function errorDetail(
  error: unknown,
  fallbackCode: string,
): { code: string; status?: number; message: string; persistenceError?: string } {
  if (error instanceof DetectorError) {
    return { code: fallbackCode, status: error.status, message: error.providerMessage };
  }
  if (error instanceof ModelRuntimeError) {
    return { code: error.code, status: error.status, message: error.message };
  }
  return {
    code: fallbackCode,
    message: error instanceof Error ? error.message : String(error),
  };
}

function toRuntimeInput(input: DetectorInput): RuntimeInput {
  if (input.kind === "txt") return { kind: "txt", text: input.text };
  return {
    kind: input.kind,
    bytes: input.bytes,
    mime: input.mime,
    durationSec: "durationSec" in input ? input.durationSec : undefined,
  };
}

function describeInput(input: DetectorInput): Record<string, unknown> {
  if (input.kind === "txt") return { kind: input.kind, characters: input.text.length };
  return { kind: input.kind, bytes: input.bytes.byteLength, mime: input.mime };
}

/** Preserve small adapter payloads used by the video result UI, but prevent a
 * provider from writing an unbounded response or user content into a scan row. */
function boundedProviderRaw(value: unknown): unknown {
  try {
    const encoded = JSON.stringify(value);
    if (encoded.length <= 128 * 1024) return value;
    return { truncated: true, originalBytes: Buffer.byteLength(encoded, "utf8") };
  } catch {
    return { unavailable: true };
  }
}
