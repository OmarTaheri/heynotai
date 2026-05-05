# Unit Tests — Platform Preferences (Core Feature)

## 1. The Core Feature

heynotai is a browser extension that detects AI-generated content as the user
browses the web. The extension only runs on the platforms the user has opted
into, and on the *surfaces* (sub-areas) within each platform that the user
wants scanned.

The user controls this from two places:

- the drawer's **Settings** tab (inside the extension), and
- the `/app/extension` page on the web frontend.

Both surfaces edit the same `extension_prefs.platforms` record in PocketBase.
That record is a nested object of the form:

```ts
{
  youtube:   { enabled: boolean, surfaces: { videos: boolean, reels: boolean } },
  instagram: { enabled: boolean, surfaces: { posts:  boolean, reels: boolean } },
  facebook:  { enabled: boolean, surfaces: { posts:  boolean, reels: boolean } },
}
```

Two pure helpers in `shared/src/index.ts` decide what the extension actually
scans:

| Function | Job |
|---|---|
| `migrateLegacyPlatforms(raw)` | Read the stored value (which can be a current nested object, an old flat `Record<PlatformKey, boolean>`, a partial object, or garbage) and return the canonical nested shape. |
| `surfacesEnabled(platforms, p)` | Return the list of surface keys for platform `p` that are both master-enabled AND surface-enabled. Content scripts call this on every page load. |

### Why these two are the core

If `migrateLegacyPlatforms` is wrong, the user's stored intent is *lost* — they
toggled YouTube off three months ago, now it's silently on again, and the
extension scans content they never wanted scanned. That's a privacy bug.

If `surfacesEnabled` is wrong, the content script either scans nothing
(broken product) or scans surfaces the user disabled (privacy bug, again).

Together they govern **which content the product even sees**. That's the
single most important boundary in the codebase — testing it first matters
more than testing the UI on top of it.

### Testing tool

