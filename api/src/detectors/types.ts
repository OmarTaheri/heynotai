/* Shared types for the Hugging Face detection layer. Each `detect`
 * function in `./hf-{text,image,audio,video}.ts` consumes a `DetectorInput`
 * + `ModelConfig` and returns a unified `DetectorResult` regardless of
 * which model ran — the route layer doesn't care about HF response shapes. */

export type ScanKind = "txt" | "img" | "aud" | "vid";

export type DetectorInput =
  | { kind: "txt"; text: string }
  | { kind: "img"; bytes: Buffer; mime: string }
  | { kind: "aud"; bytes: Buffer; mime: string; durationSec?: number }
  | { kind: "vid"; bytes: Buffer; mime: string; durationSec?: number };

/** Where the inference call lands. `hf-inference` is the default and
 *  covers text/image/video. `velma` routes audio to Modulate's API
 *  because HF's free serverless tier does not host audio-classification
 *  models (would require a paid Inference Endpoint). */
export type DetectorProvider = "hf-inference" | "velma";

export type ModelConfig = {
  provider?: DetectorProvider;
  hfToken: string;
  hfModelId: string;
  /** Modulate Velma API key (required when `provider === "velma"`). */
  velmaApiKey?: string;
  /** Image-model id resolved from `videoFrameModelSlug` for video meta-models. */
  videoFrameModelId?: string;
  /** How many frames `hf-video` samples before aggregation. Defaults to 16. */
  videoFrameCount?: number;
};

/** Unified verdict aligned with the existing `scans.verdict` PB enum. */
export type DetectorVerdict = "human" | "ai" | "mixed";

export type DetectorResult = {
  verdict: DetectorVerdict;
  /** 0..100 — matches `scans.confidence` PB field. */
  confidence: number;
  /** Provider-reported model id (HF repo). Stored on `scans.model`. */
  model: string;
  /** Persisted on `scans.analysis` so we keep the audit trail. */
  rawProviderResponse: unknown;
  durationMs: number;
};

export class DetectorError extends Error {
  constructor(
    public status: number,
    public providerMessage: string,
  ) {
    super(providerMessage);
    this.name = "DetectorError";
  }
}

/** HF classification responses are always either:
 *    - flat: [{ label, score }, ...]
 *    - nested: [[{ label, score }, ...]]
 *  Normalize to a flat list before reading. */
export function normalizeHfClassification(raw: unknown): { label: string; score: number }[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length === 0) return [];
  const first = raw[0];
  if (Array.isArray(first)) return first as { label: string; score: number }[];
  return raw as { label: string; score: number }[];
}

/** Single source of truth for "AI percentage" (0..100). Confidence is
 *  how confident we are in the verdict — for `human` the AI prob is
 *  the inverse; for `ai`/`mixed` the confidence already IS the AI prob. */
export function aiPctFromResult(r: {
  verdict: DetectorVerdict;
  confidence: number;
}): number {
  return r.verdict === "human" ? 100 - r.confidence : r.confidence;
}

/** Map an HF label string + its score to {verdict, aiConfidence}.
 *  Most HF detectors expose two-class outputs. Labels we treat as
 *  "AI-generated": REAL/FAKE convention is reversed for `Wvolf` and
 *  some others — always read from the score on the AI label. */
export function verdictFromLabels(
  labels: { label: string; score: number }[],
): { verdict: DetectorVerdict; confidence: number } {
  if (labels.length === 0) {
    return { verdict: "human", confidence: 0 };
  }

  // Find the score the model assigns to "this is AI-generated".
  const aiScore =
    labels.find((l) => isAiLabel(l.label))?.score ??
    // If none of the labels look AI-flagged, take 1 - top human label.
    1 - (labels.find((l) => isHumanLabel(l.label))?.score ?? 0);

  const aiPct = Math.round(aiScore * 100);

  let verdict: DetectorVerdict;
  if (aiPct >= 70) verdict = "ai";
  else if (aiPct >= 40) verdict = "mixed";
  else verdict = "human";

  // confidence = how confident we are in the verdict, not the AI prob.
  // For human verdicts we report (1 - aiScore); for AI/mixed we report aiScore.
  const confidence = verdict === "human" ? 100 - aiPct : aiPct;
  return { verdict, confidence };
}

function isAiLabel(label: string): boolean {
  const l = label.toLowerCase();
  return (
    l.includes("fake") ||
    l.includes("ai") ||
    l.includes("generated") ||
    l.includes("synthetic") ||
    l.includes("deepfake") ||
    // Detector-name-as-label (Hello-SimpleAI/chatgpt-detector returns
    // "ChatGPT"; future GPT/LLM detectors emit similar names). Without
    // these we'd fall through to the human-label inverse, which only
    // works when the OTHER label is recognized as human.
    l.includes("chatgpt") ||
    l.includes("gpt") ||
    l.includes("llm") ||
    l.includes("machine") ||
    l.includes("bot") ||
    l === "label_1" ||
    l === "1"
  );
}

function isHumanLabel(label: string): boolean {
  const l = label.toLowerCase();
  return (
    l.includes("real") ||
    l.includes("human") ||
    l.includes("authentic") ||
    l.includes("genuine") ||
    l === "label_0" ||
    l === "0"
  );
}
