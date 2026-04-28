import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHead } from "@/components/ui/SectionHead";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { MonitorLiveBar } from "@/components/app/monitors/MonitorLiveBar";
import { MonitorAlertList } from "@/components/app/monitors/MonitorAlertList";
import { MonitorCard } from "@/components/app/monitors/MonitorCard";
import { MonitorTemplates } from "@/components/app/monitors/MonitorTemplates";
import { MonitorPlanUpsell } from "@/components/app/monitors/MonitorPlanUpsell";
import {
  MONITORS,
  MONITOR_ALERTS,
  MONITOR_TEMPLATES,
} from "@/lib/monitors-data";

export const metadata: Metadata = { title: "Monitors" };

/**
 * Monitors — automated-watch dashboard. Server component, dark theme,
 * same shell + tokens as the rest of /app. Page-only chrome lives in
 * components/app/monitors; reusable primitives (Sparkline, StatusDot,
 * Card, Pill, Button, PageHeader, SectionHead) sit in components/ui
 * so future pages can pick them up.
 */
export default function MonitorsPage() {
  const active = MONITORS.filter((m) => m.status !== "paused").length;
  const paused = MONITORS.length - active;

  return (
    <div className="monitors panel-reveal">
      <PageHeader
        title="Monitors"
        subtitle="Set up automated watches on URLs, channels, feeds, and folders. We'll scan and alert you when AI content shows up."
        actions={
          <>
            <Button variant="secondary">
              <Icon name="activity" size={13} />
              Alert history
            </Button>
            <Button variant="primary">
              <Icon name="plus" size={13} />
              New monitor
            </Button>
          </>
        }
      />

      <MonitorLiveBar
        status="running"
        active={active}
        paused={paused}
        nextCheck="4m 12s"
      />

      <section>
        <SectionHead
          title="Recent alerts"
          subtitle="last 24h · 3 unread"
          linkLabel="View all"
          linkHref="/app/library"
        />
        <MonitorAlertList alerts={MONITOR_ALERTS} />
      </section>

      <section>
        <SectionHead
          title="Active monitors"
          subtitle={`${MONITORS.length} total · ${active} running · ${paused} paused`}
        />
        <div className="mon-list">
          {MONITORS.map((m) => (
            <MonitorCard key={m.id} monitor={m} />
          ))}
        </div>
      </section>

      <MonitorTemplates templates={MONITOR_TEMPLATES} />

      <MonitorPlanUpsell used={MONITORS.length} cap={10} plan="Pro" />
    </div>
  );
}
