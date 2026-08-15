import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { BackendResponseError as ClientResponseError } from '@heynotai/shared';
import { describeAuthError } from '@heynotai/shared';
import { backend, backendReady, type AuthRecord } from './backend';

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

export type AuthResult = { ok: true } | { ok: false; error: string };

type Ctx = {
  user: AppUser | null;
  loading: boolean;
  /** True while an interactive website sign-in window is open. */
  connecting: boolean;
  /** Opens the website sign-in flow and adopts the resulting session. */
  signIn: () => Promise<AuthResult>;
  /** Opens heynotai.com in a normal tab; the extension picks the session
   *  up on its own the next time the drawer regains focus. */
  openWebsite: () => void;
  /** Drops this browser's extension session and sends the user to
   *  heynotai.com, where the account (and the website session) actually
   *  lives. The extension cannot end the website session for them. */
  signOut: () => void;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:8787';
export const FRONTEND_URL =
  (import.meta.env.VITE_FRONTEND_URL as string | undefined) ??
  'http://localhost:3000';

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

// Mirror the bearer token + plan into chrome.storage.local so the
// background service worker can call /scans without bundling the
// application backend SDK. The drawer iframe is the only context where
// backend.authStore lives — content scripts and the SW are isolated.
const AUTH_STORAGE_KEY = 'heynotai_auth';

// Set when the user signs out from inside the drawer. Without it the
// silent handoff below would immediately re-adopt the still-valid
// website session and the drawer would bounce straight back to
// "signed in", which reads as the sign-out button being broken.
// Cleared the moment the user asks to sign in again.
const SIGNED_OUT_KEY = 'heynotai_signed_out';

async function isSignedOutHere(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return false;
  try {
    const stored = await chrome.storage.local.get(SIGNED_OUT_KEY);
    return stored[SIGNED_OUT_KEY] === true;
  } catch {
    return false;
  }
}

function setSignedOutHere(value: boolean): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  if (value) void chrome.storage.local.set({ [SIGNED_OUT_KEY]: true });
  else void chrome.storage.local.remove(SIGNED_OUT_KEY);
}

