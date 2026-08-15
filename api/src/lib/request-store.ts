import { storeForUser, type DatabaseStore, type StoreActor } from "../db/store.js";
import { authenticateAccessToken, extractBearerToken } from "../services/auth.js";

/** Create the database compatibility store for a previously authenticated
 * user. Prefer the request `requireAuth` middleware in HTTP handlers. */
export function storeForActor(user: StoreActor): DatabaseStore {
  return storeForUser(user);
}

/** Transitional helper for code that only has an Authorization header. */
export async function storeForRequest(authHeader: string | null): Promise<DatabaseStore | null> {
  const token = extractBearerToken(authHeader ?? undefined);
  if (!token) return null;
  const auth = await authenticateAccessToken(token);
  if (!auth) return null;
  return storeForUser({
    id: auth.user.id,
    email: auth.user.email,
    role: auth.user.systemRole,
    systemRole: auth.user.systemRole,
    system_role: auth.user.systemRole,
  });
}
