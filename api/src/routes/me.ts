import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";

export const me = new Hono();

me.use("*", requireAuth);

me.get("/", (c) => {
  const user = c.get("user");
  return c.json({ user });
});
