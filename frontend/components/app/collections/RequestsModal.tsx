"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth";
import {
  expandedCollection,
  expandedInviter,
  listPendingRequests,
  respondToRequest,
  type CollectionMemberRecord,
} from "@/lib/collection-members";

/**
 * Requests panel — replaces the old "Shared with me" button on
 * /app/collections. Shows every pending invite where the current user
 * is the recipient, plus actions to accept or reject. Accepted invites
 * cause the corresponding collection to appear in the user's main
 * grid (the collections viewRule was opened up at the same time the
 * `collection_members` table was added).
 */
export function RequestsModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<CollectionMemberRecord[] | null>(
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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await listPendingRequests(user.id);
        if (cancelled) return;
        setRequests(rows);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Couldn't load requests.");
        setRequests([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function decide(
    request: CollectionMemberRecord,
    decision: "accepted" | "rejected",
  ) {
    setActingId(request.id);
    setError(null);
    try {
      await respondToRequest(request.id, decision);
      setRequests((prev) =>
        prev ? prev.filter((r) => r.id !== request.id) : prev,
      );
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update request.");
    } finally {
      setActingId(null);
    }
  }

  const empty = requests !== null && requests.length === 0;

  // Portal to document.body — `.panel-reveal > *` keeps a `transform`
  // applied to every shell child, which would otherwise become the
  // containing block for our `position: fixed` overlay and trap it
  // under the page header. (See `app/styles/shell.css:.panel-reveal`.)
  const dialog = (
    <div
      onMouseDown={onClose}
      className="auth-overlay coll-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="requests-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="auth-card coll-modal-card coll-requests-card"
      >
        <header className="coll-modal-head">
          <div>
            <h2 id="requests-title" className="coll-modal-title">
              Requests
            </h2>
            <p className="coll-add-sub">
              Approve or reject collaboration invites. Accepted collections
              show up in your grid.
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

        <div className="coll-add-list">
          {requests === null && (
            <div className="coll-add-state">Loading requests…</div>
          )}
          {empty && (
            <div className="coll-add-state">
              No pending requests. When someone invites you to a collection it
              shows up here.
            </div>
          )}
          {requests?.map((request) => {
            const collection = expandedCollection(request);
            const inviter = expandedInviter(request);
            const inviterName =
              inviter?.handle?.trim() ||
              inviter?.name?.trim() ||
              inviter?.email?.split("@")[0] ||
              "Someone";
            const initials = deriveInitials(inviterName);
            return (
              <article key={request.id} className="coll-request">
                <Avatar initials={initials} size="md" />
                <div className="coll-request-info">
                  <div className="coll-request-title">
                    {inviterName} invited you to{" "}
                    <strong>{collection?.title ?? "a collection"}</strong>
                  </div>
                  <div className="coll-request-meta">
                    Role: {labelRole(request.role)}
                    {request.message ? ` · "${request.message}"` : ""}
                  </div>
                </div>
                <div className="coll-request-actions">
                  <button
                    type="button"
                    className="coll-modal-btn coll-modal-btn-ghost coll-request-btn"
                    onClick={() => decide(request, "rejected")}
                    disabled={actingId === request.id}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="coll-modal-btn coll-modal-btn-primary coll-request-btn"
                    onClick={() => decide(request, "accepted")}
                    disabled={actingId === request.id}
                  >
                    {actingId === request.id ? "…" : "Accept"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

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

function labelRole(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "viewer") return "Viewer";
  return "Editor";
}

function deriveInitials(seed: string): string {
  const parts = seed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
