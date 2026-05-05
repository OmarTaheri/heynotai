"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { DropCard } from "./DropCard";

/**
 * Centered modal hosting the same scan composer the home page uses.
 * Other surfaces (library page header, collection detail header) open
 * this instead of routing the user to /app, so their context is
 * preserved. When `linkCollectionId` is set, DropCard links the new
 * scan to that collection before the redirect/callback runs.
 */
export function NewScanModal({
  linkCollectionId,
  onClose,
  onCreated,
}: {
  linkCollectionId?: string;
  onClose: () => void;
  /** Called with the new scan id after a successful create. The
   *  default DropCard behavior (router.push to /editor/<id>) is
   *  bypassed when this is provided — the parent owns what happens
   *  next (e.g. close the modal + refresh the items list). */
  onCreated?: (scanId: string) => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const dialog = (
    <div
      onMouseDown={onClose}
      className="auth-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New scan"
        onMouseDown={(e) => e.stopPropagation()}
        className="new-scan-modal"
      >
        <button
          type="button"
          className="new-scan-modal-close"
          aria-label="Close"
          onClick={onClose}
        >
          <Icon name="x" size={14} />
        </button>
        <DropCard
          linkCollectionId={linkCollectionId}
          onCreated={onCreated}
        />
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}
