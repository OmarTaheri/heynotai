"use client";

import { pb } from "./pocketbase";
import type {
  Scan,
  ScanOrigin,
  ScanType,
  ScanVisibility,
  ScansListPage,
} from "./scan-types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export class ScanApiError extends Error {
  status: number;
  detail: unknown;
  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ScanApiError";
    this.status = status;
    this.detail = detail;
  }
}

function authHeaders(): Record<string, string> {
  const token = pb.authStore.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function unwrap<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const detail = await r.json().catch(() => ({}));
    const code =
      detail && typeof detail === "object" && "error" in detail
        ? String((detail as { error: unknown }).error)
        : "request_failed";
    throw new ScanApiError(code, r.status, detail);
  }
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
}

export interface CreateScanInput {
  type: ScanType;
  origin: ScanOrigin;
  title?: string;
  content?: string;
  sourceUrl?: string;
  file?: File;
  width?: number;
  height?: number;
}

export async function createScan(input: CreateScanInput): Promise<Scan> {
  const form = new FormData();
  form.append("type", input.type);
  form.append("origin", input.origin);
  if (input.title) form.append("title", input.title);
  if (input.content) form.append("content", input.content);
  if (input.sourceUrl) form.append("sourceUrl", input.sourceUrl);
  if (input.file) form.append("file", input.file);
  if (typeof input.width === "number") form.append("width", String(input.width));
  if (typeof input.height === "number") form.append("height", String(input.height));
  const r = await fetch(`${API_URL}/scans`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  return unwrap<Scan>(r);
}

export interface ListScansParams {
  page?: number;
  perPage?: number;
  type?: ScanType;
  origin?: ScanOrigin;
  q?: string;
  archived?: boolean;
}

export async function listScans(params: ListScansParams = {}): Promise<ScansListPage> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.perPage) q.set("perPage", String(params.perPage));
  if (params.type) q.set("type", params.type);
  if (params.origin) q.set("origin", params.origin);
  if (params.q) q.set("q", params.q);
  if (params.archived !== undefined) q.set("archived", String(params.archived));
  const url = `${API_URL}/scans${q.toString() ? `?${q}` : ""}`;
  const r = await fetch(url, { headers: authHeaders() });
  return unwrap<ScansListPage>(r);
}

export async function getScan(id: string): Promise<Scan> {
  const r = await fetch(`${API_URL}/scans/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
  });
  return unwrap<Scan>(r);
}

export async function deleteScan(id: string): Promise<void> {
  const r = await fetch(`${API_URL}/scans/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await unwrap<void>(r);
}

export interface UpdateScanInput {
  title?: string;
  notes?: string;
  archived?: boolean;
  pinned?: boolean;
  tags?: string[];
  visibility?: ScanVisibility;
  shareToken?: string;
}

export async function updateScan(id: string, patch: UpdateScanInput): Promise<Scan> {
  const r = await fetch(`${API_URL}/scans/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return unwrap<Scan>(r);
}

/** Re-runs detection on the same scan record. Optional `modelSlug`
 *  overrides the user's plan default — used by the editor's engine
 *  picker so changing the dropdown and clicking Test again actually
 *  uses the chosen model. The backend updates the existing row in
 *  place; we stay on the same /editor/<id> URL and revalidate. */
export async function rescan(id: string, modelSlug?: string): Promise<Scan> {
  let body: FormData | undefined;
  if (modelSlug) {
    body = new FormData();
    body.append("modelSlug", modelSlug);
  }
  const r = await fetch(`${API_URL}/scans/${encodeURIComponent(id)}/rescan`, {
    method: "POST",
    headers: authHeaders(),
    body,
  });
  return unwrap<Scan>(r);
}
