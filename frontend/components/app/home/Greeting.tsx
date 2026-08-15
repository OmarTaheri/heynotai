"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { fetchHomeStats } from "@/lib/stats-api";

/**
 * Hero-style greeting at the top of the home page.
 *
 * Borrowed from the marketing hero's "Hey. That's not human." pattern:
 * the surrounding phrase renders dimmed, the addressee renders at full
 * opacity so it pops as the line's anchor. Inter only — weight + size
 * + letter-spacing carry the editorial feel.
 *
 * Both the greeting and the subtitle are derived at render time: the
 * greeting from the viewer's local clock, the subtitle from the same
 * `/me/stats` payload the KPI tiles use. Neither is passed in as copy,
 * because a fixed "Good morning" / "three monitors flagged…" line is
 * wrong for most visits.
 *
 * `accentName` is optional — when omitted, the user's onboarding handle
 * (with a fallback chain handled in mapUser → user.displayName) is used.
 */
export function Greeting({ accentName }: { accentName?: string }) {
  const { user } = useAuth();
  const name = accentName ?? user?.displayName ?? "there";
  const greeting = useGreeting();
  const subtitle = useSubtitle(user?.id);

  return (
    <header className="home-greet">
      <div>
        <h1 className="home-greet-h1">
          {greeting}, <em>{name}</em>
        </h1>
        {/* Non-breaking space holds the line's height while the stats
            request is in flight so the hero doesn't jump on load. */}
        <p className="home-greet-sub">{subtitle || " "}</p>
      </div>
    </header>
  );
}

function greetingForHour(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Rendered on the server first, so start from a neutral phrase and
 *  settle on the viewer's local time after hydration — otherwise the
 *  server's clock decides and React logs a hydration mismatch. */
function useGreeting(): string {
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);
  return greeting;
}

function useSubtitle(userId: string | undefined): string {
  const [subtitle, setSubtitle] = useState("");

  useEffect(() => {
    if (!userId) {
      setSubtitle("");
      return;
    }
    let cancelled = false;
    void (async () => {
      const stats = await fetchHomeStats().catch(() => null);
      if (cancelled || !stats) return;
      const { scans, flagged, monthLabel } = stats;
      if (scans.current === 0) {
        setSubtitle(
          "No scans yet this month — drop a file or paste some text to run your first check.",
        );
        return;
      }
      const scanWord = scans.current === 1 ? "scan" : "scans";
      const flaggedPart =
        flagged.count === 0
          ? "nothing flagged as AI so far"
          : `${flagged.count} flagged as AI (${flagged.percent}%)`;
      setSubtitle(
        `${scans.current.toLocaleString()} ${scanWord} in ${monthLabel} — ${flaggedPart}.`,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return subtitle;
}
