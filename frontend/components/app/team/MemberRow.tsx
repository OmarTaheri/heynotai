import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/Icon";
import { RolePill } from "./RolePill";
import type { TeamMember } from "@/lib/team-data";

const PRESENCE_CLASS: Record<TeamMember["presence"], string> = {
  online: "team-presence-online",
  away: "team-presence-away",
  offline: "team-presence-offline",
};

function formatTokens(n: number): string {
  if (!n) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function MemberRow({ member }: { member: TeamMember }) {
  const isPending = member.role === "pending";
  const usagePct = member.tokensQuota
    ? Math.min(100, (member.tokensThisMonth / member.tokensQuota) * 100)
    : 0;
  const editableRole = !isPending && member.role !== "owner";

  return (
    <li className="team-mem">
      <div className="team-mem-avatar">
        <Avatar initials={member.initials} size="md" />
        <span
          className={`team-mem-presence ${PRESENCE_CLASS[member.presence]}`}
          aria-hidden
        />
      </div>

      <div className="team-mem-info">
        <div className="team-mem-name">
          <span className={isPending ? "team-mem-name-muted" : undefined}>
            {member.name}
          </span>
          {member.isYou && <span className="team-mem-you">YOU</span>}
        </div>
        <div className="team-mem-email">{member.email}</div>
      </div>

      <div className="team-mem-cell team-mem-role-cell">
        <RolePill role={member.role} editable={editableRole} />
      </div>

      <div className="team-mem-cell team-mem-usage">
        {isPending ? (
          <span className="team-mem-usage-muted">— · invited</span>
        ) : (
          <>
            <div className="team-mem-usage-row">
              <strong>{formatTokens(member.tokensThisMonth)}</strong>
              <span> / month</span>
            </div>
            <div className="team-mem-usage-bar" aria-hidden>
              <div style={{ width: `${usagePct}%` }} />
            </div>
          </>
        )}
      </div>

      <div className="team-mem-cell team-mem-time">
        <strong>{member.lastActive.headline}</strong>
        <span>{member.lastActive.sub}</span>
      </div>

      <button
        type="button"
        className="team-mem-action"
        aria-label={`More actions for ${member.name}`}
      >
        <Icon name="more" size={14} />
      </button>
    </li>
  );
}
