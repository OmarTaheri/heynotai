"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { TypeChip } from "@/components/ui/TypeChip";
import { ItemMeta } from "@/components/ui/ItemMeta";
import { useAuth } from "@/lib/auth";
import { addScansToCollection } from "@/lib/collection-items";
import { listScans, ScanApiError } from "@/lib/scans-api";
import { scanToLibraryItem, type LibraryItem } from "@/lib/library-data";
import { flattenItemMeta } from "@/lib/item-meta";

const PAGE_SIZE = 100;

/**
 * Modal launched from the collection detail "Add items" button. Loads
 * the user's library, lets them pick scans, then writes a row to
 * `collection_items` per pick. Existing items in the collection are
 * filtered out so a multi-select can't double-add.
 */
export function AddItemsModal({
  collectionId,
  collectionTitle,
  excludeScanIds,
  onClose,
  onAdded,
}: {
  collectionId: string;
  collectionTitle: string;
  excludeScanIds: ReadonlySet<string>;
  onClose: () => void;
  onAdded?: (added: number) => void;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await listScans({ perPage: PAGE_SIZE });
        if (cancelled) return;
        setItems(result.items.map((scan) => scanToLibraryItem(scan)));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ScanApiError && err.status !== 401) {
          setError(err.message);
        }
        setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const list = items ?? [];
    const q = search.trim().toLowerCase();
    return list
      .filter((it) => !excludeScanIds.has(it.id))
      .filter((it) => {
        if (!q) return true;
        return (
          it.name.toLowerCase().includes(q) ||
          flattenItemMeta(it.type, it.meta).toLowerCase().includes(q) ||
          it.model.toLowerCase().includes(q)
        );
      });
  }, [items, search, excludeScanIds]);

  const canSubmit = !submitting && picked.size > 0 && Boolean(user);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (!canSubmit || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      const { added } = await addScansToCollection({
        collectionId,
        addedBy: user.id,
        scanIds: Array.from(picked),
      });
      onAdded?.(added);
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Couldn't add items.";
      setError(msg);
      setSubmitting(false);
    }
  }

  const empty = items !== null && items.length === 0;
  const filteredEmpty = !empty && visible.length === 0;

  // Portal so the modal escapes the panel-reveal transform that would
  // otherwise become its fixed-position containing block.
  const dialog = (
    <div
      onMouseDown={() => !submitting && onClose()}
      className="auth-overlay coll-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-items-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="auth-card coll-modal-card coll-add-card"
      >
        <header className="coll-modal-head">
          <div>
            <h2 id="add-items-title" className="coll-modal-title">
              Add to “{collectionTitle}”
            </h2>
            <p className="coll-add-sub">
              Pick from items in your library. Anyone with access to this
              collection will see them.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            aria-label="Close"
            className="coll-modal-close"
            disabled={submitting}
          >
            <Icon name="x" size={14} />
          </button>
        </header>

        <div className="coll-add-search">
          <Icon name="search" size={14} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, source, or model"
            disabled={submitting}
          />
        </div>

        <div className="coll-add-list" role="listbox" aria-multiselectable="true">
          {items === null && (
            <div className="coll-add-state">Loading your library…</div>
          )}
          {empty && (
            <div className="coll-add-state">
              No saved scans yet. Run a scan first, then add it here.
            </div>
          )}
          {filteredEmpty && (
            <div className="coll-add-state">No matches.</div>
          )}
          {items !== null &&
            visible.map((it) => {
              const isPicked = picked.has(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  role="option"
                  aria-selected={isPicked}
                  className={`coll-add-row${isPicked ? " is-picked" : ""}`}
                  onClick={() => toggle(it.id)}
                  disabled={submitting}
                >
                  <span className="coll-add-check" aria-hidden>
                    {isPicked ? <Icon name="check" size={12} /> : null}
                  </span>
                  <TypeChip type={it.type} size="md" />
                  <span className="coll-add-info">
                    <span className="coll-add-name">{it.name}</span>
                    <span className="coll-add-meta">
                      <ItemMeta
                        type={it.type}
                        parts={it.meta}
                        link={it.link}
                      />
                    </span>
                  </span>
                  <span className="coll-add-conf">{it.confidence}%</span>
                </button>
              );
            })}
        </div>

        {error && <p className="coll-modal-error">{error}</p>}

        <footer className="coll-modal-foot coll-add-foot">
          <span className="coll-add-count">
            {picked.size} selected
          </span>
          <div className="coll-add-actions">
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              disabled={submitting}
              className="coll-modal-btn coll-modal-btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canSubmit}
              className="coll-modal-btn coll-modal-btn-primary"
            >
              {submitting
                ? "Adding…"
                : picked.size === 0
                  ? "Add items"
                  : `Add ${picked.size} item${picked.size === 1 ? "" : "s"}`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}
