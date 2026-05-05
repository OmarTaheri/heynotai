/* Audio deepfake detector backed by Modulate's Velma-2 synthetic voice
 * detection (batch).
 *
 *  Why Velma instead of HF: HF's free `hf-inference` provider does not
 *  host audio-classification models — calling MelodyMachine/* through
 *  it returns 400 "Model not supported by provider hf-inference". The
 *  alternatives are a paid HF Inference Endpoint (~$23/mo always-on
 *  CPU minimum) or a partner provider. Velma is currently #1 on the HF
 *  Speech Deepfake Arena (1.1% EER), prices at $0.25/hr of audio with
 *  free credits on signup, and is meaningfully cheaper than routing
 *  the same task through Replicate/fal-ai.
 *
 *  API shape (per Modulate's developer docs):
 *    POST https://modulate-developer-apis.com/api/velma-2-synthetic-voice-detection-batch
 *    Header: X-API-Key: <key>
 *    Body:   multipart/form-data, field name `upload_file`
 *    Accepts AAC, AIFF, FLAC, MOV, MP3, MP4, OGG, Opus, WAV, WebM.
 *
 *  Response (verified against a live call):
 *    {
 *      "filename": "...",
 *      "duration_ms": <number>,
 *      "frames": [
 *        { "start_time_ms": 0, "end_time_ms": 4000,
 *          "verdict": "real" | "fake" | "no-content" | ...,
 *          "confidence": 0..1 },
 *        ...
 *      ]
 *    }
 *  Per-window confidence is the model's confidence in the verdict it
 *  emitted (not P(AI)). We compute P(AI) per voiced window and take
 *  the maximum across the clip — a single high-confidence fake window
 *  should still trip the detector even if surrounding windows look
 *  real. `no-content` windows are silence/non-speech and ignored.
 *
 *  `VELMA_BASE_URL` and `VELMA_DETECT_PATH` env vars override the
 *  defaults so the operator can adjust without a code change. */

import {
  DetectorError,
  type DetectorInput,
  type DetectorResult,
  type DetectorVerdict,
  type ModelConfig,
} from "./types.js";

const DEFAULT_BASE_URL = "https://modulate-developer-apis.com";
const DEFAULT_DETECT_PATH = "/api/velma-2-synthetic-voice-detection-batch";
const FILE_FIELD = "upload_file";

export async function detect(
  input: DetectorInput,
  cfg: ModelConfig,
): Promise<DetectorResult> {
  if (input.kind !== "aud") {
    throw new DetectorError(400, "velma-audio only handles audio inputs");
  }
  if (!cfg.velmaApiKey) {
    throw new DetectorError(503, "velma_api_key_missing");
  }

  const baseUrl = (process.env.VELMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const path = process.env.VELMA_DETECT_PATH || DEFAULT_DETECT_PATH;
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const startedAt = Date.now();

  const form = new FormData();
  const blob = new Blob([new Uint8Array(input.bytes)], {
    type: input.mime || "application/octet-stream",
  });
  form.append(FILE_FIELD, blob, fileNameFor(input.mime));

  console.log(
    `[velma-audio] → POST ${url} (${input.bytes.byteLength} bytes, mime=${input.mime}, key=${redact(cfg.velmaApiKey)})`,
  );

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-Key": cfg.velmaApiKey,
      Accept: "application/json",
    },
    body: form,
  });

  const durationMs = Date.now() - startedAt;
  const text = await res.text();

  if (!res.ok) {
    console.warn(
      `[velma-audio] ← ${res.status} ${url} in ${durationMs}ms — ${preview(text, 400)}`,
    );
    throw new DetectorError(res.status, parseErrorMessage(text) || `velma_${res.status}`);
  }

  let parsed: VelmaResponse;
  try {
    parsed = JSON.parse(text) as VelmaResponse;
  } catch (err) {
    console.error(`[velma-audio] non-JSON response`, err, preview(text, 200));
    throw new DetectorError(502, "velma returned non-JSON response");
  }

  const collapsed = collapseFrames(parsed);
  console.log(
    `[velma-audio] ← ${res.status} ${url} in ${durationMs}ms ` +
      `frames=${parsed.frames?.length ?? 0} voiced=${collapsed.voicedCount} ` +
      `→ verdict=${collapsed.verdict} confidence=${collapsed.confidence}`,
  );

  return {
    verdict: collapsed.verdict,
    confidence: collapsed.confidence,
    model: "modulate-velma-deepfake",
    rawProviderResponse: parsed,
    durationMs,
  };
}

