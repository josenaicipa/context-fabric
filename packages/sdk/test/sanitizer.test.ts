import { test } from "node:test";
import assert from "node:assert/strict";
import { Sanitizer } from "../src/sanitizer.js";

test("redacts email", () => {
  const { text, redactions } = new Sanitizer().sanitizeText("reach me at user@example.com");
  assert.ok(!text.includes("user@example.com"));
  assert.ok(text.includes("[EMAIL]"));
  assert.equal(redactions, 1);
});

test("redacts bearer token", () => {
  const { text, redactions } = new Sanitizer().sanitizeText("Bearer abcdef1234567890");
  assert.ok(!text.includes("abcdef1234567890"));
  assert.equal(redactions, 1);
});

test("redacts secret assignment", () => {
  const { text } = new Sanitizer().sanitizeText("api_key = supersecretvalue123");
  assert.ok(!text.includes("supersecretvalue123"));
});

test("custom rule applied", () => {
  const sanitizer = new Sanitizer([
    { name: "ticket", pattern: "TICKET-\\d+", replacement: "[TICKET]" },
  ]);
  const { text, redactions } = sanitizer.sanitizeText("see TICKET-1042 for details");
  assert.equal(text, "see [TICKET] for details");
  assert.equal(redactions, 1);
});

test("clean chunk returns same reference", () => {
  const chunk = { id: "a", text: "nothing secret", project: "acme" };
  const result = new Sanitizer().sanitizeChunk(chunk);
  assert.equal(result.redactions, 0);
  assert.equal(result.chunk, chunk);
});

test("sanitize is immutable", () => {
  const chunk = { id: "a", text: "password=topsecretvalue", project: "acme" };
  const result = new Sanitizer().sanitizeChunk(chunk);
  assert.ok(result.redactions >= 1);
  assert.equal(chunk.text, "password=topsecretvalue");
  assert.notEqual(result.chunk.text, chunk.text);
});
