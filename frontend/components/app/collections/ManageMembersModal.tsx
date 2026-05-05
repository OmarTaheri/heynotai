"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import {
  adaptMemberRecord,
  listCollectionMembers,
  removeMember,
  type CollectionMemberRecord,
  type MemberStatus,
} from "@/lib/collection-members";
import type { CollectionMember } from "@/lib/collections-data";

/**
 * Modal launched from the "Manage" link in the members panel. Lists
 * the collection's owner, anyone they've already brought on, and any
 * outstanding invites — and lets the owner rescind invites or remove
 * accepted members. Role changes are out of scope for this round.
 *
 * The owner row is synthesized from the parent (the owner is implicit
 * on the `collections` table — not a row in `collection_members`).
 * Pending + accepted rows come from a fresh `listCollectionMembers`
 * fetch so the modal always reflects the latest server state, even
 * if the panel that opened it was stale.
 */
export function ManageMembersModal({
  collectionId,
  collectionTitle,
  ownerMember,
  onClose,
  onChanged,
}: {
  collectionId: string;
  collectionTitle: string;
  ownerMember: CollectionMember;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [records, setRecords] = useState<CollectionMemberRecord[] | null>(
    null,
  );
  const [actingId, setActingId] = useState<string | null>(null);
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
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const refresh = useCallback(async () => {
    try {
      const rows = await listCollectionMembers(collectionId);
      setRecords(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load members.");
      setRecords([]);
    }
  }, [collectionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function rescind(membershipId: string) {
    if (!user) return;
    setActingId(membershipId);
    setError(null);
    try {
      const target = (records ?? []).find((r) => r.id === membershipId);
      const memberName = target
        ? adaptMemberRecord(target, user.id).name
        : undefined;
      await removeMember(membershipId, {
        collectionId,
        actorId: user.id,
        memberName,
      });
      setRecords((prev) =>
        prev ? prev.filter((r) => r.id !== membershipId) : prev,
      );
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update.");
    } finally {
      setActingId(null);
    }
  }

  const sortedActive = bucket(records ?? [], "accepted");
  const sortedPending = bucket(records ?? [], "pending");

  // Portal to body so `.panel-reveal > *`'s lingering transform doesn't
  // become the containing block for the modal's `position: fixed`.
  const dialog = (
    <div
      onMouseDown={onClose}
      className="auth-overlay coll-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-members-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="auth-card coll-modal-card coll-manage-card"
      >
        <header className="coll-modal-head">
          <div>
            <h2 id="manage-members-title" className="coll-modal-title">
              Manage members
            </h2>
            <p className="coll-add-sub">
              Who can see and change “{collectionTitle}”.
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

        <section className="coll-manage-section">
          <h3 className="coll-manage-heading">
            <span>Members</span>
            <span className="coll-manage-count">
              {1 + sortedActive.length}
            </span>
          </h3>
          <ul className="coll-manage-list">
            <li className="coll-manage-row">
              <Avatar
                initials={ownerMember.initials}
                size="md"
                src={ownerMember.avatarSrc}
              />
              <div className="coll-manage-info">
                <div className="coll-manage-name">
                  {ownerMember.name}
                  {ownerMember.you && (
                    <span className="coll-member-you">You</span>
                  )}
                </div>
                <div className="coll-manage-meta">
                  Owner{ownerMember.email ? ` · ${ownerMember.email}` : ""}
                </div>
              </div>
              <span className="coll-manage-role">Owner</span>
            </li>

            {records === null && (
              <li className="coll-manage-state">Loading…</li>
            )}
            {records !== null && sortedActive.length === 0 && (
              <li className="coll-manage-state">
                No collaborators yet. Invite someone to see them here.
              </li>
            )}

            {sortedActive.map((row) => {
              const m = adaptMemberRecord(row, user?.id ?? "");
              return (
                <li key={row.id} className="coll-manage-row">
                  <Avatar
                    initials={m.initials}
                    size="md"
                    src={m.avatarSrc}
                  />
                  <div className="coll-manage-info">
                    <div className="coll-manage-name">
                      {m.name}
                      {m.you && (
                        <span className="coll-member-you">You</span>
                      )}
                    </div>
                    <div className="coll-manage-meta">
                      {m.role}
                      {m.email ? ` · ${m.email}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="coll-manage-action"
                    onClick={() => rescind(row.id)}
                    disabled={actingId === row.id}
                    aria-label={`Remove ${m.name}`}
                  >
                    {actingId === row.id ? "…" : "Remove"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="coll-manage-section">
          <h3 className="coll-manage-heading">
            <span>Pending invites</span>
            <span className="coll-manage-count">{sortedPending.length}</span>
          </h3>
          <ul className="coll-manage-list">
            {records === null && (
              <li className="coll-manage-state">Loading…</li>
            )}
            {records !== null && sortedPending.length === 0 && (
              <li className="coll-manage-state">
                No outstanding invites.
              </li>
            )}
            {sortedPending.map((row) => {
              const m = adaptMemberRecord(row, user?.id ?? "");
              const display = m.name || row.invitedEmail;
              return (
                <li key={row.id} className="coll-manage-row coll-manage-row--pending">
                  <Avatar initials={m.initials} size="md" src={m.avatarSrc} />
                  <div className="coll-manage-info">
                    <div className="coll-manage-name">{display}</div>
                    <div className="coll-manage-meta">
                      Pending · {m.role}
                      {row.invitedEmail ? ` · ${row.invitedEmail}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="coll-manage-action coll-manage-action--ghost"
                    onClick={() => rescind(row.id)}
                    disabled={actingId === row.id}
                    aria-label={`Cancel invite to ${display}`}
                  >
                    {actingId === row.id ? "…" : "Cancel"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {error && <p className="coll-modal-error">{error}</p>}

        <footer className="coll-modal-foot">
          <button
            type="button"
            onClick={onClose}
            className="coll-modal-btn coll-modal-btn-ghost"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}

function bucket(
  records: CollectionMemberRecord[],
  status: MemberStatus,
): CollectionMemberRecord[] {
  return records
    .filter((r) => r.status === status)
    .sort((a, b) => (a.created < b.created ? -1 : 1));
}
