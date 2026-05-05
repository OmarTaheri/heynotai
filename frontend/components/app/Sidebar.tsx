"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { AppBrand } from "./AppBrand";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth";
import { fetchMonthlyUsage } from "@/lib/models-api";
import { UsageCard } from "./UsageCard";
import styles from "./Sidebar.module.css";

export type NavSection = {
  label: string;
  items: NavItem[];
};

/** Visual cue rendered after the count.
 *   warning → amber alert triangle (something needs attention)
 *   dot     → small accent dot (unread / new)
 *   new     → "NEW" pill (recently shipped feature) */
export type NavIndicator = "warning" | "dot" | "new";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
  indicator?: NavIndicator;
  /** When true, the active state matches when the URL exactly equals href.
   *  Otherwise active matches if the URL starts with href. */
  exact?: boolean;
};

/**
 * The application sidebar. Sections render with their uppercase label,
 * items are <Link>s so the browser handles middle-click / open-in-new-tab.
 * The currently-active item is determined from the pathname.
 *
 * Top row has the brand mark on the left and a collapse/expand toggle on
 * the right. When collapsed, the brand shrinks to the "ai" strike mark,
 * item labels hide, and the toggle wraps under the brand. Sign-out lives
 * in the profile area at the bottom of the sidebar.
 *
 * `data-sidebar-collapsed` on the <aside> is the cross-module channel
 * AppShell's grid reads via `:has()` — see shell.css.
 */
export function Sidebar({
  sections,
  primaryItem,
  bottom,
}: {
  sections: NavSection[];
  /** Single nav item rendered above the first labelled section — used
   *  for the merged Home destination. */
  primaryItem?: NavItem;
  bottom?: ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [usage, setUsage] = useState<{ remaining: number; total: number } | null>(null);

  // Fetch real per-user monthly token usage. Team accounts have a
  // custom (admin-assigned) allotment so the API returns `total: null`
  // — we leave `usage` null in that case and the meter stays hidden.
  useEffect(() => {
    if (!user || user.plan === "team") {
      setUsage(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const monthly = await fetchMonthlyUsage();
      if (cancelled || !monthly || monthly.total === null) return;
      setUsage({
        remaining: Math.max(0, monthly.total - monthly.used),
        total: monthly.total,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <>
      <aside
        className={`${styles.sidebar}${collapsed ? ` ${styles.isCollapsed}` : ""}`}
        data-sidebar-collapsed={collapsed || undefined}
      >
        <div className={styles.top}>
          <AppBrand startClosed className={styles.brand} />
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name="sidebar" size={16} />
          </button>
        </div>

        <nav className={`${styles.nav} flex flex-col gap-0.5`}>
          {primaryItem && (
            <SidebarLink
              item={primaryItem}
              active={isActive(pathname, primaryItem)}
            />
          )}
          {sections.map((section) => (
            <SidebarSection key={section.label} label={section.label}>
              {section.items.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item)}
                />
              ))}
            </SidebarSection>
          ))}
        </nav>

        <div className={styles.foot}>
          {user && usage && (
            <div className={styles.usageSlot}>
              <UsageCard
                remaining={usage.remaining}
                total={usage.total}
                plan={user.plan}
              />
            </div>
          )}
          {bottom ?? <DefaultProfile />}
        </div>
      </aside>
    </>
  );
}

function isActive(pathname: string | null, item: NavItem) {
  if (!pathname) return false;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function SidebarSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className={styles.sectionLabel}>{label}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`${styles.item}${active ? ` ${styles.isActive}` : ""}`}
      aria-current={active ? "page" : undefined}
      title={item.label}
    >
      <span className={styles.itemIcon}>
        <Icon name={item.icon} size={16} />
      </span>
      <span className={styles.itemLabel}>{item.label}</span>
      {typeof item.count === "number" && (
        <span className={styles.itemCount}>{item.count}</span>
      )}
      {item.indicator && <SidebarIndicator kind={item.indicator} />}
    </Link>
  );
}

function SidebarIndicator({ kind }: { kind: NavIndicator }) {
  if (kind === "warning") {
    return (
      <span
        className={`${styles.indicator} ${styles.kindWarning}`}
        aria-label="needs attention"
        title="Needs attention"
      >
        <Icon name="alert-triangle" size={11} />
      </span>
    );
  }
  if (kind === "new") {
    return (
      <span
        className={`${styles.indicator} ${styles.kindNew}`}
        aria-label="new"
      >
        NEW
      </span>
    );
  }
  return (
    <span
      className={`${styles.indicator} ${styles.kindDot}`}
      aria-label="unread"
    />
  );
}

/* The default bottom card — used when no `bottom` slot is supplied.
   Avatar · name · logout sit in one flex-wrap row. Collapsed: name
   shrinks to max-width 0 and the logout button wraps onto its own line
   beneath the avatar. */
function DefaultProfile() {
  const { user, signOut } = useAuth();
  if (!user) return null;

  return (
    <div className={styles.profileGroup} role="group" aria-label="Account">
      <Avatar initials={user.initials} src={user.avatarSrc} />
      <div className={styles.profileText}>
        <div className={styles.profileName}>{user.displayName}</div>
      </div>
      <Link
        href="/app/settings"
        className={styles.profileAction}
        aria-label="Settings"
        title="Settings"
      >
        <Icon name="settings" size={16} />
      </Link>
      <button
        type="button"
        className={styles.profileAction}
        onClick={signOut}
        aria-label="Sign out"
        title="Sign out"
      >
        <Icon name="log-out" size={16} />
      </button>
    </div>
  );
}