type VelmaFrame = {
  start_time_ms?: number;
  end_time_ms?: number;
  verdict?: string;
  confidence?: number;
};
type VelmaResponse = {
  filename?: string;
  duration_ms?: number;
  frames?: VelmaFrame[];
};

function collapseFrames(raw: VelmaResponse): {
  verdict: DetectorVerdict;
  confidence: number;
  voicedCount: number;
} {
  const frames = Array.isArray(raw.frames) ? raw.frames : [];
  // Drop windows Velma flagged as containing no speech — they carry no
  // deepfake signal and would dilute the aggregate.
  const voiced = frames.filter((f) => isVoiced(f.verdict));

  if (voiced.length === 0) {
    // Either silence or non-speech audio (e.g. music). No deepfake
    // signal means aiPct=0 — `verdict=human, confidence=100` so
    // `aiPctFromResult` (100 - confidence for human) returns 0, not
    // the inverted 100 we'd get with confidence=0.
    return { verdict: "human", confidence: 100, voicedCount: 0 };
  }

  // For each voiced frame, derive P(AI). `confidence` is Velma's
  // confidence in whichever verdict it picked, so:
  //   verdict=fake,  conf=0.9 → P(AI)=0.9
  //   verdict=real,  conf=0.9 → P(AI)=0.1
  //   verdict unknown        → P(AI)=0 (don't influence)
  let maxPAi = 0;
  for (const f of voiced) {
    const c = clamp01(typeof f.confidence === "number" ? f.confidence : 0);
    const v = (f.verdict ?? "").toLowerCase();
    let pAi = 0;
    if (isAiVerdict(v)) pAi = c;
    else if (isHumanVerdict(v)) pAi = 1 - c;
    if (pAi > maxPAi) maxPAi = pAi;
  }

  const aiPct = Math.round(clamp01(maxPAi) * 100);
  let verdict: DetectorVerdict;
  if (aiPct >= 70) verdict = "ai";
  else if (aiPct >= 40) verdict = "mixed";
  else verdict = "human";
  const confidence = verdict === "human" ? 100 - aiPct : aiPct;
  return { verdict, confidence, voicedCount: voiced.length };
}

function isVoiced(verdict: string | undefined): boolean {
  if (!verdict) return false;
  const v = verdict.toLowerCase();
  // Anything Velma calls out as silence/non-speech we exclude.
  return v !== "no-content" && v !== "no_content" && v !== "silence" && v !== "no-speech";
}

function isAiVerdict(v: string): boolean {
  return (
    v.includes("fake") ||
    v.includes("synthetic") ||
    v.includes("deepfake") ||
    v.includes("ai") ||
    v.includes("generated") ||
    v.includes("tts") ||
    v.includes("clone")
  );
}

function isHumanVerdict(v: string): boolean {
  return (
    v.includes("real") ||
    v.includes("human") ||
    v.includes("authentic") ||
    v.includes("genuine") ||
    v.includes("natural")
  );
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function fileNameFor(mime: string): string {
  if (mime.includes("wav")) return "audio.wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "audio.mp3";
  if (mime.includes("ogg")) return "audio.ogg";
  if (mime.includes("flac")) return "audio.flac";
  if (mime.includes("webm")) return "audio.webm";
  if (mime.includes("m4a") || mime.includes("aac") || mime.includes("mp4")) return "audio.m4a";
  return "audio.bin";
}

function parseErrorMessage(text: string): string {
  if (!text) return "";
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    return (
      (typeof j.message === "string" && j.message) ||
      (typeof j.error === "string" && j.error) ||
      (typeof j.detail === "string" && j.detail) ||
      ""
    );
  } catch {
    return text.slice(0, 200);
  }
}

function preview(s: string, max: number): string {
  if (!s) return "(empty)";
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}… (+${flat.length - max} chars)` : flat;
}

function redact(key: string): string {
  if (!key) return "(missing!)";
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
