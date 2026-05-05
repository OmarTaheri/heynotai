import type { ScanType } from "@/components/ui/TypeChip";
import type { IconName } from "@/components/Icon";
import type { Origin } from "@/components/ui/OriginBadge";
import type { ItemMetaLink, ItemMetaParts } from "./item-meta";
import type { Scan } from "./scan-types";

export type CollectionTone =
  | "human"
  | "ai"
  | "mixed"
  | "info"
  | "gold"
  | "neutral";

export type CollectionPattern = "dots" | "grid" | "lines";

export type Collaborator = {
  initials: string;
  /** Resolved avatar URL when the collaborator has uploaded one. The
   *  detail page hero + member cards use this for the inline image
   *  fallback to initials when missing or broken. */
  avatarSrc?: string | null;
};

export type CollectionMember = {
  /** PocketBase row id for the `collection_members` join row. Empty
   *  when synthesized from a freshly-adapted owner row. */
  membershipId?: string;
  initials: string;
  name: string;
  /** "Owner" | "Editor" | "Viewer" */
  role: string;
  emailHandle: string;
  email?: string;
  avatarSrc?: string | null;
  you?: boolean;
};

export type CollectionRule = {
  id: string;
  icon: IconName;
  text: string;
  active: boolean;
};

/** A scan that lives in this collection. Lighter than LibraryItem — just
 *  the fields the detail-page table renders. */
export type CollectionItem = {
  id: string;
  /** Underlying scan id — used to call `deleteScan()` in the bulk
   *  Delete action. */
  scanId?: string;
  type: ScanType;
  name: string;
  origin: Origin;
  meta: ItemMetaParts;
  link?: ItemMetaLink;
  confidence: number;
  /** Unified AI-generated probability 0-100 — what the table displays
   *  next to the verdict badge. */
  aiPct?: number;
  model: string;
  /** Human-readable detector engine name — what the "Detector" column
   *  shows. */
  detector?: string;
  when: string;
  /** Underlying scan status — drives the "graded vs pending" KPI on the
   *  detail page. */
  status?: Scan["status"];
  /** ISO timestamp of the most recent scan event (completion if done,
   *  otherwise creation). Used to compute "Last scanned". */
  whenIso?: string;
  /** Tokens charged for this scan (mirrors `scan.creditsUsed`). Summed
   *  by the detail-page "Tokens used" KPI. */
  tokensUsed?: number;
};

export type Collection = {
  id: string;
  /** URL-safe slug used in the route (`/app/collections/[slug]`). */
  slug: string;
  title: string;
  description: string;
  tone: CollectionTone;
  pattern: CollectionPattern;
  /** Cover thumbnail strip (3–4 type tiles). */
  thumbs: ScanType[];
  extraCount?: number;
  itemCount: number;
  flagged: number;
  /** 0–100 whole-number percent. */
  aiRate: number;
  /** Avg confidence for the whole collection (0–100). */
  avgConfidence: number;
  topModel: string;
  topModelHits: number;
  graded: number;
  pending: number;
  created: string;
  updated: string;
  pinned?: boolean;
  /** True when the current viewer owns this collection — controls
   *  whether the pin button + destructive actions render. */
  isOwner?: boolean;
  collaborators: Collaborator[];
  members: CollectionMember[];
  rules: CollectionRule[];
  items: CollectionItem[];
};

type AdaptUser = {
  id: string;
  initials: string;
  displayName: string;
  email: string;
  avatarSrc: string | null;
};

type AdaptRecord = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  tone: CollectionTone;
  pattern: CollectionPattern;
  pinned?: boolean;
  created: string;
  updated: string;
  /** PB id of the user who owns this collection. Used to detect when
   *  the current viewer is an accepted member rather than the owner —
   *  in that case we shouldn't render their own avatar as "Owner". */
  userId?: string;
};

/** Public profile fields used to synthesize the Owner row when the
 *  collection's owner isn't the current user (i.e. we're an accepted
 *  member viewing it). When omitted, the Owner row falls back to a
 *  placeholder until a lookup completes. */
export type OwnerProfile = {
  id: string;
  name: string;
  handle: string;
  email: string;
  avatarUrl: string | null;
};

const DEFAULT_RULES: CollectionRule[] = [
  {
    id: "rd1",
    icon: "eye",
    text: "Auto-add scans tagged with this collection",
    active: true,
  },
  {
    id: "rd2",
    icon: "refresh",
    text: "Re-scan when new model ships",
    active: false,
  },
];

/**
 * Shape a PocketBase `collections` record into the rich `Collection`
 * type the detail page renders. Items + stats are empty until the
 * caller fans out to the `collection_items` join.
 *
 * Ownership: if `owner` is provided we render that profile as the
 * Owner row; otherwise we synthesize from the current user *only when*
 * the record's `userId` matches them. For accepted members viewing a
 * shared collection, we render a neutral "Owner" placeholder and let
 * the caller refill it once the user lookup resolves.
 */
export function adaptCollectionRecord(
  record: AdaptRecord,
  user: AdaptUser,
  owner?: OwnerProfile | null,
): Collection {
  const youAreOwner = !record.userId || record.userId === user.id;
  const ownerMember = ownerRow(record, user, owner, youAreOwner);
  const collaborators: Collaborator[] = [
    { initials: ownerMember.initials, avatarSrc: ownerMember.avatarSrc },
  ];
  const members: CollectionMember[] = [ownerMember];

  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description ?? "",
    tone: record.tone,
    pattern: record.pattern,
    thumbs: [],
    itemCount: 0,
    flagged: 0,
    aiRate: 0,
    avgConfidence: 0,
    topModel: "—",
    topModelHits: 0,
    graded: 0,
    pending: 0,
    created: formatDate(record.created),
    updated: `Updated ${formatRelative(record.updated)}`,
    pinned: Boolean(record.pinned),
    isOwner: youAreOwner,
    collaborators,
    members,
    rules: DEFAULT_RULES,
    items: [],
  };
}

function ownerRow(
  record: AdaptRecord,
  user: AdaptUser,
  owner: OwnerProfile | null | undefined,
  youAreOwner: boolean,
): CollectionMember {
  if (youAreOwner) {
    const emailLocal =
      user.email.split("@")[0] ?? user.displayName.toLowerCase();
    return {
      initials: user.initials,
      name: user.displayName,
      role: "Owner",
      emailHandle: `${emailLocal}@`,
      email: user.email,
      avatarSrc: user.avatarSrc,
      you: true,
    };
  }
  if (owner) {
    const display =
      owner.handle.trim() ||
      owner.name.trim() ||
      owner.email.split("@")[0] ||
      "Owner";
    const emailLocal = owner.email ? owner.email.split("@")[0] ?? "" : "";
    return {
      initials: deriveInitials(display) || (owner.email[0] ?? "U").toUpperCase(),
      name: display,
      role: "Owner",
      emailHandle: emailLocal ? `${emailLocal}@` : "",
      email: owner.email,
      avatarSrc: owner.avatarUrl,
      you: false,
    };
  }
  // Placeholder used during the brief window between the collection
  // record loading and the owner-profile lookup resolving.
  return {
    initials: "··",
    name: "Owner",
    role: "Owner",
    emailHandle: "",
    avatarSrc: null,
    you: false,
  };
}

function deriveInitials(seed: string): string {
  const parts = seed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "just now";
  const diffSec = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (diffSec < 30) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}d ago`;
  return formatDate(iso);
}
