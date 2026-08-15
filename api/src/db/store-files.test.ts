import assert from "node:assert/strict";
import test from "node:test";

import { storeFileUrl, verifySignedFileUrl } from "./store-files.js";

test("signed file URLs are absolute, expire, and bind every path component", () => {
  const previousSecret = process.env.FILE_URL_SECRET;
  const previousBase = process.env.API_PUBLIC_URL;
  process.env.FILE_URL_SECRET = "file-url-test-secret-that-is-long-enough-123456";
  process.env.API_PUBLIC_URL = "https://api.example.test/";
  try {
    const raw = storeFileUrl(
      { id: "abc123abc123abc", collectionName: "scans" },
      "clip.mp4",
    );
    const url = new URL(raw);
    assert.equal(url.origin, "https://api.example.test");
    const exp = url.searchParams.get("exp") ?? undefined;
    const sig = url.searchParams.get("sig") ?? undefined;
    assert.equal(
      verifySignedFileUrl({
        collection: "scans",
        recordId: "abc123abc123abc",
        fileName: "clip.mp4",
        expiresAt: exp,
        signature: sig,
      }),
      true,
    );
    assert.equal(
      verifySignedFileUrl({
        collection: "scans",
        recordId: "different",
        fileName: "clip.mp4",
        expiresAt: exp,
        signature: sig,
      }),
      false,
    );
    assert.equal(
      verifySignedFileUrl({
        collection: "scans",
        recordId: "abc123abc123abc",
        fileName: "clip.mp4",
        expiresAt: 1,
        signature: sig,
      }),
      false,
    );
  } finally {
    if (previousSecret === undefined) delete process.env.FILE_URL_SECRET;
    else process.env.FILE_URL_SECRET = previousSecret;
    if (previousBase === undefined) delete process.env.API_PUBLIC_URL;
    else process.env.API_PUBLIC_URL = previousBase;
  }
});

