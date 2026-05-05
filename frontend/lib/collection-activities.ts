"use client";

import { type RecordModel } from "pocketbase";
import { pb } from "./pocketbase";

/** Dot-namespaced event types written into the `type` column. Keep
 *  literal — `formatActivity` switches on these. New events: add the
 *  literal here and a case in the switch. */
export type ActivityType =
  | "collection.created"
  | "collection.renamed"
  | "collection.description_edited"
  | "item.added"
  | "item.removed"
  | "item.tagged"
  | "member.invited"
  | "member.joined"
  | "member.role_changed"
  | "member.removed"
  | "share.visibility_changed";

/** Wire shape of a `collection_activities` row with the actor expand. */
export type CollectionActivityRecord = RecordModel & {
  collection: string;
  actor: string;
  type: string;
  payload: Record<string, unknown> | null;
  expand?: {
    actor?: RecordModel & {
      name?: string;
      handle?: string;
      email?: string;
      avatar?: string;
      avatarUrl?: string;
    };
  };
};

/** Adapted shape the panel + modal render. `you` is true when the
 *  actor is the currently signed-in user (so the line reads "You
 *  added …" instead of "Bilal added …"). */
export type CollectionActivity = {
  id: string;
  collectionId: string;
  actorId: string;
  actorName: string;
  actorInitials: string;
  actorAvatarSrc: string | null;
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  you: boolean;
};

export function adaptActivity(
  record: CollectionActivityRecord,
  currentUserId: string,
): CollectionActivity {
  const actor = record.expand?.actor;
  const email = actor?.email ?? "";
  const name =
    actor?.handle?.trim() ||
    actor?.name?.trim() ||
    (email ? email.split("@")[0] || email : "Someone");
  const avatarFile = actor?.avatar;
  const avatarUrlField = actor?.avatarUrl;
  const actorAvatarSrc = actor && avatarFile
    ? pb.files.getURL(actor, avatarFile)
    : avatarUrlField || null;
  const payload =
    record.payload && typeof record.payload === "object"
      ? (record.payload as Record<string, unknown>)
      : {};
  return {
    id: record.id,
    collectionId: record.collection,
    actorId: record.actor,
    actorName: name,
    actorInitials: deriveInitials(name) || (email[0] ?? "U").toUpperCase(),
    actorAvatarSrc,
    type: record.type,
    payload,
    createdAt: new Date(record.created as string),
    you: record.actor === currentUserId,
  };
}

/** Read the most recent activities for a collection. Sorted newest
 *  first. Default cap is 200 — enough to show a long history in the
 *  modal without paginating. */
export async function listActivities(
  collectionId: string,
  currentUserId: string,
  opts?: { limit?: number },
): Promise<CollectionActivity[]> {
  const limit = opts?.limit ?? 200;
  const result = await pb
    .collection("collection_activities")
    .getList<CollectionActivityRecord>(1, limit, {
      filter: pb.filter("collection = {:cid}", { cid: collectionId }),
      sort: "-created",
      expand: "actor",
    });
  return result.items.map((r) => adaptActivity(r, currentUserId));
}

/** Append an activity row. Fire-and-forget — never throws. Activity
 *  logging must never block or fail a user-facing mutation, so any
 *  network/permission error is swallowed with a warn and the original
 *  caller continues. */
export async function recordActivity(input: {
  collectionId: string;
  actorId: string;
  type: ActivityType;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await pb.collection("collection_activities").create(
      {
        collection: input.collectionId,
        actor: input.actorId,
        type: input.type,
        payload: input.payload ?? {},
      },
      { requestKey: null },
    );
  } catch (err) {
    console.warn("[activity] record failed", input.type, err);
  }
}

/** Pure formatter: `(type, payload) → { text, emphasis }`. The actor
 *  prefix ("You" / "<name>") is rendered separately by the panel/modal
 *  using `activity.you` + `activity.actorName`. */
export function formatActivity(activity: CollectionActivity): {
  text: string;
  emphasis?: string;
} {
  const p = activity.payload;
  switch (activity.type) {
    case "collection.created":
      return { text: "created the collection" };
    case "collection.renamed": {
      const oldName = str(p.oldName);
      const newName = str(p.newName);
      if (oldName && newName) {
        return { text: `renamed from ${oldName} to`, emphasis: newName };
      }
      return { text: "renamed the collection" };
    }
    case "collection.description_edited":
      return { text: "updated the description" };
    case "item.added": {
      const count = num(p.count) ?? 1;
      return {
        text: "added",
        emphasis: `${count} item${count === 1 ? "" : "s"}`,
      };
    }
    case "item.removed":
      return { text: "removed", emphasis: str(p.scanTitle) || "an item" };
    case "item.tagged":
      return {
        text: `tagged ${str(p.scanTitle) || "an item"} as`,
        emphasis: str(p.tag) || "—",
      };
    case "member.invited":
      return { text: "invited", emphasis: str(p.email) || "a collaborator" };
    case "member.joined":
      return { text: "joined the collection" };
    case "member.role_changed":
      return {
        text: `changed ${str(p.memberName) || "a member"}'s role to`,
        emphasis: str(p.role) || "—",
      };
    case "member.removed":
      return {
        text: "removed",
        emphasis: str(p.memberName) || "a member",
      };
    case "share.visibility_changed":
      return {
        text: "changed visibility to",
        emphasis: str(p.visibility) || "—",
      };
    default:
      return { text: activity.type };
  }
}

/** Compact relative time like "2h ago" / "3d ago"; switches to an
 *  absolute short date past 7 days. Used in the panel and the
 *  per-row time on the modal. */
export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = Math.max(0, now - date.getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Group activities into day buckets ("Today" / "Yesterday" /
 *  "Mon, May 4") for the modal. Order within each group preserves
 *  the input order — pass already-sorted-DESC activities. */
export function groupByDay(
  activities: CollectionActivity[],
): { label: string; items: CollectionActivity[] }[] {
  const out: { label: string; items: CollectionActivity[] }[] = [];
  const today = startOfDay(new Date());
  const yesterday = new Date(today.getTime() - 86_400_000);
  for (const a of activities) {
    const day = startOfDay(a.createdAt);
    let label: string;
    if (day.getTime() === today.getTime()) label = "Today";
    else if (day.getTime() === yesterday.getTime()) label = "Yesterday";
    else
      label = a.createdAt.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year:
          a.createdAt.getFullYear() === today.getFullYear()
            ? undefined
            : "numeric",
      });
    const last = out[out.length - 1];
    if (last && last.label === label) last.items.push(a);
    else out.push({ label, items: [a] });
  }
  return out;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function deriveInitials(seed: string): string {
  const parts = seed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
