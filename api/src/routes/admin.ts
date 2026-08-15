import { Hono, type Context } from "hono";
import { z } from "zod";

import { sql } from "../db/client.js";
import { createRecordId } from "../db/id.js";
import { requireAdmin, requestIp } from "../middleware/session-auth.js";
import {
  credentialHint,
  decryptCredential,
  encryptCredential,
} from "../model-runtime/credentials.js";
import { normalizeModelResponse } from "../model-runtime/response-mapper.js";
import type { ResponseSpec } from "../model-runtime/types.js";
import {
  redactForLog,
  writeAuditEvent,
  writeStructuredLog,
} from "../services/structured-log.js";

export const admin = new Hono();
admin.use("*", requireAdmin);

type JsonObject = Record<string, unknown>;
type ProviderRow = {
  id: string;
  key: string;
  name: string;
  driver: string;
  base_url: string;
  auth_scheme: string;
  credential_ciphertext: string | null;
  credential_hint: string;
  config: JsonObject | null;
  enabled: boolean;
  is_local: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type ModelRow = {
  id: string;
  slug: string;
  name: string;
  type: "txt" | "img" | "aud" | "vid";
  provider_id: string | null;
  provider_name?: string | null;
  external_model_id: string;
  description: string;
  accuracy: number | string;
  enabled: boolean;
  tier: "check" | "verify" | "certify" | "team";
  token_cost: number | string;
  cost_unit: string;
  is_default: boolean;
  request_spec: JsonObject | null;
  response_spec: JsonObject | null;
  input_limits: JsonObject | null;
  execution_limits: JsonObject | null;
  runtime_config: JsonObject | null;
  config_version: number;
  created_at: Date | string;
  updated_at: Date | string;
};

const pageSchema = z.coerce.number().int().min(1).max(100_000).default(1);
const perPageSchema = z.coerce.number().int().min(1).max(100).default(25);
const idSchema = z.string().regex(/^[a-z0-9]{1,64}$/i);
const planSchema = z.enum(["check", "verify", "certify", "team"]);
const modelTypeSchema = z.enum(["txt", "img", "aud", "vid"]);

const providerInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
  kind: z.enum(["local", "huggingface", "openai-compatible", "http"]),
  baseUrl: z.string().trim().max(2_048),
  authType: z.enum(["none", "bearer", "api-key", "basic"]),
  credential: z.string().max(16_384).optional(),
  enabled: z.boolean(),
  timeoutMs: z.number().int().min(100).max(300_000),
  maxRetries: z.number().int().min(0).max(10),
  requestsPerMinute: z.number().int().positive().max(1_000_000).nullable(),
  concurrencyLimit: z.number().int().positive().max(10_000).nullable(),
}).strict();

const responseMappingSchema = z.object({
  preset: z.enum([
    "hf-classification",
    "openai-compatible",
    "velma-segments",
    "generic-json",
  ]),
  resultPath: z.string().max(512).optional().default(""),
  labelPath: z.string().max(512).optional().default(""),
  scorePath: z.string().max(512).optional().default(""),
  modelPath: z.string().max(512).optional().default(""),
  errorPath: z.string().max(512).optional().default(""),
  aiLabels: z.array(z.string().max(100)).max(100).optional().default([]),
  humanLabels: z.array(z.string().max(100)).max(100).optional().default([]),
  scoreScale: z.enum(["zero_to_one", "zero_to_hundred"]).optional().default("zero_to_one"),
  invertScore: z.boolean().optional().default(false),
  aggregation: z.enum(["first", "max", "mean", "weighted_mean"]).optional().default("first"),
  mixedThreshold: z.number().min(0).max(100).optional().default(40),
  aiThreshold: z.number().min(0).max(100).optional().default(70),
}).strict();

const modelInputObject = z.object({
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,99}$/),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(4_000).default(""),
  type: modelTypeSchema,
  providerId: idSchema,
  modelIdentifier: z.string().trim().max(500).default(""),
  endpointPath: z.string().trim().max(2_048).default(""),
  enabled: z.boolean(),
  accuracy: z.number().min(0).max(100),
  tier: planSchema,
  plansAllowed: z.array(planSchema).max(4),
  defaultForPlans: z.array(planSchema).max(4),
  tokenCost: z.number().min(0).max(1_000_000),
  costUnit: z.enum(["per_scan", "per_minute"]),
  inputLimits: z.object({
    maxCharacters: z.number().int().positive().nullable(),
    maxBytes: z.number().int().positive().nullable(),
    maxDurationSeconds: z.number().positive().nullable(),
  }).strict(),
  executionLimits: z.object({
    timeoutMs: z.number().int().min(100).max(300_000),
    maxRetries: z.number().int().min(0).max(10),
    requestsPerMinute: z.number().int().positive().nullable(),
    concurrencyLimit: z.number().int().positive().nullable(),
  }).strict(),
  requestTemplate: z.record(z.unknown()),
  responseMapping: responseMappingSchema,
}).strict();

const modelInputSchema = modelInputObject.superRefine((value, ctx) => {
  if (value.responseMapping.mixedThreshold > value.responseMapping.aiThreshold) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["responseMapping", "mixedThreshold"],
      message: "mixedThreshold must be less than or equal to aiThreshold",
    });
  }
});

