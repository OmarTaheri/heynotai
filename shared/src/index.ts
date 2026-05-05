/**
 * Shared types + zod schemas for heynotai.
 *
 * Consumed by `frontend/` and `extension/`. No runtime logic — only the
 * contracts that describe what the PocketBase collections look like and
 * the small enums that both clients need to keep in sync.
 */

import { z } from "zod";

export {
  describeAuthError,
  type AuthErrorContext,
  type AuthErrorInfo,
} from "./auth-errors";

/* ── Plans ──────────────────────────────────────────────────── */

export const PLANS = ["check", "verify", "certify", "team"] as const;
export const planSchema = z.enum(PLANS);
export type Plan = z.infer<typeof planSchema>;

export const PLAN_CYCLES = ["monthly", "yearly"] as const;
export const planCycleSchema = z.enum(PLAN_CYCLES);
export type PlanCycle = z.infer<typeof planCycleSchema>;

/** USD per month for each tier × billing cycle. Yearly cycles are
 *  shown as monthly-equivalent rate (the design's "$17 / month, billed
 *  annually" pattern). */
export const PLAN_PRICES: Record<Plan, { monthly: number; yearly: number }> = {
  check: { monthly: 0, yearly: 0 },
  verify: { monthly: 10, yearly: 100 },
  certify: { monthly: 30, yearly: 300 },
  team: { monthly: 80, yearly: 800 },
};

export const LANGUAGES = ["en", "es", "fr", "de", "zh", "ar", "ja"] as const;
export const languageSchema = z.enum(LANGUAGES);
export type Language = z.infer<typeof languageSchema>;

/* ── User profile (extends PB built-in `users` auth collection) ─ */

export const ROLES = [
  "journalist",
  "educator",
  "hr",
  "marketing",
  "researcher",
  "dev",
  "other",
] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().default(""),
  handle: z.string().default(""),
  avatar: z.string().default(""),
  avatarUrl: z.string().default(""),
  timezone: z.string().default(""),
  language: languageSchema.default("en"),
  plan: planSchema.default("check"),
  planCycle: planCycleSchema.optional(),
  planBadge: z.string().default(""),
  planRenewsOn: z.string().default(""),
  billingEmail: z.string().default(""),
  billingAddress: z.string().default(""),
  billingCountry: z.string().default(""),
  paymentBrand: z.string().default(""),
  paymentLast4: z.string().optional(),
  paymentExpires: z.string().default(""),
  stripeCustomerId: z.string().default(""),
  stripeSubscriptionId: z.string().default(""),
  taxId: z.string().default(""),
  team: z.string().default(""),
  verified: z.boolean().default(false),
  mfa: z.boolean().default(false),
  onboardingCompleted: z.boolean().default(false),
  role: z.string().default(""),
  useCases: z.array(z.string()).default([]),
  connections: z.array(z.string()).default([]),
  created: z.string().optional(),
  updated: z.string().optional(),
});
export type User = z.infer<typeof userSchema>;

/* ── Notification preferences ───────────────────────────────── */

export const NOTIF_CHANNELS = ["inApp", "email", "push"] as const;
export type NotifChannel = (typeof NOTIF_CHANNELS)[number];

export const notifPrefsSchema = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
  push: z.boolean(),
});
export type NotifPrefs = z.infer<typeof notifPrefsSchema>;

export const notificationPrefsRecordSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  prefs: z.record(notifPrefsSchema),
});
export type NotificationPrefsRecord = z.infer<
  typeof notificationPrefsRecordSchema
>;

export type NotifEvent = {
  id: string;
  name: string;
  description: string;
  defaults: NotifPrefs;
};

/* ── Appearance preferences (frontend-only fields) ──────────── */

export const THEMES = ["paper", "night", "system"] as const;
export const themeSchema = z.enum(THEMES);
export type ThemeChoice = z.infer<typeof themeSchema>;

export const appearancePrefsSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  theme: themeSchema.default("system"),
  dateFormat: z.string().default("DD MMM YYYY"),
  showAuthenticVerdicts: z.boolean().default(true),
});
export type AppearancePrefs = z.infer<typeof appearancePrefsSchema>;

/* ── Privacy preferences ────────────────────────────────────── */

export const privacyPrefsSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  scanRetention: z.string().default("forever"),
  modelTraining: z.boolean().default(false),
  anonymousAnalytics: z.boolean().default(true),
  publicProfile: z.boolean().default(true),
});
export type PrivacyPrefs = z.infer<typeof privacyPrefsSchema>;

/* ── Extension preferences (shared between drawer + /app/extension) ─ */

export const SCAN_MODES = ["allowlist", "manual", "everything"] as const;
export const scanModeSchema = z.enum(SCAN_MODES);
export type ScanMode = z.infer<typeof scanModeSchema>;

export const EXPERIENCE_MODES = ["normal", "power"] as const;
export const experienceModeSchema = z.enum(EXPERIENCE_MODES);
export type ExperienceMode = z.infer<typeof experienceModeSchema>;

export const PLATFORM_KEYS = ["facebook", "youtube", "instagram"] as const;
export const platformKeySchema = z.enum(PLATFORM_KEYS);
export type PlatformKey = z.infer<typeof platformKeySchema>;

