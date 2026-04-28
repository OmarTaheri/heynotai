import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SectionHead } from "@/components/ui/SectionHead";
import { Icon } from "@/components/Icon";
import { CollectionsControls } from "@/components/app/collections/CollectionsControls";
import { CollectionCard } from "@/components/app/collections/CollectionCard";
import { NewCollectionCard } from "@/components/app/collections/NewCollectionCard";
import { TemplatesStrip } from "@/components/app/collections/TemplatesStrip";
import { COLLECTIONS } from "@/lib/collections-data";

export const metadata: Metadata = { title: "Collections" };

/**
 * Collections — manual project groupings (class, campaign, semester,
 * release). Server component; only the controls strip is client-side
 * for the search/view/sort local state.
 *
 * All visual primitives (PageHeader, Button, SectionHead, Pill,
 * TypeChip, Avatar, Card, IconTile) are reused from components/ui;
 * page-specific compositions live under components/app/collections.
 */
export default function CollectionsPage() {
  const pinned = COLLECTIONS.filter((c) => c.pinned);
  const rest = COLLECTIONS.filter((c) => !c.pinned);

  return (
    <div className="coll panel-reveal">
      <PageHeader
        title="Collections"
        subtitle="Group scans by project, class, or story. An item can live in more than one."
        actions={
          <>
            <Button variant="secondary">
              <Icon name="users" size={14} />
              Shared with me
            </Button>
            <Button variant="primary">
              <Icon name="plus" size={14} />
              New collection
            </Button>
          </>
        }
      />

      <CollectionsControls />

      <section className="coll-section">
        <SectionHead title="Pinned" subtitle={`${pinned.length}`} />
        <div className="coll-grid">
          {pinned.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      </section>

      <section className="coll-section">
        <SectionHead title="All collections" subtitle={`${rest.length}`} />
        <div className="coll-grid">
          {rest.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
          <NewCollectionCard />
        </div>
      </section>

      <TemplatesStrip />
    </div>
  );
}
