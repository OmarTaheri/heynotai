import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { CollectionsControls } from "@/components/app/collections/CollectionsControls";
import { CollectionsList } from "@/components/app/collections/CollectionsList";
import { NewCollectionTrigger } from "@/components/app/collections/NewCollectionTrigger";
import { NewCollectionModalHost } from "@/components/app/collections/NewCollectionModalHost";
import { RequestsTrigger } from "@/components/app/collections/RequestsTrigger";

export const metadata: Metadata = { title: "Collections" };

/**
 * Collections — manual project groupings (class, campaign, semester,
 * release). Server shell; the grid itself is a client island that
 * fetches the real collections owned by the user from PocketBase.
 */
export default function CollectionsPage() {
  return (
    <div className="coll panel-reveal">
      <PageHeader
        title="Collections"
        subtitle="Group scans by project, class, or story. An item can live in more than one."
        actions={
          <>
            <RequestsTrigger />
            <NewCollectionTrigger slot="header" />
          </>
        }
      />

      <CollectionsControls />

      <CollectionsList />

      <NewCollectionModalHost />
    </div>
  );
}
