import { test } from "node:test";
import assert from "node:assert/strict";
import { Sanitizer, SanitizerRuleError, DEFAULT_RULES } from "../src/sanitizer.js";
import { SECRET_PATTERN_DEFS, secretDetectionPatterns, SECRET_SANITIZATION_RULES } from "../src/secret-patterns.js";

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

// Synthetic, inert signatures — shaped like each family but never real
// credentials. They exist only to prove the redaction path fires.
//
// Provider-shaped samples are assembled from fragments at runtime via
// `join`, so no contiguous provider-secret literal is ever committed to
// source (GitHub push protection flags such literals even when synthetic).
// The assembled strings still match SECRET_PATTERNS, so the tests stay
// meaningful.
const join = (...parts: string[]): string => parts.join("");

const SECRET_SAMPLES: Array<{ family: string; sample: string; core: string; label: string }> = [
  { family: "aws_access_key", sample: join("AKIA", "ABCDEFGHIJKLMNOP"), core: join("AKIA", "ABCDEFGHIJKLMNOP"), label: "[AWS_KEY]" },
  { family: "github_pat", sample: join("github", "_pat_", "0123456789abcdefABCDEFGHIJ0123456789"), core: "0123456789abcdefABCDEFGHIJ", label: "[GITHUB_TOKEN]" },
  { family: "github_token", sample: join("ghp", "_", "0123456789abcdef0123456789abcdef0123"), core: "0123456789abcdef0123456789abcdef0123", label: "[GITHUB_TOKEN]" },
  { family: "slack_token", sample: join("xoxb", "-", "0123456789abcdef"), core: "0123456789abcdef", label: "[SLACK_TOKEN]" },
  { family: "google_api_key", sample: join("AI", "za", "012345678901234567890123456789abcde"), core: "012345678901234567890123456789abcde", label: "[GOOGLE_API_KEY]" },
  { family: "stripe_live_key", sample: join("sk", "_live_", "0123456789abcdefABCDEFGH"), core: "0123456789abcdefABCDEFGH", label: "[STRIPE_KEY]" },
  { family: "secret_key_sk", sample: join("sk", "-", "0123456789012345678901234567890123"), core: "0123456789012345678901234567890123", label: "[SECRET_KEY]" },
  {
    family: "pem_private_key",
    sample: join("-----BEGIN PRIVATE KEY-----\n", "INERTFAKEKEYMATERIALNOTREAL", "\n-----END PRIVATE KEY-----"),
    core: "INERTFAKEKEYMATERIALNOTREAL",
    label: "[PRIVATE_KEY]",
  },
  { family: "bearer_token", sample: join("Bearer ", "abcdef1234567890token"), core: "abcdef1234567890token", label: "[BEARER_TOKEN]" },
  { family: "generic_secret_assignment", sample: join("api_key=", '"supersecretvalue123"'), core: "supersecretvalue123", label: "[REDACTED]" },
];

for (const { family, sample, core, label } of SECRET_SAMPLES) {
  test(`redacts ${family} (synthetic inert sample)`, () => {
    const { text, redactions } = new Sanitizer().sanitizeText(`prefix ${sample} suffix`);
    assert.ok(!text.includes(core), `expected ${family} core to be redacted, got: ${text}`);
    assert.ok(text.includes(label), `expected ${label} in: ${text}`);
    assert.ok(redactions >= 1);
  });
}

test("every secret family is both detectable and redactable (no drift)", () => {
  const detectors = secretDetectionPatterns();
  assert.equal(detectors.length, SECRET_PATTERN_DEFS.length);
  for (const { family, sample } of SECRET_SAMPLES) {
    assert.ok(
      detectors.some((re) => re.test(sample)),
      `detection patterns should match ${family} sample`,
    );
    assert.ok(
      SECRET_SANITIZATION_RULES.some((rule) => rule.name === family),
      `redaction rules should include ${family}`,
    );
    assert.ok(
      DEFAULT_RULES.some((rule) => rule.name === family),
      `default sanitizer rules should include ${family}`,
    );
  }
});

test("default rules keep email PII redaction on top of secret families", () => {
  assert.ok(DEFAULT_RULES.some((rule) => rule.name === "email"));
});

test("invalid custom regex throws a clear SanitizerRuleError, not a cryptic RegExp error", () => {
  let caught: unknown;
  try {
    new Sanitizer([{ name: "broken", pattern: "([unterminated", replacement: "[X]" }]);
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof SanitizerRuleError, "expected a SanitizerRuleError");
  const e = caught as SanitizerRuleError;
  assert.equal(e.ruleName, "broken");
  assert.match(e.message, /invalid regex in rule "broken"/);
  assert.match(e.message, /\(\/\(\[unterminated\/\)/);
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
