import { sql } from "./client.js";
import { StoreError, type StoreActor } from "./store-types.js";

export type PolicyRecord = {
  id: string;
  collection: string;
  ownerId: string | null;
  data: Record<string, unknown>;
};

const PERSONAL = new Set([
  "notification_prefs",
  "privacy_prefs",
  "appearance_prefs",
  "extension_prefs",
  "data_exports",
]);

export function isAdminActor(actor: StoreActor | null): boolean {
  const role = actor?.systemRole ?? actor?.system_role;
  return role === "admin" || role === "owner";
}

export function ownerIdFor(
  collection: string,
  data: Record<string, unknown>,
  actor: StoreActor | null,
): string | null {
  const explicit = stringValue(data.userId);
  if (explicit) return explicit;
  if (collection === "collections" || collection === "scans" || PERSONAL.has(collection)) {
    return actor?.id ?? null;
  }
  for (const field of ["actor", "addedBy", "invitedBy", "manager", "user"]) {
    const value = stringValue(data[field]);
    if (value) return value;
  }
  return actor?.id ?? null;
}

export async function canReadRecord(
  actor: StoreActor | null,
  record: PolicyRecord,
  admin = false,
): Promise<boolean> {
  if (admin || isAdminActor(actor)) return true;
  if (!actor) {
    // `updates` is the public changelog — system-authored, no user data,
    // and served anonymously so the RSS feed at /updates/rss.xml works
    // without credentials.
    if (record.collection === "updates") return true;
    return record.collection === "scans" && record.data.visibility === "public";
  }
  const userId = actor.id;

  if (record.collection === "updates") return true;
  if (PERSONAL.has(record.collection) || record.collection === "invoices") {
    return record.ownerId === userId || record.data.userId === userId;
  }
  if (record.collection === "scans") return canReadScan(actor, record);
  if (record.collection === "collections") return canAccessCollection(userId, record.id, record);
  if (record.collection === "collection_members") {
    return (
      record.data.userId === userId ||
      record.data.invitedBy === userId ||
      (await isCollectionOwner(userId, stringValue(record.data.collection)))
    );
  }
  if (record.collection === "collection_items" || record.collection === "collection_activities") {
    return canAccessCollection(userId, stringValue(record.data.collection));
  }
  if (record.collection === "presence") {
    return canReadScanById(actor, stringValue(record.data.scanId));
  }
  if (record.collection === "teams") return record.data.manager === userId;
  if (record.collection === "team_members") {
    return record.data.user === userId || isTeamManager(userId, stringValue(record.data.team));
  }
  return record.ownerId === userId;
}

export async function assertCanCreate(
  actor: StoreActor | null,
  collection: string,
  data: Record<string, unknown>,
  admin = false,
): Promise<void> {
  if (admin || isAdminActor(actor)) return;
  if (!actor) deny();
  const userId = actor!.id;

  if (PERSONAL.has(collection)) {
    if (data.userId === userId) return;
    deny();
  }
  if (collection === "scans" || collection === "collections") {
    if (data.userId === userId) return;
    deny();
  }
  if (collection === "collection_members") {
    if (
      data.invitedBy === userId &&
      (await isCollectionOwner(userId, stringValue(data.collection)))
    ) return;
    deny();
  }
  if (collection === "collection_items") {
    if (
      data.addedBy === userId &&
      (await canAccessCollection(userId, stringValue(data.collection)))
    ) return;
    deny();
  }
  if (collection === "collection_activities") {
    if (
      data.actor === userId &&
      (await canAccessCollection(userId, stringValue(data.collection)))
    ) return;
    deny();
  }
  if (collection === "presence") {
    if (data.userId === userId && (await canReadScanById(actor, stringValue(data.scanId)))) return;
    deny();
  }
  if (collection === "teams") {
    if (data.manager === userId) return;
    deny();
  }
  if (collection === "team_members") {
    if (await isTeamManager(userId, stringValue(data.team))) return;
    deny();
  }
  // Invoices/updates are system-authored. Unknown collections are closed.
  deny();
}

export async function assertCanUpdate(
  actor: StoreActor | null,
  record: PolicyRecord,
  nextData: Record<string, unknown>,
  admin = false,
): Promise<void> {
  if (admin || isAdminActor(actor)) return;
  if (!actor) deny();
  const userId = actor!.id;
  if (record.collection === "data_exports") deny();
  if (PERSONAL.has(record.collection) || record.collection === "scans") {
    if ((record.ownerId === userId || record.data.userId === userId) && nextData.userId === record.data.userId) return;
    deny();
  }
  if (record.collection === "collections") {
    if (record.data.userId === userId && nextData.userId === userId) return;
    deny();
  }
  if (record.collection === "collection_members") {
    const owner = await isCollectionOwner(userId, stringValue(record.data.collection));
    if (
      (record.data.userId === userId || record.data.invitedBy === userId || owner) &&
      nextData.collection === record.data.collection
    ) return;
    deny();
  }
  if (record.collection === "presence") {
    if (record.data.userId === userId && nextData.userId === userId) return;
    deny();
  }
  if (record.collection === "teams") {
    if (record.data.manager === userId && nextData.manager === userId) return;
    deny();
  }
  if (record.collection === "team_members") {
    if (await isTeamManager(userId, stringValue(record.data.team))) return;
    deny();
  }
  // Join items, activities, invoices, updates, and exports are immutable.
  deny();
}

