import { Card } from "@/components/ui/Card";
import { SharedCollectionTile } from "./SharedCollectionTile";
import type { SharedCollectionRef } from "@/lib/team-data";

export function SharedCollectionsGrid({
  items,
}: {
  items: SharedCollectionRef[];
}) {
  return (
    <Card className="team-sc-panel">
      <div className="team-sc-grid">
        {items.map((item) => (
          <SharedCollectionTile key={item.id} collection={item} />
        ))}
      </div>
    </Card>
  );
}
