import { DAY_GROUP_LABEL, type DayGroup } from "@/lib/updates-data";
import styles from "./DayMarker.module.css";

/**
 * Day-group divider rendered inline in the timeline (e.g. "This week",
 * "Last week"). The bead sits on the rail in the same column as the
 * update markers so the rail reads as one continuous spine.
 */
export function DayMarker({ group }: { group: DayGroup }) {
  const meta = DAY_GROUP_LABEL[group];
  return (
    <div className={styles.row}>
      <span className={styles.bead} aria-hidden>
        <span className={styles.beadInner} />
      </span>
      <div className={styles.body}>
        <h2 className={styles.title}>
          {meta.lead} <em>{meta.em}</em>
        </h2>
        <span className={styles.range}>{meta.range}</span>
      </div>
    </div>
  );
}
