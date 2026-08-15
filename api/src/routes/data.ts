import { Hono, type Context, type Next } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { requireAuth } from "../middleware/auth.js";
import {
  StoreError,
  storeForUser,
  type ListOptions,
  type StoreActor,
} from "../db/store.js";
import { loadStoredFile, verifySignedFileUrl } from "../db/store-files.js";

/** application backend-compatible data lane used while the frontend and extension move
 * to the PostgreSQL backend. Mount at `/data` from the API entrypoint. */
export const data = new Hono();

data.use("*", async (c, next) => {
  const isFileRequest = /(?:^|\/)files\//.test(c.req.path);
  // Media elements cannot attach Authorization headers. Signed file URLs use
  // the unauthenticated lane; callers that do send a bearer token still pass
  // through normal authentication and parent-record authorization.
  if (isFileRequest && !c.req.header("authorization")) return next();
  return requireAuth(c, next);
});

const COLLECTIONS = new Set([
  "users",
  "notification_prefs",
  "privacy_prefs",
  "appearance_prefs",
  "extension_prefs",
  "invoices",
  "updates",
  "teams",
  "team_members",
  "data_exports",
  "scans",
  "collections",
  "collection_members",
  "collection_items",
  "collection_activities",
  "presence",
  "sessions",
  "_authOrigins",
  "detection_models",
  "models",
  "providers",
  "model_providers",
]);

const USER_CREATABLE = new Set([
  "notification_prefs",
  "privacy_prefs",
  "appearance_prefs",
  "extension_prefs",
  "data_exports",
  "collections",
  "collection_items",
  "collection_activities",
  "presence",
  "teams",
  "team_members",
]);

const USER_UPDATABLE = new Set([
  "users",
  "notification_prefs",
  "privacy_prefs",
  "appearance_prefs",
  "extension_prefs",
  "scans",
  "collections",
  "collection_members",
  "presence",
  "teams",
  "team_members",
]);

const USER_DELETABLE = new Set([
  "users",
  "notification_prefs",
  "privacy_prefs",
  "appearance_prefs",
  "extension_prefs",
  "data_exports",
  "scans",
  "collections",
  "collection_members",
  "collection_items",
  "presence",
  "teams",
  "team_members",
  "sessions",
  "_authOrigins",
]);

const WRITE_FIELDS: Record<string, Set<string>> = {
  users: fields(
    "name", "handle", "avatar", "avatarUrl", "timezone", "language", "billingEmail",
    "billingAddress", "billingCountry", "taxId", "paymentBrand", "paymentLast4",
    "paymentExpires", "onboardingCompleted", "role", "useCases", "connections", "mfa",
  ),
  notification_prefs: fields("userId", "prefs"),
  privacy_prefs: fields(
    "userId", "scanRetention", "modelTraining", "anonymousAnalytics", "publicProfile",
  ),
  appearance_prefs: fields("userId", "theme", "dateFormat", "showAuthenticVerdicts"),
  extension_prefs: fields(
    "userId", "mode", "autoModelMode", "scanMode", "sites", "platforms", "notifications",
    "privacy", "hotkeys", "flags",
  ),
  data_exports: fields("userId", "kind", "status"),
  scans: fields("title", "notes", "archived", "pinned", "tags", "visibility", "shareToken"),
  collections: fields("userId", "slug", "title", "description", "tone", "pattern", "pinned"),
  collection_members: fields(
    "collection", "userId", "invitedBy", "invitedEmail", "role", "status", "message",
  ),
  collection_items: fields("collection", "scanId", "addedBy"),
  collection_activities: fields("collection", "actor", "type", "payload"),
  presence: fields("userId", "scanId", "lastSeen"),
  teams: fields("name", "manager", "seatLimit"),
  team_members: fields("team", "user", "role", "invitedBy", "joinedAt"),
};

const UPDATE_FIELDS: Record<string, Set<string>> = {
  ...WRITE_FIELDS,
  notification_prefs: fields("prefs"),
  privacy_prefs: fields("scanRetention", "modelTraining", "anonymousAnalytics", "publicProfile"),
  appearance_prefs: fields("theme", "dateFormat", "showAuthenticVerdicts"),
  extension_prefs: fields(
    "mode", "autoModelMode", "scanMode", "sites", "platforms", "notifications", "privacy",
    "hotkeys", "flags",
  ),
  collections: fields("slug", "title", "description", "tone", "pattern", "pinned"),
  // Recipients only need to accept/reject. Role/invite identity changes stay
  // on the owner-only invite/admin endpoints.
  collection_members: fields("status"),
  presence: fields("lastSeen"),
  teams: fields("name", "seatLimit"),
  team_members: fields("role"),
};

