import { sql } from "../db/client.js";
import {
  parseRequestSpec,
  parseResponseSpec,
  type ExecutionLimits,
  type InputLimits,
  type ModelKind,
  type ProviderConfig,
  type ProviderDriver,
  type RuntimeModel,
} from "./types.js";

export type RuntimeBinding = {
  model: RuntimeModel;
  provider: ProviderConfig;
};

type RuntimeRow = {
  model_id: string;
  slug: string;
  name: string;
  type: string;
  external_model_id: string;
  request_spec: unknown;
  response_spec: unknown;
  input_limits: unknown;
  execution_limits: unknown;
  runtime_config: unknown;
  config_version: number;
  model_enabled: boolean;
  archived_at: Date | string | null;
  provider_id: string | null;
  provider_key: string | null;
  provider_name: string | null;
  provider_driver: string | null;
  base_url: string | null;
  auth_scheme: string | null;
  credential_ciphertext: string | null;
  credential_hint: string | null;
  provider_config: unknown;
  provider_enabled: boolean | null;
  is_local: boolean | null;
  deleted_at: Date | string | null;
};

/** Load the immutable execution snapshot represented by the current model row.
 * The registry deliberately returns only validated declarative configuration;
 * database-stored JavaScript or shell commands are never evaluated. */
export async function loadRuntimeBinding(modelIdOrSlug: string): Promise<RuntimeBinding> {
  const rows = await sql<RuntimeRow[]>`
    SELECT
      m.id AS model_id, m.slug, m.name, m.type, m.external_model_id,
      m.request_spec, m.response_spec, m.input_limits, m.execution_limits,
      m.runtime_config, m.config_version, m.enabled AS model_enabled,
      m.archived_at,
      p.id AS provider_id, p.key AS provider_key, p.name AS provider_name,
      p.driver AS provider_driver, p.base_url, p.auth_scheme,
      p.credential_ciphertext, p.credential_hint, p.config AS provider_config,
      p.enabled AS provider_enabled, p.is_local, p.deleted_at
    FROM detection_models m
    LEFT JOIN providers p ON p.id = m.provider_id
    WHERE m.id = ${modelIdOrSlug} OR m.slug = ${modelIdOrSlug}
    ORDER BY CASE WHEN m.id = ${modelIdOrSlug} THEN 0 ELSE 1 END
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.archived_at) {
    throw new Error(`Detection model ${modelIdOrSlug} was not found`);
  }
  if (!row.model_enabled) {
    throw new Error(`Detection model ${row.slug} is disabled`);
  }
  if (!row.provider_id || !row.provider_key || !row.provider_driver) {
    throw new Error(`Detection model ${row.slug} has no provider`);
  }
  if (row.deleted_at || row.provider_enabled === false) {
    throw new Error(`Provider ${row.provider_key} is disabled`);
  }

  const kind = modelKind(row.type);
  const driver = providerDriver(row.provider_driver);
  const requestSpec = parseRequestSpec(row.request_spec ?? {});
  const responseSpec = parseResponseSpec(row.response_spec ?? { preset: "generic" });

  return {
    model: {
      id: row.model_id,
      slug: row.slug,
      name: row.name,
      type: kind,
      externalModelId: row.external_model_id,
      requestSpec,
      responseSpec,
      inputLimits: record(row.input_limits) as InputLimits,
      executionLimits: record(row.execution_limits) as ExecutionLimits,
      runtimeConfig: record(row.runtime_config),
      configVersion: row.config_version,
    },
    provider: {
      id: row.provider_id,
      key: row.provider_key,
      name: row.provider_name ?? row.provider_key,
      driver,
      baseUrl: row.base_url ?? "",
      authScheme: authScheme(row.auth_scheme),
      credentialCiphertext: row.credential_ciphertext,
      credentialHint: row.credential_hint ?? "",
      enabled: row.provider_enabled ?? false,
      isLocal: row.is_local ?? false,
      config: record(row.provider_config),
    },
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function modelKind(value: string): ModelKind {
  if (value === "txt" || value === "img" || value === "aud" || value === "vid") {
    return value;
  }
  throw new Error(`Unsupported model type: ${value}`);
}

function providerDriver(value: string): ProviderDriver {
  if (
    value === "http" || value === "local-http" ||
    value === "openai-compatible" || value === "huggingface" || value === "velma"
  ) {
    return value;
  }
  throw new Error(`Unsupported provider driver: ${value}`);
}

function authScheme(value: string | null): ProviderConfig["authScheme"] {
  if (
    value === "none" || value === "bearer" || value === "api-key" ||
    value === "x-api-key" || value === "basic"
  ) {
    return value;
  }
  return "none";
}
