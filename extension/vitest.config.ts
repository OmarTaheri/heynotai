import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Unit tests run against the extension's plain TypeScript modules —
 *  no WXT build, no browser. Anything that needs a live `chrome.*` or a
 *  real DOM belongs in the Playwright end-to-end suite instead. */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    include: ['lib/**/*.test.ts', 'entrypoints/**/*.test.ts'],
    environment: 'node',
  },
});
