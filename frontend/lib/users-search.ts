"use client";

import { pb } from "./pocketbase";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export type SearchedUser = {
  id: string;
  name: string;
  handle: string;
  email: string;
  avatarUrl: string | null;
};

export class UserSearchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "UserSearchError";
    this.status = status;
  }
}

/** Search users on the API (which uses PB superuser to bypass the closed
 *  list rule and return only public-safe profile fields). The caller
 *  must already be authenticated — the API rejects unauthenticated
 *  requests. The optional `signal` lets the caller cancel an in-flight
 *  search when the query changes. */
export async function searchUsers(
  query: string,
  options: { signal?: AbortSignal; limit?: number } = {},
): Promise<SearchedUser[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const params = new URLSearchParams({ q: trimmed });
  if (options.limit) params.set("limit", String(options.limit));
  const token = pb.authStore.token;
  const r = await fetch(`${API_URL}/me/users/search?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: options.signal,
  });
  if (!r.ok) {
    throw new UserSearchError("Couldn't search users.", r.status);
  }
  const data = (await r.json()) as { users?: SearchedUser[] };
  return data.users ?? [];
}
