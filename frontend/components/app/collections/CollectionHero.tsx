import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/Icon";
import type { Collection } from "@/lib/collections-data";

/**
 * Hero band at the top of a collection detail page. Shows the
 * pinned status, title, description, meta strip (item count, dates,
 * members), and the action cluster on the right (share / more /
 * export / add). Uses the same tonal accent overlay as the grid card
 * so the detail page reads as a continuation of the card the user
 * just clicked.
 */
export function CollectionHero({ collection }: { collection: Collection }) {
  return (
    <header className={`coll-hero coll-tone-${collection.tone}`}>
      <div className={`coll-hero-accent coll-pat-${collection.pattern}`} aria-hidden />

      <div className="coll-hero-inner">
        <div className="coll-hero-main">
          {collection.pinned && (
            <Pill tone="neutral" compact className="coll-hero-pin">
              Pinned
            </Pill>
          )}
          <h1 className="coll-hero-title">{collection.title}</h1>
          <p className="coll-hero-desc">{collection.description}</p>

          <div className="coll-hero-meta">
            <span>
              <strong>{collection.itemCount}</strong> items
            </span>
            <span className="coll-meta-dot" aria-hidden />
            <span>
              Created <strong>{collection.created}</strong>
            </span>
            <span className="coll-meta-dot" aria-hidden />
            <span>{collection.updated}</span>
            <span className="coll-meta-dot" aria-hidden />
            <span className="coll-hero-members">
              <span className="coll-hero-avs">
                {collection.collaborators.map((c, i) => (
                  <span
                    key={`${c.initials}-${i}`}
                    className="coll-shared-slot"
                    style={{ marginLeft: i === 0 ? 0 : -6 }}
                  >
                    <Avatar initials={c.initials} size="sm" />
                  </span>
                ))}
              </span>
              <strong>{collection.members.length} members</strong>
            </span>
          </div>
        </div>

        <div className="coll-hero-actions">
          <button type="button" className="icon-square" aria-label="Share">
            <Icon name="share" size={14} />
          </button>
          <button type="button" className="icon-square" aria-label="More">
            <Icon name="more" size={14} />
          </button>
          <Button variant="secondary">
            <Icon name="file-text" size={14} />
            Export report
          </Button>
          <Button variant="primary">
            <Icon name="plus" size={14} />
            Add items
          </Button>
        </div>
      </div>
    </header>
  );
}
