"use client";

import { Icon } from "@/components/Icon";
import { SiteFavicon } from "@/components/ui/SiteFavicon";
import type { ContentType, SiteMode, SiteRule } from "@/lib/extension-data";
import styles from "./SiteRow.module.css";

/** One row in the per-site rules list — favicon + domain + scan
 *  stats + clickable mode chip + content-type chips + overflow
 *  menu. Click on the mode chip cycles auto → click → off (handled
 *  by parent via `onCycleMode`). */
export function SiteRow({
  rule,
  onCycleMode,
}: {
  rule: SiteRule;
  onCycleMode: (domain: string) => void;
}) {
  const { domain, initial, brand, scans7d, flagged7d, mode, types, typesOff, customStats } = rule;
  const stats =
    customStats ??
    (
      <>
        <strong>{scans7d}</strong> scans · 7 days · <strong>{flagged7d}</strong> flagged AI
      </>
    );

  return (
    <div className={styles.row}>
      <SiteFavicon brand={brand} initial={initial} />

      <div className={styles.info}>
        <div className={styles.domain}>{domain}</div>
        <div className={styles.stats}>{stats}</div>
      </div>

      <button
        type="button"
        className={`${styles.mode} ${styles[`mode_${mode}`]}`}
        onClick={() => onCycleMode(domain)}
        aria-label={`Mode: ${MODE_LABEL[mode]}. Click to cycle.`}
      >
        <Icon name={MODE_ICON[mode]} size={10} />
        {MODE_LABEL[mode]}
      </button>

      <div className={styles.types}>
        {types.map((t) => (
          <span key={t} className={`${styles.chip} ${styles[`chip_${t}`]}`}>
            {t.toUpperCase()}
          </span>
        ))}
        {typesOff.map((t) => (
          <span key={`off-${t}`} className={`${styles.chip} ${styles.chipOff}`}>
            {t.toUpperCase()}
          </span>
        ))}
      </div>

      <button type="button" className={styles.action} aria-label="Row actions">
        <Icon name="more" size={13} />
      </button>
    </div>
  );
}

const MODE_LABEL: Record<SiteMode, string> = {
  auto: "Auto-scan",
  click: "Click only",
  off: "Off",
};

const MODE_ICON: Record<SiteMode, "globe" | "check" | "x"> = {
  auto: "globe",
  click: "check",
  off: "x",
};

// Re-export for callers that want the chip styling reference; not used elsewhere.
export type { ContentType };
