"use client";

import { type RecordModel } from "pocketbase";
import { pb } from "./pocketbase";
import { recordActivity } from "./collection-activities";
import type { CollectionMember } from "./collections-data";

export type MemberRole = "owner" | "editor" | "viewer";
export type MemberStatus = "pending" | "accepted" | "rejected";

/** Wire shape for a row in `collection_members`, kept thin so consumers
 *  can also pull whatever they need off the PB `expand`. */
export type CollectionMemberRecord = RecordModel & {
  collection: string;
  userId: string;
  invitedBy: string;
  invitedEmail: string;
  role: MemberRole;
  status: MemberStatus;
  message: string;
};

type ExpandedUser = RecordModel & {
  name?: string;
  handle?: string;
  email: string;
  avatar?: string;
};

type ExpandedCollection = RecordModel & {
  slug: string;
  title: string;
};

/** Fetch every member row for a given collection — used by the detail
 *  page to render the side panel. Includes pending invites so the owner
 *  can see who's been asked. */
export async function listCollectionMembers(
  collectionId: string,
): Promise<CollectionMemberRecord[]> {
  const records = await pb
    .collection("collection_members")
    .getFullList<CollectionMemberRecord>({
      filter: pb.filter("collection = {:cid}", { cid: collectionId }),
      sort: "created",
      expand: "userId",
    });
  return records;
}

/** Project a PB row into the rich `CollectionMember` shape the
 *  MembersPanel renders. Falls back to the invited email when the
 *  recipient hasn't been linked to a user yet. */
export function adaptMemberRecord(
  record: CollectionMemberRecord,
  currentUserId: string,
): CollectionMember {
  const expanded = (record.expand?.userId as ExpandedUser | undefined) ?? null;
  const email = expanded?.email ?? record.invitedEmail ?? "";
  const name =
    expanded?.handle?.trim() ||
    expanded?.name?.trim() ||
    (email ? email.split("@")[0] ?? email : record.role);
  const initials = deriveInitials(name) || (email[0] ?? "U").toUpperCase();
  const avatarSrc =
    expanded && expanded.avatar
      ? pb.files.getURL(expanded, expanded.avatar)
      : null;
  const roleLabel =
    record.role === "owner"
      ? "Owner"
      : record.role === "editor"
        ? "Editor"
        : "Viewer";
  return {
    membershipId: record.id,
    initials,
    name,
    role: roleLabel,
    emailHandle: email ? `${email.split("@")[0]}@` : "",
    email,
    avatarSrc,
    you: record.userId === currentUserId,
  };
}

export type InviteCollaboratorInput = {
  collectionId: string;
  invitedBy: string;
  email: string;
  role?: MemberRole;
  message?: string;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/** Issue an invite to collaborate on a collection. Goes through the
 *  api server because the recipient's PB id is needed in `userId` for
 *  their `listPendingRequests` filter to match — and the `users`
 *  listRule blocks the inviter from looking that id up directly. The
 *  api uses superuser auth to resolve. */
export async function inviteCollaborator(
  input: InviteCollaboratorInput,
): Promise<{ membershipId: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new InviteError("missing_email", "Enter an email.");

  const token = pb.authStore.token;
  const r = await fetch(`${API_URL}/me/collections/invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      collectionId: input.collectionId,
      email,
      role: input.role ?? "editor",
      message: input.message?.trim() ?? "",
    }),
  });
  if (r.ok) {
    const out = (await r.json()) as { membershipId: string };
    void recordActivity({
      collectionId: input.collectionId,
      actorId: input.invitedBy,
      type: "member.invited",
      payload: { email, role: input.role ?? "editor" },
    });
    return out;
  }

  const detail = (await r.json().catch(() => ({}))) as { error?: string };
  switch (detail.error) {
    case "self_invite":
      throw new InviteError(
        "self_invite",
        "You're already the owner of this collection.",
      );
    case "already_invited":
      throw new InviteError(
        "already_invited",
        "That collaborator already has an invite on this collection.",
      );
    case "invalid_email":
      throw new InviteError("invalid_email", "Enter a valid email.");
    case "forbidden":
      throw new InviteError(
        "forbidden",
        "Only the collection owner can invite people.",
      );
    case "collection_not_found":
      throw new InviteError("collection_not_found", "Collection not found.");
    default:
      throw new InviteError("invite_failed", "Couldn't send the invite.");
  }
}

/** All invites where the current user is the recipient and the row is
 *  still pending — drives the "Requests" tab on /app/collections. */
export async function listPendingRequests(
  userId: string,
): Promise<CollectionMemberRecord[]> {
  return pb.collection("collection_members").getFullList<CollectionMemberRecord>({
    filter: pb.filter(
      "userId = {:uid} && status = 'pending'",
      { uid: userId },
    ),
    sort: "-created",
    expand: "collection,invitedBy",
  });
}

export function expandedCollection(
  record: CollectionMemberRecord,
): ExpandedCollection | null {
  const expanded = record.expand?.collection as ExpandedCollection | undefined;
  return expanded ?? null;
}

export function expandedInviter(
  record: CollectionMemberRecord,
): ExpandedUser | null {
  const expanded = record.expand?.invitedBy as ExpandedUser | undefined;
  return expanded ?? null;
}

export async function respondToRequest(
  membershipId: string,
  decision: "accepted" | "rejected",
): Promise<CollectionMemberRecord> {
  const updated = await pb
    .collection("collection_members")
    .update<CollectionMemberRecord>(membershipId, { status: decision });
  if (decision === "accepted") {
    void recordActivity({
      collectionId: updated.collection,
      actorId: updated.userId,
      type: "member.joined",
    });
  }
  return updated;
}

/** Remove a member from a collection. Caller passes the host
 *  collection + the actor performing the removal + (optional) member
 *  display name so a `member.removed` activity row can be appended.
 *
 *  The activity row is written BEFORE the delete because the "leave"
 *  flow lets a user remove their own membership — once that delete
 *  lands the actor is no longer a member, and PB's createRule on
 *  `collection_activities` would reject the post-delete write. */
export async function removeMember(
  membershipId: string,
  ctx: { collectionId: string; actorId: string; memberName?: string },
): Promise<void> {
  await recordActivity({
    collectionId: ctx.collectionId,
    actorId: ctx.actorId,
    type: "member.removed",
    payload: ctx.memberName ? { memberName: ctx.memberName } : {},
  });
  await pb.collection("collection_members").delete(membershipId);
}

export class InviteError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "InviteError";
    this.code = code;
  }
}

function deriveInitials(seed: string): string {
  const parts = seed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
