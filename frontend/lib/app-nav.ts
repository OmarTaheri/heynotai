import type { NavItem, NavSection } from "@/components/app/Sidebar";

/**
 * Single source of truth for the dashboard sidebar.
 * Imported once by DashboardShell and shared across every /app/* page —
 * adding a route is "register the icon here, drop a page.tsx at the
 * matching path, done".
 */

/** The merged Home destination — sits above the labelled sections. */
export const HOME_ITEM: NavItem = {
  href: "/app",
  label: "Home",
  icon: "home",
  exact: true,
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Content",
    items: [
      { href: "/app/library", label: "Library", icon: "list" },
      { href: "/app/collections", label: "Collections", icon: "folder" },
      {
        href: "/app/monitors",
        label: "Monitors",
        icon: "eye",
        count: 3,
        indicator: "warning",
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/app/models", label: "Models", icon: "cube" },
      { href: "/app/reports", label: "Reports", icon: "file-text" },
      { href: "/app/updates", label: "Updates", icon: "zap" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/app/team", label: "Team", icon: "users" },
      {
        href: "/app/extension",
        label: "Extension",
        icon: "puzzle",
        indicator: "new",
      },
    ],
  },
];

