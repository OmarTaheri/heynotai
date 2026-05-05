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
  if (input.kind !== "txt") {
    throw new DetectorError(400, "hf-text only handles text inputs");
  }

  const startedAt = Date.now();
  const raw = await hfInference({
    modelId: cfg.hfModelId,
    hfToken: cfg.hfToken,
    contentType: "application/json",
    body: JSON.stringify({ inputs: input.text }),
  });

  const labels = normalizeHfClassification(raw);
  const { verdict, confidence } = verdictFromLabels(labels);
  console.log(
    `[hf-text] ${cfg.hfModelId}: labels=${JSON.stringify(labels)} → verdict=${verdict} confidence=${confidence}`,
  );

  return {
    verdict,
    confidence,
    model: cfg.hfModelId,
    rawProviderResponse: raw,
    durationMs: Date.now() - startedAt,
  };
}
