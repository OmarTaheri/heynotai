"use client";

import { Checkbox } from "@/components/app/library/Checkbox";
import { ItemMeta } from "@/components/ui/ItemMeta";
import { OriginBadge } from "@/components/ui/OriginBadge";
import { Pill } from "@/components/ui/Pill";
import { Table } from "@/components/ui/Table";
import { TypeChip } from "@/components/ui/TypeChip";
import {
  verdictLabelFromAiPct,
  verdictToneFromAiPct,
} from "@/lib/verdict-tone";
import type { CollectionItem } from "@/lib/collections-data";

/**
 * Items table for the collection detail page. Now mirrors the library
 * table's selection chrome: a checkbox column on the left, a Verdict
 * badge column showing AI% with a colored Pill, and a Detector column
 * (scan engine that produced the verdict).
 */
export function CollectionItemsTable({
  items,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onOpenRow,
}: {
  items: CollectionItem[];
  selectedIds: Set<string>;
  onToggleRow: (id: string, next: boolean) => void;
  onToggleAll: (next: boolean) => void;
  /** Fired when a row's title is clicked. Receives the underlying scan
   *  id so the parent can route to `/editor/<scanId>`. Omitted for
   *  legacy mock collections where `scanId` isn't known. */
  onOpenRow?: (scanId: string) => void;
}) {
  const allSelected =
    items.length > 0 && items.every((i) => selectedIds.has(i.id));

  return (
    <Table columns="var(--coll-itbl-cols)" className="coll-itbl">
      <Table.Header>
        <Table.HeaderCell>
          <Checkbox
            checked={allSelected}
            onChange={onToggleAll}
            label="Select all rows"
          />
        </Table.HeaderCell>
        <Table.HeaderCell aria-hidden />
        <Table.HeaderCell>Item</Table.HeaderCell>
        <Table.HeaderCell>Verdict</Table.HeaderCell>
        <Table.HeaderCell>Detector</Table.HeaderCell>
        <Table.HeaderCell align="right">When</Table.HeaderCell>
      </Table.Header>

      <Table.Body>
        {items.map((item) => {
          const aiPct = item.aiPct ?? item.confidence;
          const tone = verdictToneFromAiPct(aiPct);
          const label = verdictLabelFromAiPct(aiPct);
          const detector = item.detector || item.model || "—";
          const selected = selectedIds.has(item.id);
          const openTarget = onOpenRow && item.scanId ? item.scanId : null;
          return (
            <Table.Row
              key={item.id}
              selected={selected}
              onClick={() => onToggleRow(item.id, !selected)}
            >
              <Table.Cell>
                <Checkbox
                  checked={selected}
                  onChange={(next) => onToggleRow(item.id, next)}
                  label={`Select ${item.name}`}
                />
              </Table.Cell>

              <Table.Cell>
                <TypeChip type={item.type} size="md" />
              </Table.Cell>

              <Table.Cell className="coll-itbl-main">
                <Table.CellTitle>
                  {openTarget ? (
                    <button
                      type="button"
                      className="coll-itbl-open"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRow!(openTarget);
                      }}
                    >
                      {item.name}
                    </button>
                  ) : (
                    item.name
                  )}
                </Table.CellTitle>
                <Table.CellMeta>
                  <OriginBadge origin={item.origin} />
                  <ItemMeta
                    type={item.type}
                    parts={item.meta}
                    link={item.link}
                  />
                </Table.CellMeta>
              </Table.Cell>

              <Table.Cell className="coll-itbl-verdict">
                <Pill tone={tone} compact dot>
                  {label}
                </Pill>
                <span className="coll-itbl-verdict-pct">{aiPct}%</span>
              </Table.Cell>

              <Table.Cell className="coll-itbl-model">{detector}</Table.Cell>

              <Table.Cell align="right" muted>
                {item.when}
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>

      {items.length === 0 && (
        <Table.Empty>
          No items match. Adjust filters or add scans manually.
        </Table.Empty>
      )}
    </Table>
  );
}
