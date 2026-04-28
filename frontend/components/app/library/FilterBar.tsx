"use client";

import { Icon } from "@/components/Icon";
import { FilterChip } from "./FilterChip";

export type LibraryFilters = {
  type?: string;
  verdict?: string;
  confidence?: string;
  date?: string;
  collection?: string;
};

export function FilterBar({
  query,
  onQueryChange,
  filters,
  onClear,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  filters: LibraryFilters;
  onClear: () => void;
}) {
  return (
    <div className="lib-filter-bar">
      <div className="lib-search">
        <Icon name="search" size={14} />
        <input
          type="text"
          placeholder="Search by name, URL, or content…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search library"
        />
        <span className="lib-search-kbd">⌘K</span>
      </div>

      <FilterChip label="Type" value={filters.type} active={!!filters.type} />
      <FilterChip label="Verdict" value={filters.verdict} active={!!filters.verdict} />
      <FilterChip label="Confidence" value={filters.confidence} active={!!filters.confidence} />
      <FilterChip label="Date" value={filters.date} active={!!filters.date} />
      <FilterChip label="Collection" value={filters.collection} active={!!filters.collection} />

      <button
        type="button"
        className="icon-square"
        title="Clear filters"
        aria-label="Clear filters"
        onClick={onClear}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
