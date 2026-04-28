"use client";

import { Icon } from "@/components/Icon";
import { SETTINGS_NAV, type SettingsSectionId } from "@/lib/settings-data";
import styles from "./SettingsNav.module.css";

/** Sticky left rail that scroll-jumps between sections. Active state
 *  is owned by the parent so it can be wired to scroll-spy later. */
export function SettingsNav({
  active,
  onSelect,
}: {
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}) {
  return (
    <nav className={styles.nav} aria-label="Settings sections">
      {SETTINGS_NAV.map((item, i) => {
        const isLast = i === SETTINGS_NAV.length - 1;
        const isFirstDanger = item.danger && !SETTINGS_NAV[i - 1]?.danger;
        return (
          <div key={item.id} className={styles.cell}>
            {isFirstDanger && <div className={styles.divider} aria-hidden />}
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                onSelect(item.id);
                document
                  .getElementById(item.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={[
                styles.item,
                item.id === active && styles.active,
                item.danger && styles.danger,
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={item.id === active ? "page" : undefined}
            >
              <Icon name={item.icon} size={14} />
              <span>{item.label}</span>
            </a>
            {isLast && null}
          </div>
        );
      })}
    </nav>
  );
}
