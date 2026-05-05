"use client";

import { useEffect, useState } from "react";
import { StatGrid, StatTile, type StatTone } from "@/components/ui/StatTile";
import type { IconName } from "@/components/Icon";
import { fetchHomeStats, type HomeStats } from "@/lib/stats-api";
import { useAuth } from "@/lib/auth";

type Tile = {
  label: string;
  value: string;
  unit?: string;
  delta: string;
  tone: StatTone;
  icon?: IconName;
};

function buildTiles(stats: HomeStats): Tile[] {
  const { scans, flagged, timeSavedHours, monthLabel, prevMonthLabel } = stats;
  const scanDelta = scans.deltaPct;
  return [
    {
      label: `Scans · ${monthLabel}`,
      value: scans.current.toLocaleString(),
      delta:
        scans.previous > 0
          ? `${scanDelta >= 0 ? "+" : ""}${scanDelta}% vs ${prevMonthLabel}`
          : `vs ${prevMonthLabel}`,
      tone: scanDelta >= 0 ? "up" : "down",
      icon: "chevron-down",
    },
    {
      label: "Flagged as AI",
      value: String(flagged.percent),
      unit: "%",
      delta: `${flagged.count.toLocaleString()} ${flagged.count === 1 ? "item" : "items"} this month`,
      tone: "down",
    },
    {
      label: `Time saved · ${monthLabel}`,
      value: timeSavedHours.toFixed(1),
      unit: "h",
      delta: "vs reading by hand",
      tone: "up",
    },
    // Monitors aren't backed by a real collection yet — keep this tile
    // as an em-dash placeholder so it doesn't pretend to have data.
    {
      label: "Monitor alerts",
      value: "—",
      delta: "monitors not set up",
      tone: "warn",
    },
  ];
}

const PLACEHOLDER: Tile[] = [
  { label: "Scans", value: "—", delta: " ", tone: "up" },
  { label: "Flagged as AI", value: "—", unit: "%", delta: " ", tone: "down" },
  { label: "Time saved", value: "—", unit: "h", delta: " ", tone: "up" },
  { label: "Monitor alerts", value: "—", delta: " ", tone: "warn" },
];

/** Live KPI tiles for the home page. Hits `GET /me/stats` (see
 *  api/src/lib/stats.ts) and renders the same StatGrid the dashboard
 *  used to render from fixtures. Falls back to em-dash placeholders
 *  while loading or if the request fails so the layout never collapses. */
export function HomeStats() {
  const { user } = useAuth();
  const userId = user?.id;
  const [tiles, setTiles] = useState<Tile[]>(PLACEHOLDER);

  useEffect(() => {
    if (!userId) {
      setTiles(PLACEHOLDER);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const stats = await fetchHomeStats().catch(() => null);
      if (cancelled || !stats) return;
      setTiles(buildTiles(stats));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <StatGrid>
      {tiles.map((tile) => (
        <StatTile
          key={tile.label}
          label={tile.label}
          value={tile.value}
          unit={tile.unit}
          delta={tile.delta}
          tone={tile.tone}
          icon={tile.icon}
        />
      ))}
    </StatGrid>
  );
}
