import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractBearerToken,
  hashOpaqueToken,
  hashPassword,
  verifyPassword,
} from "./auth.js";

describe("password hashing", () => {
  it("round-trips a password without storing it", async () => {
    const encoded = await hashPassword("a strong test password");
    assert.match(encoded, /^scrypt\$32768\$8\$1\$/);
    assert.equal(encoded.includes("a strong test password"), false);
    assert.equal(await verifyPassword("a strong test password", encoded), true);
    assert.equal(await verifyPassword("wrong password", encoded), false);
  });

  it("rejects malformed and unsupported hashes", async () => {
    assert.equal(await verifyPassword("anything", null), false);
    assert.equal(await verifyPassword("anything", "bcrypt$bad"), false);
    assert.equal(await verifyPassword("anything", "scrypt$1$1$1$bad$bad"), false);
  });
});

describe("opaque sessions", () => {
  it("hashes tokens deterministically without retaining the token", () => {
    const token = "hnta_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJK";
    const digest = hashOpaqueToken(token);
    assert.match(digest, /^[a-f0-9]{64}$/);
    assert.equal(digest, hashOpaqueToken(token));
    assert.equal(digest.includes(token), false);
  });

  it("accepts only a single bounded Bearer credential", () => {
    assert.equal(extractBearerToken("Bearer abc123"), "abc123");
    assert.equal(extractBearerToken("bearer abc123"), "abc123");
    assert.equal(extractBearerToken("Basic abc123"), null);
    assert.equal(extractBearerToken("Bearer a b"), null);
    assert.equal(extractBearerToken(null), null);
  });
});