data.get("/files/:collection/:recordId/:fileName", async (c) => {
  try {
    const collection = allowedCollection(c.req.param("collection"));
    const recordId = c.req.param("recordId");
    const fileName = c.req.param("fileName");
    const maybeUser = c.get("user") as StoreActor | null | undefined;
    let store;
    if (maybeUser?.id) {
      store = storeForUser(maybeUser);
      // Bearer-authenticated reads apply ownership/membership to the parent.
      await store.collection(collection).getOne(recordId);
    } else {
      if (
        !verifySignedFileUrl({
          collection,
          recordId,
          fileName,
          expiresAt: c.req.query("exp"),
          signature: c.req.query("sig"),
        })
      ) {
        throw new StoreError(403, "invalid_file_signature", "File URL is invalid or expired");
      }
      // A valid HMAC is the authorization grant. Use an inert actor solely for
      // the file metadata helper; no collection read is performed.
      store = storeForUser({ id: "signed-file-url" });
    }
    const file = await store.files.find(collection, recordId, fileName);
    if (!file) throw new StoreError(404, "file_not_found", "File not found");
    const bytes = await loadStoredFile(file);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

data.get("/:collection", async (c) => {
  try {
    const collection = allowedCollection(c.req.param("collection"));
    const store = storeForUser(actorFromContext(c));
    const page = boundedNumber(c.req.query("page"), 1, 1, 1_000_000);
    const perPage = boundedNumber(c.req.query("perPage"), 30, 1, 500);
    const options = listOptions(c);
    const result = await store.collection(collection).getList(page, perPage, options);
    return c.json(result);
  } catch (error) {
    return errorResponse(c, error);
  }
});

data.get("/:collection/:id", async (c) => {
  try {
    const collection = allowedCollection(c.req.param("collection"));
    const store = storeForUser(actorFromContext(c));
    const record = await store.collection(collection).getOne(c.req.param("id"), listOptions(c));
    return c.json(record);
  } catch (error) {
    return errorResponse(c, error);
  }
});

data.post("/:collection", async (c) => {
  try {
    const collection = allowedCollection(c.req.param("collection"));
    const actor = actorFromContext(c);
    const admin = isAdmin(actor);
    if (!admin && !USER_CREATABLE.has(collection)) {
      throw new StoreError(405, "method_not_allowed", `Cannot create ${collection} records here`);
    }
    const payload = sanitizePayload(collection, await requestBody(c), admin, "create");
    const record = await storeForUser(actor).collection(collection).create(payload);
    return c.json(record, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

data.patch("/:collection/:id", updateRecord);
data.put("/:collection/:id", updateRecord);

data.delete("/:collection/:id", async (c) => {
  try {
    const collection = allowedCollection(c.req.param("collection"));
    const actor = actorFromContext(c);
    if (!isAdmin(actor) && !USER_DELETABLE.has(collection)) {
      throw new StoreError(405, "method_not_allowed", `Cannot delete ${collection} records here`);
    }
    await storeForUser(actor).collection(collection).delete(c.req.param("id"));
    return c.body(null, 204);
  } catch (error) {
    return errorResponse(c, error);
  }
});

async function updateRecord(c: Context) {
  try {
    const collection = allowedCollection(c.req.param("collection"));
    const id = c.req.param("id");
    if (!id) throw new StoreError(400, "invalid_id", "Record id is required");
    const actor = actorFromContext(c);
    const admin = isAdmin(actor);
    if (!admin && !USER_UPDATABLE.has(collection)) {
      throw new StoreError(405, "method_not_allowed", `Cannot update ${collection} records here`);
    }
    const payload = sanitizePayload(collection, await requestBody(c), admin, "update");
    const record = await storeForUser(actor).collection(collection).update(id, payload);
    return c.json(record);
  } catch (error) {
    return errorResponse(c, error);
  }
}

function listOptions(c: Context): ListOptions {
  return {
    filter: c.req.query("filter") || undefined,
    sort: c.req.query("sort") || undefined,
    expand: c.req.query("expand") || undefined,
    fields: c.req.query("fields") || undefined,
    requestKey: null,
  };
}

async function requestBody(c: Context): Promise<Record<string, unknown> | FormData> {
  const type = c.req.header("content-type") ?? "";
  if (type.includes("application/json")) {
    const value = await c.req.json().catch(() => null);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new StoreError(400, "invalid_body", "Expected a JSON object");
    }
    return value as Record<string, unknown>;
  }
  const parsed = await c.req.parseBody({ all: true }).catch(() => null);
  if (!parsed) throw new StoreError(400, "invalid_body", "Could not parse request body");
  const form = new FormData();
  for (const [key, value] of Object.entries(parsed)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (typeof item === "string" || item instanceof File) form.append(key, item);
    }
  }
  return form;
}

function sanitizePayload(
  collection: string,
  payload: Record<string, unknown> | FormData,
  admin: boolean,
  operation: "create" | "update",
): Record<string, unknown> | FormData {
  if (admin) return payload;
  const allowed = operation === "update" ? UPDATE_FIELDS[collection] : WRITE_FIELDS[collection];
  if (!allowed) throw new StoreError(405, "method_not_allowed", `Collection ${collection} is read-only`);
  if (payload instanceof FormData) {
    const clean = new FormData();
    for (const [key, value] of payload.entries()) {
      if (!allowed.has(key)) {
        throw new StoreError(403, "forbidden_field", `Field ${key} is not writable`);
      }
      clean.append(key, value);
    }
    return clean;
  }
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!allowed.has(key)) {
      throw new StoreError(403, "forbidden_field", `Field ${key} is not writable`);
    }
    clean[key] = value;
  }
  return clean;
}

function actorFromContext(c: Context): StoreActor {
  const user = c.get("user") as StoreActor | null | undefined;
  if (!user?.id) throw new StoreError(401, "unauthorized", "Authentication required");
  return user;
}

function isAdmin(actor: StoreActor): boolean {
  const role = actor.systemRole ?? actor.system_role;
  return role === "admin" || role === "owner";
}

function allowedCollection(value: string | undefined): string {
  if (!value || !COLLECTIONS.has(value)) {
    throw new StoreError(404, "collection_not_found", "Collection not found");
  }
  return value;
}

function boundedNumber(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new StoreError(400, "invalid_query", `Number must be between ${min} and ${max}`);
  }
  return parsed;
}

function errorResponse(c: Context, error: unknown) {
  if (error instanceof StoreError) {
    return c.json(
      { error: error.code, message: error.message, data: error.response.data },
      error.status as ContentfulStatusCode,
    );
  }
  console.error("[data] unexpected error", error);
  return c.json({ error: "internal_error" }, 500);
}

function fields(...names: string[]): Set<string> {
  return new Set(names);
}
