import { test } from "node:test";
import assert from "node:assert/strict";
import { Router } from "../src/router.js";
import type { ContextChunk, ContextRequest } from "../src/schemas.js";

function chunk(partial: Partial<ContextChunk> & { id: string; project: string }): ContextChunk {
  return { text: "x", ...partial };
}

const req = (over: Partial<ContextRequest> = {}): ContextRequest => ({
  query: "q",
  project: "acme",
  channel: "#acme",
  ...over,
});

test("route excludes other projects", () => {
  const chunks = [
    chunk({ id: "a", project: "acme", channel: "#acme", score: 1 }),
    chunk({ id: "b", project: "other", channel: "#other", score: 99 }),
  ];
  const routed = new Router().route(req(), chunks);
  assert.deepEqual(
    routed.map((c) => c.id),
    ["a"],
  );
});

test("channel match outranks project-only", () => {
  const chunks = [
    chunk({ id: "project_only", project: "acme", score: 1 }),
    chunk({ id: "channel_match", project: "acme", channel: "#acme", score: 1 }),
  ];
  const routed = new Router().route(req(), chunks);
  assert.equal(routed[0].id, "channel_match");
});

test("routing rule boost is applied", () => {
  const chunks = [
    chunk({ id: "low", project: "acme", channel: "#acme", score: 1 }),
    chunk({ id: "boosted", project: "acme", channel: "#acme", tags: ["vip"], score: 1 }),
  ];
  const router = new Router([
    { project: "acme", channel: "#acme", boost: 50, requiredTags: ["vip"] },
  ]);
  const routed = router.route(req(), chunks);
  assert.equal(routed[0].id, "boosted");
});

test("required tags filter excludes chunk", () => {
  const chunks = [chunk({ id: "untagged", project: "acme", channel: "#acme", score: 1 })];
  const router = new Router([{ project: "acme", requiredTags: ["approved"] }]);
  assert.equal(router.route(req(), chunks).length, 0);
});

test("maxChunks caps results", () => {
  const chunks = Array.from({ length: 10 }, (_, i) =>
    chunk({ id: String(i), project: "acme", channel: "#acme", score: i }),
  );
  const routed = new Router().route(req({ maxChunks: 3 }), chunks);
  assert.equal(routed.length, 3);
});

test("must_keep chunks are not lost to maxChunks", () => {
  const chunks = [
    chunk({ id: "nice-to-have", project: "acme", channel: "#acme", score: 100 }),
    chunk({ id: "critical", project: "acme", channel: "#acme", tags: ["must_keep"], score: 0 }),
  ];
  const routed = new Router().route(req({ maxChunks: 1 }), chunks);
  assert.deepEqual(
    routed.map((c) => c.id),
    ["critical"],
  );
});
