"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/Icon";
import type { Collection } from "@/lib/collections-data";
import { ShareCollectionModal } from "./ShareCollectionModal";

/**
 * Hero band at the top of a collection detail page. Shows the
 * pinned status, title, description, meta strip (item count, dates,
 * members), and the action cluster on the right (share / more /
 * export / add). Uses the same tonal accent overlay as the grid card
 * so the detail page reads as a continuation of the card the user
 * just clicked.
 *
 * The "More" button doubles as the row's destructive-action menu.
 * The owner can delete the collection from there; non-owner accepted
 * members can leave it. Both actions confirm inline before firing.
 */
export function CollectionHero({
  collection,
  onAddItems,
  onNewScan,
  isOwner = false,
  canLeave = false,
  onDelete,
  onLeave,
  onTogglePin,
  shareUrl,
  onManageAccess,
}: {
  collection: Collection;
  onAddItems?: () => void;
  /** Opens the scan composer as a modal pre-linked to this
   *  collection — distinct from `onAddItems` which picks already-saved
   *  scans from the library. */
  onNewScan?: () => void;
  isOwner?: boolean;
  canLeave?: boolean;
  onDelete?: () => Promise<void> | void;
  onLeave?: () => Promise<void> | void;
  onTogglePin?: () => Promise<void> | void;
  shareUrl?: string;
  onManageAccess?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );
  const [confirming, setConfirming] = useState<"delete" | "leave" | null>(
    null,
  );
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Anchor the menu to the trigger button's viewport rect. Re-measured
  // on resize/scroll while open so the popup tracks the page. The hero
  // sets `overflow: hidden` for its tonal accent, so the menu has to be
  // portaled out — otherwise it gets clipped under the hero's bottom
  // edge.
  useEffect(() => {
    if (!menuOpen) return;
    const measure = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        !menuRef.current?.contains(t) &&
        !triggerRef.current?.contains(t)
      ) {
        setMenuOpen(false);
        setConfirming(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setConfirming(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    try {
      if (confirming === "delete") {
        await onDelete?.();
      } else if (confirming === "leave") {
        await onLeave?.();
      }
      setMenuOpen(false);
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  }

  const showDelete = isOwner && Boolean(onDelete);
  const showLeave = !isOwner && canLeave && Boolean(onLeave);
  const hasMenuItems = showDelete || showLeave;

  return (
    <header className={`coll-hero coll-tone-${collection.tone}`}>
      <div className={`coll-hero-accent coll-pat-${collection.pattern}`} aria-hidden />

      <div className="coll-hero-inner">
        <div className="coll-hero-main">
          {isOwner && onTogglePin ? (
            <button
              type="button"
              className={`coll-hero-pin-btn${collection.pinned ? " is-pinned" : ""}`}
              aria-pressed={Boolean(collection.pinned)}
              aria-label={collection.pinned ? "Unpin collection" : "Pin collection"}
              onClick={() => {
                void onTogglePin();
              }}
            >
              <Icon name="pin" size={12} />
              {collection.pinned ? "Pinned" : "Pin"}
            </button>
          ) : collection.pinned ? (
            <Pill tone="neutral" compact className="coll-hero-pin">
              Pinned
            </Pill>
          ) : null}
          <h1 className="coll-hero-title">{collection.title}</h1>
          <p className="coll-hero-desc">{collection.description}</p>

          <div className="coll-hero-meta">
            <span>
              <strong>{collection.itemCount}</strong> items
            </span>
            <span className="coll-meta-dot" aria-hidden />
            <span>
              Created <strong>{collection.created}</strong>
            </span>
            <span className="coll-meta-dot" aria-hidden />
            <span>{collection.updated}</span>
            <span className="coll-meta-dot" aria-hidden />
            <span className="coll-hero-members">
              <span className="coll-hero-avs">
                {collection.collaborators.map((c, i) => (
                  <span
                    key={`${c.initials}-${i}`}
                    className="coll-shared-slot"
                    style={{ marginLeft: i === 0 ? 0 : -6 }}
                  >
                    <Avatar initials={c.initials} size="sm" src={c.avatarSrc} />
                  </span>
                ))}
              </span>
              <strong>{collection.members.length} members</strong>
            </span>
          </div>
        </div>

        <div className="coll-hero-actions">
          <button
            type="button"
            className="icon-square"
            aria-label="Share"
            onClick={() => shareUrl && setShareOpen(true)}
            disabled={!shareUrl}
          >
            <Icon name="share" size={14} />
          </button>

          <button
            ref={triggerRef}
            type="button"
            className="icon-square"
            aria-label="More"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((v) => !v);
              setConfirming(null);
            }}
          >
            <Icon name="more" size={14} />
          </button>

          <Button variant="secondary">
            <Icon name="file-text" size={14} />
            Export report
          </Button>
          <Button
            variant="secondary"
            onClick={onNewScan}
            disabled={!onNewScan}
          >
            <Icon name="plus" size={14} />
            New scan
          </Button>
          <Button
            variant="primary"
            onClick={onAddItems}
            disabled={!onAddItems}
          >
            <Icon name="plus" size={14} />
            Add items
          </Button>
        </div>
      </div>

      {shareOpen && shareUrl && (
        <ShareCollectionModal
          collectionTitle={collection.title}
          collectionUrl={shareUrl}
          onClose={() => setShareOpen(false)}
          onManageAccess={onManageAccess}
        />
      )}

      {menuOpen &&
        menuPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="coll-hero-menu"
            role="menu"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            {!hasMenuItems && (
              <div className="coll-hero-menu-empty">Nothing to do here.</div>
            )}

            {hasMenuItems && confirming === null && (
              <>
                {showDelete && (
                  <button
                    type="button"
                    role="menuitem"
                    className="coll-hero-menu-item coll-hero-menu-item--danger"
                    onClick={() => setConfirming("delete")}
                  >
                    <Icon name="trash" size={13} />
                    Delete collection
                  </button>
                )}
                {showLeave && (
                  <button
                    type="button"
                    role="menuitem"
                    className="coll-hero-menu-item"
                    onClick={() => setConfirming("leave")}
                  >
                    <Icon name="log-out" size={13} />
                    Leave collection
                  </button>
                )}
              </>
            )}

            {confirming !== null && (
              <div className="coll-hero-menu-confirm">
                <p className="coll-hero-menu-confirm-title">
                  {confirming === "delete"
                    ? "Delete this collection?"
                    : "Leave this collection?"}
                </p>
                <p className="coll-hero-menu-confirm-body">
                  {confirming === "delete"
                    ? "Items in the collection are unaffected, but every collaborator loses access. This can't be undone."
                    : "You'll lose access to its items until someone re-invites you."}
                </p>
                <div className="coll-hero-menu-confirm-actions">
                  <button
                    type="button"
                    className="coll-modal-btn coll-modal-btn-ghost"
                    onClick={() => setConfirming(null)}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={
                      confirming === "delete"
                        ? "coll-modal-btn coll-modal-btn-danger"
                        : "coll-modal-btn coll-modal-btn-primary"
                    }
                    onClick={handleConfirm}
                    disabled={busy}
                  >
                    {busy
                      ? "…"
                      : confirming === "delete"
                        ? "Yes, delete"
                        : "Yes, leave"}
                  </button>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </header>
  );
}
