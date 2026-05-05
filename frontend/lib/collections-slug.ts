/**
 * Convert a free-form title into the URL-safe slug used as the
 * collection's identifier. Strips diacritics, lowercases, collapses
 * runs of non-alphanumerics into single hyphens, trims leading/
 * trailing hyphens, and caps at 60 chars so there's headroom for the
 * `-2`/`-3` suffixes the create helper appends on collision.
 *
 * All-symbol or all-emoji titles fall back to `"untitled"` — the
 * collision retry will then produce `untitled-2`, etc.
 */
export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "untitled";
}
