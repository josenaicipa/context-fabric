/**
 * Fail-closed default contract across every assembly entrypoint.
 *
 * A caller that does not explicitly widen `maxSensitivity` must only ever see
 * `public` chunks — from the Fabric core, runPreflight, the rollout smoke, and
 * the policy audit alike. These tests pin that contract so a future default
 * change cannot silently widen any single entrypoint.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  auditBundle,
  Fabric,
  runRolloutSmoke,
  type ContextChunk,
  type RolloutPolicy,
  type RolloutSmokeCase,
} from "../src/index.js";

const corpus: ContextChunk[] = [
  {
    id: "pub",
    text: "Acme Shop public doc.",
    project: "acme-shop",
    channel: "#acme-shop",
    sensitivity: "public",
    score: 1,
  },
  {
    id: "int",
    text: "Acme Shop internal doc.",
    project: "acme-shop",
    channel: "#acme-shop",
    sensitivity: "internal",
    score: 2,
  },
  {
    id: "untagged",
    text: "Acme Shop doc without a sensitivity tag.",
    project: "acme-shop",
    channel: "#acme-shop",
    score: 3,
  },
];

test("Fabric.assemble defaults to a public ceiling and blocks internal + untagged chunks", () => {
  const bundle = new Fabric().assemble(
    { query: "doc", project: "acme-shop", channel: "#acme-shop" },
    corpus,
  );
  assert.deepEqual(
    bundle.chunks.map((c) => c.id),
    ["pub"],
  );
  // Untagged chunks are treated as internal, so they are blocked too.
  const blocked = bundle.droppedChunks
    .filter((d) => d.reason === "sensitivity_blocked")
    .map((d) => d.id)
    .sort();
  assert.deepEqual(blocked, ["int", "untagged"]);
});

test("Fabric.assemble includes internal chunks only with an explicit ceiling", () => {
  const bundle = new Fabric().assemble(
    { query: "doc", project: "acme-shop", channel: "#acme-shop", maxSensitivity: "internal" },
    corpus,
  );
  assert.deepEqual(bundle.chunks.map((c) => c.id).sort(), ["int", "pub", "untagged"]);
});

test("auditBundle defaults to a public ceiling when the request omits one", () => {
  const bundle = new Fabric().assemble(
    { query: "doc", project: "acme-shop", channel: "#acme-shop", maxSensitivity: "internal" },
    corpus,
  );
  // Re-audit the same chunks as if the request had no explicit ceiling.
  const audit = auditBundle({
    ...bundle,
    request: { ...bundle.request, maxSensitivity: undefined },
  });
  assert.equal(audit.passed, false);
  assert.ok(audit.findings.some((f) => f.code === "sensitivity_ceiling"));
});

const policy: RolloutPolicy = {
  routes: [
    { match: { channel: "#acme-shop" }, scope: { project: "acme-shop", channel: "#acme-shop" } },
  ],
};

function smokeCase(overrides: Partial<RolloutSmokeCase> = {}): RolloutSmokeCase {
  return {
    name: "fail-closed",
    scope: { project: "acme-shop", channel: "#acme-shop" },
    query: "doc",
    chunks: corpus,
    expectedChunkIds: ["pub"],
    forbiddenChunkIds: ["int"],
    ...overrides,
  };
}

test("rollout smoke defaults to a public ceiling when neither case nor route widens it", () => {
  const report = runRolloutSmoke(policy, [smokeCase()]);
  assert.equal(report.passed, true);
  assert.deepEqual(report.caseResults[0].keptChunkIds, ["pub"]);
});

test("rollout smoke leaks internal chunks only behind an explicit case ceiling", () => {
  const report = runRolloutSmoke(policy, [
    smokeCase({
      maxSensitivity: "internal",
      expectedChunkIds: ["pub", "int", "untagged"],
      forbiddenChunkIds: [],
    }),
  ]);
  assert.equal(report.passed, true);
  assert.deepEqual(report.caseResults[0].keptChunkIds.sort(), ["int", "pub", "untagged"]);
});

test("rollout smoke honors a route-level ceiling as the explicit opt-in", () => {
  const widenedPolicy: RolloutPolicy = {
    routes: [
      {
        match: { channel: "#acme-shop" },
        scope: { project: "acme-shop", channel: "#acme-shop" },
        maxSensitivity: "internal",
      },
    ],
  };
  const report = runRolloutSmoke(widenedPolicy, [
    smokeCase({ expectedChunkIds: ["pub", "int"], forbiddenChunkIds: [] }),
  ]);
  assert.equal(report.passed, true);
  assert.ok(report.caseResults[0].keptChunkIds.includes("int"));
});
