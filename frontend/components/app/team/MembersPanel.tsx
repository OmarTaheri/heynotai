import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { MemberRow } from "./MemberRow";
import { PendingInviteStrip } from "./PendingInviteStrip";
import type { TeamMember } from "@/lib/team-data";
import { PENDING_INVITE } from "@/lib/team-data";

const TABS: { label: string; count: number; active?: boolean }[] = [
  { label: "All", count: 6, active: true },
  { label: "Active", count: 5 },
  { label: "Pending", count: 1 },
  { label: "Removed", count: 2 },
];

/**
 * Full-bleed members panel: tab strip + invite row + pending strip +
 * column headers + rows. Server component — interactivity hooks up
 * later.
 */
export function MembersPanel({ members }: { members: TeamMember[] }) {
  return (
    <Card className="team-panel">
      <nav className="team-mtabs" aria-label="Member filter">
        {TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            className={`team-mtab${t.active ? " is-active" : ""}`}
          >
            <span>{t.label}</span>
            <span className="team-mtab-count">{t.count}</span>
          </button>
        ))}
      </nav>

      <div className="team-invite">
        <input
          type="email"
          placeholder="Invite by email — name@maple.news"
          aria-label="Invite by email"
        />
        <button type="button" className="team-role-pick">
          <Icon name="check" size={11} />
          <span>Member</span>
          <Icon name="chevron-down" size={11} />
        </button>
        <Button variant="primary">
          <Icon name="send" size={13} />
          <span>Send invite</span>
        </Button>
      </div>

      <PendingInviteStrip
        name={PENDING_INVITE.name}
        sentLabel={PENDING_INVITE.sentLabel}
      />

      <div className="team-mem-head" role="row">
        <span aria-hidden />
        <span>Member</span>
        <span>Role</span>
        <span>Tokens · 30d</span>
        <span className="team-mem-head-r">Last active</span>
        <span aria-hidden />
      </div>

      <ul className="team-mem-list">
        {members.map((m) => (
          <MemberRow key={m.id} member={m} />
        ))}
      </ul>
    </Card>
  );
}
