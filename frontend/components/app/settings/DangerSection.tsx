"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { clearScanHistory, deleteAccount } from "@/lib/settings-api";
import { DANGER_ACTIONS } from "@/lib/settings-data";
import { SettingsSection } from "./SettingsSection";
import styles from "./DangerSection.module.css";

export function DangerSection() {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  const onAction = async (id: "clear-history" | "delete-account") => {
    if (id === "clear-history") {
      if (!confirm("Clear all scan history? This cannot be undone.")) return;
      setBusy(id);
      try {
        await clearScanHistory();
        alert("Scan history cleared.");
      } finally {
        setBusy(null);
      }
      return;
    }
    if (
      !confirm(
        "Permanently delete your heynotai account? You have a 30-day grace period. This cannot be undone after that.",
      )
    )
      return;
    setBusy(id);
    try {
      await deleteAccount();
      signOut();
    } finally {
      setBusy(null);
    }
  };

  return (
    <SettingsSection
      id="danger"
      title="Danger zone"
      description="These actions can't be undone. Read carefully."
    >
      <div className={styles.zone}>
        {DANGER_ACTIONS.map((action) => (
          <div key={action.id} className={styles.row}>
            <span className={styles.icon} aria-hidden>
              <Icon name={action.icon} size={16} />
            </span>
            <div className={styles.body}>
              <h4 className={styles.title}>{action.title}</h4>
              <p className={styles.text}>{action.body}</p>
            </div>
            <button
              type="button"
              className={styles.btn}
              onClick={() => void onAction(action.id)}
              disabled={busy !== null}
            >
              {busy === action.id ? "Working…" : action.buttonLabel}
            </button>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}
