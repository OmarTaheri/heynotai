import { hfInference } from "./hf-client.js";
import {
  DetectorError,
  type DetectorInput,
  type DetectorResult,
  type ModelConfig,
  normalizeHfClassification,
  verdictFromLabels,
} from "./types.js";

export async function detect(
  input: DetectorInput,
  cfg: ModelConfig,
): Promise<DetectorResult> {
  if (input.kind !== "img") {
    throw new DetectorError(400, "hf-image only handles image inputs");
  }

  const raw = await runOnImage(input.bytes, input.mime, cfg);
  const labels = normalizeHfClassification(raw);
  const { verdict, confidence } = verdictFromLabels(labels);
  console.log(
    `[hf-image] ${cfg.hfModelId}: labels=${JSON.stringify(labels)} → verdict=${verdict} confidence=${confidence}`,
  );

  return {
    verdict,
    confidence,
    model: cfg.hfModelId,
    rawProviderResponse: raw,
    durationMs: 0,
  };
}

/** Exposed so the video meta-detector can run the same image classifier
 *  against each sampled frame without going through DetectorInput. */
export async function runOnImage(
  bytes: Buffer,
  mime: string,
  cfg: { hfToken: string; hfModelId: string },
): Promise<unknown> {
  const startedAt = Date.now();
  const raw = await hfInference({
    modelId: cfg.hfModelId,
    hfToken: cfg.hfToken,
    contentType: mime || "application/octet-stream",
    body: new Uint8Array(bytes),
  });
  // Calling sites need the raw response; durationMs is reported on the
  // outer `detect` for video aggregation.
  void startedAt;
  return raw;
}
