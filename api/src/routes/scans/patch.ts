import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth.js";
import { patchScanBodySchema } from "./validators.js";
import { serializeScan } from "./shape.js";

export const patch = new Hono();

patch.use("*", requireAuth);

patch.patch("/:id", async (c) => {
  const pb = c.get("pb");
  const id = c.req.param("id");

  const json = await c.req.json().catch(() => null);
  const parsed = patchScanBodySchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body", issues: parsed.error.flatten() }, 400);
  }

  // PB rules already enforce ownership on update; we just whitelist
  // the writable surface so detection-result fields can never leak in.
  try {
    const record = await pb.collection("scans").update(id, parsed.data);
    return c.json(serializeScan(record));
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: unknown }).status) || 500
        : 500;
    if (status === 404 || status === 403) {
      return c.json({ error: "not_found" }, 404);
    }
    return c.json({ error: "update_failed" }, 500);
  }
});
