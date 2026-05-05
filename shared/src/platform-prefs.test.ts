import { describe, it, expect } from "vitest";
import {
  migrateLegacyPlatforms,
  surfacesEnabled,
  PLATFORM_SURFACES,
  type Platforms,
} from "./index.js";

describe("migrateLegacyPlatforms", () => {
  const allOn = (): Platforms => ({
    youtube: { enabled: true, surfaces: { videos: true, reels: true } },
    instagram: { enabled: true, surfaces: { posts: true, reels: true } },
    facebook: { enabled: true, surfaces: { posts: true, reels: true } },
  });

  it("returns the all-enabled fallback for null", () => {
    expect(migrateLegacyPlatforms(null)).toEqual(allOn());
  });

  it("returns the all-enabled fallback for undefined", () => {
    expect(migrateLegacyPlatforms(undefined)).toEqual(allOn());
  });

  it("returns the all-enabled fallback for non-object scalars", () => {
    expect(migrateLegacyPlatforms("nope")).toEqual(allOn());
    expect(migrateLegacyPlatforms(42)).toEqual(allOn());
    expect(migrateLegacyPlatforms(true)).toEqual(allOn());
  });

  it("expands a fully on legacy bool record", () => {
    const out = migrateLegacyPlatforms({
      youtube: true,
      instagram: true,
      facebook: true,
    });
    expect(out).toEqual(allOn());
  });

  it("propagates a legacy false bool to every surface for that platform", () => {
    const out = migrateLegacyPlatforms({
      youtube: false,
      instagram: true,
      facebook: true,
    });
    expect(out.youtube).toEqual({
      enabled: false,
      surfaces: { videos: false, reels: false },
    });
    expect(out.instagram.enabled).toBe(true);
    expect(out.facebook.enabled).toBe(true);
  });

  it("preserves a fully nested payload verbatim", () => {
    const input = {
      youtube: { enabled: true, surfaces: { videos: false, reels: true } },
      instagram: { enabled: false, surfaces: { posts: false, reels: false } },
      facebook: { enabled: true, surfaces: { posts: true, reels: false } },
    };
    expect(migrateLegacyPlatforms(input)).toEqual(input);
  });

  it("fills missing surface keys with true and keeps the ones set", () => {
    const out = migrateLegacyPlatforms({
      instagram: { enabled: true, surfaces: { posts: false } },
    });
    expect(out.instagram).toEqual({
      enabled: true,
      surfaces: { posts: false, reels: true },
    });
  });

  it("treats a missing `surfaces` object as 'all on'", () => {
    const out = migrateLegacyPlatforms({
      youtube: { enabled: false },
    });
    expect(out.youtube).toEqual({
      enabled: false,
      surfaces: { videos: true, reels: true },
    });
  });

  it("falls back to enabled=true when `enabled` is not a boolean", () => {
    const out = migrateLegacyPlatforms({
      facebook: { enabled: "yes", surfaces: { posts: false, reels: true } },
    });
    expect(out.facebook.enabled).toBe(true);
    expect(out.facebook.surfaces).toEqual({ posts: false, reels: true });
  });

  it("coerces non-boolean surface values to true", () => {
    const out = migrateLegacyPlatforms({
      youtube: { enabled: true, surfaces: { videos: "on", reels: 0 } },
    });
    expect(out.youtube.surfaces).toEqual({ videos: true, reels: true });
  });

  it("treats a non-object `surfaces` field as missing", () => {
    const out = migrateLegacyPlatforms({
      youtube: { enabled: true, surfaces: "junk" },
    });
    expect(out.youtube).toEqual({
      enabled: true,
      surfaces: { videos: true, reels: true },
    });
  });

  it("handles a mixed legacy + nested payload", () => {
    const out = migrateLegacyPlatforms({
      youtube: true,
      instagram: { enabled: false, surfaces: { posts: true, reels: false } },
    });
    expect(out.youtube).toEqual({
      enabled: true,
      surfaces: { videos: true, reels: true },
    });
    expect(out.instagram).toEqual({
      enabled: false,
      surfaces: { posts: true, reels: false },
    });
    expect(out.facebook).toEqual({
      enabled: true,
      surfaces: { posts: true, reels: true },
    });
  });

  it("drops unknown platform keys", () => {
    const out = migrateLegacyPlatforms({
      youtube: false,
      tiktok: true,
      twitter: { enabled: false },
    });
    expect(Object.keys(out)).toEqual(["youtube", "instagram", "facebook"]);
    expect(out).not.toHaveProperty("tiktok");
    expect(out).not.toHaveProperty("twitter");
  });

  it("emits keys in stable order regardless of input order", () => {
    const out = migrateLegacyPlatforms({
      facebook: true,
      youtube: true,
      instagram: true,
    });
    expect(Object.keys(out)).toEqual(["youtube", "instagram", "facebook"]);
  });
});

describe("surfacesEnabled", () => {
  it("returns all surfaces when master + every surface is on", () => {
    const platforms = migrateLegacyPlatforms(null);
    expect(surfacesEnabled(platforms, "youtube")).toEqual(["videos", "reels"]);
    expect(surfacesEnabled(platforms, "instagram")).toEqual(["posts", "reels"]);
    expect(surfacesEnabled(platforms, "facebook")).toEqual(["posts", "reels"]);
  });

  it("filters out the surfaces flagged false", () => {
    const platforms = migrateLegacyPlatforms({
      youtube: { enabled: true, surfaces: { videos: true, reels: false } },
    });
    expect(surfacesEnabled(platforms, "youtube")).toEqual(["videos"]);
  });

  it("returns nothing when all surfaces are off but master is on", () => {
    const platforms = migrateLegacyPlatforms({
      instagram: { enabled: true, surfaces: { posts: false, reels: false } },
    });
    expect(surfacesEnabled(platforms, "instagram")).toEqual([]);
  });

  it("returns nothing when the master toggle is off, regardless of surfaces", () => {
    const platforms = migrateLegacyPlatforms({
      facebook: { enabled: false, surfaces: { posts: true, reels: true } },
    });
    expect(surfacesEnabled(platforms, "facebook")).toEqual([]);
  });

  it("preserves the canonical surface order from PLATFORM_SURFACES", () => {
    const platforms = migrateLegacyPlatforms(null);
    expect(surfacesEnabled(platforms, "youtube")).toEqual([
      ...PLATFORM_SURFACES.youtube,
    ]);
  });
});
