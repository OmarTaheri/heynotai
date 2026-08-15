import assert from "node:assert/strict";
import test from "node:test";

import { buildModelRequest, renderTemplate } from "./request-builder.js";
import { ModelRuntimeError, type ProviderConfig, type RuntimeModel } from "./types.js";

const remote: ProviderConfig = {
  key: "hf",
  driver: "huggingface",
  baseUrl: "https://router.huggingface.co/hf-inference/models",
  authScheme: "bearer",
  credential: "secret-token",
};

test("builds a Hugging Face JSON request and preserves exact template types", () => {
  const model: RuntimeModel = {
    slug: "text-model",
    type: "txt",
    externalModelId: "owner/model",
    requestSpec: {
      bodyMode: "json",
      body: { inputs: "{{input.text}}", metadata: "{{input.metadata}}" },
    },
    responseSpec: { preset: "classification-list" },
  };
  const request = buildModelRequest(remote, model, {
    kind: "txt",
    text: "hello",
    metadata: { source: "test" },
  });

  assert.equal(
    request.url,
    "https://router.huggingface.co/hf-inference/models/owner/model",
  );
  assert.equal(request.headers.Authorization, "Bearer secret-token");
  assert.deepEqual(JSON.parse(String(request.body)), {
    inputs: "hello",
    metadata: { source: "test" },
  });
});

test("builds multipart requests without setting an invalid manual boundary", async () => {
  const model: RuntimeModel = {
    slug: "audio-model",
    type: "aud",
    requestSpec: {
      path: "/detect",
      bodyMode: "multipart",
      fileField: "upload_file",
      fields: { language: "en", seconds: "{{input.durationSec}}" },
    },
    responseSpec: { preset: "segments" },
  };
  const request = buildModelRequest(
    {
      key: "local",
      driver: "local-http",
      baseUrl: "http://model:8000",
      isLocal: true,
      config: { allowedHosts: ["model"] },
    },
    model,
    {
      kind: "aud",
      bytes: Buffer.from("audio"),
      mime: "audio/wav",
      fileName: "clip.wav",
      durationSec: 4,
    },
  );

  assert.ok(request.body instanceof FormData);
  assert.equal(request.headers["Content-Type"], undefined);
  assert.equal(request.body.get("language"), "en");
  assert.equal(request.body.get("seconds"), "4");
  const file = request.body.get("upload_file");
  assert.ok(file instanceof File);
  assert.equal(file.name, "clip.wav");
  assert.equal(await file.text(), "audio");
});

test("rejects remote providers that target private network literals", () => {
  const model: RuntimeModel = {
    slug: "unsafe",
    type: "txt",
    requestSpec: { url: "http://127.0.0.1:9000/detect", bodyMode: "json" },
    responseSpec: { preset: "scalar-score" },
  };
  assert.throws(
    () => buildModelRequest({ ...remote, driver: "http" }, model, { kind: "txt", text: "x" }),
    (error: unknown) =>
      error instanceof ModelRuntimeError &&
      (error.code === "insecure_provider_url" || error.code === "private_provider_url"),
  );
});

test("requires local runtime hosts to be explicitly allowlisted", () => {
  const model: RuntimeModel = {
    slug: "local-unsafe",
    type: "txt",
    requestSpec: { path: "/detect", bodyMode: "json" },
    responseSpec: { preset: "scalar-score" },
  };
  assert.throws(
    () => buildModelRequest(
      { key: "local", driver: "local-http", baseUrl: "http://metadata:8080", isLocal: true },
      model,
      { kind: "txt", text: "x" },
    ),
    (error: unknown) =>
      error instanceof ModelRuntimeError && error.code === "local_provider_host_not_allowed",
  );
});

test("template renderer blocks prototype traversal", () => {
  assert.throws(
    () => renderTemplate("{{input.__proto__}}", { input: {} }),
    (error: unknown) => error instanceof ModelRuntimeError && error.code === "unsafe_template",
  );
});