admin.get("/overview", async (c) => {
  const [users, scans, reliability, modelCount, providers, modelHealth, recent] =
    await Promise.all([
      sql<{ total: number; active: number }[]>`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE status = 'active')::int AS active
        FROM users WHERE deleted_at IS NULL
      `,
      sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM app_records
        WHERE collection = 'scans' AND deleted_at IS NULL
          AND created_at >= now() - interval '24 hours'
      `,
      sql<{ error_rate: number | string | null; p95: number | string | null }[]>`
        SELECT
          CASE WHEN count(*) = 0 THEN 0 ELSE
            100.0 * count(*) FILTER (WHERE level IN ('error','fatal') OR status_code >= 500) / count(*)
          END AS error_rate,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)
            FILTER (WHERE duration_ms IS NOT NULL) AS p95
        FROM system_logs WHERE created_at >= now() - interval '24 hours'
      `,
      sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM detection_models
        WHERE archived_at IS NULL AND enabled = true
      `,
      sql<ProviderRow[]>`
        SELECT * FROM providers WHERE deleted_at IS NULL ORDER BY name
      `,
      sql<(ModelRow & { success_rate: number | string | null; p95: number | string | null })[]>`
        SELECT m.*, p.name AS provider_name,
          CASE WHEN count(l.id) = 0 THEN NULL ELSE
            100.0 * count(l.id) FILTER (WHERE l.level NOT IN ('error','fatal')) / count(l.id)
          END AS success_rate,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY l.duration_ms)
            FILTER (WHERE l.duration_ms IS NOT NULL) AS p95
        FROM detection_models m
        LEFT JOIN providers p ON p.id = m.provider_id
        LEFT JOIN system_logs l ON l.model_id = m.id
          AND l.created_at >= now() - interval '24 hours'
        WHERE m.archived_at IS NULL
        GROUP BY m.id, p.name
        ORDER BY m.name
      `,
      listLogs({ page: 1, perPage: 8 }),
    ]);
  const now = new Date().toISOString();
  return c.json({
    totalUsers: Number(users[0]?.total ?? 0),
    activeUsers: Number(users[0]?.active ?? 0),
    scans24h: Number(scans[0]?.count ?? 0),
    errorRate24h: Number(reliability[0]?.error_rate ?? 0),
    p95LatencyMs: Math.round(Number(reliability[0]?.p95 ?? 0)),
    enabledModels: Number(modelCount[0]?.count ?? 0),
    services: [
      { id: "database", name: "PostgreSQL", status: "healthy", latencyMs: null, message: "Connected", checkedAt: now },
      ...providers.map((row) => providerService(row, now)),
    ],
    modelHealth: modelHealth.map((row) => {
      const config = object(row.runtime_config);
      return {
        id: row.id,
        name: row.name,
        provider: row.provider_name ?? "Unassigned",
        type: row.type,
        status: stringValue(config.status, row.enabled ? "unknown" : "disabled"),
        successRate: Number(row.success_rate ?? 0),
        p95LatencyMs: Math.round(Number(row.p95 ?? 0)),
        lastCheckedAt: nullableString(config.lastTestedAt),
      };
    }),
    recentLogs: recent.items,
    generatedAt: now,
  });
});

