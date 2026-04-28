"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import type { SettingsSectionId } from "@heynotai/shared";
import { SettingsNav } from "./SettingsNav";
import { ProfileSection } from "./ProfileSection";
import { BillingSection } from "./BillingSection";
import { SecuritySection } from "./SecuritySection";
import { NotificationsSection } from "./NotificationsSection";
import { AppearanceSection } from "./AppearanceSection";
import { PrivacySection } from "./PrivacySection";
import { DangerSection } from "./DangerSection";
import { SaveBar } from "./SaveBar";
import { SettingsRegistryProvider, useSettingsRegistry } from "./SettingsContext";

export function SettingsClient() {
  const [active, setActive] = useState<SettingsSectionId>("profile");

  return (
    <SettingsRegistryProvider>
      <div className="settings-page panel-reveal">
        <PageHeader
          title="Settings"
          subtitle="Account, billing, security, and how the app behaves. Most defaults are sensible — only change what you need."
        />

        <div className="settings-grid">
          <SettingsNav active={active} onSelect={setActive} />

          <div className="settings-stack">
            <ProfileSection />
            <BillingSection />
            <SecuritySection />
            <NotificationsSection />
            <AppearanceSection />
            <PrivacySection />
            <DangerSection />

            <SaveBarBound />
          </div>
        </div>
      </div>
    </SettingsRegistryProvider>
  );
}

function SaveBarBound() {
  const { unsavedCount, saveAll, discardAll, saving } = useSettingsRegistry();
  return (
    <SaveBar
      count={unsavedCount}
      onSave={saving ? undefined : () => void saveAll()}
      onDiscard={saving ? undefined : discardAll}
    />
  );
}
