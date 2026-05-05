import { StatGrid, StatTile } from "@/components/ui/StatTile";
import type { CollectionStatsSummary } from "./collection-stats";

/**
 * 4-tile KPI strip for the collection detail page. Reuses the global
 * StatTile primitive — only the AI-flagged tile injects a custom
 * delta node (mini split-bar visualizing flagged vs clean).
 *
 * Stats are derived from the loaded items list, not from static fields
 * on the collection record (which PB doesn't store).
 */
export function CollectionStats({ stats }: { stats: CollectionStatsSummary }) {
  const aiPct = Math.max(0, Math.min(100, stats.aiPct));
  const okPct = 100 - aiPct;

  return (
    <StatGrid>
      <StatTile
        label="Total items"
        value={stats.itemCount}
        delta={`${stats.graded} graded · ${stats.pending} pending`}
      />

      <StatTile
        label="AI-flagged"
        value={
          <>
            {stats.flagged}
            <span className="coll-stats-frac"> · {aiPct}%</span>
          </>
        }
        tone="warn"
        delta={
          <span className="coll-stats-bar" aria-hidden>
            <span className="coll-stats-bar-ai" style={{ width: `${aiPct}%` }} />
            <span className="coll-stats-bar-ok" style={{ width: `${okPct}%` }} />
          </span>
        }
      />

      <StatTile
        label="Last scanned"
        value={stats.lastScannedRelative}
        delta={stats.lastScannedSubtitle}
      />

      <StatTile
        label="Tokens used"
        value={stats.tokensUsed.toLocaleString()}
        delta={stats.tokensSubtitle}
      />
    </StatGrid>
  );
}
