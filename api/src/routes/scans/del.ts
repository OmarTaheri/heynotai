import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth.js";

export const del = new Hono();

del.use("*", requireAuth);

del.delete("/:id", async (c) => {
  const pb = c.get("pb");
  const id = c.req.param("id");
  try {
    await pb.collection("scans").delete(id);
    return c.body(null, 204);
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: unknown }).status) || 500
        : 500;
    if (status === 404 || status === 403) {
      return c.json({ error: "not_found" }, 404);
    }
    return c.json({ error: "delete_failed" }, 500);
  }
});
