import { createHash } from "node:crypto";

import { sql } from "./client.js";
import { createRecordId } from "./id.js";
import {
  compileFilter,
  interpolateFilter,
  projectFields,
  sortRecords,
} from "./store-filter.js";
import {
  findStoredFile,
  findStoredFileById,
  persistUpload,
  storeFileUrl,
  type StoredFile,
} from "./store-files.js";
import {
  assertCanCreate,
  assertCanDelete,
  assertCanUpdate,
  canReadRecord,
  isAdminActor,
  ownerIdFor,
  type PolicyRecord,
} from "./store-policy.js";
import {
  StoreError,
  type ListOptions,
  type ListResult,
  type PocketRecord,
  type StoreActor,
} from "./store-types.js";
import {
  credentialHint,
  decryptCredential,
  encryptCredential,
  parseRequestSpec,
  parseResponseSpec,
} from "../model-runtime/index.js";

export type { ListOptions, ListResult, PocketRecord, StoreActor } from "./store-types.js";
export { StoreError } from "./store-types.js";

type WriteBody = Record<string, unknown> | FormData;

const PERSONAL_COLLECTIONS = new Set([
  "notification_prefs",
  "privacy_prefs",
  "appearance_prefs",
  "extension_prefs",
  "data_exports",
]);

const RELATIONS: Record<string, Record<string, string>> = {
  collection_members: {
    collection: "collections",
    userId: "users",
    invitedBy: "users",
  },
  collection_items: { collection: "collections", scanId: "scans", addedBy: "users" },
  collection_activities: { collection: "collections", actor: "users" },
  presence: { userId: "users", scanId: "scans" },
  teams: { manager: "users" },
  team_members: { team: "teams", user: "users", invitedBy: "users" },
  scans: { userId: "users" },
};

export function storeForUser(user: StoreActor): DatabaseStore {
  if (!user?.id) throw new StoreError(401, "unauthorized", "Authenticated user is required");
  return new DatabaseStore(user, false);
}

export function adminStore(): DatabaseStore {
  return new DatabaseStore(null, true);
}

export class DatabaseStore {
  readonly authStore: {
    record: StoreActor | null;
    isValid: boolean;
    token: string;
  };

  readonly files = {
    getURL: (record: Record<string, unknown>, fileName: string) =>
      storeFileUrl(record, fileName),
    find: (collection: string, recordId: string, fileName: string) =>
      findStoredFile(collection, recordId, fileName),
    findById: (id: string) => findStoredFileById(id),
  };

  constructor(
    readonly actor: StoreActor | null,
    readonly isAdmin: boolean,
  ) {
    this.authStore = {
      record: actor,
      isValid: isAdmin || Boolean(actor?.id),
      token: "",
    };
  }

  collection<T extends PocketRecord = PocketRecord>(name: string): CollectionStore<T> {
    validateCollectionName(name);
    return new CollectionStore<T>(this, name);
  }

  filter(source: string, params: Record<string, unknown>): string {
    return interpolateFilter(source, params);
  }
}

export class CollectionStore<T extends PocketRecord = PocketRecord> {
  constructor(
    private readonly store: DatabaseStore,
    readonly name: string,
  ) {}

  async getOne(id: string, options: ListOptions = {}): Promise<T> {
    const records = await this.readAll();
    const record = records.find((entry) => entry.id === id);
    if (!record) notFound();
    const expanded = await this.expand(record!, options.expand);
    return projectFields(expanded, options.fields) as T;
  }

