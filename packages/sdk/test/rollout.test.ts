import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_SCOPE_ALLOWLIST,
  runRolloutSmoke,
  rolloutReportToMarkdown,
  validateRolloutPolicy,
  type RolloutPolicy,
  type RolloutSmokeCase,
} from "../src/index.js";

function loadPolicy(): RolloutPolicy {
  return JSON.parse(readFileSync("../../templates/channel-context-policy.json", "utf8")) as RolloutPolicy;
}

function loadSmoke(): RolloutSmokeCase[] {
  return JSON.parse(readFileSync("../../examples/rollout-smoke.json", "utf8")) as RolloutSmokeCase[];
}

test("default scope allowlist is fictional-only", () => {
  assert.deepEqual([...DEFAULT_SCOPE_ALLOWLIST].sort(), ["acme-shop", "demo", "example", "other-co"]);
});

test("template rollout policy validates clean", () => {
  const result = validateRolloutPolicy(loadPolicy());
  assert.equal(result.passed, true, JSON.stringify(result.findings));
  assert.equal(result.findings.filter((f) => f.severity === "blocker").length, 0);
});

test("validation flags a non-allowlisted private scope", () => {
  const bad: RolloutPolicy = {
    version: 1,
    routes: [{ match: { channel: "#off-allowlist-scope" }, scope: { project: "off-allowlist-scope", channel: "#off-allowlist-scope" } }],
  };
  const result = validateRolloutPolicy(bad);
  assert.equal(result.passed, false);
  assert.ok(result.findings.some((f) => f.code === "non_allowlisted_scope" && f.severity === "blocker"));
});

test("validation flags a non-allowlisted private workspace", () => {
  const bad: RolloutPolicy = {
    version: 1,
    routes: [
      {
        match: { channel: "#acme-shop" },
        scope: { project: "acme-shop", channel: "#acme-shop", workspace: "off-allowlist-ws" },
      },
    ],
  };
  const result = validateRolloutPolicy(bad);
  assert.equal(result.passed, false);
  assert.ok(
    result.findings.some(
      (f) => f.code === "non_allowlisted_scope" && f.severity === "blocker" && /off-allowlist-ws/.test(f.message),
    ),
  );
});

test("validation allows an allowlisted workspace", () => {
  const ok: RolloutPolicy = {
    version: 1,
    routes: [{ match: { channel: "#acme-shop" }, scope: { project: "acme-shop", channel: "#acme-shop", workspace: "demo" } }],
  };
  assert.equal(validateRolloutPolicy(ok).passed, true);
});

test("validation allows ALL_CAPS placeholders teams must replace", () => {
  const tmpl: RolloutPolicy = {
    version: 1,
    routes: [{ match: { channel: "#YOUR_CHANNEL" }, scope: { project: "YOUR_PROJECT", channel: "#YOUR_CHANNEL" } }],
  };
  assert.equal(validateRolloutPolicy(tmpl).passed, true);
});

test("validation flags secret-like material in a policy", () => {
  const leaky: RolloutPolicy = {
    version: 1,
    routes: [{ match: { channel: "#acme-shop" }, scope: { project: "acme-shop", channel: "#acme-shop" }, notes: "token ghp_0123456789abcdef0123456789abcdef0123" }],
  };
  const result = validateRolloutPolicy(leaky);
  assert.equal(result.passed, false);
  assert.ok(result.findings.some((f) => f.code === "secret_material"));
});

test("validation requires at least one route", () => {
  const result = validateRolloutPolicy({ version: 1, routes: [] });
  assert.ok(result.findings.some((f) => f.code === "no_routes"));
});

test("rollout smoke on the example kit passes reliability gates", () => {
  const report = runRolloutSmoke(loadPolicy(), loadSmoke());
  assert.equal(report.passed, true, JSON.stringify(report, null, 2));
  assert.equal(report.recall, 1);
  assert.equal(report.contamination, 0);
  assert.equal(report.candidateLeaks, 0);
  assert.equal(report.secretLeaks, 0);
  assert.equal(report.unroutedCases, 0);
  assert.equal(report.validation.passed, true);
});

test("rollout smoke keeps expected chunks and drops forbidden + candidate chunks", () => {
  const report = runRolloutSmoke(loadPolicy(), loadSmoke());
  for (const result of report.caseResults) {
    assert.deepEqual(result.expectedMissing, []);
    assert.deepEqual(result.forbiddenPresent, []);
    assert.equal(result.candidateLeaks, 0);
    assert.equal(result.routeMatched, true);
    assert.equal(result.passed, true);
  }
});

test("a smoke case with no covering route is reported as unrouted and fails", () => {
  const cases: RolloutSmokeCase[] = [
    {
      name: "uncovered-scope",
      scope: { project: "example", channel: "#example" },
      query: "anything",
      chunks: [{ id: "x1", text: "kept", project: "example", channel: "#example", tags: ["primary"], sensitivity: "public" }],
      expectedChunkIds: ["x1"],
    },
  ];
  const report = runRolloutSmoke(loadPolicy(), cases);
  assert.equal(report.unroutedCases, 1);
  assert.equal(report.passed, false);
  assert.equal(report.caseResults[0].routeMatched, false);
});

