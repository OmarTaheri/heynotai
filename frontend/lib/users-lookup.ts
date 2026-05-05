"use client";

import { pb } from "./pocketbase";
import type { SearchedUser } from "./users-search";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/** Resolve a batch of user ids to public profile fields. Goes through
 *  the API server because the PB `users` listRule is closed. The API
 *  uses superuser to look up and returns only the public-safe fields.
 *  Caller must be authenticated. */
export async function lookupUsers(ids: string[]): Promise<SearchedUser[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  const token = pb.authStore.token;
  const r = await fetch(
    `${API_URL}/me/users/by-ids?ids=${encodeURIComponent(unique.join(","))}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  if (!r.ok) return [];
  const data = (await r.json()) as { users?: SearchedUser[] };
  return data.users ?? [];
}
