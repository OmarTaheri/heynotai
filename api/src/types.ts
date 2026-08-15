import type { DatabaseStore, StoreActor } from "./db/store.js";
import type { AuthSession, AuthUser } from "./services/auth.js";

declare module "hono" {
  interface ContextVariableMap {
    /** Database-store compatibility lane used by the existing API routes. */
    store: DatabaseStore;
    user: StoreActor | null;
    /** Canonical API-owned auth state used by new routes and observability. */
    sessionUser: AuthUser;
    appSession: AuthSession;
    isAdmin: boolean;
    requestId: string;
    requestStartedAt: number;
  }
}