test("a secret in a dropped/forbidden chunk fails the report even when not kept", () => {
  // Synthetic inert token: matches the ghp_ pattern but is not a real credential.
  const inertToken = "ghp_0123456789abcdef0123456789abcdef0123";
  const cases: RolloutSmokeCase[] = [
    {
      name: "secret-in-dropped-chunk",
      scope: { project: "acme-shop", channel: "#acme-shop" },
      query: "How does Acme Shop checkout work?",
      chunks: [
        { id: "keep", text: "Acme Shop checkout overview.", project: "acme-shop", channel: "#acme-shop", tags: ["approved", "primary"], sensitivity: "public", score: 0.9 },
        // Foreign-scope chunk: dropped by assembly, but the secret must still trip the gate.
        { id: "leaky-foreign", text: `token ${inertToken}`, project: "other-co", channel: "#other-co", tags: ["approved"], sensitivity: "public", score: 5.0 },
      ],
      expectedChunkIds: ["keep"],
      forbiddenChunkIds: ["leaky-foreign"],
    },
  ];
  const report = runRolloutSmoke(loadPolicy(), cases);
  // The leaky chunk is dropped from the bundle...
  assert.ok(!report.caseResults[0].keptChunkIds.includes("leaky-foreign"));
  assert.equal(report.caseResults[0].forbiddenPresent.length, 0);
  // ...yet the secret in the raw fixture still fails the case and the whole report.
  assert.ok(report.caseResults[0].secretLeaks > 0);
  assert.ok(report.secretLeaks > 0);
  assert.equal(report.caseResults[0].passed, false);
  assert.equal(report.reliabilityPassed, false);
  assert.equal(report.passed, false);
});

test("a secret in dropped chunk metadata fails the report even when not kept", () => {
  // Synthetic inert token: matches the ghp_ pattern but is not a real credential.
  const inertToken = "ghp_0123456789abcdef0123456789abcdef0123";
  const cases: RolloutSmokeCase[] = [
    {
      name: "secret-in-dropped-metadata",
      scope: { project: "acme-shop", channel: "#acme-shop" },
      query: "How does Acme Shop checkout work?",
      chunks: [
        { id: "keep", text: "Acme Shop checkout overview.", project: "acme-shop", channel: "#acme-shop", tags: ["approved", "primary"], sensitivity: "public", score: 0.9 },
        // Foreign-scope chunk dropped by assembly; the secret hides in metadata
        // (tags + workspace), never in chunk.text, yet must still trip the gate.
        { id: "leaky-meta", text: "nothing secret in this body", project: "other-co", channel: "#other-co", workspace: inertToken, tags: ["approved", `token:${inertToken}`], sensitivity: "public", score: 5.0 },
      ],
      expectedChunkIds: ["keep"],
      forbiddenChunkIds: ["leaky-meta"],
    },
  ];
  const report = runRolloutSmoke(loadPolicy(), cases);
  // The leaky chunk is dropped from the bundle and its body holds no secret...
  assert.ok(!report.caseResults[0].keptChunkIds.includes("leaky-meta"));
  assert.equal(report.caseResults[0].forbiddenPresent.length, 0);
  // ...yet the secret in the raw metadata still fails the case and the report.
  assert.ok(report.caseResults[0].secretLeaks > 0);
  assert.ok(report.secretLeaks > 0);
  assert.equal(report.caseResults[0].passed, false);
  assert.equal(report.reliabilityPassed, false);
  assert.equal(report.passed, false);
});

test("includeCandidates lets an explicitly allowed candidate through", () => {
  const cases: RolloutSmokeCase[] = [
    {
      name: "explicit-candidate",
      scope: { project: "acme-shop", channel: "#acme-shop" },
      query: "candidate allowed",
      includeCandidates: true,
      chunks: [{ id: "cand", text: "explicitly allowed candidate", project: "acme-shop", channel: "#acme-shop", tags: ["candidate"], sensitivity: "public" }],
      expectedChunkIds: ["cand"],
    },
  ];
  const report = runRolloutSmoke(loadPolicy(), cases);
  assert.equal(report.caseResults[0].expectedMissing.length, 0);
  // candidate leaks counts candidates kept; allowed here, so this case opts out of the gate
  assert.ok(report.caseResults[0].keptChunkIds.includes("cand"));
});

test("rollout report renders markdown with a verdict and per-case table", () => {
  const report = runRolloutSmoke(loadPolicy(), loadSmoke());
  const md = rolloutReportToMarkdown(report);
  assert.match(md, /# Context Fabric Rollout Smoke Report/);
  assert.match(md, /Verdict: PASS/);
  for (const result of report.caseResults) assert.ok(md.includes(result.name));
});

test("rollout markdown table includes a per-case Secret Leaks column", () => {
  // Synthetic inert token: matches the ghp_ pattern but is not a real credential.
  const inertToken = "ghp_0123456789abcdef0123456789abcdef0123";
  const cases: RolloutSmokeCase[] = [
    {
      name: "secret-leak-row",
      scope: { project: "acme-shop", channel: "#acme-shop" },
      query: "How does Acme Shop checkout work?",
      chunks: [
        { id: "keep", text: "Acme Shop checkout overview.", project: "acme-shop", channel: "#acme-shop", tags: ["approved", "primary"], sensitivity: "public", score: 0.9 },
        { id: "leaky-foreign", text: `token ${inertToken}`, project: "other-co", channel: "#other-co", tags: ["approved"], sensitivity: "public", score: 5.0 },
      ],
      expectedChunkIds: ["keep"],
      forbiddenChunkIds: ["leaky-foreign"],
    },
  ];
  const report = runRolloutSmoke(loadPolicy(), cases);
  const md = rolloutReportToMarkdown(report);
  // Header column is present in the per-case table.
  assert.match(md, /\| Case \|.*\| Secret Leaks \| Verdict \|/);
  // The case row carries its own secret-leak count (> 0 for the leaky fixture).
  const row = md.split("\n").find((line) => line.includes("secret-leak-row"));
  assert.ok(row, "expected a markdown row for secret-leak-row");
  assert.equal(report.caseResults[0].secretLeaks, 1);
  assert.ok(row.includes(`| ${report.caseResults[0].secretLeaks} | FAIL |`));
});
