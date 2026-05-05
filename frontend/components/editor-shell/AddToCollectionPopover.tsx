"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { RecordModel } from "pocketbase";
import { pb } from "@/lib/pocketbase";
import { useAuth } from "@/lib/auth";
import {
  addScansToCollection,
  type ScanCollectionRef,
} from "@/lib/collection-items";
import styles from "./EditorTopBar.module.css";

type CollectionRow = RecordModel & { slug?: string; title?: string };

interface Props {
  open: boolean;
  onClose: () => void;
  /** The persisted scan being linked. Parent guarantees non-empty
   *  before opening (anonymous flow keeps the + disabled). */
  scanId: string;
  onLinked: (c: ScanCollectionRef) => void;
}

export function AddToCollectionPopover({
  open,
  onClose,
  scanId,
  onLinked,
}: Props) {
  const { user } = useAuth();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<CollectionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !user) return;
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
        if (!cancelled) setError("Couldn't load collections");
      });
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const handlePick = async (c: CollectionRow) => {
    if (!user) return;
    setLinking(c.id);
    setError(null);
    try {
      await addScansToCollection({
        collectionId: c.id,
        addedBy: user.id,
        scanIds: [scanId],
      });
      onLinked({ id: c.id, slug: c.slug ?? "", title: c.title ?? "" });
      onClose();
    } catch {
      setError("Couldn't add to collection");
    } finally {
      setLinking(null);
    }
  };

  if (!open) return null;

  return (
    <div ref={wrapRef} className={styles.popover} role="dialog" aria-label="Add to collection">
      <div className={styles.popoverHeader}>Add to collection</div>
      {error && <div className={styles.popoverError}>{error}</div>}
      {list === null && !error && (
        <div className={styles.popoverEmpty}>Loading…</div>
      )}
      {list !== null && list.length === 0 && (
        <div className={styles.popoverEmpty}>
          No collections yet.
          {" "}
          <Link href="/app/collections" className={styles.popoverLink}>
            Create one
          </Link>
        </div>
      )}
      {list !== null && list.length > 0 && (
        <div className={styles.popoverList}>
          {list.map((c) => (
            <button
              key={c.id}
              type="button"
              className={styles.popoverItem}
              onClick={() => handlePick(c)}
              disabled={linking !== null}
            >
              <span className={styles.popoverItemTitle}>
                {c.title ?? c.slug ?? c.id}
              </span>
              {linking === c.id && (
                <span className={styles.popoverItemHint}>Adding…</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
