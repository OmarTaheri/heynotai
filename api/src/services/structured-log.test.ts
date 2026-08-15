import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { redactForLog } from "./structured-log.js";

describe("structured log redaction", () => {
  it("redacts nested credentials, cookies, and bearer values", () => {
    const output = redactForLog({
      authorization: "Bearer top-secret",
      nested: {
        refreshToken: "refresh-secret",
        api_key: "provider-secret",
        message: "request failed with Bearer another-secret",
      },
      safe: "kept",
    }) as Record<string, any>;
    assert.equal(output.authorization, "[REDACTED]");
    assert.equal(output.nested.refreshToken, "[REDACTED]");
    assert.equal(output.nested.api_key, "[REDACTED]");
    assert.equal(output.nested.message, "request failed with Bearer [REDACTED]");
    assert.equal(output.safe, "kept");
  });

  it("removes OAuth query values and bounds large strings", () => {
    const output = redactForLog({
      url: "https://api.example/callback?code=secret&state=also-secret&ok=yes",
      large: "x".repeat(10_000),
    }) as Record<string, string>;
    assert.equal(output.url.includes("secret"), false);
    assert.equal(output.url.includes("ok=yes"), true);
    assert.equal(output.large.length < 3_000, true);
    assert.match(output.large, /TRUNCATED/);
  });

  it("handles cycles without throwing", () => {
    const value: Record<string, unknown> = {};
    value.self = value;
    assert.deepEqual(redactForLog(value), { self: "[CIRCULAR]" });
  });
});
