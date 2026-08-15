import type { Plan } from "@heynotai/shared";

export type AdminSystemRole = "user" | "admin" | "superadmin";
export type AdminUserStatus = "active" | "suspended" | "invited" | "deleted";
export type AdminServiceStatus = "healthy" | "degraded" | "down" | "unknown";
export type AdminProviderKind =
  | "local"
  | "huggingface"
  | "openai-compatible"
  | "http";
export type AdminModelType = "txt" | "img" | "aud" | "vid";
export type AdminCostUnit = "per_scan" | "per_minute";
export type AdminLogLevel = "debug" | "info" | "warn" | "error";

export type AdminPage<T> = {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  status: AdminUserStatus;
  systemRole: AdminSystemRole;
  plan: Plan;
  verified: boolean;
  authProviders: string[];
  monthlyUsage: number;
  monthlyTokenLimit: number | null;
  createdAt: string;
  lastActiveAt: string | null;
};

export type AdminUserPatch = Partial<
  Pick<AdminUser, "status" | "systemRole" | "plan" | "monthlyTokenLimit">
>;

export type AdminOverviewMetric = {
  value: number;
  previous?: number;
};

export type AdminService = {
  id: string;
  name: string;
  status: AdminServiceStatus;
  latencyMs: number | null;
  message: string;
  checkedAt: string | null;
};

export type AdminModelHealth = {
  id: string;
  name: string;
  provider: string;
  type: AdminModelType;
  status: AdminServiceStatus;
  successRate: number | null;
  p95LatencyMs: number | null;
  lastCheckedAt: string | null;
};

export type AdminOverview = {
  totalUsers: number;
  activeUsers: number;
  scans24h: number;
  errorRate24h: number;
  p95LatencyMs: number;
  enabledModels: number;
  services: AdminService[];
  modelHealth: AdminModelHealth[];
  recentLogs: AdminLog[];
  generatedAt: string;
};

export type AdminProvider = {
  id: string;
  name: string;
  slug: string;
  kind: AdminProviderKind;
  baseUrl: string;
  authType: "none" | "bearer" | "api-key" | "basic";
  credentialConfigured: boolean;
  credential?: string;
  enabled: boolean;
  status: AdminServiceStatus;
  timeoutMs: number;
  maxRetries: number;
  requestsPerMinute: number | null;
  concurrencyLimit: number | null;
  lastTestedAt: string | null;
  lastError: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminProviderInput = {
  name: string;
  slug: string;
  kind: AdminProviderKind;
  baseUrl: string;
  authType: AdminProvider["authType"];
  credential?: string;
  enabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  requestsPerMinute: number | null;
  concurrencyLimit: number | null;
};

export type AdminTestResult = {
  ok: boolean;
  status: AdminServiceStatus;
  message: string;
  latencyMs: number | null;
  raw?: unknown;
};

export type AdminResponseMapping = {
  preset:
    | "hf-classification"
    | "openai-compatible"
    | "velma-segments"
    | "generic-json";
  resultPath: string;
  labelPath: string;
  scorePath: string;
  modelPath: string;
  errorPath: string;
  aiLabels: string[];
  humanLabels: string[];
  scoreScale: "zero_to_one" | "zero_to_hundred";
  invertScore: boolean;
  aggregation: "first" | "max" | "mean" | "weighted_mean";
  mixedThreshold: number;
  aiThreshold: number;
};

export type AdminInputLimits = {
  maxCharacters: number | null;
  maxBytes: number | null;
  maxDurationSeconds: number | null;
};

export type AdminExecutionLimits = {
  timeoutMs: number;
  maxRetries: number;
  requestsPerMinute: number | null;
  concurrencyLimit: number | null;
};

export type AdminModel = {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: AdminModelType;
  providerId: string;
  providerName: string;
  modelIdentifier: string;
  endpointPath: string;
  enabled: boolean;
  status: AdminServiceStatus;
  accuracy: number;
  tier: Plan;
  plansAllowed: Plan[];
  defaultForPlans: Plan[];
  tokenCost: number;
  costUnit: AdminCostUnit;
  inputLimits: AdminInputLimits;
  executionLimits: AdminExecutionLimits;
  requestTemplate: Record<string, unknown>;
  responseMapping: AdminResponseMapping;
  lastTestedAt: string | null;
  lastError: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminModelInput = Omit<
  AdminModel,
  | "id"
  | "providerName"
  | "status"
  | "lastTestedAt"
  | "lastError"
  | "createdAt"
  | "updatedAt"
>;

export type AdminNormalizedResult = {
  verdict: "human" | "ai" | "mixed";
  confidence: number;
  aiPct: number;
  model: string;
  metadata?: Record<string, unknown>;
};

export type AdminNormalizeTestInput = {
  responseMapping: AdminResponseMapping;
  sampleResponse: unknown;
};

export type AdminLog = {
  id: string;
  timestamp: string;
  level: AdminLogLevel;
  source: string;
  event: string;
  message: string;
  requestId: string | null;
  traceId: string | null;
  userId: string | null;
  scanId: string | null;
  modelId: string | null;
  providerId: string | null;
  statusCode: number | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
};

export type AdminLogFilters = {
  page?: number;
  perPage?: number;
  q?: string;
  level?: AdminLogLevel | "";
  source?: string;
  event?: string;
  userId?: string;
  modelId?: string;
  providerId?: string;
  requestId?: string;
  from?: string;
  to?: string;
};

