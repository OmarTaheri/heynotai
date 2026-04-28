import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { TypeChip, type ScanType } from "@/components/ui/TypeChip";
import { OriginBadge, type Origin } from "@/components/ui/OriginBadge";
import type { ScanVerdict } from "./LastScanCard";

export type { Origin } from "@/components/ui/OriginBadge";

export type ActivityRow = {
  id: string;
  type: ScanType;
  name: string;
  origin: Origin;
  source: string;
  confidence: number;
  verdict: ScanVerdict;
  verdictLabel: string;
  when: string;
};

/**
 * Recent-activity grid on the home page.
 *
 * A semantic <table> laid out with CSS grid on each row so the visual
 * grid (kept identical to the original design) coexists with proper
 * row/cell semantics. The table sits inside a horizontal scroll
 * container so all columns remain reachable on narrow viewports
 * instead of being hidden.
 */
export function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  return (
    <Card>
      {rows.length === 0 ? (
        <div className="home-act-empty">No activity yet.</div>
      ) : (
        <div className="home-act-scroll">
          <table className="home-act-table">
            <thead>
              <tr className="home-act-head">
                <th aria-hidden />
                <th scope="col">Item</th>
                <th scope="col">Confidence</th>
                <th scope="col">Verdict</th>
                <th scope="col" style={{ textAlign: "right" }}>
                  When
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="home-act-row">
                  <td>
                    <TypeChip type={row.type} size="lg" />
                  </td>
                  <td>
                    <div className="home-act-name">{row.name}</div>
                    <div className="home-act-meta">
                      <OriginBadge origin={row.origin} />
                      <span>{row.source}</span>
                    </div>
                  </td>
                  <td className="home-act-conf">{row.confidence}%</td>
                  <td>
                    <Pill
                      tone={row.verdict === "human" ? "human" : "ai"}
                      dot
                      compact
                    >
                      {row.verdictLabel}
                    </Pill>
                  </td>
                  <td className="home-act-time">{row.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
