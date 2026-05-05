import type { Metadata } from "next";
import { CollectionDetailContent } from "@/components/app/collections/CollectionDetailContent";

export const dynamicParams = true;

export const metadata: Metadata = { title: "Collection" };

/**
 * Collection detail — items + members + auto-rules + activity. The
 * actual rendering happens in `<CollectionDetailContent>` which is
 * client-side because PB auth lives in localStorage. The server shell
 * here exists only for SEO / metadata; the human title is set in the
 * hero once the record loads.
 */
export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CollectionDetailContent slug={id} />;
}
