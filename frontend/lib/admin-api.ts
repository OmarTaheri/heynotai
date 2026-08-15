"use client";

import type { Plan } from "@heynotai/shared";
import { backend } from "./backend";
import type {
  AdminExecutionLimits,
  AdminInputLimits,
  AdminLog,
  AdminLogFilters,
  AdminLogLevel,
  AdminModel,
  AdminModelHealth,
  AdminModelInput,
  AdminModelType,
  AdminNormalizeTestInput,
  AdminNormalizedResult,
  AdminOverview,
  AdminPage,
  AdminProvider,
  AdminProviderInput,
  AdminResponseMapping,
  AdminService,
  AdminServiceStatus,
  AdminSystemRole,
  AdminTestResult,
  AdminUser,
  AdminUserPatch,
  AdminUserStatus,
} from "./admin-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export class AdminApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = backend.authStore.token;
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new AdminApiError(
        `Can't reach the API at ${API_URL}. Start the API with npm run dev.`,
        0,
        error,
      );
    }
    throw error;
  }
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    const record = asRecord(body);
    const message =
      stringValue(record.message) ||
      stringValue(record.error) ||
      `Admin request failed (${response.status})`;
    throw new AdminApiError(message, response.status, body);
  }
  return body as T;
}

function jsonBody(value: unknown): BodyInit {
  return JSON.stringify(value);
}

function queryString(values: Record<string, unknown>): string {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const output = query.toString();
  return output ? `?${output}` : "";
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  return normalizeOverview(await adminFetch<unknown>("/admin/overview"));
}

export async function fetchAdminUsers(input: {
  page?: number;
  perPage?: number;
  q?: string;
  status?: string;
  plan?: string;
} = {}): Promise<AdminPage<AdminUser>> {
  const body = await adminFetch<unknown>(`/admin/users${queryString(input)}`);
  return normalizePage(body, normalizeUser, "users");
}

export async function updateAdminUser(
  id: string,
  patch: AdminUserPatch,
): Promise<AdminUser> {
  const body = await adminFetch<unknown>(`/admin/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: jsonBody(patch),
  });
  const record = asRecord(body);
  return normalizeUser(record.user ?? body);
}

export async function revokeAdminUserSessions(id: string): Promise<void> {
  await adminFetch(`/admin/users/${encodeURIComponent(id)}/revoke-sessions`, {
    method: "POST",
  });
}

export async function fetchAdminProviders(): Promise<AdminProvider[]> {
  const body = await adminFetch<unknown>("/admin/providers");
  return collectionFrom(body, "providers").map(normalizeProvider);
}

export async function createAdminProvider(
  input: AdminProviderInput,
): Promise<AdminProvider> {
  const body = await adminFetch<unknown>("/admin/providers", {
    method: "POST",
    body: jsonBody(input),
  });
  const record = asRecord(body);
  return normalizeProvider(record.provider ?? body);
}

export async function updateAdminProvider(
  id: string,
  patch: Partial<AdminProviderInput>,
): Promise<AdminProvider> {
  const body = await adminFetch<unknown>(`/admin/providers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: jsonBody(patch),
  });
  const record = asRecord(body);
  return normalizeProvider(record.provider ?? body);
}

export async function deleteAdminProvider(id: string): Promise<void> {
  await adminFetch(`/admin/providers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function testAdminProvider(id: string): Promise<AdminTestResult> {
  return normalizeTestResult(
    await adminFetch(`/admin/providers/${encodeURIComponent(id)}/test`, {
      method: "POST",
    }),
  );
}

export async function fetchAdminModels(): Promise<AdminModel[]> {
  const body = await adminFetch<unknown>("/admin/models");
  return collectionFrom(body, "models").map(normalizeModel);
}

export async function createAdminModel(input: AdminModelInput): Promise<AdminModel> {
  const body = await adminFetch<unknown>("/admin/models", {
    method: "POST",
    body: jsonBody(input),
  });
  const record = asRecord(body);
  return normalizeModel(record.model ?? body);
}

export async function updateAdminModel(
  id: string,
  patch: Partial<AdminModelInput>,
): Promise<AdminModel> {
  const body = await adminFetch<unknown>(`/admin/models/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: jsonBody(patch),
  });
  const record = asRecord(body);
  return normalizeModel(record.model ?? body);
}

