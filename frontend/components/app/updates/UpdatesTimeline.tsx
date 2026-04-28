import { Fragment } from "react";
import type { UpdateItem } from "@/lib/updates-data";
import { UpdateCard } from "./UpdateCard";
import { DayMarker } from "./DayMarker";
import styles from "./UpdatesTimeline.module.css";

/**
 * Walks the visible items in order and emits a `<DayMarker>` whenever
 * the `dayGroup` changes — so a marker only appears if the group still
 * has at least one visible card after filtering.
 */
export function UpdatesTimeline({
  items,
  readIds,
}: {
  items: UpdateItem[];
  readIds: Set<string>;
}) {
  if (items.length === 0) {
    return (
      <div className={styles.timeline}>
        <p className={styles.empty}>
          Nothing matches that filter yet — try another tab.
        </p>
      </div>
    );
  }

  let previousGroup: string | null = null;
  return (
    <div className={styles.timeline}>
      {items.map((item) => {
        const showMarker = item.dayGroup !== previousGroup;
        previousGroup = item.dayGroup;
        const isUnread = item.unread === true && !readIds.has(item.id);
        return (
          <Fragment key={item.id}>
            {showMarker && <DayMarker group={item.dayGroup} />}
            <UpdateCard item={item} isUnread={isUnread} />
          </Fragment>
        );
      })}
    </div>
  );
}
