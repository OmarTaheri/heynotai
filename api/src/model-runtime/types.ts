import { z } from "zod";

export const modelKinds = ["txt", "img", "aud", "vid"] as const;
export type ModelKind = (typeof modelKinds)[number];

export type RuntimeInput = {
  kind: ModelKind;
  text?: string;
  bytes?: Buffer | Uint8Array;
  mime?: string;
  fileName?: string;
  durationSec?: number;
  metadata?: Record<string, unknown>;
};

export type ProviderDriver =
  | "http"
  | "local-http"
  | "openai-compatible"
  | "huggingface"
  | "velma";

export type ProviderConfig = {
  id?: string;
  key: string;
  name?: string;
  driver: ProviderDriver;
  baseUrl: string;
  authScheme?: "none" | "bearer" | "api-key" | "x-api-key" | "basic";
  credential?: string;
  credentialCiphertext?: string | null;
  credentialHint?: string;
  enabled?: boolean;
  isLocal?: boolean;
  config?: Record<string, unknown>;
};

export type RequestBodyMode = "none" | "json" | "binary" | "multipart";

export type RequestSpec = {
  method?: "GET" | "POST" | "PUT" | "PATCH";
  /** Absolute URL or provider-relative path. Prefer `path` for managed providers. */
  url?: string;
  path?: string;
  bodyMode?: RequestBodyMode;
  contentType?: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  fields?: Record<string, unknown>;
  fileField?: string;
  fileName?: string;
};

export type Aggregation =
  | "max-ai"
  | "min-ai"
  | "mean"
  | "weighted-mean"
  | "first"
  | "last";

export type ResponsePreset =
  | "classification-list"
  | "scalar-score"
  | "verdict"
  | "segments"
  | "generic";

export type ScoreScale = "fraction" | "percent" | "auto" | number;

export type ResponseSpec = {
  preset: ResponsePreset;
  /** Optional path containing a JSON-encoded string that should be parsed first. */
  parseJsonAtPath?: string;
  rootPath?: string;
  itemsPath?: string;
  labelPath?: string;
  scorePath?: string;
  aiScorePath?: string;
  verdictPath?: string;
  confidencePath?: string;
  weightPath?: string;
  modelPath?: string;
  aiLabels?: string[];
  humanLabels?: string[];
  labelMatch?: "exact" | "contains";
  verdictMap?: Record<string, "ai" | "human" | "mixed" | "ignore">;
  ignoreVerdicts?: string[];
  scoreScale?: ScoreScale;
  confidenceScale?: ScoreScale;
  invertScore?: boolean;
  scoreMeaning?: "ai-probability" | "confidence-in-verdict";
  aggregation?: Aggregation;
  thresholds?: {
    mixed?: number;
    ai?: number;
  };
};

export type InputLimits = {
  maxBytes?: number;
  maxChars?: number;
  maxDurationSec?: number;
  allowedMimeTypes?: string[];
  allowedMimePrefixes?: string[];
};

export type ExecutionLimits = {
  timeoutMs?: number;
  maxAttempts?: number;
  maxConcurrency?: number;
  requestsPerMinute?: number;
  maxResponseBytes?: number;
};

export type RuntimeModel = {
  id?: string;
  slug: string;
  name?: string;
  type: ModelKind;
  externalModelId?: string;
  requestSpec: RequestSpec;
  responseSpec: ResponseSpec;
  inputLimits?: InputLimits;
  executionLimits?: ExecutionLimits;
  runtimeConfig?: Record<string, unknown>;
  configVersion?: number;
};

export type BuiltRequest = {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH";
  headers: Record<string, string>;
  body?: string | Uint8Array | FormData;
};

export type CanonicalVerdict = "human" | "ai" | "mixed";

export type CanonicalModelResult = {
  verdict: CanonicalVerdict;
  /** Confidence in the emitted verdict, on the legacy 0..100 scale. */
  confidence: number;
  /** Provider-independent probability of AI generation, 0..100. */
  aiProbability: number;
  model: string;
  rawProviderResponse: unknown;
  durationMs: number;
  diagnostics?: Record<string, unknown>;
};

const requestSpecSchema = z
  .object({
    method: z.enum(["GET", "POST", "PUT", "PATCH"]).optional(),
    url: z.string().max(2048).optional(),
    path: z.string().max(2048).optional(),
    bodyMode: z.enum(["none", "json", "binary", "multipart"]).optional(),
    contentType: z.string().max(200).optional(),
    headers: z.record(z.string()).optional(),
    query: z.record(z.unknown()).optional(),
    body: z.unknown().optional(),
    fields: z.record(z.unknown()).optional(),
    fileField: z.string().max(100).optional(),
    fileName: z.string().max(255).optional(),
  })
  .strict();

const responseSpecSchema = z
  .object({
    preset: z.enum([
      "classification-list",
      "scalar-score",
      "verdict",
      "segments",
      "generic",
    ]),
    parseJsonAtPath: z.string().max(512).optional(),
    rootPath: z.string().max(512).optional(),
    itemsPath: z.string().max(512).optional(),
    labelPath: z.string().max(512).optional(),
    scorePath: z.string().max(512).optional(),
    aiScorePath: z.string().max(512).optional(),
    verdictPath: z.string().max(512).optional(),
    confidencePath: z.string().max(512).optional(),
    weightPath: z.string().max(512).optional(),
    modelPath: z.string().max(512).optional(),
    aiLabels: z.array(z.string().max(100)).max(100).optional(),
    humanLabels: z.array(z.string().max(100)).max(100).optional(),
    labelMatch: z.enum(["exact", "contains"]).optional(),
    verdictMap: z
      .record(z.enum(["ai", "human", "mixed", "ignore"]))
      .optional(),
    ignoreVerdicts: z.array(z.string().max(100)).max(100).optional(),
    scoreScale: z.union([z.enum(["fraction", "percent", "auto"]), z.number()]).optional(),
    confidenceScale: z.union([z.enum(["fraction", "percent", "auto"]), z.number()]).optional(),
    invertScore: z.boolean().optional(),
    scoreMeaning: z.enum(["ai-probability", "confidence-in-verdict"]).optional(),
    aggregation: z
      .enum(["max-ai", "min-ai", "mean", "weighted-mean", "first", "last"])
      .optional(),
    thresholds: z
      .object({ mixed: z.number().min(0).max(1).optional(), ai: z.number().min(0).max(1).optional() })
      .strict()
      .optional(),
  })
  .strict();

export function parseRequestSpec(value: unknown): RequestSpec {
  return requestSpecSchema.parse(value);
}

export function parseResponseSpec(value: unknown): ResponseSpec {
  const parsed = responseSpecSchema.parse(value);
  const mixed = parsed.thresholds?.mixed ?? 0.4;
  const ai = parsed.thresholds?.ai ?? 0.7;
  if (mixed > ai) {
    throw new Error("response thresholds.mixed must be <= thresholds.ai");
  }
  return parsed;
}

export class ModelRuntimeError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 500,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ModelRuntimeError";
  }
}