admin.get("/users", async (c) => {
  const parsed = z.object({
    page: pageSchema,
    perPage: perPageSchema,
    q: z.string().trim().max(320).default(""),
    status: z.string().trim().max(30).default(""),
    plan: z.string().trim().max(30).default(""),
  }).safeParse(c.req.query());
  if (!parsed.success) return invalidQuery(c, parsed.error);
  const { page, perPage, q, status, plan } = parsed.data;
  const offset = (page - 1) * perPage;
  const pattern = `%${q}%`;
  const [items, totals] = await Promise.all([
    sql<any[]>`
      SELECT u.*,
        COALESCE(sum(l.credits) FILTER (
          WHERE l.occurred_at >= date_trunc('month', now())
        ), 0) AS monthly_usage,
        max(s.last_seen_at) AS last_active_at
      FROM users u
      LEFT JOIN model_usage_ledger l ON l.user_id = u.id
      LEFT JOIN sessions s ON s.user_id = u.id
      WHERE u.deleted_at IS NULL
        AND (${q} = '' OR u.email ILIKE ${pattern} OR u.name ILIKE ${pattern} OR u.handle ILIKE ${pattern})
        AND (${status} = '' OR ${status} = 'all' OR u.status = ${dbUserStatus(status)})
        AND (${plan} = '' OR ${plan} = 'all' OR u.plan = ${plan})
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ${perPage} OFFSET ${offset}
    `,
    sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM users u
      WHERE u.deleted_at IS NULL
        AND (${q} = '' OR u.email ILIKE ${pattern} OR u.name ILIKE ${pattern} OR u.handle ILIKE ${pattern})
        AND (${status} = '' OR ${status} = 'all' OR u.status = ${dbUserStatus(status)})
        AND (${plan} = '' OR ${plan} = 'all' OR u.plan = ${plan})
    `,
  ]);
  const totalItems = Number(totals[0]?.count ?? 0);
  return c.json({
    items: items.map(adminUser), page, perPage, totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / perPage)),
  });
});

const userPatchSchema = z.object({
  status: z.enum(["active", "suspended", "invited", "deleted"]).optional(),
  systemRole: z.enum(["user", "admin", "superadmin"]).optional(),
  plan: planSchema.optional(),
  monthlyTokenLimit: z.number().int().nonnegative().nullable().optional(),
}).strict();

admin.patch("/users/:id", async (c) => {
  const id = c.req.param("id");
  const parsed = userPatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalidBody(c, parsed.error);
  const beforeRows = await sql<any[]>`SELECT * FROM users WHERE id = ${id} AND deleted_at IS NULL`;
  const before = beforeRows[0];
  if (!before) return c.json({ error: "not_found" }, 404);
  const patch = parsed.data;
  const hasLimit = Object.prototype.hasOwnProperty.call(patch, "monthlyTokenLimit");
  const rows = await sql<any[]>`
    UPDATE users SET
      status = CASE WHEN ${patch.status !== undefined} THEN ${dbUserStatus(patch.status ?? "")} ELSE status END,
      system_role = CASE WHEN ${patch.systemRole !== undefined} THEN ${dbSystemRole(patch.systemRole ?? "user")} ELSE system_role END,
      plan = CASE WHEN ${patch.plan !== undefined} THEN ${patch.plan ?? "check"} ELSE plan END,
      custom_monthly_limit = CASE WHEN ${hasLimit} THEN ${patch.monthlyTokenLimit ?? null} ELSE custom_monthly_limit END,
      deleted_at = CASE WHEN ${patch.status === "deleted"} THEN now() ELSE deleted_at END,
      updated_at = now()
    WHERE id = ${id} AND deleted_at IS NULL
    RETURNING *
  `;
  const row = rows[0];
  if (!row) return c.json({ error: "not_found" }, 404);
  await auditMutation(c, "admin.user_updated", "user", id, before, row);
  return c.json({ user: adminUser(row) });
});

admin.post("/users/:id/revoke-sessions", async (c) => {
  const id = c.req.param("id");
  const rows = await sql<{ id: string }[]>`
    UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()), updated_at = now()
    WHERE user_id = ${id} AND revoked_at IS NULL RETURNING id
  `;
  await auditMutation(c, "admin.user_sessions_revoked", "user", id, null, {
    revokedSessions: rows.length,
  });
  return c.json({ revoked: rows.length });
});

admin.get("/providers", async (c) => {
  const rows = await sql<ProviderRow[]>`
    SELECT * FROM providers WHERE deleted_at IS NULL ORDER BY name
  `;
  return c.json({ providers: rows.map(publicProvider) });
});

admin.post("/providers", async (c) => {
  const parsed = providerInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalidBody(c, parsed.error);
  const input = parsed.data;
  const encrypted = credentialFields(input.credential);
  try {
    const rows = await sql<ProviderRow[]>`
      INSERT INTO providers (
        id, key, name, driver, base_url, auth_scheme,
        credential_ciphertext, credential_hint, config, enabled, is_local
      ) VALUES (
        ${createRecordId()}, ${input.slug}, ${input.name}, ${providerDriver(input.kind)},
        ${input.baseUrl}, ${providerAuthScheme(input.authType)}, ${encrypted.ciphertext},
        ${encrypted.hint}, ${dbJson(providerConfig(input))}, ${input.enabled},
        ${input.kind === "local"}
      ) RETURNING *
    `;
    const row = rows[0]!;
    await auditMutation(c, "admin.provider_created", "provider", row.id, null, publicProvider(row));
    return c.json({ provider: publicProvider(row) }, 201);
  } catch (error) {
    return constraintError(c, error, "provider_slug_exists");
  }
});

admin.patch("/providers/:id", async (c) => {
  const id = c.req.param("id");
  const currentRows = await sql<ProviderRow[]>`SELECT * FROM providers WHERE id = ${id} AND deleted_at IS NULL`;
  const current = currentRows[0];
  if (!current) return c.json({ error: "not_found" }, 404);
  const parsed = providerInputSchema.partial().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalidBody(c, parsed.error);
  const merged = providerInputSchema.parse({ ...providerInputFromRow(current), ...parsed.data });
  const encrypted = parsed.data.credential === undefined
    ? { ciphertext: current.credential_ciphertext, hint: current.credential_hint }
    : credentialFields(parsed.data.credential);
  try {
    const rows = await sql<ProviderRow[]>`
      UPDATE providers SET key = ${merged.slug}, name = ${merged.name},
        driver = ${providerDriver(merged.kind)}, base_url = ${merged.baseUrl},
        auth_scheme = ${providerAuthScheme(merged.authType)},
        credential_ciphertext = ${encrypted.ciphertext}, credential_hint = ${encrypted.hint},
        config = ${dbJson(providerConfig(merged, object(current.config)))},
        enabled = ${merged.enabled}, is_local = ${merged.kind === "local"}, updated_at = now()
      WHERE id = ${id} AND deleted_at IS NULL RETURNING *
    `;
    const row = rows[0]!;
    await auditMutation(c, "admin.provider_updated", "provider", id, publicProvider(current), publicProvider(row));
    return c.json({ provider: publicProvider(row) });
  } catch (error) {
    return constraintError(c, error, "provider_slug_exists");
  }
});

admin.delete("/providers/:id", async (c) => {
  const id = c.req.param("id");
  const rows = await sql<ProviderRow[]>`
    UPDATE providers SET enabled = false, deleted_at = now(), updated_at = now()
    WHERE id = ${id} AND deleted_at IS NULL RETURNING *
  `;
  if (!rows[0]) return c.json({ error: "not_found" }, 404);
  await auditMutation(c, "admin.provider_deleted", "provider", id, publicProvider(rows[0]), null);
  return c.body(null, 204);
});

admin.post("/providers/:id/test", async (c) => {
  const id = c.req.param("id");
  const rows = await sql<ProviderRow[]>`SELECT * FROM providers WHERE id = ${id} AND deleted_at IS NULL`;
  if (!rows[0]) return c.json({ error: "not_found" }, 404);
  const result = await testProvider(rows[0]);
  const config = { ...object(rows[0].config), status: result.ok ? "healthy" : "down", lastTestedAt: new Date().toISOString(), lastError: result.ok ? null : result.message };
  await sql`UPDATE providers SET config = ${dbJson(config)}, updated_at = now() WHERE id = ${id}`;
  await auditMutation(c, "admin.provider_tested", "provider", id, null, result);
  return c.json(result, result.ok ? 200 : 502);
});

admin.get("/models", async (c) => {
  const rows = await sql<ModelRow[]>`
    SELECT m.*, p.name AS provider_name
    FROM detection_models m
    LEFT JOIN providers p ON p.id = m.provider_id
    WHERE m.archived_at IS NULL
    ORDER BY m.type, m.name
  `;
  return c.json({ models: rows.map(publicModel) });
});

admin.post("/models", async (c) => {
  const parsed = modelInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalidBody(c, parsed.error);
  const input = parsed.data;
  const providerExists = await sql<{ id: string }[]>`
    SELECT id FROM providers WHERE id = ${input.providerId} AND deleted_at IS NULL
  `;
  if (!providerExists[0]) return c.json({ error: "provider_not_found" }, 400);
  const specs = modelSpecs(input);
  try {
    const rows = await sql<ModelRow[]>`
      INSERT INTO detection_models (
        id, slug, name, type, provider_id, external_model_id, description,
        accuracy, enabled, tier, token_cost, cost_unit, is_default,
        request_spec, response_spec, input_limits, execution_limits,
        runtime_config, config_version
      ) VALUES (
        ${createRecordId()}, ${input.slug}, ${input.name}, ${input.type},
        ${input.providerId}, ${input.modelIdentifier}, ${input.description},
        ${input.accuracy}, ${input.enabled}, ${input.tier}, ${input.tokenCost},
        ${input.costUnit}, ${input.defaultForPlans.length > 0},
        ${dbJson(specs.request)}, ${dbJson(specs.response)},
        ${dbJson(specs.inputLimits)}, ${dbJson(specs.executionLimits)},
        ${dbJson(specs.runtime)}, 1
      ) RETURNING *
    `;
    const row = rows[0]!;
    const output = publicModel(row);
    await auditMutation(c, "admin.model_created", "model", row.id, null, output);
    return c.json({ model: output }, 201);
  } catch (error) {
    return constraintError(c, error, "model_slug_or_default_exists");
  }
});

admin.patch("/models/:id", async (c) => {
  const id = c.req.param("id");
  const currentRows = await sql<ModelRow[]>`
    SELECT m.*, p.name AS provider_name
    FROM detection_models m LEFT JOIN providers p ON p.id = m.provider_id
    WHERE m.id = ${id} AND m.archived_at IS NULL
  `;
  const current = currentRows[0];
  if (!current) return c.json({ error: "not_found" }, 404);
  const parsed = modelInputObject.partial().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalidBody(c, parsed.error);
  const merged = modelInputSchema.parse({ ...modelInputFromRow(current), ...parsed.data });
  const providerExists = await sql<{ id: string }[]>`
    SELECT id FROM providers WHERE id = ${merged.providerId} AND deleted_at IS NULL
  `;
  if (!providerExists[0]) return c.json({ error: "provider_not_found" }, 400);
  const specs = modelSpecs(merged, object(current.runtime_config));
  try {
    const rows = await sql<ModelRow[]>`
      UPDATE detection_models SET
        slug = ${merged.slug}, name = ${merged.name}, type = ${merged.type},
        provider_id = ${merged.providerId}, external_model_id = ${merged.modelIdentifier},
        description = ${merged.description}, accuracy = ${merged.accuracy},
        enabled = ${merged.enabled}, tier = ${merged.tier}, token_cost = ${merged.tokenCost},
        cost_unit = ${merged.costUnit}, is_default = ${merged.defaultForPlans.length > 0},
        request_spec = ${dbJson(specs.request)}, response_spec = ${dbJson(specs.response)},
        input_limits = ${dbJson(specs.inputLimits)},
        execution_limits = ${dbJson(specs.executionLimits)},
        runtime_config = ${dbJson(specs.runtime)},
        config_version = config_version + 1, updated_at = now()
      WHERE id = ${id} AND archived_at IS NULL RETURNING *
    `;
    const row = rows[0]!;
    const output = publicModel(row);
    await auditMutation(c, "admin.model_updated", "model", id, publicModel(current), output);
    return c.json({ model: output });
  } catch (error) {
    return constraintError(c, error, "model_slug_or_default_exists");
  }
});

admin.delete("/models/:id", async (c) => {
  const id = c.req.param("id");
  const rows = await sql<ModelRow[]>`
    UPDATE detection_models
    SET enabled = false, archived_at = now(), updated_at = now(),
        config_version = config_version + 1
    WHERE id = ${id} AND archived_at IS NULL RETURNING *
  `;
  if (!rows[0]) return c.json({ error: "not_found" }, 404);
  await auditMutation(c, "admin.model_archived", "model", id, publicModel(rows[0]), null);
  return c.body(null, 204);
});

admin.post("/models/normalize-test", async (c) => {
  const parsed = z.object({
    responseMapping: responseMappingSchema,
    sampleResponse: z.unknown(),
  }).strict().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalidBody(c, parsed.error);
  try {
    const result = normalizeModelResponse(
      parsed.data.sampleResponse,
      runtimeResponseMapping(parsed.data.responseMapping),
      { model: "normalization-test", durationMs: 0 },
    );
    return c.json({
      normalized: {
        verdict: result.verdict,
        confidence: result.confidence,
        aiPct: result.aiProbability,
        model: result.model,
        metadata: result.diagnostics ?? {},
      },
    });
  } catch (error) {
    return c.json({
      error: "normalization_failed",
      message: error instanceof Error ? error.message : "Could not normalize sample",
    }, 422);
  }
});

admin.post("/models/:id/test", async (c) => {
  const id = c.req.param("id");
  const rows = await sql<(ModelRow & ProviderRow)[]>`
    SELECT m.*, p.id AS provider_row_id, p.key, p.name AS provider_name,
      p.driver, p.base_url, p.auth_scheme, p.credential_ciphertext,
      p.credential_hint, p.config, p.enabled AS provider_enabled,
      p.is_local, p.created_at AS provider_created_at,
      p.updated_at AS provider_updated_at
    FROM detection_models m JOIN providers p ON p.id = m.provider_id
    WHERE m.id = ${id} AND m.archived_at IS NULL AND p.deleted_at IS NULL
  `;
  const row = rows[0] as any;
  if (!row) return c.json({ error: "not_found" }, 404);
  const provider: ProviderRow = {
    id: row.provider_row_id,
    key: row.key,
    name: row.provider_name,
    driver: row.driver,
    base_url: row.base_url,
    auth_scheme: row.auth_scheme,
    credential_ciphertext: row.credential_ciphertext,
    credential_hint: row.credential_hint,
    config: row.config,
    enabled: row.provider_enabled,
    is_local: row.is_local,
    created_at: row.provider_created_at,
    updated_at: row.provider_updated_at,
  };
  const result = await testProvider(provider);
  const runtime = {
    ...object(row.runtime_config),
    status: result.ok ? "healthy" : "error",
    lastTestedAt: new Date().toISOString(),
    lastError: result.ok ? null : result.message,
  };
  await sql`
    UPDATE detection_models SET runtime_config = ${dbJson(runtime)}, updated_at = now()
    WHERE id = ${id}
  `;
  const connectivityResult = {
    ...result,
    scope: "provider-connectivity" as const,
    message: result.ok
      ? "Provider connectivity succeeded; no model inference was run"
      : result.message,
  };
  await auditMutation(c, "admin.model_connectivity_tested", "model", id, null, connectivityResult);
  return c.json(connectivityResult, result.ok ? 200 : 502);
});

admin.get("/logs", async (c) => {
  const parsed = z.object({
    page: pageSchema,
    perPage: perPageSchema,
    q: z.string().trim().max(500).default(""),
    level: z.string().trim().max(20).default(""),
    source: z.string().trim().max(80).default(""),
    event: z.string().trim().max(160).default(""),
    userId: z.string().trim().max(64).default(""),
    modelId: z.string().trim().max(64).default(""),
    providerId: z.string().trim().max(64).default(""),
    requestId: z.string().trim().max(128).default(""),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  }).safeParse(c.req.query());
  if (!parsed.success) return invalidQuery(c, parsed.error);
  return c.json(await listLogs(parsed.data));
});

function providerService(row: ProviderRow, now: string) {
  const config = object(row.config);
  const status = stringValue(config.status, row.enabled ? "unknown" : "down");
  return {
    id: row.id,
    name: row.name,
    status: ["healthy", "degraded", "down", "unknown"].includes(status)
      ? status
      : "unknown",
    latencyMs: nullableNumber(config.lastLatencyMs),
    message: nullableString(config.lastError) ?? (row.enabled ? "Not tested" : "Disabled"),
    checkedAt: nullableString(config.lastTestedAt) ?? now,
  };
}

function publicProvider(row: ProviderRow) {
  const config = object(row.config);
  return {
    id: row.id,
    name: row.name,
    slug: row.key,
    kind: providerKind(row),
    baseUrl: row.base_url,
    authType: publicAuthType(row.auth_scheme),
    credentialConfigured: Boolean(row.credential_ciphertext),
    credentialHint: row.credential_hint || null,
    enabled: row.enabled,
    status: stringValue(config.status, row.enabled ? "unknown" : "disabled"),
    timeoutMs: numberValue(config.timeoutMs, 30_000),
    maxRetries: numberValue(config.maxRetries, 1),
    requestsPerMinute: nullableNumber(config.requestsPerMinute),
    concurrencyLimit: nullableNumber(config.concurrencyLimit),
    lastTestedAt: nullableString(config.lastTestedAt),
    lastError: nullableString(config.lastError),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function providerInputFromRow(row: ProviderRow) {
  const value = publicProvider(row);
  return {
    name: value.name,
    slug: value.slug,
    kind: value.kind,
    baseUrl: value.baseUrl,
    authType: value.authType,
    enabled: value.enabled,
    timeoutMs: value.timeoutMs,
    maxRetries: value.maxRetries,
    requestsPerMinute: value.requestsPerMinute,
    concurrencyLimit: value.concurrencyLimit,
  };
}

function providerConfig(
  input: z.infer<typeof providerInputSchema>,
  existing: JsonObject = {},
): JsonObject {
  return {
    ...existing,
    timeoutMs: input.timeoutMs,
    maxRetries: input.maxRetries,
    requestsPerMinute: input.requestsPerMinute,
    concurrencyLimit: input.concurrencyLimit,
  };
}

function providerDriver(kind: z.infer<typeof providerInputSchema>["kind"]): string {
  if (kind === "local") return "local-http";
  return kind;
}

function providerKind(row: ProviderRow): "local" | "huggingface" | "openai-compatible" | "http" {
  if (row.is_local || row.driver === "local-http") return "local";
  if (row.driver === "huggingface") return "huggingface";
  if (row.driver === "openai-compatible") return "openai-compatible";
  return "http";
}

function providerAuthScheme(auth: string): string {
  return auth === "api-key" ? "x-api-key" : auth;
}

function publicAuthType(auth: string): "none" | "bearer" | "api-key" | "basic" {
  if (auth === "bearer" || auth === "basic") return auth;
  if (auth === "api-key" || auth === "x-api-key") return "api-key";
  return "none";
}

function credentialFields(value: string | undefined): {
  ciphertext: string | null;
  hint: string;
} {
  if (!value) return { ciphertext: null, hint: "" };
  return { ciphertext: encryptCredential(value), hint: credentialHint(value) };
}

async function testProvider(row: ProviderRow): Promise<{
  ok: boolean;
  status: number | null;
  message: string;
  latencyMs: number;
  raw?: unknown;
}> {
  if (!row.enabled) {
    return { ok: false, status: null, message: "Provider is disabled", latencyMs: 0 };
  }
  let url: URL;
  try {
    url = row.driver === "huggingface"
      ? new URL("https://huggingface.co/api/whoami-v2")
      : new URL(row.base_url);
    assertAdminProviderUrl(url, row);
  } catch {
    return { ok: false, status: null, message: "Provider base URL is invalid or not allowed", latencyMs: 0 };
  }
  const config = object(row.config);
  const testPath = stringValue(config.testPath, "");
  if (testPath) url = new URL(testPath, url);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (row.credential_ciphertext) {
    const credential = decryptCredential(row.credential_ciphertext);
    if (row.auth_scheme === "bearer") headers.Authorization = `Bearer ${credential}`;
    else if (row.auth_scheme === "basic") {
      headers.Authorization = `Basic ${Buffer.from(credential).toString("base64")}`;
    } else if (row.auth_scheme === "api-key") headers.Authorization = `Bearer ${credential}`;
    else if (row.auth_scheme === "x-api-key") headers["x-api-key"] = credential;
  }
  const timeoutMs = numberValue(config.timeoutMs, 30_000);
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    const latencyMs = Math.round(performance.now() - started);
    const raw = redactForLog(parseMaybeJson(text.slice(0, 4_096)));
    return {
      ok: response.ok,
      status: response.status,
      message: response.ok ? "Provider responded successfully" : `Provider returned HTTP ${response.status}`,
      latencyMs,
      raw,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      message: error instanceof Error ? error.message.slice(0, 500) : "Provider request failed",
      latencyMs: Math.round(performance.now() - started),
    };
  }
}

function modelSpecs(
  input: z.infer<typeof modelInputSchema>,
  existingRuntime: JsonObject = {},
) {
  const request = {
    ...input.requestTemplate,
    ...(input.endpointPath ? { path: input.endpointPath } : {}),
  };
  const runtime = {
    ...existingRuntime,
    plansAllowed: input.plansAllowed,
    defaultForPlans: input.defaultForPlans,
    uiResponseMapping: input.responseMapping,
  };
  return {
    request,
    response: runtimeResponseMapping(input.responseMapping),
    inputLimits: {
      maxChars: input.inputLimits.maxCharacters,
      maxBytes: input.inputLimits.maxBytes,
      maxDurationSec: input.inputLimits.maxDurationSeconds,
    },
    executionLimits: {
      timeoutMs: input.executionLimits.timeoutMs,
      maxAttempts: input.executionLimits.maxRetries + 1,
      maxConcurrency: input.executionLimits.concurrencyLimit,
      requestsPerMinute: input.executionLimits.requestsPerMinute,
      // Retain UI names so round-tripping a configuration is lossless.
      maxRetries: input.executionLimits.maxRetries,
      concurrencyLimit: input.executionLimits.concurrencyLimit,
    },
    runtime,
  };
}

function runtimeResponseMapping(
  mapping: z.infer<typeof responseMappingSchema>,
): ResponseSpec {
  const preset: ResponseSpec["preset"] =
    mapping.preset === "hf-classification"
      ? "classification-list"
      : mapping.preset === "velma-segments"
        ? "segments"
        : "generic";
  const aggregation: ResponseSpec["aggregation"] =
    mapping.aggregation === "max"
      ? "max-ai"
      : mapping.aggregation === "weighted_mean"
        ? "weighted-mean"
        : mapping.aggregation;
  const isVelma = mapping.preset === "velma-segments";
  return {
    preset,
    ...(mapping.resultPath
      ? isVelma
        ? { itemsPath: mapping.resultPath }
        : { rootPath: mapping.resultPath }
      : {}),
    ...(mapping.labelPath
      ? isVelma
        ? { verdictPath: mapping.labelPath }
        : { labelPath: mapping.labelPath }
      : {}),
    ...(mapping.scorePath
      ? isVelma
        ? { confidencePath: mapping.scorePath }
        : { scorePath: mapping.scorePath, aiScorePath: mapping.scorePath }
      : {}),
    ...(mapping.modelPath ? { modelPath: mapping.modelPath } : {}),
    aiLabels: mapping.aiLabels,
    humanLabels: mapping.humanLabels,
    scoreScale: mapping.scoreScale === "zero_to_hundred" ? "percent" : "fraction",
    invertScore: mapping.invertScore,
    ...(isVelma ? { scoreMeaning: "confidence-in-verdict" as const } : {}),
    aggregation,
    thresholds: {
      mixed: thresholdFraction(mapping.mixedThreshold),
      ai: thresholdFraction(mapping.aiThreshold),
    },
  };
}

function publicModel(row: ModelRow) {
  const runtime = object(row.runtime_config);
  const request = object(row.request_spec);
  const storedMapping = runtime.uiResponseMapping;
  const mapping = responseMappingSchema.safeParse(storedMapping).success
    ? responseMappingSchema.parse(storedMapping)
    : uiResponseMapping(object(row.response_spec));
  const input = object(row.input_limits);
  const execution = object(row.execution_limits);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    type: row.type,
    providerId: row.provider_id ?? "",
    providerName: row.provider_name ?? undefined,
    modelIdentifier: row.external_model_id,
    endpointPath: stringValue(request.path, ""),
    enabled: row.enabled,
    status: stringValue(runtime.status, row.enabled ? "unknown" : "disabled"),
    accuracy: Number(row.accuracy),
    tier: row.tier,
    plansAllowed: stringArray(runtime.plansAllowed, [row.tier]),
    defaultForPlans: stringArray(runtime.defaultForPlans, row.is_default ? [row.tier] : []),
    tokenCost: Number(row.token_cost),
    costUnit: row.cost_unit === "per_minute" ? "per_minute" : "per_scan",
    inputLimits: {
      maxCharacters: nullableNumber(input.maxChars),
      maxBytes: nullableNumber(input.maxBytes),
      maxDurationSeconds: nullableNumber(input.maxDurationSec),
    },
    executionLimits: {
      timeoutMs: numberValue(execution.timeoutMs, 30_000),
      maxRetries: numberValue(execution.maxRetries, Math.max(0, numberValue(execution.maxAttempts, 2) - 1)),
      requestsPerMinute: nullableNumber(execution.requestsPerMinute),
      concurrencyLimit: nullableNumber(execution.concurrencyLimit ?? execution.maxConcurrency),
    },
    requestTemplate: request,
    responseMapping: mapping,
    lastTestedAt: nullableString(runtime.lastTestedAt),
    lastError: nullableString(runtime.lastError),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function modelInputFromRow(row: ModelRow) {
  const value = publicModel(row);
  return {
    slug: value.slug,
    name: value.name,
    description: value.description,
    type: value.type,
    providerId: value.providerId,
    modelIdentifier: value.modelIdentifier,
    endpointPath: value.endpointPath,
    enabled: value.enabled,
    accuracy: value.accuracy,
    tier: value.tier,
    plansAllowed: value.plansAllowed,
    defaultForPlans: value.defaultForPlans,
    tokenCost: value.tokenCost,
    costUnit: value.costUnit,
    inputLimits: value.inputLimits,
    executionLimits: value.executionLimits,
    requestTemplate: value.requestTemplate,
    responseMapping: value.responseMapping,
  };
}

function uiResponseMapping(spec: JsonObject): z.infer<typeof responseMappingSchema> {
  const preset = stringValue(spec.preset, "generic");
  const isSegments = preset === "segments";
  const aggregation = stringValue(spec.aggregation, "first");
  const thresholds = object(spec.thresholds);
  return responseMappingSchema.parse({
    preset:
      preset === "classification-list"
        ? "hf-classification"
        : preset === "segments"
          ? "velma-segments"
          : "generic-json",
    resultPath: stringValue(isSegments ? spec.itemsPath : spec.rootPath, ""),
    labelPath: stringValue(isSegments ? spec.verdictPath : spec.labelPath, ""),
    scorePath: stringValue(
      isSegments ? spec.confidencePath : spec.aiScorePath ?? spec.scorePath,
      "",
    ),
    modelPath: stringValue(spec.modelPath, ""),
    errorPath: "",
    aiLabels: stringArray(spec.aiLabels, []),
    humanLabels: stringArray(spec.humanLabels, []),
    scoreScale: spec.scoreScale === "percent" ? "zero_to_hundred" : "zero_to_one",
    invertScore: Boolean(spec.invertScore),
    aggregation:
      aggregation === "max-ai"
        ? "max"
        : aggregation === "weighted-mean"
          ? "weighted_mean"
          : aggregation === "mean"
            ? "mean"
            : "first",
    mixedThreshold: thresholdPercent(thresholds.mixed, 40),
    aiThreshold: thresholdPercent(thresholds.ai, 70),
  });
}

type LogQuery = {
  page: number;
  perPage: number;
  q?: string;
  level?: string;
  source?: string;
  event?: string;
  userId?: string;
  modelId?: string;
  providerId?: string;
  requestId?: string;
  from?: string;
  to?: string;
};

async function listLogs(query: LogQuery) {
  const page = query.page;
  const perPage = query.perPage;
  const offset = (page - 1) * perPage;
  const q = query.q ?? "";
  const pattern = `%${q}%`;
  const level = query.level ?? "";
  const source = query.source ?? "";
  const event = query.event ?? "";
  const userId = query.userId ?? "";
  const modelId = query.modelId ?? "";
  const providerId = query.providerId ?? "";
  const requestId = query.requestId ?? "";
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  const [rows, totals] = await Promise.all([
    sql<any[]>`
      SELECT * FROM system_logs
      WHERE (${q} = '' OR message ILIKE ${pattern} OR event ILIKE ${pattern}
        OR request_id ILIKE ${pattern} OR error_code ILIKE ${pattern})
        AND (${level} = '' OR level = ${level})
        AND (${source} = '' OR service = ${source})
        AND (${event} = '' OR event = ${event})
        AND (${userId} = '' OR user_id = ${userId})
        AND (${modelId} = '' OR model_id = ${modelId})
        AND (${providerId} = '' OR provider_id = ${providerId})
        AND (${requestId} = '' OR request_id = ${requestId})
        AND (${from}::timestamptz IS NULL OR created_at >= ${from})
        AND (${to}::timestamptz IS NULL OR created_at <= ${to})
      ORDER BY created_at DESC LIMIT ${perPage} OFFSET ${offset}
    `,
    sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM system_logs
      WHERE (${q} = '' OR message ILIKE ${pattern} OR event ILIKE ${pattern}
        OR request_id ILIKE ${pattern} OR error_code ILIKE ${pattern})
        AND (${level} = '' OR level = ${level})
        AND (${source} = '' OR service = ${source})
        AND (${event} = '' OR event = ${event})
        AND (${userId} = '' OR user_id = ${userId})
        AND (${modelId} = '' OR model_id = ${modelId})
        AND (${providerId} = '' OR provider_id = ${providerId})
        AND (${requestId} = '' OR request_id = ${requestId})
        AND (${from}::timestamptz IS NULL OR created_at >= ${from})
        AND (${to}::timestamptz IS NULL OR created_at <= ${to})
    `,
  ]);
  const totalItems = Number(totals[0]?.count ?? 0);
  return {
    items: rows.map(adminLog),
    page,
    perPage,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / perPage)),
  };
}

