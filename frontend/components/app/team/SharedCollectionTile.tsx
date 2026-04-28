import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/Icon";
import type { SharedCollectionRef } from "@/lib/team-data";

/**
 * Mini shared-collection card. Tone tints the icon plate using the
 * existing verdict tokens (--color-ai/-human/-info/-mixed).
 */
export function SharedCollectionTile({
  collection,
}: {
  collection: SharedCollectionRef;
}) {
  return (
    <article className="team-sc">
      <div className="team-sc-head">
        <div className={`team-sc-icon team-sc-tone-${collection.tone}`}>
          <Icon name="folder" size={14} />
        </div>
        <div className="team-sc-text">
          <h3 className="team-sc-name">{collection.name}</h3>
          <div className="team-sc-meta">{collection.meta}</div>
        </div>
      </div>

      <div className="team-sc-foot">
        <div className="team-sc-avs" aria-label="Collaborators">
          {collection.collaborators.map((c, i) => (
            <span
              key={`${c.initials}-${i}`}
              className="team-sc-av"
              style={{ marginLeft: i === 0 ? 0 : -6 }}
            >
              <Avatar initials={c.initials} size="sm" />
            </span>
          ))}
        </div>
        <span className="team-sc-permission">{collection.permission}</span>
      </div>
    </article>
  );
}
