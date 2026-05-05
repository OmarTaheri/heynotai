import { z } from "zod";

export const SCAN_TYPES = ["txt", "img", "aud", "vid", "web", "soc"] as const;
export const ORIGINS = ["paste", "link", "upload", "record", "ext", "url", "mon"] as const;
export const VISIBILITIES = ["private", "unlisted", "public"] as const;

// Platform-specific tags that ride alongside `type` (canonical modality).
// Stored on `scans.subtype` so the editor router can pick a YouTube view
// without sniffing URLs. Mirrors the union in `extension/lib/scans-api.ts`.
export const SCAN_SUBTYPES = [
  "fb-vid",
  "fb-reel",
  "fb-post",
  "ig-reel",
  "ig-post-img",
  "ig-post-vid",
  "yt-vid",
  "yt-reel",
] as const;

export type ScanType = (typeof SCAN_TYPES)[number];
export type ScanOrigin = (typeof ORIGINS)[number];
export type ScanVisibility = (typeof VISIBILITIES)[number];
export type ScanSubtype = (typeof SCAN_SUBTYPES)[number];

export const MAX_FILE_BYTES = 256 * 1024 * 1024; // 256MB — matches PB schema cap
export const MAX_CONTENT_BYTES = 1_000_000;

const ACCEPT_PREFIXES = ["text/", "image/", "audio/", "video/"];
const ACCEPT_EXACT = ["application/pdf"];

/** Validates a MIME against the accept list. PB itself doesn't enforce
 *  this (we set `mimeTypes` empty in the migration so PB allows any),
 *  so the API is the single point of truth and returns a normalized
 *  error envelope instead of PB's raw one. */
export function isAllowedMime(mime: string | undefined | null): boolean {
  if (!mime) return false;
  if (ACCEPT_EXACT.includes(mime)) return true;
  return ACCEPT_PREFIXES.some((p) => mime.startsWith(p));
}

/** Used by `create.ts` after `c.req.parseBody()`. The body is a flat
 *  record, so we coerce strings, then run logical checks. */
export const createScanFormSchema = z
  .object({
    type: z.enum(SCAN_TYPES),
    origin: z.enum(ORIGINS),
    title: z.string().max(200).optional(),
    content: z.string().max(MAX_CONTENT_BYTES).optional(),
    sourceUrl: z.string().url().max(2048).optional(),
    // Platform tag — e.g. `yt-vid` for a YouTube scan that's stored as
    // `type=vid` canonically. Used by the editor to route to a
    // platform-specific view.
    subtype: z.enum(SCAN_SUBTYPES).optional(),
    // Optional override of the default detection model for this user/type.
    // The route resolves the slug → `detection_models` row → HF model.
    modelSlug: z.string().min(1).max(80).optional(),
    // Pixel dimensions extracted in the browser before upload — populated
    // for image kinds so the activity table can show `W × H` instead of
    // bytes. FormData strings, hence `.coerce`.
    width: z.coerce.number().int().positive().max(100000).optional(),
    height: z.coerce.number().int().positive().max(100000).optional(),
    // `file` is handled separately because zod doesn't understand `File`.
  })
  .strict();

export const listScansQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
  type: z.enum(SCAN_TYPES).optional(),
  origin: z.enum(ORIGINS).optional(),
  q: z.string().max(200).optional(),
  archived: z.enum(["true", "false"]).optional(),
});

export const patchScanBodySchema = z
  .object({
    title: z.string().max(200).optional(),
    notes: z.string().max(50_000).optional(),
    archived: z.boolean().optional(),
    pinned: z.boolean().optional(),
    tags: z.array(z.string().max(64)).max(64).optional(),
    visibility: z.enum(VISIBILITIES).optional(),
    shareToken: z.string().max(64).optional(),
  })
  .strict();
