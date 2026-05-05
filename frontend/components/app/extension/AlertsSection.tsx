"use client";

import { SettingsSection } from "@/components/app/settings/SettingsSection";
import { ALERT_SETTINGS } from "@/lib/extension-data";
import { ToggleRows, ExtraRow } from "./ToggleRows";
import { useExtensionPrefsContext } from "../extension-prefs/ExtensionPrefsContext";

/** Alerts & notifications. Toggles are stored in extension_prefs.flags;
 *  the threshold slider feeds extension_prefs.notifications.threshold. */
export function AlertsSection() {
  const { prefs, patch } = useExtensionPrefsContext();
  const threshold = prefs?.notifications.threshold ?? 75;

  return (
    <SettingsSection
      id="alerts"
      title="Alerts & notifications"
      description="How the extension tells you it found something."
    >
      <ToggleRows
        settings={ALERT_SETTINGS}
        extraRows={
          <ExtraRow
            name="Minimum confidence to alert"
            description="Don't show alerts for verdicts below this threshold. Higher values reduce noise but miss low-confidence catches."
            control={
              <select
                className="settings-input"
                value={String(threshold)}
                onChange={(e) =>
                  prefs &&
                  patch({
                    notifications: {
                      ...prefs.notifications,
                      threshold: Number(e.target.value),
                    },
                  })
                }
                style={{ flex: "0 0 auto", minWidth: 120 }}
              >
                <option value="50">≥ 50%</option>
                <option value="75">≥ 75%</option>
                <option value="90">≥ 90%</option>
              </select>
            }
          />
        }
      />
    </SettingsSection>
  );
}
