import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import "./types.js";
import { closeDatabase, initializeDatabase } from "./db/client.js";
import { env } from "./env.js";
import { requestObservability } from "./middleware/request-observability.js";
import { admin } from "./routes/admin.js";
import { auth } from "./routes/auth.js";
import { billing } from "./routes/billing.js";
import { data } from "./routes/data.js";
import { health } from "./routes/health.js";
import { me } from "./routes/me.js";
import { models } from "./routes/models.js";
import { scans } from "./routes/scans/index.js";
import { updates } from "./routes/updates.js";
import { seedReviewerAccount } from "./services/seed-reviewer.js";
import { writeStructuredLog } from "./services/structured-log.js";

const app = new Hono();

app.use("*", requestObservability);
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
    allowHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
    exposeHeaders: ["X-Request-Id"],
  }),
);

app.route("/health", health);
app.route("/auth", auth);
app.route("/data", data);
app.route("/admin", admin);
app.route("/me", me);
app.route("/models", models);
app.route("/scans", scans);
app.route("/billing", billing);
app.route("/updates", updates);

app.notFound((c) => c.json({ error: "not_found" }, 404));
app.onError((error, c) => {
  void writeStructuredLog({
    level: "error",
    event: "http.unhandled_error",
    message: "Unhandled API error",
    requestId: c.get("requestId"),
    userId: c.get("sessionUser")?.id,
    statusCode: 500,
    errorCode: "internal_error",
    context: { error, path: c.req.path, method: c.req.method },
  });
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

/** Host of DATABASE_URL, for log lines. Never the credentials. */
function databaseHost(): string {
  try {
    return new URL(env.DATABASE_URL).host;
  } catch {
    return "<unparseable DATABASE_URL>";
  }
}

// A database that cannot be reached used to surface as an unhandled
// rejection and a container restart loop, which says nothing about what is
// wrong. Name the host and the usual causes instead, then exit.
try {
  await initializeDatabase();
} catch (error) {
  console.error(`[boot] could not reach postgres at ${databaseHost()}`);
  console.error(`[boot] ${error instanceof Error ? error.message : String(error)}`);
  console.error(
    "[boot] check that DATABASE_URL is correct and that this container shares a " +
      "docker network with that host — a managed database in another project is " +
      "not resolvable by default",
  );
  process.exit(1);
}

// No-ops unless REVIEWER_EMAIL/REVIEWER_PASSWORD are set. Runs after
// migrations so the users table is guaranteed to exist.
await seedReviewerAccount();

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`api -> http://localhost:${info.port}`);
  console.log(`postgres -> ${databaseHost()}`);
});

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`received ${signal}; closing api`);
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
