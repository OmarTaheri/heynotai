/* Wraps `yt-dlp` (system binary, must be installed alongside `ffmpeg`) so
 * the rest of the api can resolve a YouTube URL into a Buffer of video
 * bytes without coupling to a specific extractor library. ytdl-core/play-dl
 * break every few weeks when YouTube rotates ciphers; yt-dlp tracks those
 * upstream and is the more reliable choice in production.
 *
 * Two functions:
 *   - probeYoutubeDuration(url) — cheap metadata-only call, used by
 *     create.ts to charge per-minute token cost honestly before kicking
 *     off the full download.
 *   - downloadYoutubeVideo(url) — full download, capped at 360p / 80MB /
 *     10 minutes so a single scan can't blow the request budget. Returns
 *     bytes + mime + duration so run-detection.ts can stuff a fully-formed
 *     DetectorInput into the existing `vid` detector. */

import { spawn } from "node:child_process";
import { DetectorError } from "../detectors/types.js";

const DEFAULT_FORMAT = "best[height<=360][ext=mp4]/best[height<=360]/best";
const DEFAULT_MAX_FILESIZE = "80M";
const DEFAULT_MAX_DURATION_SEC = 600; // 10 minutes
const PROBE_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;

export interface YoutubeDownloadResult {
  bytes: Buffer;
  mime: string;
  durationSec: number;
}

export async function probeYoutubeDuration(url: string): Promise<number> {
  const out = await runYtDlp(
    ["--print", "duration", "--no-download", "--no-warnings", url],
    PROBE_TIMEOUT_MS,
  );
  const dur = Number.parseFloat(out.stdout.trim());
  if (!Number.isFinite(dur) || dur <= 0) {
    throw youtubeError(out.stderr, "duration_probe_failed");
  }
  return dur;
}

export async function downloadYoutubeVideo(
  url: string,
): Promise<YoutubeDownloadResult> {
  const durationSec = await probeYoutubeDuration(url).catch(() => {
    // Probe failure shouldn't block the download — yt-dlp will reject
    // its own --max-duration anyway. Fall through with 0 so the caller
    // can decide; the actual download will fail loudly if the video
    // is unsupported.
    return 0;
  });

  if (durationSec > 0 && durationSec > DEFAULT_MAX_DURATION_SEC) {
    throw new DetectorError(
      400,
      `youtube_too_long:${Math.round(durationSec)}s`,
    );
  }

  const result = await runYtDlp(
    [
      "-f",
      DEFAULT_FORMAT,
      "--max-filesize",
      DEFAULT_MAX_FILESIZE,
      "--no-warnings",
      "--no-playlist",
      "-o",
      "-",
      url,
    ],
    DOWNLOAD_TIMEOUT_MS,
    { collectStdoutBytes: true },
  );

  if (!result.stdoutBytes || result.stdoutBytes.length === 0) {
    throw youtubeError(result.stderr, "empty_download");
  }

  // yt-dlp writes the chosen format's container to stdout; default --format
  // here prefers mp4. We pass video/mp4 unless the stderr hints otherwise
  // (rare; webm fallback). The detector path doesn't really care — ffmpeg
  // sniffs the container during frame extraction — but we surface a real
  // mime onto the scan row for the activity table.
  const mime = inferMimeFromStderr(result.stderr);

  return {
    bytes: result.stdoutBytes,
    mime,
    durationSec,
  };
}

interface RunResult {
  stdout: string;
  stderr: string;
  stdoutBytes?: Buffer;
  exitCode: number;
}

function runYtDlp(
  args: string[],
  timeoutMs: number,
  opts: { collectStdoutBytes?: boolean } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    let proc;
    try {
      proc = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      reject(
        new DetectorError(
          500,
          `yt-dlp_not_installed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
      return;
    }

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout?.on("data", (chunk: Buffer) => {
      if (opts.collectStdoutBytes) stdoutChunks.push(chunk);
      else stdoutChunks.push(chunk);
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new DetectorError(504, "yt-dlp_timeout"));
    }, timeoutMs);

    proc.on("error", (err) => {
      clearTimeout(timer);
      // ENOENT = yt-dlp not installed. Surface that as a clear server
      // misconfiguration rather than a generic 500.
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        reject(new DetectorError(500, "yt-dlp_not_installed"));
        return;
      }
      reject(new DetectorError(500, `yt-dlp_spawn: ${err.message}`));
    });

    proc.on("close", (exitCode) => {
      clearTimeout(timer);
      const stdoutBuf = Buffer.concat(stdoutChunks);
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      const code = exitCode ?? 0;
      if (code !== 0) {
        reject(youtubeError(stderr, `yt-dlp_exit_${code}`));
        return;
      }
      resolve({
        stdout: opts.collectStdoutBytes ? "" : stdoutBuf.toString("utf8"),
        stderr,
        stdoutBytes: opts.collectStdoutBytes ? stdoutBuf : undefined,
        exitCode: code,
      });
    });
  });
}

function youtubeError(stderr: string, fallback: string): DetectorError {
  const lower = stderr.toLowerCase();
  if (lower.includes("private video")) return new DetectorError(403, "youtube_private");
  if (lower.includes("members-only") || lower.includes("members only"))
    return new DetectorError(403, "youtube_members_only");
  if (lower.includes("age") && lower.includes("restrict"))
    return new DetectorError(403, "youtube_age_restricted");
  if (lower.includes("not available in your country") || lower.includes("blocked"))
    return new DetectorError(451, "youtube_geoblocked");
  if (lower.includes("video unavailable")) return new DetectorError(404, "youtube_unavailable");
  if (lower.includes("sign in to confirm")) return new DetectorError(403, "youtube_login_required");
  return new DetectorError(400, fallback);
}

function inferMimeFromStderr(stderr: string): string {
  const m = stderr.match(/Destination:.*\.(mp4|webm|mkv|mov)/i);
  if (!m) return "video/mp4";
  const ext = m[1]!.toLowerCase();
  if (ext === "webm") return "video/webm";
  if (ext === "mkv") return "video/x-matroska";
  if (ext === "mov") return "video/quicktime";
  return "video/mp4";
}

export function isYoutubeUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    return (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be" ||
      host === "m.youtube.com"
    );
  } catch {
    return false;
  }
}
