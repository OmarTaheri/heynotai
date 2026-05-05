"use client";

import { pb } from "./pocketbase";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export type HomeStats = {
  monthLabel: string;
  prevMonthLabel: string;
  scans: { current: number; previous: number; deltaPct: number };
  flagged: { count: number; percent: number };
  timeSavedHours: number;
  monitorAlerts: { count: number; newToday: number };
};

function authHeaders(): Record<string, string> {
  const token = pb.authStore.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchHomeStats(): Promise<HomeStats | null> {
  const res = await fetch(`${API_URL}/me/stats`, { headers: authHeaders() });
  if (!res.ok) return null;
  return (await res.json()) as HomeStats;
}
