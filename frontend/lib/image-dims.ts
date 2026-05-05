"use client";

export type ImageDims = { width: number; height: number };

/** Reads pixel dimensions out of an image File in the browser, before
 *  upload. Returns `null` on any failure (corrupt file, unsupported
 *  codec, non-image MIME, zero dims) — callers should treat `null` as
 *  "no metadata available" and proceed with the upload anyway. */
export async function readImageDims(file: File): Promise<ImageDims | null> {
  if (!file.type.startsWith("image/")) return null;

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const dims = sanitize(bitmap.width, bitmap.height);
      bitmap.close?.();
      if (dims) return dims;
    } catch {
      // fall through to <img> path
    }
  }

  return readViaImageElement(file);
}

function sanitize(w: number, h: number): ImageDims | null {
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  if (w <= 0 || h <= 0) return null;
  return { width: Math.round(w), height: Math.round(h) };
}

function readViaImageElement(file: File): Promise<ImageDims | null> {
  if (typeof URL === "undefined" || typeof Image === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const cleanup = () => URL.revokeObjectURL(url);
    img.onload = () => {
      const dims = sanitize(img.naturalWidth, img.naturalHeight);
      cleanup();
      resolve(dims);
    };
    img.onerror = () => {
      cleanup();
      resolve(null);
    };
    img.src = url;
  });
}
