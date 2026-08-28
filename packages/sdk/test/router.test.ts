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

test("workspace mismatch is hard-excluded when both sides are set", () => {
  const chunks = [
    chunk({ id: "in", project: "acme", workspace: "demo", score: 1 }),
    chunk({ id: "out", project: "acme", workspace: "example", score: 9 }),
  ];
  const routed = new Router().route(req({ workspace: "demo", channel: undefined }), chunks);
  assert.deepEqual(
    routed.map((c) => c.id),
    ["in"],
  );
});

test("thread-private chunks never enter a sibling thread", () => {
  const chunks = [
    chunk({ id: "billing", project: "acme", channel: "#acme", threadId: "t-bill", score: 1 }),
    chunk({ id: "support", project: "acme", channel: "#acme", threadId: "t-sup", score: 9 }),
    chunk({ id: "wide", project: "acme", channel: "#acme", score: 1 }),
  ];
  const routed = new Router().route(req({ threadId: "t-bill" }), chunks);
  assert.deepEqual(routed.map((c) => c.id).sort(), ["billing", "wide"]);
});

test("thread-private chunks stay out of an unfocused request", () => {
  const chunks = [
    chunk({ id: "wide", project: "acme", channel: "#acme", score: 1 }),
    chunk({ id: "private", project: "acme", channel: "#acme", threadId: "t-bill", score: 9 }),
  ];
  const routed = new Router().route(req(), chunks);
  assert.deepEqual(
    routed.map((c) => c.id),
    ["wide"],
  );
});

test("inspect reports required_tags and max_chunks reasons", () => {
  const router = new Router([{ project: "acme", requiredTags: ["approved"] }]);
  const chunks = [
    chunk({ id: "ok", project: "acme", channel: "#acme", tags: ["approved"], score: 1 }),
    chunk({ id: "no-tags", project: "acme", channel: "#acme", score: 1 }),
    chunk({ id: "extra", project: "acme", channel: "#acme", tags: ["approved"], score: 0 }),
  ];
  const decisions = router.inspect(req({ maxChunks: 1 }), chunks);
  const byId = new Map(decisions.map((d) => [d.chunk.id, d.reason]));
  assert.equal(byId.get("ok"), "kept");
  assert.equal(byId.get("no-tags"), "required_tags");
  assert.equal(byId.get("extra"), "max_chunks");
});
