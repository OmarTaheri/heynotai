import { sql } from "../db/client.js";
import type { DatabaseStore } from "../db/store.js";
import { PLAN_TOKEN_LIMITS, isPlan, type Plan } from "./plans.js";

export type ScanType = "txt" | "img" | "aud" | "vid";

export type MonthlyUsage = {
  used: number;
  total: number | null;
  segments: { type: ScanType; value: number }[];
  resetsOn: string;
  avgPerDay: number;
};

/** Query the immutable charge/refund ledger used by both the admin console and
 * customer usage UI. The DatabaseStore parameter is retained for route API
 * compatibility while persistence is handled atomically in PostgreSQL. */
export async function getMonthlyUsage(
  _store: DatabaseStore,
  user: { id: string; plan?: string },
): Promise<MonthlyUsage> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [usageRows, userRows] = await Promise.all([
    sql<{ modality: string; credits: number | string }[]>`
      SELECT COALESCE(metadata->>'modality', '') AS modality,
             COALESCE(sum(credits), 0) AS credits
      FROM model_usage_ledger
      WHERE user_id = ${user.id}
        AND occurred_at >= ${startOfMonth}
      GROUP BY COALESCE(metadata->>'modality', '')
    `,
    sql<{ custom_monthly_limit: number | string | null; plan: string }[]>`
      SELECT custom_monthly_limit, plan
      FROM users
      WHERE id = ${user.id} AND deleted_at IS NULL
      LIMIT 1
    `,
  ]);

  let used = 0;
  const buckets: Record<ScanType, number> = { txt: 0, img: 0, aud: 0, vid: 0 };
  for (const row of usageRows) {
    const cost = Number(row.credits ?? 0);
    used += cost;
    if (row.modality === "txt" || row.modality === "img" ||
        row.modality === "aud" || row.modality === "vid") {
      buckets[row.modality] += cost;
    }
  }

  const persisted = userRows[0];
  const plan: Plan = isPlan(persisted?.plan)
    ? persisted.plan
    : isPlan(user.plan) ? user.plan : "check";
  const customLimit = persisted?.custom_monthly_limit;
  const total = customLimit === null || customLimit === undefined
    ? PLAN_TOKEN_LIMITS[plan]
    : Number(customLimit);
  const avgPerDay = now.getUTCDate() > 0 ? Math.round(used / now.getUTCDate()) : 0;

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
