import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RULES, Fabric, VERSION, buildPack, renderAgentContext, runEvals, type ContextChunk } from "../src/index.js";

const chunks: ContextChunk[] = [
  { id: "c1", text: "Acme support onboarding", project: "acme-shop", channel: "#support", sensitivity: "public", source: { sourceId: "doc-1", title: "Docs" }, score: 2 },
  { id: "c2", text: "Other private note", project: "other-co", channel: "#support", sensitivity: "internal", score: 99 },
];

test("v1 bundle includes citations and contamination drops", () => {
  const bundle = new Fabric({ budgetProfiles: { general: { name: "general", maxTokens: 2000 } } }).assemble({ query: "onboard", project: "acme-shop", channel: "#support", maxSensitivity: "public" }, chunks);
  assert.deepEqual(bundle.chunks.map((c) => c.id), ["c1"]);
  assert.equal(bundle.citations[0]?.sourceId, "doc-1");
  assert.ok(bundle.droppedChunkIds.includes("c2"));
});

test("pack, handoff and eval helpers are public-demo usable", () => {
  const pack = buildPack({ id: "demo", summary: "Demo pack", chunks, project: "acme-shop" });
  assert.equal(pack.chunks.length, 1);
  const bundle = new Fabric().assemble({ query: "onboard", project: "acme-shop", channel: "#support" }, chunks);
  assert.match(renderAgentContext(bundle), /AGENT_CONTEXT/);
  const report = runEvals(new Fabric(), [{ name: "demo", request: bundle.request, chunks, expectedChunkIds: ["c1"], forbiddenChunkIds: ["c2"] }]);
  assert.equal(report.passed, true);
});


test("public exports keep compatibility", () => {
  assert.equal(VERSION, "0.2.0-rc.1");
  assert.ok(DEFAULT_RULES.some((rule) => rule.name === "email"));
});

test("v1 drop paths are observable", () => {
  const long = "x".repeat(1000);
  const bundle = new Fabric({ budget: { maxTokens: 20 } }).assemble({ query: "q", project: "acme-shop", channel: "#support", maxSensitivity: "public" }, [
    { id: "restricted", text: "private", project: "acme-shop", channel: "#support", sensitivity: "restricted", score: 9 },
    { id: "dup1", text: "same text", project: "acme-shop", channel: "#support", sensitivity: "public", score: 8 },
    { id: "dup2", text: "same   text", project: "acme-shop", channel: "#support", sensitivity: "public", score: 7 },
    { id: "big", text: long, project: "acme-shop", channel: "#support", sensitivity: "public", score: 6 },
  ]);
  const reasons = new Map(bundle.droppedChunks.map((drop) => [drop.id, drop.reason]));
  assert.equal(reasons.get("restricted"), "sensitivity_blocked");
  assert.equal(reasons.get("dup2"), "duplicate");
  assert.equal(reasons.get("big"), "over_budget");
});
