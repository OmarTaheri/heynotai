/* `/models` — the catalog endpoint that backs the /app/models page.
 *
 *  Lists every enabled `detection_models` row whose `plansAllowed`
 *  includes the caller's plan, grouped by content type (txt/img/aud/vid).
 *  `hfModelId`, `apiKey`-style fields are NEVER returned — those are
 *  internal credentials the owner edits in PB admin and the API uses
 *  server-side at scan time.
 *
 *  Two routes:
 *    GET /models           → catalog grouped by type
 *    GET /models/defaults  → { txt, img, aud, vid } default slugs for the user */

import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { pbAdmin } from "../lib/pb-admin.js";
import { isPlan, type Plan } from "../lib/plans.js";

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
};

models.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const plan: Plan = isPlan(user.plan) ? user.plan : "check";

  const rows = await fetchEnabledModels(plan);
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
    });
  }
  return c.json({ models: grouped });
});

models.get("/defaults", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const plan: Plan = isPlan(user.plan) ? user.plan : "check";

  const rows = await fetchEnabledModels(plan);
  const defaults: Partial<Record<ScanType, string>> = {};

  // First pass: rows that flag this plan as a default.
  for (const r of rows) {
    if (!isType(r.type) || defaults[r.type]) continue;
    const flagged = Array.isArray(r.defaultForPlans) && r.defaultForPlans.includes(plan);
    if (flagged) defaults[r.type] = r.slug;
  }
  // Fallback: first allowed row per type.
  for (const r of rows) {
    if (!isType(r.type) || defaults[r.type]) continue;
    defaults[r.type] = r.slug;
  }

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
  plansAllowed?: string[];
  defaultForPlans?: string[];
};

async function fetchEnabledModels(plan: Plan): Promise<DetectionModelRow[]> {
  // We use the admin client so the API can read with a stable identity
  // regardless of per-user listRule edge cases. The PB collection rule
  // also gates on `enabled = true`, but filtering here keeps responses
  // consistent if a user/admin client reads it directly later.
  const admin = await pbAdmin();
  const records = await admin.collection("detection_models").getFullList({
    filter: `enabled = true && plansAllowed ~ "${plan}"`,
    sort: "type,accuracy",
    fields:
      "slug,name,type,description,accuracy,tokenCost,costUnit,plansAllowed,defaultForPlans",
    requestKey: null,
  });
  return records as unknown as DetectionModelRow[];
}

function isType(value: unknown): value is ScanType {
  return TYPES.includes(value as ScanType);
}
