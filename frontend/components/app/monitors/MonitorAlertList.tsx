import type { MonitorAlert } from "@/lib/monitors-data";
import { MonitorAlertRow } from "./MonitorAlertRow";

/**
 * Stack of recent-alert rows. Plain wrapper — each row is its own card
 * (border + bg) so the grouping reads like the extension's notification
 * list rather than a single table.
 */
export function MonitorAlertList({ alerts }: { alerts: MonitorAlert[] }) {
  return (
    <div className="mon-alert-list">
      {alerts.map((a) => (
        <MonitorAlertRow key={a.id} alert={a} />
      ))}
    </div>
  );
}
