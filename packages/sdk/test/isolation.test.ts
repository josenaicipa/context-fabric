import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultIsolationCases,
  isolationScorecardToMarkdown,
  runIsolationScorecard,
} from "../src/index.js";

test("built-in isolation scorecard passes on the public guarantees", () => {
  const scorecard = runIsolationScorecard();
  assert.equal(scorecard.passed, true, JSON.stringify(scorecard.cases, null, 2));
  assert.ok(scorecard.cases.length >= 6);
  assert.match(isolationScorecardToMarkdown(scorecard), /PASS/);
});

test("built-in isolation cases use only allowlisted scopes", () => {
  const allow = new Set(["acme-shop", "other-co", "demo", "example"]);
  for (const item of defaultIsolationCases()) {
    assert.ok(allow.has(item.request.project), item.request.project);
    for (const chunk of item.chunks) {
      assert.ok(allow.has(chunk.project), chunk.project);
    }
  }
});

test("a leaking custom case fails the scorecard", () => {
  const scorecard = runIsolationScorecard([
    {
      name: "must fail",
      request: { query: "q", project: "acme-shop" },
      chunks: [
        {
          id: "leak",
          text: "Other-co note.",
          project: "other-co",
          sensitivity: "public",
          score: 1,
        },
      ],
      mustKeep: ["leak"],
    },
  ]);
  assert.equal(scorecard.passed, false);
  assert.deepEqual(scorecard.cases[0].missing, ["leak"]);
});
