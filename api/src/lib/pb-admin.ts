import PocketBase from "pocketbase";
import { env } from "../env.js";

/** PocketBase client authenticated as a superuser. Used by the webhook
 *  handler to write across user records (RLS would block per-user
 *  rules during async event processing).
 *
 *  We auth lazily on first call and reuse the token until PB rejects
 *  it; on rejection we re-auth once. Avoids re-logging in every event.
 */

let _pb: PocketBase | null = null;
let _authedAt: number = 0;
let _inflightAuth: Promise<void> | null = null;
const TOKEN_TTL_MS = 14 * 60 * 1000; // PB superuser token lives ~15min

async function ensureAuthed(): Promise<PocketBase> {
  if (!env.PB_ADMIN_EMAIL || !env.PB_ADMIN_PASSWORD) {
    throw new Error(
      "PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD missing — webhook can't write to PB.",
    );
  }
  if (!_pb) _pb = new PocketBase(env.POCKETBASE_URL);
  // PB's auto-cancel uses a request key per call, so two concurrent
  // routes that both find the token stale will both fire authWithPassword
  // and the second will abort the first. Share the in-flight promise so
  // we only ever auth once at a time.
  const stale = Date.now() - _authedAt > TOKEN_TTL_MS;
  if (stale || !_pb.authStore.isValid) {
    if (!_inflightAuth) {
      _inflightAuth = (async () => {
        try {
          await _pb!
            .collection("_superusers")
            .authWithPassword(env.PB_ADMIN_EMAIL!, env.PB_ADMIN_PASSWORD!, {
              // disable auto-cancel for this call so a parallel request
              // with the same default key can't abort our auth.
              requestKey: null,
            });
          _authedAt = Date.now();
        } finally {
          _inflightAuth = null;
        }
      })();
    }
    await _inflightAuth;
  }
  return _pb;
}

export async function pbAdmin(): Promise<PocketBase> {
  return ensureAuthed();
}
