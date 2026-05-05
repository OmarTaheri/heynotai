import type { ScanType } from "./scan-types";

const VIDEO_HOSTS = [
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "tiktok.com",
];
const IMAGE_HOSTS = [
  "imgur.com",
  "i.imgur.com",
  "unsplash.com",
  "cdn.pixabay.com",
];
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg"];
const VIDEO_EXTS = [".mp4", ".webm", ".mov", ".m4v", ".ogg"];
const AUDIO_EXTS = [".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"];

/** Best-effort URL → ScanType. Falls back to `web` for arbitrary pages. */
export function inferTypeFromUrl(raw: string): ScanType {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "web";
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.toLowerCase();

  if (VIDEO_HOSTS.some((h) => host === h || host.endsWith("." + h))) return "vid";
  if (IMAGE_HOSTS.some((h) => host === h || host.endsWith("." + h))) return "img";

  if (IMAGE_EXTS.some((e) => path.endsWith(e))) return "img";
  if (VIDEO_EXTS.some((e) => path.endsWith(e))) return "vid";
  if (AUDIO_EXTS.some((e) => path.endsWith(e))) return "aud";

  return "web";
}

/** MIME → ScanType. PDFs and text/* both map to txt because the editor
 *  already renders text content; PDFs would need a viewer addition. */
export function typeFromMime(mime: string): ScanType {
  if (!mime) return "txt";
  if (mime.startsWith("image/")) return "img";
  if (mime.startsWith("audio/")) return "aud";
  if (mime.startsWith("video/")) return "vid";
  if (mime.startsWith("text/") || mime === "application/pdf") return "txt";
  return "txt";
}
