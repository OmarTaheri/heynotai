"use client";

import { Table } from "@/components/ui/Table";
import { TypeChip } from "@/components/ui/TypeChip";
import { OriginBadge } from "@/components/ui/OriginBadge";
import { ItemMeta } from "@/components/ui/ItemMeta";
import { Pill } from "@/components/ui/Pill";
import { Checkbox } from "./Checkbox";
import { detectorDisplayName } from "@/lib/detector-display";
import {
  verdictLabelFromAiPct,
  verdictToneFromAiPct,
} from "@/lib/verdict-tone";
import type { LibraryItem } from "@/lib/library-data";

export function LibraryRow({
  item,
  selected,
  onToggle,
  onOpen,
}: {
  item: LibraryItem;
  selected: boolean;
  onToggle: (id: string, next: boolean) => void;
  /** Fired when the title cell is clicked. Used to navigate to the
   *  editor for this scan. Row-level click still toggles selection. */
  onOpen?: (id: string) => void;
}) {
  const aiPct = item.aiPct ?? item.confidence;
  const tone = verdictToneFromAiPct(aiPct);
  const label = verdictLabelFromAiPct(aiPct);
  const detector = detectorDisplayName(item.engineId ?? "", item.model);
  const inFlight = item.status === "queued" || item.status === "scanning";
  const failed = item.status === "failed";

  return (
    <Table.Row
      selected={selected}
      onClick={() => onToggle(item.id, !selected)}
    >
      <Table.Cell>
        <Checkbox
          checked={selected}
          onChange={(next) => onToggle(item.id, next)}
          label={`Select ${item.name}`}
        />
      </Table.Cell>

      <Table.Cell>
        <TypeChip type={item.type} size="md" />
      </Table.Cell>

      <Table.Cell className="lib-row-main">
        <Table.CellTitle>
          {onOpen ? (
            <button
              type="button"
              className="lib-row-open"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(item.id);
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
          <ItemMeta type={item.type} parts={item.meta} link={item.link} />
        </Table.CellMeta>
      </Table.Cell>

      <Table.Cell className="lib-row-verdict">
        {inFlight ? (
          <span className="lib-row-working" aria-label="Scan in progress">
            <span className="lib-row-working-dot" aria-hidden />
            Scanning…
          </span>
        ) : failed ? (
          <span className="lib-row-failed" aria-label="Scan failed">
            Scan failed
          </span>
        ) : (
          <>
            <Pill tone={tone} compact dot>
              {label}
            </Pill>
            <span className="lib-row-verdict-pct">{aiPct}%</span>
          </>
        )}
      </Table.Cell>

      <Table.Cell className="lib-row-detector">
        {inFlight ? "Working…" : detector}
      </Table.Cell>

      <Table.Cell align="right" muted>
        {item.when}
      </Table.Cell>

      <Table.Cell>
        <Table.RowAction />
      </Table.Cell>
    </Table.Row>
  );
}
