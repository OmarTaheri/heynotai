import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { sql } from "./client.js";
import { createRecordId } from "./id.js";
import { StoreError, type StoreActor } from "./store-types.js";

export type StoredFile = {
  id: string;
  ownerId: string | null;
  recordCollection: string;
  recordId: string;
  fieldName: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storagePath: string;
  createdAt: string;
};

type FileRow = {
  id: string;
  owner_id: string | null;
  record_collection: string;
  record_id: string;
  field_name: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: string | number;
  sha256: string;
  storage_path: string;
  created_at: Date | string;
};

export async function persistUpload(input: {
  actor: StoreActor | null;
  collection: string;
  recordId: string;
  fieldName: string;
  file: File;
}): Promise<StoredFile> {
  const id = createRecordId();
  const originalName = safeFileName(input.file.name || `${input.fieldName}.bin`);
  const storedName = `${id}-${originalName}`;
  const root = uploadRoot();
  const directory = resolve(root, safeSegment(input.collection), safeSegment(input.recordId));
  assertWithinRoot(root, directory);
  await mkdir(directory, { recursive: true });
  const storagePath = resolve(directory, storedName);
  assertWithinRoot(root, storagePath);
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await writeFile(storagePath, bytes, { flag: "wx" });

  const rows = await sql<FileRow[]>`
    INSERT INTO files (
      id, owner_id, record_collection, record_id, field_name,
      original_name, stored_name, mime_type, size_bytes, sha256, storage_path
    ) VALUES (
      ${id}, ${input.actor?.id ?? null}, ${input.collection}, ${input.recordId},
      ${input.fieldName}, ${originalName}, ${storedName},
      ${input.file.type || "application/octet-stream"}, ${bytes.byteLength},
      ${sha256}, ${storagePath}
    )
    RETURNING *
  `;
  const row = rows[0];
  if (!row) throw new StoreError(500, "file_persist_failed", "File metadata was not created");
  return mapFile(row);
}

export async function findStoredFile(
  collection: string,
  recordId: string,
  fileName: string,
): Promise<StoredFile | null> {
  const rows = await sql<FileRow[]>`
    SELECT *
    FROM files
    WHERE record_collection = ${collection}
      AND record_id = ${recordId}
      AND (original_name = ${fileName} OR stored_name = ${fileName})
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ? mapFile(rows[0]) : null;
}

export async function findStoredFileById(id: string): Promise<StoredFile | null> {
  const rows = await sql<FileRow[]>`
    SELECT * FROM files WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
  `;
  return rows[0] ? mapFile(rows[0]) : null;
}

export async function loadStoredFile(file: StoredFile): Promise<Buffer> {
  const root = uploadRoot();
  const path = resolve(file.storagePath);
  assertWithinRoot(root, path);
  try {
    return await readFile(path);
  } catch {
    throw new StoreError(404, "file_not_found", "File not found");
  }
}

export function storeFileUrl(
  record: Record<string, unknown>,
  fileName: string,
): string {
  const collection = String(record.collectionName ?? record.collectionId ?? "files");
  const id = String(record.id ?? "");
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const signature = signFileUrl(collection, id, fileName, expiresAt);
  const path = `/data/files/${encodeURIComponent(collection)}/${encodeURIComponent(id)}/${encodeURIComponent(fileName)}`;
  return `${publicApiBase()}${path}?exp=${expiresAt}&sig=${encodeURIComponent(signature)}`;
}

/** Verify a time-limited media URL without exposing a bearer token to an
 * `<img>`, `<audio>`, or `<video>` element. The signature binds collection,
 * record, filename, and expiry, so it cannot be moved to another object. */
export function verifySignedFileUrl(input: {
  collection: string;
  recordId: string;
  fileName: string;
  expiresAt: string | number | undefined;
  signature: string | undefined;
  now?: number;
}): boolean {
  const expiresAt = Number(input.expiresAt);
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + 24 * 60 * 60) {
    return false;
  }
  if (!input.signature || !/^[A-Za-z0-9_-]{43}$/.test(input.signature)) return false;
  const expected = signFileUrl(
    input.collection,
    input.recordId,
    input.fileName,
    expiresAt,
  );
  const actualBuffer = Buffer.from(input.signature, "base64url");
  const expectedBuffer = Buffer.from(expected, "base64url");
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function signFileUrl(
  collection: string,
  recordId: string,
  fileName: string,
  expiresAt: number,
): string {
  return createHmac("sha256", fileUrlSecret())
    .update(`${collection}\n${recordId}\n${fileName}\n${expiresAt}`, "utf8")
    .digest("base64url");
}

function fileUrlSecret(): string {
  // FILE_URL_SECRET should be an independent generated secret. The auth
  // pepper fallback supports deployments upgrading before that variable is
  // added, without making URLs public or predictable.
  const value =
    process.env.FILE_URL_SECRET?.trim() ||
    process.env.AUTH_PASSWORD_PEPPER?.trim();
  if (!value || value.length < 32) {
    throw new StoreError(
      500,
      "file_url_secret_missing",
      "FILE_URL_SECRET (or AUTH_PASSWORD_PEPPER) must be at least 32 characters",
    );
  }
  return value;
}

function publicApiBase(): string {
  const configured =
    process.env.API_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return `http://localhost:${process.env.PORT || "8787"}`;
}

function uploadRoot(): string {
  return resolve(process.env.UPLOAD_DIR?.trim() || resolve(process.cwd(), "uploads"));
}

function assertWithinRoot(rootValue: string, pathValue: string): void {
  const root = resolve(rootValue);
  const path = resolve(pathValue);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    throw new StoreError(400, "invalid_file_path", "File path escapes the upload root");
  }
}

function safeSegment(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100);
  if (!safe) throw new StoreError(400, "invalid_file_path", "Invalid file path segment");
  return safe;
}

function safeFileName(value: string): string {
  const base = value.replace(/^.*[\\/]/, "");
  const safe = base.replace(/[^A-Za-z0-9._ -]/g, "_").replace(/^\.+/, "").slice(0, 180);
  return safe || "upload.bin";
}

function mapFile(row: FileRow): StoredFile {
  return {
    id: row.id,
    ownerId: row.owner_id,
    recordCollection: row.record_collection,
    recordId: row.record_id,
    fieldName: row.field_name,
    originalName: row.original_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    storagePath: row.storage_path,
    createdAt: iso(row.created_at),
  };
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
