import { SettingsSection } from "@/components/app/settings/SettingsSection";
import { ADVANCED_SETTINGS } from "@/lib/extension-data";
import { ToggleRows } from "./ToggleRows";

export function AdvancedSection() {
  return (
    <SettingsSection
      id="advanced"
      title="Advanced"
      description="For power users — most people shouldn't touch these."
    >
      <ToggleRows settings={ADVANCED_SETTINGS} />
    </SettingsSection>
  );
}
