/* `/models` — the catalog endpoint that backs the /app/models page
 *  and the extension drawer's Models tab.
 *
 *  Returns every enabled `detection_models` row tagged with its
 *  `tier` (the minimum plan that can use it). The picker UIs render
 *  rows above the user's current plan as locked + premium, with an
 *  "Upgrade" CTA. Server-side enforcement happens in the scan
 *  endpoints (see `routes/scans/create.ts`, `rescan.ts`).
 *
 *  Internal credentials (`hfModelId`, API keys) are never returned —
 *  those live in the PB row for the API to read at scan time.
 *
 *  Two routes:
 *    GET /models           → catalog grouped by type, cheapest-first
 *    GET /models/defaults  → { txt, img, aud, vid } default slugs for
 *                            the user (cheapest model in-tier per
 *                            modality). Modalities with no in-tier
 *                            model are omitted. */

import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { pbAdmin } from "../lib/pb-admin.js";
import { isPlan, PLAN_RANK, tierFromRow, type Plan } from "../lib/plans.js";

export const models = new Hono();

models.use("*", requireAuth);

type ScanType = "txt" | "img" | "aud" | "vid";
const TYPES: ScanType[] = ["txt", "img", "aud", "vid"];

type CatalogEntry = {
  slug: string;
  name: string;
  type: ScanType;
  description: string;
  accuracy: number;
  tokenCost: number;
  costUnit: "per_scan" | "per_minute";
  tier: Plan;
};

models.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const rows = await fetchAllEnabledModels();
  const grouped: Record<ScanType, CatalogEntry[]> = { txt: [], img: [], aud: [], vid: [] };
  for (const r of rows) {
    if (!isType(r.type)) continue;
    grouped[r.type].push({
      slug: r.slug,
      name: r.name,
      type: r.type,
      description: r.description ?? "",
      accuracy: typeof r.accuracy === "number" ? r.accuracy : 0,
      tokenCost: typeof r.tokenCost === "number" ? r.tokenCost : 1,
      costUnit: r.costUnit === "per_minute" ? "per_minute" : "per_scan",
      tier: tierFromRow(r),
    });
  }
  return c.json({ models: grouped });
});

models.get("/defaults", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const plan: Plan = isPlan(user.plan) ? user.plan : "check";

  const rows = await fetchAllEnabledModels();
  // Track the highest-tier reachable row seen per modality so the
  // user gets the *best* model their plan unlocks as their default —
  // upgrading to certify auto-promotes the txt default from
  // fakespot-roberta (check) to openai-roberta (certify) on first
  // paint. Tie-break inside a tier by tokenCost ascending (the
  // sort order from `fetchAllEnabledModels`).
  const best: Partial<Record<ScanType, { slug: string; tier: Plan }>> = {};
  for (const r of rows) {
    if (!isType(r.type)) continue;
    const tier = tierFromRow(r);
    if (PLAN_RANK[tier] > PLAN_RANK[plan]) continue;
    const current = best[r.type];
    if (!current || PLAN_RANK[tier] > PLAN_RANK[current.tier]) {
      best[r.type] = { slug: r.slug, tier };
    }
  }
  const defaults: Partial<Record<ScanType, string>> = {};
  (Object.keys(best) as ScanType[]).forEach((t) => {
    const entry = best[t];
    if (entry) defaults[t] = entry.slug;
  });

  return c.json({ defaults });
});

type DetectionModelRow = {
  slug: string;
  name: string;
  type: string;
  description?: string;
  accuracy?: number;
  tokenCost?: number;
  costUnit?: string;
  tier?: string;
  plansAllowed?: string[];
};

async function fetchAllEnabledModels(): Promise<DetectionModelRow[]> {
  // Admin client used for a stable read identity. The PB collection
  // rule already gates on `enabled = true`, but filtering here keeps
  // responses consistent if a user/admin client reads it directly.
  // Sort cheapest-first within each type so default-selection and
  // picker order both come out of a single query.
  const admin = await pbAdmin();
  const records = await admin.collection("detection_models").getFullList({
    filter: `enabled = true`,
    sort: "type,tokenCost,accuracy",
    fields:
      "slug,name,type,description,accuracy,tokenCost,costUnit,tier,plansAllowed",
    requestKey: null,
  });
  return records as unknown as DetectionModelRow[];
}

function isType(value: unknown): value is ScanType {
  return TYPES.includes(value as ScanType);
}
