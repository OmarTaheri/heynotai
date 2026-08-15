import { randomBytes } from "node:crypto";

/** New ids keep application backend's 15-character lowercase shape. */
export function createRecordId(): string {
  // 8 random bytes produce 16 hex chars; trimming one keeps backend compatibility
  // while retaining 60 random bits.
  return randomBytes(8).toString("hex").slice(0, 15);
}

