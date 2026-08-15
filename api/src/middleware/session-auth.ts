import type { Context, MiddlewareHandler } from "hono";

import {
  authenticateAccessToken,
  extractBearerToken,
  type AuthSession,
  type AuthUser,
} from "../services/auth.js";

declare module "hono" {
  interface ContextVariableMap {
    sessionUser: AuthUser;
    appSession: AuthSession;
    isAdmin: boolean;
  }
}

/** Authenticate the API-owned opaque bearer token and attach its canonical
 * database user/session. No authorization claim is accepted from the client. */
export const requireSession: MiddlewareHandler = async (c, next) => {
  const token = extractBearerToken(c.req.header("authorization"));
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const auth = await authenticateAccessToken(token, requestMetadata(c));
  if (!auth) return c.json({ error: "unauthorized" }, 401);
  c.set("sessionUser", auth.user);
  c.set("appSession", auth.session);
  c.set("isAdmin", auth.isAdmin);
  await next();
};

/** Same lookup as requireSession, but leaves anonymous requests untouched. */
export const optionalSession: MiddlewareHandler = async (c, next) => {
  const token = extractBearerToken(c.req.header("authorization"));
  if (token) {
    const auth = await authenticateAccessToken(token, requestMetadata(c));
    if (auth) {
      c.set("sessionUser", auth.user);
      c.set("appSession", auth.session);
      c.set("isAdmin", auth.isAdmin);
    }
  }
  await next();
};

/** Server-side admin gate. Hiding navigation in the frontend is never treated
 * as authorization; every /admin handler uses this middleware. */
export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const token = extractBearerToken(c.req.header("authorization"));
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const auth = await authenticateAccessToken(token, requestMetadata(c));
  if (!auth) return c.json({ error: "unauthorized" }, 401);
  c.set("sessionUser", auth.user);
  c.set("appSession", auth.session);
  c.set("isAdmin", auth.isAdmin);
  if (!auth.isAdmin) return c.json({ error: "forbidden" }, 403);
  await next();
};

export function requestMetadata(c: Context): {
  ipAddress: string | null;
  userAgent: string | null;
  device: string | null;
} {
  return {
    ipAddress: requestIp(c),
    userAgent: c.req.header("user-agent")?.slice(0, 512) ?? null,
    device: c.req.header("x-heynotai-device")?.slice(0, 120) ?? null,
  };
}

export function requestIp(c: Context): string | null {
  const candidate =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-real-ip") ??
    c.req.header("x-forwarded-for") ??
    null;
  if (!candidate) return null;
  const first = candidate.split(",")[0]?.trim() ?? "";
  return first ? first.slice(0, 64) : null;
}
