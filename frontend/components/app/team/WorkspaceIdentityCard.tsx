import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import type { Workspace } from "@/lib/team-data";

/**
 * Big "this is your workspace" identity strip — emblem tile + name +
 * meta + workspace-settings action. Sits directly under the page
 * header.
 */
export function WorkspaceIdentityCard({ workspace }: { workspace: Workspace }) {
  return (
    <Card elevated className="team-ws">
      <div className="team-ws-emblem" aria-hidden>
        {workspace.emblem}
      </div>

      <div className="team-ws-info">
        <div className="team-ws-name">
          <span>{workspace.name}</span>
          <span className="team-ws-tag">· {workspace.tagline}</span>
          <Pill tone="gold" compact>
            {workspace.plan.toUpperCase()} PLAN
          </Pill>
        </div>
        <div className="team-ws-meta">
          <span>
            <strong>{workspace.subdomain}</strong>.detect.app
          </span>
          <span className="team-ws-dot" aria-hidden />
          <span>
            Created <strong>{workspace.createdLabel}</strong>
          </span>
          <span className="team-ws-dot" aria-hidden />
          <span>
            <strong>{workspace.seatsUsed}</strong> of{" "}
            <strong>{workspace.seatsTotal}</strong> seats used
          </span>
          <span className="team-ws-dot" aria-hidden />
          <span>
            Renews <strong>{workspace.renewsLabel}</strong>
          </span>
        </div>
      </div>

      <div className="team-ws-actions">
        <Button variant="secondary">
          <Icon name="settings" size={13} />
          <span>Workspace settings</span>
        </Button>
      </div>
    </Card>
  );
}
