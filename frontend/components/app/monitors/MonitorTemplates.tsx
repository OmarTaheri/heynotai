import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import type { MonitorTemplate } from "@/lib/monitors-data";
import { MonitorTypeIcon } from "./MonitorTypeIcon";

/**
 * "Create a monitor" panel — six template tiles followed by a paste-
 * anything URL bar. Static (no input handler wired) since this is the
 * first cut; the bar is render-only.
 */
export function MonitorTemplates({
  templates,
}: {
  templates: MonitorTemplate[];
}) {
  return (
    <section className="mon-create">
      <div className="mon-create-head">
        <div className="mon-create-title">
          Create a <em>monitor</em>
        </div>
      </div>
      <p className="mon-create-sub">
        Pick a template to start fast, or paste any URL to set up a custom
        watch.
      </p>

      <div className="mon-tpl-grid">
        {templates.map((t) => (
          <button key={t.id} type="button" className="mon-tpl">
            <MonitorTypeIcon kind={t.kind} size={34} />
            <div className="mon-tpl-info">
              <div className="mon-tpl-name">{t.name}</div>
              <div className="mon-tpl-desc">{t.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="mon-create-divider">
        <span>Or paste anything</span>
      </div>

      <div className="mon-url-bar">
        <input
          type="text"
          placeholder="https://… · @handle · folder path · RSS URL"
        />
        <Button variant="primary">
          <Icon name="arrow-right" size={13} />
          Set up watch
        </Button>
      </div>
    </section>
  );
}
