"use client";

import { TypeChip } from "@/components/ui/TypeChip";
import { TYPE_TABS, type EngineType } from "@/lib/models-data";
import styles from "./TypeSwitcher.module.css";

type Props = {
  value: EngineType;
  onChange: (next: EngineType) => void;
  /** Caption rendered under each tile's label — typically the currently
   *  selected engine name for that type. */
  captions: Record<EngineType, string>;
};

/**
 * 4-up content-type switcher. Each tile owns a TypeChip + label + the
 * caption ("Atlas Pro · default", "Pixel Forensics · BYOK", …). The
 * active tile uses fg-on-bg the same way the library OriginTabs do, so
 * the affordance reads as one consistent dashboard pattern.
 */
export function TypeSwitcher({ value, onChange, captions }: Props) {
  return (
    <div className={styles.grid} role="tablist" aria-label="Content type">
      {TYPE_TABS.map((tab) => {
        const active = tab.type === value;
        return (
          <button
            key={tab.type}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${styles.tab} ${active ? styles.active : ""}`}
            onClick={() => onChange(tab.type)}
          >
            <TypeChip type={tab.type} size="md" />
            <span className={styles.body}>
              <span className={styles.label}>{tab.label}</span>
              <span className={styles.caption}>{captions[tab.type]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
