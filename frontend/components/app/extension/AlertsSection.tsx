"use client";

import { SettingsSection } from "@/components/app/settings/SettingsSection";
import { ALERT_SETTINGS } from "@/lib/extension-data";
import { ToggleRows } from "./ToggleRows";

/** Alerts. Toggles are stored in `extension_prefs.flags` and read by the
 *  background worker.
 *
 *  The "Minimum confidence to alert" selector that used to live here is
 *  gone: it wrote `notifications.threshold`, which no extension code
 *  path ever consulted, so raising it silenced nothing. It comes back
 *  when desktop notifications actually ship. */
export function AlertsSection() {
  return (
    <SettingsSection
      id="alerts"
      title="Alerts"
      description="How the extension tells you it found something."
    >
      <ToggleRows settings={ALERT_SETTINGS} />
    </SettingsSection>
  );
}
