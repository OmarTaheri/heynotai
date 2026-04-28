import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { CollectionHero } from "@/components/app/collections/CollectionHero";
import { CollectionStats } from "@/components/app/collections/CollectionStats";
import { CollectionFilters } from "@/components/app/collections/CollectionFilters";
import { CollectionItemsTable } from "@/components/app/collections/CollectionItemsTable";
import { MembersPanel } from "@/components/app/collections/MembersPanel";
import { RulesPanel } from "@/components/app/collections/RulesPanel";
import { ActivityPanel } from "@/components/app/collections/ActivityPanel";
import { COLLECTIONS, getCollection } from "@/lib/collections-data";

export function generateStaticParams() {
  return COLLECTIONS.map((c) => ({ id: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const collection = getCollection(id);
  return {
    title: collection ? `${collection.title} — Collections` : "Collection",
  };
}

/**
 * Collection detail — items + members + auto-rules + activity. Server
 * component; only the inner search/filter chips and the rule toggles
 * are client-side islands.
 *
 * Reuses Breadcrumb, StatTile, Card, Button, Pill, TypeChip, Avatar,
 * FilterChip from the shared component set; everything page-specific
 * lives in components/app/collections.
 */
export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const collection = getCollection(id);
  if (!collection) notFound();

  return (
    <div className="coll-detail panel-reveal">
      <Breadcrumb
        items={[
          { label: "Collections", href: "/app/collections" },
          { label: collection.title },
        ]}
      />

      <CollectionHero collection={collection} />

      <div className="coll-detail-body">
        <main className="coll-detail-main">
          <CollectionStats collection={collection} />
          <CollectionFilters />
          <CollectionItemsTable items={collection.items} />
        </main>

        <aside className="coll-detail-side">
          <MembersPanel
            members={collection.members}
            inviteLabel={
              collection.id === "c1"
                ? "Invite teaching assistant"
                : "Invite collaborator"
            }
          />
          <RulesPanel rules={collection.rules} />
          <ActivityPanel items={collection.activity} />
        </aside>
      </div>
    </div>
  );
}