[**Vitest**](https://vitest.dev/) — picked because the monorepo is ESM-only,
strict TypeScript, with `moduleResolution: "bundler"` and `.js`-suffixed
imports. Vitest runs `.ts` files directly through Vite, so no Babel, no
`ts-jest`, no config file. The `shared` workspace already has it installed
from the auth-errors test setup.

Run the suite:

```bash
pnpm --filter @heynotai/shared test
```

The test file lives next to the source: `shared/src/platform-prefs.test.ts`.

---

## 2. Test Cases

The suite has **19 tests** in 2 `describe` blocks. Each test maps to one
documented branch of the code under test. Below: what the test does, what
input it uses, and *why* this case matters in production.

### `describe("migrateLegacyPlatforms")` — 14 tests

#### Group A: Garbage input must not crash the extension

| # | Case | Input | Expected | Why it matters |
|---|---|---|---|---|
| 1 | null | `null` | full all-on default | First-time install: the field doesn't exist yet. |
| 2 | undefined | `undefined` | full all-on default | Field deleted by an old client; we can't NPE. |
| 3 | scalar | `"nope"`, `42`, `true` | full all-on default | Defensive — any corrupt row must yield a usable shape. |

#### Group B: Legacy flat-bool format (the original schema)

| # | Case | Input | Expected | Why it matters |
|---|---|---|---|---|
| 4 | all-true legacy | `{ youtube: true, instagram: true, facebook: true }` | full all-on default | Old rows from before we added surfaces should "just work". |
| 5 | one platform false | `{ youtube: false, instagram: true, facebook: true }` | youtube fully off (master + both surfaces) | A user who muted YouTube must stay muted on every YouTube surface. **Critical privacy guarantee.** |

#### Group C: Current nested format

| # | Case | Input | Expected | Why it matters |
|---|---|---|---|---|
| 6 | fully-specified payload | mixed enabled/surfaces | identical output | The happy path round-trips losslessly. |
| 7 | partial surfaces | `{ instagram: { enabled: true, surfaces: { posts: false } } }` | `posts:false, reels:true` | Newly-added surface keys default to "on" — the user never opted out of a key that didn't exist when they last saved. |
| 8 | missing `surfaces` field | `{ youtube: { enabled: false } }` | `surfaces: { videos:true, reels:true }` | Old client wrote only `enabled`; the surfaces map didn't exist yet. |

#### Group D: Type coercion (defensive against bad writes)

| # | Case | Input | Expected | Why it matters |
|---|---|---|---|---|
| 9 | non-boolean `enabled` | `enabled: "yes"` | `enabled: true` (fallback) | A buggy client could write a string. The migration shouldn't propagate the corruption. |
| 10 | non-boolean surface values | `surfaces: { videos: "on", reels: 0 }` | both `true` | Same reasoning; refuse to propagate type bugs. |
| 11 | non-object `surfaces` | `surfaces: "junk"` | full surfaces default | Same. |

#### Group E: Real-world mixes & forward compat

| # | Case | Input | Expected | Why it matters |
|---|---|---|---|---|
| 12 | mixed legacy + nested | `{ youtube: true, instagram: { enabled: false, surfaces: {...} } }` | each handled in its own format | Realistic during the migration window. |
| 13 | unknown extra keys | `{ youtube: false, tiktok: true, twitter: {...} }` | only the 3 official keys present | Future schema changes / typo'd writes can't leak phantom platforms. |
| 14 | order-independent input | input keyed `facebook, youtube, instagram` | output keyed `youtube, instagram, facebook` | The frontend uses `JSON.stringify(prefs)` for a dirty-check. Stable key order means "no logical change" → "no stringification change" → no false-positive save banners. |

### `describe("surfacesEnabled")` — 5 tests

| # | Case | Input | Expected | Why it matters |
|---|---|---|---|---|
| 15 | everything on | full default | every surface returned | Sanity — the happy path lights up. |
| 16 | one surface off | `{ videos:true, reels:false }` | `["videos"]` | The content script must scan one surface but not the other. |
| 17 | all surfaces off, master on | `{ posts:false, reels:false }` | `[]` | Even with the master "on", an empty surface set means nothing is scanned. |
| 18 | master off | `enabled: false, surfaces: { posts:true, reels:true }` | `[]` | Master toggle wins. The user opting out at the platform level overrides any leftover per-surface "on" flags — important so we don't silently re-enable scanning when the user re-enables the master. |
| 19 | canonical order | full default | exactly `PLATFORM_SURFACES.youtube` | Downstream code may render these in order; the contract must be stable. |

> Test #19 isn't strictly different output from #15, but it asserts against
> the source-of-truth constant rather than a hard-coded array — it would
> catch a future change to `PLATFORM_SURFACES` that #15 wouldn't.

### Test count summary

- `migrateLegacyPlatforms`: 14 `it` blocks (one of them runs 3 sub-cases for scalars, but counts as 1 test).
- `surfacesEnabled`: 5 `it` blocks.
- Total: **19 `it` blocks** when the file is run by Vitest.

(Actual `vitest run --reporter=verbose` confirms 19 tests for this file
alongside 20 from `auth-errors.test.ts` for a repo total of 39.)

---

## 3. The Test Code

The test file (`shared/src/platform-prefs.test.ts`) is plain Vitest. Each block
corresponds 1-to-1 with a row in the table above. Excerpt:

```ts
import { describe, it, expect } from "vitest";
import {
  migrateLegacyPlatforms,
  surfacesEnabled,
  PLATFORM_SURFACES,
  type Platforms,
} from "./index.js";

describe("migrateLegacyPlatforms", () => {
  const allOn = (): Platforms => ({
    youtube:   { enabled: true, surfaces: { videos: true, reels: true } },
    instagram: { enabled: true, surfaces: { posts: true, reels: true } },
    facebook:  { enabled: true, surfaces: { posts: true, reels: true } },
  });

  it("propagates a legacy false bool to every surface for that platform", () => {
    const out = migrateLegacyPlatforms({
      youtube: false, instagram: true, facebook: true,
    });
    expect(out.youtube).toEqual({
      enabled: false,
      surfaces: { videos: false, reels: false },
    });
    expect(out.instagram.enabled).toBe(true);
    expect(out.facebook.enabled).toBe(true);
  });

  // ...13 more cases
});

describe("surfacesEnabled", () => {
  it("returns nothing when the master toggle is off, regardless of surfaces", () => {
    const platforms = migrateLegacyPlatforms({
      facebook: { enabled: false, surfaces: { posts: true, reels: true } },
    });
    expect(surfacesEnabled(platforms, "facebook")).toEqual([]);
  });

  // ...4 more cases
});
```

Key style decisions:

- **No mocks.** Both functions are pure, so every test is just `expect(fn(input)).toEqual(output)`. This is what makes them ideal as a first test — there's no test infra to debug, only the function under test.
- **Inputs typed as `unknown`.** `migrateLegacyPlatforms` takes `unknown` by design (it's the migration boundary), so the tests pass raw object literals — no type-cast gymnastics needed.
- **Helpers, not setup.** The `allOn()` factory inside the `describe` returns a fresh object each call, so individual tests can mutate freely without bleeding into each other.

---

## 4. How To Run It

```bash
# the new platforms suite + the existing auth-errors suite
pnpm --filter @heynotai/shared test

# from the repo root, fan out (skips workspaces with no `test` script)
pnpm test

# type-check the test file along with the rest of `shared`
pnpm --filter @heynotai/shared typecheck
```

Expected output:

```
 Test Files  2 passed (2)
      Tests  39 passed (39)
   Duration  ~400ms
```

If a future refactor breaks one of the privacy guarantees (e.g. someone changes
`migrateLegacyPlatforms` so a legacy `false` only flips the master and leaves
surfaces on), the corresponding test fails with a precise diff pointing at
`out.youtube.surfaces.videos` — exactly the line of the contract the change
violated.
