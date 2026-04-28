import { Card } from "@/components/ui/Card";
import { StatusDot } from "@/components/ui/StatusDot";
import { Sparkline } from "@/components/ui/Sparkline";
import type { UsageBar } from "@/lib/api-data";

/**
 * Quick-glance usage card next to the code sample. Reuses
 * `Sparkline` for the bar strip and `StatusDot pulse` for the
 * health indicator so the visual language stays consistent
 * with /home and /monitors.
 */
export function UsageMeter({
  used,
  quota,
  avgPerDay,
  peakValue,
  peakLabel,
  bars,
  rangeStart,
  rangeEnd,
  p50,
}: {
  used: number;
  quota: number;
  avgPerDay: number;
  peakValue: number;
  peakLabel: string;
  bars: UsageBar[];
  rangeStart: string;
  rangeEnd: string;
  p50: string;
}) {
  return (
    <Card padded className="api-usage">
      <div className="api-usage-head">
        <span className="api-tiny-lbl">API calls · 30 days</span>
        <a className="api-usage-link" href="#">
          View charts →
        </a>
      </div>

      <div className="api-usage-num">
        {used.toLocaleString()}
        <em>{` / ${(quota / 1000).toFixed(0)}k`}</em>
      </div>
      <div className="api-usage-meta">
        avg <strong>{avgPerDay.toLocaleString()} / day</strong> · peak{" "}
        <strong>{peakValue.toLocaleString()}</strong> on {peakLabel}
      </div>

      <Sparkline
        bars={bars.map((b) => ({ height: b.height, flagged: b.peak }))}
        foot={[rangeStart, rangeEnd]}
      />

      <div className="api-usage-foot">
        <div className="api-usage-foot-l">
          <StatusDot tone="ok" pulse />
          <span>API operational</span>
        </div>
        <div className="api-usage-foot-r">
          p50 <strong>{p50}</strong>
        </div>
      </div>
    </Card>
  );
}
