import { Icon } from "@/components/Icon";
import styles from "./PrivacyCallout.module.css";

/** Soft green privacy reassurance banner — explains exactly what the
 *  extension does and doesn't read. Sits between the browser row and
 *  the scan-behavior settings so users see the promise before tuning
 *  the toggles. */
export function PrivacyCallout() {
  return (
    <aside className={styles.box}>
      <span className={styles.icon} aria-hidden>
        <Icon name="shield" size={16} />
      </span>
      <p className={styles.text}>
        <strong>Privacy promise.</strong> The extension only sends content
        to Detect when you scan it (right-click or auto-scan rule). We
        never log your browsing history, mouse movement, or keystrokes.
        Page content scanned is held only long enough to compute a
        verdict, then discarded — unless you save it to your Library.
      </p>
    </aside>
  );
}
