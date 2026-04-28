import { Icon, type IconName } from "@/components/Icon";
import styles from "./OriginBadge.module.css";

export type Origin = "ext" | "up" | "url" | "mon" | "paste";

const ICON: Record<Origin, IconName> = {
  ext: "puzzle",
  up: "upload",
  url: "link",
  mon: "activity",
  paste: "paperclip",
};

/** Tiny icon badge that says where a scan originated — extension click,
 *  manual upload, URL paste, or a monitor poll. */
export function OriginBadge({ origin }: { origin: Origin }) {
  return (
    <span className={`${styles.badge} ${styles[origin]}`} aria-hidden>
      <Icon name={ICON[origin]} size={12} />
    </span>
  );
}
