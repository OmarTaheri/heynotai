import { Icon } from "@/components/Icon";

/**
 * Warm warning strip that surfaces the most recent un-accepted invite
 * directly above the members table. Inline action ("Resend") is purely
 * presentational for now.
 */
export function PendingInviteStrip({
  name,
  sentLabel,
}: {
  name: string;
  sentLabel: string;
}) {
  return (
    <div className="team-pending">
      <div className="team-pending-l">
        <Icon name="bell" size={14} />
        <span>
          <strong>{name}</strong> hasn&apos;t accepted her invite — sent{" "}
          {sentLabel}
        </span>
      </div>
      <button type="button" className="team-pending-action">
        Resend
      </button>
    </div>
  );
}
