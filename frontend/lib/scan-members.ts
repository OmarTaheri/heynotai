"use client";

import { useEffect, useState } from "react";
import { type RecordModel } from "pocketbase";
import { pb } from "./pocketbase";
import { lookupUsers } from "./users-lookup";
import { useAuth } from "./auth";

/** Display shape for a single collaborator on a scan. Used by the editor
 *  top bar's avatar stack and hover popover. */
export type ScanMember = {
  id: string;
  name: string;
  initials: string;
  avatarSrc: string | null;
  isOwner: boolean;
};

type ExpandedUser = RecordModel & {
  name?: string;
  handle?: string;
  email?: string;
  avatar?: string;
  avatarUrl?: string;
};

type CollectionMemberRow = RecordModel & {
  collection: string;
  userId: string;
  status: string;
  expand?: { userId?: ExpandedUser };
};

type CollectionItemRow = RecordModel & {
  collection: string;
  scanId: string;
};

type ScanRow = RecordModel & { userId: string };

/** Everyone with read access to this scan: owner + accepted members of
 *  any collection the scan is in. Result is owner-first, then sorted by
 *  name. Unresolved ids are dropped silently — better to render a smaller
 *  list than to fall over.
 *
 *  Reads are authenticated and the existing PB rules already gate access
 *  through the same path used by the editor itself, so we don't filter
 *  again here. */
export async function fetchScanMembers(scanId: string): Promise<ScanMember[]> {
  if (!scanId) return [];

  const scan = await pb.collection("scans").getOne<ScanRow>(scanId, {
    requestKey: null,
  });
  const ownerId = scan.userId;

  const items = await pb
    .collection("collection_items")
    .getFullList<CollectionItemRow>({
      filter: pb.filter("scanId = {:sid}", { sid: scanId }),
      requestKey: null,
    });

  const collectionIds = Array.from(new Set(items.map((i) => i.collection)));

  const memberRows: CollectionMemberRow[] = [];
  await Promise.all(
    collectionIds.map(async (cid) => {
      const rows = await pb
        .collection("collection_members")
        .getFullList<CollectionMemberRow>({
          filter: pb.filter("collection = {:cid} && status = 'accepted'", {
            cid,
          }),
          expand: "userId",
          requestKey: null,
        });
      memberRows.push(...rows);
    }),
  );

  const byId = new Map<string, ScanMember>();
  const missing: string[] = [];

  for (const row of memberRows) {
    if (!row.userId || byId.has(row.userId)) continue;
    const expanded = row.expand?.userId ?? null;
    if (expanded) {
      byId.set(row.userId, projectExpanded(expanded, row.userId === ownerId));
    } else {
      missing.push(row.userId);
    }
  }

  if (!byId.has(ownerId)) missing.push(ownerId);

  if (missing.length > 0) {
    const looked = await lookupUsers(Array.from(new Set(missing)));
    for (const u of looked) {
      if (byId.has(u.id)) continue;
      const display =
        (u.handle && u.handle.trim()) ||
        (u.name && u.name.trim()) ||
        (u.email ? u.email.split("@")[0] : "") ||
        "user";
      byId.set(u.id, {
        id: u.id,
        name: display,
        initials:
          deriveInitials(display) ||
          (u.email ? u.email[0].toUpperCase() : "U"),
        avatarSrc: u.avatarUrl || null,
        isOwner: u.id === ownerId,
      });
    }
  }

  const owner = byId.get(ownerId);
  const others = Array.from(byId.values())
    .filter((m) => m.id !== ownerId)
    .sort((a, b) => a.name.localeCompare(b.name));

  return owner ? [owner, ...others] : others;
}

function projectExpanded(u: ExpandedUser, isOwner: boolean): ScanMember {
  const display =
    (u.handle && u.handle.trim()) ||
    (u.name && u.name.trim()) ||
    (u.email ? u.email.split("@")[0] : "") ||
    "user";
  const avatarSrc = u.avatar
    ? pb.files.getURL(u, u.avatar)
    : u.avatarUrl || null;
  return {
    id: u.id,
    name: display,
    initials:
      deriveInitials(display) ||
      (u.email ? u.email[0].toUpperCase() : "U"),
    avatarSrc,
    isOwner,
  };
}

/** Reactive wrapper around `fetchScanMembers`. Refreshes whenever
 *  `scanId` changes; falls back to `[currentUser]` for synthetic /editor
 *  drafts so the avatar stack still has something to render. Failures
 *  collapse to the current user — the editor itself already errors
 *  loudly when the scan can't be loaded, so we don't surface our own. */
export function useScanMembers(scanId: string | null): {
  members: ScanMember[];
} {
  const { user } = useAuth();
  const [members, setMembers] = useState<ScanMember[]>(() => {
    if (!user) return [];
    return [
      {
        id: user.id,
        name: user.displayName || user.name || user.email,
        initials: user.initials,
        avatarSrc: user.avatarSrc,
        isOwner: !scanId,
      },
    ];
  });

  useEffect(() => {
    if (!user) {
      setMembers([]);
      return;
    }
    const me: ScanMember = {
      id: user.id,
      name: user.displayName || user.name || user.email,
      initials: user.initials,
      avatarSrc: user.avatarSrc,
      isOwner: false,
    };
    if (!scanId) {
      setMembers([{ ...me, isOwner: true }]);
      return;
    }
    let cancelled = false;
    setMembers([me]);
    fetchScanMembers(scanId)
      .then((list) => {
        if (cancelled) return;
        // Make sure the current user always shows up even if PB rules
        // hid the membership row from the response (shouldn't happen if
        // we're on the page, but defensive).
        if (!list.some((m) => m.id === user.id)) list = [me, ...list];
        setMembers(list);
      })
      .catch(() => {
        if (!cancelled) setMembers([{ ...me, isOwner: true }]);
      });
    return () => {
      cancelled = true;
    };
  }, [scanId, user]);

  return { members };
}

function deriveInitials(seed: string): string {
  const parts = seed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
