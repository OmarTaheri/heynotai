import { Icon } from "@/components/Icon";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { Table } from "@/components/ui/Table";
import type { Report, ReportStatus } from "@/lib/reports-data";
import { DocPreviewIcon } from "./DocPreviewIcon";
import { FormatBadge } from "./FormatBadge";
import styles from "./ReportRow.module.css";

const STATUS_TONE: Record<ReportStatus, PillTone> = {
  shared: "info",
  public: "info",
  team: "info",
  ready: "human",
  sent: "human",
  downloaded: "human",
  draft: "neutral",
  expired: "warn",
};

/** One row in the reports table. Column widths come from the parent
 *  Table primitive (see `--reports-cols` on `.reports-page`). */
export function ReportRow({ report }: { report: Report }) {
  return (
    <Table.Row>
      <Table.Cell>
        <DocPreviewIcon bands={report.bands} dim={report.dim} />
      </Table.Cell>

      <Table.Cell className={styles.info}>
        <div className={styles.title}>{report.title}</div>
        <div className={styles.meta}>
          <span className={styles.source}>
            <Icon name="folder" size={9} />
            {report.source}
          </span>
          <span>{report.meta}</span>
        </div>
      </Table.Cell>

      <Table.Cell>
        <FormatBadge format={report.format} label={report.formatLabel} />
      </Table.Cell>

      <Table.Cell>
        <Pill tone={STATUS_TONE[report.status]} dot compact>
          {report.statusLabel}
        </Pill>
      </Table.Cell>

      <Table.Cell className={styles.stats}>
        {report.stats.map((stat, i) => (
          <div key={i} className={styles.statRow}>
            <Icon name={stat.icon} size={10} />
            <span>{stat.label}</span>
          </div>
        ))}
      </Table.Cell>

      <Table.Cell align="right" className={styles.time}>
        <strong>{report.updatedRel}</strong>
        <span>{report.updatedAbs}</span>
      </Table.Cell>

      <Table.Cell>
        <Table.RowAction />
      </Table.Cell>
    </Table.Row>
  );
}
