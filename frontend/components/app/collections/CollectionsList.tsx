"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionHead } from "@/components/ui/SectionHead";
import { useAuth } from "@/lib/auth";
import { pb } from "@/lib/pocketbase";
import {
  adaptCollectionRecord,
  type Collection,
  type CollectionItem,
  type OwnerProfile,
} from "@/lib/collections-data";
import { setCollectionPinned } from "@/lib/collections-api";
import { adaptItemRecord, listCollectionItems } from "@/lib/collection-items";
import { lookupUsers } from "@/lib/users-lookup";
import { CollectionCard } from "./CollectionCard";
import { NewCollectionTrigger } from "./NewCollectionTrigger";
import { collectionsRefreshBus } from "./collections-refresh-bus";
import { computeCollectionStats } from "./collection-stats";

/**
 * Pinned + "All collections" grid on `/app/collections`. Fetches the
 * real collections the user owns or is a member of from PocketBase
 * and splits them into the two sections by `pinned`. The pin toggle
 * on each card flips the bool on PB and refreshes via the shared bus.
 */
export function CollectionsList() {
  const { user, loading: authLoading } = useAuth();
  const [real, setReal] = useState<Collection[]>([]);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const records = await pb
        .collection("collections")
        .getFullList({ sort: "-created" });

      // Resolve owner profiles for any collection the viewer doesn't
      // own (i.e. accepted-member shares). Without this, the index
      // cards would render the viewer's own avatar in the corner of
      // every shared collection instead of the actual owner's.
      const otherOwnerIds = Array.from(
        new Set(
          records
            .map((r) => r.userId as string)
            .filter((id) => id && id !== user.id),
        ),
      );
      const owners = otherOwnerIds.length
        ? await lookupUsers(otherOwnerIds)
        : [];
      const ownerById = new Map<string, OwnerProfile>();
      for (const o of owners) ownerById.set(o.id, o);

      const adapted = records.map((r) =>
        adaptCollectionRecord(
          {
            id: r.id,
            slug: r.slug as string,
            title: r.title as string,
            description: r.description as string | undefined,
            tone: r.tone as Collection["tone"],
            pattern: r.pattern as Collection["pattern"],
            pinned: r.pinned as boolean | undefined,
            created: r.created as string,
            updated: r.updated as string,
            userId: r.userId as string | undefined,
          },
          user,
          ownerById.get(r.userId as string) ?? null,
        ),
      );

      // Real collection records carry no aggregated stats — items live in
      // the `collection_items` join. Fan out one read per card so the
      // index can show the same Items / Flagged / AI-rate the detail page
      // computes. allSettled keeps a single denied/broken collection from
      // blanking the whole grid.
      const itemsByCollection = new Map<string, CollectionItem[]>();
      const settled = await Promise.allSettled(
        records.map((r) => listCollectionItems(r.id)),
      );
      settled.forEach((res, i) => {
        if (res.status === "fulfilled") {
          itemsByCollection.set(records[i].id, res.value.map(adaptItemRecord));
        }
      });

      const enriched = adapted.map((c) => {
        const items = itemsByCollection.get(c.id) ?? [];
        const stats = computeCollectionStats(items);
        const thumbs = items.slice(0, 3).map((i) => i.type);
        return {
          ...c,
          items,
          itemCount: stats.itemCount,
          flagged: stats.flagged,
          aiRate: stats.aiPct,
          graded: stats.graded,
          pending: stats.pending,
          thumbs,
          extraCount: Math.max(0, stats.itemCount - thumbs.length),
        };
      });

      setReal(enriched);
    } catch {
      // Silent — fall back to mocks-only.
    }
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    const run = async () => {
      await refresh();
      if (cancelled) return;
    };
    run();
    const unsub = collectionsRefreshBus.subscribe(() => {
      run();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user, authLoading, refresh]);

  const handleTogglePin = useCallback(
    (id: string, next: boolean) => {
      // Flip locally so the card jumps sections immediately, then write
      // through to PB. Revert on failure so the UI doesn't lie.
      setReal((prev) =>
        prev.map((c) => (c.id === id ? { ...c, pinned: next } : c)),
      );
      setCollectionPinned(id, next)
        .then(() => collectionsRefreshBus.publish())
        .catch((err) => {
          console.error("toggle pin failed", err);
          setReal((prev) =>
            prev.map((c) => (c.id === id ? { ...c, pinned: !next } : c)),
          );
        });
    },
    [],
  );

  const pinned = real.filter((c) => c.pinned);
  const rest = real.filter((c) => !c.pinned);

  return (
    <>
      {pinned.length > 0 && (
        <section className="coll-section">
          <SectionHead title="Pinned" subtitle={`${pinned.length}`} />
          <div className="coll-grid">
            {pinned.map((c) => (
              <CollectionCard
                key={c.id}
                collection={c}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        </section>
      )}

      <section className="coll-section">
        <SectionHead title="All collections" subtitle={`${rest.length}`} />
        <div className="coll-grid">
          {rest.map((c) => (
            <CollectionCard
              key={c.id}
              collection={c}
              onTogglePin={handleTogglePin}
            />
          ))}
          <NewCollectionTrigger slot="tile" />
        </div>
      </section>
    </>
  );
}
