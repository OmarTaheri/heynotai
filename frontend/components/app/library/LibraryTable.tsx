"use client";

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/Icon";
import { Checkbox } from "./Checkbox";
import { LibraryRow } from "./LibraryRow";
import { Pagination } from "./Pagination";
import type { LibraryItem } from "@/lib/library-data";

export function LibraryTable({
  rows,
  total,
  selectedIds,
  onToggleRow,
  onToggleAll,
  page,
  pageCount,
  onPageChange,
}: {
  rows: LibraryItem[];
  total: number;
  selectedIds: Set<string>;
  onToggleRow: (id: string, next: boolean) => void;
  onToggleAll: (next: boolean) => void;
  page: number;
  pageCount: number;
  onPageChange: (next: number) => void;
}) {
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  return (
    <Card>
      <div className="lib-tbl-head" role="row">
        <Checkbox
          checked={allSelected}
          onChange={onToggleAll}
          label="Select all rows"
        />
        <span aria-hidden />
        <span className="is-sorted">
          Item <Icon name="chevron-down" size={10} />
        </span>
        <span>Confidence</span>
        <span>Model</span>
        <span>Verdict</span>
        <span style={{ justifySelf: "flex-end" }}>When</span>
        <span aria-hidden />
      </div>

      {rows.map((row) => (
        <LibraryRow
          key={row.id}
          item={row}
          selected={selectedIds.has(row.id)}
          onToggle={onToggleRow}
        />
      ))}

      <div className="lib-tbl-foot">
        <div className="lib-tbl-meta">
          Showing{" "}
          <strong>
            {(page - 1) * rows.length + 1}–{(page - 1) * rows.length + rows.length}
          </strong>{" "}
          of <strong>{total.toLocaleString()}</strong> · filtered
        </div>
        <Pagination page={page} pageCount={pageCount} onChange={onPageChange} />
      </div>
    </Card>
  );
}
