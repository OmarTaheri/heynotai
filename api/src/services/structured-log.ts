import { sql } from "../db/client.js";
import { createRecordId } from "../db/id.js";
import { env } from "../env.js";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type StructuredLogInput = {
  level?: LogLevel;
  service?: string;
  event: string;
  message: string;
  requestId?: string | null;
  userId?: string | null;
  scanId?: string | null;
  modelId?: string | null;
  providerId?: string | null;
  durationMs?: number | null;
  statusCode?: number | null;
  errorCode?: string | null;
  context?: unknown;
};

export type AuditEventInput = {
  actorUserId?: string | null;
  actorType?: "user" | "admin" | "system" | "worker" | "webhook";
  action: string;
  entityType: string;
  entityId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
};

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 7;
const MAX_KEYS = 100;
const MAX_ARRAY_ITEMS = 50;
const MAX_STRING_LENGTH = 2_048;

const SENSITIVE_KEY =
  /(?:^|[_-])(authorization|cookie|set_cookie|password|passphrase|secret|token|refresh|credential|api[_-]?key|client[_-]?secret|code[_-]?verifier|private[_-]?key)(?:$|[_-])/i;

/** Recursively make arbitrary diagnostic data safe for durable storage.
 *
 * Request/response bodies are intentionally never supplied by the request
 * middleware. This second line of defence handles nested provider errors and
 * accidental secrets supplied by call sites. It is exported so every adapter
 * and the unit tests use exactly the same policy. */
export function redactForLog(value: unknown): unknown {
  return sanitize(value, 0, new WeakSet<object>());
}

function sanitize(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "function" || typeof value === "symbol") {
    return `[${typeof value}]`;
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: sanitizeString(value.name),
      message: sanitizeString(value.message),
      // Stack traces can contain paths and query strings. Keep a bounded,
      // query-redacted version for operators without persisting request data.
      stack: value.stack ? sanitizeString(value.stack) : null,
    };
  }
  if (depth >= MAX_DEPTH) return "[MAX_DEPTH]";
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  if (Array.isArray(value)) {
    const out = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitize(item, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) {
      out.push(`[TRUNCATED ${value.length - MAX_ARRAY_ITEMS} ITEMS]`);
    }
    return out;
  }

  const out: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key, nested] of entries.slice(0, MAX_KEYS)) {
    out[key] = SENSITIVE_KEY.test(normalizeKey(key))
      ? REDACTED
      : sanitize(nested, depth + 1, seen);
  }
  if (entries.length > MAX_KEYS) {
    out.__truncatedKeys = entries.length - MAX_KEYS;
  }
  return out;
}

function normalizeKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function sanitizeString(input: string): string {
  let output = input
    // Bearer/basic values sometimes arrive inside an error message instead of
    // under a well-named key.
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [REDACTED]")
    // Strip sensitive URL query values while retaining the useful route.
    .replace(
      /([?&](?:access_token|refresh_token|token|code|state|key|api_key|signature)=)[^&#\s]+/gi,
      "$1[REDACTED]",
    );
  if (output.length > MAX_STRING_LENGTH) {
    output = `${output.slice(0, MAX_STRING_LENGTH)}…[TRUNCATED]`;
  }
  return output;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const STDOUT_MODE: "pretty" | "json" | "off" = env.LOG_STDOUT === "auto"
  ? (env.NODE_ENV === "production" ? "json" : "pretty")
  : env.LOG_STDOUT;

// Colors help when a human is watching `pnpm dev`; they are noise in a log
// file or a container log collector.
const COLOR_ENABLED = STDOUT_MODE === "pretty" && process.stdout.isTTY === true;

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: "90",
  info: "36",
  warn: "33",
  error: "31",
  fatal: "35",
};

function paint(value: string, color: string): string {
  return COLOR_ENABLED ? `\u001b[${color}m${value}\u001b[0m` : value;
}

/** Mirror an already-redacted log row to the process output.
 *
 * Operators read `docker logs` and `pnpm dev` far more often than they query
 * `system_logs`, and a log that only exists in PostgreSQL is invisible exactly
 * when the database is the thing that broke. This is deliberately best-effort:
 * a console failure must never propagate into the request being described. */
function emitToConsole(
  row: {
    level: LogLevel;
    service: string;
    event: string;
    message: string;
    requestId: string | null;
    userId: string | null;
    durationMs: number | null;
    statusCode: number | null;
    errorCode: string | null;
  },
  context: Record<string, unknown>,
): void {
  if (STDOUT_MODE === "off") return;
  if (LEVEL_RANK[row.level] < LEVEL_RANK[env.LOG_STDOUT_LEVEL]) return;
  const stream = LEVEL_RANK[row.level] >= LEVEL_RANK.warn ? console.error : console.log;
  try {
    if (STDOUT_MODE === "json") {
      stream(JSON.stringify({ time: new Date().toISOString(), ...row, context }));
      return;
    }
    const parts = [
      paint(row.level.toUpperCase().padEnd(5), LEVEL_COLOR[row.level]),
      paint(new Date().toISOString().slice(11, 23), "90"),
      row.event,
      row.message,
    ];
    if (row.durationMs !== null) parts.push(paint(`${row.durationMs}ms`, "90"));
    if (row.errorCode) parts.push(paint(row.errorCode, "31"));
    if (row.requestId) parts.push(paint(`req=${row.requestId.slice(0, 8)}`, "90"));
    if (row.userId) parts.push(paint(`user=${row.userId}`, "90"));
    stream(parts.join(" "));
    // Route-level detail is noise on healthy requests but is the whole point
    // of the line when something failed.
    if (LEVEL_RANK[row.level] >= LEVEL_RANK.warn && Object.keys(context).length > 0) {
      stream(paint(`      ${JSON.stringify(context)}`, "90"));
    }
  } catch {
    // A broken stdout pipe must not fail the request.
  }
}

/** Persist a queryable log event. Logging must never take down the request it
 * describes, so database failures fall back to one sanitized JSON stdout line. */
export async function writeStructuredLog(input: StructuredLogInput): Promise<void> {
  const context = redactForLog(input.context ?? {}) as Record<string, unknown>;
  const row = {
    id: createRecordId(),
    level: input.level ?? "info",
    service: input.service ?? "api",
    event: sanitizeString(input.event).slice(0, 160),
    message: sanitizeString(input.message),
    requestId: input.requestId ?? null,
    userId: input.userId ?? null,
    scanId: input.scanId ?? null,
    modelId: input.modelId ?? null,
    providerId: input.providerId ?? null,
    durationMs: finiteInteger(input.durationMs),
    statusCode: finiteInteger(input.statusCode),
    errorCode: input.errorCode ? sanitizeString(input.errorCode).slice(0, 160) : null,
  };

  emitToConsole(row, context);

  try {
    await sql`
      INSERT INTO system_logs (
        id, level, service, event, message, request_id, user_id, scan_id,
        model_id, provider_id, duration_ms, status_code, error_code, context,
        redacted
      ) VALUES (
        ${row.id}, ${row.level}, ${row.service}, ${row.event}, ${row.message},
        ${row.requestId}, ${row.userId}, ${row.scanId}, ${row.modelId},
        ${row.providerId}, ${row.durationMs}, ${row.statusCode}, ${row.errorCode},
        ${dbJson(context)}, true
      )
    `;
  } catch (error) {
    // The row itself already reached the console above; this line records that
    // it never reached `system_logs`, so a reader knows the table is incomplete.
    const fallback = redactForLog({
      ...row,
      context,
      persistenceError: error,
    });
    console.error(JSON.stringify({ type: "structured_log_fallback", ...fallback as object }));
  }
}

/** Audit rows are append-only and contain redacted before/after snapshots. */
export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  const before = input.before === undefined ? null : redactForLog(input.before);
  const after = input.after === undefined ? null : redactForLog(input.after);
  const metadata = redactForLog(input.metadata ?? {});
  // Audit rows answer "who did what" during local auth debugging, so mirror
  // them to the console alongside the request line. This does not create a
  // second `system_logs` row.
  emitToConsole(
    {
      level: "info",
      service: "api",
      event: `audit.${input.action}`,
      message: `${input.entityType}${input.entityId ? ` ${input.entityId}` : ""}`,
      requestId: input.requestId ?? null,
      userId: input.actorUserId ?? null,
      durationMs: null,
      statusCode: null,
      errorCode: null,
    },
    metadata as Record<string, unknown>,
  );
  try {
    await sql`
      INSERT INTO audit_events (
        id, actor_user_id, actor_type, action, entity_type, entity_id,
        request_id, ip_address, user_agent, before_data, after_data, metadata
      ) VALUES (
        ${createRecordId()}, ${input.actorUserId ?? null},
        ${input.actorType ?? "user"}, ${input.action}, ${input.entityType},
        ${input.entityId ?? null}, ${input.requestId ?? null},
        ${input.ipAddress ?? null}, ${truncate(input.userAgent, 512)},
        ${before === null ? null : dbJson(before)},
        ${after === null ? null : dbJson(after)}, ${dbJson(metadata)}
      )
    `;
  } catch (error) {
    await writeStructuredLog({
      level: "error",
      event: "audit.persistence_failed",
      message: "Could not persist an audit event",
      requestId: input.requestId,
      userId: input.actorUserId,
      errorCode: "audit_write_failed",
      context: { action: input.action, entityType: input.entityType, error },
    });
  }
}

function finiteInteger(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(-2_147_483_648, Math.min(2_147_483_647, Math.round(value)))
    : null;
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

function dbJson(value: unknown) {
  return sql.json(value as never);
}
