import { extractPath } from "./path.js";
import {
  ModelRuntimeError,
  parseResponseSpec,
  type Aggregation,
  type CanonicalModelResult,
  type CanonicalVerdict,
  type ResponseSpec,
  type ScoreScale,
} from "./types.js";

type ProbabilitySample = {
  probability: number;
  weight: number;
  label?: string;
};

const DEFAULT_AI_LABELS = [
  "fake",
  "ai",
  "generated",
  "synthetic",
  "deepfake",
  "chatgpt",
  "gpt",
  "llm",
  "machine",
  "bot",
  "label_1",
  "1",
];
const DEFAULT_HUMAN_LABELS = [
  "real",
  "human",
  "authentic",
  "genuine",
  "natural",
  "label_0",
  "0",
];

export function normalizeModelResponse(
  raw: unknown,
  specValue: ResponseSpec | unknown,
  options: { model?: string; durationMs?: number } = {},
): CanonicalModelResult {
  const spec = parseResponseSpec(specValue);
  let working = raw;

  if (spec.parseJsonAtPath) {
    const encoded = extractPath(working, spec.parseJsonAtPath, true);
    if (typeof encoded !== "string") {
      throw new ModelRuntimeError(
        "mapping_json_type",
        `parseJsonAtPath ${spec.parseJsonAtPath} did not resolve to a string`,
        422,
      );
    }
    try {
      working = JSON.parse(encoded) as unknown;
    } catch {
      throw new ModelRuntimeError(
        "mapping_json_parse",
        `Response value at ${spec.parseJsonAtPath} is not valid JSON`,
        422,
      );
    }
  }
  if (spec.rootPath) {
    working = extractPath(working, spec.rootPath, true);
  }

  const mapped = mapPreset(working, spec);
  const probability = clamp01(mapped.probability);
  const verdict = verdictForProbability(probability, spec);
  const confidence = verdict === "human" ? 1 - probability : probability;
  const modelAtPath = spec.modelPath
    ? extractPath(working, spec.modelPath)
    : undefined;

  return {
    verdict,
    confidence: percent(confidence),
    aiProbability: percent(probability),
    model:
      typeof modelAtPath === "string" && modelAtPath.trim()
        ? modelAtPath.trim()
        : options.model ?? "",
    rawProviderResponse: raw,
    durationMs: Math.max(0, Math.round(options.durationMs ?? 0)),
    diagnostics: {
      preset: spec.preset,
      samples: mapped.samples,
      aggregation: mapped.aggregation,
    },
  };
}

function mapPreset(
  root: unknown,
  spec: ResponseSpec,
): { probability: number; samples: number; aggregation: Aggregation } {
  switch (spec.preset) {
    case "classification-list":
      return mapClassifications(root, spec);
    case "scalar-score":
      return singleScore(root, spec);
    case "verdict":
      return singleVerdict(root, spec);
    case "segments":
      return mapSegments(root, spec);
    case "generic":
      return mapGeneric(root, spec);
  }
}

function mapClassifications(
  root: unknown,
  spec: ResponseSpec,
): { probability: number; samples: number; aggregation: Aggregation } {
  let value = extractPath(root, spec.itemsPath ?? "$", true);
  // Hugging Face can return either [{...}] or [[{...}]]. Flatten only a
  // single wrapper level; deeper ambiguity should fail rather than guess.
  if (Array.isArray(value) && value.length === 1 && Array.isArray(value[0])) {
    value = value[0];
  }
  const items = Array.isArray(value) ? value : [value];
  const aiSamples: ProbabilitySample[] = [];
  const humanSamples: ProbabilitySample[] = [];

  for (const item of items) {
    const labelRaw = extractPath(item, spec.labelPath ?? "label");
    const scoreRaw = extractPath(item, spec.scorePath ?? "score");
    if (typeof labelRaw !== "string" || !isNumeric(scoreRaw)) continue;
    const score = scaleScore(Number(scoreRaw), spec.scoreScale);
    const mapped = mapLabel(labelRaw, spec);
    if (mapped === "ai" || mapped === "mixed") {
      aiSamples.push({ probability: maybeInvert(score, spec), weight: 1, label: labelRaw });
    } else if (mapped === "human") {
      humanSamples.push({ probability: maybeInvert(1 - score, spec), weight: 1, label: labelRaw });
    }
  }

  const samples = aiSamples.length > 0 ? aiSamples : humanSamples;
  if (samples.length === 0) {
    throw new ModelRuntimeError(
      "mapping_labels_unrecognized",
      "No classification labels matched aiLabels, humanLabels, or verdictMap",
      422,
    );
  }
  const aggregation = spec.aggregation ?? (aiSamples.length > 0 ? "max-ai" : "min-ai");
  return {
    probability: aggregate(samples, aggregation),
    samples: samples.length,
    aggregation,
  };
}

