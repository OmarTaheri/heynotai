"use client";

import { Icon } from "@/components/Icon";
import { SiteFavicon } from "@/components/ui/SiteFavicon";
import type { ContentType, SiteMode, SiteRule } from "@/lib/extension-data";
import styles from "./SiteRow.module.css";

/** One row in the per-site rules list — favicon + domain + what the
 *  rule does + clickable mode chip + content-type chips + remove
 *  button. Click on the mode chip cycles auto → click → off (handled
 *  by parent via `onCycleMode`).
 *
 *  The sub-line used to read "<n> scans · 7 days · <n> flagged AI" from
 *  per-site counters that nothing ever incremented, so every row said
 *  the same frozen numbers. It now describes the rule itself, which is
 *  the thing this row actually controls. */
export function SiteRow({
  rule,
  onCycleMode,
  onRemove,
}: {
  rule: SiteRule;
  onCycleMode: (domain: string) => void;
  onRemove?: (domain: string) => void;
}) {
  const { domain, initial, brand, mode, types, typesOff, customStats } = rule;
  const stats = customStats ?? MODE_DESCRIPTION[mode];

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

      {onRemove && (
        <button
          type="button"
          className={styles.action}
          onClick={() => onRemove(domain)}
          aria-label={`Remove rule for ${domain}`}
          title={`Remove rule for ${domain}`}
        >
          <Icon name="trash" size={13} />
        </button>
      )}
    </div>
  );
}

const MODE_LABEL: Record<SiteMode, string> = {
  auto: "Auto-scan",
  click: "Click only",
  off: "Off",
};

const MODE_DESCRIPTION: Record<SiteMode, string> = {
  auto: "Scanned automatically as you browse",
  click: "Only scanned when you ask",
  off: "Paused — never scanned",
};

const MODE_ICON: Record<SiteMode, "globe" | "check" | "x"> = {
  auto: "globe",
  click: "check",
  off: "x",
};

// Re-export for callers that want the chip styling reference; not used elsewhere.
export type { ContentType };
