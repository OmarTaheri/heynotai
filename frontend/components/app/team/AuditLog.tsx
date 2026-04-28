import { Card } from "@/components/ui/Card";
import { AuditItem } from "./AuditItem";
import type { AuditEntry } from "@/lib/team-data";

export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  return (
    <Card className="team-rail-card">
      <div className="team-rail-title">
        <span>Recent activity</span>
        <button type="button" className="team-rail-link">
          See all
        </button>
      </div>
      <ul className="team-audit-list">
        {entries.map((e) => (
          <AuditItem key={e.id} entry={e} />
        ))}
      </ul>
    </Card>
  );
}
