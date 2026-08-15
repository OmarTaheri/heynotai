import { randomUUID } from "node:crypto";
import type { MiddlewareHandler } from "hono";

import { writeStructuredLog } from "../services/structured-log.js";

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
    requestStartedAt: number;
  }
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/** Correlates every API request with one durable, body-free summary row.
 * Install this before route/auth middleware so it can observe the final user,
 * status, and duration. */
export const requestObservability: MiddlewareHandler = async (c, next) => {
  const supplied = c.req.header("x-request-id")?.trim();
  const requestId = supplied && REQUEST_ID_PATTERN.test(supplied)
    ? supplied
    : randomUUID();
  const startedAt = performance.now();
  c.set("requestId", requestId);
  c.set("requestStartedAt", startedAt);
  c.header("x-request-id", requestId);

  let thrown: unknown;
  try {
    await next();
  } catch (error) {
    thrown = error;
    throw error;
  } finally {
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    const status = thrown ? 500 : c.res.status;
    const user = c.get("sessionUser");
    await writeStructuredLog({
      level: thrown || status >= 500 ? "error" : status >= 400 ? "warn" : "info",
      service: "api",
      event: "http.request",
      message: `${c.req.method} ${c.req.path} ${status}`,
      requestId,
      userId: user?.id ?? null,
      durationMs,
      statusCode: status,
      errorCode: thrown ? "unhandled_error" : null,
      context: {
        method: c.req.method,
        // c.req.path excludes the query string, which can carry OAuth codes,
        // search text, or source URLs.
        path: c.req.path,
        sessionId: c.get("appSession")?.id ?? null,
      },
    });
  }
};
