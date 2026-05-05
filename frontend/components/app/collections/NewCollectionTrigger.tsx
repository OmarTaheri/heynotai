"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { newCollectionBus } from "./new-collection-bus";

/**
 * Stateless trigger that opens the new-collection modal via the
 * shared bus. Two slots so the same component renders correctly in
 * the page header and inside the grid (where the dashed tile sits).
 */
export function NewCollectionTrigger({
  slot,
}: {
  slot: "header" | "tile";
}) {
  if (slot === "header") {
    return (
      <Button variant="primary" onClick={() => newCollectionBus.open()}>
        <Icon name="plus" size={14} />
        New collection
      </Button>
    );
  }
  return (
    <button
      type="button"
      className="coll-new"
      aria-label="Create collection"
      onClick={() => newCollectionBus.open()}
    >
      <span className="coll-new-icon">
        <Icon name="plus" size={20} />
      </span>
      <span className="coll-new-title">Create collection</span>
      <span className="coll-new-sub">Start from scratch</span>
    </button>
  );
}
