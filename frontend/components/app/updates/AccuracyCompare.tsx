import { ProgressBar } from "@/components/ui/ProgressBar";
import type { AccuracyCompare as AccuracyCompareData } from "@/lib/updates-data";
import styles from "./AccuracyCompare.module.css";

/**
 * Before/after accuracy comparison. Two `ProgressBar` rows
 * (info-toned, dimmed before / full after) plus a `+N` delta chip. Used
 * inside accuracy update cards.
 */
export function AccuracyCompare({ data }: { data: AccuracyCompareData }) {
  const delta = data.after - data.before;
  return (
    <div className={styles.wrap}>
      <div className={styles.before}>
        <ProgressBar name={data.beforeLabel} value={data.before} tone="info" />
      </div>
      <div className={styles.after}>
        <div className={styles.afterBar}>
          <ProgressBar name={data.afterLabel} value={data.after} tone="info" />
        </div>
        <span className={styles.delta}>
          {delta >= 0 ? "+" : ""}
          {delta}
        </span>
      </div>
    </div>
  );
}
