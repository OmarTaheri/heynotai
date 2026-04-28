import { Icon } from "@/components/Icon";

/**
 * Dashed "create" tile that sits at the end of the collections grid.
 * Same dashed-border treatment as `.empty-page` so it reads as the
 * same product family.
 */
export function NewCollectionCard() {
  return (
    <button type="button" className="coll-new" aria-label="Create collection">
      <span className="coll-new-icon">
        <Icon name="plus" size={20} />
      </span>
      <span className="coll-new-title">Create collection</span>
      <span className="coll-new-sub">Start from scratch</span>
    </button>
  );
}