function singleScore(
  root: unknown,
  spec: ResponseSpec,
): { probability: number; samples: number; aggregation: Aggregation } {
  const rawScore = extractPath(root, spec.aiScorePath ?? spec.scorePath ?? "$", true);
  if (!isNumeric(rawScore)) {
    throw new ModelRuntimeError("mapping_score_type", "Mapped score is not numeric", 422);
  }
  return {
    probability: maybeInvert(scaleScore(Number(rawScore), spec.scoreScale), spec),
    samples: 1,
    aggregation: "first",
  };
}

function singleVerdict(
  root: unknown,
  spec: ResponseSpec,
): { probability: number; samples: number; aggregation: Aggregation } {
  const rawVerdict = extractPath(root, spec.verdictPath ?? "$", true);
  if (typeof rawVerdict !== "string") {
    throw new ModelRuntimeError("mapping_verdict_type", "Mapped verdict is not a string", 422);
  }
  const verdict = mapLabel(rawVerdict, spec);
  if (!verdict || verdict === "ignore") {
    throw new ModelRuntimeError(
      "mapping_verdict_unknown",
      `Unrecognized provider verdict: ${rawVerdict}`,
      422,
    );
  }
  const confidenceRaw = spec.confidencePath
    ? extractPath(root, spec.confidencePath, true)
    : 1;
  if (!isNumeric(confidenceRaw)) {
    throw new ModelRuntimeError("mapping_confidence_type", "Mapped confidence is not numeric", 422);
  }
  const confidence = scaleScore(Number(confidenceRaw), spec.confidenceScale ?? spec.scoreScale);
  let probability =
    spec.scoreMeaning === "ai-probability"
      ? confidence
      : probabilityForVerdict(verdict, confidence);
  probability = maybeInvert(probability, spec);
  return { probability, samples: 1, aggregation: "first" };
}

function mapSegments(
  root: unknown,
  spec: ResponseSpec,
): { probability: number; samples: number; aggregation: Aggregation } {
  const itemsRaw = extractPath(root, spec.itemsPath ?? "segments", true);
  const items = Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw];
  const ignored = new Set((spec.ignoreVerdicts ?? []).map(normalizeLabel));
  const samples: ProbabilitySample[] = [];
  for (const item of items) {
    const rawVerdict = extractPath(item, spec.verdictPath ?? "verdict");
    if (typeof rawVerdict !== "string" || ignored.has(normalizeLabel(rawVerdict))) continue;
    const verdict = mapLabel(rawVerdict, spec);
    if (!verdict || verdict === "ignore") continue;
    const rawConfidence = extractPath(item, spec.confidencePath ?? "confidence");
    const confidence = isNumeric(rawConfidence)
      ? scaleScore(Number(rawConfidence), spec.confidenceScale ?? spec.scoreScale)
      : 1;
    const weightRaw = spec.weightPath ? extractPath(item, spec.weightPath) : 1;
    const weight = isNumeric(weightRaw) && Number(weightRaw) > 0 ? Number(weightRaw) : 1;
    const probability =
      spec.scoreMeaning === "ai-probability"
        ? confidence
        : probabilityForVerdict(verdict, confidence);
    samples.push({
      probability: maybeInvert(probability, spec),
      weight,
      label: rawVerdict,
    });
  }
  if (samples.length === 0) {
    // Silence/no-content contains no AI signal. This matches the existing
    // Velma adapter's behavior without treating missing data as 100% AI.
    return { probability: 0, samples: 0, aggregation: spec.aggregation ?? "max-ai" };
  }
  const aggregation = spec.aggregation ?? "max-ai";
  return {
    probability: aggregate(samples, aggregation),
    samples: samples.length,
    aggregation,
  };
}

