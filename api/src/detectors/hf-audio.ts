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
  if (input.kind !== "aud") {
    throw new DetectorError(400, "hf-audio only handles audio inputs");
  }

  const startedAt = Date.now();
  const raw = await hfInference({
    modelId: cfg.hfModelId,
    hfToken: cfg.hfToken,
    contentType: input.mime || "application/octet-stream",
    body: new Uint8Array(input.bytes),
  });

  const labels = normalizeHfClassification(raw);
  const { verdict, confidence } = verdictFromLabels(labels);
  console.log(
    `[hf-audio] ${cfg.hfModelId}: labels=${JSON.stringify(labels)} → verdict=${verdict} confidence=${confidence}`,
  );

  return {
    verdict,
    confidence,
    model: cfg.hfModelId,
    rawProviderResponse: raw,
    durationMs: Date.now() - startedAt,
  };
}
