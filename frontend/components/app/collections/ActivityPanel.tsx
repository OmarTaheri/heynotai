import { Avatar } from "@/components/ui/Avatar";
import type { CollectionActivity } from "@/lib/collections-data";

/** Side-panel showing recent activity inside the collection. */
export function ActivityPanel({ items }: { items: CollectionActivity[] }) {
  return (
    <section className="coll-panel">
      <header className="coll-panel-head">
        <span>Activity</span>
        <button type="button" className="coll-panel-link">
          See all
        </button>
      </header>

      <ul className="coll-act-list">
        {items.map((a) => (
          <li key={a.id} className="coll-act">
            <Avatar initials={a.initials} size="sm" />
            <div className="coll-act-body">
              <p className="coll-act-text">
                <strong>{a.actor}</strong> {a.text}
                {a.emphasis && (
                  <>
                    {" "}
                    <em>{a.emphasis}</em>
                  </>
                )}
              </p>
              <span className="coll-act-time">{a.when}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
