import PocketBase from "pocketbase";
import { env } from "../env.js";

/** Per-request PocketBase client.
 *
 *  PB's JS SDK keeps auth state on the instance — sharing one across
 *  requests would leak the previous caller's token into the next call.
 *  We make a fresh client per request and re-hydrate it from the
 *  Authorization header. */
export function pbForRequest(authHeader: string | null) {
  const pb = new PocketBase(env.POCKETBASE_URL);
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    pb.authStore.save(token, null);
  }
  return pb;
}
