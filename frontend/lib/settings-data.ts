/* Static UI fixtures for the settings page. User-specific data
 * (profile, billing, sessions) now comes from PocketBase via
 * lib/settings-api.ts. */

import type { IconName } from "@/components/Icon";
import type {
  NotifEvent,
  ProfileMeta,
  ProfileMetaTone,
  Session,
  SettingsSectionId,
  ThemeChoice,
} from "@heynotai/shared";

export type {
  NotifChannel,
  NotifEvent,
  NotifPrefs,
  ProfileMeta,
  ProfileMetaTone,
  Session,
  SettingsSectionId,
  ThemeChoice,
} from "@heynotai/shared";

export type SettingsNavItem = {
  id: SettingsSectionId;
  label: string;
  icon: IconName;
  danger?: boolean;
};

export const SETTINGS_NAV: SettingsNavItem[] = [
  { id: "profile", label: "Profile", icon: "user" },
  { id: "billing", label: "Plan & billing", icon: "key" },
  { id: "security", label: "Security", icon: "lock" },
  { id: "notifications", label: "Notifications", icon: "bell" },
  { id: "appearance", label: "Appearance", icon: "sun" },
  { id: "privacy", label: "Data & privacy", icon: "shield" },
  { id: "danger", label: "Danger zone", icon: "alert-triangle", danger: true },
];

export const NOTIF_EVENTS: NotifEvent[] = [
  {
    id: "monitor-alerts",
    name: "Monitor alerts",
    description:
      "Real-time alerts when a monitor catches AI content matching your rules",
    defaults: { inApp: true, email: true, push: true },
  },
  {
    id: "scan-completed",
    name: "Scan completed",
    description: "Notification when a large batch scan finishes processing",
    defaults: { inApp: true, email: false, push: false },
  },
  {
    id: "team-mentions",
    name: "Team mentions",
    description:
      "When someone @mentions you in a collection or report comment",
    defaults: { inApp: true, email: true, push: false },
  },
  {
    id: "report-viewed",
    name: "Public report viewed",
    description: "When a public link you shared is opened by someone",
    defaults: { inApp: true, email: false, push: false },
  },
  {
    id: "product-updates",
    name: "New models & product updates",
    description:
      "Weekly digest of what shipped — same content as the Updates tab",
    defaults: { inApp: true, email: true, push: false },
  },
  {
    id: "tokens-low",
    name: "Token balance low",
    description:
      "When you have less than 10% of your monthly tokens remaining",
    defaults: { inApp: true, email: true, push: false },
  },
  {
    id: "billing",
    name: "Billing & invoices",
    description: "Receipts, payment failures, renewal reminders",
    defaults: { inApp: true, email: true, push: false },
  },
  {
    id: "marketing",
    name: "Marketing & tips",
    description:
      "Occasional emails with use-case ideas and feature highlights",
    defaults: { inApp: false, email: false, push: false },
  },
];

export const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: "paper", label: "Paper" },
  { id: "night", label: "Night" },
  { id: "system", label: "System" },
];

export type ExportOption = {
  id: "everything" | "library" | "reports";
  name: string;
  format: string;
  description: string;
  icon: IconName;
};

export const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: "everything",
    name: "Everything",
    format: "JSON",
    description: "Account · scans · collections · monitors · reports",
    icon: "file-text",
  },
  {
    id: "library",
    name: "Library",
    format: "CSV",
    description: "All your scans and verdicts as a spreadsheet",
    icon: "list",
  },
  {
    id: "reports",
    name: "Reports archive",
    format: "ZIP",
    description: "All exported PDFs in one ZIP",
    icon: "upload",
  },
];

export type DangerAction = {
  id: "clear-history" | "delete-account";
  icon: IconName;
  title: string;
  body: string;
  buttonLabel: string;
};

export const DANGER_ACTIONS: DangerAction[] = [
  {
    id: "clear-history",
    icon: "trash",
    title: "Clear all scan history",
    body: "Permanently delete every scan in your Library, all collections, and all reports. Monitors and account settings are kept. This cannot be undone.",
    buttonLabel: "Clear history",
  },
  {
    id: "delete-account",
    icon: "alert-triangle",
    title: "Delete account",
    body: "Permanently delete your heynotai account and all associated data — scans, collections, monitors, API keys, the lot. Active subscriptions are cancelled at the end of the billing period. 30-day grace period before final deletion.",
    buttonLabel: "Delete account",
  },
];

/* Helper: derive the UI meta-pills shown next to the avatar from the
 * authenticated user's record. */
export function profileMetaFromUser(user: {
  verified?: boolean;
  plan?: string;
  team?: string;
}): ProfileMeta[] {
  const meta: ProfileMeta[] = [];
  if (user.verified) {
    meta.push({ label: "Email verified", tone: "human", icon: "check" });
  }
  if (user.plan) {
    const labels: Record<string, string> = {
      check: "Check plan",
      verify: "Verify plan",
      certify: "Certify plan",
      team: "Team plan",
    };
    meta.push({
      label: labels[user.plan] ?? user.plan,
      tone: user.plan === "team" || user.plan === "certify" ? "gold" : "info",
    });
  }
  if (user.team) {
    meta.push({ label: "Team workspace", tone: "info" });
  }
  return meta;
}
