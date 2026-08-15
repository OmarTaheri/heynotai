-- heynotai PostgreSQL foundation.
--
-- IDs intentionally remain TEXT and default to application backend-compatible
-- 15-character lowercase hexadecimal values. Existing application backend IDs can be
-- imported without rewriting URLs or relation fields.

CREATE OR REPLACE FUNCTION heynotai_id()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT substr(md5(random()::text || clock_timestamp()::text), 1, 15)
$$;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY DEFAULT heynotai_id(),
  email text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  google_subject text UNIQUE,
  password_hash text,
  name text NOT NULL DEFAULT '',
  handle text NOT NULL DEFAULT '',
  avatar_file_id text,
  avatar_url text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'en',
  plan text NOT NULL DEFAULT 'check',
  plan_cycle text,
  plan_badge text NOT NULL DEFAULT '',
  plan_renews_on timestamptz,
  billing_email text NOT NULL DEFAULT '',
  billing_address text NOT NULL DEFAULT '',
  billing_country text NOT NULL DEFAULT '',
  tax_id text NOT NULL DEFAULT '',
  payment_brand text NOT NULL DEFAULT '',
  payment_last4 text NOT NULL DEFAULT '',
  payment_expires text NOT NULL DEFAULT '',
  stripe_customer_id text NOT NULL DEFAULT '',
  stripe_subscription_id text NOT NULL DEFAULT '',
  pending_plan text,
  pending_plan_cycle text,
  pending_plan_effective timestamptz,
  mfa_enabled boolean NOT NULL DEFAULT false,
  onboarding_completed boolean NOT NULL DEFAULT false,
  -- `role` is the onboarding/persona answer (journalist, educator, ...).
  -- `system_role` is the authorization role and must never be writable
  -- through the normal profile endpoint.
  role text NOT NULL DEFAULT '',
  system_role text NOT NULL DEFAULT 'user',
  use_cases jsonb NOT NULL DEFAULT '[]'::jsonb,
  connections jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_monthly_limit bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT users_email_normalized CHECK (email = lower(email)),
  CONSTRAINT users_plan_check CHECK (plan IN ('check', 'verify', 'certify', 'team')),
  CONSTRAINT users_plan_cycle_check CHECK (plan_cycle IS NULL OR plan_cycle IN ('monthly', 'yearly')),
  CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'disabled', 'deleted')),
  CONSTRAINT users_system_role_check CHECK (system_role IN ('user', 'support', 'admin', 'owner'))
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON users (lower(email))
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_handle_unique
  ON users (lower(handle))
  WHERE handle <> '' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS users_status_created_idx
  ON users (status, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY DEFAULT heynotai_id(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  refresh_token_hash text UNIQUE,
  expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz,
  ip_address text,
  user_agent text,
  device text NOT NULL DEFAULT '',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_active_idx
  ON sessions (user_id, expires_at DESC)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS oauth_states (
  id text PRIMARY KEY DEFAULT heynotai_id(),
  provider text NOT NULL,
  state_hash text NOT NULL UNIQUE,
  exchange_code_hash text UNIQUE,
  code_verifier text NOT NULL,
  redirect_uri text NOT NULL,
  client_kind text NOT NULL DEFAULT 'web',
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oauth_states_client_kind_check CHECK (client_kind IN ('web', 'extension', 'admin'))
);

CREATE INDEX IF NOT EXISTS oauth_states_expiry_idx ON oauth_states (expires_at);

-- Generic application records replace application backend base collections while the
-- public collection-shaped API remains stable. Relation ids stay inside data
-- as their original camelCase names; owner_id is a denormalized authorization
-- key and does not replace relation fields in the wire record.
CREATE TABLE IF NOT EXISTS app_records (
  id text PRIMARY KEY DEFAULT heynotai_id(),
  collection text NOT NULL,
  owner_id text REFERENCES users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT app_records_collection_name_check CHECK (collection ~ '^[A-Za-z_][A-Za-z0-9_]*$')
);

CREATE INDEX IF NOT EXISTS app_records_collection_owner_created_idx
  ON app_records (collection, owner_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS app_records_data_gin_idx
  ON app_records USING gin (data jsonb_path_ops)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS app_records_single_user_pref_idx
  ON app_records (collection, owner_id)
  WHERE collection IN ('notification_prefs', 'privacy_prefs', 'appearance_prefs', 'extension_prefs')
    AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS app_records_collection_slug_idx
  ON app_records ((data->>'slug'))
  WHERE collection = 'collections' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS app_records_member_pair_idx
  ON app_records ((data->>'collection'), (data->>'userId'))
  WHERE collection = 'collection_members' AND coalesce(data->>'userId', '') <> '' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS app_records_item_pair_idx
  ON app_records ((data->>'collection'), (data->>'scanId'))
  WHERE collection = 'collection_items' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS app_records_presence_pair_idx
  ON app_records ((data->>'userId'), (data->>'scanId'))
  WHERE collection = 'presence' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS app_records_scan_share_idx
  ON app_records ((data->>'shareToken'))
  WHERE collection = 'scans' AND coalesce(data->>'shareToken', '') <> '' AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS files (
  id text PRIMARY KEY DEFAULT heynotai_id(),
  owner_id text REFERENCES users(id) ON DELETE SET NULL,
  record_collection text NOT NULL,
  record_id text NOT NULL,
  field_name text NOT NULL,
  original_name text NOT NULL,
  stored_name text NOT NULL UNIQUE,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL DEFAULT 0,
  sha256 text NOT NULL,
  storage_path text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS files_record_idx
  ON files (record_collection, record_id, field_name, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS files_owner_idx
  ON files (owner_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS providers (
  id text PRIMARY KEY DEFAULT heynotai_id(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  driver text NOT NULL,
  base_url text NOT NULL DEFAULT '',
  auth_scheme text NOT NULL DEFAULT 'none',
  credential_ciphertext text,
  credential_hint text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  is_local boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT providers_driver_check CHECK (driver IN ('http', 'local-http', 'openai-compatible', 'huggingface', 'velma')),
  CONSTRAINT providers_auth_scheme_check CHECK (auth_scheme IN ('none', 'bearer', 'api-key', 'x-api-key', 'basic'))
);

CREATE INDEX IF NOT EXISTS providers_enabled_idx
  ON providers (enabled, key)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS detection_models (
  id text PRIMARY KEY DEFAULT heynotai_id(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL,
  provider_id text REFERENCES providers(id) ON DELETE RESTRICT,
  external_model_id text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  accuracy numeric(6,3) NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  tier text NOT NULL DEFAULT 'check',
  token_cost numeric(14,4) NOT NULL DEFAULT 1,
  cost_unit text NOT NULL DEFAULT 'per_scan',
  is_default boolean NOT NULL DEFAULT false,
  request_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  execution_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  runtime_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  config_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT detection_models_type_check CHECK (type IN ('txt', 'img', 'aud', 'vid')),
  CONSTRAINT detection_models_tier_check CHECK (tier IN ('check', 'verify', 'certify', 'team')),
  CONSTRAINT detection_models_cost_unit_check CHECK (cost_unit IN ('per_scan', 'per_minute', 'per_token', 'free')),
  CONSTRAINT detection_models_nonnegative_cost CHECK (token_cost >= 0),
  CONSTRAINT detection_models_positive_version CHECK (config_version > 0)
);

CREATE INDEX IF NOT EXISTS detection_models_catalog_idx
  ON detection_models (type, enabled, token_cost, accuracy DESC)
  WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS detection_models_default_type_tier_idx
  ON detection_models (type, tier)
  WHERE is_default = true AND enabled = true AND archived_at IS NULL;

CREATE TABLE IF NOT EXISTS model_usage_ledger (
  id text PRIMARY KEY DEFAULT heynotai_id(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model_id text REFERENCES detection_models(id) ON DELETE SET NULL,
  scan_id text,
  kind text NOT NULL,
  credits numeric(14,4) NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_usage_ledger_kind_check CHECK (kind IN ('charge', 'refund', 'adjustment', 'grant'))
);

CREATE INDEX IF NOT EXISTS model_usage_user_month_idx
  ON model_usage_ledger (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS model_usage_scan_idx
  ON model_usage_ledger (scan_id)
  WHERE scan_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS scan_jobs (
  id text PRIMARY KEY DEFAULT heynotai_id(),
  scan_id text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model_id text REFERENCES detection_models(id) ON DELETE SET NULL,
  model_version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'queued',
  priority integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  available_at timestamptz NOT NULL DEFAULT now(),
  leased_at timestamptz,
  lease_owner text,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scan_jobs_status_check CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT scan_jobs_attempts_check CHECK (attempts >= 0 AND max_attempts > 0)
);

CREATE INDEX IF NOT EXISTS scan_jobs_claim_idx
  ON scan_jobs (priority DESC, available_at, created_at)
  WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS scan_jobs_scan_idx ON scan_jobs (scan_id, created_at DESC);

CREATE TABLE IF NOT EXISTS system_logs (
  id text PRIMARY KEY DEFAULT heynotai_id(),
  level text NOT NULL DEFAULT 'info',
  service text NOT NULL DEFAULT 'api',
  event text NOT NULL DEFAULT '',
  message text NOT NULL,
  request_id text,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  scan_id text,
  model_id text REFERENCES detection_models(id) ON DELETE SET NULL,
  provider_id text REFERENCES providers(id) ON DELETE SET NULL,
  duration_ms integer,
  status_code integer,
  error_code text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  redacted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_logs_level_check CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal'))
);

CREATE INDEX IF NOT EXISTS system_logs_created_idx ON system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS system_logs_request_idx ON system_logs (request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS system_logs_scan_idx ON system_logs (scan_id, created_at DESC) WHERE scan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS system_logs_level_idx ON system_logs (level, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id text PRIMARY KEY DEFAULT heynotai_id(),
  actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'user',
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  request_id text,
  ip_address text,
  user_agent text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_actor_type_check CHECK (actor_type IN ('user', 'admin', 'system', 'worker', 'webhook'))
);

CREATE INDEX IF NOT EXISTS audit_events_created_idx ON audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx ON audit_events (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events (entity_type, entity_id, created_at DESC);
