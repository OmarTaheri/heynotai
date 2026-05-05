/* Video meta-detector. There's no good single open-source video AI
 * detector, so we fall back to the workflow the FaceOnLive HF Space
 * uses: extract N evenly-spaced frames with ffmpeg, classify each
 * frame against the configured image model, then aggregate.
 *
 * Aggregation: verdict = the dominant per-frame verdict by mass;
 * confidence = mean confidence of frames in the winning verdict.
 * `rawProviderResponse` is `{ perFrame: [{ frame, verdict, confidence, raw }] }`
 * so the audit trail keeps every classification. */

import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import ffmpeg from "fluent-ffmpeg";

import { runOnImage } from "./hf-image.js";
import {
  DetectorError,
  type DetectorInput,
  type DetectorResult,
  type DetectorVerdict,
  type ModelConfig,
  normalizeHfClassification,
  verdictFromLabels,
} from "./types.js";

const DEFAULT_FRAME_COUNT = 16;

export async function detect(
  input: DetectorInput,
  cfg: ModelConfig,
): Promise<DetectorResult> {
  if (input.kind !== "vid") {
    throw new DetectorError(400, "hf-video only handles video inputs");
  }
  if (!cfg.videoFrameModelId) {
    throw new DetectorError(
      500,
      "video model row missing videoFrameModelSlug — cannot pick frame classifier",
    );
  }

  const startedAt = Date.now();
  const frameCount = cfg.videoFrameCount ?? DEFAULT_FRAME_COUNT;

  const frames = await extractFrames(input.bytes, input.mime, frameCount);
  try {
    const perFrame: { frame: number; verdict: DetectorVerdict; confidence: number; raw: unknown }[] =
      [];
    for (let i = 0; i < frames.length; i++) {
      const raw = await runOnImage(frames[i], "image/jpeg", {
        hfToken: cfg.hfToken,
        hfModelId: cfg.videoFrameModelId,
      });
      const { verdict, confidence } = verdictFromLabels(normalizeHfClassification(raw));
      perFrame.push({ frame: i, verdict, confidence, raw });
    }

    const aggregate = aggregate_(perFrame);

    return {
      verdict: aggregate.verdict,
      confidence: aggregate.confidence,
      model: cfg.videoFrameModelId,
      rawProviderResponse: { perFrame },
      durationMs: Date.now() - startedAt,
    };
  } finally {
    // best-effort cleanup; frames live in a tmp dir we own.
  }
}

function aggregate_(
  perFrame: { verdict: DetectorVerdict; confidence: number }[],
): { verdict: DetectorVerdict; confidence: number } {
  if (perFrame.length === 0) return { verdict: "human", confidence: 0 };

  const counts: Record<DetectorVerdict, { n: number; sum: number }> = {
    human: { n: 0, sum: 0 },
    ai: { n: 0, sum: 0 },
    mixed: { n: 0, sum: 0 },
  };
  for (const f of perFrame) {
    counts[f.verdict].n += 1;
    counts[f.verdict].sum += f.confidence;
  }

  const winner = (Object.entries(counts) as [DetectorVerdict, { n: number; sum: number }][])
    .sort((a, b) => b[1].n - a[1].n)[0][0];
  const winnerStats = counts[winner];
  const confidence = winnerStats.n > 0 ? Math.round(winnerStats.sum / winnerStats.n) : 0;
  return { verdict: winner, confidence };
}

/** Write the upload to a tmp file, ask ffmpeg to dump N evenly-spaced
 *  JPEG frames, read them back as Buffers, then `rm -rf` the dir.
 *
 *  We probe duration first and pick frames at fixed timestamps via
 *  `fps=N/duration`. The previous approach used `select` with `N`
 *  (total-frame count) which isn't a valid variable in ffmpeg's
 *  select-filter scope — newer ffmpegs (8.x) fail with "Undefined
 *  constant" instead of silently producing zero frames. */
async function extractFrames(
  bytes: Buffer,
  mime: string,
  count: number,
): Promise<Buffer[]> {
  const ext = guessExt(mime);
  const dir = await mkdtemp(join(tmpdir(), "heynotai-vid-"));
  const inputPath = join(dir, `in.${ext}`);
  await writeFile(inputPath, bytes);

  try {
    const duration = await probeDuration(inputPath);
    // Spread `count` frames across the clip. For a 10s clip with
    // count=16 → fps=1.6, ~one frame every 0.625s.
    const fps = Math.max(0.1, count / Math.max(0.5, duration));

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          "-vf",
          `fps=${fps.toFixed(4)}`,
          "-frames:v",
          String(count),
          "-q:v",
          "3",
        ])
        .output(join(dir, "frame-%03d.jpg"))
        .on("end", () => resolve())
        .on("error", (err) => reject(new DetectorError(500, `ffmpeg: ${err.message}`)))
        .run();
    });

    const files = (await readdir(dir))
      .filter((f) => f.startsWith("frame-") && f.endsWith(".jpg"))
      .sort();
    if (files.length === 0) {
      throw new DetectorError(500, "ffmpeg produced no frames — input may be empty/corrupt");
    }
    const frames = await Promise.all(files.map((f) => readFile(join(dir, f))));
    return frames;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Returns clip length in seconds. Falls back to a 1s assumption if
 *  ffprobe can't read it (rare; means our `fps` ends up at `count` and
 *  we'll just take whatever ffmpeg gives us). */
function probeDuration(inputPath: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) return resolve(1);
      const dur = data?.format?.duration;
      resolve(typeof dur === "number" && dur > 0 ? dur : 1);
    });
  });
}

function guessExt(mime: string): string {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("quicktime") || mime.includes("mov")) return "mov";
  if (mime.includes("matroska") || mime.includes("mkv")) return "mkv";
  return "bin";
}
