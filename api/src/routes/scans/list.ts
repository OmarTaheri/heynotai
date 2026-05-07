import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth.js";
import { listScansQuerySchema } from "./validators.js";
import { serializeScan } from "./shape.js";

export const list = new Hono();

list.use("*", requireAuth);

list.get("/", async (c) => {
  const pb = c.get("pb");
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const parsed = listScansQuerySchema.safeParse({
    page: c.req.query("page"),
    perPage: c.req.query("perPage"),
    type: c.req.query("type"),
    origin: c.req.query("origin"),
    q: c.req.query("q"),
    archived: c.req.query("archived"),
  });
  if (!parsed.success) {
    return c.json({ error: "invalid_query", issues: parsed.error.flatten() }, 400);
  }
  const { page, perPage, type, origin, q, archived } = parsed.data;

  const conds = ['userId = {:userId}'];
  const params: Record<string, unknown> = { userId: user.id };
  if (archived === "true") {
    conds.push("archived = true");
  } else {
    conds.push("(archived = false || archived = null)");
  }
  if (type) {
    conds.push("type = {:type}");
    params.type = type;
  }
  if (origin) {
    conds.push("origin = {:origin}");
    params.origin = origin;
  }
  if (q && q.trim()) {
    conds.push("title ~ {:q}");
    params.q = q.trim();
  }

  const filter = pb.filter(conds.join(" && "), params);

  try {
    const result = await pb
      .collection("scans")
      .getList(page, perPage, { filter, sort: "-created" });
    return c.json({
      items: result.items.map((r) => serializeScan(r)),
      page: result.page,
      perPage: result.perPage,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
    });
  } catch (err) {
    const detail =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "list_failed";
    return c.json({ error: "list_failed", detail }, 500);
  }
});
