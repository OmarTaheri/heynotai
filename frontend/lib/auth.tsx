"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ClientResponseError } from "pocketbase";
import {
  DEFAULT_EXTENSION_PREFS,
  type Plan,
} from "@heynotai/shared";
import { pb, type PBUserRecord } from "./pocketbase";

export type { Plan };

export type AppUser = {
  id: string;
  email: string;
  name: string;
  initials: string;
  plan: Plan;
  avatar?: string;
  verified?: boolean;
  mfa?: boolean;
};

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; mfaRequired: true; mfaId: string; otpId: string };

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  signingOut: boolean;
  farewell: string;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  confirmMfa: (
    mfaId: string,
    otpId: string,
    code: string,
  ) => Promise<AuthResult>;
  signOut: () => void;
  refresh: () => Promise<void>;
};

const FAREWELLS = ["bye", "see ya", "later", "cya", "ciao", "peace", "take care"];
const GOODBYE_MS = 1700;

const AuthContext = createContext<AuthContextValue | null>(null);

function isPlan(p: unknown): p is Plan {
  return p === "check" || p === "verify" || p === "certify" || p === "team";
}

function mapUser(record: PBUserRecord | null | undefined): AppUser | null {
  if (!record) return null;
  const name = (record.name as string | undefined) ?? "";
  const plan: Plan = isPlan(record.plan) ? record.plan : "check";
  return {
    id: record.id,
    email: record.email,
    name,
    initials: deriveInitials(name) || (record.email[0] ?? "U").toUpperCase(),
    plan,
    avatar: record.avatar as string | undefined,
    verified: record.verified as boolean | undefined,
    mfa: record.mfa as boolean | undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [farewell, setFarewell] = useState<string>(FAREWELLS[0]);

  // Hydrate from the SDK's persisted auth store, then subscribe to
  // changes (e.g. token refresh, sign-out from another tab).
  useEffect(() => {
    setUser(mapUser(pb.authStore.record as PBUserRecord | null));
    setLoading(false);
    const unsub = pb.authStore.onChange((_token, record) => {
      setUser(mapUser(record as PBUserRecord | null));
    });
    return () => {
      unsub();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!pb.authStore.isValid) return;
    try {
      const r = await pb.collection("users").authRefresh<PBUserRecord>();
      setUser(mapUser(r.record));
    } catch {
      pb.authStore.clear();
    }
  }, []);

  const signIn = useCallback<AuthContextValue["signIn"]>(
    async (email, password) => {
      const trimmedEmail = email.trim();
      try {
        const r = await pb
          .collection("users")
          .authWithPassword<PBUserRecord>(trimmedEmail, password);
        setUser(mapUser(r.record));
        return { ok: true };
      } catch (err) {
        const mfaId = extractMfaId(err);
        if (mfaId) {
          // Second factor required. Email an OTP and ask the UI to
          // collect it. The OTP id is what `authWithOTP` needs along
          // with the mfaId. Per PB docs, requestOTP returns an otpId
          // even if the address doesn't exist — that's fine here, the
          // mfaId will simply not validate.
          try {
            const otp = await pb
              .collection("users")
              .requestOTP(trimmedEmail);
            return {
              ok: false,
              mfaRequired: true,
              mfaId,
              otpId: otp.otpId,
            };
          } catch (otpErr) {
            return mapAuthError(otpErr);
          }
        }
        return mapAuthError(err);
      }
    },
    [],
  );

  const signUp = useCallback<AuthContextValue["signUp"]>(
    async (name, email, password) => {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim().toLowerCase();
      try {
        await pb.collection("users").create({
          email: trimmedEmail,
          password,
          passwordConfirm: password,
          name: trimmedName,
          plan: "check" satisfies Plan,
          language: "en",
        });
        const r = await pb
          .collection("users")
          .authWithPassword<PBUserRecord>(trimmedEmail, password);
        setUser(mapUser(r.record));
        // Best-effort default rows; ignore failures — rows will be
        // created lazily by settings-api on first read.
        await seedDefaultPrefs(r.record.id).catch(() => undefined);
        return { ok: true };
      } catch (err) {
        return mapAuthError(err);
      }
    },
    [],
  );

  const signInWithGoogle = useCallback<
    AuthContextValue["signInWithGoogle"]
  >(async () => {
    try {
      const r = await pb
        .collection("users")
        .authWithOAuth2<PBUserRecord>({ provider: "google" });
      setUser(mapUser(r.record));
      return { ok: true };
    } catch (err) {
      return mapAuthError(err);
    }
  }, []);

  const confirmMfa = useCallback<AuthContextValue["confirmMfa"]>(
    async (mfaId, otpId, code) => {
      try {
        const r = await pb
          .collection("users")
          .authWithOTP<PBUserRecord>(otpId, code, { mfaId });
        setUser(mapUser(r.record));
        return { ok: true };
      } catch (err) {
        return mapAuthError(err);
      }
    },
    [],
  );

  const signOut = useCallback(() => {
    setFarewell(FAREWELLS[Math.floor(Math.random() * FAREWELLS.length)]);
    setSigningOut(true);
    window.setTimeout(() => {
      pb.authStore.clear();
      setUser(null);
      setSigningOut(false);
    }, GOODBYE_MS);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signingOut,
      farewell,
      signIn,
      signUp,
      signInWithGoogle,
      confirmMfa,
      signOut,
      refresh,
    }),
    [
      user,
      loading,
      signingOut,
      farewell,
      signIn,
      signUp,
      signInWithGoogle,
      confirmMfa,
      signOut,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function mapAuthError(err: unknown): AuthResult {
  if (err instanceof ClientResponseError) {
    return { ok: false, error: err.message || "Authentication failed." };
  }
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Authentication failed." };
}

function extractMfaId(err: unknown): string | null {
  if (!(err instanceof ClientResponseError)) return null;
  const data = err.response as unknown as { mfaId?: string } | undefined;
  if (data && typeof data.mfaId === "string" && data.mfaId.length > 0) {
    return data.mfaId;
  }
  return null;
}

async function seedDefaultPrefs(userId: string): Promise<void> {
  const tasks: Array<Promise<unknown>> = [
    pb.collection("notification_prefs").create({ userId, prefs: {} }),
    pb.collection("appearance_prefs").create({
      userId,
      theme: "system",
      dateFormat: "DD MMM YYYY",
      showAuthenticVerdicts: true,
      reduceMotion: false,
    }),
    pb.collection("privacy_prefs").create({
      userId,
      scanRetention: "forever",
      modelTraining: false,
      anonymousAnalytics: true,
      publicProfile: true,
    }),
    pb
      .collection("extension_prefs")
      .create({ userId, ...DEFAULT_EXTENSION_PREFS }),
  ];
  await Promise.allSettled(tasks);
}
