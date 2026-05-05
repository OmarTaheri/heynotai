import { Table } from "@/components/ui/Table";
import { TypeChip, type ScanType } from "@/components/ui/TypeChip";
import { OriginBadge, type Origin } from "@/components/ui/OriginBadge";
import { ItemMeta } from "@/components/ui/ItemMeta";
import { Pill } from "@/components/ui/Pill";
import {
  verdictLabelFromAiPct,
  verdictToneFromAiPct,
} from "@/lib/verdict-tone";
import type { ItemMetaLink, ItemMetaParts } from "@/lib/item-meta";

export type { Origin } from "@/components/ui/OriginBadge";

export type ActivityRow = {
  id: string;
  type: ScanType;
  name: string;
  origin: Origin;
  meta: ItemMetaParts;
  link?: ItemMetaLink;
  /** AI percentage used to derive the verdict pill + label. Falls back
   *  to `confidence` when not provided. */
  aiPct?: number;
  confidence: number;
  when: string;
};

const COLUMNS = "48px minmax(220px, 1fr) 140px 90px";

export function ActivityTable({
  rows,
  onRowClick,
}: {
  rows: ActivityRow[];
  /** When provided, the row title becomes a clickable link. */
  onRowClick?: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <Table columns={COLUMNS}>
        <Table.Empty>No activity yet.</Table.Empty>
      </Table>
    );
  }

  return (
    <Table
      columns={COLUMNS}
      minWidth={560}
      scroll
      aria-label="Recent activity"
    >
      <Table.Header>
        <Table.HeaderCell aria-hidden />
        <Table.HeaderCell>Item</Table.HeaderCell>
        <Table.HeaderCell>Verdict</Table.HeaderCell>
        <Table.HeaderCell align="right">When</Table.HeaderCell>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => {
          const aiPct = row.aiPct ?? row.confidence;
          const tone = verdictToneFromAiPct(aiPct);
          const label = verdictLabelFromAiPct(aiPct);
          return (
            <Table.Row
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row.id) : undefined}
            >
              <Table.Cell>
                <TypeChip type={row.type} size="lg" />
              </Table.Cell>
              <Table.Cell>
                <Table.CellTitle>{row.name}</Table.CellTitle>
                <Table.CellMeta>
                  <OriginBadge origin={row.origin} />
                  <ItemMeta type={row.type} parts={row.meta} link={row.link} />
                </Table.CellMeta>
              </Table.Cell>
              <Table.Cell className="lib-row-verdict">
                <Pill tone={tone} compact dot>
                  {label}
                </Pill>
                <span className="lib-row-verdict-pct">{aiPct}%</span>
              </Table.Cell>
              <Table.Cell align="right" muted>
                {row.when}
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table>
  );
}
