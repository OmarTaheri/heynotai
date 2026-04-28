import { Icon } from "@/components/Icon";
import type { TeamRole } from "@/lib/team-data";

const ICON_FOR_ROLE: Partial<Record<TeamRole, "shield" | "eye" | "key" | "bell">> = {
  owner: "key",
  admin: "shield",
  viewer: "eye",
  pending: "bell",
};

const LABEL_FOR_ROLE: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
  pending: "Pending",
};

/**
 * Role chip used in the members table and the roles legend. Editable
 * (caret) for non-owner / non-pending roles — visually only; click
 * wiring lives in the parent.
 */
export function RolePill({
  role,
  editable = false,
}: {
  role: TeamRole;
  editable?: boolean;
}) {
  const icon = ICON_FOR_ROLE[role];
  return (
    <span className={`team-role team-role-${role}`}>
      {icon && <Icon name={icon} size={11} />}
      <span>{LABEL_FOR_ROLE[role]}</span>
      {editable && <Icon name="chevron-down" size={11} />}
    </span>
  );
}
