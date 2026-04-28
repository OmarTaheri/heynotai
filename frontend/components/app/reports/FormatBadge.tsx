import type { ReportFormat } from "@/lib/reports-data";
import { Icon, type IconName } from "@/components/Icon";
import styles from "./FormatBadge.module.css";

const ICON: Record<ReportFormat, IconName> = {
  pdf: "file-text",
  link: "link",
  team: "users",
  csv: "list",
};

/**
 * Square icon-chip naming the report's output format. Color-coded via the
 * existing verdict-soft tokens so we match the dashboard palette without
 * inventing new ones.
 */
export function FormatBadge({
  format,
  label,
}: {
  format: ReportFormat;
  label: string;
}) {
  return (
    <div className={styles.wrap}>
      <span className={`${styles.badge} ${styles[format]}`} aria-hidden>
        <Icon name={ICON[format]} size={14} />
      </span>
      <span className={styles.text}>{label}</span>
    </div>
  );
}
