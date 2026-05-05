"use client";

import { type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { Pill } from "@/components/ui/Pill";
import type { ToggleSetting } from "@/lib/extension-data";
import { useExtensionPrefsContext } from "../extension-prefs/ExtensionPrefsContext";
import styles from "./ToggleRows.module.css";

/** Renders a `Card` of `name + description ↔ Toggle` rows from a list
 *  of `ToggleSetting`s. Toggle state is sourced from
 *  `extension_prefs.flags` so it persists across surfaces. */
export function ToggleRows({
  settings,
  extraRows,
}: {
  settings: ToggleSetting[];
  extraRows?: ReactNode;
}) {
  const { prefs, setFlag } = useExtensionPrefsContext();
  const flags = prefs?.flags ?? {};

  return (
    <Card>
      <div className={styles.list}>
        {settings.map((s) => {
          const tag = s.tag ?? s.locked?.tag;
          const value = s.id in flags ? flags[s.id] : s.defaultOn;
          return (
            <div key={s.id} className={styles.row}>
              <div className={styles.info}>
                <div className={styles.name}>
                  <span>{s.name}</span>
                  {tag && (
                    <Pill tone={tag.tone} compact>
                      {tag.label}
                    </Pill>
                  )}
                </div>
                <p className={styles.desc}>{s.description}</p>
              </div>
              <Toggle
                on={value}
                onChange={(next) => !s.locked && setFlag(s.id, next)}
                label={s.name}
                disabled={!!s.locked}
              />
            </div>
          );
        })}
        {extraRows}
      </div>
    </Card>
  );
}

export function ExtraRow({
  name,
  description,
  control,
}: {
  name: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.info}>
        <div className={styles.name}>
          <span>{name}</span>
        </div>
        <p className={styles.desc}>{description}</p>
      </div>
      {control}
    </div>
  );
}
