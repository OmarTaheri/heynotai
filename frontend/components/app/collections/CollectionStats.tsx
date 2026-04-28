import { StatGrid, StatTile } from "@/components/ui/StatTile";
import type { Collection } from "@/lib/collections-data";

/**
 * 4-tile KPI strip for the collection detail page. Reuses the global
 * StatTile primitive — only the AI-flagged tile injects a custom
 * delta node (mini split-bar visualizing flagged vs clean).
 */
export function CollectionStats({ collection }: { collection: Collection }) {
  const aiPct = Math.max(0, Math.min(100, collection.aiRate));
  const okPct = 100 - aiPct;

  return (
    <StatGrid>
      <StatTile
        label="Total items"
        value={collection.itemCount}
        delta={`${collection.graded} graded · ${collection.pending} pending`}
      />

      <StatTile
        label="AI-flagged"
        value={
          <>
            {collection.flagged}
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
        label="Avg confidence"
        value={collection.avgConfidence}
        unit="%"
        delta="±3% across items"
      />

      <StatTile
        label="Top model match"
        value={<span className="coll-stats-italic">{collection.topModel}</span>}
        delta={`${collection.topModelHits} of ${collection.flagged} flagged`}
      />
    </StatGrid>
  );
}
