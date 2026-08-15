import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

import postgres from "postgres";
import { env } from "../env.js";

/** Shared postgres.js tagged-template client.
 *
 * postgres.js opens connections lazily, so importing this module during a
 * build or a unit test does not require PostgreSQL to be running. Runtime
 * callers should invoke `initializeDatabase()` once during service startup. */
export const sql = postgres(env.DATABASE_URL, {
  max: env.DATABASE_POOL_SIZE,
  idle_timeout: 20,
  connect_timeout: 10,
  max_lifetime: 60 * 30,
  transform: {
    undefined: null,
  },
});

export type DatabaseHealth = {
  ok: boolean;
  latencyMs: number;
  timestamp: string;
  database?: string;
  error?: string;
};

/** Apply every checked-in SQL migration exactly once.
 *
 * A transaction-scoped advisory lock makes concurrent API/worker startups
 * safe. A changed checksum is treated as a deployment error: applied
 * migrations are immutable; schema changes belong in a new numbered file. */
export async function initializeDatabase(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const migrationUrl = new URL("../../migrations/", import.meta.url);
  const names = (await readdir(migrationUrl))
    .filter((name) => /^\d+.*\.sql$/i.test(name))
    .sort((a, b) => a.localeCompare(b));

  for (const name of names) {
    const source = await readFile(new URL(name, migrationUrl), "utf8");
    const checksum = createHash("sha256").update(source).digest("hex");

    await sql.begin(async (tx) => {
      // One stable application-wide key. `hashtext` keeps it independent of
      // architecture/JavaScript integer precision.
      await tx`SELECT pg_advisory_xact_lock(hashtext('heynotai:migrations'))`;
      const existing = await tx<{ checksum: string }[]>`
        SELECT checksum
        FROM schema_migrations
        WHERE name = ${name}
      `;
      if (existing.length > 0) {
        if (existing[0]?.checksum !== checksum) {
          throw new Error(
            `Migration ${name} was modified after it was applied`,
          );
        }
        return;
      }

      await tx.unsafe(source);
      await tx`
        INSERT INTO schema_migrations (name, checksum)
        VALUES (${name}, ${checksum})
      `;
    });
  }
}

export async function closeDatabase(): Promise<void> {
  await sql.end({ timeout: 5 });
}

export async function databaseHealth(): Promise<DatabaseHealth> {
  const startedAt = performance.now();
  const timestamp = new Date().toISOString();
  try {
    const rows = await sql<{ database: string }[]>`
      SELECT current_database() AS database
    `;
    return {
      ok: true,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      timestamp,
      database: rows[0]?.database,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      timestamp,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
