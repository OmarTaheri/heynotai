"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import {
  inviteCollaborator,
  InviteError,
  type MemberRole,
} from "@/lib/collection-members";
import { searchUsers, type SearchedUser } from "@/lib/users-search";

const ROLES: { value: MemberRole; label: string; hint: string }[] = [
  { value: "editor", label: "Editor", hint: "Can add items and invite others" },
  { value: "viewer", label: "Viewer", hint: "Can read items but not change them" },
];

type CandidateUser = SearchedUser & { initials: string };

type Selection =
  | { kind: "user"; user: CandidateUser }
  | { kind: "email"; email: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Modal launched from the collection detail "Invite collaborator" button.
 * Searches the `users` collection by name / handle / email and lets the
 * inviter pick a teammate. Falls through to a "send invite to <email>"
 * row when the query looks like an unrecognized email — preserves the
 * existing email-only invite path so unregistered teammates still work.
 *
 * The actual write goes through `inviteCollaborator()`, which already
 * resolves email→userId server-side.
 */
export function InviteCollaboratorModal({
  collectionId,
  collectionTitle,
  excludeUserIds,
  onClose,
  onInvited,
}: {
  collectionId: string;
  collectionTitle: string;
  excludeUserIds?: ReadonlySet<string>;
  onClose: () => void;
  onInvited?: () => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CandidateUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [role, setRole] = useState<MemberRole>("editor");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const exclude = useMemo<ReadonlySet<string>>(() => {
    const set = new Set<string>(excludeUserIds ?? []);
    if (user) set.add(user.id);
    return set;
  }, [excludeUserIds, user]);

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
    inputRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  // Exact-email lookup. We don't surface partial matches (privacy) —
  // the inviter must know the recipient's address. Skip the network
  // call until the query is a syntactically valid email; that also
  // means typing a name shows the "type a full email" hint instead of
  // a flicker of empty results.
  useEffect(() => {
    const q = query.trim();
    if (!EMAIL_RE.test(q)) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      try {
        const list = await searchUsers(q, { signal: controller.signal });
        const candidates = list
          .map(toCandidate)
          .filter((c) => !exclude.has(c.id));
        setResults(candidates);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query, exclude]);

  const trimmed = query.trim();
  const lowered = trimmed.toLowerCase();
  // Don't offer "send invite to <self>" — even though the lib would
  // reject it as `self_invite`, surfacing the affordance reads as a bug.
  const isOwnEmail = Boolean(
    user && user.email && user.email.toLowerCase() === lowered,
  );
  const showEmailFallback =
    !selected &&
    trimmed.length > 0 &&
    EMAIL_RE.test(trimmed) &&
    !isOwnEmail &&
    (results?.length ?? 0) === 0 &&
    !searching;

  const canSubmit = !submitting && selected !== null && Boolean(user);

  function pickUser(u: CandidateUser) {
    setSelected({ kind: "user", user: u });
    setError(null);
    setSuccess(null);
  }

  function pickEmail(email: string) {
    setSelected({ kind: "email", email });
    setError(null);
    setSuccess(null);
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setResults(null);
    inputRef.current?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !user || !selected) return;
    const inviteEmail =
      selected.kind === "user" ? selected.user.email : selected.email;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await inviteCollaborator({
        collectionId,
        invitedBy: user.id,
        email: inviteEmail,
        role,
        message,
      });
      const label =
        selected.kind === "user"
          ? selected.user.name || selected.user.email
          : selected.email;
      setSuccess(`Invite sent to ${label}.`);
      setSelected(null);
      setQuery("");
      setResults(null);
      setMessage("");
      onInvited?.();
    } catch (err) {
      const msg =
        err instanceof InviteError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't send the invite.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // Portal so the panel-reveal transform on shell children doesn't
  // become this fixed-position overlay's containing block.
  const dialog = (
    <div
      onMouseDown={() => !submitting && onClose()}
      className="auth-overlay coll-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-collab-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="auth-card coll-modal-card"
      >
        <header className="coll-modal-head">
          <h2 id="invite-collab-title" className="coll-modal-title">
            Invite to “{collectionTitle}”
          </h2>
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

        <form onSubmit={handleSubmit} className="coll-modal-form">
          <div className="coll-modal-row">
            <label htmlFor="invite-search" className="coll-modal-label">
              Find a teammate
              <span className="coll-modal-required" aria-hidden>
                *
              </span>
            </label>

            {selected ? (
              <div className="coll-invite-selected">
                {selected.kind === "user" ? (
                  <>
                    <Avatar
                      initials={selected.user.initials}
                      size="md"
                      src={selected.user.avatarUrl}
                    />
                    <div className="coll-invite-selected-info">
                      <span className="coll-invite-selected-name">
                        {selected.user.name || selected.user.handle ||
                          selected.user.email}
                      </span>
                      <span className="coll-invite-selected-meta">
                        {selected.user.email}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="coll-invite-selected-iconslot" aria-hidden>
                      <Icon name="send" size={14} />
                    </span>
                    <div className="coll-invite-selected-info">
                      <span className="coll-invite-selected-name">
                        {selected.email}
                      </span>
                      <span className="coll-invite-selected-meta">
                        Will be invited by email
                      </span>
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={submitting}
                  className="coll-invite-clear"
                  aria-label="Clear selection"
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            ) : (
              <>
                <div className="coll-invite-search">
                  <Icon name="search" size={14} />
                  <input
                    ref={inputRef}
                    id="invite-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Type their full email"
                    autoComplete="off"
                    disabled={submitting}
                  />
                </div>

                <div className="coll-invite-results" role="listbox">
                  {!EMAIL_RE.test(trimmed) && !isOwnEmail && (
                    <div className="coll-invite-state">
                      Type the recipient&apos;s full email to find them.
                    </div>
                  )}
                  {EMAIL_RE.test(trimmed) &&
                    !isOwnEmail &&
                    searching &&
                    results === null && (
                      <div className="coll-invite-state">Looking up…</div>
                    )}
                  {isOwnEmail && (
                    <div className="coll-invite-state">
                      That&apos;s your own email — pick someone else.
                    </div>
                  )}
                  {results?.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      role="option"
                      aria-selected="false"
                      className="coll-invite-result"
                      onClick={() => pickUser(u)}
                      disabled={submitting}
                    >
                      <Avatar
                        initials={u.initials}
                        size="md"
                        src={u.avatarUrl}
                      />
                      <span className="coll-invite-result-info">
                        <span className="coll-invite-result-name">
                          {u.name || u.handle || u.email}
                        </span>
                        <span className="coll-invite-result-meta">
                          {u.handle ? `@${u.handle} · ` : ""}
                          {u.email}
                        </span>
                      </span>
                    </button>
                  ))}
                  {showEmailFallback && (
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      className="coll-invite-result coll-invite-result--email"
                      onClick={() => pickEmail(trimmed.toLowerCase())}
                      disabled={submitting}
                    >
                      <span className="coll-invite-selected-iconslot" aria-hidden>
                        <Icon name="send" size={14} />
                      </span>
                      <span className="coll-invite-result-info">
                        <span className="coll-invite-result-name">
                          Send invite to {trimmed.toLowerCase()}
                        </span>
                        <span className="coll-invite-result-meta">
                          Pending until they sign up
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="coll-modal-row">
            <span className="coll-modal-label">Role</span>
            <div
              className="coll-invite-roles"
              role="radiogroup"
              aria-label="Role"
            >
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={role === r.value}
                  onClick={() => setRole(r.value)}
                  disabled={submitting}
                  className={`coll-invite-role${role === r.value ? " is-selected" : ""}`}
                >
                  <span className="coll-invite-role-name">{r.label}</span>
                  <span className="coll-invite-role-hint">{r.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="coll-modal-row">
            <label htmlFor="invite-message" className="coll-modal-label">
              Message <span className="coll-modal-counter">optional</span>
            </label>
            <textarea
              id="invite-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              placeholder="What's the collaboration about?"
              maxLength={500}
              rows={3}
              disabled={submitting}
              className="coll-modal-textarea"
            />
          </div>

          {error && <p className="coll-modal-error">{error}</p>}
          {success && <p className="coll-modal-success">{success}</p>}

          <footer className="coll-modal-foot">
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              disabled={submitting}
              className="coll-modal-btn coll-modal-btn-ghost"
            >
              Done
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="coll-modal-btn coll-modal-btn-primary"
            >
              {submitting ? "Sending…" : "Send invite"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}

function toCandidate(u: SearchedUser): CandidateUser {
  const initials =
    deriveInitials(u.name) ||
    (u.handle ? u.handle.slice(0, 2).toUpperCase() : "") ||
    (u.email[0] ?? "U").toUpperCase();
  return { ...u, initials };
}

function deriveInitials(seed: string): string {
  const parts = seed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
