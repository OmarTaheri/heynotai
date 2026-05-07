import { Hono } from "hono";
import PocketBase from "pocketbase";
import { env } from "../../env.js";
import { pbForRequest } from "../../lib/pb.js";
import { serializeScan } from "./shape.js";

export const get = new Hono();

/** Public-share fast path: try an unauthenticated lookup constrained to
 *  `visibility = "public"` so anonymous viewers can read public-share
 *  scans without sending an Authorization header. PB's `viewRule` is
 *  `userId = @request.auth.id || visibility = "public"`, so an unauth
 *  client can read public ones; private ones return 404 to that
 *  client, then we fall through to the authenticated path so the owner
 *  can still load their own private scan.
 *
 *  Auth is inlined here (rather than the shared `requireAuth`
 *  middleware) because that middleware short-circuits with a 401 — we
 *  want to *try* anonymous first and only require auth on fallback. */
get.get("/:id", async (c) => {
  const id = c.req.param("id");
  const authHeader = c.req.header("authorization");

  // Anonymous attempt — works for public-share visibility.
  const anonPb = new PocketBase(env.POCKETBASE_URL);
  try {
    const record = await anonPb.collection("scans").getOne(id);
    if (record.visibility === "public") {
      return c.json(serializeScan(record));
    }
  } catch {
    /* fall through */
  }

  if (!authHeader) {
    return c.json({ error: "not_found" }, 404);
  }

  // Authenticated attempt.
  const pb = pbForRequest(authHeader);
  if (!pb.authStore.isValid) {
    return c.json({ error: "unauthorized" }, 401);
  }
  try {
    await pb.collection("users").authRefresh();
  } catch {
    return c.json({ error: "unauthorized" }, 401);
  }
  try {
    const record = await pb.collection("scans").getOne(id);
    return c.json(serializeScan(record));
  } catch {
    return c.json({ error: "not_found" }, 404);
  }
});
