import assert from "node:assert/strict";
import test from "node:test";

import { extractPath } from "./path.js";
import { normalizeModelResponse } from "./response-mapper.js";
import { ModelRuntimeError } from "./types.js";

test("normalizes nested classification lists", () => {
  const result = normalizeModelResponse(
    [[
      { label: "human", score: 0.08 },
      { label: "AI-generated", score: 0.92 },
    ]],
    {
      preset: "classification-list",
      labelPath: "label",
      scorePath: "score",
    },
    { model: "classifier" },
  );
  assert.equal(result.verdict, "ai");
  assert.equal(result.aiProbability, 92);
  assert.equal(result.confidence, 92);
  assert.equal(result.model, "classifier");
});

test("maps percent scalar scores with inversion", () => {
  const result = normalizeModelResponse(
    { data: { human_probability: 87 } },
    {
      preset: "scalar-score",
      scorePath: "data.human_probability",
      scoreScale: "percent",
      invertScore: true,
    },
  );
  assert.equal(result.verdict, "human");
  assert.equal(result.aiProbability, 13);
  assert.equal(result.confidence, 87);
});

test("maps verdict confidence into AI probability", () => {
  const result = normalizeModelResponse(
    { answer: "authentic", certainty: 0.9 },
    {
      preset: "verdict",
      verdictPath: "answer",
      confidencePath: "certainty",
      verdictMap: { authentic: "human" },
    },
  );
  assert.equal(result.verdict, "human");
  assert.equal(result.aiProbability, 10);
});

test("aggregates Velma-like segments and ignores no-content", () => {
  const result = normalizeModelResponse(
    {
      frames: [
        { verdict: "no-content", confidence: 1 },
        { verdict: "real", confidence: 0.96 },
        { verdict: "fake", confidence: 0.82 },
      ],
    },
    {
      preset: "segments",
      itemsPath: "frames",
      verdictPath: "verdict",
      confidencePath: "confidence",
      ignoreVerdicts: ["no-content"],
      verdictMap: { real: "human", fake: "ai" },
      aggregation: "max-ai",
    },
  );
  assert.equal(result.verdict, "ai");
  assert.equal(result.aiProbability, 82);
});

test("supports bounded wildcard extraction", () => {
  assert.deepEqual(
    extractPath({ data: [{ score: 1 }, { score: 2 }] }, "data[*].score"),
    [1, 2],
  );
  assert.throws(
    () => extractPath({}, "__proto__.polluted"),
    (error: unknown) => error instanceof ModelRuntimeError && error.code === "unsafe_mapping_path",
  );
});

test("parses a JSON string at a configured path", () => {
  const result = normalizeModelResponse(
    { output: '{"score": 0.73}' },
    {
      preset: "scalar-score",
      parseJsonAtPath: "output",
      scorePath: "score",
    },
  );
  assert.equal(result.verdict, "ai");
  assert.equal(result.aiProbability, 73);
});

