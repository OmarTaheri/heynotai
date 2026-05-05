"use client";

import { ClientResponseError } from "pocketbase";
import {
  DEFAULT_EXTENSION_PREFS,
  type AppearancePrefs,
  type ExportKind,
  type ExtensionPrefs,
  type Invoice,
  type NotifPrefs,
  type NotificationPrefsRecord,
  type PrivacyPrefs,
  type Session,
} from "@heynotai/shared";
import { pb, type PBUserRecord } from "./pocketbase";

/* All helpers assume the user is authenticated. Callers should gate on
 * `pb.authStore.isValid` (the AuthGuard in (shell) already does this). */

function uid(): string {
  const id = pb.authStore.record?.id;
  if (!id) throw new Error("Not authenticated");
  return id;
}

/* ── User profile ───────────────────────────────────────────── */

export async function getProfile(): Promise<PBUserRecord> {
  const id = uid();
  // Multiple settings sections call this in parallel on mount. PB's
  // SDK auto-cancels earlier in-flight calls with the same auto-
  // generated request key — pass `requestKey: null` to opt out so
  // every section gets the response.
  return (await pb
    .collection("users")
    .getOne(id, { requestKey: null })) as PBUserRecord;
}

export async function updateProfile(
  patch: Partial<PBUserRecord>,
): Promise<PBUserRecord> {
  const id = uid();
  return (await pb.collection("users").update(id, patch)) as PBUserRecord;
}

export async function uploadAvatar(file: File): Promise<PBUserRecord> {
  const id = uid();
  const fd = new FormData();
  fd.append("avatar", file);
  return (await pb.collection("users").update(id, fd)) as PBUserRecord;
}

export async function changeEmail(newEmail: string): Promise<void> {
  await pb.collection("users").requestEmailChange(newEmail);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await pb.collection("users").requestPasswordReset(email);
}

/* ── First-or-default helpers ───────────────────────────────── */

/* Fetch the per-user row in a one-row-per-user collection, or seed
 * defaults if it doesn't exist yet. Robust against:
 *  - getFirstListItem returning 404 when the row is genuinely missing
 *    (→ create it),
 *  - getFirstListItem failing for any other reason (auth, network) —
 *    we surface the real error instead of pretending the row is missing
 *    and triggering a doomed create,
 *  - create racing against another tab / a sibling call and tripping
 *    the unique-userId index → re-read the now-existing row. */
async function firstOrCreate<T extends Record<string, unknown>>(
  collection: string,
  defaults: T,
): Promise<T & { id: string; userId: string }> {
  const userId = uid();
  try {
    return (await pb
      .collection(collection)
      .getFirstListItem<T & { id: string; userId: string }>(
        `userId = "${userId}"`,
      )) as T & { id: string; userId: string };
  } catch (err) {
    // PB returns 404 when the filter matches nothing — that's the
    // only case where falling through to `create` is correct.
    if (!(err instanceof ClientResponseError) || err.status !== 404) {
      throw err;
    }
  }

  try {
    return (await pb
      .collection(collection)
      .create({ ...defaults, userId })) as T & { id: string; userId: string };
  } catch (err) {
    // Unique-index race: another concurrent caller seeded the row
    // between our read and our create. Re-read and return that one.
    if (err instanceof ClientResponseError && err.status === 400) {
      try {
        return (await pb
          .collection(collection)
          .getFirstListItem<T & { id: string; userId: string }>(
            `userId = "${userId}"`,
          )) as T & { id: string; userId: string };
      } catch {
        // fall through to surface the original create error
      }
    }
    throw err;
  }
}

/* ── Notification preferences ───────────────────────────────── */

export async function getNotifPrefs(): Promise<NotificationPrefsRecord> {
  return firstOrCreate<{ prefs: Record<string, NotifPrefs> }>(
    "notification_prefs",
    { prefs: {} },
  ) as unknown as NotificationPrefsRecord;
}

export async function saveNotifPrefs(
  prefs: Record<string, NotifPrefs>,
): Promise<void> {
  const r = await getNotifPrefs();
  await pb.collection("notification_prefs").update(r.id!, { prefs });
}

/* ── Appearance ─────────────────────────────────────────────── */

const APPEARANCE_DEFAULT: Omit<AppearancePrefs, "userId" | "id"> = {
  theme: "system",
  dateFormat: "DD MMM YYYY",
  showAuthenticVerdicts: true,
};

export async function getAppearance(): Promise<AppearancePrefs> {
  return firstOrCreate<typeof APPEARANCE_DEFAULT>(
    "appearance_prefs",
    APPEARANCE_DEFAULT,
  ) as unknown as AppearancePrefs;
}

export async function saveAppearance(
  patch: Partial<AppearancePrefs>,
): Promise<void> {
  const r = await getAppearance();
  await pb.collection("appearance_prefs").update(r.id!, patch);
}

/* ── Privacy ────────────────────────────────────────────────── */

const PRIVACY_DEFAULT: Omit<PrivacyPrefs, "userId" | "id"> = {
  scanRetention: "forever",
  modelTraining: false,
  anonymousAnalytics: true,
  publicProfile: true,
};

export async function getPrivacy(): Promise<PrivacyPrefs> {
  return firstOrCreate<typeof PRIVACY_DEFAULT>(
    "privacy_prefs",
    PRIVACY_DEFAULT,
  ) as unknown as PrivacyPrefs;
}

export async function savePrivacy(patch: Partial<PrivacyPrefs>): Promise<void> {
  const r = await getPrivacy();
  await pb.collection("privacy_prefs").update(r.id!, patch);
}

