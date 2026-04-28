import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";
import { TEMPLATES } from "@/lib/collections-data";

/**
 * "Start from a template" strip below the collections grid. Each tile
 * pre-configures a collection for a common workflow (classroom, news,
 * research, hiring, legal, custom).
 */
export function TemplatesStrip() {
  return (
    <Card padded>
      <div className="coll-tpl-head">
        <h3 className="coll-tpl-title">Start from a template</h3>
        <span className="coll-tpl-sub">
          Pre-configured for common workflows
        </span>
      </div>
      <div className="coll-tpl-row">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`coll-tpl coll-tone-${t.tone}`}
          >
            <IconTile icon={t.icon} size="sm" />
            <span className="coll-tpl-info">
              <span className="coll-tpl-name">{t.name}</span>
              <span className="coll-tpl-desc">{t.description}</span>
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
