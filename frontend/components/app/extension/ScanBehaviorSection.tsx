import { SettingsSection } from "@/components/app/settings/SettingsSection";
import { SCAN_BEHAVIORS } from "@/lib/extension-data";
import { ToggleRows } from "./ToggleRows";

export function ScanBehaviorSection() {
  return (
    <SettingsSection
      id="scan-behavior"
      title="Scan behavior"
      description="Control how the extension reads pages."
    >
      <ToggleRows settings={SCAN_BEHAVIORS} />
    </SettingsSection>
  );
}
