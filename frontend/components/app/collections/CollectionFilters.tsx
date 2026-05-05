"use client";

import { FilterDropdown } from "@/components/ui/FilterDropdown";
import { SearchInput } from "@/components/ui/SearchInput";
import type { ScanType } from "@/components/ui/TypeChip";
import type { VerdictTone } from "@/lib/verdict-tone";

export type CollectionFilterState = {
  verdict: VerdictTone | null;
  type: ScanType | null;
  detector: string | null;
};

/**
 * Search field + filter dropdowns above the items table on a collection
 * detail page. Reuses the shared FilterDropdown so the chip + popover
 * matches the library page exactly.
 */
export function CollectionFilters({
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  detectorOptions,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  filters: CollectionFilterState;
  onFiltersChange: (next: CollectionFilterState) => void;
  detectorOptions: string[];
}) {
  const setField = <K extends keyof CollectionFilterState>(
    key: K,
    value: CollectionFilterState[K],
  ) => onFiltersChange({ ...filters, [key]: value });

  const verdictItems: Array<{ key: VerdictTone; label: string }> = [
    { key: "human", label: "Not AI" },
    { key: "mixed", label: "Medium" },
    { key: "ai", label: "AI" },
  ];

  const typeItems: Array<{ key: ScanType; label: string }> = [
    { key: "txt", label: "Text" },
    { key: "img", label: "Image" },
    { key: "aud", label: "Audio" },
    { key: "vid", label: "Video" },
    { key: "web", label: "Website" },
    { key: "soc", label: "Social" },
  ];

  return (
    <div className="coll-detail-filters">
      <SearchInput
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search in this collection…"
      />

      <FilterDropdown
        label="Verdict"
        value={
          filters.verdict
            ? verdictItems.find((v) => v.key === filters.verdict)?.label
            : undefined
        }
        active={!!filters.verdict}
        options={verdictItems.map((v) => ({
          key: v.key,
          label: v.label,
          selected: filters.verdict === v.key,
        }))}
        onPick={(key) =>
          setField(
            "verdict",
            filters.verdict === key ? null : (key as VerdictTone),
          )
        }
      />

      <FilterDropdown
        label="Type"
        value={
          filters.type
            ? typeItems.find((t) => t.key === filters.type)?.label
            : undefined
        }
        active={!!filters.type}
        options={typeItems.map((t) => ({
          key: t.key,
          label: t.label,
          selected: filters.type === t.key,
        }))}
        onPick={(key) =>
          setField("type", filters.type === key ? null : (key as ScanType))
        }
      />

      <FilterDropdown
        label="Detector"
        value={filters.detector ?? undefined}
        active={!!filters.detector}
        options={detectorOptions.map((d) => ({
          key: d,
          label: d,
          selected: filters.detector === d,
        }))}
        onPick={(key) =>
          setField("detector", filters.detector === key ? null : key)
        }
        emptyHint="No detectors yet"
      />
    </div>
  );
}
