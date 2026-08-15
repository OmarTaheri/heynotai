"use client";

import { backend } from "./backend";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export type HomeStats = {
  monthLabel: string;
  prevMonthLabel: string;
  scans: { current: number; previous: number; deltaPct: number };
  flagged: { count: number; percent: number };
  timeSavedHours: number;
  monitorAlerts: { count: number; newToday: number };
  /** Rolling 7-day scan count. Drives the extension page's status card. */
  scansLast7Days: number;
};

function authHeaders(): Record<string, string> {
  const token = backend.authStore.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchHomeStats(): Promise<HomeStats | null> {
  const res = await fetch(`${API_URL}/me/stats`, { headers: authHeaders() });
  if (!res.ok) return null;
  return (await res.json()) as HomeStats;
}
