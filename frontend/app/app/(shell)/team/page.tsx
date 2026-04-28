import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SectionHead } from "@/components/ui/SectionHead";
import { Icon } from "@/components/Icon";
import { WorkspaceIdentityCard } from "@/components/app/team/WorkspaceIdentityCard";
import { TeamStats } from "@/components/app/team/TeamStats";
import { MembersPanel } from "@/components/app/team/MembersPanel";
import { SharedCollectionsGrid } from "@/components/app/team/SharedCollectionsGrid";
import { BillingPanel } from "@/components/app/team/BillingPanel";
import { RolesReferencePanel } from "@/components/app/team/RolesReferencePanel";
import { AuditLog } from "@/components/app/team/AuditLog";
import {
  AUDIT_LOG,
  SHARED_COLLECTIONS,
  TEAM_MEMBERS,
  WORKSPACE,
} from "@/lib/team-data";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <ComingSoon feature="Team" subtitle="Workspace collaboration is landing soon.">
    <div className="team panel-reveal">
      <PageHeader
        title="Team"
        subtitle="Manage members, roles, shared collections, and billing for your workspace."
        actions={
          <>
            <Button variant="secondary">
              <Icon name="file-text" size={13} />
              <span>Audit log</span>
            </Button>
            <Button variant="primary">
              <Icon name="users" size={13} />
              <span>Invite people</span>
            </Button>
          </>
        }
      />

      <WorkspaceIdentityCard workspace={WORKSPACE} />
      <TeamStats />

      <div className="team-body">
        <div className="team-main">
          <section>
            <SectionHead
              title="Members"
              subtitle="5 active · 1 pending"
            />
            <MembersPanel members={TEAM_MEMBERS} />
          </section>

          <section>
            <SectionHead
              title="Shared collections"
              subtitle="5 of 7 collections"
              linkLabel="Manage access"
              linkHref="/app/collections"
            />
            <SharedCollectionsGrid items={SHARED_COLLECTIONS} />
          </section>
        </div>

        <aside className="team-rail">
          <BillingPanel />
          <RolesReferencePanel />
          <AuditLog entries={AUDIT_LOG} />
        </aside>
      </div>
    </div>
    </ComingSoon>
  );
}
