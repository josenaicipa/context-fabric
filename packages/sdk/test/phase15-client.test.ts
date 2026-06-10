import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  ContextFabricClient,
  ContextFabricRequestError,
  VERSION,
  memoryRecordsToChunks,
  type MemoryRecord,
} from "../src/index.js";

test("version is the release candidate", () => {
  assert.equal(VERSION, "1.0.0");
});

test("client sends bearer token only when configured", async () => {
  const seen: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), init });
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const client = new ContextFabricClient({
    baseUrl: "http://127.0.0.1:8765/",
    token: "test-token",
    fetchImpl,
  });
  await client.health();
  assert.equal(seen[0].url, "http://127.0.0.1:8765/health");
  assert.equal(
    (seen[0].init?.headers as Record<string, string>).authorization,
    "Bearer test-token",
  );

  seen.length = 0;
  const noTokenClient = new ContextFabricClient({ baseUrl: "http://127.0.0.1:8765", fetchImpl });
  await noTokenClient.health();
  assert.equal((seen[0].init?.headers as Record<string, string>).authorization, undefined);
});

test("client debugHtml returns text", async () => {
  const fetchImpl = async () => new Response("<h1>debug</h1>", { status: 200 });
  const client = new ContextFabricClient({ baseUrl: "http://localhost", fetchImpl });
  const html = await client.debugHtml({
    request: { query: "q", project: "acme-shop" },
    chunks: [],
    responseFormat: "html",
  });
  assert.equal(html, "<h1>debug</h1>");
});

test("client surfaces status and a bounded body excerpt on non-2xx responses", async () => {
  const fetchImpl = async () =>
    new Response(`{"error":"scope 'acme-shop' not configured"}${"x".repeat(1000)}`, {
      status: 403,
    });
  const client = new ContextFabricClient({ baseUrl: "http://localhost", fetchImpl });
  await assert.rejects(client.health(), (err: unknown) => {
    assert.ok(err instanceof ContextFabricRequestError);
    assert.equal(err.status, 403);
    assert.match(err.message, /\/health failed with status 403/);
    assert.match(err.bodyExcerpt, /scope 'acme-shop' not configured/);
    assert.ok(err.bodyExcerpt.length <= 300, "body excerpt must be bounded");
    return true;
  });
});

test("client passes an abort signal through to fetch and rejects when aborted", async () => {
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(init.signal?.reason ?? new Error("aborted")),
      );
    });
  };
  const controller = new AbortController();
  const client = new ContextFabricClient({
    baseUrl: "http://localhost",
    fetchImpl: fetchImpl as typeof fetch,
    timeoutMs: 0,
  });
  const pending = assert.rejects(client.health({ signal: controller.signal }));
  controller.abort(new Error("caller cancelled"));
  await pending;
});

test("client times out slow requests via timeoutMs", async () => {
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      // A slow (ref'd) server response; the client timeout must win and abort it.
      // AbortSignal.timeout timers are unref'd, so this also keeps the loop alive.
      const slow = setTimeout(() => resolve(new Response("{}", { status: 200 })), 5_000);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(slow);
        reject(init.signal?.reason ?? new Error("aborted"));
      });
    });
  };
  const client = new ContextFabricClient({
    baseUrl: "http://localhost",
    fetchImpl: fetchImpl as typeof fetch,
    timeoutMs: 20,
  });
  await assert.rejects(client.health(), (err: unknown) => {
    assert.equal((err as Error).name, "TimeoutError");
    return true;
  });
});

test("client timeoutMs 0 disables the timeout signal", async () => {
  let sawSignal: AbortSignal | null | undefined;
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    sawSignal = init?.signal;
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  const client = new ContextFabricClient({
    baseUrl: "http://localhost",
    fetchImpl: fetchImpl as typeof fetch,
    timeoutMs: 0,
  });
  await client.health();
  assert.equal(sawSignal, undefined);
});

test("public demo memory fixture includes active and verified, excludes candidate", () => {
  const records = JSON.parse(
    readFileSync("../../examples/demo-agent-preflight-memory.json", "utf8"),
  ) as MemoryRecord[];
  const chunks = memoryRecordsToChunks(records, { project: "acme-shop", channel: "demo" });
  assert.deepEqual(
    chunks.map((chunk) => chunk.id),
    ["memory:demo-active", "memory:demo-verified"],
  );
});
