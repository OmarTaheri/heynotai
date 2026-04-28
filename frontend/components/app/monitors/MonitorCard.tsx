import { Icon } from "@/components/Icon";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { StatusDot, type StatusTone } from "@/components/ui/StatusDot";
import { Sparkline } from "@/components/ui/Sparkline";
import type { Monitor, MonitorStatus } from "@/lib/monitors-data";
import { MonitorTypeIcon } from "./MonitorTypeIcon";

const STATUS_PILL: Record<MonitorStatus, PillTone> = {
  alert: "ai",
  healthy: "human",
  warn: "warn",
  paused: "neutral",
};

const STATUS_DOT: Record<MonitorStatus, StatusTone> = {
  alert: "alert",
  healthy: "ok",
  warn: "warn",
  paused: "muted",
};

/**
 * One monitor row in the active-monitors list. Header (type icon, name
 * + target meta + type chip, status pill, action buttons) sits above a
 * five-column body (4 mini stats + sparkline). When `paused`, the body
 * is hidden and the whole card is dimmed — matches the mockup.
 */
export function MonitorCard({ monitor }: { monitor: Monitor }) {
  const isPaused = monitor.status === "paused";
  return (
    <article
      className={isPaused ? "mon-card mon-card-paused" : "mon-card"}
    >
      <div className="mon-card-head">
        <MonitorTypeIcon kind={monitor.kind} />
        <div className="mon-card-info">
          <div className="mon-card-name">
            <span>{monitor.name}</span>
            <span className="mon-card-type">{monitor.typeLabel}</span>
          </div>
          <div className="mon-card-target">{monitor.target}</div>
        </div>
        <Pill tone={STATUS_PILL[monitor.status]} compact>
          <StatusDot
            tone={STATUS_DOT[monitor.status]}
            pulse={!isPaused}
            size="sm"
          />
          {monitor.statusLabel}
        </Pill>
        <div className="mon-card-actions">
          {isPaused ? (
            <button className="mon-card-btn" type="button" aria-label="Resume">
              <Icon name="play" size={13} />
            </button>
          ) : (
            <>
              <button className="mon-card-btn" type="button" aria-label="Pause">
                <Icon name="pause" size={13} />
              </button>
              <button
                className="mon-card-btn"
                type="button"
                aria-label="Run now"
              >
                <Icon name="refresh" size={13} />
              </button>
            </>
          )}
          <button className="mon-card-btn" type="button" aria-label="More">
            <Icon name="more" size={13} />
          </button>
        </div>
      </div>

      {!isPaused && (
        <div className="mon-card-body">
          <Stat label="Items scanned" {...monitor.scanned} />
          <Stat label="Flagged" value={monitor.flagged.value} sub={monitor.flagged.sub} accent />
          <Stat label="Last check" value={monitor.lastCheck.value} sub={monitor.lastCheck.sub} small />
          <Stat label="Alert when" value={monitor.alertWhen.value} sub={monitor.alertWhen.sub} small />
          <div className="mon-card-spark">
            <Sparkline
              label="Activity"
              range="7 days"
              bars={monitor.spark}
              foot={["17 Apr", "TODAY"]}
            />
          </div>
        </div>
      )}
    </article>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  small,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  small?: boolean;
}) {
  const valClass = [
    "mon-card-stat-val",
    accent && "mon-card-stat-val-accent",
    small && "mon-card-stat-val-sm",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="mon-card-stat">
      <div className="mon-card-stat-lbl">{label}</div>
      <div className={valClass}>{value}</div>
      {sub && <div className="mon-card-stat-sub">{sub}</div>}
    </div>
  );
}
