"use client";

import { useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterChip } from "@/components/app/library/FilterChip";

/**
 * Search field + filter chips above the items table on a collection
 * detail page. Local state only — wiring to actual list filtering will
 * land when the data layer goes real. Reuses FilterChip from the
 * library page so the chip language stays consistent.
 */
export function CollectionFilters() {
  const [query, setQuery] = useState("");

  return (
    <div className="coll-detail-filters">
      <SearchInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search in this collection…"
      />
      <FilterChip label="Verdict" value="AI only" active />
      <FilterChip label="Confidence" />
      <FilterChip label="Model" />
      <FilterChip label="Tag" />
    </div>
  );
}
