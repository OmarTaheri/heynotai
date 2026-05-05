"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { RecordModel } from "pocketbase";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { addScansToCollection } from "@/lib/collection-items";
import { pb } from "@/lib/pocketbase";

type CollectionRow = RecordModel & { slug?: string; title?: string };

/**
 * Centered picker the library SelectionBar opens when the user clicks
 * "Add to collection". Lists the user's own collections; clicking one
 * batches every selected scan id into it via `addScansToCollection`.
 */
export function AddToCollectionModal({
  scanIds,
  onClose,
  onAdded,
}: {
  /** Persisted PocketBase scan ids to add. Demo seed rows are filtered
   *  out by the parent before they reach this modal. */
  scanIds: string[];
  onClose: () => void;
  onAdded?: (added: number, skipped: number) => void;
}) {
  const { user } = useAuth();
  const [list, setList] = useState<CollectionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && submittingId === null) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submittingId]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setError(null);
    setList(null);
    pb.collection("collections")
      .getFullList<CollectionRow>({
        filter: pb.filter("userId = {:uid}", { uid: user.id }),
        sort: "-updated",
        requestKey: null,
      })
      .then((rs) => {
        if (!cancelled) setList(rs);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load collections.");
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handlePick = async (c: CollectionRow) => {
    if (!user || scanIds.length === 0) return;
    setSubmittingId(c.id);
    setError(null);
    try {
      const { added, skipped } = await addScansToCollection({
        collectionId: c.id,
        addedBy: user.id,
        scanIds,
      });
      onAdded?.(added, skipped);
      onClose();
    } catch {
      setError("Couldn't add to collection.");
      setSubmittingId(null);
    }
  };

  const busy = submittingId !== null;

  const dialog = (
    <div
      onMouseDown={() => !busy && onClose()}
      className="auth-overlay coll-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lib-add-to-collection-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="auth-card coll-modal-card lib-add-card"
      >
        <header className="coll-modal-head">
          <div>
            <h2 id="lib-add-to-collection-title" className="coll-modal-title">
              Add to a collection
            </h2>
            <p className="coll-add-sub">
              {scanIds.length} item{scanIds.length === 1 ? "" : "s"} ·
              pick a collection below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            aria-label="Close"
            className="coll-modal-close"
            disabled={busy}
          >
            <Icon name="x" size={14} />
          </button>
        </header>

        <div className="coll-add-list" role="listbox">
          {!user && <div className="coll-add-state">Please sign in.</div>}
          {user && list === null && !error && (
            <div className="coll-add-state">Loading…</div>
          )}
          {user && list !== null && list.length === 0 && (
            <div className="coll-add-state">
              No collections yet.{" "}
              <Link href="/app/collections" className="lib-add-link">
                Create one
              </Link>
            </div>
          )}
          {user &&
            list !== null &&
            list.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={false}
                className="lib-add-row"
                onClick={() => handlePick(c)}
                disabled={busy}
              >
                <Icon name="folder" size={13} />
                <span className="lib-add-row-title">
                  {c.title ?? c.slug ?? c.id}
                </span>
                {submittingId === c.id && (
                  <span className="lib-add-row-hint">Adding…</span>
                )}
              </button>
            ))}
        </div>

        {error && <p className="coll-modal-error">{error}</p>}

        <footer className="coll-modal-foot">
          <button
            type="button"
            onClick={() => !busy && onClose()}
            disabled={busy}
            className="coll-modal-btn coll-modal-btn-ghost"
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}