/* ── Extension preferences (bidirectional) ──────────────────── */

export async function getExtensionPrefs(): Promise<ExtensionPrefs> {
  return firstOrCreate<typeof DEFAULT_EXTENSION_PREFS>(
    "extension_prefs",
    DEFAULT_EXTENSION_PREFS,
  ) as unknown as ExtensionPrefs;
}

export async function saveExtensionPrefs(
  patch: Partial<ExtensionPrefs>,
): Promise<ExtensionPrefs> {
  const r = await getExtensionPrefs();
  return (await pb
    .collection("extension_prefs")
    .update(r.id!, patch)) as unknown as ExtensionPrefs;
}

export async function resetExtensionPrefs(): Promise<ExtensionPrefs> {
  return saveExtensionPrefs(DEFAULT_EXTENSION_PREFS);
}

/* PB realtime: caller passes a callback that fires on every update.
 * Returns an unsubscribe function. */
export async function subscribeExtensionPrefs(
  cb: (prefs: ExtensionPrefs) => void,
): Promise<() => void> {
  const r = await getExtensionPrefs();
  const id = (r as unknown as { id: string }).id;
  await pb.collection("extension_prefs").subscribe(id, (e) => {
    if (e.action === "update") cb(e.record as unknown as ExtensionPrefs);
  });
  return () => {
    void pb.collection("extension_prefs").unsubscribe(id);
  };
}

/* ── Billing ────────────────────────────────────────────────── */

export async function getInvoices(): Promise<Invoice[]> {
  const userId = uid();
  // Sort newest-first by paidOn, with `created` as a stable tiebreaker
  // so backfilled rows with identical `paidOn` dates keep a deterministic
  // order matching their creation sequence.
  return (await pb.collection("invoices").getFullList({
    filter: `userId="${userId}"`,
    sort: "-paidOn,-created",
    requestKey: null,
  })) as unknown as Invoice[];
}

export function invoicePdfUrl(invoice: Invoice): string | null {
  if (!invoice.pdf) return null;
  return pb.files.getURL(invoice as unknown as Record<string, unknown>, invoice.pdf);
}

/* ── Sessions / auth origins ────────────────────────────────── */

/* PB exposes the per-user auth origins (devices) on the system
 * `_authOrigins` collection. Read-only from the client SDK on recent
 * versions; if it's not exposed, the section degrades to "current
 * device only". */
export async function listSessions(): Promise<Session[]> {
  const userId = uid();
  try {
    const records = await pb.collection("_authOrigins").getFullList<{
      id: string;
      collectionRef: string;
      recordRef: string;
      fingerprint: string;
      created: string;
      updated: string;
    }>({ filter: `recordRef="${userId}"`, sort: "-updated" });
    return records.map((r) => ({
      id: r.id,
      device: shortFingerprint(r.fingerprint),
      meta: `Last used ${new Date(r.updated).toLocaleString()}`,
      when: relativeTime(r.updated),
      current: pb.authStore.record?.id === r.recordRef && r.fingerprint === currentFingerprint(),
    }));
  } catch {
    // Older PB versions don't expose _authOrigins to clients; show only
    // the current session.
    return [
      {
        id: "current",
        device: "this browser",
        meta: "Current session",
        when: "now",
        current: true,
      },
    ];
  }
}

export async function revokeSession(sessionId: string): Promise<void> {
  await pb.collection("_authOrigins").delete(sessionId);
}

function shortFingerprint(fp: string): string {
  if (!fp) return "Unknown device";
  return `Device · ${fp.slice(0, 8)}`;
}

function currentFingerprint(): string {
  // PB doesn't expose the local fingerprint to the SDK; return "" so
  // we never falsely tag a remote row as current.
  return "";
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* ── Data exports ───────────────────────────────────────────── */

export async function requestExport(kind: ExportKind): Promise<void> {
  const userId = uid();
  await pb
    .collection("data_exports")
    .create({ userId, kind, status: "pending" });
}

/* ── Danger zone ────────────────────────────────────────────── */

export async function clearScanHistory(): Promise<void> {
  // Scans collection doesn't exist yet — flag a TODO. When it lands,
  // delete all rows where userId = current user.
  // For now, no-op so the button can succeed in dev.
}

export async function deleteAccount(): Promise<void> {
  const id = uid();
  await pb.collection("users").delete(id);
  pb.authStore.clear();
}

/* ── Auth helpers (Google OAuth + 2FA) ──────────────────────── */

/* PB returns an MFA challenge as a 401 with a body containing
 * `{ mfaId, ... }`. The SDK surfaces it on the thrown error. */
export type MfaChallenge = { mfaId: string };

export async function signInWithGoogle(): Promise<void> {
  await pb.collection("users").authWithOAuth2({ provider: "google" });
}

export async function enable2FA(): Promise<{
  otpauthUri: string;
  backupCodes: string[];
}> {
  // PB v0.23+ exposes /api/collections/users/request-otp for email
  // OTP. For TOTP/authenticator-app support, the project may need a
  // PB hook — wire the UI here and the hook lives in pb_hooks/. For
  // now we surface the email-OTP path and return placeholders so the
  // SecuritySection has something concrete to render.
  const id = pb.authStore.record?.id;
  if (!id) throw new Error("Not authenticated");
  await updateProfile({ mfa: true });
  return { otpauthUri: "", backupCodes: [] };
}

export async function disable2FA(): Promise<void> {
  await updateProfile({ mfa: false });
}

export async function confirm2FA(_code: string): Promise<void> {
  // Wire this when the otpauth flow ships in pb_hooks.
}
