import { Icon } from "@/components/Icon";
import { Pill, type PillTone } from "@/components/ui/Pill";
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

/** One row in the reports table. Layout is grid-based and owned by
 *  ReportsTable so the header row and body rows stay aligned. */
export function ReportRow({ report }: { report: Report }) {
  return (
    <div className={styles.row}>
      <DocPreviewIcon bands={report.bands} dim={report.dim} />

      <div className={styles.info}>
        <div className={styles.title}>{report.title}</div>
        <div className={styles.meta}>
          <span className={styles.source}>
            <Icon name="folder" size={9} />
            {report.source}
          </span>
          <span>{report.meta}</span>
        </div>
      </div>

      <FormatBadge format={report.format} label={report.formatLabel} />

      <Pill tone={STATUS_TONE[report.status]} dot compact>
        {report.statusLabel}
      </Pill>

      <div className={styles.stats}>
        {report.stats.map((stat, i) => (
          <div key={i} className={styles.statRow}>
            <Icon name={stat.icon} size={10} />
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.time}>
        <strong>{report.updatedRel}</strong>
        <span>{report.updatedAbs}</span>
      </div>

      <button type="button" className={styles.action} aria-label="More actions">
        <Icon name="more" size={14} />
      </button>
    </div>
  );
}
