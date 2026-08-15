import type { Metadata } from "next";
import { SectionHead } from "@/components/ui/SectionHead";
import { Greeting } from "@/components/app/home/Greeting";
import { DropCard } from "@/components/app/home/DropCard";
import { HomeStats } from "@/components/app/home/HomeStats";
import { LastScanSection } from "@/components/app/home/LastScanSection";
import { ActivityTableClient } from "@/components/app/home/ActivityTableClient";

export const metadata: Metadata = { title: "Home" };

/**
 * Home — the dashboard cold-open. Server component, dark theme, same
 * tokens + visual language as the extension popup.
 *
 * Everything with a number or a timestamp on it is a client component
 * that fetches its own data (`Greeting`, `HomeStats`, `LastScanSection`,
 * `ActivityTableClient`). This page owns layout and nothing else — no
 * copy here should imply a fact about the user's account.
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
        <Greeting />
        <DropCard />
      </section>

      <div className="home-feed">
        <HomeStats />

        <LastScanSection />

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
