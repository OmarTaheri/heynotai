"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth";
import { pb } from "@/lib/pocketbase";
import {
  adaptActivity,
  formatActivity,
  formatRelativeTime,
  type CollectionActivity,
  type CollectionActivityRecord,
} from "@/lib/collection-activities";
import { ActivityModal } from "./ActivityModal";

const PANEL_LIMIT = 8;

/** Side-panel showing the most recent events on a collection. Reads
 *  the live `collection_activities` rows, subscribes to realtime so
 *  new mutations appear without a reload, and opens a full-history
 *  modal on "See all". */
export function ActivityPanel({
  collectionId,
  initialItems,
}: {
  collectionId: string;
  initialItems: CollectionActivity[];
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<CollectionActivity[]>(initialItems);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    if (!collectionId || !user) return;
    let unsub: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const fn = await pb
          .collection("collection_activities")
          .subscribe<CollectionActivityRecord>(
            "*",
            (e) => {
              if (e.action !== "create") return;
              if (e.record.collection !== collectionId) return;
              // Realtime payloads don't carry expand by default; refetch
              // the row with `expand=actor` so the avatar resolves.
              void pb
                .collection("collection_activities")
                .getOne<CollectionActivityRecord>(e.record.id, {
                  expand: "actor",
                })
                .then((full) => {
                  const adapted = adaptActivity(full, user.id);
                  setItems((prev) => {
                    if (prev.some((x) => x.id === adapted.id)) return prev;
                    return [adapted, ...prev].slice(0, PANEL_LIMIT);
                  });
                })
                .catch(() => {});
            },
            { expand: "actor" },
          );
        if (cancelled) {
          void fn();
        } else {
          unsub = () => {
            void fn();
          };
        }
      } catch (err) {
        console.warn("[activity] realtime subscribe failed", err);
      }
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [collectionId, user]);

  const visible = items.slice(0, PANEL_LIMIT);
  const showSeeAll = items.length > 0;

  return (
    <section className="coll-panel">
      <header className="coll-panel-head">
        <span>Activity</span>
        {showSeeAll && (
          <button
            type="button"
            className="coll-panel-link"
            onClick={() => setModalOpen(true)}
          >
            See all
          </button>
        )}
      </header>

      {visible.length === 0 ? (
        <p className="coll-act-empty">No activity yet.</p>
      ) : (
        <ul className="coll-act-list">
          {visible.map((a) => {
            const f = formatActivity(a);
            const actor = a.you ? "You" : a.actorName;
            return (
              <li key={a.id} className="coll-act">
                <Avatar
                  initials={a.actorInitials}
                  src={a.actorAvatarSrc}
                  size="sm"
                />
                <div className="coll-act-body">
                  <p className="coll-act-text">
                    <strong>{actor}</strong> {f.text}
                    {f.emphasis && (
                      <>
                        {" "}
                        <em>{f.emphasis}</em>
                      </>
                    )}
                  </p>
                  <span
                    className="coll-act-time"
                    title={a.createdAt.toLocaleString()}
                  >
                    {formatRelativeTime(a.createdAt)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && (
        <ActivityModal
          collectionId={collectionId}
          onClose={() => setModalOpen(false)}
        />
      )}
    </section>
  );
}
