import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { TypeChip } from "@/components/ui/TypeChip";
import type { Collection } from "@/lib/collections-data";

/**
 * One collection in the grid: tonal cover with a stack of type chips,
 * body with title + description, three stats, and a footer with the
 * collaborators stack and an "updated" timestamp. Renders as a Link
 * to the collection detail page.
 *
 * Reuses Pill (pinned badge), TypeChip (cover thumbs), and Avatar
 * (collaborators) — the same primitives the home / library pages use.
 */
export function CollectionCard({ collection }: { collection: Collection }) {
  const { thumbs, extraCount, collaborators } = collection;

  return (
    <Link
      href={`/app/collections/${collection.slug}`}
      className={`coll-card coll-tone-${collection.tone}`}
      aria-label={`Open collection ${collection.title}`}
    >
      <div className={`coll-cover coll-pat-${collection.pattern}`}>
        {collection.pinned && (
          <Pill tone="neutral" compact className="coll-pin">
            Pinned
          </Pill>
        )}
        <div className="coll-thumbs">
          {thumbs.map((t, i) => (
            <TypeChip key={`${t}-${i}`} type={t} />
          ))}
          {extraCount ? (
            <span className="coll-thumb-more" aria-hidden>
              +{extraCount}
            </span>
          ) : null}
        </div>
      </div>

      <div className="coll-body">
        <h3 className="coll-title">{collection.title}</h3>
        <p className="coll-desc">{collection.description}</p>

        <dl className="coll-stats">
          <div className="coll-stat">
            <dt>Items</dt>
            <dd className="coll-stat-n">{collection.itemCount}</dd>
          </div>
          <div className="coll-stat">
            <dt>Flagged</dt>
            <dd className="coll-stat-n">
              <span className="coll-stat-accent">{collection.flagged}</span>
            </dd>
          </div>
          <div className="coll-stat">
            <dt>AI rate</dt>
            <dd className="coll-stat-n">
              {collection.aiRate}
              <span className="coll-stat-unit">%</span>
            </dd>
          </div>
        </dl>

        <div className="coll-foot">
          <div className="coll-shared" aria-label="Collaborators">
            {collaborators.map((c, i) => (
              <span
                key={`${c.initials}-${i}`}
                className="coll-shared-slot"
                style={{ marginLeft: i === 0 ? 0 : -6 }}
              >
                <Avatar initials={c.initials} size="sm" />
              </span>
            ))}
          </div>
          <span className="coll-updated">{collection.updated}</span>
        </div>
      </div>
    </Link>
  );
}
