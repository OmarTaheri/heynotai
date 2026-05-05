"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Icon } from "@/components/Icon";
import { SelectionBar } from "@/components/app/library/SelectionBar";
import { useAuth } from "@/lib/auth";
import { pb } from "@/lib/pocketbase";
import {
  adaptCollectionRecord,
  type Collaborator,
  type Collection,
  type CollectionItem,
  type CollectionMember,
} from "@/lib/collections-data";
import { setCollectionPinned } from "@/lib/collections-api";
import {
  adaptMemberRecord,
  listCollectionMembers,
  removeMember,
  type CollectionMemberRecord,
} from "@/lib/collection-members";
import { collectionsRefreshBus } from "./collections-refresh-bus";
import {
  adaptItemRecord,
  listCollectionItems,
  removeItem,
} from "@/lib/collection-items";
import {
  listActivities,
  type CollectionActivity as CollectionActivityRow,
} from "@/lib/collection-activities";
import { deleteScan } from "@/lib/scans-api";
import { lookupUsers } from "@/lib/users-lookup";
import { verdictToneFromAiPct } from "@/lib/verdict-tone";
import { CollectionHero } from "./CollectionHero";
import { CollectionStats } from "./CollectionStats";
import { computeCollectionStats } from "./collection-stats";
import {
  CollectionFilters,
  type CollectionFilterState,
} from "./CollectionFilters";
import { CollectionItemsTable } from "./CollectionItemsTable";
import { MembersPanel } from "./MembersPanel";
import { RulesPanel } from "./RulesPanel";
import { ActivityPanel } from "./ActivityPanel";
import { AddItemsModal } from "./AddItemsModal";
import { NewScanModal } from "@/components/app/home/NewScanModal";

type Status = "loading" | "found" | "missing";

/**
 * Detail-page body. PB-first: tries `pb.collection("collections")`
 * then falls back to the legacy mock array (the list page still reads
 * from mocks this round). On both miss, renders an inline 404 card.
 *
 * Members and items are fetched alongside the collection so the side
 * panel reflects the real `collection_members` table and the items
 * table is populated from the real `collection_items` join — the
 * page's "Add items" CTA writes through that join, and "Invite
 * collaborator" writes through the members table.
 *
 * Lives in a client component because `pb.authStore` is localStorage-
 * only — server components can't see the user's token.
 */