export async function deleteAdminModel(id: string): Promise<void> {
  await adminFetch(`/admin/models/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function testAdminModel(id: string): Promise<AdminTestResult> {
  return normalizeTestResult(
    await adminFetch(`/admin/models/${encodeURIComponent(id)}/test`, {
      method: "POST",
    }),
  );
}

export async function normalizeAdminModelResponse(
  input: AdminNormalizeTestInput,
): Promise<AdminNormalizedResult> {
  const body = await adminFetch<unknown>("/admin/models/normalize-test", {
    method: "POST",
    body: jsonBody(input),
  });
  const record = asRecord(body);
  return normalizeNormalizedResult(record.normalized ?? record.result ?? body);
}

export async function fetchAdminLogs(
  filters: AdminLogFilters = {},
): Promise<AdminPage<AdminLog>> {
  const body = await adminFetch<unknown>(`/admin/logs${queryString(filters)}`);
  return normalizePage(body, normalizeLog, "logs");
}

function normalizeOverview(value: unknown): AdminOverview {
  const root = asRecord(value);
  const metrics = asRecord(root.metrics ?? root.stats ?? root);
  const users = asRecord(root.users ?? metrics.users);
  const scans = asRecord(root.scans ?? metrics.scans);
  const latency = asRecord(root.latency ?? metrics.latency);
  const modelsSummary = asRecord(root.modelsSummary ?? metrics.models);
  return {
    totalUsers: firstNumber(metrics.totalUsers, users.total, root.totalUsers),
    activeUsers: firstNumber(metrics.activeUsers, users.active, root.activeUsers),
    scans24h: firstNumber(metrics.scans24h, scans.last24h, scans.total24h, root.scans24h),
    errorRate24h: firstNumber(
      metrics.errorRate24h,
      scans.errorRate,
      root.errorRate24h,
    ),
    p95LatencyMs: firstNumber(
      metrics.p95LatencyMs,
      latency.p95Ms,
      latency.p95,
      root.p95LatencyMs,
    ),
    enabledModels: firstNumber(
      metrics.enabledModels,
      modelsSummary.enabled,
      root.enabledModels,
    ),
    services: normalizeServices(root.services ?? root.system),
    modelHealth: collectionFrom(root.modelHealth ?? root.models, "items").map(
      normalizeModelHealth,
    ),
    recentLogs: collectionFrom(root.recentLogs ?? root.recentErrors, "items").map(
      normalizeLog,
    ),
    generatedAt:
      stringValue(root.generatedAt) ||
      stringValue(root.timestamp) ||
      new Date().toISOString(),
  };
}

function normalizeServices(value: unknown): AdminService[] {
  if (Array.isArray(value)) return value.map(normalizeService);
  const record = asRecord(value);
  return Object.entries(record).map(([id, detail]) => {
    if (typeof detail === "boolean") {
      return normalizeService({ id, name: labelFromSlug(id), status: detail ? "healthy" : "down" });
    }
    return normalizeService({ id, name: labelFromSlug(id), ...asRecord(detail) });
  });
}

function normalizeService(value: unknown): AdminService {
  const row = asRecord(value);
  const id = stringValue(row.id) || stringValue(row.slug) || "service";
  return {
    id,
    name: stringValue(row.name) || labelFromSlug(id),
    status: serviceStatus(row.status ?? row.ok),
    latencyMs: nullableNumber(row.latencyMs ?? row.latency),
    message: stringValue(row.message) || stringValue(row.error),
    checkedAt: nullableString(row.checkedAt ?? row.timestamp),
  };
}

function normalizeModelHealth(value: unknown): AdminModelHealth {
  const row = asRecord(value);
  return {
    id: stringValue(row.id) || stringValue(row.slug),
    name: stringValue(row.name) || stringValue(row.slug) || "Model",
    provider:
      stringValue(row.providerName) ||
      stringValue(asRecord(row.provider).name) ||
      stringValue(row.provider),
    type: modelType(row.type),
    status: serviceStatus(row.status ?? row.healthy),
    successRate: nullableNumber(row.successRate),
    p95LatencyMs: nullableNumber(row.p95LatencyMs ?? row.latencyMs),
    lastCheckedAt: nullableString(row.lastCheckedAt ?? row.lastTestedAt),
  };
}

function normalizeUser(value: unknown): AdminUser {
  const row = asRecord(value);
  const usage = asRecord(row.usage);
  const rawStatus = stringValue(row.status).toLowerCase();
  const suspended = booleanValue(row.suspended) || booleanValue(row.disabled);
  return {
    id: stringValue(row.id),
    email: stringValue(row.email),
    name: stringValue(row.name) || stringValue(row.displayName),
    handle: stringValue(row.handle),
    avatarUrl: nullableString(row.avatarUrl),
    status: userStatus(suspended ? "suspended" : rawStatus),
    systemRole: systemRole(row.systemRole),
    plan: plan(row.plan),
    verified: booleanValue(row.verified),
    authProviders: stringArray(row.authProviders ?? row.providers),
    monthlyUsage: firstNumber(row.monthlyUsage, row.tokensUsed, usage.used),
    monthlyTokenLimit: nullableNumber(
      row.monthlyTokenLimit ?? row.tokenLimit ?? usage.total,
    ),
    createdAt: stringValue(row.createdAt) || stringValue(row.created),
    lastActiveAt: nullableString(
      row.lastActiveAt ?? row.lastSeen ?? row.updatedAt ?? row.updated,
    ),
  };
}

function normalizeProvider(value: unknown): AdminProvider {
  const row = asRecord(value);
  const limits = asRecord(row.limits ?? row.executionLimits);
  const credentialConfigured =
    booleanValue(row.credentialConfigured) ||
    booleanValue(row.hasCredential) ||
    booleanValue(row.secretConfigured);
  return {
    id: stringValue(row.id),
    name: stringValue(row.name) || stringValue(row.slug) || "Provider",
    slug: stringValue(row.slug),
    kind: providerKind(row.kind ?? row.type),
    baseUrl: stringValue(row.baseUrl) || stringValue(row.endpoint),
    authType: authType(row.authType),
    credentialConfigured,
    enabled: row.enabled === undefined ? true : booleanValue(row.enabled),
    status: serviceStatus(row.status ?? row.healthy),
    timeoutMs: firstNumber(row.timeoutMs, limits.timeoutMs, 30_000),
    maxRetries: firstNumber(row.maxRetries, limits.maxRetries, 1),
    requestsPerMinute: nullableNumber(
      row.requestsPerMinute ?? row.rateLimitRpm ?? limits.requestsPerMinute,
    ),
    concurrencyLimit: nullableNumber(
      row.concurrencyLimit ?? limits.concurrencyLimit,
    ),
    lastTestedAt: nullableString(row.lastTestedAt),
    lastError: stringValue(row.lastError),
    createdAt: stringValue(row.createdAt) || stringValue(row.created),
    updatedAt: stringValue(row.updatedAt) || stringValue(row.updated),
  };
}

function normalizeModel(value: unknown): AdminModel {
  const row = asRecord(value);
  const provider = asRecord(row.provider);
  const inputLimits = asRecord(row.inputLimits);
  const executionLimits = asRecord(row.executionLimits ?? row.limits);
  return {
    id: stringValue(row.id),
    slug: stringValue(row.slug),
    name: stringValue(row.name) || stringValue(row.slug) || "Model",
    description: stringValue(row.description),
    type: modelType(row.type),
    providerId:
      stringValue(row.providerId) || stringValue(provider.id) || stringValue(row.provider),
    providerName:
      stringValue(row.providerName) || stringValue(provider.name) || stringValue(row.provider),
    modelIdentifier:
      stringValue(row.modelIdentifier) ||
      stringValue(row.hfModelId) ||
      stringValue(row.remoteModelId),
    endpointPath: stringValue(row.endpointPath) || stringValue(row.path),
    enabled: row.enabled === undefined ? true : booleanValue(row.enabled),
    status: serviceStatus(row.status ?? row.healthy),
    accuracy: firstNumber(row.accuracy),
    tier: plan(row.tier),
    plansAllowed: planArray(row.plansAllowed),
    defaultForPlans: planArray(row.defaultForPlans),
    tokenCost: firstNumber(row.tokenCost, 1),
    costUnit: row.costUnit === "per_minute" ? "per_minute" : "per_scan",
    inputLimits: normalizeInputLimits(inputLimits),
    executionLimits: normalizeExecutionLimits(executionLimits),
    requestTemplate: asRecord(row.requestTemplate),
    responseMapping: normalizeResponseMapping(row.responseMapping ?? row.responseAdapter),
    lastTestedAt: nullableString(row.lastTestedAt),
    lastError: stringValue(row.lastError),
    createdAt: stringValue(row.createdAt) || stringValue(row.created),
    updatedAt: stringValue(row.updatedAt) || stringValue(row.updated),
  };
}

function normalizeInputLimits(value: unknown): AdminInputLimits {
  const row = asRecord(value);
  return {
    maxCharacters: nullableNumber(row.maxCharacters ?? row.maxChars),
    maxBytes: nullableNumber(row.maxBytes),
    maxDurationSeconds: nullableNumber(
      row.maxDurationSeconds ?? row.maxDurationSec,
    ),
  };
}

function normalizeExecutionLimits(value: unknown): AdminExecutionLimits {
  const row = asRecord(value);
  return {
    timeoutMs: firstNumber(row.timeoutMs, 30_000),
    maxRetries: firstNumber(row.maxRetries, 1),
    requestsPerMinute: nullableNumber(
      row.requestsPerMinute ?? row.rateLimitRpm,
    ),
    concurrencyLimit: nullableNumber(row.concurrencyLimit),
  };
}

function normalizeResponseMapping(value: unknown): AdminResponseMapping {
  const row = asRecord(value);
  const thresholds = asRecord(row.thresholds);
  const preset = stringValue(row.preset);
  return {
    preset:
      preset === "openai-compatible" ||
      preset === "velma-segments" ||
      preset === "generic-json"
        ? preset
        : "hf-classification",
    resultPath: stringValue(row.resultPath),
    labelPath: stringValue(row.labelPath) || "label",
    scorePath: stringValue(row.scorePath) || "score",
    modelPath: stringValue(row.modelPath),
    errorPath: stringValue(row.errorPath),
    aiLabels: stringArray(row.aiLabels),
    humanLabels: stringArray(row.humanLabels),
    scoreScale:
      row.scoreScale === "zero_to_hundred" ? "zero_to_hundred" : "zero_to_one",
    invertScore: booleanValue(row.invertScore),
    aggregation:
      row.aggregation === "max" ||
      row.aggregation === "mean" ||
      row.aggregation === "weighted_mean"
        ? row.aggregation
        : "first",
    mixedThreshold: firstNumber(row.mixedThreshold, thresholds.mixed, 40),
    aiThreshold: firstNumber(row.aiThreshold, thresholds.ai, 70),
  };
}

function normalizeLog(value: unknown): AdminLog {
  const row = asRecord(value);
  return {
    id:
      stringValue(row.id) ||
      stringValue(row.requestId) ||
      `${stringValue(row.timestamp)}-${stringValue(row.event)}`,
    timestamp:
      stringValue(row.timestamp) ||
      stringValue(row.createdAt) ||
      stringValue(row.created),
    level: logLevel(row.level ?? row.severity),
    source: stringValue(row.source) || stringValue(row.service) || "api",
    event: stringValue(row.event) || stringValue(row.type),
    message: stringValue(row.message),
    requestId: nullableString(row.requestId),
    traceId: nullableString(row.traceId),
    userId: nullableString(row.userId),
    scanId: nullableString(row.scanId),
    modelId: nullableString(row.modelId),
    providerId: nullableString(row.providerId),
    statusCode: nullableNumber(row.statusCode ?? row.httpStatus),
    durationMs: nullableNumber(row.durationMs ?? row.latencyMs),
    metadata: asRecord(row.metadata ?? row.context ?? row.data),
  };
}

function normalizeTestResult(value: unknown): AdminTestResult {
  const row = asRecord(value);
  const ok = row.ok === undefined ? serviceStatus(row.status) === "healthy" : booleanValue(row.ok);
  const status =
    typeof row.status === "string"
      ? serviceStatus(row.status)
      : ok
        ? "healthy"
        : "down";
  return {
    ok,
    status,
    message:
      stringValue(row.message) ||
      stringValue(row.error) ||
      (ok ? "Connection succeeded." : "Connection failed."),
    latencyMs: nullableNumber(row.latencyMs ?? row.durationMs),
    raw: row.raw ?? row.result,
  };
}

function normalizeNormalizedResult(value: unknown): AdminNormalizedResult {
  const row = asRecord(value);
  const verdict = row.verdict === "ai" || row.verdict === "mixed" ? row.verdict : "human";
  return {
    verdict,
    confidence: firstNumber(row.confidence),
    aiPct: firstNumber(row.aiPct, row.aiPercentage),
    model: stringValue(row.model),
    metadata: asRecord(row.metadata),
  };
}

function normalizePage<T>(
  value: unknown,
  normalize: (entry: unknown) => T,
  collectionKey: string,
): AdminPage<T> {
  const root = asRecord(value);
  const items = collectionFrom(value, collectionKey).map(normalize);
  const page = Math.max(1, firstNumber(root.page, 1));
  const perPage = Math.max(1, firstNumber(root.perPage, items.length || 25));
  const totalItems = firstNumber(root.totalItems, root.total, items.length);
  const totalPages = Math.max(
    1,
    firstNumber(root.totalPages, Math.ceil(totalItems / perPage) || 1),
  );
  return { items, page, perPage, totalItems, totalPages };
}

function collectionFrom(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) return value;
  const row = asRecord(value);
  const candidate = row[key] ?? row.items ?? row.data;
  return Array.isArray(candidate) ? candidate : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  const output = stringValue(value);
  return output || null;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const output = typeof value === "number" ? value : Number(value);
  return Number.isFinite(output) ? output : null;
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    const output = nullableNumber(value);
    if (output !== null) return output;
  }
  return 0;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(stringValue).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function plan(value: unknown): Plan {
  return value === "verify" || value === "certify" || value === "team"
    ? value
    : "check";
}

function planArray(value: unknown): Plan[] {
  return stringArray(value).map(plan);
}

function modelType(value: unknown): AdminModelType {
  return value === "img" || value === "aud" || value === "vid" ? value : "txt";
}

function providerKind(value: unknown): AdminProvider["kind"] {
  if (value === "local" || value === "huggingface" || value === "openai-compatible") {
    return value;
  }
  return "http";
}

function authType(value: unknown): AdminProvider["authType"] {
  return value === "bearer" || value === "api-key" || value === "basic"
    ? value
    : "none";
}

function serviceStatus(value: unknown): AdminServiceStatus {
  if (value === true || value === "ok" || value === "up" || value === "healthy") {
    return "healthy";
  }
  if (value === "degraded" || value === "warn" || value === "warning") {
    return "degraded";
  }
  if (value === false || value === "down" || value === "error" || value === "failed") {
    return "down";
  }
  return "unknown";
}

function userStatus(value: unknown): AdminUserStatus {
  return value === "suspended" || value === "invited" || value === "deleted"
    ? value
    : "active";
}

function systemRole(value: unknown): AdminSystemRole {
  return value === "admin" || value === "superadmin" ? value : "user";
}

function logLevel(value: unknown): AdminLogLevel {
  return value === "debug" || value === "warn" || value === "error" ? value : "info";
}

function labelFromSlug(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
