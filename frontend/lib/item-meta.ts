import type { ScanType } from "@/components/ui/TypeChip";
import type { Scan } from "./scan-types";

export type ItemMetaCollection = {
  title: string;
  /** When set, the collection segment in the meta line renders as an
   *  internal link to this href and stops row-click propagation. */
  href?: string;
};

export type ItemMetaParts = {
  size?: string;
  length?: string;
  ext?: string;
  resolution?: string;
  wordCount?: string;
  domain?: string;
  pathTail?: string;
  socialFormat?: string;
  socialId?: string;
  collection?: ItemMetaCollection;
  /** First ~140 chars of pasted text. Lets the Pasted tab show the
   *  actual content in place of a filename-style title. Demo-only for
   *  now; real paste scans put the full text in `scan.content`. */
  textPreview?: string;
};

export type ItemMetaLink = { url: string };

const SOCIAL_TYPES = new Set<ScanType>([
  "soc",
  "fb-vid",
  "fb-reel",
  "fb-post",
  "ig-reel",
  "ig-post-img",
  "ig-post-vid",
  "yt-vid",
  "yt-reel",
]);

export function isSocialType(type: ScanType): boolean {
  return SOCIAL_TYPES.has(type);
}

const SOCIAL_FORMAT_BY_TYPE: Partial<Record<ScanType, string>> = {
  "fb-vid": "video",
  "fb-reel": "reel",
  "fb-post": "post",
  "ig-reel": "reel",
  "ig-post-img": "post",
  "ig-post-vid": "post",
  "yt-vid": "video",
  "yt-reel": "short",
};

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const MIME_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/flac": "flac",
  "audio/aac": "aac",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/html": "html",
  "text/csv": "csv",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/rtf": "rtf",
};

export function extFromMime(mime: string | undefined | null): string | undefined {
  if (!mime) return undefined;
  const normalized = mime.toLowerCase().split(";")[0]?.trim();
  if (!normalized) return undefined;
  if (MIME_EXT[normalized]) return MIME_EXT[normalized];
  const tail = normalized.split("/")[1];
  if (!tail) return undefined;
  const cleaned = tail.replace(/^x-/, "").replace(/\+.*$/, "");
  return cleaned.length <= 5 ? cleaned : undefined;
}

export function extFromFilename(name: string | undefined | null): string | undefined {
  if (!name) return undefined;
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return undefined;
  const candidate = name.slice(dot + 1).toLowerCase();
  if (!/^[a-z0-9]{1,5}$/.test(candidate)) return undefined;
  return candidate;
}

export function stripExtFromTitle(title: string, ext?: string): string {
  if (!title || !ext) return title;
  const lower = title.toLowerCase();
  const suffix = `.${ext.toLowerCase()}`;
  return lower.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}

export function splitWebUrl(url: string | undefined | null): {
  domain?: string;
  pathTail?: string;
} {
  if (!url) return {};
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return {};
  }
  const domain = parsed.hostname.replace(/^www\./, "") || undefined;
  const segments = parsed.pathname.split("/").filter(Boolean);
  const pathTail = segments.length > 0 ? segments[segments.length - 1] : undefined;
  return { domain, pathTail };
}

export function lastUrlSegment(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return undefined;
  }
  const search = parsed.searchParams;
  if (search.has("v")) return search.get("v") ?? undefined;
  const segments = parsed.pathname.split("/").filter(Boolean);
  return segments[segments.length - 1];
}

type DerivableScan = Pick<
  Scan,
  | "type"
  | "subtype"
  | "sizeBytes"
  | "durationMs"
  | "wordCount"
  | "mimeType"
  | "sourceUrl"
  | "file"
  | "analysis"
>;

export function deriveItemMeta(
  scan: DerivableScan,
  opts: { collection?: ItemMetaCollection } = {},
): ItemMetaParts {
  const type: ScanType = (scan.subtype as ScanType) || (scan.type as ScanType);
  const parts: ItemMetaParts = {};
  const analysis = (scan.analysis ?? null) as Record<string, unknown> | null;

  if (type === "img") {
    const w = pickNumber(analysis, "width");
    const h = pickNumber(analysis, "height");
    if (w && h) parts.size = `${w} × ${h}`;
    else if (scan.sizeBytes > 0) parts.size = formatBytes(scan.sizeBytes);
  } else if (type === "aud") {
    if (scan.durationMs > 0) parts.length = formatDuration(scan.durationMs);
    parts.ext = extFromMime(scan.mimeType) ?? extFromFilename(scan.file);
  } else if (type === "vid") {
    if (scan.durationMs > 0) parts.length = formatDuration(scan.durationMs);
    const res = pickString(analysis, "resolution");
    if (res) parts.resolution = res;
  } else if (type === "txt") {
    if (scan.wordCount > 0) {
      parts.wordCount = `${scan.wordCount.toLocaleString()} words`;
    }
    parts.ext = extFromMime(scan.mimeType) ?? extFromFilename(scan.file);
  } else if (type === "web") {
    const { domain, pathTail } = splitWebUrl(scan.sourceUrl);
    parts.domain = domain;
    parts.pathTail = pathTail;
  } else if (isSocialType(type)) {
    parts.socialFormat = SOCIAL_FORMAT_BY_TYPE[type] ?? "post";
    parts.socialId = lastUrlSegment(scan.sourceUrl);
  }

  if (opts.collection?.title) parts.collection = opts.collection;
  return parts;
}

function pickString(
  source: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const v = source?.[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function pickNumber(
  source: Record<string, unknown> | null | undefined,
  key: string,
): number | undefined {
  const v = source?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function metaSegments(type: ScanType, parts: ItemMetaParts): string[] {
  const segments: (string | undefined)[] = [];
  if (type === "img") {
    segments.push(parts.size);
  } else if (type === "aud") {
    segments.push(parts.length, parts.ext);
  } else if (type === "vid") {
    segments.push(parts.length, parts.resolution);
  } else if (type === "txt") {
    segments.push(parts.wordCount, parts.ext);
  } else if (type === "web") {
    segments.push(parts.domain, parts.pathTail);
  } else if (isSocialType(type)) {
    segments.push(parts.socialFormat, parts.socialId);
  }
  if (parts.collection?.title) segments.push(parts.collection.title);
  return segments.filter((s): s is string => Boolean(s && s.length));
}

export function flattenItemMeta(type: ScanType, parts: ItemMetaParts): string {
  return metaSegments(type, parts).join(" · ");
}
