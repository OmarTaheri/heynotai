/* Home-page KPI stats, aggregated from the `scans` collection.
 *
 * Single endpoint, four tiles. Drives the StatGrid on /app — replaces
 * the hand-rolled fixtures that shipped with the dashboard cold-open.
 *
 * Windows are calendar months UTC (matching `getMonthlyUsage`) so the
 * "vs March" delta lines up with what users see on the 1st without a
 * timezone-shaped surprise.
 *
 * Time saved is an estimate of manual-review minutes the user
 * dodged this month. Per scan: text -> wordCount/250 wpm, audio/video
 * -> durationMs/1min, image -> 1 min, web/soc -> 2 min. Sum over the
 * month, expressed in hours.
 *
 * Monitor alerts: there isn't a `monitors` collection yet (the page is
 * still on fixtures), so we synthesize an alert count from
 * `origin = "mon"` AI/mixed verdicts — the row a real monitor would
 * have produced. */
import type PocketBase from "pocketbase";

export type HomeStats = {
  monthLabel: string;
  prevMonthLabel: string;
  scans: { current: number; previous: number; deltaPct: number };
  flagged: { count: number; percent: number };
  timeSavedHours: number;
  monitorAlerts: { count: number; newToday: number };
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const WPM = 250;

export async function getHomeStats(
  pb: PocketBase,
  user: { id: string },
): Promise<HomeStats> {
  const now = new Date();
  const startCurr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startPrev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const startPrevIso = pbDate(startPrev);
  const startCurrIso = pbDate(startCurr);
  const startTodayIso = pbDate(startToday);

  const records = await pb.collection("scans").getFullList({
    filter: `userId = "${user.id}" && created >= "${startPrevIso}"`,
    fields: "type,origin,verdict,wordCount,durationMs,created",
    requestKey: null,
  });

  let currScans = 0;
  let prevScans = 0;
  let flaggedCount = 0;
  let timeSavedMin = 0;
  let monAlerts = 0;
  let monAlertsToday = 0;

  for (const r of records) {
    const created = new Date(r.created as string);
    const inCurr = created >= startCurr;
    if (inCurr) {
      currScans++;
      if (isAi(r.verdict)) flaggedCount++;
      timeSavedMin += manualMinutes(r);
      if (r.origin === "mon" && isAi(r.verdict)) {
        monAlerts++;
        if (created >= startToday) monAlertsToday++;
      }
    } else {
      prevScans++;
    }
  }

  const deltaPct =
    prevScans > 0
      ? Math.round(((currScans - prevScans) / prevScans) * 100)
      : currScans > 0
        ? 100
        : 0;
  const flaggedPct = currScans > 0
    ? Math.round((flaggedCount / currScans) * 100)
    : 0;

  return {
    monthLabel: MONTHS[startCurr.getUTCMonth()],
    prevMonthLabel: MONTHS[startPrev.getUTCMonth()],
    scans: { current: currScans, previous: prevScans, deltaPct },
    flagged: { count: flaggedCount, percent: flaggedPct },
    timeSavedHours: Math.round((timeSavedMin / 60) * 10) / 10,
    monitorAlerts: { count: monAlerts, newToday: monAlertsToday },
  };
}

function isAi(verdict: unknown): boolean {
  return verdict === "ai" || verdict === "mixed";
}

function manualMinutes(r: Record<string, unknown>): number {
  const type = r.type as string;
  if (type === "txt" || type === "web" || type === "soc") {
    const wc = Number(r.wordCount ?? 0);
    if (wc > 0) return wc / WPM;
    return type === "txt" ? 0 : 2;
  }
  if (type === "aud" || type === "vid") {
    const ms = Number(r.durationMs ?? 0);
    if (ms > 0) return ms / 60_000;
    return 3;
  }
  if (type === "img") return 1;
  return 0;
}

function pbDate(d: Date): string {
  return d.toISOString().replace("T", " ").replace("Z", "");
}
