"use client";

import type { ScanMode } from "@heynotai/shared";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SettingsSection } from "@/components/app/settings/SettingsSection";
import { SCAN_BEHAVIORS } from "@/lib/extension-data";
import { ToggleRows } from "./ToggleRows";
import { useExtensionPrefsContext } from "../extension-prefs/ExtensionPrefsContext";
import styles from "./ScanBehaviorSection.module.css";

const MODES: { id: ScanMode; label: string }[] = [
  { id: "manual", label: "Only when I ask" },
  { id: "allowlist", label: "My allow-list" },
  { id: "everything", label: "Everywhere" },
];

const MODE_HELP: Record<ScanMode, string> = {
  manual:
    "Nothing is scanned until you click “Check this page” or use the right-click menu.",
  allowlist:
    "Scan automatically on the platforms and sites you've enabled below. Everything else waits for you to ask.",
  everything:
    "Scan automatically wherever the extension can read the page. Per-platform pauses still win.",
};

/** Scan behaviour. The mode control writes `extension_prefs.scanMode`,
 *  which is the gate the extension's content script reads on every page
 *  (`shouldAutoScan`). It previously only existed inside the drawer, so
 *  this page described auto-scan without offering any way to change it. */
export function ScanBehaviorSection() {
  const { prefs, patch } = useExtensionPrefsContext();
  const mode: ScanMode = prefs?.scanMode ?? "allowlist";

  return (
    <SettingsSection
      id="scan-behavior"
      title="Scan behavior"
      description="Control how the extension reads pages."
    >
      <Card>
        <div className={styles.modeBar}>
          <div className={styles.modeBarL}>
            <div className={styles.modeQ}>When should scans run?</div>
            <div className={styles.modeHelp}>{MODE_HELP[mode]}</div>
          </div>
          <SegmentedControl
            value={mode}
            onChange={(next) => patch({ scanMode: next })}
            options={MODES}
            ariaLabel="When should scans run?"
          />
        </div>
      </Card>
      <ToggleRows settings={SCAN_BEHAVIORS} />
    </SettingsSection>
  );
}