export async function assertCanDelete(
  actor: StoreActor | null,
  record: PolicyRecord,
  admin = false,
): Promise<void> {
  if (admin || isAdminActor(actor)) return;
  if (!actor) deny();
  const userId = actor!.id;
  if (PERSONAL.has(record.collection) || record.collection === "scans") {
    if (record.ownerId === userId || record.data.userId === userId) return;
    deny();
  }
  if (record.collection === "collections") {
    if (record.data.userId === userId) return;
    deny();
  }
  if (record.collection === "collection_members") {
    if (
      record.data.userId === userId ||
      record.data.invitedBy === userId ||
      (await isCollectionOwner(userId, stringValue(record.data.collection)))
    ) return;
    deny();
  }
  if (record.collection === "collection_items") {
    if (
      record.data.addedBy === userId ||
      (await isCollectionOwner(userId, stringValue(record.data.collection)))
    ) return;
    deny();
  }
  if (record.collection === "presence") {
    if (record.data.userId === userId) return;
    deny();
  }
  if (record.collection === "teams") {
    if (record.data.manager === userId) return;
    deny();
  }
  if (record.collection === "team_members") {
    if (record.data.user === userId || (await isTeamManager(userId, stringValue(record.data.team)))) return;
    deny();
  }
  deny();
}

export async function canReadScanById(
  actor: StoreActor | null,
  scanId: string,
): Promise<boolean> {
  if (!scanId) return false;
  const rows = await sql<AppRow[]>`
    SELECT id, collection, owner_id, data
    FROM app_records
    WHERE id = ${scanId} AND collection = 'scans' AND deleted_at IS NULL
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return false;
  return canReadScan(actor, mapPolicy(row));
}

async function canReadScan(actor: StoreActor | null, scan: PolicyRecord): Promise<boolean> {
  if (scan.data.visibility === "public") return true;
  if (!actor) return false;
  if (scan.ownerId === actor.id || scan.data.userId === actor.id) return true;
  const links = await sql<{ collection_id: string }[]>`
    SELECT data->>'collection' AS collection_id
    FROM app_records
    WHERE collection = 'collection_items'
      AND data->>'scanId' = ${scan.id}
      AND deleted_at IS NULL
  `;
  for (const link of links) {
    if (await canAccessCollection(actor.id, link.collection_id)) return true;
  }
  return false;
}

async function canAccessCollection(
  userId: string,
  collectionId: string,
  known?: PolicyRecord,
): Promise<boolean> {
  if (!collectionId) return false;
  if (known?.data.userId === userId || known?.ownerId === userId) return true;
  if (await isCollectionOwner(userId, collectionId)) return true;
  const rows = await sql<{ found: number }[]>`
    SELECT 1 AS found
    FROM app_records
    WHERE collection = 'collection_members'
      AND data->>'collection' = ${collectionId}
      AND data->>'userId' = ${userId}
      AND data->>'status' = 'accepted'
      AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows.length > 0;
}

async function isCollectionOwner(userId: string, collectionId: string): Promise<boolean> {
  if (!collectionId) return false;
  const rows = await sql<{ found: number }[]>`
    SELECT 1 AS found
    FROM app_records
    WHERE id = ${collectionId}
      AND collection = 'collections'
      AND (owner_id = ${userId} OR data->>'userId' = ${userId})
      AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows.length > 0;
}

async function isTeamManager(userId: string, teamId: string): Promise<boolean> {
  if (!teamId) return false;
  const rows = await sql<{ found: number }[]>`
    SELECT 1 AS found
    FROM app_records
    WHERE id = ${teamId}
      AND collection = 'teams'
      AND data->>'manager' = ${userId}
      AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows.length > 0;
}

function deny(): never {
  throw new StoreError(403, "forbidden", "You do not have access to this record");
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

type AppRow = {
  id: string;
  collection: string;
  owner_id: string | null;
  data: Record<string, unknown>;
};

function mapPolicy(row: AppRow): PolicyRecord {
  return { id: row.id, collection: row.collection, ownerId: row.owner_id, data: row.data };
}