  async getList(
    page = 1,
    perPage = 30,
    options: ListOptions = {},
  ): Promise<ListResult<T>> {
    const safePage = Math.max(1, Math.floor(page));
    const safePerPage = Math.min(500, Math.max(1, Math.floor(perPage)));
    const predicate = compileFilter(options.filter);
    const all = sortRecords(
      (await this.readAll()).filter(predicate),
      options.sort,
    );
    const totalItems = all.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / safePerPage));
    const start = (safePage - 1) * safePerPage;
    const pageItems = all.slice(start, start + safePerPage);
    const items = await Promise.all(
      pageItems.map(async (record) =>
        projectFields(await this.expand(record, options.expand), options.fields) as T,
      ),
    );
    return {
      page: safePage,
      perPage: safePerPage,
      totalItems,
      totalPages,
      items,
    };
  }

  async getFullList(options?: ListOptions): Promise<T[]>;
  async getFullList(batchSize?: number, options?: ListOptions): Promise<T[]>;
  async getFullList(
    batchOrOptions: number | ListOptions = {},
    maybeOptions: ListOptions = {},
  ): Promise<T[]> {
    const options = typeof batchOrOptions === "number" ? maybeOptions : batchOrOptions;
    const predicate = compileFilter(options.filter);
    const records = sortRecords(
      (await this.readAll()).filter(predicate),
      options.sort,
    );
    return Promise.all(
      records.map(async (record) =>
        projectFields(await this.expand(record, options.expand), options.fields) as T,
      ),
    );
  }

  async getFirstListItem(filter: string, options: ListOptions = {}): Promise<T> {
    const result = await this.getList(1, 1, { ...options, filter });
    if (!result.items[0]) notFound();
    return result.items[0]!;
  }

  async create(body: WriteBody, _options: ListOptions = {}): Promise<T> {
    switch (collectionKind(this.name)) {
      case "users":
        return (await this.createUser(body)) as T;
      case "providers":
        return (await this.createProvider(body)) as T;
      case "models":
        return (await this.createModel(body)) as T;
      case "sessions":
        return (await this.createSession(body)) as T;
      case "secrets":
        return (await this.upsertSecrets(body)) as T;
      case "app":
        return (await this.createAppRecord(body)) as T;
    }
  }

  async update(id: string, body: WriteBody, _options: ListOptions = {}): Promise<T> {
    switch (collectionKind(this.name)) {
      case "users":
        return (await this.updateUser(id, body)) as T;
      case "providers":
        return (await this.updateProvider(id, body)) as T;
      case "models":
        return (await this.updateModel(id, body)) as T;
      case "sessions":
        throw new StoreError(405, "method_not_allowed", "Sessions cannot be updated through the data store");
      case "secrets":
        return (await this.upsertSecrets(body)) as T;
      case "app":
        return (await this.updateAppRecord(id, body)) as T;
    }
  }

  async delete(id: string): Promise<boolean> {
    switch (collectionKind(this.name)) {
      case "users":
        await this.deleteUser(id);
        return true;
      case "providers":
        this.assertAdmin();
        await sql`UPDATE providers SET deleted_at = now(), enabled = false, updated_at = now() WHERE id = ${id}`;
        return true;
      case "models":
        this.assertAdmin();
        await sql`UPDATE detection_models SET archived_at = now(), enabled = false, updated_at = now() WHERE id = ${id}`;
        return true;
      case "sessions":
        await this.deleteSession(id);
        return true;
      case "secrets":
        this.assertAdmin();
        await sql`UPDATE providers SET credential_ciphertext = NULL, credential_hint = '', updated_at = now()`;
        return true;
      case "app":
        await this.deleteAppRecord(id);
        return true;
    }
  }

  private async readAll(): Promise<PocketRecord[]> {
    switch (collectionKind(this.name)) {
      case "users":
        return this.readUsers();
      case "providers":
        return this.readProviders();
      case "models":
        return this.readModels();
      case "sessions":
        return this.readSessions();
      case "secrets":
        return this.readSecrets();
      case "app":
        return this.readAppRecords();
    }
  }

  private async readUsers(): Promise<PocketRecord[]> {
    const privileged = this.store.isAdmin || isAdminActor(this.store.actor);
    const rows = privileged
      ? await sql<UserRow[]>`
          SELECT u.*, f.original_name AS avatar_name
          FROM users u
          LEFT JOIN files f ON f.id = u.avatar_file_id AND f.deleted_at IS NULL
          WHERE u.deleted_at IS NULL
          ORDER BY u.created_at DESC
        `
      : await sql<UserRow[]>`
          SELECT u.*, f.original_name AS avatar_name
          FROM users u
          LEFT JOIN files f ON f.id = u.avatar_file_id AND f.deleted_at IS NULL
          WHERE u.id = ${this.store.actor?.id ?? ""} AND u.deleted_at IS NULL
        `;
    return rows.map(mapUser);
  }

  private async readProviders(): Promise<PocketRecord[]> {
    this.assertAdmin();
    const rows = await sql<ProviderRow[]>`
      SELECT * FROM providers WHERE deleted_at IS NULL ORDER BY key
    `;
    return rows.map(mapProvider);
  }

  private async readModels(): Promise<PocketRecord[]> {
    const privileged = this.store.isAdmin || isAdminActor(this.store.actor);
    const rows = privileged
      ? await sql<ModelJoinRow[]>`
          SELECT m.*, p.key AS provider_key, p.driver AS provider_driver
          FROM detection_models m
          LEFT JOIN providers p ON p.id = m.provider_id
          ORDER BY m.type, m.token_cost, m.accuracy DESC
        `
      : await sql<ModelJoinRow[]>`
          SELECT m.*, p.key AS provider_key, p.driver AS provider_driver
          FROM detection_models m
          LEFT JOIN providers p ON p.id = m.provider_id
          WHERE m.enabled = true AND m.archived_at IS NULL
          ORDER BY m.type, m.token_cost, m.accuracy DESC
        `;
    return rows.map(mapModel);
  }

  private async readSessions(): Promise<PocketRecord[]> {
    if (!this.store.actor && !this.store.isAdmin) unauthorized();
    const privileged = this.store.isAdmin || isAdminActor(this.store.actor);
    const rows = privileged
      ? await sql<SessionRow[]>`SELECT * FROM sessions ORDER BY updated_at DESC`
      : await sql<SessionRow[]>`
          SELECT * FROM sessions
          WHERE user_id = ${this.store.actor!.id}
          ORDER BY updated_at DESC
        `;
    return rows.map(mapSession);
  }

  private async readSecrets(): Promise<PocketRecord[]> {
    this.assertAdmin();
    const rows = await sql<ProviderRow[]>`
      SELECT * FROM providers WHERE key IN ('huggingface', 'velma') AND deleted_at IS NULL
    `;
    if (rows.length === 0) return [];
    const byKey = new Map(rows.map((row) => [row.key, row]));
    return [
      {
        id: "service-secrets",
        collectionId: "service_secrets",
        collectionName: "service_secrets",
        huggingfaceToken: decryptOptional(byKey.get("huggingface")?.credential_ciphertext),
        velmaApiKey: decryptOptional(byKey.get("velma")?.credential_ciphertext),
        created: iso(rows[0]!.created_at),
        updated: iso(rows.reduce((latest, row) =>
          new Date(row.updated_at) > new Date(latest.updated_at) ? row : latest,
        ).updated_at),
      },
    ];
  }

  private async readAppRecords(): Promise<PocketRecord[]> {
    const rows = await sql<AppRow[]>`
      SELECT id, collection, owner_id, data, version, created_at, updated_at
      FROM app_records
      WHERE collection = ${this.name} AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 20000
    `;
    const visible: PocketRecord[] = [];
    for (const row of rows) {
      const policy = policyFromRow(row);
      if (await canReadRecord(this.store.actor, policy, this.store.isAdmin)) {
        visible.push(mapAppRecord(row));
      }
    }
    return visible;
  }

  private async expand(record: PocketRecord, expand?: string): Promise<PocketRecord> {
    if (!expand?.trim()) return record;
    const fields = expand.split(",").map((field) => field.trim()).filter(Boolean).slice(0, 20);
    const relationMap = RELATIONS[this.name] ?? {};
    const expanded: Record<string, PocketRecord> = {};
    for (const field of fields) {
      const target = relationMap[field];
      const relationId = record[field];
      if (!target || typeof relationId !== "string" || !relationId) continue;
      try {
        if (target === "users") {
          // A normal users collection read is self-only. Expansion happens
          // only after the parent record passed its sharing policy, so expose
          // a deliberately small collaborator projection instead of either
          // failing the expand or opening the entire users table.
          const user = await publicUserForRelation(
            relationId,
            ["collection_members", "collection_activities", "team_members"].includes(this.name),
          );
          if (user) expanded[field] = user;
        } else {
          expanded[field] = await this.store.collection(target).getOne(relationId);
        }
      } catch (error) {
        if (!(error instanceof StoreError) || error.status !== 404) throw error;
      }
    }
    return Object.keys(expanded).length > 0 ? { ...record, expand: expanded } : record;
  }

  private async createAppRecord(body: WriteBody): Promise<PocketRecord> {
    if (!this.store.actor && !this.store.isAdmin) unauthorized();
    const id = createRecordId();
    const normalized = await normalizeWriteBody(body);
    const data = { ...normalized.data };
    injectActorOwnership(this.name, data, this.store.actor);
    await attachFiles(this.store.actor, this.name, id, data, normalized.files);
    await assertCanCreate(this.store.actor, this.name, data, this.store.isAdmin);
    const ownerId = ownerIdFor(this.name, data, this.store.actor);
    try {
      const rows = await sql<AppRow[]>`
        INSERT INTO app_records (id, collection, owner_id, data)
        VALUES (${id}, ${this.name}, ${ownerId}, ${dbJson(data)})
        RETURNING id, collection, owner_id, data, version, created_at, updated_at
      `;
      return mapAppRecord(rows[0]!);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  private async updateAppRecord(id: string, body: WriteBody): Promise<PocketRecord> {
    const existing = await this.appRow(id);
    const normalized = await normalizeWriteBody(body);
    const data = { ...existing.data, ...normalized.data };
    await attachFiles(this.store.actor, this.name, id, data, normalized.files);
    await assertCanUpdate(
      this.store.actor,
      policyFromRow(existing),
      data,
      this.store.isAdmin,
    );
    try {
      const rows = await sql<AppRow[]>`
        UPDATE app_records
        SET data = ${dbJson(data)},
            owner_id = ${ownerIdFor(this.name, data, this.store.actor)},
            version = version + 1,
            updated_at = now()
        WHERE id = ${id} AND collection = ${this.name} AND deleted_at IS NULL
        RETURNING id, collection, owner_id, data, version, created_at, updated_at
      `;
      if (!rows[0]) notFound();
      return mapAppRecord(rows[0]!);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  private async deleteAppRecord(id: string): Promise<void> {
    const existing = await this.appRow(id);
    await assertCanDelete(this.store.actor, policyFromRow(existing), this.store.isAdmin);
    await sql`
      UPDATE app_records SET deleted_at = now(), updated_at = now()
      WHERE id = ${id} AND collection = ${this.name} AND deleted_at IS NULL
    `;
  }

  private async appRow(id: string): Promise<AppRow> {
    const rows = await sql<AppRow[]>`
      SELECT id, collection, owner_id, data, version, created_at, updated_at
      FROM app_records
      WHERE id = ${id} AND collection = ${this.name} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows[0]) notFound();
    return rows[0]!;
  }

  private async createUser(body: WriteBody): Promise<PocketRecord> {
    this.assertAdmin();
    const normalized = await normalizeWriteBody(body);
    const id = createRecordId();
    const patch = userPatch(normalized.data, true);
    if (!patch.email) {
      throw new StoreError(400, "validation_required", "Email is required");
    }
    const rows = await sql<UserRow[]>`
      INSERT INTO users (
        id, email, email_verified, password_hash, name, handle, avatar_url,
        timezone, language, plan, plan_cycle, onboarding_completed, role,
        system_role, use_cases, connections, status, state, custom_monthly_limit
      ) VALUES (
        ${id}, ${String(patch.email)}, ${Boolean(patch.email_verified ?? false)},
        ${nullableString(patch.password_hash)}, ${String(patch.name ?? "")},
        ${String(patch.handle ?? "")}, ${String(patch.avatar_url ?? "")},
        ${String(patch.timezone ?? "")}, ${String(patch.language ?? "en")},
        ${String(patch.plan ?? "check")}, ${nullableString(patch.plan_cycle)},
        ${Boolean(patch.onboarding_completed ?? false)}, ${String(patch.role ?? "")},
        ${String(patch.system_role ?? "user")},
        ${dbJson((patch.use_cases as unknown[]) ?? [])},
        ${dbJson((patch.connections as unknown[]) ?? [])},
        ${String(patch.status ?? "active")},
        ${dbJson((patch.state as Record<string, unknown>) ?? {})},
        ${nullableNumber(patch.custom_monthly_limit)}
      ) RETURNING *
    `;
    let user = rows[0]!;
    const avatar = normalized.files.get("avatar");
    if (avatar) {
      const stored = await persistUpload({
        actor: { id }, collection: "users", recordId: id, fieldName: "avatar", file: avatar,
      });
      const updated = await sql<UserRow[]>`
        UPDATE users SET avatar_file_id = ${stored.id}, updated_at = now()
        WHERE id = ${id} RETURNING *
      `;
      user = { ...updated[0]!, avatar_name: stored.originalName };
    }
    return mapUser(user);
  }

  private async updateUser(id: string, body: WriteBody): Promise<PocketRecord> {
    const privileged = this.store.isAdmin || isAdminActor(this.store.actor);
    if (!privileged && this.store.actor?.id !== id) deny();
    const normalized = await normalizeWriteBody(body);
    const patch = userPatch(normalized.data, privileged);
    const avatar = normalized.files.get("avatar");
    if (avatar) {
      const stored = await persistUpload({
        actor: this.store.actor ?? { id }, collection: "users", recordId: id, fieldName: "avatar", file: avatar,
      });
      patch.avatar_file_id = stored.id;
    }
    if (Object.keys(patch).length > 0) {
      await unsafeUpdate("users", id, patch, USER_JSON_COLUMNS);
    }
    const records = await this.readUsers();
    const record = records.find((entry) => entry.id === id);
    if (!record) notFound();
    return record!;
  }

  private async deleteUser(id: string): Promise<void> {
    const privileged = this.store.isAdmin || isAdminActor(this.store.actor);
    if (!privileged && this.store.actor?.id !== id) deny();
    await sql.begin(async (tx) => {
      await tx`UPDATE users SET status = 'deleted', deleted_at = now(), updated_at = now() WHERE id = ${id}`;
      await tx`UPDATE sessions SET revoked_at = now(), updated_at = now() WHERE user_id = ${id} AND revoked_at IS NULL`;
    });
  }

  private async createProvider(body: WriteBody): Promise<PocketRecord> {
    this.assertAdmin();
    const { data } = await normalizeWriteBody(body);
    const patch = providerPatch(data);
    const key = stringRequired(patch.key, "key");
    const credential = nullableString(data.credential);
    const rows = await sql<ProviderRow[]>`
      INSERT INTO providers (
        id, key, name, driver, base_url, auth_scheme, credential_ciphertext,
        credential_hint, config, enabled, is_local
      ) VALUES (
        ${createRecordId()}, ${key}, ${stringRequired(patch.name, "name")},
        ${String(patch.driver ?? "http")}, ${String(patch.base_url ?? "")},
        ${String(patch.auth_scheme ?? "none")},
        ${credential ? encryptCredential(credential) : null},
        ${credential ? credentialHint(credential) : ""},
        ${dbJson((patch.config as Record<string, unknown>) ?? {})},
        ${patch.enabled === undefined ? true : Boolean(patch.enabled)},
        ${Boolean(patch.is_local ?? false)}
      ) RETURNING *
    `;
    return mapProvider(rows[0]!);
  }

  private async updateProvider(id: string, body: WriteBody): Promise<PocketRecord> {
    this.assertAdmin();
    const { data } = await normalizeWriteBody(body);
    const patch = providerPatch(data);
    if (typeof data.credential === "string" && data.credential.trim()) {
      patch.credential_ciphertext = encryptCredential(data.credential.trim());
      patch.credential_hint = credentialHint(data.credential.trim());
    }
    delete (patch as Record<string, unknown>).key;
    if (Object.keys(patch).length > 0) await unsafeUpdate("providers", id, patch, PROVIDER_JSON_COLUMNS);
    const rows = await sql<ProviderRow[]>`SELECT * FROM providers WHERE id = ${id} AND deleted_at IS NULL`;
    if (!rows[0]) notFound();
    return mapProvider(rows[0]!);
  }

  private async createModel(body: WriteBody): Promise<PocketRecord> {
    this.assertAdmin();
    const { data } = await normalizeWriteBody(body);
    const patch = await modelPatch(data);
    parseRequestSpec(patch.request_spec ?? {});
    parseResponseSpec(patch.response_spec ?? { preset: "generic" });
    const rows = await sql<ModelJoinRow[]>`
      INSERT INTO detection_models (
        id, slug, name, type, provider_id, external_model_id, description,
        accuracy, enabled, tier, token_cost, cost_unit, is_default,
        request_spec, response_spec, input_limits, execution_limits,
        runtime_config, config_version
      ) VALUES (
        ${createRecordId()}, ${stringRequired(patch.slug, "slug")},
        ${stringRequired(patch.name, "name")}, ${stringRequired(patch.type, "type")},
        ${nullableString(patch.provider_id)}, ${String(patch.external_model_id ?? "")},
        ${String(patch.description ?? "")}, ${Number(patch.accuracy ?? 0)},
        ${patch.enabled === undefined ? true : Boolean(patch.enabled)},
        ${String(patch.tier ?? "check")}, ${Number(patch.token_cost ?? 1)},
        ${String(patch.cost_unit ?? "per_scan")}, ${Boolean(patch.is_default ?? false)},
        ${dbJson((patch.request_spec as Record<string, unknown>) ?? {})},
        ${dbJson((patch.response_spec as Record<string, unknown>) ?? { preset: "generic" })},
        ${dbJson((patch.input_limits as Record<string, unknown>) ?? {})},
        ${dbJson((patch.execution_limits as Record<string, unknown>) ?? {})},
        ${dbJson((patch.runtime_config as Record<string, unknown>) ?? {})},
        ${Number(patch.config_version ?? 1)}
      )
      RETURNING *, NULL::text AS provider_key, NULL::text AS provider_driver
    `;
    return mapModel(await hydrateModelProvider(rows[0]!));
  }

  private async updateModel(id: string, body: WriteBody): Promise<PocketRecord> {
    this.assertAdmin();
    const { data } = await normalizeWriteBody(body);
    const patch = await modelPatch(data);
    if (patch.request_spec !== undefined) parseRequestSpec(patch.request_spec);
    if (patch.response_spec !== undefined) parseResponseSpec(patch.response_spec);
    delete (patch as Record<string, unknown>).slug;
    if (Object.keys(patch).length > 0) {
      patch.config_version = Number(patch.config_version ?? (await currentModelVersion(id)) + 1);
      await unsafeUpdate("detection_models", id, patch, MODEL_JSON_COLUMNS);
    }
    const rows = await sql<ModelJoinRow[]>`
      SELECT m.*, p.key AS provider_key, p.driver AS provider_driver
      FROM detection_models m LEFT JOIN providers p ON p.id = m.provider_id
      WHERE m.id = ${id}
    `;
    if (!rows[0]) notFound();
    return mapModel(rows[0]!);
  }

  private async createSession(body: WriteBody): Promise<PocketRecord> {
    this.assertAdmin();
    const { data } = await normalizeWriteBody(body);
    const userId = stringRequired(data.userId ?? data.user_id, "userId");
    const tokenHash = stringRequired(data.tokenHash ?? data.token_hash, "tokenHash");
    const expiresAt = stringRequired(data.expiresAt ?? data.expires_at, "expiresAt");
    const rows = await sql<SessionRow[]>`
      INSERT INTO sessions (
        id, user_id, token_hash, refresh_token_hash, expires_at,
        refresh_expires_at, ip_address, user_agent, device, metadata
      ) VALUES (
        ${createRecordId()}, ${userId}, ${tokenHash},
        ${nullableString(data.refreshTokenHash ?? data.refresh_token_hash)}, ${expiresAt},
        ${nullableString(data.refreshExpiresAt ?? data.refresh_expires_at)},
        ${nullableString(data.ipAddress ?? data.ip_address)},
        ${nullableString(data.userAgent ?? data.user_agent)},
        ${String(data.device ?? "")},
        ${dbJson(isRecord(data.metadata) ? data.metadata : {})}
      ) RETURNING *
    `;
    return mapSession(rows[0]!);
  }

  private async deleteSession(id: string): Promise<void> {
    const rows = await sql<{ user_id: string }[]>`SELECT user_id FROM sessions WHERE id = ${id}`;
    if (!rows[0]) notFound();
    if (!this.store.isAdmin && !isAdminActor(this.store.actor) && rows[0].user_id !== this.store.actor?.id) deny();
    await sql`UPDATE sessions SET revoked_at = now(), updated_at = now() WHERE id = ${id}`;
  }

  private async upsertSecrets(body: WriteBody): Promise<PocketRecord> {
    this.assertAdmin();
    const { data } = await normalizeWriteBody(body);
    const pairs: Array<[string, unknown]> = [
      ["huggingface", data.huggingfaceToken],
      ["velma", data.velmaApiKey],
    ];
    for (const [key, value] of pairs) {
      if (typeof value !== "string") continue;
      const encrypted = value.trim() ? encryptCredential(value.trim()) : null;
      await sql`
        UPDATE providers
        SET credential_ciphertext = ${encrypted},
            credential_hint = ${value.trim() ? credentialHint(value.trim()) : ""},
            updated_at = now()
        WHERE key = ${key} AND deleted_at IS NULL
      `;
    }
    return (await this.readSecrets())[0] ?? {
      id: "service-secrets", collectionName: "service_secrets",
    };
  }

  private assertAdmin(): void {
    if (!this.store.isAdmin && !isAdminActor(this.store.actor)) deny();
  }
}

function collectionKind(
  name: string,
): "users" | "providers" | "models" | "sessions" | "secrets" | "app" {
  if (name === "users") return "users";
  if (name === "providers" || name === "model_providers") return "providers";
  if (name === "detection_models" || name === "models") return "models";
  if (name === "sessions" || name === "_authOrigins") return "sessions";
  if (name === "service_secrets") return "secrets";
  return "app";
}

async function normalizeWriteBody(body: WriteBody): Promise<{
  data: Record<string, unknown>;
  files: Map<string, File>;
}> {
  const data: Record<string, unknown> = {};
  const files = new Map<string, File>();
  const entries = body instanceof FormData ? Array.from(body.entries()) : Object.entries(body);
  for (const [key, value] of entries) {
    if (["id", "collectionId", "collectionName", "created", "updated", "expand"].includes(key)) continue;
    if (value instanceof File) {
      if (value.size > 0) files.set(key, value);
      continue;
    }
    data[key] = body instanceof FormData ? coerceFormValue(key, String(value)) : value;
  }
  return { data, files };
}

async function attachFiles(
  actor: StoreActor | null,
  collection: string,
  recordId: string,
  data: Record<string, unknown>,
  files: Map<string, File>,
): Promise<void> {
  for (const [fieldName, file] of files) {
    const stored = await persistUpload({ actor, collection, recordId, fieldName, file });
    data[fieldName] = stored.originalName;
    data[`${fieldName}FileId`] = stored.id;
    if (fieldName === "file") {
      data.mimeType = file.type || "application/octet-stream";
      data.sizeBytes = file.size;
      data.fileHash = stored.sha256;
    }
  }
}

function injectActorOwnership(
  collection: string,
  data: Record<string, unknown>,
  actor: StoreActor | null,
): void {
  if (!actor) return;
  if (PERSONAL_COLLECTIONS.has(collection) || collection === "scans" || collection === "collections") {
    data.userId ??= actor.id;
  }
  if (collection === "collection_items") data.addedBy ??= actor.id;
  if (collection === "collection_activities") data.actor ??= actor.id;
  if (collection === "presence") data.userId ??= actor.id;
  if (collection === "teams") data.manager ??= actor.id;
}

function coerceFormValue(key: string, value: string): unknown {
  if (FORM_JSON_FIELDS.has(key)) {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }
  if (FORM_BOOLEAN_FIELDS.has(key)) return value === "true" || value === "1";
  if (FORM_NUMBER_FIELDS.has(key) && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return value;
}

const FORM_JSON_FIELDS = new Set([
  "prefs", "sites", "platforms", "notifications", "privacy", "hotkeys", "flags",
  "useCases", "connections", "tags", "breakdown", "analysis", "error", "engineResults",
  "payload", "state", "config", "requestSpec", "responseSpec", "inputLimits",
  "executionLimits", "runtimeConfig",
]);
const FORM_BOOLEAN_FIELDS = new Set([
  "verified", "mfa", "onboardingCompleted", "archived", "pinned", "enabled", "isDefault",
  "isLocal", "modelTraining", "anonymousAnalytics", "publicProfile", "showAuthenticVerdicts",
  "autoModelMode",
]);
const FORM_NUMBER_FIELDS = new Set([
  "number", "accuracy", "tokenCost", "confidence", "aiPct", "sizeBytes", "durationMs",
  "wordCount", "scanDurationMs", "analysisVersion", "creditsUsed", "version", "seatLimit",
  "customMonthlyLimit", "monthlyTokenLimit", "configVersion",
]);

function userPatch(data: Record<string, unknown>, privileged: boolean): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [input, column] of Object.entries(USER_COLUMN_MAP)) {
    if (!Object.prototype.hasOwnProperty.call(data, input)) continue;
    if (!privileged && USER_PRIVILEGED_COLUMNS.has(column)) {
      throw new StoreError(403, "forbidden_field", `Field ${input} is admin-managed`);
    }
    let value = data[input];
    if (column === "email" && typeof value === "string") value = value.trim().toLowerCase();
    patch[column] = value;
  }
  return patch;
}

const USER_COLUMN_MAP: Record<string, string> = {
  email: "email", verified: "email_verified", emailVerified: "email_verified",
  googleSubject: "google_subject", passwordHash: "password_hash", name: "name", handle: "handle",
  avatarUrl: "avatar_url", timezone: "timezone", language: "language", plan: "plan",
  planCycle: "plan_cycle", planBadge: "plan_badge", planRenewsOn: "plan_renews_on",
  billingEmail: "billing_email", billingAddress: "billing_address", billingCountry: "billing_country",
  taxId: "tax_id", paymentBrand: "payment_brand", paymentLast4: "payment_last4",
  paymentExpires: "payment_expires", stripeCustomerId: "stripe_customer_id",
  stripeSubscriptionId: "stripe_subscription_id", pendingPlan: "pending_plan",
  pendingPlanCycle: "pending_plan_cycle", pendingPlanEffective: "pending_plan_effective",
  mfa: "mfa_enabled", mfaEnabled: "mfa_enabled", onboardingCompleted: "onboarding_completed",
  role: "role", systemRole: "system_role", useCases: "use_cases", connections: "connections",
  status: "status", state: "state", customMonthlyLimit: "custom_monthly_limit",
  monthlyTokenLimit: "custom_monthly_limit",
};
const USER_PRIVILEGED_COLUMNS = new Set([
  "email_verified", "google_subject", "password_hash", "plan", "plan_cycle", "plan_badge",
  "plan_renews_on", "stripe_customer_id", "stripe_subscription_id", "pending_plan",
  "pending_plan_cycle", "pending_plan_effective", "system_role", "status", "custom_monthly_limit",
]);
const USER_JSON_COLUMNS = new Set(["use_cases", "connections", "state"]);

function providerPatch(data: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, string> = {
    key: "key", name: "name", kind: "driver", driver: "driver", baseUrl: "base_url",
    authType: "auth_scheme", authScheme: "auth_scheme", config: "config", enabled: "enabled",
    isLocal: "is_local",
  };
  return mappedPatch(data, map);
}
const PROVIDER_JSON_COLUMNS = new Set(["config"]);

async function modelPatch(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const map: Record<string, string> = {
    slug: "slug", name: "name", type: "type", providerId: "provider_id",
    modelIdentifier: "external_model_id", externalModelId: "external_model_id", hfModelId: "external_model_id",
    description: "description", accuracy: "accuracy", enabled: "enabled", tier: "tier",
    tokenCost: "token_cost", costUnit: "cost_unit", isDefault: "is_default",
    requestTemplate: "request_spec", requestSpec: "request_spec", responseMapping: "response_spec",
    responseSpec: "response_spec", inputLimits: "input_limits", executionLimits: "execution_limits",
    runtimeConfig: "runtime_config", configVersion: "config_version",
  };
  const patch = mappedPatch(data, map);
  if (typeof data.endpointPath === "string") {
    patch.request_spec = { ...(isRecord(patch.request_spec) ? patch.request_spec : {}), path: data.endpointPath };
  }
  if (!patch.provider_id && typeof data.provider === "string") {
    patch.provider_id = await providerIdForLegacy(data.provider);
  }
  if (!patch.provider_id && typeof data.providerKey === "string") {
    patch.provider_id = await providerIdForLegacy(data.providerKey);
  }
  if (data.videoFrameModelSlug || data.videoFrameCount) {
    patch.runtime_config = {
      ...(isRecord(patch.runtime_config) ? patch.runtime_config : {}),
      pipeline: "video-frames",
      ...(data.videoFrameModelSlug ? { frameModelSlug: data.videoFrameModelSlug } : {}),
      ...(data.videoFrameCount ? { frameCount: Number(data.videoFrameCount) } : {}),
    };
  }
  return patch;
}
const MODEL_JSON_COLUMNS = new Set([
  "request_spec", "response_spec", "input_limits", "execution_limits", "runtime_config",
]);

function mappedPatch(
  data: Record<string, unknown>,
  map: Record<string, string>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [input, column] of Object.entries(map)) {
    if (Object.prototype.hasOwnProperty.call(data, input)) patch[column] = data[input];
  }
  return patch;
}

async function providerIdForLegacy(value: string): Promise<string | null> {
  const normalized = value === "hf-inference" ? "huggingface" : value;
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM providers WHERE key = ${normalized} AND deleted_at IS NULL LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function currentModelVersion(id: string): Promise<number> {
  const rows = await sql<{ config_version: number }[]>`
    SELECT config_version FROM detection_models WHERE id = ${id}
  `;
  if (!rows[0]) notFound();
  return Number(rows[0]!.config_version || 1);
}

async function hydrateModelProvider(row: ModelJoinRow): Promise<ModelJoinRow> {
  if (!row.provider_id) return row;
  const providers = await sql<{ key: string; driver: string }[]>`
    SELECT key, driver FROM providers WHERE id = ${row.provider_id}
  `;
  return { ...row, provider_key: providers[0]?.key ?? null, provider_driver: providers[0]?.driver ?? null };
}

async function publicUserForRelation(
  id: string,
  includeEmail: boolean,
): Promise<PocketRecord | null> {
  const rows = await sql<(Pick<UserRow,
    "id" | "email" | "name" | "handle" | "avatar_file_id" | "avatar_url" | "created_at" | "updated_at"
  > & { avatar_name: string | null })[]>`
    SELECT
      u.id, u.email, u.name, u.handle, u.avatar_file_id, u.avatar_url,
      u.created_at, u.updated_at, f.original_name AS avatar_name
    FROM users u
    LEFT JOIN files f ON f.id = u.avatar_file_id AND f.deleted_at IS NULL
    WHERE u.id = ${id} AND u.deleted_at IS NULL AND u.status = 'active'
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    collectionId: "users",
    collectionName: "users",
    name: row.name,
    handle: row.handle,
    ...(includeEmail ? { email: row.email } : {}),
    avatar: row.avatar_name ?? "",
    avatarFileId: row.avatar_file_id ?? "",
    avatarUrl: row.avatar_url,
    created: iso(row.created_at),
    updated: iso(row.updated_at),
  };
}

async function unsafeUpdate(
  table: "users" | "providers" | "detection_models",
  id: string,
  patch: Record<string, unknown>,
  jsonColumns: Set<string>,
): Promise<void> {
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  for (const key of keys) {
    if (!/^[a-z_][a-z0-9_]*$/.test(key)) {
      throw new StoreError(400, "invalid_field", `Invalid database field ${key}`);
    }
  }
  const values = keys.map((key) =>
    jsonColumns.has(key) ? JSON.stringify(patch[key] ?? null) : patch[key],
  );
  const assignments = keys
    .map((key, index) => `"${key}" = $${index + 1}${jsonColumns.has(key) ? "::jsonb" : ""}`)
    .join(", ");
  values.push(id);
  await sql.unsafe(
    `UPDATE "${table}" SET ${assignments}, updated_at = now() WHERE id = $${values.length}`,
    values as UnsafeParameters,
  );
}

type PostgresJsonValue = Parameters<typeof sql.json>[0];
type UnsafeParameters = NonNullable<Parameters<typeof sql.unsafe>[1]>;

function dbJson(value: unknown) {
  return sql.json(value as PostgresJsonValue);
}

function mapUser(row: UserRow): PocketRecord {
  return {
    id: row.id,
    collectionId: "users",
    collectionName: "users",
    email: row.email,
    verified: row.email_verified,
    name: row.name,
    handle: row.handle,
    avatar: row.avatar_name ?? "",
    avatarFileId: row.avatar_file_id ?? "",
    avatarUrl: row.avatar_url,
    timezone: row.timezone,
    language: row.language,
    plan: row.plan,
    planCycle: row.plan_cycle ?? "",
    planBadge: row.plan_badge,
    planRenewsOn: isoOrEmpty(row.plan_renews_on),
    billingEmail: row.billing_email,
    billingAddress: row.billing_address,
    billingCountry: row.billing_country,
    taxId: row.tax_id,
    paymentBrand: row.payment_brand,
    paymentLast4: row.payment_last4,
    paymentExpires: row.payment_expires,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    pendingPlan: row.pending_plan ?? "",
    pendingPlanCycle: row.pending_plan_cycle ?? "",
    pendingPlanEffective: isoOrEmpty(row.pending_plan_effective),
    mfa: row.mfa_enabled,
    onboardingCompleted: row.onboarding_completed,
    role: row.role,
    systemRole: row.system_role,
    useCases: row.use_cases,
    connections: row.connections,
    status: row.status,
    state: row.state,
    customMonthlyLimit: row.custom_monthly_limit === null ? null : Number(row.custom_monthly_limit),
    monthlyTokenLimit: row.custom_monthly_limit === null ? null : Number(row.custom_monthly_limit),
    created: iso(row.created_at),
    updated: iso(row.updated_at),
  };
}

function mapProvider(row: ProviderRow): PocketRecord {
  return {
    id: row.id,
    collectionId: "providers",
    collectionName: "providers",
    key: row.key,
    name: row.name,
    kind: row.driver,
    driver: row.driver,
    baseUrl: row.base_url,
    authType: row.auth_scheme,
    authScheme: row.auth_scheme,
    credential: row.credential_hint,
    credentialHint: row.credential_hint,
    config: row.config,
    enabled: row.enabled,
    isLocal: row.is_local,
    created: iso(row.created_at),
    updated: iso(row.updated_at),
  };
}

function mapModel(row: ModelJoinRow): PocketRecord {
  const runtime = row.runtime_config ?? {};
  const request = row.request_spec ?? {};
  const provider = row.provider_key === "huggingface" ? "hf-inference" : row.provider_key ?? "";
  return {
    id: row.id,
    collectionId: "detection_models",
    collectionName: "detection_models",
    slug: row.slug,
    name: row.name,
    type: row.type,
    providerId: row.provider_id ?? "",
    provider,
    providerKey: row.provider_key ?? "",
    modelIdentifier: row.external_model_id,
    externalModelId: row.external_model_id,
    hfModelId: row.external_model_id,
    endpointPath: typeof request.path === "string" ? request.path : "",
    description: row.description,
    accuracy: Number(row.accuracy),
    enabled: row.enabled,
    tier: row.tier,
    tokenCost: Number(row.token_cost),
    costUnit: row.cost_unit,
    isDefault: row.is_default,
    requestTemplate: request,
    requestSpec: request,
    responseMapping: row.response_spec,
    responseSpec: row.response_spec,
    inputLimits: row.input_limits,
    executionLimits: row.execution_limits,
    runtimeConfig: runtime,
    videoFrameModelSlug: typeof runtime.frameModelSlug === "string" ? runtime.frameModelSlug : "",
    videoFrameCount: Number(runtime.frameCount ?? 0),
    configVersion: row.config_version,
    archived: Boolean(row.archived_at),
    created: iso(row.created_at),
    updated: iso(row.updated_at),
  };
}

function mapSession(row: SessionRow): PocketRecord {
  return {
    id: row.id,
    collectionId: "_authOrigins",
    collectionName: "_authOrigins",
    collectionRef: "users",
    recordRef: row.user_id,
    fingerprint: createHash("sha256").update(row.id).digest("hex").slice(0, 16),
    device: row.device,
    ipAddress: row.ip_address ?? "",
    userAgent: row.user_agent ?? "",
    expiresAt: iso(row.expires_at),
    revokedAt: isoOrEmpty(row.revoked_at),
    metadata: row.metadata,
    created: iso(row.created_at),
    updated: iso(row.updated_at),
  };
}

function mapAppRecord(row: AppRow): PocketRecord {
  return {
    ...row.data,
    id: row.id,
    collectionId: row.collection,
    collectionName: row.collection,
    created: iso(row.created_at),
    updated: iso(row.updated_at),
    _version: row.version,
  };
}

function policyFromRow(row: AppRow): PolicyRecord {
  return { id: row.id, collection: row.collection, ownerId: row.owner_id, data: row.data };
}

function mapDatabaseError(error: unknown): StoreError {
  const code = isRecord(error) ? String(error.code ?? "") : "";
  if (code === "23505") {
    return new StoreError(400, "validation_not_unique", "A record with these values already exists", {
      value: { code: "validation_not_unique" },
    });
  }
  if (code === "23503") return new StoreError(400, "invalid_relation", "A related record does not exist");
  if (code === "23514") return new StoreError(400, "validation_invalid", "A field value is invalid");
  return error instanceof StoreError
    ? error
    : new StoreError(500, "database_error", error instanceof Error ? error.message : String(error));
}

function decryptOptional(value: string | null | undefined): string {
  if (!value) return "";
  return decryptCredential(value);
}

function validateCollectionName(name: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || name.length > 100) {
    throw new StoreError(400, "invalid_collection", "Invalid collection name");
  }
}

function stringRequired(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new StoreError(400, "validation_required", `${field} is required`);
  }
  return value.trim();
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isoOrEmpty(value: Date | string | null): string {
  return value ? iso(value) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function notFound(): never {
  throw new StoreError(404, "not_found", "Record not found");
}

function deny(): never {
  throw new StoreError(403, "forbidden", "You do not have access to this operation");
}

function unauthorized(): never {
  throw new StoreError(401, "unauthorized", "Authentication required");
}

type AppRow = {
  id: string;
  collection: string;
  owner_id: string | null;
  data: Record<string, unknown>;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
};

type UserRow = {
  id: string;
  email: string;
  email_verified: boolean;
  avatar_file_id: string | null;
  avatar_name?: string | null;
  avatar_url: string;
  name: string;
  handle: string;
  timezone: string;
  language: string;
  plan: string;
  plan_cycle: string | null;
  plan_badge: string;
  plan_renews_on: Date | string | null;
  billing_email: string;
  billing_address: string;
  billing_country: string;
  tax_id: string;
  payment_brand: string;
  payment_last4: string;
  payment_expires: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  pending_plan: string | null;
  pending_plan_cycle: string | null;
  pending_plan_effective: Date | string | null;
  mfa_enabled: boolean;
  onboarding_completed: boolean;
  role: string;
  system_role: string;
  use_cases: unknown[];
  connections: unknown[];
  status: string;
  state: Record<string, unknown>;
  custom_monthly_limit: string | number | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ProviderRow = {
  id: string;
  key: string;
  name: string;
  driver: string;
  base_url: string;
  auth_scheme: string;
  credential_ciphertext: string | null;
  credential_hint: string;
  config: Record<string, unknown>;
  enabled: boolean;
  is_local: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type ModelJoinRow = {
  id: string;
  slug: string;
  name: string;
  type: string;
  provider_id: string | null;
  provider_key: string | null;
  provider_driver: string | null;
  external_model_id: string;
  description: string;
  accuracy: number | string;
  enabled: boolean;
  tier: string;
  token_cost: number | string;
  cost_unit: string;
  is_default: boolean;
  request_spec: Record<string, unknown>;
  response_spec: Record<string, unknown>;
  input_limits: Record<string, unknown>;
  execution_limits: Record<string, unknown>;
  runtime_config: Record<string, unknown>;
  config_version: number;
  archived_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type SessionRow = {
  id: string;
  user_id: string;
  device: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  metadata: Record<string, unknown>;
  created_at: Date | string;
  updated_at: Date | string;
};
