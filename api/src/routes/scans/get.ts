import { Hono } from "hono";

import { adminStore } from "../../db/store.js";
import { storeForRequest } from "../../lib/request-store.js";
import { serializeScan } from "./shape.js";

export const get = new Hono();

/** Public scans can be viewed without a session. Private scans are resolved
 * through the caller-scoped store, which applies the same ownership and
 * collection-membership rules as the rest of the API. */
get.get("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const record = await adminStore().collection("scans").getOne(id);
    if (record.visibility === "public") return c.json(serializeScan(record));
  } catch {
    // Deliberately continue to the authenticated path without revealing
    // whether a private record exists.
  }

  const authHeader = c.req.header("authorization");
  if (!authHeader) return c.json({ error: "not_found" }, 404);

  const store = await storeForRequest(authHeader);
  if (!store) return c.json({ error: "unauthorized" }, 401);

  try {
    const record = await store.collection("scans").getOne(id);
    return c.json(serializeScan(record));
  } catch {
    return c.json({ error: "not_found" }, 404);
  }
});
