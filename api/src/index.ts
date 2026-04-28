import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import "./types.js";
import { env } from "./env.js";
import { health } from "./routes/health.js";
import { me } from "./routes/me.js";
import { scan } from "./routes/scan.js";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return null;
      for (const allowed of env.CORS_ORIGINS) {
        if (allowed === origin) return origin;
        if (allowed.endsWith("*") && origin.startsWith(allowed.slice(0, -1))) {
          return origin;
        }
      }
      return null;
    },
    credentials: true,
  }),
);

app.route("/health", health);
app.route("/me", me);
app.route("/scan", scan);

app.notFound((c) => c.json({ error: "not_found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`api → http://localhost:${info.port}`);
  console.log(`pocketbase → ${env.POCKETBASE_URL}`);
});