function syncAuthToStorage(token: string, record: AuthRecord | null | undefined) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  if (!token || !record) {
    chrome.storage.local.remove(AUTH_STORAGE_KEY).catch(() => {});
    return;
  }
  const r = record as AuthRecord & { plan?: string };
  const plan: Plan = isPlan(r.plan) ? r.plan : 'check';
  chrome.storage.local
    .set({ [AUTH_STORAGE_KEY]: { token, userId: r.id, plan } })
    .catch(() => {});
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() =>
    mapUser(backend.authStore.record),
  );
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unsub = backend.authStore.onChange((token, record) => {
      if (cancelled) return;
      setUser(mapUser(record));
      syncAuthToStorage(token, record);
    });
    void backendReady.then(async () => {
      // No button to press: when the user already has a website session,
      // the silent handoff completes on its own and the drawer opens
      // signed in. When it doesn't, the sign-in button appears.
      if (!backend.authStore.isValid) await attemptSilentSignIn();
      if (!cancelled) {
        setUser(mapUser(backend.authStore.record));
        syncAuthToStorage(backend.authStore.token, backend.authStore.record);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Re-check while signed out: the user may have signed in on the website
  // in another tab since the drawer was opened. Throttled inside
  // `attemptSilentSignIn`, and invisible when it fails.
  useEffect(() => {
    if (loading || user) return;
    const recheck = () => {
      if (document.visibilityState === 'hidden') return;
      void attemptSilentSignIn().then((ok) => {
        if (ok) setUser(mapUser(backend.authStore.record));
      });
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [loading, user]);

  const refresh = useCallback(async () => {
    if (!backend.authStore.isValid) return;
    try {
      const r = await backend.collection('users').authRefresh();
      setUser(mapUser(r.record));
    } catch {
      backend.authStore.clear();
    }
  }, []);

  const signIn = useCallback<Ctx['signIn']>(async () => {
    setConnecting(true);
    setSignedOutHere(false);
    try {
      const ok = await authenticateFromWebsite(true);
      if (!ok) {
        return { ok: false, error: 'Sign-in was cancelled before it finished.' };
      }
      setUser(mapUser(backend.authStore.record));
      return { ok: true };
    } catch (err) {
      return mapAuthError(err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const openWebsite = useCallback<Ctx['openWebsite']>(() => {
    setSignedOutHere(false);
    openTab(`${FRONTEND_URL}/?login=1&next=/app`);
  }, []);

  // Signing out of the extension is only half the story: the account —
  // and the session the extension keeps re-adopting — lives on
  // heynotai.com. So revoke this browser's extension session, latch the
  // drawer to signed-out so the silent handoff can't undo it, and send
  // the user to the website home page to finish signing out there.
  const signOut = useCallback(() => {
    void backend.request<void>('/auth/logout', { method: 'POST' }).catch(() => undefined);
    backend.authStore.clear();
    setSignedOutHere(true);
    setUser(null);
    openTab(`${FRONTEND_URL}/`);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      user,
      loading,
      connecting,
      signIn,
      openWebsite,
      signOut,
      refresh,
    }),
    [user, loading, connecting, signIn, openWebsite, signOut, refresh],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// A non-interactive handoff only succeeds when the website session is
// already there, so retrying it on every focus event is cheap — but not
// free. Throttle it, and never run two at once.
const SILENT_RETRY_MS = 60_000;
const SILENT_TIMEOUT_MS = 10_000;
let silentAttemptAt = 0;
let silentInFlight: Promise<boolean> | null = null;

function attemptSilentSignIn(): Promise<boolean> {
  if (silentInFlight) return silentInFlight;
  const now = Date.now();
  if (silentAttemptAt && now - silentAttemptAt < SILENT_RETRY_MS) {
    return Promise.resolve(false);
  }
  silentAttemptAt = now;
  const attempt = isSignedOutHere()
    .then((signedOut) => (signedOut ? false : authenticateFromWebsite(false)))
    .catch(() => false);
  // Chrome resolves a failed silent flow quickly, but a slow website
  // load must not hold the drawer on its loading state.
  silentInFlight = Promise.race([
    attempt,
    new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), SILENT_TIMEOUT_MS),
    ),
  ]).finally(() => {
    silentInFlight = null;
  });
  return silentInFlight;
}

/** Runs the website-owned sign-in flow in a chrome.identity window and
 *  exchanges its one-time code for an extension bearer session. All
 *  credential entry happens on heynotai.com — the extension never sees
 *  an email, a password, or a Google token. */
async function authenticateFromWebsite(interactive: boolean): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.identity?.launchWebAuthFlow) return false;
  const redirectUrl = chrome.identity.getRedirectURL('website-auth');
  const startUrl =
    `${FRONTEND_URL}/extension-auth?redirect_uri=${encodeURIComponent(redirectUrl)}`;
  const responseUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: startUrl, interactive },
      (url) => {
        if (chrome.runtime.lastError || !url) {
          reject(new Error(chrome.runtime.lastError?.message ?? 'Website sign-in unavailable'));
          return;
        }
        resolve(url);
      },
    );
  });
  const parsed = new URL(responseUrl);
  const code = parsed.searchParams.get('code');
  if (!code) return false;
  const response = await fetch(`${API_URL}/auth/extension/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, device: 'browser-extension' }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    accessToken?: string;
    refreshToken?: string;
    user?: AuthRecord;
  };
  if (!response.ok || !body.accessToken || !body.refreshToken || !body.user) {
    throw new ClientResponseError(response.status, body);
  }
  backend.authStore.save(body.accessToken, body.user, body.refreshToken);
  return true;
}

function openTab(url: string): void {
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

function mapAuthError(err: unknown): AuthResult {
  return { ok: false, error: describeAuthError(err, 'signIn').message };
}
