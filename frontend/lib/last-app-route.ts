/** Tracks the most recent `/app/<…>` pathname the user visited so the
 *  editor's back button has a deterministic in-app destination — see
 *  `EditorTopBar.tsx`. Stored in sessionStorage so it survives reloads
 *  inside the SPA but doesn't leak across browser sessions. */
const KEY = "heynotai:last-app-route";

export function recordAppRoute(pathname: string) {
  if (typeof window === "undefined") return;
  if (!pathname.startsWith("/app")) return;
  if (pathname === "/app/login") return;
  try {
    sessionStorage.setItem(KEY, pathname);
  } catch {}
}

export function readLastAppRoute(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