export const siteSchema = z.object({
  host: z.string(),
  enabled: z.boolean(),
  count: z.number().default(0),
  ai: z.number().default(0),
});
export type Site = z.infer<typeof siteSchema>;

export const extensionNotificationsSchema = z.object({
  desktop: z.boolean().default(true),
  sound: z.boolean().default(false),
  threshold: z.number().min(0).max(100).default(70),
});
export type ExtensionNotifications = z.infer<
  typeof extensionNotificationsSchema
>;

export const extensionPrivacySchema = z.object({
  cloud: z.boolean().default(true),
  cache: z.boolean().default(true),
  shareSignals: z.boolean().default(false),
});
export type ExtensionPrivacy = z.infer<typeof extensionPrivacySchema>;

export const hotkeyBindingSchema = z.object({
  id: z.string(),
  combo: z.string(),
});
export type HotkeyBinding = z.infer<typeof hotkeyBindingSchema>;

export const extensionPrefsSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  mode: experienceModeSchema.default("normal"),
  autoModelMode: z.boolean().default(false),
  scanMode: scanModeSchema.default("allowlist"),
  sites: z.array(siteSchema).default([]),
  platforms: z.record(platformKeySchema, z.boolean()).default({
    facebook: true,
    youtube: true,
    instagram: true,
  }),
  notifications: extensionNotificationsSchema.default({
    desktop: true,
    sound: false,
    threshold: 70,
  }),
  privacy: extensionPrivacySchema.default({
    cloud: true,
    cache: true,
    shareSignals: false,
  }),
  hotkeys: z.array(hotkeyBindingSchema).default([]),
  /* `flags` captures the full set of named toggles surfaced by the
   * /app/extension page (and the drawer's Settings tab). Stored as a
   * free-form id→bool map so we don't need a migration every time the
   * UI adds a toggle row. Extension-side code reads only the keys it
   * cares about. */
  flags: z.record(z.boolean()).default({}),
});
export type ExtensionPrefs = z.infer<typeof extensionPrefsSchema>;

export const DEFAULT_EXTENSION_PREFS: Omit<ExtensionPrefs, "userId" | "id"> = {
  mode: "normal",
  autoModelMode: false,
  scanMode: "allowlist",
  sites: [],
  platforms: { facebook: true, youtube: true, instagram: true },
  notifications: { desktop: true, sound: false, threshold: 70 },
  privacy: { cloud: true, cache: true, shareSignals: false },
  hotkeys: [],
  flags: {},
};

/* ── Billing ────────────────────────────────────────────────── */

export const invoiceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  amount: z.number(),
  currency: z.string().default("USD"),
  paidOn: z.string(),
  pdf: z.string().default(""),
});
export type Invoice = z.infer<typeof invoiceSchema>;

/* ── Data exports ───────────────────────────────────────────── */

export const EXPORT_KINDS = ["everything", "library", "reports"] as const;
export const exportKindSchema = z.enum(EXPORT_KINDS);
export type ExportKind = z.infer<typeof exportKindSchema>;

export const EXPORT_STATUSES = ["pending", "ready", "failed"] as const;
export const exportStatusSchema = z.enum(EXPORT_STATUSES);
export type ExportStatus = z.infer<typeof exportStatusSchema>;

export const dataExportSchema = z.object({
  id: z.string(),
  userId: z.string(),
  kind: exportKindSchema,
  status: exportStatusSchema,
  file: z.string().default(""),
  created: z.string().optional(),
});
export type DataExport = z.infer<typeof dataExportSchema>;

/* ── Teams ──────────────────────────────────────────────────── */

export const TEAM_ROLES = ["manager", "member"] as const;
export const teamRoleSchema = z.enum(TEAM_ROLES);
export type TeamRole = z.infer<typeof teamRoleSchema>;

export const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  manager: z.string(),
  seatLimit: z.number().default(5),
});
export type Team = z.infer<typeof teamSchema>;

export const teamMemberSchema = z.object({
  id: z.string(),
  team: z.string(),
  user: z.string(),
  role: teamRoleSchema,
  invitedBy: z.string().default(""),
  joinedAt: z.string().optional(),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

/* ── Sessions (informational mirror — sourced from PB authStore + auth-origins) ── */

export type Session = {
  id: string;
  device: string;
  meta: string;
  when: string;
  current?: boolean;
};

/* ── UI taxonomy (kept in shared so both surfaces agree) ────── */

export const SETTINGS_SECTION_IDS = [
  "profile",
  "billing",
  "security",
  "notifications",
  "appearance",
  "privacy",
  "danger",
] as const;
export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

export type ProfileMetaTone = "human" | "gold" | "info";
export type ProfileMeta = {
  label: string;
  tone: ProfileMetaTone;
  icon?: string;
};

/* ── Theme mapping between extension (light/dark/system) and frontend (paper/night/system) ── */

export const extensionThemeFromPaper = (
  t: ThemeChoice,
): "light" | "dark" | "system" =>
  t === "paper" ? "light" : t === "night" ? "dark" : "system";

export const paperThemeFromExtension = (
  t: "light" | "dark" | "system",
): ThemeChoice => (t === "light" ? "paper" : t === "dark" ? "night" : "system");
