"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { pb } from "@/lib/pocketbase";
import {
  adaptActivity,
  formatActivity,
  formatRelativeTime,
  groupByDay,
  listActivities,
  type CollectionActivity,
  type CollectionActivityRecord,
} from "@/lib/collection-activities";

const HISTORY_LIMIT = 200;

/** "See all" history modal — opens from the right-rail Activity
 *  panel. Pulls up to 200 latest events, groups them by day, and
 *  subscribes to realtime so events appended while the modal is open
 *  show up live at the top of the "Today" group. */
export function ActivityModal({
  collectionId,
  onClose,
}: {
  collectionId: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<CollectionActivity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lock background scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await listActivities(collectionId, user.id, {
          limit: HISTORY_LIMIT,
        });
        if (!cancelled) setItems(rows);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Couldn't load history.");
        setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionId, user]);

  // Live updates while the modal is open. Use a distinct subscribe
  // topic from the panel so they don't fight over the same handler.
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
              void pb
                .collection("collection_activities")
                .getOne<CollectionActivityRecord>(e.record.id, {
                  expand: "actor",
                })
                .then((full) => {
                  const adapted = adaptActivity(full, user.id);
                  setItems((prev) => {
                    if (!prev) return prev;
                    if (prev.some((x) => x.id === adapted.id)) return prev;
                    return [adapted, ...prev];
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
      } catch {}
    })();
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [collectionId, user]);

  const groups = items ? groupByDay(items) : [];

  const dialog = (
    <div
      onMouseDown={onClose}
      className="auth-overlay coll-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-modal-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="auth-card coll-modal-card coll-act-modal-card"
      >
        <header className="coll-modal-head">
          <div>
            <h2 id="activity-modal-title" className="coll-modal-title">
              Activity
            </h2>
            <p className="coll-add-sub">
              Everything that&rsquo;s happened in this collection, newest first.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="coll-modal-close"
          >
            <Icon name="x" size={14} />
          </button>
        </header>

        <div className="coll-act-modal-body">
          {items === null && (
            <p className="coll-manage-state">Loading…</p>
          )}
          {items !== null && items.length === 0 && !error && (
            <p className="coll-manage-state">No activity yet.</p>
          )}
          {error && <p className="coll-modal-error">{error}</p>}

          {groups.map((g) => (
            <section key={g.label} className="coll-act-day">
              <h3 className="coll-act-day-head">{g.label}</h3>
              <ul className="coll-act-list">
                {g.items.map((a) => {
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
            </section>
          ))}
        </div>

        <footer className="coll-modal-foot">
          <button
            type="button"
            onClick={onClose}
            className="coll-modal-btn coll-modal-btn-ghost"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}
