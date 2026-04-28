import { Fragment } from "react";
import type { StatBandItem } from "@/lib/updates-data";
import styles from "./StatBand.module.css";

/**
 * 3-up inline KPI band. Page-local — `StatTile` is a 4-column grid with
 * deltas, the wrong shape for the slim band that sits inside an update
 * card body.
 */
export function StatBand({ stats }: { stats: StatBandItem[] }) {
  return (
    <div className={styles.band}>
      {stats.map((s, i) => (
        <Fragment key={s.label}>
          {i > 0 && <span className={styles.divider} aria-hidden />}
          <div className={styles.item}>
            <div className={styles.value} data-tone={s.tone}>
              {s.value}
            </div>
            <div className={styles.label}>{s.label}</div>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
