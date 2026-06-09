import { test } from "node:test";
import assert from "node:assert/strict";
import { Fabric } from "../src/fabric.js";
import { bundleToText, type ContextChunk } from "../src/schemas.js";

const corpus = (): ContextChunk[] => [
  {
    id: "in_scope",
    text: "Acme checkout uses a two-step form. Contact billing@example.com.",
    project: "acme",
    channel: "#acme",
    tags: ["approved"],
    score: 1,
  },
  {
    id: "out_of_scope",
    text: "Secret from another project.",
    project: "other",
    channel: "#other",
    score: 99,
  },
];

test("pipeline scopes, sanitizes, and budgets", () => {
  const fabric = new Fabric({
    routing: [{ project: "acme", channel: "#acme", boost: 5 }],
    budget: { maxTokens: 10000 },
  });
  const bundle = fabric.assemble(
    { query: "checkout", project: "acme", channel: "#acme" },
    corpus(),
  );
  assert.deepEqual(bundle.chunks.map((c) => c.id), ["in_scope"]);
  assert.ok(!bundleToText(bundle).includes("billing@example.com"));
  assert.ok(bundle.redactions >= 1);
  assert.ok(bundle.totalTokens > 0);
});

test("pipeline drops chunks over budget", () => {
  const chunks: ContextChunk[] = [
    { id: "a", text: "x".repeat(400), project: "acme", channel: "#acme", score: 2 },
    { id: "b", text: "x".repeat(400), project: "acme", channel: "#acme", score: 1 },
  ];
  const bundle = new Fabric({ budget: { maxTokens: 120 } }).assemble(
    { query: "q", project: "acme", channel: "#acme" },
    chunks,
  );
  assert.deepEqual(bundle.chunks.map((c) => c.id), ["a"]);
  assert.ok(bundle.droppedChunkIds.includes("b"));
});

test("pipeline prioritizes must_keep before budget trimming", () => {
  const chunks: ContextChunk[] = [
    { id: "optional", text: "x".repeat(400), project: "acme", channel: "#acme", score: 100 },
    { id: "critical", text: "y".repeat(400), project: "acme", channel: "#acme", tags: ["must_keep"], score: 0 },
  ];
  const bundle = new Fabric({ budget: { maxTokens: 120 } }).assemble(
    { query: "q", project: "acme", channel: "#acme", maxChunks: 2 },
    chunks,
  );
  assert.deepEqual(bundle.chunks.map((c) => c.id), ["critical"]);
  assert.ok(bundle.droppedChunkIds.includes("optional"));
});
