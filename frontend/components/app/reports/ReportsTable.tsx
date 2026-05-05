import type { Report } from "@/lib/reports-data";
import { Table } from "@/components/ui/Table";
import { ReportRow } from "./ReportRow";
import styles from "./ReportsTable.module.css";

/**
 * Reports list. Wraps the shared Table primitive with the section
 * header (title + total/shared counts). Column widths come from the
 * `--reports-cols` custom property declared on `.reports-page`, so the
 * responsive collapses in `reports.css` still apply.
 */
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
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          <span>Your reports</span>
          <span className={styles.subtitle}>
            · {totalCount} total · {sharedCount} shared
          </span>
        </h2>
      </div>

      <Table columns="var(--reports-cols)" className="reports-grid">
        <Table.Header>
          <Table.HeaderCell aria-hidden />
          <Table.HeaderCell>Report</Table.HeaderCell>
          <Table.HeaderCell>Format</Table.HeaderCell>
          <Table.HeaderCell>Status</Table.HeaderCell>
          <Table.HeaderCell>Stats</Table.HeaderCell>
          <Table.HeaderCell align="right">Updated</Table.HeaderCell>
          <Table.HeaderCell aria-hidden />
        </Table.Header>

        {reports.length === 0 ? (
          <Table.Empty>No reports match these filters.</Table.Empty>
        ) : (
          <Table.Body>
            {reports.map((report) => (
              <ReportRow key={report.id} report={report} />
            ))}
          </Table.Body>
        )}
      </Table>
    </section>
  );
}
