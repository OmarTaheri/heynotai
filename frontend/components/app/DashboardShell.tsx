"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthGuard } from "./AuthGuard";
import { AppShell } from "./AppShell";
import type { NavItem, NavSection } from "./Sidebar";
import { HOME_ITEM, NAV_SECTIONS } from "@/lib/app-nav";
import { recordAppRoute } from "@/lib/last-app-route";
import { useSidebarCounts } from "@/lib/use-sidebar-counts";

/**
 * The single client wrapper that every /app/* page lives inside.
 *
 * Mounted from app/app/layout.tsx, so the sidebar + auth gate persist
 * across navigations between dashboard pages — no remount, no flicker,
 * no per-page boilerplate. Each page just exports its content; the shell
 * provides the chrome.
 *
 * `NAV_SECTIONS` is a static spec; live counts (collections, library,
 * unread updates) are fetched here and overlaid by href before the
 * sidebar renders.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <RouteRecorder />
      <NavShell>{children}</NavShell>
    </AuthGuard>
  );
}

function NavShell({ children }: { children: ReactNode }) {
  const counts = useSidebarCounts();

  const sections = useMemo<NavSection[]>(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.map((item) => applyCount(item, counts)),
      })),
    [counts],
  );

  return (
    <AppShell sections={sections} primaryItem={HOME_ITEM}>
      {children}
    </AppShell>
  );
}

function applyCount(
  item: NavItem,
  counts: ReturnType<typeof useSidebarCounts>,
): NavItem {
  if (item.href === "/app/library") {
    return counts.library === undefined
      ? item
      : { ...item, count: counts.library };
  }
  if (item.href === "/app/collections") {
    return counts.collections === undefined
      ? item
      : { ...item, count: counts.collections };
  }
  if (item.href === "/app/updates") {
    const unread = counts.updatesUnread;
    if (unread === undefined) return item;
    if (unread <= 0) {
      // Caught up — no number, no dot.
      const { indicator: _drop, ...rest } = item;
      return rest;
    }
    return { ...item, count: unread, indicator: "dot" };
  }
  return item;
}

function RouteRecorder() {
  const pathname = usePathname();
  useEffect(() => {
    recordAppRoute(pathname || "");
  }, [pathname]);
  return null;
}
