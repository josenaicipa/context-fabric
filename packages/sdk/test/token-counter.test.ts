import test from "node:test";
import assert from "node:assert/strict";
import {
  Budgeter,
  Fabric,
  tokenEstimate,
  type ContextChunk,
  type TokenCounter,
} from "../src/index.js";

const chunks: ContextChunk[] = [
  { id: "a", text: "x".repeat(400), project: "acme-shop", sensitivity: "public", score: 3 },
  { id: "b", text: "y".repeat(400), project: "acme-shop", sensitivity: "public", score: 2 },
  { id: "c", text: "z".repeat(400), project: "acme-shop", sensitivity: "public", score: 1 },
];

test("Budgeter uses the built-in estimate by default", () => {
  // 400 chars ~= 100 tokens each; budget of 250 keeps two chunks.
  const result = new Budgeter({ maxTokens: 250 }).fit(chunks);
  assert.deepEqual(
    result.kept.map((c) => c.id),
    ["a", "b"],
  );
  assert.equal(result.totalTokens, tokenEstimate(chunks[0].text) * 2);
});

test("Budgeter accepts a pluggable token counter", () => {
  // A counter twice as expensive halves what fits in the same budget.
  const doubleCost: TokenCounter = (text) => tokenEstimate(text) * 2;
  const result = new Budgeter({ maxTokens: 250 }, doubleCost).fit(chunks);
  assert.deepEqual(
    result.kept.map((c) => c.id),
    ["a"],
  );
  assert.deepEqual(result.dropped, ["b", "c"]);
});

test("Fabric threads a custom token counter through budgeting and drop accounting", () => {
  const calls: string[] = [];
  const counting: TokenCounter = (text) => {
    calls.push(text.slice(0, 1));
    return tokenEstimate(text) * 2;
  };
  const fabric = new Fabric({ budget: { maxTokens: 250 } }, { tokenCounter: counting });
  const bundle = fabric.assemble({ query: "q", project: "acme-shop" }, chunks);
  assert.deepEqual(
    bundle.chunks.map((c) => c.id),
    ["a"],
  );
  assert.ok(calls.length > 0, "custom counter must be invoked");
  // over_budget drop records use the custom counter too.
  const dropB = bundle.droppedChunks.find((d) => d.id === "b");
  assert.equal(dropB?.tokens, tokenEstimate(chunks[1].text) * 2);
});
