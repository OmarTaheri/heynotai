import { Card } from "@/components/ui/Card";
import { RolePill } from "./RolePill";
import type { TeamRole } from "@/lib/team-data";

const ROLES: { role: TeamRole; description: string }[] = [
  { role: "owner", description: "Full control · billing · delete workspace" },
  { role: "admin", description: "Manage members · all collections · settings" },
  { role: "member", description: "Scan · build collections · share reports" },
  {
    role: "viewer",
    description: "Read-only · view shared collections + reports",
  },
];

export function RolesReferencePanel() {
  return (
    <Card className="team-rail-card">
      <div className="team-rail-title">
        <span>What roles can do</span>
        <button type="button" className="team-rail-link">
          Docs
        </button>
      </div>
      <ul className="team-roles-list">
        {ROLES.map(({ role, description }) => (
          <li key={role} className="team-roles-row">
            <RolePill role={role} />
            <p>{description}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
