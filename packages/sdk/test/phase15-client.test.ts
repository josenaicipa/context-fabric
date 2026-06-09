import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ContextFabricClient, VERSION, memoryRecordsToChunks, type MemoryRecord } from "../src/index.js";

test("version is the release candidate", () => {
  assert.equal(VERSION, "1.0.0");
});

test("client sends bearer token only when configured", async () => {
  const seen: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), init });
    return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const client = new ContextFabricClient({ baseUrl: "http://127.0.0.1:8765/", token: "test-token", fetchImpl });
  await client.health();
  assert.equal(seen[0].url, "http://127.0.0.1:8765/health");
  assert.equal((seen[0].init?.headers as Record<string, string>).authorization, "Bearer test-token");

  seen.length = 0;
  const noTokenClient = new ContextFabricClient({ baseUrl: "http://127.0.0.1:8765", fetchImpl });
  await noTokenClient.health();
  assert.equal((seen[0].init?.headers as Record<string, string>).authorization, undefined);
});

test("client debugHtml returns text", async () => {
  const fetchImpl = async () => new Response("<h1>debug</h1>", { status: 200 });
  const client = new ContextFabricClient({ baseUrl: "http://localhost", fetchImpl });
  const html = await client.debugHtml({ request: { query: "q", project: "acme-shop" }, chunks: [], responseFormat: "html" });
  assert.equal(html, "<h1>debug</h1>");
});


test("public demo memory fixture includes active and verified, excludes candidate", () => {
  const records = JSON.parse(readFileSync("../../examples/demo-agent-preflight-memory.json", "utf8")) as MemoryRecord[];
  const chunks = memoryRecordsToChunks(records, { project: "acme-shop", channel: "demo" });
  assert.deepEqual(chunks.map((chunk) => chunk.id), ["memory:demo-active", "memory:demo-verified"]);
});
