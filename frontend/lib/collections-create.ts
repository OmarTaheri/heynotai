import { ClientResponseError } from "pocketbase";
import { pb } from "./pocketbase";
import { slugify } from "./collections-slug";
import { recordActivity } from "./collection-activities";
import type {
  CollectionTone,
  CollectionPattern,
} from "./collections-data";

export type CreateCollectionInput = {
  userId: string;
  title: string;
  description?: string;
  tone: CollectionTone;
  pattern: CollectionPattern;
};

/**
 * Create a collection record in PocketBase. Slug is derived from the
 * title; on a unique-index collision, append `-2`, `-3`, etc. and
 * retry. We don't pre-check uniqueness because there's a race window
 * between check and create; letting the DB reject is the only correct
 * answer. Returns the new record (caller routes off `record.slug`).
 */
export async function createCollection(input: CreateCollectionInput) {
  const base = slugify(input.title);
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    try {
      const record = await pb.collection("collections").create({
        userId: input.userId,
        slug,
        title: input.title.trim(),
        description: input.description?.trim() ?? "",
        tone: input.tone,
        pattern: input.pattern,
        pinned: false,
      });
      void recordActivity({
        collectionId: record.id,
        actorId: input.userId,
        type: "collection.created",
      });
      return record;
    } catch (err) {
      if (isSlugConflict(err)) continue;
      throw err;
    }
  }
  throw new Error("Could not generate a unique slug after 20 attempts");
}

function isSlugConflict(err: unknown): boolean {
  if (!(err instanceof ClientResponseError)) return false;
  const data = err.response?.data as
    | { slug?: { code?: string } }
    | undefined;
  return data?.slug?.code === "validation_not_unique";
}
