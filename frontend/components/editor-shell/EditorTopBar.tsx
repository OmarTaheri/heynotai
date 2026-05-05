"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import { readLastAppRoute } from "@/lib/last-app-route";
import type { ScanCollectionRef } from "@/lib/collection-items";
import { deleteScan } from "@/lib/scans-api";
import { AddToCollectionPopover } from "./AddToCollectionPopover";
import { ScanModal } from "./ScanModal";
import styles from "./EditorTopBar.module.css";

export interface MemberPresence {
  id: string;
  name: string;
  initials: string;
  avatarSrc?: string | null;
  isOwner?: boolean;
}

const MAX_VISIBLE_AVATARS = 4;
const POPOVER_CLOSE_DELAY_MS = 120;

/** Drives the trailing breadcrumb segment.
 *  - When `linkedCollection` is set, the crumb renders as a link to the
 *    collection page (no `+`, no "main").
 *  - Else if `onAddCollection` is set, render `+ main` where `+` opens
 *    the add-to-collection popover. `scanId: null` keeps `+` visible
 *    but disabled (anonymous / not-yet-persisted scans).
 *  - Else fall back to the legacy `crumbs` array (other editor types). */
export interface AddCollectionConfig {
  scanId: string | null;
  onLinked: (c: ScanCollectionRef) => void;
}

/** Wires the kebab menu's Delete option. `scanId: null` keeps the menu
 *  item visible but disabled (synthetic / not-yet-persisted scans).
 *  `onDeleted` defaults to navigating to `/app/library`. */
export interface DeleteConfig {
  scanId: string | null;
  onDeleted?: () => void;
}

interface Props {
  /** Trail of crumbs after the logo, e.g. ["Library", "Text scans"]. */
  crumbs: string[];
  /** Final crumb — usually the document filename (rendered in mono). */
  docName: string;
  /** Everyone with read access to the scan. The visible avatar stack is
   *  filtered to `activeIds`; the hover popover lists all of them with a
   *  green dot for online ones. Owner-first ordering is the caller's
   *  responsibility (see `fetchScanMembers`). */
  members?: MemberPresence[];
  /** User ids currently viewing this scan. */
  activeIds?: Set<string>;
  /** Slot for editor-specific actions (e.g. extra buttons). */
  actions?: ReactNode;
  linkedCollection?: ScanCollectionRef;
  onAddCollection?: AddCollectionConfig;
  onDelete?: DeleteConfig;
}