function mapGeneric(
  root: unknown,
  spec: ResponseSpec,
): { probability: number; samples: number; aggregation: Aggregation } {
  if (spec.aiScorePath || spec.scorePath) return singleScore(root, spec);
  if (spec.verdictPath) return singleVerdict(root, spec);
  if (isPlainRecord(root)) {
    if (isNumeric(root.aiProbability)) {
      return {
        probability: scaleScore(Number(root.aiProbability), spec.scoreScale ?? "auto"),
        samples: 1,
        aggregation: "first",
      };
    }
    if (typeof root.verdict === "string") {
      return singleVerdict(root, {
        ...spec,
        verdictPath: "verdict",
        confidencePath:
          root.confidence === undefined ? undefined : "confidence",
      });
    }
  }
  throw new ModelRuntimeError(
    "mapping_generic_ambiguous",
    "Generic response needs aiScorePath, scorePath, verdictPath, aiProbability, or verdict",
    422,
  );
}

function mapLabel(
  raw: string,
  spec: ResponseSpec,
): CanonicalVerdict | "ignore" | undefined {
  const normalized = normalizeLabel(raw);
  const explicit = Object.entries(spec.verdictMap ?? {}).find(
    ([key]) => normalizeLabel(key) === normalized,
  )?.[1];
  if (explicit) return explicit;

  const mode = spec.labelMatch ?? "contains";
  const aiLabels = spec.aiLabels ?? DEFAULT_AI_LABELS;
  const humanLabels = spec.humanLabels ?? DEFAULT_HUMAN_LABELS;
  if (matchesAny(normalized, aiLabels, mode)) return "ai";
  if (matchesAny(normalized, humanLabels, mode)) return "human";
  if (normalized.includes("mixed") || normalized.includes("uncertain")) return "mixed";
  return undefined;
}

function matchesAny(
  normalized: string,
  candidates: string[],
  mode: "exact" | "contains",
): boolean {
  return candidates.some((candidate) => {
    const value = normalizeLabel(candidate);
    return mode === "exact" ? normalized === value : normalized.includes(value);
  });
}

function probabilityForVerdict(
  verdict: CanonicalVerdict,
  confidence: number,
): number {
  if (verdict === "human") return 1 - confidence;
  return confidence;
}

function aggregate(samples: ProbabilitySample[], kind: Aggregation): number {
  if (samples.length === 0) return 0;
  switch (kind) {
    case "max-ai":
      return Math.max(...samples.map((sample) => sample.probability));
    case "min-ai":
      return Math.min(...samples.map((sample) => sample.probability));
    case "mean":
      return samples.reduce((sum, sample) => sum + sample.probability, 0) / samples.length;
    case "weighted-mean": {
      const totalWeight = samples.reduce((sum, sample) => sum + sample.weight, 0);
      if (totalWeight <= 0) return 0;
      return samples.reduce(
        (sum, sample) => sum + sample.probability * sample.weight,
        0,
      ) / totalWeight;
    }
    case "first":
      return samples[0]!.probability;
    case "last":
      return samples[samples.length - 1]!.probability;
  }
}

function verdictForProbability(value: number, spec: ResponseSpec): CanonicalVerdict {
  const mixed = spec.thresholds?.mixed ?? 0.4;
  const ai = spec.thresholds?.ai ?? 0.7;
  if (value >= ai) return "ai";
  if (value >= mixed) return "mixed";
  return "human";
}

function scaleScore(value: number, scale: ScoreScale = "auto"): number {
  if (!Number.isFinite(value)) {
    throw new ModelRuntimeError("mapping_score_invalid", "Mapped score is not finite", 422);
  }
  if (typeof scale === "number") return clamp01(value * scale);
  if (scale === "percent") return clamp01(value / 100);
  if (scale === "fraction") return clamp01(value);
  return clamp01(Math.abs(value) > 1 ? value / 100 : value);
}

function maybeInvert(value: number, spec: ResponseSpec): number {
  return spec.invertScore ? 1 - clamp01(value) : clamp01(value);
}

function percent(value: number): number {
  return Math.round(clamp01(value) * 10_000) / 100;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "_");
}

function isNumeric(value: unknown): value is number | string {
  return (
    (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

