import assert from "node:assert/strict";
import test from "node:test";
import {
  Fabric,
  MemoryFabricV2Error,
  ScopeProbeError,
  evaluateReadiness,
  evaluateScopeProbe,
  memoryFabricV2ToRecords,
  planProfileRollout,
  runGuardedPreflight,
} from "../src/index.js";

const scope = { project: "acme-shop", channel: "#acme-shop", maxSensitivity: "internal" as const };
const validProbe = {
  scope,
  route: { project: "acme-shop", channel: "#acme-shop" },
  providerSession: "opaque-session",
  providerReachable: true,
};

test("scope probes fail closed when route or provider session evidence is absent", () => {
  assert.deepEqual(evaluateScopeProbe({ scope, providerReachable: true }).blockers, [
    "missing_provider_session",
    "missing_route",
  ]);
  assert.deepEqual(
    evaluateScopeProbe({ ...validProbe, route: { project: "other-co", channel: "#acme-shop" } })
      .blockers,
    ["route_scope_mismatch"],
  );
  assert.equal(evaluateScopeProbe(validProbe).passed, true);
});

test("guarded preflight does not assemble before the external scope probe passes", () => {
  const input = {
    message: "checkout",
    scope,
    repoChunks: [
      {
        id: "in",
        text: "checkout",
        project: "acme-shop",
        channel: "#acme-shop",
        sensitivity: "internal" as const,
      },
    ],
  };
  assert.throws(() => runGuardedPreflight(input, { scope }), ScopeProbeError);
  const result = runGuardedPreflight(input, validProbe, new Fabric());
  assert.deepEqual(
    result.chunks.map((chunk) => chunk.id),
    ["in"],
  );
});

test("profile rollout plans are declarative, fail closed, and idempotent", () => {
  const first = planProfileRollout([
    { id: "agent-a", ...validProbe, settings: { contextFabric: { enabled: false } } },
  ]);
  assert.equal(first.passed, true);
  assert.equal(first.changes[0].changed, true);
  const second = planProfileRollout([
    { id: "agent-a", ...validProbe, settings: first.changes[0].nextSettings },
  ]);
  assert.equal(second.passed, true);
  assert.equal(second.changes[0].changed, false);
  const blocked = planProfileRollout([{ id: "agent-b", scope, providerReachable: true }]);
  assert.equal(blocked.passed, false);
  assert.ok(blocked.changes[0].blockers.includes("missing_provider_session"));
});

test("readiness aggregates probe and profile blockers without inspecting profiles", () => {
  const rollout = planProfileRollout([{ id: "agent-a", ...validProbe }]);
  const report = evaluateReadiness([validProbe], rollout);
  assert.deepEqual(report, { passed: true, blockers: [], profiles: 1, changesRequired: 1 });
  const blocked = evaluateReadiness([{ scope }], rollout);
  assert.equal(blocked.passed, false);
  assert.ok(blocked.blockers.includes("probe_0:missing_provider_session"));
});

test("memory retrieval v2 requires a session and filters mismatched scope stamps", () => {
  const response = {
    providerSession: "opaque-session",
    status: "ok" as const,
    results: [
      { id: "exact", content: "allowed", project: "acme-shop", channel: "#acme-shop" },
      { id: "foreign-project", content: "blocked", project: "other-co", channel: "#acme-shop" },
      { id: "foreign-channel", content: "blocked", project: "acme-shop", channel: "#other-co" },
      { id: "unstamped", content: "allowed", project: "acme-shop" },
    ],
  };
  assert.deepEqual(
    memoryFabricV2ToRecords(response, scope).map((record) => record.id),
    ["exact", "unstamped"],
  );
  assert.throws(
    () => memoryFabricV2ToRecords({ ...response, providerSession: "" }, scope),
    (error: unknown) =>
      error instanceof MemoryFabricV2Error && error.code === "missing_provider_session",
  );
});
