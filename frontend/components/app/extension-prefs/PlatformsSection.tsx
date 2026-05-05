"use client";

import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { SettingsSection } from "@/components/app/settings/SettingsSection";
import {
  migrateLegacyPlatforms,
  type Platforms,
  type PlatformKey,
  type SurfaceKey,
} from "@heynotai/shared";
import { useExtensionPrefsContext } from "./ExtensionPrefsContext";
import styles from "./PlatformsSection.module.css";

type PlatformConfig<P extends PlatformKey> = {
  key: P;
  label: string;
  icon: IconName;
  surfaces: { key: SurfaceKey<P>; label: string }[];
};

const PLATFORMS: [
  PlatformConfig<"youtube">,
  PlatformConfig<"instagram">,
  PlatformConfig<"facebook">,
] = [
  {
    key: "youtube",
    label: "YouTube",
    icon: "youtube",
    surfaces: [
      { key: "videos", label: "Videos" },
      { key: "reels", label: "Reels" },
    ],
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: "instagram",
    surfaces: [
      { key: "posts", label: "Posts" },
      { key: "reels", label: "Reels" },
    ],
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: "facebook",
    surfaces: [
      { key: "posts", label: "Posts" },
      { key: "reels", label: "Reels" },
    ],
  },
];

/** Reads/writes `extension_prefs.platforms`. The master toggle on each
 *  platform row gates the per-surface sub-toggles below it. When the
 *  master is off, sub-toggles render disabled (with the user's
 *  surface state preserved so flipping the master back on restores
 *  exactly what they had). */
export function PlatformsSection() {
  const { prefs, patchAndSave } = useExtensionPrefsContext();
  const platforms: Platforms = migrateLegacyPlatforms(prefs?.platforms);

  // Auto-save on every toggle so the extension drawer picks up changes
  // instantly via PB realtime — this is a live-control surface, not a
  // dirty/save form. Other sections on /app/extension still use the
  // explicit Save bar via plain `patch()`.
  // Master ↔ surfaces are linked: toggling the master sets all
  // surfaces to match; toggling all surfaces off (or any on) flips the
  // master to match. Keeps the UI from ever showing "platform on but
  // every surface off" or vice versa.
  const setEnabled = <P extends PlatformKey>(p: P, enabled: boolean) => {
    const cfg = platforms[p];
    const surfaceKeys = Object.keys(cfg.surfaces);
    const newSurfaces = surfaceKeys.reduce<Record<string, boolean>>(
      (acc, key) => { acc[key] = enabled; return acc; },
      {},
    );
    void patchAndSave({
      platforms: {
        ...platforms,
        [p]: { ...cfg, enabled, surfaces: newSurfaces },
      } as Platforms,
    });
  };

  const setSurface = <P extends PlatformKey>(
    p: P,
    surface: SurfaceKey<P>,
    enabled: boolean,
  ) => {
    const cfg = platforms[p];
    const newSurfaces = { ...cfg.surfaces, [surface]: enabled };
    const anyOn = Object.values(newSurfaces).some(Boolean);
    void patchAndSave({
      platforms: {
        ...platforms,
        [p]: {
          ...cfg,
          enabled: anyOn,
          surfaces: newSurfaces,
        },
      } as Platforms,
    });
  };

  return (
    <SettingsSection
      id="platforms"
      title="Platforms"
      description="Pick which surfaces on each platform the extension should scan. The master toggle disables every surface for that platform at once."
    >
      <Card>
        {PLATFORMS.map((p) => {
          const cfg = platforms[p.key];
          const masterOn = cfg.enabled;
          const surfaces = cfg.surfaces as Record<string, boolean>;
          const onCount = p.surfaces.filter((s) => surfaces[s.key]).length;
          const total = p.surfaces.length;
          return (
            <div key={p.key} className={styles.platform}>
              <div className={styles.row}>
                <div className={styles.iconTile}>
                  <Icon name={p.icon} size={15} />
                </div>
                <div className={styles.body}>
                  <span className={styles.label}>{p.label}</span>
                </div>
                {masterOn && onCount < total && (
                  <span className={styles.count}>
                    {onCount}/{total}
                  </span>
                )}
                <Toggle
                  on={masterOn}
                  onChange={(v) => setEnabled(p.key, v)}
                  label={p.label}
                />
              </div>
              <div className={styles.subs}>
                {p.surfaces.map((s) => {
                  const surfaceOn = surfaces[s.key] === true;
                  return (
                    <div
                      key={s.key}
                      className={`${styles.subrow}${masterOn ? "" : " " + styles.disabled}`}
                      title={
                        masterOn ? undefined : `Enable ${p.label} to configure`
                      }
                    >
                      <span className={styles.subLabel}>{s.label}</span>
                      <Toggle
                        on={surfaceOn}
                        size="sm"
                        disabled={!masterOn}
                        onChange={(v) =>
                          setSurface(
                            p.key,
                            s.key as SurfaceKey<typeof p.key>,
                            v,
                          )
                        }
                        label={`${p.label} ${s.label}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Card>
    </SettingsSection>
  );
}