export function CollectionDetailContent({ slug }: { slug: string }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [collection, setCollection] = useState<Collection | null>(null);
  const [memberRecords, setMemberRecords] = useState<
    CollectionMemberRecord[]
  >([]);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [includedScanIds, setIncludedScanIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [initialActivities, setInitialActivities] = useState<
    CollectionActivityRow[]
  >([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newScanOpen, setNewScanOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  // Multi-select state for the items table. Cleared on every page nav
  // and after every bulk action lands.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<CollectionFilterState>({
    verdict: null,
    type: null,
    detector: null,
  });
  // Whether the currently rendered collection is a real PB record (vs a
  // legacy mock). The presence of `memberRecords` isn't a reliable
  // signal — a brand-new PB collection has zero invitees but is still
  // live and should accept Add-items / Invite actions.
  const [isLive, setIsLive] = useState(false);
  // Raw owner id from the PB record — kept separately so the hero can
  // tell whether the current viewer should see "Delete collection" or
  // "Leave collection" in the More menu.
  const [ownerUserId, setOwnerUserId] = useState<string>("");

  const refreshMembers = useCallback(
    async (collectionId: string) => {
      try {
        const records = await listCollectionMembers(collectionId);
        setMemberRecords(records);
      } catch {
        // Non-owner / non-member readers (rare) — leave empty.
      }
    },
    [],
  );

  const refreshItems = useCallback(async (collectionId: string) => {
    try {
      const records = await listCollectionItems(collectionId);
      setItems(records.map(adaptItemRecord));
      setIncludedScanIds(
        new Set(
          records
            .map((r) => (r.expand?.scanId as { id?: string } | undefined)?.id)
            .filter((id): id is string => Boolean(id)),
        ),
      );
    } catch {
      // Same — leave empty.
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    (async () => {
      if (user) {
        try {
          const record = await pb
            .collection("collections")
            .getFirstListItem(pb.filter("slug = {:slug}", { slug }));
          if (cancelled) return;
          const recordUserId = record.userId as string | undefined;
          // Look up the actual owner's profile when we (the viewer)
          // aren't them — accepted members would otherwise see their
          // own avatar synthesized into the Owner row.
          let owner = null;
          if (recordUserId && recordUserId !== user.id) {
            const profiles = await lookupUsers([recordUserId]);
            if (cancelled) return;
            owner = profiles.find((p) => p.id === recordUserId) ?? null;
          }
          const adapted = adaptCollectionRecord(
            {
              id: record.id,
              slug: record.slug as string,
              title: record.title as string,
              description: record.description as string | undefined,
              tone: record.tone as Collection["tone"],
              pattern: record.pattern as Collection["pattern"],
              pinned: record.pinned as boolean | undefined,
              created: record.created as string,
              updated: record.updated as string,
              userId: recordUserId,
            },
            user,
            owner,
          );
          setCollection(adapted);
          setIsLive(true);
          setOwnerUserId(recordUserId ?? "");
          setStatus("found");
          const [, , activities] = await Promise.all([
            refreshMembers(record.id),
            refreshItems(record.id),
            listActivities(record.id, user.id).catch(() => []),
          ]);
          if (!cancelled) setInitialActivities(activities);
          return;
        } catch {
          // PB returned no record (or denied access) — show 404.
        }
      }

      if (cancelled) return;
      setStatus("missing");
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, user, authLoading, refreshMembers, refreshItems]);

  if (status === "loading") {
    return (
      <div className="coll-detail panel-reveal">
        <Breadcrumb
          items={[
            { label: "Collections", href: "/app/collections" },
            { label: "…" },
          ]}
        />
        <div className="coll-detail-skeleton" aria-hidden />
      </div>
    );
  }

  if (status === "missing" || !collection) {
    return (
      <div className="coll-detail panel-reveal">
        <Breadcrumb
          items={[
            { label: "Collections", href: "/app/collections" },
            { label: "Not found" },
          ]}
        />
        <div className="coll-missing">
          <Icon name="folder" size={28} />
          <h2>Collection not found</h2>
          <p>It may have been deleted, or you don&apos;t have access.</p>
          <Link href="/app/collections" className="coll-missing-link">
            Back to collections
          </Link>
        </div>
      </div>
    );
  }

  const liveMembers: CollectionMember[] | null =
    memberRecords.length > 0 && user
      ? mergeOwnerWithMembers(collection, memberRecords, user.id)
      : null;
  const members = liveMembers ?? collection.members;
  const collaborators: Collaborator[] = liveMembers
    ? liveMembers.map((m) => ({ initials: m.initials, avatarSrc: m.avatarSrc }))
    : collection.collaborators;

  const stats = computeCollectionStats(items);
  const renderable: Collection = {
    ...collection,
    members,
    collaborators,
    items,
    itemCount: stats.itemCount || collection.itemCount,
  };

  // Detail records loaded from PB carry their original record id —
  // mocks have a synthetic `id` like "c1". Either way, the value is
  // what we hand to the modals below.
  const collectionDbId = isLive ? collection.id : "";

  // Users already on this collection (owner + invited rows) — handed
  // to the invite modal so its user-search doesn't surface duplicates.
  const excludeUserIds = new Set<string>();
  if (user) excludeUserIds.add(user.id);
  for (const record of memberRecords) {
    if (record.userId) excludeUserIds.add(record.userId);
  }

  const isOwner = Boolean(isLive && user && ownerUserId === user.id);
  const myMembership = user
    ? memberRecords.find(
        (r) => r.userId === user.id && r.status === "accepted",
      )
    : undefined;
  const canLeave = Boolean(isLive && !isOwner && myMembership);

  const handleDelete = collectionDbId
    ? async () => {
        try {
          await pb.collection("collections").delete(collectionDbId);
          collectionsRefreshBus.publish();
          router.push("/app/collections");
        } catch (err) {
          console.error("delete collection failed", err);
        }
      }
    : undefined;

  const handleTogglePin =
    isOwner && collectionDbId
      ? async () => {
          const next = !collection.pinned;
          // Optimistic flip — revert on failure.
          setCollection((c) => (c ? { ...c, pinned: next } : c));
          try {
            await setCollectionPinned(collectionDbId, next);
            collectionsRefreshBus.publish();
          } catch (err) {
            console.error("toggle pin failed", err);
            setCollection((c) => (c ? { ...c, pinned: !next } : c));
          }
        }
      : undefined;

  const handleLeave =
    myMembership && collectionDbId && user
      ? async () => {
          try {
            await removeMember(myMembership.id, {
              collectionId: collectionDbId,
              actorId: user.id,
              memberName: user.displayName,
            });
            collectionsRefreshBus.publish();
            router.push("/app/collections");
          } catch (err) {
            console.error("leave collection failed", err);
          }
        }
      : undefined;

  // Apply search query + dropdown filters to the items list. Lower-cost
  // than memoizing — the list is small enough that a fresh filter on
  // every render reads cleanly.
  const visibleItems = items.filter((item) => {
    if (query && !item.name.toLowerCase().includes(query.toLowerCase())) {
      return false;
    }
    if (filters.verdict) {
      const tone = verdictToneFromAiPct(item.aiPct ?? item.confidence);
      if (tone !== filters.verdict) return false;
    }
    if (filters.type && item.type !== filters.type) return false;
    if (filters.detector) {
      const d = item.detector || item.model || "";
      if (d !== filters.detector) return false;
    }
    return true;
  });

  // Distinct detector values across the *unfiltered* items, so the
  // dropdown lets you switch between detectors even after one is
  // selected.
  const detectorOptions = Array.from(
    new Set(
      items
        .map((i) => i.detector || i.model || "")
        .filter((d): d is string => Boolean(d) && d !== "—"),
    ),
  ).sort();

  const toggleRow = (id: string, next: boolean) => {
    setSelectedIds((prev) => {
      const out = new Set(prev);
      if (next) out.add(id);
      else out.delete(id);
      return out;
    });
  };

  const toggleAll = (next: boolean) => {
    setSelectedIds(next ? new Set(visibleItems.map((i) => i.id)) : new Set());
  };

  const handleBulkRemove = async () => {
    if (!collectionDbId || !user) return;
    const targets = visibleItems.filter((i) => selectedIds.has(i.id));
    if (targets.length === 0) return;
    await Promise.all(
      targets.map((i) =>
        removeItem(i.id, {
          collectionId: collectionDbId,
          actorId: user.id,
          scanTitle: i.name,
        }).catch(() => null),
      ),
    );
    setSelectedIds(new Set());
    await refreshItems(collectionDbId);
  };

  const handleBulkDelete = async () => {
    if (!collectionDbId || !user) return;
    const targets = visibleItems.filter((i) => selectedIds.has(i.id));
    if (targets.length === 0) return;
    await Promise.all(
      targets.map(async (i) => {
        // Order matters: remove the join row first so the table updates
        // even if `deleteScan` rejects (orphaned scans are still
        // listable from /app/library).
        await removeItem(i.id, {
          collectionId: collectionDbId,
          actorId: user.id,
          scanTitle: i.name,
        }).catch(() => null);
        if (i.scanId) await deleteScan(i.scanId).catch(() => null);
      }),
    );
    setSelectedIds(new Set());
    await refreshItems(collectionDbId);
  };

  return (
    <div className="coll-detail panel-reveal">
      <Breadcrumb
        items={[
          { label: "Collections", href: "/app/collections" },
          { label: collection.title },
        ]}
      />

      <CollectionHero
        collection={renderable}
        onAddItems={collectionDbId ? () => setAddOpen(true) : undefined}
        onNewScan={collectionDbId ? () => setNewScanOpen(true) : undefined}
        isOwner={isOwner}
        canLeave={canLeave}
        onDelete={isOwner ? handleDelete : undefined}
        onLeave={canLeave ? handleLeave : undefined}
        onTogglePin={handleTogglePin}
        shareUrl={
          isLive && typeof window !== "undefined"
            ? `${window.location.origin}/app/collections/${collection.slug}`
            : undefined
        }
        onManageAccess={isOwner ? () => setManageOpen(true) : undefined}
      />

      <div className="coll-detail-body">
        <main className="coll-detail-main">
          <CollectionStats stats={stats} />
          <CollectionFilters
            query={query}
            onQueryChange={setQuery}
            filters={filters}
            onFiltersChange={setFilters}
            detectorOptions={detectorOptions}
          />
          {selectedIds.size > 0 && (
            <SelectionBar
              count={selectedIds.size}
              onClear={() => setSelectedIds(new Set())}
              actions={[
                {
                  key: "remove",
                  label: "Remove from collection",
                  icon: "x",
                },
                { key: "delete", label: "Delete", icon: "trash" },
              ]}
              onAction={(key) => {
                if (key === "remove") void handleBulkRemove();
                if (key === "delete") void handleBulkDelete();
              }}
              disabled={!isLive}
            />
          )}
          <CollectionItemsTable
            items={visibleItems}
            selectedIds={selectedIds}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            onOpenRow={(scanId) => router.push(`/editor/${scanId}`)}
          />
        </main>

        <aside className="coll-detail-side">
          <MembersPanel
            members={renderable.members}
            collectionId={collectionDbId || undefined}
            collectionTitle={collection.title}
            excludeUserIds={excludeUserIds}
            manageOpen={manageOpen}
            onManageOpenChange={setManageOpen}
            onInvited={() =>
              collectionDbId && refreshMembers(collectionDbId)
            }
            inviteLabel="Invite collaborator"
          />
          <RulesPanel rules={collection.rules} />
          <ActivityPanel
            collectionId={collectionDbId}
            initialItems={initialActivities}
          />
        </aside>
      </div>

      {addOpen && collectionDbId && (
        <AddItemsModal
          collectionId={collectionDbId}
          collectionTitle={collection.title}
          excludeScanIds={includedScanIds}
          onClose={() => setAddOpen(false)}
          onAdded={() => refreshItems(collectionDbId)}
        />
      )}

      {newScanOpen && collectionDbId && (
        <NewScanModal
          linkCollectionId={collectionDbId}
          onClose={() => setNewScanOpen(false)}
          onCreated={(scanId) => {
            setNewScanOpen(false);
            router.push(`/editor/${scanId}`);
          }}
        />
      )}
    </div>
  );
}

/** Promote the current user to "Owner" + reuse their avatar in front of
 *  whatever rows came back from `collection_members`. The owner is
 *  implicit on `collections` (via the `userId` column) so the join
 *  table only stores invited collaborators — without this merge the
 *  side panel would silently drop the owner. */
function mergeOwnerWithMembers(
  collection: Collection,
  memberRecords: CollectionMemberRecord[],
  currentUserId: string,
): CollectionMember[] {
  const owner = collection.members.find((m) => m.role === "Owner") ??
    collection.members[0];
  const adapted = memberRecords
    .filter((r) => r.status === "accepted")
    .map((r) => adaptMemberRecord(r, currentUserId));
  return owner ? [owner, ...adapted] : adapted;
}
