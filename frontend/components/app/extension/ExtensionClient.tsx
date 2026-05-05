"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { SaveBar } from "@/components/app/settings/SaveBar";
import { StatusHero } from "./StatusHero";
import { BrowserSupport } from "./BrowserSupport";
import { PrivacyCallout } from "./PrivacyCallout";
import { ScanBehaviorSection } from "./ScanBehaviorSection";
import { PlatformsSection } from "../extension-prefs/PlatformsSection";
import { PerSiteRulesSection } from "../extension-prefs/PerSiteRulesSection";
import { AlertsSection } from "./AlertsSection";
import { HotkeysSection } from "./HotkeysSection";
import { AdvancedSection } from "./AdvancedSection";
import { ResetExtension } from "./ResetExtension";
import {
  ExtensionPrefsProvider,
  useExtensionPrefsContext,
} from "../extension-prefs/ExtensionPrefsContext";

export function ExtensionClient() {
  return (
    <ExtensionPrefsProvider>
      <div className="panel-reveal">
        <PageHeader
          title="Extension"
          subtitle="Configure how Detect runs in your browser. Choose what gets scanned, when, and how alerts behave."
          actions={
            <Button variant="secondary">
              <Icon name="info" size={13} />
              What&apos;s this?
            </Button>
          }
        />

        <div className="extension-stack">
          <StatusHero />
          <BrowserSupport />
          <PrivacyCallout />
          <ScanBehaviorSection />
          <PlatformsSection />
          <PerSiteRulesSection />
          <AlertsSection />
          <HotkeysSection />
          <AdvancedSection />
          <ResetExtension />

          <ExtensionSaveBar />
        </div>
      </div>
    </ExtensionPrefsProvider>
  );
}

function ExtensionSaveBar() {
  const { dirty, save, discard, saving } = useExtensionPrefsContext();
  return (
    <SaveBar
      count={dirty ? 1 : 0}
      onSave={saving ? undefined : () => void save()}
      onDiscard={saving ? undefined : discard}
    />
  );
}
