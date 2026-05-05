"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";

/**
 * Modal launched from the hero "Share" button. Shows the collection's
 * URL with a copy action, plus a one-line reminder that access is
 * gated by `collection_members` — recipients still need an invite.
 *
 * Portaled to `document.body` so the panel-reveal transform on shell
 * children doesn't trap our `position: fixed` overlay, and so the
 * popup stacks on top of every other surface on the page.
 */
export function ShareCollectionModal({
  collectionTitle,
  collectionUrl,
  onClose,
  onManageAccess,
}: {
  collectionTitle: string;
  collectionUrl: string;
  onClose: () => void;
  onManageAccess?: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

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

  async function copy() {
    try {
      await navigator.clipboard.writeText(collectionUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Fall back to a manual prompt if clipboard access is blocked.
      window.prompt("Copy this link", collectionUrl);
    }
  }

  const dialog = (
    <div
      onMouseDown={onClose}
      className="auth-overlay coll-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-collection-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="auth-card coll-modal-card coll-share-card"
      >
        <header className="coll-modal-head">
          <div>
            <h2 id="share-collection-title" className="coll-modal-title">
              Share “{collectionTitle}”
            </h2>
            <p className="coll-add-sub">
              Anyone with the link still needs an invite — sharing the URL is a
              shortcut, not a bypass.
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

        <div className="coll-share-row">
          <input
            type="text"
            readOnly
            value={collectionUrl}
            className="coll-modal-input coll-share-input"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            onClick={copy}
            className="coll-modal-btn coll-modal-btn-primary coll-share-copy"
          >
            <Icon name={copied ? "check" : "link"} size={13} />
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <footer className="coll-modal-foot">
          {onManageAccess && (
            <button
              type="button"
              onClick={() => {
                onManageAccess();
                onClose();
              }}
              className="coll-modal-btn coll-modal-btn-ghost coll-share-manage"
            >
              <Icon name="users" size={13} />
              Manage who can access
            </button>
          )}
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
