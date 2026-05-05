// Builds the Chrome extension zip and copies it into public/downloads/
// so /install can serve it as a static asset. Soft-fails: if anything goes
// wrong (extension deps missing, wxt not installed, etc.) we warn and let
// `next build` continue — the install page will render a "temporarily
// unavailable" state when the file is absent.

import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const extensionOut = join(repoRoot, "extension", ".output");
const dest = join(repoRoot, "frontend", "public", "downloads", "heynotai-extension.zip");

function warn(msg) {
  console.warn(`[build-extension-zip] ${msg}`);
}

try {
  console.log("[build-extension-zip] running wxt zip…");
  execSync("pnpm --filter @heynotai/extension zip", {
    stdio: "inherit",
    cwd: repoRoot,
  });
} catch (err) {
  warn(`wxt zip failed (${err.message}); skipping copy. /install will serve a fallback.`);
  process.exit(0);
}

if (!existsSync(extensionOut)) {
  warn(`expected ${extensionOut} to exist after wxt zip; skipping.`);
  process.exit(0);
}

const candidates = readdirSync(extensionOut)
  .filter((name) => name.endsWith("-chrome.zip"))
  .map((name) => {
    const full = join(extensionOut, name);
    return { full, mtime: statSync(full).mtimeMs };
  })
  .sort((a, b) => b.mtime - a.mtime);

if (candidates.length === 0) {
  warn(`no *-chrome.zip found in ${extensionOut}; skipping.`);
  process.exit(0);
}

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(candidates[0].full, dest);
console.log(`[build-extension-zip] copied ${candidates[0].full} → ${dest}`);
