import type PocketBase from "pocketbase";
import type { RecordModel } from "pocketbase";

declare module "hono" {
  interface ContextVariableMap {
    pb: PocketBase;
    user: RecordModel | null;
  }
}
