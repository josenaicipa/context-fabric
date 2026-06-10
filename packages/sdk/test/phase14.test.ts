import test from "node:test";
import assert from "node:assert/strict";
import { runPreflight, type ContextChunk, type MemoryRecord } from "../src/index.js";

// Memory records default to `internal` sensitivity (memoryRecordsToChunks),
// so they are only visible when a scope explicitly widens the ceiling.
const memoryRecords: MemoryRecord[] = [
  {
    id: "m1",
    summary: "Active",
    content: "Use this",
    project: "acme-shop",
    channel: "#support",
    status: "active",
  },
  {
    id: "m2",
    summary: "Candidate",
    content: "Do not use",
    project: "acme-shop",
    channel: "#support",
    status: "candidate",
  },
  {
    id: "m3",
    summary: "Verified",
    content: "Use verified",
    project: "acme-shop",
    channel: "#support",
    status: "verified",
  },
  {
    id: "m4",
    summary: "Other",
    content: "Wrong project",
    project: "other-co",
    channel: "#support",
    status: "verified",
  },
];
const repoChunks: ContextChunk[] = [
  {
    id: "repo:guide",
    text: "Repo guide",
    project: "acme-shop",
    channel: "#support",
    sensitivity: "public",
  },
];

test("runPreflight defaults to a public ceiling and excludes internal memory", () => {
  const result = runPreflight({
    message: "prepare",
    scope: { project: "acme-shop", channel: "#support" },
    memoryRecords,
    repoChunks,
  });
  assert.equal(result.request.maxSensitivity, "public");
  assert.equal(result.pack.sensitivity, "public");
  assert.match(result.agentContext, /AGENT_CONTEXT/);
  // Fail-closed: memory chunks are internal by default, so only the public repo chunk survives.
  assert.deepEqual(
    result.chunks.map((chunk) => chunk.id),
    ["repo:guide"],
  );
  assert.equal(result.pack.id, "acme-shop-preflight");
});

test("runPreflight includes internal memory only with an explicit internal ceiling", () => {
  const result = runPreflight({
    message: "prepare",
    scope: { project: "acme-shop", channel: "#support", maxSensitivity: "internal" },
    memoryRecords,
    repoChunks,
  });
  assert.equal(result.request.maxSensitivity, "internal");
  assert.equal(result.pack.sensitivity, "internal");
  assert.match(result.agentContext, /AGENT_CONTEXT/);
  // Candidates stay excluded by default even when the ceiling is widened.
  assert.deepEqual(
    result.chunks.map((chunk) => chunk.id),
    ["memory:m1", "memory:m3", "repo:guide"],
  );
});

test("runPreflight can explicitly include candidates under an internal ceiling", () => {
  const result = runPreflight({
    message: "prepare",
    scope: { project: "acme-shop", channel: "#support", maxSensitivity: "internal" },
    memoryRecords,
    repoChunks,
    includeCandidates: true,
  });
  assert.deepEqual(
    result.chunks.map((chunk) => chunk.id),
    ["memory:m1", "memory:m2", "memory:m3", "repo:guide"],
  );
});

test("runPreflight candidates do not bypass the public default ceiling", () => {
  const result = runPreflight({
    message: "prepare",
    scope: { project: "acme-shop", channel: "#support" },
    memoryRecords,
    repoChunks,
    includeCandidates: true,
  });
  // includeCandidates widens candidate status, never sensitivity.
  assert.deepEqual(
    result.chunks.map((chunk) => chunk.id),
    ["repo:guide"],
  );
});
