import test from "node:test";
import assert from "node:assert/strict";
import { runPreflight, type ContextChunk, type MemoryRecord } from "../src/index.js";

const memoryRecords: MemoryRecord[] = [
  { id: "m1", summary: "Active", content: "Use this", project: "acme-shop", channel: "#support", status: "active" },
  { id: "m2", summary: "Candidate", content: "Do not use", project: "acme-shop", channel: "#support", status: "candidate" },
  { id: "m3", summary: "Verified", content: "Use verified", project: "acme-shop", channel: "#support", status: "verified" },
  { id: "m4", summary: "Other", content: "Wrong project", project: "other-co", channel: "#support", status: "verified" },
];
const repoChunks: ContextChunk[] = [{ id: "repo:guide", text: "Repo guide", project: "acme-shop", channel: "#support", sensitivity: "public" }];

test("runPreflight produces agent context and excludes candidates by default", () => {
  const result = runPreflight({ message: "prepare", scope: { project: "acme-shop", channel: "#support" }, memoryRecords, repoChunks });
  assert.match(result.agentContext, /AGENT_CONTEXT/);
  assert.deepEqual(result.chunks.map((chunk) => chunk.id), ["memory:m1", "memory:m3", "repo:guide"]);
  assert.equal(result.pack.id, "acme-shop-preflight");
});


test("runPreflight can explicitly include candidates", () => {
  const result = runPreflight({ message: "prepare", scope: { project: "acme-shop", channel: "#support" }, memoryRecords, repoChunks, includeCandidates: true });
  assert.deepEqual(result.chunks.map((chunk) => chunk.id), ["memory:m1", "memory:m2", "memory:m3", "repo:guide"]);
});
