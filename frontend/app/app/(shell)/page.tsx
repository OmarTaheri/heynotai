import type { Metadata } from "next";
import { SectionHead } from "@/components/ui/SectionHead";
import { Greeting } from "@/components/app/home/Greeting";
import { DropCard } from "@/components/app/home/DropCard";
import { HomeStats } from "@/components/app/home/HomeStats";
import { LastScanCardClient } from "@/components/app/home/LastScanCardClient";
import { ActivityTableClient } from "@/components/app/home/ActivityTableClient";

export const metadata: Metadata = { title: "Home" };

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
        <HomeStats />

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
