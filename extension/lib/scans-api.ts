import { pb } from './pocketbase';

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:8787';

export const FRONTEND_URL =
  (import.meta.env.VITE_FRONTEND_URL as string | undefined) ??
  'http://localhost:3000';

export type ScanType =
  | 'txt'
  | 'img'
  | 'aud'
  | 'vid'
  | 'web'
  | 'soc'
  | 'fb-vid'
  | 'fb-reel'
  | 'fb-post'
  | 'ig-reel'
  | 'ig-post-img'
  | 'ig-post-vid'
  | 'yt-vid'
  | 'yt-reel';

export type ScanOrigin =
  | 'paste'
  | 'link'
  | 'upload'
  | 'record'
  | 'ext'
  | 'url'
  | 'mon';

export type ScanVerdict = 'human' | 'ai' | 'mixed' | 'unknown';

export type ScanStatus = 'queued' | 'scanning' | 'done' | 'failed';

export interface Scan {
  id: string;
  created: string;
  title: string;
  type: ScanType;
  subtype: string;
  origin: ScanOrigin;
  status: ScanStatus;
  sourceUrl: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  wordCount: number;
  verdict: ScanVerdict;
  confidence: number;
  /** Unified 0..100 AI-generated probability across detector shapes. */
  aiPct: number;
  model: string;
  analysis: Record<string, unknown> | null;
  /** Per-scan flags (suspect spans, cues, etc). The drawer surfaces
   *  the count as the "N detections" sub-label. */
  flags: unknown[];
  file: string;
}

export interface ScansListPage {
  items: Scan[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

export class ScanApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ScanApiError';
    this.status = status;
  }
}

function authHeaders(): Record<string, string> {
  const t = pb.authStore.token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export interface ListScansParams {
  page?: number;
  perPage?: number;
  type?: ScanType;
  origin?: ScanOrigin;
}

export async function listScans(
  params: ListScansParams = {},
): Promise<ScansListPage> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.perPage) q.set('perPage', String(params.perPage));
  if (params.type) q.set('type', params.type);
  if (params.origin) q.set('origin', params.origin);
  const url = `${API_URL}/scans${q.toString() ? `?${q}` : ''}`;
  const r = await fetch(url, { headers: authHeaders() });
  if (!r.ok) {
    throw new ScanApiError(`scans_list_failed_${r.status}`, r.status);
  }
  return (await r.json()) as ScansListPage;
}
