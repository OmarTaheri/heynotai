import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Live-API helper for the authenticated specs.
 *
 *  Playwright cannot intercept fetches made by an extension page — the
 *  drawer's requests bypass both `page.route` and `context.route` — so
 *  the signed-in surfaces can only be exercised against a real API. The
 *  specs that need one skip themselves when it isn't running, and every
 *  signed-out assertion runs regardless.
 *
 *  Start it with `pnpm dev:api` (which also seeds the dev accounts). */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const API_ENV = path.resolve(HERE, '..', '..', 'api', '.env.local');

export const API_URL = process.env.VITE_API_URL ?? 'http://localhost:8787';

export interface DevSession {
  token: string;
  userId: string;
  plan: string;
  email: string;
}

async function readDevCredentials(): Promise<{
  email: string;
  password: string;
} | null> {
  const fromEnv = {
    email: process.env.DEV_USER_EMAIL,
    password: process.env.DEV_LOGIN_PASSWORD,
  };
  if (fromEnv.email && fromEnv.password) {
    return { email: fromEnv.email, password: fromEnv.password };
  }
  try {
    const raw = await readFile(API_ENV, 'utf8');
    const pick = (key: string) =>
      raw
        .split(/\r?\n/)
        .find((line) => line.startsWith(`${key}=`))
        ?.slice(key.length + 1)
        .trim();
    const email = pick('DEV_USER_EMAIL');
    const password = pick('DEV_LOGIN_PASSWORD');
    return email && password ? { email, password } : null;
  } catch {
    return null;
  }
}

/** Logs in as the seeded development user. Returns null when the API is
 *  unreachable or the dev credentials aren't configured, which the
 *  callers treat as "skip this spec", not "fail". */
export async function loginDevUser(): Promise<DevSession | null> {
  const credentials = await readDevCredentials();
  if (!credentials) return null;
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...credentials, device: 'e2e' }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      accessToken?: string;
      refreshToken?: string;
      user?: { id?: string; plan?: string; email?: string };
    };
    if (!body.accessToken || !body.user?.id) return null;
    return {
      token: body.accessToken,
      userId: body.user.id,
      plan: body.user.plan ?? 'check',
      email: body.user.email ?? credentials.email,
    };
  } catch {
    return null;
  }
}

/** Creates a real text scan so a spec has something to assert on. */
export async function createTextScan(
  session: DevSession,
  title: string,
  content: string,
): Promise<{ id: string } | null> {
  const form = new FormData();
  form.set('type', 'txt');
  form.set('origin', 'ext');
  form.set('title', title);
  form.set('content', content);
  try {
    const response = await fetch(`${API_URL}/scans`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}` },
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as { id: string };
  } catch {
    return null;
  }
}

export async function deleteScan(
  session: DevSession,
  id: string,
): Promise<void> {
  await fetch(`${API_URL}/scans/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.token}` },
  }).catch(() => undefined);
}
