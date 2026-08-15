import { adminStore, type DatabaseStore } from "../db/store.js";

/** Return a server-owned administrative data store. */
export async function getAdminStore(): Promise<DatabaseStore> {
  return adminStore();
}
