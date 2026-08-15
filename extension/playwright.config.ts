import { defineConfig } from '@playwright/test';

/** End-to-end suite for the built MV3 extension.
 *
 *  These run against `.output/chrome-mv3`, loaded unpacked into a real
 *  Chromium profile — the same artifact that ships. Run `pnpm build`
 *  first (the `e2e` script does). Unit-level rules live in the vitest
 *  suite; this file is for the things only a browser can answer: does
 *  the worker register, does the content script attach, does the drawer
 *  open and close, do preference toggles reach storage. */
export default defineConfig({
  testDir: './e2e',
  // Extensions need a persistent context, and several specs mutate the
  // same chrome.storage — run them in order rather than in parallel.
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    // A headed context is required for MV3 service workers in older
    // Chromium builds; the new headless mode supports them.
    trace: 'off',
  },
});