function adminLog(row: any) {
  const context = object(row.context);
  const level = row.level === "fatal" ? "error" : row.level;
  return {
    id: row.id,
    timestamp: iso(row.created_at),
    level,
    source: row.service,
    event: row.event,
    message: row.message,
    requestId: row.request_id ?? null,
    traceId: nullableString(context.traceId) ?? row.request_id ?? null,
    userId: row.user_id ?? null,
    scanId: row.scan_id ?? null,
    modelId: row.model_id ?? null,
    providerId: row.provider_id ?? null,
    statusCode: row.status_code ?? null,
    durationMs: row.duration_ms ?? null,
    metadata: context,
  };
}

function adminUser(row: any) {
  const providers: string[] = [];
  if (row.password_hash) providers.push("password");
  if (row.google_subject) providers.push("google");
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? "",
    handle: row.handle ?? "",
    avatarUrl: row.avatar_url ?? "",
    status: publicUserStatus(row.status),
    systemRole: publicSystemRole(row.system_role),
    plan: row.plan,
    verified: Boolean(row.email_verified),
    authProviders: providers,
    monthlyUsage: Number(row.monthly_usage ?? 0),
    monthlyTokenLimit:
      row.custom_monthly_limit === null || row.custom_monthly_limit === undefined
        ? null
        : Number(row.custom_monthly_limit),
    createdAt: iso(row.created_at),
    lastActiveAt: row.last_active_at ? iso(row.last_active_at) : null,
  };
}

