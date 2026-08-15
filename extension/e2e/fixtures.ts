import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chromium,
  test as base,
  type BrowserContext,
  type Worker,
} from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.resolve(HERE, '..', '.output');

/** WXT writes development builds to `chrome-mv3-dev` and production
 *  builds to `chrome-mv3`. Prefer the dev build: it is the one whose
 *  `VITE_API_URL` points at localhost, so the signed-in specs talk to a
 *  local API instead of the live one. `pnpm e2e` produces it. */
export const EXTENSION_PATH = existsSync(path.join(OUTPUT, 'chrome-mv3-dev'))
  ? path.join(OUTPUT, 'chrome-mv3-dev')
  : path.join(OUTPUT, 'chrome-mv3');

export interface ExtensionFixtures {
  context: BrowserContext;
  /** The MV3 background service worker. */
  worker: Worker;
  /** The unpacked extension's runtime id, needed for chrome-extension:// URLs. */
  extensionId: string;
}

/** Channels to try, in order.
 *
 *  Edge leads because Chrome 137+ removed support for the
 *  `--load-extension` command-line flag: Chrome launches fine but loads
 *  no extension, so every assertion here would fail for the wrong
 *  reason. Edge is the same Chromium engine and still honours the flag.
 *  Playwright's bundled `chromium_headless_shell` can't load extensions
 *  at all. Override with `HEYNOTAI_E2E_CHANNEL` if neither is present. */
const CHANNELS = process.env.HEYNOTAI_E2E_CHANNEL
  ? [process.env.HEYNOTAI_E2E_CHANNEL]
  : ['msedge', 'chrome'];

/** Loads the built extension into a throwaway persistent profile and
 *  waits for its service worker, so a channel that silently ignores
 *  `--load-extension` is rejected instead of producing a context with
 *  no extension in it. */
export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'heynotai-e2e-'));
    const args = [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--no-default-browser-check',
    ];

    let context: BrowserContext | null = null;
    const failures: string[] = [];
    for (const channel of CHANNELS) {
      let candidate: BrowserContext | null = null;
      try {
        candidate = await chromium.launchPersistentContext(userDataDir, {
          channel,
          args,
        });
        const worker =
          candidate.serviceWorkers()[0] ??
          (await Promise.race([
            candidate.waitForEvent('serviceworker'),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 12_000)),
          ]));
        if (!worker) {
          failures.push(`${channel}: launched but loaded no extension`);
          await candidate.close();
          continue;
        }
        context = candidate;
        break;
      } catch (error) {
        await candidate?.close().catch(() => undefined);
        failures.push(
          `${channel}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
        );
      }
    }
    if (!context) {
      throw new Error(
        `Could not launch a browser that loads unpacked extensions.\n${failures.join('\n')}`,
      );
    }

    await use(context);
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  },

  worker: async ({ context }, use) => {
    const existing = context.serviceWorkers()[0];
    const worker = existing ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },

  extensionId: async ({ worker }, use) => {
    // chrome-extension://<id>/background.js
    await use(new URL(worker.url()).host);
  },
});

export const expect = test.expect;

/** Seeds a signed-in session, so specs can exercise the authenticated
 *  surfaces without running the real website handoff (which needs an
 *  interactive OAuth window).
 *
 *  Two keys, deliberately: `heynotai_backend_auth` is what the drawer's
 *  `BackendAuthStore` hydrates from, and `heynotai_auth` is the smaller
 *  blob the service worker reads so it can call /scans without bundling
 *  the client. Seeding only one leaves half the extension logged out. */
export async function seedAuth(
  worker: Worker,
  value: { token: string; userId: string; plan: string; email?: string },
): Promise<void> {
  await worker.evaluate(async (auth) => {
    const record = {
      id: auth.userId,
      email: auth.email ?? 'tester@heynotai.local',
      name: 'Test User',
      plan: auth.plan,
      verified: true,
      collectionId: 'users',
      collectionName: 'users',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:00.000Z',
    };
    await chrome.storage.local.set({
      heynotai_auth: {
        token: auth.token,
        userId: auth.userId,
        plan: auth.plan,
      },
      heynotai_backend_auth: {
        token: auth.token,
        refreshToken: `${auth.token}-refresh`,
        record,
      },
    });
  }, value);
}

/** Writes the mirrored prefs blob that the content script and worker
 *  gate on — the same shape `state.tsx` publishes. */
export async function seedPrefs(
  worker: Worker,
  prefs: Record<string, unknown>,
): Promise<void> {
  await worker.evaluate(async (value) => {
    await chrome.storage.local.set({ extensionPrefs: value });
  }, prefs);
}

export async function readStorage(
  worker: Worker,
  key: string,
): Promise<unknown> {
  return worker.evaluate(async (k) => {
    const out = await chrome.storage.local.get(k);
    return out[k] ?? null;
  }, key);
}
