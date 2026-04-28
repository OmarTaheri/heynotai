import { Card } from "@/components/ui/Card";
import type { RequestRow } from "@/lib/api-data";

/**
 * Request log table. HTTP method + status are intentionally NOT
 * `Pill`s — the table is information-dense, so they render as
 * lightweight inline tags styled in `api.css`.
 */
export function RequestsLog({ rows }: { rows: RequestRow[] }) {
  return (
    <Card className="api-log">
      <div className="api-log-head">
        <span>Method</span>
        <span>Status</span>
        <span>Path</span>
        <span>Latency</span>
        <span>Tokens</span>
        <span>Key</span>
        <span style={{ textAlign: "right" }}>When</span>
      </div>
      {rows.map((row) => (
        <div key={row.id} className="api-log-row">
          <span className={`api-log-method is-${row.method.toLowerCase()}`}>
            {row.method}
          </span>
          <span className={`api-log-status is-${row.statusTone}`}>{row.status}</span>
          <span className="api-log-path">{row.path}</span>
          <span className="api-log-latency">{row.latency}</span>
          <span className="api-log-tokens">{row.tokens}</span>
          <span className="api-log-key">{row.key}</span>
          <span className="api-log-time">{row.when}</span>
        </div>
      ))}
    </Card>
  );
}
