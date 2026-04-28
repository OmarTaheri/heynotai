import { Icon } from "@/components/Icon";
import styles from "./SaveBar.module.css";

/** Sticky footer bar that surfaces unsaved changes + save/discard.
 *  Hidden when count is 0. */
export function SaveBar({
  count,
  onSave,
  onDiscard,
}: {
  count: number;
  onSave?: () => void;
  onDiscard?: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className={styles.bar} role="status" aria-live="polite">
      <div className={styles.text}>
        <Icon name="info" size={14} />
        You have <strong>{count} unsaved change{count === 1 ? "" : "s"}</strong>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.discard}`}
          onClick={onDiscard}
        >
          Discard
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.save}`}
          onClick={onSave}
        >
          Save changes
        </button>
      </div>
    </div>
  );
}
