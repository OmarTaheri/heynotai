import type { MiddlewareHandler } from "hono";

import { storeForUser, type StoreActor } from "../db/store.js";
import {
  authenticateAccessToken,
  extractBearerToken,
} from "../services/auth.js";
import { requestMetadata } from "./session-auth.js";

/** Authenticate an API-owned opaque session and populate both the canonical
 * session context and the legacy `store`/`user` compatibility context. */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const token = extractBearerToken(c.req.header("authorization"));
  if (!token) return c.json({ error: "unauthorized" }, 401);

  const auth = await authenticateAccessToken(token, requestMetadata(c));
  if (!auth) return c.json({ error: "unauthorized" }, 401);

  const actor: StoreActor = {
    id: auth.user.id,
    email: auth.user.email,
    role: auth.user.systemRole,
    systemRole: auth.user.systemRole,
    system_role: auth.user.systemRole,
  };
  c.set("sessionUser", auth.user);
  c.set("appSession", auth.session);
  c.set("isAdmin", auth.isAdmin);
  c.set("user", actor);
  c.set("store", storeForUser(actor));
  await next();
};
