import type { Metadata } from "next";
import { SectionHead } from "@/components/ui/SectionHead";
import { StatGrid, StatTile, type StatTone } from "@/components/ui/StatTile";
import type { IconName } from "@/components/Icon";
import { Greeting } from "@/components/app/home/Greeting";
import { DropCard } from "@/components/app/home/DropCard";
import { LastScanCardClient } from "@/components/app/home/LastScanCardClient";
import { ActivityTableClient } from "@/components/app/home/ActivityTableClient";

export const metadata: Metadata = { title: "Home" };

type Stat = {
  label: string;
  value: string;
  unit?: string;
  delta: string;
  tone: StatTone;
  icon?: IconName;
};

const STATS: Stat[] = [
  {
    label: "Scans · April",
    value: "1,247",
    delta: "+18% vs March",
    tone: "up",
    icon: "chevron-down",
  },
  {
    label: "Flagged as AI",
    value: "38",
    unit: "%",
    delta: "474 items this month",
    tone: "down",
  },
  {
    label: "Time saved · April",
    value: "12.4",
    unit: "h",
    delta: "vs reading by hand",
    tone: "up",
  },
  {
    label: "Monitor alerts",
    value: "2",
    delta: "new today",
    tone: "warn",
    icon: "alert-triangle",
  },
];

/**
 * Home — the dashboard cold-open. Server component, dark theme, same
 * tokens + visual language as the extension popup.
 *
 * Page-specific compositions live under components/app/home; everything
 * reusable (Card, Pill, Button, ScoreRing, ProgressBar, StatTile,
 * SectionHead, TypeChip, OriginBadge, IconTile, KeycapHint, Avatar,
 * PageHeader) lives in components/ui and is shared with the rest of
 * the app + future surfaces.
 */
export default function HomePage() {
  return (
    <div className="home panel-reveal">
      <section className="home-hero">
        <Greeting
          greeting="Good morning"
          subtitle="Three monitors flagged new AI content overnight, and your last scan finished in 2.1 seconds."
        />
        <DropCard />
      </section>

      <div className="home-feed">
        <StatGrid>
          {STATS.map((stat) => (
            <StatTile
              key={stat.label}
              label={stat.label}
              value={stat.value}
              unit={stat.unit}
              delta={stat.delta}
              tone={stat.tone}
              icon={stat.icon}
            />
          ))}
        </StatGrid>

        <section>
          <SectionHead
            title="Last scan"
            subtitle="2 minutes ago"
            linkLabel="Open full view"
            linkHref="/app/library"
          />
          <LastScanCardClient />
        </section>

        <section>
          <SectionHead
            title="Recent activity"
            linkLabel="View library"
            linkHref="/app/library"
          />
          <ActivityTableClient />
        </section>
      </div>
    </div>
  );
}
