import { Hono } from "hono";

import { databaseHealth } from "../db/client.js";
import { env } from "../env.js";

export const health = new Hono();

health.get("/", async (c) => {
  const database = await databaseHealth();
  const payload = {
    ok: database.ok,
    timestamp: new Date().toISOString(),
    services: {
      api: { ok: true },
      database,
      auth: {
        ok: Boolean(env.AUTH_PASSWORD_PEPPER),
        googleConfigured: Boolean(
          env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI,
        ),
      },
      storage: { ok: Boolean(env.UPLOAD_DIR), driver: "filesystem" },
    },
  };
  return database.ok ? c.json(payload) : c.json(payload, 503);
});
