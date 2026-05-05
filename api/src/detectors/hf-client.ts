/* Thin wrapper around the Hugging Face Inference API.
 *
 *  HF migrated from the legacy `api-inference.huggingface.co/models/<id>`
 *  endpoint to the Inference Providers router at
 *  `router.huggingface.co/hf-inference/models/<id>` (rolled out 2025).
 *  The old URL now returns Express's "Cannot POST /models/..." 404, which
 *  is exactly the failure mode this codebase hit. Pin the new base.
 *
 *  Token requirement: HF token needs "Make calls to Inference Providers"
 *  permission (settings → tokens → fine-grained → Inference Providers).
 *  Old read-only tokens will 401 here.
 *
 *  Free-tier behavior: the first request after a model goes cold
 *  returns 503 with `{ estimated_time }` and the body says the model
 *  is loading. We retry-with-backoff up to ~30s, then surface the
 *  failure as a `DetectorError` so the caller can return 502 with the
 *  provider's message instead of pretending the scan succeeded.
 *
 *  Verbose logging on every request — the user-facing failure modes
 *  here are HF's, so we want the actual wire details (status, body
 *  preview, model id) in the api log when something goes wrong. */

import { DetectorError } from "./types.js";

const HF_BASE = "https://router.huggingface.co/hf-inference/models";
const MAX_RETRY_MS = 30_000;
const RETRY_STEP_MS = 2_500;

/** Body types accepted by Node's fetch (which extends from undici). We
 *  pass either a JSON string or a `Uint8Array` of file bytes — both are
 *  natively supported. Avoids depending on the DOM lib for `BodyInit`. */
export type HfBody = string | Uint8Array;

export type HfRequest = {
  modelId: string;
  hfToken: string;
  body: HfBody;
  contentType?: string;
};

export async function hfInference({
  modelId,
  hfToken,
  body,
  contentType,
}: HfRequest): Promise<unknown> {
  const url = `${HF_BASE}/${modelId}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${hfToken}`,
    Accept: "application/json",
  };
  if (contentType) headers["Content-Type"] = contentType;

  const bodySize = typeof body === "string" ? body.length : body.byteLength;
  const bodyKind = typeof body === "string" ? "json" : "bytes";
  console.log(
    `[hf] → POST ${url} (${bodyKind}, ${bodySize} bytes, content-type=${contentType ?? "none"}, token=${redactToken(hfToken)})`,
  );
  if (bodyKind === "json") {
    console.log(`[hf]   payload: ${preview(body as string, 300)}`);
  }

  const startedAt = Date.now();
  let attempt = 0;
  while (true) {
    attempt += 1;
    const attemptStarted = Date.now();
    const res = await fetch(url, { method: "POST", headers, body });
    const elapsed = Date.now() - attemptStarted;

    if (res.ok) {
      const text = await res.text();
      console.log(
        `[hf] ← ${res.status} ${url} in ${elapsed}ms (attempt ${attempt}, body ${text.length} bytes)`,
      );
      console.log(`[hf]   response: ${preview(text, 500)}`);
      try {
        return JSON.parse(text) as unknown;
      } catch (err) {
        console.error(`[hf]   parse error:`, err, `raw: ${preview(text, 200)}`);
        throw new DetectorError(502, "hf returned non-JSON response");
      }
    }

    type HfErrorBody = { error?: string; estimated_time?: number; warnings?: string[] };
    let parsed: HfErrorBody | null = null;
    let rawText = "";
    try {
      rawText = await res.text();
      parsed = JSON.parse(rawText) as HfErrorBody;
    } catch {
      // not JSON — leave parsed null
    }

    console.warn(
      `[hf] ← ${res.status} ${url} in ${elapsed}ms (attempt ${attempt})`,
    );
    console.warn(`[hf]   error body: ${preview(rawText, 500)}`);

    const totalElapsed = Date.now() - startedAt;
    const isModelLoading =
      res.status === 503 &&
      typeof parsed?.estimated_time === "number" &&
      totalElapsed < MAX_RETRY_MS;

    if (isModelLoading) {
      const wait = Math.min(
        Math.max((parsed?.estimated_time ?? 0) * 1000, RETRY_STEP_MS),
        MAX_RETRY_MS - totalElapsed,
      );
      console.log(
        `[hf]   model loading on HF (estimated ${parsed?.estimated_time}s) — waiting ${wait}ms then retrying`,
      );
      await sleep(wait);
      continue;
    }

    const message = parsed?.error || rawText || res.statusText || "hf_error";
    throw new DetectorError(res.status, message);
  }
}

function preview(s: string, max: number): string {
  if (!s) return "(empty)";
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}… (+${flat.length - max} chars)` : flat;
}

function redactToken(token: string): string {
  if (!token) return "(missing!)";
  if (token.length <= 8) return "***";
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