async function auditMutation(
  c: Context,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  const actor = c.get("sessionUser");
  await writeAuditEvent({
    actorUserId: actor.id,
    actorType: "admin",
    action,
    entityType,
    entityId,
    requestId: c.get("requestId"),
    ipAddress: requestIp(c),
    userAgent: c.req.header("user-agent"),
    before,
    after,
  });
}

function invalidBody(c: Context, error: z.ZodError): Response {
  return c.json({ error: "invalid_body", issues: error.flatten() }, 400);
}

function invalidQuery(c: Context, error: z.ZodError): Response {
  return c.json({ error: "invalid_query", issues: error.flatten() }, 400);
}

async function constraintError(c: Context, error: unknown, code: string): Promise<Response> {
  const dbCode = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
  if (dbCode === "23505") return c.json({ error: code }, 409);
  if (dbCode === "23503") return c.json({ error: "invalid_reference" }, 400);
  await writeStructuredLog({
    level: "error",
    event: "admin.mutation_failed",
    message: "Admin mutation failed",
    requestId: c.get("requestId"),
    userId: c.get("sessionUser")?.id ?? null,
    errorCode: "admin_mutation_failed",
    context: { error },
  });
  return c.json({ error: "internal_error" }, 500);
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : fallback;
}

function thresholdFraction(value: number): number {
  return value > 1 ? value / 100 : value;
}

