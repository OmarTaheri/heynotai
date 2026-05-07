import type { ScanType } from "@/components/ui/TypeChip";
import type { Origin } from "@/components/ui/OriginBadge";
import type { Scan, ScanStatus } from "./scan-types";
import {
  deriveItemMeta,
  isSocialType,
  stripExtFromTitle,
  type ItemMetaCollection,
  type ItemMetaLink,
  type ItemMetaParts,
} from "./item-meta";

export { formatBytes, formatDuration } from "./item-meta";

export type LibraryItem = {
  id: string;
  type: ScanType;
  name: string;
  origin: Origin;
  meta: ItemMetaParts;
  /** When set, the row's meta line becomes a clipboard-copy button on
   *  social subtypes. The full URL is what gets copied. */
  link?: ItemMetaLink;
  confidence: number;
  /** Unified AI-generated probability 0-100. Carried alongside
   *  `confidence` so downstream surfaces (collection detail table) can
   *  read the AI signal directly. Optional so legacy mock arrays don't
   *  have to be back-filled. */
  aiPct?: number;
  model: string;
  /** Engine slug from `Scan.engineId`, forwarded so callers can map to
   *  a display name without re-querying the scan. */
  engineId?: string;
  when: string;
  /** Raw ISO timestamp (`scan.created`). The library Date filter uses
   *  this to bucket rows into Today / Last 7 / Last 30 without having
   *  to re-parse `when` (the formatted relative string). Optional so
   *  legacy mock rows that only carry `when` don't need backfill. */
  whenIso?: string;
  /** Backend lifecycle status. Drives the in-flight "Scanning…" pill
   *  on the row. `undefined` on legacy mock data; treated as `done`
   *  by row renderers. */
  status?: ScanStatus;
};

export type OriginTabKey =
  | "all"
  | "up"
  | "ext"
  | "url"
  | "paste"
  | "mon";

export type OriginTabSpec = {
  key: OriginTabKey;
  label: string;
  /** Marks the surface as gated — drives the lock icon. The tab still
   *  filters normally; the icon just signals parity with the gated
   *  /app/<surface> page. */
  locked?: boolean;
};

/** Tab labels + locked flag. Counts are derived from the rendered data
 *  on the page so they stay honest. */
export const ORIGIN_TABS: OriginTabSpec[] = [
  { key: "all", label: "All" },
  { key: "up", label: "Uploads" },
  { key: "ext", label: "Extension" },
  { key: "url", label: "URLs" },
  { key: "paste", label: "Pasted" },
  { key: "mon", label: "Monitors", locked: true },
];

/** Sub-tabs inside Uploads. Same visual language as ORIGIN_TABS. */
export type UploadSubTabKey = "all" | "img" | "vid" | "aud";

export const UPLOAD_SUBTABS: { key: UploadSubTabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "img", label: "Image" },
  { key: "vid", label: "Video" },
  { key: "aud", label: "Audio" },
];

/** Human-readable labels for every supported content type. Keep in sync
 *  with `ScanType` in `components/ui/TypeChip.tsx`. */
export const TYPE_LABELS: Record<ScanType, string> = {
  txt: "Text",
  img: "Image",
  aud: "Audio",
  vid: "Video",
  web: "Website",
  soc: "Social post",
  "fb-vid": "Facebook video",
  "fb-reel": "Facebook reel",
  "fb-post": "Facebook post",
  "ig-reel": "Instagram reel",
  "ig-post-img": "Instagram post · image",
  "ig-post-vid": "Instagram post · video",
  "yt-vid": "YouTube video",
  "yt-reel": "YouTube short",
};

/** Map a saved Scan record into the row shape the existing library +
 *  activity tables expect. Pass `collection` (title + optional href)
 *  when the scan's parent collection is known so the meta line can
 *  render it as an internal link to the collection detail page. */
export function scanToLibraryItem(
  scan: Scan,
  opts: { collection?: ItemMetaCollection } = {},
): LibraryItem {
  const type = scan.subtype ? (scan.subtype as ScanType) : (scan.type as ScanType);
  const origin = scanOriginToBadge(scan.origin);
  const parts = deriveItemMeta(scan, { collection: opts.collection });
  const link =
    isSocialType(type) && scan.sourceUrl
      ? ({ url: scan.sourceUrl } satisfies ItemMetaLink)
      : undefined;
  const title = stripExtFromTitle(scan.title || "Untitled scan", parts.ext);

  return {
    id: scan.id,
    type,
    name: title,
    origin,
    meta: parts,
    link,
    confidence: Math.round(scan.confidence),
    aiPct: Math.round(scan.aiPct ?? 0),
    model: scan.model || "—",
    engineId: scan.engineId || "",
    when: formatRelative(scan.created),
    whenIso: scan.created || undefined,
    status: scan.status,
  };
}

function scanOriginToBadge(origin: Scan["origin"]): Origin {
  switch (origin) {
    case "paste":
      return "paste";
    case "link":
    case "url":
      return "url";
    case "upload":
    case "record":
      return "up";
    case "ext":
      return "ext";
    case "mon":
      return "mon";
    default:
      return "up";
  }
}

export function formatRelative(iso: string): string {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "—";
  const delta = Date.now() - ts;
  const sec = Math.round(delta / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(day / 365)}y ago`;
}

