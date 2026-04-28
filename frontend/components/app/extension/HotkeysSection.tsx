import { Fragment } from "react";
import { Card } from "@/components/ui/Card";
import { KeycapHint } from "@/components/ui/KeycapHint";
import { SettingsSection } from "@/components/app/settings/SettingsSection";
import { HOTKEYS } from "@/lib/extension-data";
import styles from "./HotkeysSection.module.css";

/** Read-only list of keyboard shortcuts. Customization is handled by
 *  Chrome itself at chrome://extensions/shortcuts; we just show what
 *  the defaults are. */
export function HotkeysSection() {
  return (
    <SettingsSection
      id="hotkeys"
      title="Keyboard shortcuts"
      description="Customize these in chrome://extensions/shortcuts."
    >
      <Card>
        <div className={styles.list}>
          {HOTKEYS.map((h) => (
            <div key={h.id} className={styles.row}>
              <div className={styles.label}>{h.label}</div>
              <div className={styles.keys}>
                {h.keys.map((k, i) => (
                  <Fragment key={`${h.id}-${i}`}>
                    {i > 0 && <span className={styles.plus}>+</span>}
                    <KeycapHint>{k}</KeycapHint>
                  </Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </SettingsSection>
  );
}
