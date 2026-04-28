import { Icon } from "@/components/Icon";
import { Pill } from "@/components/ui/Pill";
import type { MonitorAlert } from "@/lib/monitors-data";

/**
 * A single recent-alert row — composes Pill for the verdict label so
 * the colour language matches the rest of the app's verdict UI.
 */
export function MonitorAlertRow({ alert }: { alert: MonitorAlert }) {
  return (
    <div className="mon-alert">
      <span className="mon-alert-icon" aria-hidden>
        <Icon name="alert-triangle" size={14} />
      </span>
      <div className="mon-alert-body">
        <div className="mon-alert-title">
          <span>{alert.title}</span>
          <span className="mon-alert-from">{alert.source}</span>
        </div>
        <div className="mon-alert-meta">{alert.meta}</div>
      </div>
      <Pill tone="ai" dot compact>
        {alert.verdictLabel}
      </Pill>
      <span className="mon-alert-time">{alert.when}</span>
    </div>
  );
}
