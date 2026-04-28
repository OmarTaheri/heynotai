import type { Report } from "@/lib/reports-data";
import { ReportRow } from "./ReportRow";
import styles from "./ReportsTable.module.css";

/** Bordered card that hosts the reports list. Owns the column header
 *  row; ReportRow inherits column widths via the .reports-grid class
 *  on this wrapper (see reports.css). */
export function ReportsTable({
  reports,
  totalCount,
  sharedCount,
}: {
  reports: Report[];
  totalCount: number;
  sharedCount: number;
}) {
  return (
    <section>
      <div className={styles.head}>
        <h2 className={styles.title}>
          <span>Your reports</span>
          <span className={styles.subtitle}>
            · {totalCount} total · {sharedCount} shared
          </span>
        </h2>
      </div>

      <div className={`${styles.table} reports-grid`}>
        <div className={styles.headerRow}>
          <span />
          <span>Report</span>
          <span>Format</span>
          <span>Status</span>
          <span>Stats</span>
          <span className={styles.headerRight}>Updated</span>
          <span />
        </div>

        {reports.length === 0 ? (
          <div className={styles.empty}>No reports match these filters.</div>
        ) : (
          reports.map((report) => (
            <ReportRow key={report.id} report={report} />
          ))
        )}
      </div>
    </section>
  );
}
