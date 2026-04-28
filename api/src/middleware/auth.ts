import type { MiddlewareHandler } from "hono";
import { pbForRequest } from "../lib/pb.js";

/** Verifies the caller's JWT against PocketBase and stashes the
 *  authenticated PB client + user record on the context. Routes that
 *  need the user can read `c.get("pb")` / `c.get("user")`. */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const pb = pbForRequest(c.req.header("authorization") ?? null);
  if (!pb.authStore.isValid) {
    return c.json({ error: "unauthorized" }, 401);
  }
  try {
    // Refresh validates the token server-side. Cheaper than authRefresh
    // when we don't need a new token, but does the same verification.
    await pb.collection("users").authRefresh();
  } catch {
    return c.json({ error: "unauthorized" }, 401);
  }
  c.set("pb", pb);
  c.set("user", pb.authStore.record);
  await next();
};
