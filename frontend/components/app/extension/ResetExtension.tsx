"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useExtensionPrefsContext } from "./ExtensionPrefsContext";
import styles from "./ResetExtension.module.css";

/** Single danger row at the bottom of the extension page — clears
 *  the user's extension_prefs row to defaults. The drawer picks up
 *  the change live via PB realtime. */
export function ResetExtension() {
  const { reset, saving } = useExtensionPrefsContext();
  const [busy, setBusy] = useState(false);

  const onReset = async () => {
    if (!confirm("Reset all extension preferences to defaults?")) return;
    setBusy(true);
    try {
      await reset();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.zone}>
      <div className={styles.icon} aria-hidden>
        <Icon name="alert-triangle" size={16} />
      </div>
      <div className={styles.body}>
        <h4 className={styles.title}>Reset extension to defaults</h4>
        <p className={styles.text}>
          Clears all per-site rules, custom shortcuts, and preferences.
          Doesn&apos;t affect your account or scan history.
        </p>
      </div>
      <button
        type="button"
        className={styles.btn}
        onClick={() => void onReset()}
        disabled={busy || saving}
      >
        <Icon name="refresh" size={13} />
        {busy ? "Resetting…" : "Reset to defaults"}
      </button>
    </div>
  );
}
