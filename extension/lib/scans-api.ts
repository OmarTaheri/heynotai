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
  /** The raw text submitted for a `txt` scan. Only populated for text
   *  modality — file-based scans store bytes in `file` and leave this
   *  empty. The overlay pill renders an excerpt so the user can confirm
   *  *what* was scanned, not just the verdict. */
  content: string;
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

/** Look up the most recent successful scan for a given YouTube URL.
 *  Used by the content script to short-circuit re-scanning a video that
 *  the user already verified — auto-scan is supposed to feel like
 *  "this video has been checked" forever, not "let me re-bill you".
 *
 *  PB collection rules already restrict to the current user, so the
 *  filter doesn't need to mention userId. Returns null on miss. */
export async function findExistingYouTubeScan(
  sourceUrl: string,
): Promise<Scan | null> {
  if (!pb.authStore.isValid) return null;
  const escaped = sourceUrl.replace(/"/g, '\\"');
  try {
    const record = await pb
      .collection('scans')
      .getFirstListItem<Scan>(
        `sourceUrl = "${escaped}" && status = "done"`,
        { sort: '-created' },
      );
    return record;
  } catch {
    // 404 (no match) or 403 (auth lapsed) — both treated as "no cache".
    return null;
  }
}

/** Realtime subscription on the `scans` collection. PB filters events
 *  to records the auth context can read, which (per migration) means
 *  only the user's own scans. Returns an unsubscribe fn.
 *
 *  Both surfaces (drawer Content tab + frontend library page) use this
 *  to flip the working pill the moment a scan transitions
 *  queued → scanning → done. */
export type ScanRealtimeAction = 'create' | 'update' | 'delete';
export interface ScanRealtimeEvent {
  action: ScanRealtimeAction;
  record: Scan;
}

export async function subscribeScans(
  cb: (event: ScanRealtimeEvent) => void,
): Promise<() => void> {
  await pb.collection('scans').subscribe<Scan>('*', (e) => {
    cb({ action: e.action as ScanRealtimeAction, record: e.record });
  });
  return () => {
    void pb.collection('scans').unsubscribe('*');
  };
}
