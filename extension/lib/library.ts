import type { Scan, ScanOrigin, ScanStatus, ScanType } from './scans-api';

export type Origin = 'ext' | 'up' | 'url' | 'mon' | 'paste';

export interface ItemMetaParts {
  size?: string;
  length?: string;
  ext?: string;
  resolution?: string;
  wordCount?: string;
  domain?: string;
  pathTail?: string;
  socialFormat?: string;
  socialId?: string;
}

export interface LibraryRowItem {
  id: string;
  type: ScanType;
  name: string;
  origin: Origin;
  meta: ItemMetaParts;
  link?: string;
  confidence: number;
  verdict: 'human' | 'ai' | 'mixed' | 'unknown';
  model: string;
  when: string;
  // Backend lifecycle. Rows with `queued`/`scanning` render an animated
  // "Scanning…" pill instead of the confidence bar so the user can see
  // an in-flight scan as soon as the extension creates the record.
  // Optional so legacy mock rows (CONTENT_ITEMS) don't need backfill.
  status?: ScanStatus;
}

const SOCIAL_TYPES = new Set<ScanType>([
  'soc',
  'fb-vid', 'fb-reel', 'fb-post',
  'ig-reel', 'ig-post-img', 'ig-post-vid',
  'yt-vid', 'yt-reel',
]);

export function isSocialType(t: ScanType): boolean {
  return SOCIAL_TYPES.has(t);
}

const SOCIAL_FORMAT_BY_TYPE: Partial<Record<ScanType, string>> = {
  'fb-vid': 'video',
  'fb-reel': 'reel',
  'fb-post': 'post',
  'ig-reel': 'reel',
  'ig-post-img': 'post',
  'ig-post-vid': 'post',
  'yt-vid': 'video',
  'yt-reel': 'short',
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function lastUrlSegment(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  let parsed: URL;
  try { parsed = new URL(withScheme); } catch { return undefined; }
  const search = parsed.searchParams;
  if (search.has('v')) return search.get('v') ?? undefined;
  const segments = parsed.pathname.split('/').filter(Boolean);
  return segments[segments.length - 1];
}

function splitWebUrl(url: string | undefined | null): {
  domain?: string; pathTail?: string;
} {
  if (!url) return {};
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  let parsed: URL;
  try { parsed = new URL(withScheme); } catch { return {}; }
  const domain = parsed.hostname.replace(/^www\./, '') || undefined;
  const segments = parsed.pathname.split('/').filter(Boolean);
  const pathTail = segments.length > 0 ? segments[segments.length - 1] : undefined;
  return { domain, pathTail };
}

function pickString(src: Record<string, unknown> | null | undefined, key: string) {
  const v = src?.[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function pickNumber(src: Record<string, unknown> | null | undefined, key: string) {
  const v = src?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function originToBadge(origin: ScanOrigin): Origin {
  switch (origin) {
    case 'paste': return 'paste';
    case 'link': case 'url': return 'url';
    case 'upload': case 'record': return 'up';
    case 'ext': return 'ext';
    case 'mon': return 'mon';
    default: return 'up';
  }
}

function deriveMeta(scan: Scan, type: ScanType): ItemMetaParts {
  const parts: ItemMetaParts = {};
  const analysis = (scan.analysis ?? null) as Record<string, unknown> | null;
  if (type === 'img') {
    const w = pickNumber(analysis, 'width');
    const h = pickNumber(analysis, 'height');
    if (w && h) parts.size = `${w} × ${h}`;
    else if (scan.sizeBytes > 0) parts.size = formatBytes(scan.sizeBytes);
  } else if (type === 'aud') {
    if (scan.durationMs > 0) parts.length = formatDuration(scan.durationMs);
  } else if (type === 'vid') {
    if (scan.durationMs > 0) parts.length = formatDuration(scan.durationMs);
    const res = pickString(analysis, 'resolution');
    if (res) parts.resolution = res;
  } else if (type === 'txt') {
    if (scan.wordCount > 0) parts.wordCount = `${scan.wordCount.toLocaleString()} words`;
  } else if (type === 'web') {
    const { domain, pathTail } = splitWebUrl(scan.sourceUrl);
    parts.domain = domain;
    parts.pathTail = pathTail;
  } else if (isSocialType(type)) {
    parts.socialFormat = SOCIAL_FORMAT_BY_TYPE[type] ?? 'post';
    parts.socialId = lastUrlSegment(scan.sourceUrl);
  }
  return parts;
}

export function metaSegments(type: ScanType, parts: ItemMetaParts): string[] {
  const out: (string | undefined)[] = [];
  if (type === 'img') out.push(parts.size);
  else if (type === 'aud') out.push(parts.length, parts.ext);
  else if (type === 'vid') out.push(parts.length, parts.resolution);
  else if (type === 'txt') out.push(parts.wordCount, parts.ext);
  else if (type === 'web') out.push(parts.domain, parts.pathTail);
  else if (isSocialType(type)) out.push(parts.socialFormat, parts.socialId);
  return out.filter((s): s is string => Boolean(s && s.length));
}

export function formatRelative(iso: string): string {
  if (!iso) return '—';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '—';
  const delta = Date.now() - ts;
  const sec = Math.round(delta / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(day / 365)}y ago`;
}

export function scanToRow(scan: Scan): LibraryRowItem {
  const type: ScanType = (scan.subtype as ScanType) || (scan.type as ScanType);
  const meta = deriveMeta(scan, type);
  const link = isSocialType(type) && scan.sourceUrl ? scan.sourceUrl : undefined;
  return {
    id: scan.id,
    type,
    name: scan.title || 'Untitled scan',
    origin: originToBadge(scan.origin),
    meta,
    link,
    confidence: Math.round(scan.confidence),
    verdict: scan.verdict,
    model: scan.model || '—',
    when: formatRelative(scan.created),
    status: scan.status,
  };
}