export function EditorTopBar({
  crumbs,
  docName,
  members,
  activeIds,
  actions,
  linkedCollection,
  onAddCollection,
  onDelete,
}: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const logoHref = user ? "/app" : "/";
  const [scanOpen, setScanOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const addDisabled = !onAddCollection?.scanId;

  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const moreRef = useRef<HTMLSpanElement>(null);
  const deleteDisabled = !onDelete?.scanId;

  const [membersOpen, setMembersOpen] = useState(false);
  const membersCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memberList = members ?? [];
  const activeSet = activeIds ?? new Set<string>();
  const activeMembers = memberList.filter((m) => activeSet.has(m.id));
  const visibleMembers = activeMembers.slice(0, MAX_VISIBLE_AVATARS);
  const overflowCount = Math.max(0, activeMembers.length - visibleMembers.length);

  const openMembers = () => {
    if (membersCloseTimer.current) clearTimeout(membersCloseTimer.current);
    setMembersOpen(true);
  };
  const scheduleCloseMembers = () => {
    if (membersCloseTimer.current) clearTimeout(membersCloseTimer.current);
    membersCloseTimer.current = setTimeout(
      () => setMembersOpen(false),
      POPOVER_CLOSE_DELAY_MS,
    );
  };
  useEffect(
    () => () => {
      if (membersCloseTimer.current) clearTimeout(membersCloseTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!confirmOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) setConfirmOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [confirmOpen, deleting]);

  const handleConfirmDelete = async () => {
    if (!onDelete?.scanId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteScan(onDelete.scanId);
      setConfirmOpen(false);
      if (onDelete.onDeleted) onDelete.onDeleted();
      else router.push("/app/library");
    } catch {
      setDeleteError("Couldn't delete this scan. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
    <header className={styles.bar}>
      <nav className={styles.crumb} aria-label="Breadcrumb">
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => {
            const stored = readLastAppRoute();
            if (stored) {
              router.push(stored);
              return;
            }
            router.push(user ? "/app" : "/");
          }}
          aria-label="Go back"
        >
          <Icon name="arrow-left" size={14} />
        </button>
        <Link href={logoHref} className={styles.crumbLogo} aria-label="heynotai home">
          <Logo size="sm" startClosed />
        </Link>
        {linkedCollection ? (
          <>
            <span className={styles.crumbSep}>/</span>
            <Link
              href={`/app/collections/${linkedCollection.slug || linkedCollection.id}`}
              className={styles.crumbCollectionLink}
            >
              {linkedCollection.title || "collection"}
            </Link>
          </>
        ) : onAddCollection ? (
          <span className={styles.crumbAnchor}>
            <span className={styles.crumbSep}>/</span>
            <button
              type="button"
              className={styles.crumbAddBtn}
              onClick={() => !addDisabled && setAddOpen((v) => !v)}
              disabled={addDisabled}
              aria-label="Add to collection"
              aria-haspopup="dialog"
              aria-expanded={addOpen}
              title={
                addDisabled
                  ? "Save this scan first to add it to a collection"
                  : "Add to collection"
              }
            >
              <Icon name="plus" size={12} />
            </button>
            <span>main</span>
            {!addDisabled && onAddCollection.scanId && (
              <AddToCollectionPopover
                open={addOpen}
                onClose={() => setAddOpen(false)}
                scanId={onAddCollection.scanId}
                onLinked={(c) => {
                  onAddCollection.onLinked(c);
                  setAddOpen(false);
                }}
              />
            )}
          </span>
        ) : (
          crumbs.map((c) => (
            <Fragment key={c}>
              <span className={styles.crumbSep}>/</span>
              <span>{c}</span>
            </Fragment>
          ))
        )}
        <span className={styles.crumbSep}>/</span>
        <span className={styles.crumbDoc}>{docName}</span>
      </nav>

      <div className={styles.grow} />

      {memberList.length > 0 && (
        <div
          className={styles.membersAnchor}
          onMouseEnter={openMembers}
          onMouseLeave={scheduleCloseMembers}
          onFocus={openMembers}
          onBlur={scheduleCloseMembers}
        >
          <button
            type="button"
            className={`${styles.avatars} ${styles.avatarStack} ${styles.avatarsBtn}`}
            aria-label={`Collaborators · ${activeMembers.length} active of ${memberList.length}`}
            aria-haspopup="dialog"
            aria-expanded={membersOpen}
          >
            {visibleMembers.map((m) => (
              <Avatar
                key={m.id}
                initials={m.initials}
                src={m.avatarSrc}
                size="sm"
              />
            ))}
            {overflowCount > 0 && (
              <span className={styles.avatarOverflow}>+{overflowCount}</span>
            )}
          </button>
          {membersOpen && (
            <div
              className={`${styles.popover} ${styles.popoverEnd} ${styles.membersPopover}`}
              role="dialog"
              aria-label="People with access"
              onMouseEnter={openMembers}
              onMouseLeave={scheduleCloseMembers}
            >
              <div className={styles.popoverHeader}>People with access</div>
              <div className={styles.popoverList}>
                {memberList.map((m) => {
                  const online = activeSet.has(m.id);
                  return (
                    <div key={m.id} className={styles.memberRow}>
                      <Avatar
                        initials={m.initials}
                        src={m.avatarSrc}
                        size="sm"
                      />
                      <span className={styles.memberName}>
                        {m.name}
                        {m.isOwner && (
                          <span className={styles.memberTag}> · owner</span>
                        )}
                      </span>
                      <span
                        className={`${styles.onlineDot} ${
                          online ? styles.onlineDotOn : ""
                        }`}
                        aria-label={online ? "Online" : "Offline"}
                        title={online ? "Online" : "Offline"}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className={styles.scanMore}
        onClick={() => setScanOpen(true)}
      >
        <Icon name="plus" size={14} />
        <span>New scan</span>
      </button>

      <span ref={moreRef} className={styles.moreAnchor}>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => setMoreOpen((v) => !v)}
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
        >
          <Icon name="more" size={18} />
        </button>
        {moreOpen && (
          <div
            className={`${styles.popover} ${styles.popoverEnd}`}
            role="menu"
            aria-label="More actions"
          >
            <div className={styles.popoverList}>
              <button
                type="button"
                role="menuitem"
                className={`${styles.popoverItem} ${styles.popoverItemDanger}`}
                onClick={() => {
                  setMoreOpen(false);
                  setDeleteError(null);
                  setConfirmOpen(true);
                }}
                disabled={deleteDisabled}
                title={
                  deleteDisabled
                    ? "Save this scan first to delete it"
                    : undefined
                }
              >
                <span className={styles.popoverItemTitle}>
                  <Icon name="trash" size={14} />
                  <span>Delete scan</span>
                </span>
              </button>
            </div>
          </div>
        )}
      </span>

      {actions}
    </header>
    {scanOpen && <ScanModal onClose={() => setScanOpen(false)} />}
    {confirmOpen && (
      <div
        className="auth-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
        onMouseDown={() => {
          if (!deleting) setConfirmOpen(false);
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-scan-title"
      >
        <div
          className={styles.confirmDialog}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className={styles.confirmTitle}>
            <span className={styles.confirmIcon} aria-hidden>
              <Icon name="alert-triangle" size={16} />
            </span>
            <h2 id="delete-scan-title">Delete this scan?</h2>
          </div>
          <p className={styles.confirmBody}>
            This permanently removes the scan and its detection results. This
            can&apos;t be undone.
          </p>
          {deleteError && (
            <div className={styles.confirmError}>{deleteError}</div>
          )}
          <div className={styles.confirmActions}>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmDelete}
              disabled={deleting || deleteDisabled}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
