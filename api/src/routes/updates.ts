import { Hono } from "hono";

import { getAdminStore } from "../lib/admin-store.js";

/** Public changelog feed.
 *
 * The `updates` collection is system-authored and contains no user data
 * (see `canReadRecord` in db/store-policy.ts, which grants anonymous
 * reads for exactly this collection). The `/data` lane requires a
 * bearer token for every non-file request, so the website's RSS route —
 * which is fetched by feed readers with no credentials — needs its own
 * unauthenticated door rather than a hole in that gate.
 *
 * Read-only, no query surface beyond a bounded `limit`.
 */
export const updates = new Hono();

const MAX_ITEMS = 100;

type UpdateRow = Record<string, unknown> & { id: string };

updates.get("/", async (c) => {
  const limitParam = Number(c.req.query("limit") ?? MAX_ITEMS);
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), MAX_ITEMS)
      : MAX_ITEMS;

  try {
    const store = await getAdminStore();
    const rows = (await store.collection("updates").getFullList({
      sort: "sortOrder,-publishedAt",
      requestKey: null,
    })) as unknown as UpdateRow[];
    return c.json({ items: rows.slice(0, limit) });
  } catch (error) {
    console.error("[updates] list failed", error);
    return c.json({ error: "updates_unavailable" }, 503);
  }
});
