"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { SearchInput } from "@/components/ui/SearchInput";

type View = "grid" | "list";

const SORTS = [
  "Recently updated",
  "Recently created",
  "Most items",
  "Most flagged",
  "Highest AI rate",
  "A → Z",
];

/**
 * Toolbar above the collections grid: search field + grid/list view
 * toggle + sort menu trigger. Local state only — wiring to actual list
 * filtering / sorting will land when the data layer goes real.
 */
export function CollectionsControls() {
  const [view, setView] = useState<View>("grid");
  const [sort, setSort] = useState(SORTS[0]);

  return (
    <div className="coll-controls">
      <SearchInput placeholder="Search collections…" />

      <div className="coll-view-toggle" role="tablist" aria-label="View mode">
        <button
          type="button"
          role="tab"
          aria-selected={view === "grid"}
          className={`coll-view-btn${view === "grid" ? " is-on" : ""}`}
          onClick={() => setView("grid")}
          title="Grid view"
        >
          <Icon name="layers" size={14} />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "list"}
          className={`coll-view-btn${view === "list" ? " is-on" : ""}`}
          onClick={() => setView("list")}
          title="List view"
        >
          <Icon name="list" size={14} />
        </button>
      </div>

      <SortMenu value={sort} onChange={setSort} />
    </div>
  );
}

function SortMenu({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="coll-sort">
      <button
        type="button"
        className="coll-sort-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="coll-sort-label">Sort:</span>
        <span className="coll-sort-value">{value}</span>
        <Icon name="chevron-down" size={12} />
      </button>
      {open && (
        <div className="coll-sort-menu" role="listbox">
          {SORTS.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={s === value}
              className={`coll-sort-item${s === value ? " is-on" : ""}`}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
            >
              {s}
              {s === value && <Icon name="check" size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
