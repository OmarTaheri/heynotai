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

/** Ordinal rank of each plan — used to compare a model's `tier`
 *  against the user's current plan. A model with `tier="verify"` is
 *  reachable by anyone whose plan rank is ≥ 1 (verify, certify, team).
 *  Both the API and the picker UIs (extension drawer + frontend
 *  /app/models) compute lock state with `isModelLocked`. */
export const PLAN_RANK: Record<Plan, number> = {
  check: 0,
  verify: 1,
  certify: 2,
  team: 3,
};

export const isModelLocked = (userPlan: Plan, modelTier: Plan): boolean =>
  PLAN_RANK[modelTier] > PLAN_RANK[userPlan];

export const canUseModel = (userPlan: Plan, modelTier: Plan): boolean =>
  !isModelLocked(userPlan, modelTier);

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

/** Per-platform list of surface keys (sub-toggles under the master). */
export const PLATFORM_SURFACES = {
  youtube: ["videos", "reels"],
  instagram: ["posts", "reels"],
  facebook: ["posts", "reels"],
} as const;

export type SurfaceKey<P extends PlatformKey> =
  (typeof PLATFORM_SURFACES)[P][number];

const youtubePlatformSchema = z.object({
  enabled: z.boolean().default(true),
  surfaces: z
    .object({
      videos: z.boolean().default(true),
      reels: z.boolean().default(true),
    })
    .default({ videos: true, reels: true }),
});
const instagramPlatformSchema = z.object({
  enabled: z.boolean().default(true),
  surfaces: z
    .object({
      posts: z.boolean().default(true),
      reels: z.boolean().default(true),
    })
    .default({ posts: true, reels: true }),
});
const facebookPlatformSchema = z.object({
  enabled: z.boolean().default(true),
  surfaces: z
    .object({
      posts: z.boolean().default(true),
      reels: z.boolean().default(true),
    })
    .default({ posts: true, reels: true }),
});

export const platformsSchema = z.object({
  youtube: youtubePlatformSchema.default({
    enabled: true,
    surfaces: { videos: true, reels: true },
  }),
  instagram: instagramPlatformSchema.default({
    enabled: true,
    surfaces: { posts: true, reels: true },
  }),
  facebook: facebookPlatformSchema.default({
    enabled: true,
    surfaces: { posts: true, reels: true },
  }),
});
export type Platforms = z.infer<typeof platformsSchema>;

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
  platforms: platformsSchema.default({
    youtube: { enabled: true, surfaces: { videos: true, reels: true } },
    instagram: { enabled: true, surfaces: { posts: true, reels: true } },
    facebook: { enabled: true, surfaces: { posts: true, reels: true } },
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
  platforms: {
    youtube: { enabled: true, surfaces: { videos: true, reels: true } },
    instagram: { enabled: true, surfaces: { posts: true, reels: true } },
    facebook: { enabled: true, surfaces: { posts: true, reels: true } },
  },
  notifications: { desktop: true, sound: false, threshold: 70 },
  privacy: { cloud: true, cache: true, shareSignals: false },
  hotkeys: [],
  flags: {},
};

/** Convert any historical or partial `platforms` payload into the
 *  current canonical nested shape. Old rows stored a flat
 *  `Record<PlatformKey, boolean>` — when we see one of those, the bool
 *  becomes the master `enabled` and propagates to every surface so the
 *  user's previous mute/unmute intent is preserved. Always produces
 *  keys in the same literal order so JSON stringification is stable
 *  across loads (used by the frontend's dirty-check). */
export function migrateLegacyPlatforms(raw: unknown): Platforms {
  const fallback = (): Platforms => ({
    youtube: { enabled: true, surfaces: { videos: true, reels: true } },
    instagram: { enabled: true, surfaces: { posts: true, reels: true } },
    facebook: { enabled: true, surfaces: { posts: true, reels: true } },
  });
  if (!raw || typeof raw !== "object") return fallback();
  const r = raw as Record<string, unknown>;

  const expand = <S extends string>(
    val: unknown,
    keys: readonly S[],
    fallbackEnabled: boolean,
  ): { enabled: boolean; surfaces: Record<S, boolean> } => {
    if (typeof val === "boolean") {
      const surfaces = Object.fromEntries(keys.map((k) => [k, val])) as Record<
        S,
        boolean
      >;
      return { enabled: val, surfaces };
    }
    if (val && typeof val === "object") {
      const v = val as Record<string, unknown>;
      const enabled =
        typeof v.enabled === "boolean" ? v.enabled : fallbackEnabled;
      const sIn =
        v.surfaces && typeof v.surfaces === "object"
          ? (v.surfaces as Record<string, unknown>)
          : {};
      const surfaces = Object.fromEntries(
        keys.map((k) => [k, typeof sIn[k] === "boolean" ? sIn[k] : true]),
      ) as Record<S, boolean>;
      return { enabled, surfaces };
    }
    const surfaces = Object.fromEntries(
      keys.map((k) => [k, fallbackEnabled]),
    ) as Record<S, boolean>;
    return { enabled: fallbackEnabled, surfaces };
  };

  return {
    youtube: expand(r.youtube, PLATFORM_SURFACES.youtube, true),
    instagram: expand(r.instagram, PLATFORM_SURFACES.instagram, true),
    facebook: expand(r.facebook, PLATFORM_SURFACES.facebook, true),
  };
}

/** Returns the surface keys for `platform` that are both master-enabled
 *  AND surface-enabled. Content scripts call this so they don't
 *  re-implement the AND logic three times. */
export function surfacesEnabled<P extends PlatformKey>(
  platforms: Platforms,
  platform: P,
): SurfaceKey<P>[] {
  const cfg = platforms[platform] as {
    enabled: boolean;
    surfaces: Record<string, boolean>;
  };
  if (!cfg?.enabled) return [];
  return PLATFORM_SURFACES[platform].filter(
    (k) => cfg.surfaces?.[k] === true,
  ) as SurfaceKey<P>[];
}

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
