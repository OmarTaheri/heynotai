"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SettingsSection } from "@/components/app/settings/SettingsSection";
import { SITE_MODE_OPTIONS, type SiteMode } from "@/lib/extension-data";
import { SiteRow } from "./SiteRow";
import { useExtensionPrefsContext } from "./ExtensionPrefsContext";
import type { Site } from "@heynotai/shared";
import styles from "./PerSiteRulesSection.module.css";

const NEXT_MODE: Record<SiteMode, SiteMode> = {
  auto: "click",
  click: "off",
  off: "auto",
};

/** Reads/writes `extension_prefs.sites`. The richer fields (mode,
 *  types, scans7d) used by the UI are kept on the JSON row alongside
 *  the bare extension-side `Site` shape. */
export function PerSiteRulesSection() {
  const { prefs, patch } = useExtensionPrefsContext();
  const [defaultMode, setDefaultMode] = useState<SiteMode>("click");
  const [adding, setAdding] = useState("");

  const sites = (prefs?.sites ?? []) as Array<Site & { mode?: SiteMode }>;

  const updateSites = (next: Array<Site & { mode?: SiteMode }>) =>
    patch({ sites: next });

  const cycleMode = (host: string) => {
    updateSites(
      sites.map((s) =>
        s.host === host
          ? { ...s, mode: NEXT_MODE[s.mode ?? "click"] }
          : s,
      ),
    );
  };

  const addSite = () => {
    const clean = adding.trim().replace(/^https?:\/\//, "").replace(/^www\./, "");
    if (!clean) return;
    if (sites.some((s) => s.host === clean)) return;
    updateSites([
      { host: clean, enabled: true, count: 0, ai: 0, mode: defaultMode },
      ...sites,
    ]);
    setAdding("");
  };

  return (
    <SettingsSection
      id="per-site-rules"
      title="Per-site rules"
      description="Choose how the extension behaves on specific sites."
    >
      <Card>
        <div className={styles.modeBar}>
          <div className={styles.modeBarL}>
            <div className={styles.modeQ}>Default mode for new sites</div>
            <div className={styles.modeHelp}>
              When you visit a site not on this list, what should the extension do?
            </div>
          </div>
          <SegmentedControl
            value={defaultMode}
            onChange={setDefaultMode}
            options={SITE_MODE_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
            ariaLabel="Default mode for new sites"
          />
        </div>

        <div className={styles.addRow}>
          <input
            type="text"
            className={`settings-input mono ${styles.addInput}`}
            placeholder="Add a domain — e.g. nytimes.com"
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSite();
              }
            }}
          />
          <Button variant="primary" onClick={addSite}>
            <Icon name="plus" size={12} />
            Add rule
          </Button>
        </div>

        <div>
          {sites.map((s) => (
            <SiteRow
              key={s.host}
              rule={{
                domain: s.host,
                initial: s.host[0]?.toUpperCase() ?? "·",
                brand: "x",
                scans7d: s.count ?? 0,
                flagged7d: s.ai ?? 0,
                mode: (s.mode ?? "click") as SiteMode,
                types: ["txt", "img", "vid"],
                typesOff: [],
              }}
              onCycleMode={cycleMode}
            />
          ))}
        </div>
      </Card>
    </SettingsSection>
  );
}
