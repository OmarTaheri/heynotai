import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/Icon";
import type { CollectionMember } from "@/lib/collections-data";

/** Side-panel listing every member of the collection + an invite CTA. */
export function MembersPanel({
  members,
  inviteLabel = "Invite collaborator",
}: {
  members: CollectionMember[];
  inviteLabel?: string;
}) {
  return (
    <section className="coll-panel">
      <header className="coll-panel-head">
        <span>Members</span>
        <button type="button" className="coll-panel-link">
          Manage
        </button>
      </header>

      <ul className="coll-member-list">
        {members.map((m) => (
          <li key={`${m.initials}-${m.emailHandle}`} className="coll-member">
            <Avatar initials={m.initials} size="md" />
            <div className="coll-member-info">
              <div className="coll-member-name">{m.name}</div>
              <div className="coll-member-role">
                {m.role} · {m.emailHandle}
              </div>
            </div>
            {m.you && <span className="coll-member-you">You</span>}
          </li>
        ))}
      </ul>

      <button type="button" className="coll-invite-btn">
        <Icon name="plus" size={12} />
        {inviteLabel}
      </button>
    </section>
  );
}
