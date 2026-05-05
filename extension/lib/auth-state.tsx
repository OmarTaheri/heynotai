import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ClientResponseError, type AuthRecord } from 'pocketbase';
import { describeAuthError, type AuthErrorContext } from '@heynotai/shared';
import { pb } from './pocketbase';

export type Plan = 'check' | 'verify' | 'certify' | 'team';

export type AppUser = {
  id: string;
  email: string;
  name: string;
  initials: string;
  plan: Plan;
  avatar?: string;
  verified?: boolean;
};

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; mfaRequired: true; mfaId: string; otpId: string };

type Ctx = {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  confirmMfa: (mfaId: string, otpId: string, code: string) => Promise<AuthResult>;
  signOut: () => void;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

function isPlan(p: unknown): p is Plan {
  return p === 'check' || p === 'verify' || p === 'certify' || p === 'team';
}

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0] ?? '';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? '';
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}

function mapUser(record: AuthRecord | null | undefined): AppUser | null {
  if (!record) return null;
  const r = record as AuthRecord & {
    name?: string;
    email: string;
    plan?: string;
    avatar?: string;
    verified?: boolean;
  };
  const name = r.name ?? '';
  const plan: Plan = isPlan(r.plan) ? r.plan : 'check';
  return {
    id: r.id,
    email: r.email,
    name,
    initials: deriveInitials(name) || (r.email[0] ?? 'U').toUpperCase(),
    plan,
    avatar: r.avatar,
    verified: r.verified,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() =>
    mapUser(pb.authStore.record),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(mapUser(pb.authStore.record));
    setLoading(false);
    const unsub = pb.authStore.onChange((_token, record) => {
      setUser(mapUser(record));
    });
    return () => {
      unsub();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!pb.authStore.isValid) return;
    try {
      const r = await pb.collection('users').authRefresh();
      setUser(mapUser(r.record));
    } catch {
      pb.authStore.clear();
    }
  }, []);

  const signIn = useCallback<Ctx['signIn']>(async (email, password) => {
    const trimmed = email.trim();
    try {
      const r = await pb.collection('users').authWithPassword(trimmed, password);
      setUser(mapUser(r.record));
      return { ok: true };
    } catch (err) {
      const mfaId = extractMfaId(err);
      if (mfaId) {
        try {
          const otp = await pb.collection('users').requestOTP(trimmed);
          return { ok: false, mfaRequired: true, mfaId, otpId: otp.otpId };
        } catch (otpErr) {
          return mapAuthError(otpErr, 'mfa');
        }
      }
      return mapAuthError(err, 'signIn');
    }
  }, []);

  const signUp = useCallback<Ctx['signUp']>(async (name, email, password) => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    try {
      await pb.collection('users').create({
        email: trimmedEmail,
        password,
        passwordConfirm: password,
        name: trimmedName,
        plan: 'check',
        language: 'en',
      });
      const r = await pb
        .collection('users')
        .authWithPassword(trimmedEmail, password);
      setUser(mapUser(r.record));
      return { ok: true };
    } catch (err) {
      return mapAuthError(err, 'signUp');
    }
  }, []);

  const signInWithGoogle = useCallback<Ctx['signInWithGoogle']>(async () => {
    try {
      // The extension can't open OAuth popups in the drawer iframe; we
      // delegate the redirect to the OS via chrome.identity, then hand
      // the auth code to PB. Falls back to authWithOAuth2 in a popup
      // when chrome.identity is unavailable (e.g. dev preview).
      if (chrome?.identity?.launchWebAuthFlow) {
        const provider = await pb
          .collection('users')
          .listAuthMethods()
          .then((m) =>
            m.oauth2.providers.find((p) => p.name === 'google'),
          );
        if (!provider) {
          return { ok: false, error: 'Google sign-in is not configured.' };
        }
        const redirectUrl = chrome.identity.getRedirectURL('pb-oauth2');
        const authUrl = `${provider.authURL}${encodeURIComponent(redirectUrl)}`;
        const responseUrl = await new Promise<string>((resolve, reject) => {
          chrome.identity.launchWebAuthFlow(
            { url: authUrl, interactive: true },
            (url) => {
              if (chrome.runtime.lastError || !url) {
                reject(
                  new Error(
                    chrome.runtime.lastError?.message ?? 'OAuth cancelled',
                  ),
                );
                return;
              }
              resolve(url);
            },
          );
        });
        const code = new URL(responseUrl).searchParams.get('code');
        if (!code) {
          return { ok: false, error: 'OAuth response missing code.' };
        }
        const r = await pb.collection('users').authWithOAuth2Code(
          'google',
          code,
          provider.codeVerifier,
          redirectUrl,
        );
        setUser(mapUser(r.record));
        return { ok: true };
      }
      const r = await pb
        .collection('users')
        .authWithOAuth2({ provider: 'google' });
      setUser(mapUser(r.record));
      return { ok: true };
    } catch (err) {
      return mapAuthError(err, 'oauth');
    }
  }, []);

  const confirmMfa = useCallback<Ctx['confirmMfa']>(
    async (mfaId, otpId, code) => {
      try {
        const r = await pb
          .collection('users')
          .authWithOTP(otpId, code, { mfaId });
        setUser(mapUser(r.record));
        return { ok: true };
      } catch (err) {
        return mapAuthError(err, 'mfa');
      }
    },
    [],
  );

  const signOut = useCallback(() => {
    pb.authStore.clear();
    setUser(null);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      user,
      loading,
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
      signIn,
      signUp,
      signInWithGoogle,
      confirmMfa,
      signOut,
      refresh,
    ],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

function mapAuthError(
  err: unknown,
  ctx: AuthErrorContext = 'signIn',
): AuthResult {
  return { ok: false, error: describeAuthError(err, ctx).message };
}

function extractMfaId(err: unknown): string | null {
  if (!(err instanceof ClientResponseError)) return null;
  const data = err.response as { mfaId?: string } | undefined;
  return data && typeof data.mfaId === 'string' && data.mfaId.length > 0
    ? data.mfaId
    : null;
}
