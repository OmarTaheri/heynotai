"use client";

import { Table } from "@/components/ui/Table";
import { Icon } from "@/components/Icon";
import { Checkbox } from "./Checkbox";
import { LibraryRow } from "./LibraryRow";
import { Pagination } from "./Pagination";
import type { LibraryItem } from "@/lib/library-data";

const COLUMNS = "var(--lib-cols)";

export function LibraryTable({
  rows,
  total,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onOpenRow,
  page,
  pageCount,
  onPageChange,
}: {
  rows: LibraryItem[];
  total: number;
  selectedIds: Set<string>;
  onToggleRow: (id: string, next: boolean) => void;
  onToggleAll: (next: boolean) => void;
  /** Optional — when provided, the title cell becomes a link that opens
   *  the row's editor. Selection still toggles via the row click. */
  onOpenRow?: (id: string) => void;
  page: number;
  pageCount: number;
  onPageChange: (next: number) => void;
}) {
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  return (
    <Table columns={COLUMNS} className="lib-tbl">
      <Table.Header>
        <Table.HeaderCell>
          <Checkbox
            checked={allSelected}
            onChange={onToggleAll}
            label="Select all rows"
          />
        </Table.HeaderCell>
        <Table.HeaderCell aria-hidden />
        <Table.HeaderCell sorted>
          Item <Icon name="chevron-down" size={10} />
        </Table.HeaderCell>
        <Table.HeaderCell>Verdict</Table.HeaderCell>
        <Table.HeaderCell>Detector</Table.HeaderCell>
        <Table.HeaderCell align="right">When</Table.HeaderCell>
        <Table.HeaderCell aria-hidden />
      </Table.Header>

      <Table.Body>
        {rows.map((row) => (
          <LibraryRow
            key={row.id}
            item={row}
            selected={selectedIds.has(row.id)}
            onToggle={onToggleRow}
            onOpen={onOpenRow}
          />
        ))}
      </Table.Body>

      <Table.Footer>
        <div className="lib-tbl-meta">
          Showing{" "}
          <strong>
            {(page - 1) * rows.length + 1}–{(page - 1) * rows.length + rows.length}
          </strong>{" "}
          of <strong>{total.toLocaleString()}</strong> · filtered
        </div>
        <Pagination page={page} pageCount={pageCount} onChange={onPageChange} />
      </Table.Footer>
    </Table>
  );
}