function thresholdPercent(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed <= 1 ? parsed * 100 : parsed;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseMaybeJson(value: string): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function assertAdminProviderUrl(url: URL, row: ProviderRow): void {
  if (url.username || url.password) throw new Error("embedded credentials");
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("unsupported protocol");
  }
  const local = row.is_local || row.driver === "local-http";
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!local) {
    if (url.protocol !== "https:" || isPrivateHostname(hostname)) {
      throw new Error("remote provider URL is private or insecure");
    }
    return;
  }
  const allowed = (process.env.ALLOWED_LOCAL_MODEL_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(hostname) && !allowed.includes(url.host.toLowerCase())) {
    throw new Error("local provider host is not allowlisted");
  }
}

function isPrivateHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "::1") return true;
  if (/^(127|10|0)\./.test(hostname) || /^192\.168\./.test(hostname)) return true;
  const ipv4 = /^172\.(\d{1,3})\./.exec(hostname);
  if (ipv4 && Number(ipv4[1]) >= 16 && Number(ipv4[1]) <= 31) return true;
  if (/^169\.254\./.test(hostname)) return true;
  return hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:");
}

function dbUserStatus(status: string): string {
  if (status === "invited") return "disabled";
  return status || "active";
}

function publicUserStatus(status: string): "active" | "suspended" | "invited" | "deleted" {
  if (status === "active" || status === "suspended" || status === "deleted") return status;
  return "invited";
}

function dbSystemRole(role: string): string {
  return role === "superadmin" ? "owner" : role;
}

function publicSystemRole(role: string): "user" | "admin" | "superadmin" {
  if (role === "owner") return "superadmin";
  if (role === "admin" || role === "support") return "admin";
  return "user";
}

function dbJson(value: unknown) {
  return sql.json(value as never);
}
