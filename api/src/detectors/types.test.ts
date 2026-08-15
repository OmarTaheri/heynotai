import assert from "node:assert/strict";
import test from "node:test";

import { DetectorError, verdictFromLabels } from "./types.js";

test("rejects empty classifier responses instead of inventing a verdict", () => {
  assert.throws(
    () => verdictFromLabels([]),
    (error) => error instanceof DetectorError && error.status === 502,
  );
});

test("rejects unknown labels instead of treating them as 100 percent AI", () => {
  assert.throws(
    () => verdictFromLabels([{ label: "other", score: 0.9 }]),
    (error) => error instanceof DetectorError && error.status === 502,
  );
});

test("maps recognized AI and human labels", () => {
  assert.deepEqual(
    verdictFromLabels([
      { label: "AI-generated", score: 0.82 },
      { label: "human", score: 0.18 },
    ]),
    { verdict: "ai", confidence: 82 },
  );
});
