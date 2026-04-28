"use client";

import type { ReactNode } from "react";
import { Sidebar, type NavItem, type NavSection } from "./Sidebar";

/**
 * Two-column shell used by every authenticated /app/* route. Left column
 * is the sticky sidebar; right column is the scrollable content area
 * that callers fill with PageHeader + page body.
 */
export function AppShell({
  sections,
  primaryItem,
  children,
}: {
  sections: NavSection[];
  primaryItem?: NavItem;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <Sidebar sections={sections} primaryItem={primaryItem} />
      <main className="app-shell-main">{children}</main>
    </div>
  );
}
