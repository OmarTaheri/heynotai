import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";

export const scan = new Hono();

scan.use("*", requireAuth);

const scanRequestSchema = z.object({
  text: z.string().min(1).max(50_000),
  language: z.string().optional(),
});

/** Stub. Real handler will call the AI adapters in src/lib/ai and
 *  persist the result to PB. Returns a deterministic shape so the
 *  frontend can wire against it today. */
scan.post("/", async (c) => {
  const body = scanRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) {
    return c.json({ error: "invalid_body", issues: body.error.flatten() }, 400);
  }
  return c.json({
    id: crypto.randomUUID(),
    verdict: "unknown",
    confidence: 0,
    note: "stub — wire up AI adapters in api/src/lib/ai/",
    received: body.data,
  });
});
