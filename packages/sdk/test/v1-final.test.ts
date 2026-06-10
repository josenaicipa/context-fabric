import assert from "node:assert/strict";
import test from "node:test";
import {
  auditBundle,
  buildRepoPack,
  getBudgetProfile,
  resolveChannelRoute,
  runPreflight,
  v1Readiness,
  VERSION,
} from "../src/index.js";

test("v1 readiness contract is true", () => {
  const ready = v1Readiness();
  assert.equal(VERSION, "1.0.0");
  assert.equal(ready.ready, true);
  assert.ok(ready.gates.includes("opus-audit"));
});

test("public route and budget helpers drive preflight", () => {
  const decision = resolveChannelRoute("engineering", "debug code bug");
  assert.equal(decision.route.project, "acme-shop");
  assert.equal(getBudgetProfile(decision.route.budgetProfile).name, "code-change");
  const result = runPreflight({
    message: "debug code bug",
    scope: decision.route,
    memoryRecords: [
      {
        id: "m",
        summary: "Active",
        content: "Use this",
        project: "acme-shop",
        channel: "engineering",
        status: "active",
        sensitivity: "public",
      },
    ],
  });
  assert.match(result.agentContext, /memory:m/);
});

test("policy and repo pack helpers are public-safe", () => {
  const pack = buildRepoPack({
    project: "acme-shop",
    channel: "engineering",
    files: { "README.md": "Demo repo" },
  });
  assert.equal(pack.scope.project, "acme-shop");
  const decision = resolveChannelRoute("engineering");
  const result = runPreflight({ message: "repo", scope: decision.route, repoChunks: pack.chunks });
  const audit = auditBundle({
    request: { ...result.request, maxSensitivity: "public" },
    chunks: result.chunks,
    totalTokens: 1,
    droppedChunkIds: [],
    redactions: 0,
    citations: [],
    droppedChunks: [],
    warnings: [],
    budgetProfile: "code-change",
  });
  assert.equal(audit.passed, true);
});

test("policy defaults fail closed on internal chunks", () => {
  const audit = auditBundle({
    request: { query: "q", project: "acme-shop" },
    chunks: [{ id: "i", text: "internal", project: "acme-shop", sensitivity: "internal" }],
    totalTokens: 1,
    droppedChunkIds: [],
    redactions: 0,
    citations: [],
    droppedChunks: [],
    warnings: [],
    budgetProfile: "quick-answer",
  });
  assert.equal(audit.passed, false);
  assert.equal(audit.findings[0].code, "sensitivity_ceiling");
});
