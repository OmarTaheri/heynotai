"use client";

import { useEffect } from "react";
import { Icon } from "@/components/Icon";
import { DropCard } from "@/components/app/home/DropCard";
import styles from "./EditorTopBar.module.css";

export function ScanModal({ onClose }: { onClose: () => void }) {
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

  return (
    <div
      className="auth-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Start a new scan"
    >
      <div
        className={styles.scanDialog}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.scanClose}
          onClick={onClose}
          aria-label="Close"
        >
          <Icon name="x" size={16} />
        </button>
        <DropCard />
      </div>
    </div>
  );
}
