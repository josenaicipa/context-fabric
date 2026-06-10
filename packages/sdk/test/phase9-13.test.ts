import test from "node:test";
import assert from "node:assert/strict";
import { Fabric, createAssemblePayload, createDebugHtmlPayload, memoryRecordsToChunks, type MemoryRecord } from "../src/index.js";

const memories: MemoryRecord[] = [
  { id: "active", summary: "Active", content: "Use approved guide", project: "acme-shop", channel: "#support", status: "active", confidence: 2 },
  { id: "candidate", summary: "Candidate", content: "Draft should stay out", project: "acme-shop", channel: "#support", status: "candidate", confidence: 9 },
  { id: "other", summary: "Other", content: "Wrong project", project: "other-co", channel: "#support", status: "verified", confidence: 9 },
];

test("memoryRecordsToChunks excludes candidates and cross-project records by default", () => {
  const chunks = memoryRecordsToChunks(memories, { project: "acme-shop", channel: "#support" });
  assert.deepEqual(chunks.map((chunk) => chunk.id), ["memory:active"]);
  const bundle = new Fabric().assemble({ query: "handoff", project: "acme-shop", channel: "#support", maxSensitivity: "internal" }, chunks);
  assert.equal(bundle.chunks[0]?.id, "memory:active");
});

test("API payload helpers produce server-compatible request body", () => {
  const request = { query: "q", project: "acme-shop", channel: "#support" };
  const chunks = memoryRecordsToChunks(memories, { project: "acme-shop", channel: "#support", includeCandidates: true });
  const payload = createAssemblePayload(request, chunks);
  const debug = createDebugHtmlPayload(request, chunks);
  assert.equal(payload.request.project, "acme-shop");
  assert.equal(payload.chunks.length, 2);
  assert.equal(debug.responseFormat, "html");
});

test("memoryRecordsToChunks can explicitly include candidates", () => {
  const chunks = memoryRecordsToChunks(memories, { project: "acme-shop", channel: "#support", includeCandidates: true });
  assert.deepEqual(chunks.map((chunk) => chunk.id), ["memory:active", "memory:candidate"]);
  assert.equal(chunks[1]?.score, 9);
  assert.equal(chunks[1]?.source?.sourceId, "candidate");
});
