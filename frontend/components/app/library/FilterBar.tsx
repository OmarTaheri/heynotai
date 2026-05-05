"use client";

import { Icon } from "@/components/Icon";
import { FilterDropdown } from "@/components/ui/FilterDropdown";

export type LibraryFilters = {
  type?: string;
  /** Verdict bucket — mirrors the table's Pill tone. Replaces the
   *  legacy Confidence filter so the chip set tracks the column set. */
  verdict?: "human" | "mixed" | "ai";
  detector?: string;
  date?: string;
  collection?: string;
};

const TYPE_ITEMS: Array<{ key: string; label: string }> = [
  { key: "txt", label: "Text" },
  { key: "img", label: "Image" },
  { key: "aud", label: "Audio" },
  { key: "vid", label: "Video" },
  { key: "web", label: "Website" },
  { key: "soc", label: "Social" },
];

/** Verdict buckets line up with `verdictToneFromAiPct`:
 *  human <40, mixed 40-69, ai ≥70. Same thresholds the Pill in the
 *  table renders, so picking "AI" surfaces the rows wearing red pills. */
const VERDICT_ITEMS: Array<{ key: NonNullable<LibraryFilters["verdict"]>; label: string }> = [
  { key: "human", label: "Not AI (<40%)" },
  { key: "mixed", label: "Medium (40–69%)" },
  { key: "ai", label: "AI (≥70%)" },
];

const DATE_ITEMS: Array<{ key: string; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

export function FilterBar({
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  collectionOptions,
  detectorOptions,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  filters: LibraryFilters;
  onFiltersChange: (next: LibraryFilters) => void;
  collectionOptions: string[];
  /** Detector display names derived from the visible rows so the chip
   *  only offers values that actually appear in the table. */
  detectorOptions: string[];
}) {
  const setField = <K extends keyof LibraryFilters>(
    key: K,
    value: LibraryFilters[K],
  ) => {
    const next = { ...filters };
    if (value === undefined) delete next[key];
    else next[key] = value;
    onFiltersChange(next);
  };

  const labelFor = <T extends string>(
    items: Array<{ key: T; label: string }>,
    key?: T,
  ) => (key ? items.find((i) => i.key === key)?.label : undefined);

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

      <FilterDropdown
        label="Type"
        value={labelFor(TYPE_ITEMS, filters.type)}
        active={!!filters.type}
        options={TYPE_ITEMS.map((t) => ({
          ...t,
          selected: filters.type === t.key,
        }))}
        onPick={(key) =>
          setField("type", filters.type === key ? undefined : key)
        }
      />

      <FilterDropdown
        label="Verdict"
        value={labelFor(VERDICT_ITEMS, filters.verdict)}
        active={!!filters.verdict}
        options={VERDICT_ITEMS.map((v) => ({
          ...v,
          selected: filters.verdict === v.key,
        }))}
        onPick={(key) =>
          setField(
            "verdict",
            filters.verdict === key
              ? undefined
              : (key as LibraryFilters["verdict"]),
          )
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
          setField("detector", filters.detector === key ? undefined : key)
        }
        emptyHint="No detectors yet"
      />

      <FilterDropdown
        label="Date"
        value={labelFor(DATE_ITEMS, filters.date)}
        active={!!filters.date}
        options={DATE_ITEMS.map((d) => ({
          ...d,
          selected: filters.date === d.key,
        }))}
        onPick={(key) =>
          setField("date", filters.date === key ? undefined : key)
        }
      />

      <FilterDropdown
        label="Collection"
        value={filters.collection ?? undefined}
        active={!!filters.collection}
        options={collectionOptions.map((c) => ({
          key: c,
          label: c,
          selected: filters.collection === c,
        }))}
        onPick={(key) =>
          setField("collection", filters.collection === key ? undefined : key)
        }
        emptyHint="No collections yet"
      />
    </div>
  );
}
