import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { TypeChip } from "@/components/ui/TypeChip";
import type { CollectionItem } from "@/lib/collections-data";

/**
 * Items table for the collection detail page. Lighter than
 * LibraryTable — no checkboxes, no pagination, no per-row action
 * menu — but reuses the same TypeChip + Pill + confidence-bar
 * grammar so a row reads identically across surfaces.
 */
export function CollectionItemsTable({ items }: { items: CollectionItem[] }) {
  return (
    <Card>
      <div className="coll-itbl-head" role="row">
        <span aria-hidden />
        <span>Item</span>
        <span>Confidence</span>
        <span>Model</span>
        <span>Verdict</span>
        <span style={{ textAlign: "right" }}>When</span>
      </div>

      {items.map((item) => (
        <div key={item.id} className="coll-itbl-row" role="row">
          <TypeChip type={item.type} size="md" />

          <div className="coll-itbl-main">
            <div className="coll-itbl-name">{item.name}</div>
            <div className="coll-itbl-meta">
              {item.tag && <span className="coll-itbl-tag">{item.tag}</span>}
              <span>{item.meta}</span>
            </div>
          </div>

          <div className="coll-itbl-conf">
            <span className="coll-itbl-conf-bar" aria-hidden>
              <span style={{ width: `${item.confidence}%` }} />
            </span>
            <span>{item.confidence}%</span>
          </div>

          <div className="coll-itbl-model">{item.model}</div>

          <div>
            <Pill tone={item.verdict} dot compact>
              {item.verdictLabel}
            </Pill>
          </div>

          <div className="coll-itbl-time">{item.when}</div>
        </div>
      ))}

      {items.length === 0 && (
        <div className="coll-itbl-empty">
          No items yet. Add scans manually or wire up an auto-rule.
        </div>
      )}
    </Card>
  );
}
