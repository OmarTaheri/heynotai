import { Hono } from "hono";
import { env } from "../env.js";

export const health = new Hono();

health.get("/", async (c) => {
  let pbOk = false;
  try {
    const r = await fetch(`${env.POCKETBASE_URL}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    pbOk = r.ok;
  } catch {
    pbOk = false;
  }
  return c.json({
    ok: true,
    pocketbase: pbOk,
    timestamp: new Date().toISOString(),
  });
});
