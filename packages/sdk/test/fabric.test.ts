import { test } from "node:test";
import assert from "node:assert/strict";
import { Fabric } from "../src/fabric.js";
import { auditBundle } from "../src/policy.js";
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
    { query: "checkout", project: "acme", channel: "#acme", maxSensitivity: "internal" },
    corpus(),
  );
  assert.deepEqual(
    bundle.chunks.map((c) => c.id),
    ["in_scope"],
  );
  assert.ok(!bundleToText(bundle).includes("billing@example.com"));
  assert.ok(bundle.redactions >= 1);
  assert.ok(bundle.totalTokens > 0);
});

test("fail-closed: default assemble keeps only public chunks and passes default audit", () => {
  const chunks: ContextChunk[] = [
    {
      id: "pub",
      text: "Acme public checkout overview.",
      project: "acme",
      channel: "#acme",
      sensitivity: "public",
      score: 1,
    },
    {
      id: "int",
      text: "Acme internal-only routing note.",
      project: "acme",
      channel: "#acme",
      sensitivity: "internal",
      score: 2,
    },
    {
      id: "rst",
      text: "Acme restricted incident detail.",
      project: "acme",
      channel: "#acme",
      sensitivity: "restricted",
      score: 3,
    },
  ];
  // No maxSensitivity on the request: the fail-closed default ceiling is public.
  const bundle = new Fabric().assemble(
    { query: "checkout", project: "acme", channel: "#acme" },
    chunks,
  );

  assert.deepEqual(
    bundle.chunks.map((c) => c.id),
    ["pub"],
    "only the public chunk should survive by default",
  );
  const blocked = new Map(bundle.droppedChunks.map((d) => [d.id, d.reason]));
  assert.equal(blocked.get("int"), "sensitivity_blocked");
  assert.equal(blocked.get("rst"), "sensitivity_blocked");

  // Invariant: a default bundle over public-safe input passes the default audit.
  const audit = auditBundle(bundle);
  assert.equal(audit.passed, true, JSON.stringify(audit.findings));
});

test("unmarked chunks are treated as internal and excluded by the default ceiling", () => {
  const chunks: ContextChunk[] = [
    {
      id: "unmarked",
      text: "No explicit sensitivity, so internal by default.",
      project: "acme",
      channel: "#acme",
      score: 1,
    },
  ];
  const bundle = new Fabric().assemble({ query: "q", project: "acme", channel: "#acme" }, chunks);
  assert.deepEqual(
    bundle.chunks.map((c) => c.id),
    [],
  );
  assert.equal(auditBundle(bundle).passed, true);
});

test("dedupe uses a full-text fingerprint, not a 400-char prefix", () => {
  const sharedPrefix = "A".repeat(450);
  const chunks: ContextChunk[] = [
    {
      id: "long-a",
      text: `${sharedPrefix} unique tail alpha`,
      project: "acme",
      channel: "#acme",
      sensitivity: "public",
      score: 2,
    },
    {
      id: "long-b",
      text: `${sharedPrefix} unique tail beta`,
      project: "acme",
      channel: "#acme",
      sensitivity: "public",
      score: 1,
    },
    {
      id: "dup-of-a",
      text: `${sharedPrefix} unique tail alpha`,
      project: "acme",
      channel: "#acme",
      sensitivity: "public",
      score: 0,
    },
  ];
  const bundle = new Fabric({ budget: { maxTokens: 100000 } }).assemble(
    { query: "q", project: "acme", channel: "#acme" },
    chunks,
  );
  // long-a and long-b share their first 400 chars but differ later: both kept.
  assert.ok(bundle.chunks.some((c) => c.id === "long-a"));
  assert.ok(bundle.chunks.some((c) => c.id === "long-b"));
  // dup-of-a is a true duplicate of long-a: dropped as duplicate.
  const reasons = new Map(bundle.droppedChunks.map((d) => [d.id, d.reason]));
  assert.equal(reasons.get("dup-of-a"), "duplicate");
});

test("pipeline drops chunks over budget", () => {
  const chunks: ContextChunk[] = [
    { id: "a", text: "x".repeat(400), project: "acme", channel: "#acme", score: 2 },
    { id: "b", text: "x".repeat(400), project: "acme", channel: "#acme", score: 1 },
  ];
  const bundle = new Fabric({ budget: { maxTokens: 120 } }).assemble(
    { query: "q", project: "acme", channel: "#acme", maxSensitivity: "internal" },
    chunks,
  );
  assert.deepEqual(
    bundle.chunks.map((c) => c.id),
    ["a"],
  );
  assert.ok(bundle.droppedChunkIds.includes("b"));
});

test("pipeline prioritizes must_keep before budget trimming", () => {
  const chunks: ContextChunk[] = [
    { id: "optional", text: "x".repeat(400), project: "acme", channel: "#acme", score: 100 },
    {
      id: "critical",
      text: "y".repeat(400),
      project: "acme",
      channel: "#acme",
      tags: ["must_keep"],
      score: 0,
    },
  ];
  const bundle = new Fabric({ budget: { maxTokens: 120 } }).assemble(
    { query: "q", project: "acme", channel: "#acme", maxChunks: 2, maxSensitivity: "internal" },
    chunks,
  );
  assert.deepEqual(
    bundle.chunks.map((c) => c.id),
    ["critical"],
  );
  assert.ok(bundle.droppedChunkIds.includes("optional"));
});

test("pipeline warns when critical chunk drops by budget", () => {
  const chunks: ContextChunk[] = [
    {
      id: "critical-a",
      text: "x".repeat(400),
      project: "acme",
      channel: "#acme",
      tags: ["must_keep"],
      score: 2,
    },
    {
      id: "critical-b",
      text: "y".repeat(400),
      project: "acme",
      channel: "#acme",
      tags: ["critical"],
      score: 1,
    },
  ];
  const bundle = new Fabric({ budget: { maxTokens: 120 } }).assemble(
    { query: "q", project: "acme", channel: "#acme", maxChunks: 2, maxSensitivity: "internal" },
    chunks,
  );
  assert.deepEqual(
    bundle.chunks.map((c) => c.id),
    ["critical-a"],
  );
  assert.ok(bundle.droppedChunkIds.includes("critical-b"));
  assert.ok(bundle.warnings.some((warning) => warning.code === "critical_dropped"));
});
