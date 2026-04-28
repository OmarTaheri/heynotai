"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { OriginTabs } from "@/components/app/library/OriginTabs";
import { FilterBar, type LibraryFilters } from "@/components/app/library/FilterBar";
import { SelectionBar } from "@/components/app/library/SelectionBar";
import { LibraryTable } from "@/components/app/library/LibraryTable";
import {
  ORIGIN_TABS,
  LIBRARY_ITEMS,
  type OriginTabKey,
} from "@/lib/library-data";

const TOTAL_ITEMS = 470;
const PAGE_COUNT = 47;

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<OriginTabKey>("all");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<LibraryFilters>({
    type: "image, video",
    date: "last 7d",
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(["l1", "l2", "l3"]),
  );
  const [page, setPage] = useState(1);

  const visibleRows = useMemo(() => {
    if (activeTab === "all") return LIBRARY_ITEMS;
    return LIBRARY_ITEMS.filter((row) => row.origin === activeTab);
  }, [activeTab]);

  const toggleRow = (id: string, next: boolean) => {
    setSelectedIds((prev) => {
      const out = new Set(prev);
      if (next) out.add(id);
      else out.delete(id);
      return out;
    });
  };

  const toggleAll = (next: boolean) => {
    setSelectedIds(next ? new Set(visibleRows.map((r) => r.id)) : new Set());
  };

  return (
    <div className="lib panel-reveal">
      <PageHeader
        title="Library"
        subtitle="Every scan, every source, one place. Filter by how it arrived, what it is, or what we found."
        actions={
          <>
            <Button variant="secondary">
              <Icon name="upload" size={13} />
              Export
            </Button>
            <Button variant="primary">
              <Icon name="plus" size={13} />
              New scan
            </Button>
          </>
        }
      />

      <OriginTabs tabs={ORIGIN_TABS} value={activeTab} onChange={setActiveTab} />

      <FilterBar
        query={query}
        onQueryChange={setQuery}
        filters={filters}
        onClear={() => setFilters({})}
      />

      {selectedIds.size > 0 && (
        <SelectionBar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      <LibraryTable
        rows={visibleRows}
        total={TOTAL_ITEMS}
        selectedIds={selectedIds}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        page={page}
        pageCount={PAGE_COUNT}
        onPageChange={setPage}
      />
    </div>
  );
}
