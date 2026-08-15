import assert from "node:assert/strict";
import test from "node:test";

import { executeModel } from "./driver.js";
import { ModelRuntimeError, type ProviderConfig, type RuntimeModel } from "./types.js";

const provider: ProviderConfig = {
  key: "test-http",
  driver: "http",
  baseUrl: "https://models.example.test",
  authScheme: "none",
};

function model(slug: string, limits: RuntimeModel["executionLimits"]): RuntimeModel {
  return {
    slug,
    type: "txt",
    requestSpec: { path: "/detect", bodyMode: "json" },
    responseSpec: { preset: "scalar-score", scorePath: "score" },
    executionLimits: limits,
  };
}

function jsonResponse(score = 0.9): Response {
  return new Response(JSON.stringify({ score }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("fails fast when a model reaches maxConcurrency", async () => {
  let releaseFetch!: () => void;
  const blocker = new Promise<void>((resolve) => {
    releaseFetch = resolve;
  });
  const firstFetch: typeof fetch = async () => {
    await blocker;
    return jsonResponse();
  };
  const runtimeModel = model("concurrency-test", {
    maxConcurrency: 1,
    requestsPerMinute: 10,
  });
  const first = executeModel(provider, runtimeModel, { kind: "txt", text: "first" }, firstFetch);
  await Promise.resolve();

  await assert.rejects(
    executeModel(provider, runtimeModel, { kind: "txt", text: "second" }, async () => jsonResponse()),
    (error: unknown) =>
      error instanceof ModelRuntimeError &&
      error.code === "model_concurrency_limit" &&
      error.status === 429,
  );
  releaseFetch();
  await first;
});

test("counts provider attempts against requestsPerMinute", async () => {
  const runtimeModel = model("rpm-test", {
    maxConcurrency: 2,
    requestsPerMinute: 1,
  });
  await executeModel(
    provider,
    runtimeModel,
    { kind: "txt", text: "first" },
    async () => jsonResponse(0.2),
  );

  await assert.rejects(
    executeModel(
      provider,
      runtimeModel,
      { kind: "txt", text: "second" },
      async () => jsonResponse(0.2),
    ),
    (error: unknown) =>
      error instanceof ModelRuntimeError &&
      error.code === "model_rate_limit" &&
      error.status === 429,
  );
});

