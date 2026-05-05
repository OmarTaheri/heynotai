import Link from "next/link";
import type { MouseEvent } from "react";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/Icon";
import { TypeChip } from "@/components/ui/TypeChip";
import type { Collection } from "@/lib/collections-data";

/**
 * One collection in the grid: tonal cover with a stack of type chips,
 * body with title + description, three stats, and a footer with the
 * collaborators stack and an "updated" timestamp. Renders as a Link
 * to the collection detail page.
 *
 * The pin button in the cover's top-right toggles `collection.pinned`
 * on PocketBase. It's only rendered for owned collections — non-owners
 * see a read-only "Pinned" pill when the owner has pinned it. Clicks
 * are stopped from bubbling so the surrounding Link doesn't navigate.
 */
export function CollectionCard({
  collection,
  onTogglePin,
}: {
  collection: Collection;
  onTogglePin?: (id: string, next: boolean) => void;
}) {
  const { thumbs, extraCount, collaborators } = collection;

  const handlePinClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onTogglePin?.(collection.id, !collection.pinned);
  };

  return (
    <Link
      href={`/app/collections/${collection.slug}`}
      className={`coll-card coll-tone-${collection.tone}`}
      aria-label={`Open collection ${collection.title}`}
    >
      <div className={`coll-cover coll-pat-${collection.pattern}`}>
        {collection.isOwner && onTogglePin ? (
          <button
            type="button"
            className={`coll-pin-btn${collection.pinned ? " is-pinned" : ""}`}
            aria-pressed={Boolean(collection.pinned)}
            aria-label={
              collection.pinned ? "Unpin collection" : "Pin collection"
            }
            onClick={handlePinClick}
          >
            <Icon name="pin" size={13} />
          </button>
        ) : collection.pinned ? (
          <Pill tone="neutral" compact className="coll-pin">
            Pinned
          </Pill>
        ) : null}
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
                <Avatar initials={c.initials} size="sm" src={c.avatarSrc} />
              </span>
            ))}
          </div>
          <span className="coll-updated">{collection.updated}</span>
        </div>
      </div>
    </Link>
  );
}
