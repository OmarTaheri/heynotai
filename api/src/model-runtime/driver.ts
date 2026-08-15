import { resolveProviderCredential } from "./credentials.js";
import { buildModelRequest } from "./request-builder.js";
import { normalizeModelResponse } from "./response-mapper.js";
import {
  ModelRuntimeError,
  type CanonicalModelResult,
  type ProviderConfig,
  type RuntimeInput,
  type RuntimeModel,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_CONCURRENCY = 8;
const DEFAULT_REQUESTS_PER_MINUTE = 120;
const runtimeGates = new Map<string, RuntimeGate>();

export async function executeModel(
  providerValue: ProviderConfig,
  model: RuntimeModel,
  input: RuntimeInput,
  fetchImpl: typeof fetch = fetch,
): Promise<CanonicalModelResult> {
  const provider: ProviderConfig = {
    ...providerValue,
    credential: resolveProviderCredential(providerValue),
  };
  const built = buildModelRequest(provider, model, input);
  const timeoutMs = boundedInt(
    model.executionLimits?.timeoutMs,
    DEFAULT_TIMEOUT_MS,
    100,
    15 * 60_000,
  );
  const maxAttempts = boundedInt(model.executionLimits?.maxAttempts, 1, 1, 5);
  const maxConcurrency = boundedInt(
    model.executionLimits?.maxConcurrency,
    DEFAULT_MAX_CONCURRENCY,
    1,
    1_000,
  );
  const requestsPerMinute = boundedInt(
    model.executionLimits?.requestsPerMinute,
    DEFAULT_REQUESTS_PER_MINUTE,
    1,
    100_000,
  );
  const maxResponseBytes = boundedInt(
    model.executionLimits?.maxResponseBytes,
    DEFAULT_MAX_RESPONSE_BYTES,
    1024,
    20 * 1024 * 1024,
  );
  const startedAt = Date.now();
  let lastError: unknown;
  const gateKey = `${provider.id ?? provider.key}:${model.id ?? model.slug}`;
  const gate = runtimeGate(gateKey);
  const release = gate.acquireConcurrency(maxConcurrency);

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        // Retries are real provider calls and therefore consume RPM budget.
        gate.takeRateSlot(requestsPerMinute);
      const response = await fetchImpl(built.url, {
        method: built.method,
        headers: built.headers,
        body: built.body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const payload = await readBoundedResponse(response, maxResponseBytes);
      if (!response.ok) {
        const message = providerErrorMessage(payload) || response.statusText || "provider_error";
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        const error = new ModelRuntimeError(
          "provider_error",
          message,
          502,
          { providerStatus: response.status, retryable, attempt },
        );
        if (!retryable || attempt === maxAttempts) throw error;
        lastError = error;
        await backoff(attempt, response.headers.get("retry-after"));
        continue;
      }

        return normalizeModelResponse(payload, model.responseSpec, {
          model: model.externalModelId || model.slug,
          durationMs: Date.now() - startedAt,
        });
      } catch (error) {
        if (error instanceof ModelRuntimeError) {
          if (
            error.code !== "provider_error" ||
            error.status === 429 ||
            attempt === maxAttempts
          ) throw error;
        } else if (attempt === maxAttempts) {
          const message = error instanceof Error ? error.message : String(error);
          throw new ModelRuntimeError("provider_network_error", message, 502, { attempt });
        }
        lastError = error;
        await backoff(attempt);
      }
    }
  } finally {
    release();
  }

  throw lastError instanceof Error
    ? lastError
    : new ModelRuntimeError("provider_failed", "Provider request failed", 502);
}

class RuntimeGate {
  private inFlight = 0;
  private starts: number[] = [];

  constructor(private readonly key: string) {}

  acquireConcurrency(limit: number): () => void {
    if (this.inFlight >= limit) {
      throw new ModelRuntimeError(
        "model_concurrency_limit",
        `Model ${this.key} already has ${limit} request(s) in flight`,
        429,
        { limit },
      );
    }
    this.inFlight += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.inFlight = Math.max(0, this.inFlight - 1);
    };
  }

  takeRateSlot(limit: number, now = Date.now()): void {
    const cutoff = now - 60_000;
    this.starts = this.starts.filter((time) => time > cutoff);
    if (this.starts.length >= limit) {
      const retryAfterMs = Math.max(1, this.starts[0]! + 60_000 - now);
      throw new ModelRuntimeError(
        "model_rate_limit",
        `Model ${this.key} exceeded ${limit} provider request(s) per minute`,
        429,
        { limit, retryAfterMs },
      );
    }
    this.starts.push(now);
  }
}

function runtimeGate(key: string): RuntimeGate {
  let gate = runtimeGates.get(key);
  if (!gate) {
    // Model/provider keys come from a bounded admin registry. This guard also
    // prevents accidental unbounded growth if callers construct ad-hoc keys.
    if (runtimeGates.size >= 10_000) {
      throw new ModelRuntimeError(
        "model_gate_capacity",
        "Runtime gate capacity exceeded",
        503,
      );
    }
    gate = new RuntimeGate(key);
    runtimeGates.set(key, gate);
  }
  return gate;
}

async function readBoundedResponse(response: Response, limit: number): Promise<unknown> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > limit) {
    throw new ModelRuntimeError(
      "provider_response_too_large",
      `Provider response exceeds ${limit} bytes`,
      502,
    );
  }

  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel("response size limit");
      throw new ModelRuntimeError(
        "provider_response_too_large",
        `Provider response exceeds ${limit} bytes`,
        502,
      );
    }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
  if (!text.trim()) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json") || /^[\s]*[\[{]/.test(text)) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ModelRuntimeError(
        "provider_invalid_json",
        "Provider returned invalid JSON",
        502,
      );
    }
  }
  return text;
}

function providerErrorMessage(payload: unknown): string {
  if (typeof payload === "string") return payload.slice(0, 500);
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  for (const key of ["message", "error", "detail"]) {
    const value = record[key];
    if (typeof value === "string") return value.slice(0, 500);
    if (value && typeof value === "object" && typeof (value as { message?: unknown }).message === "string") {
      return String((value as { message: string }).message).slice(0, 500);
    }
  }
  return "";
}

async function backoff(attempt: number, retryAfter: string | null = null): Promise<void> {
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  const delay = Number.isFinite(seconds)
    ? Math.min(10_000, Math.max(0, seconds * 1000))
    : Math.min(5_000, 250 * 2 ** (attempt - 1));
  await new Promise<void>((resolve) => setTimeout(resolve, delay));
}

function boundedInt(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value!)));
}
