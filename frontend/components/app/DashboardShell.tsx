"use client";

import type { ReactNode } from "react";
import { AuthGuard } from "./AuthGuard";
import { AppShell } from "./AppShell";
import { HOME_ITEM, NAV_SECTIONS } from "@/lib/app-nav";

/**
 * The single client wrapper that every /app/* page lives inside.
 *
 * Mounted from app/app/layout.tsx, so the sidebar + auth gate persist
 * across navigations between dashboard pages — no remount, no flicker,
 * no per-page boilerplate. Each page just exports its content; the shell
 * provides the chrome.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AppShell sections={NAV_SECTIONS} primaryItem={HOME_ITEM}>
        {children}
      </AppShell>
    </AuthGuard>
  );
}
