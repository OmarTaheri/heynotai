import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { StatusPulse } from "@/components/ui/StatusPulse";
import { EXTENSION_META } from "@/lib/extension-data";
import styles from "./StatusHero.module.css";

/** Big status card at the top of /app/extension — shows install
 *  state, version, and the two top-level actions (reload / open
 *  store). Extension-only; sits inline with the section stack. */
export function StatusHero() {
  const m = EXTENSION_META;
  return (
    <section className={styles.hero}>
      <div className={styles.icon} aria-hidden>
        <span className={styles.iconMark}>D</span>
      </div>

      <div className={styles.info}>
        <div className={styles.statusRow}>
          <StatusPulse tone="ok" />
          <span className={styles.statusTxt}>
            Active · synced {m.lastSyncedSeconds} seconds ago
          </span>
        </div>
        <h2 className={styles.title}>
          Detect for <span className={styles.titleAccent}>{m.browser}</span>
        </h2>
        <ul className={styles.meta}>
          <li>Version <strong>{m.version}</strong></li>
          <li className={styles.dot} aria-hidden />
          <li>Auto-updates <strong>{m.autoUpdates ? "on" : "off"}</strong></li>
          <li className={styles.dot} aria-hidden />
          <li><strong>{m.scansLast7Days}</strong> scans last 7 days</li>
          <li className={styles.dot} aria-hidden />
          <li>Installed <strong>{m.installedAt}</strong></li>
        </ul>
      </div>

      <div className={styles.actions}>
        <Button variant="secondary">
          <Icon name="refresh" size={13} />
          Reload extension
        </Button>
        <Button variant="secondary" href={m.storeUrl}>
          <Icon name="upload" size={13} />
          Open Chrome store
        </Button>
      </div>
    </section>
  );
}
