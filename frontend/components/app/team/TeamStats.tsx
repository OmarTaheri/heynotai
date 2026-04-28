import { StatGrid, StatTile } from "@/components/ui/StatTile";
import { WORKSPACE } from "@/lib/team-data";

/**
 * Four-stat KPI strip for the Team page. Pure server component — values
 * read from the shared workspace fixture so this stays in sync with the
 * identity card above it.
 */
export function TeamStats() {
  const seatsAvailable = WORKSPACE.seatsTotal - WORKSPACE.seatsUsed;
  return (
    <StatGrid>
      <StatTile
        label="Seats used"
        value={String(WORKSPACE.seatsUsed)}
        unit={`/ ${WORKSPACE.seatsTotal}`}
        delta={
          <span>
            <strong>{seatsAvailable}</strong> seats available
          </span>
        }
        tone="up"
      />
      <StatTile
        label="Team scans · 30d"
        value="3,842"
        delta={
          <span>
            <strong>+42%</strong> vs last month
          </span>
        }
        tone="up"
      />
      <StatTile
        label="Tokens this month"
        value="187"
        unit="k"
        delta={
          <span>
            of <strong>500k</strong> pooled
          </span>
        }
        tone="down"
      />
      <StatTile
        label="Shared collections"
        value="5"
        delta={
          <span>
            <strong>2</strong> active today
          </span>
        }
        tone="up"
      />
    </StatGrid>
  );
}
