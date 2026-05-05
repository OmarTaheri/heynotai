/* Real per-user monthly token usage, aggregated from the `scans`
 * collection. Single source of truth for both the sidebar UsageCard
 * and the /app/models TokenUsageBand — caller picks which slice to
 * render.
 *
 * `creditsUsed` (existing field on `scans`) is what every detector
 * writes after a successful run; we sum it for the current calendar
 * month UTC to keep windowing predictable across timezones. */

import type PocketBase from "pocketbase";
import { PLAN_TOKEN_LIMITS, isPlan, type Plan } from "./plans.js";

export type ScanType = "txt" | "img" | "aud" | "vid";

export type MonthlyUsage = {
  used: number;
  /** null = team plan (custom allotment). */
  total: number | null;
  segments: { type: ScanType; value: number }[];
  /** Display-formatted reset date, e.g. "Jun 1". */
  resetsOn: string;
  /** Rounded average tokens spent per day this month. */
  avgPerDay: number;
};

export async function getMonthlyUsage(
  pb: PocketBase,
  user: { id: string; plan?: string },
): Promise<MonthlyUsage> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startIso = pbDateString(startOfMonth);

  // Pull only the fields we need. The auto-pagination on PB's getFullList
  // is fine here — most users have under a few hundred scans/month.
  const records = await pb.collection("scans").getFullList({
    filter: `userId = "${user.id}" && created >= "${startIso}"`,
    fields: "type,creditsUsed",
    requestKey: null, // disable autocancel — we may call this from many routes
  });

  let used = 0;
  const buckets: Record<ScanType, number> = { txt: 0, img: 0, aud: 0, vid: 0 };
  for (const r of records) {
    const cost = typeof r.creditsUsed === "number" ? r.creditsUsed : 0;
    used += cost;
    const t = r.type as string;
    if (t === "txt" || t === "img" || t === "aud" || t === "vid") {
      buckets[t] += cost;
    }
  }

  const plan: Plan = isPlan(user.plan) ? user.plan : "check";
  const total = PLAN_TOKEN_LIMITS[plan];

  const dayOfMonth = now.getUTCDate();
  const avgPerDay = dayOfMonth > 0 ? Math.round(used / dayOfMonth) : 0;

  return {
    used,
    total,
    segments: (Object.keys(buckets) as ScanType[]).map((type) => ({
      type,
      value: buckets[type],
    })),
    resetsOn: formatResetDate(startOfMonth),
    avgPerDay,
  };
}

function formatResetDate(startOfMonth: Date): string {
  const next = new Date(startOfMonth);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[next.getUTCMonth()]} ${next.getUTCDate()}`;
}

function pbDateString(d: Date): string {
  // PocketBase wants "YYYY-MM-DD HH:mm:ss.SSSZ"-ish strings for filters.
  // The ISO form is accepted on >=0.20 — and that's what setup-schema targets.
  return d.toISOString().replace("T", " ").replace("Z", "");
}
