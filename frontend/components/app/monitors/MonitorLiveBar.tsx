import { Icon } from "@/components/Icon";
import { StatusDot } from "@/components/ui/StatusDot";

/**
 * Top-of-page status strip — global "is everything running?" plus
 * Pause-all / Run-now affordances. Mirrors the home page's hero cards
 * in surface treatment but with a denser horizontal layout.
 */
export function MonitorLiveBar({
  status,
  active,
  paused,
  nextCheck,
}: {
  status: "running" | "paused";
  active: number;
  paused: number;
  nextCheck: string;
}) {
  const tone = status === "running" ? "ok" : "warn";
  const label = status === "running" ? "running" : "paused";
  return (
    <div className="mon-live">
      <div className="mon-live-l">
        <StatusDot tone={tone} pulse />
        <div>
          <div className="mon-live-text">
            All monitors <em>{label}</em>
          </div>
        </div>
        <div className="mon-live-meta">
          {active} ACTIVE · {paused} PAUSED · NEXT CHECK IN {nextCheck}
        </div>
      </div>
      <div className="mon-live-r">
        <button className="mon-live-btn" type="button">
          <Icon name="pause" size={11} />
          Pause all
        </button>
        <button className="mon-live-btn" type="button">
          <Icon name="refresh" size={11} />
          Run now
        </button>
      </div>
    </div>
  );
}
