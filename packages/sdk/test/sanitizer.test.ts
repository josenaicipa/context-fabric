import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Sanitizer,
  SanitizerRuleError,
  DEFAULT_RULES,
  normalizeForScan,
} from "../src/sanitizer.js";
import {
  SECRET_PATTERN_DEFS,
  secretDetectionPatterns,
  SECRET_SANITIZATION_RULES,
} from "../src/secret-patterns.js";

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
  {
    family: "aws_access_key",
    sample: join("AKIA", "ABCDEFGHIJKLMNOP"),
    core: join("AKIA", "ABCDEFGHIJKLMNOP"),
    label: "[AWS_KEY]",
  },
  {
    family: "github_pat",
    sample: join("github", "_pat_", "0123456789abcdefABCDEFGHIJ0123456789"),
    core: "0123456789abcdefABCDEFGHIJ",
    label: "[GITHUB_TOKEN]",
  },
  {
    family: "github_token",
    sample: join("ghp", "_", "0123456789abcdef0123456789abcdef0123"),
    core: "0123456789abcdef0123456789abcdef0123",
    label: "[GITHUB_TOKEN]",
  },
  {
    family: "slack_token",
    sample: join("xoxb", "-", "0123456789abcdef"),
    core: "0123456789abcdef",
    label: "[SLACK_TOKEN]",
  },
  {
    family: "google_api_key",
    sample: join("AI", "za", "012345678901234567890123456789abcde"),
    core: "012345678901234567890123456789abcde",
    label: "[GOOGLE_API_KEY]",
  },
  {
    family: "aws_secret_assignment",
    sample: join("aws_secret_access_key=", "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd"),
    core: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd",
    label: "[AWS_SECRET]",
  },
  {
    family: "github_oauth",
    sample: join("gho", "_", "0123456789abcdef0123456789abcdef0123"),
    core: "0123456789abcdef0123456789abcdef0123",
    label: "[GITHUB_TOKEN]",
  },
  {
    family: "github_user",
    sample: join("ghu", "_", "0123456789abcdef0123456789abcdef0123"),
    core: "0123456789abcdef0123456789abcdef0123",
    label: "[GITHUB_TOKEN]",
  },
  {
    family: "github_server",
    sample: join("ghs", "_", "0123456789abcdef0123456789abcdef0123"),
    core: "0123456789abcdef0123456789abcdef0123",
    label: "[GITHUB_TOKEN]",
  },
  {
    family: "github_refresh",
    sample: join("ghr", "_", "0123456789abcdef0123456789abcdef0123"),
    core: "0123456789abcdef0123456789abcdef0123",
    label: "[GITHUB_TOKEN]",
  },
  {
    family: "stripe_live_key",
    sample: join("sk", "_live_", "0123456789abcdefABCDEFGH"),
    core: "0123456789abcdefABCDEFGH",
    label: "[STRIPE_KEY]",
  },
  {
    family: "stripe_test_key",
    sample: join("sk", "_test_", "0123456789abcdefABCDEFGH"),
    core: "0123456789abcdefABCDEFGH",
    label: "[STRIPE_KEY]",
  },
  {
    family: "stripe_restricted_key",
    sample: join("rk", "_live_", "0123456789abcdefABCDEFGH"),
    core: "0123456789abcdefABCDEFGH",
    label: "[STRIPE_KEY]",
  },
  {
    family: "stripe_webhook_secret",
    sample: join("whsec", "_", "0123456789abcdefABCDEFGH"),
    core: "0123456789abcdefABCDEFGH",
    label: "[STRIPE_WEBHOOK_SECRET]",
  },
  {
    family: "anthropic_key",
    sample: join("sk-", "ant-", "0123456789abcdef012345"),
    core: "0123456789abcdef012345",
    label: "[ANTHROPIC_KEY]",
  },
  {
    family: "openai_project_key",
    sample: join("sk-", "proj-", "0123456789abcdef012345"),
    core: "0123456789abcdef012345",
    label: "[OPENAI_KEY]",
  },
  {
    family: "secret_key_sk",
    sample: join("sk", "-", "0123456789012345678901234567890123"),
    core: "0123456789012345678901234567890123",
    label: "[SECRET_KEY]",
  },
  {
    family: "npm_token",
    sample: join("npm", "_", "0123456789abcdef0123456789abcdef012345"),
    core: "0123456789abcdef0123456789abcdef012345",
    label: "[NPM_TOKEN]",
  },
  {
    family: "jwt_token",
    sample: join("eyJ", "hbGciOiJIUz", ".", "eyJzdWIiOiIx", ".", "dGVzdHNpZ25h"),
    core: "dGVzdHNpZ25h",
    label: "[JWT]",
  },
  {
    family: "pem_private_key",
    sample: join(
      "-----BEGIN PRIVATE KEY-----\n",
      "INERTFAKEKEYMATERIALNOTREAL",
      "\n-----END PRIVATE KEY-----",
    ),
    core: "INERTFAKEKEYMATERIALNOTREAL",
    label: "[PRIVATE_KEY]",
  },
  {
    family: "bearer_token",
    sample: join("Bearer ", "abcdef1234567890token"),
    core: "abcdef1234567890token",
    label: "[BEARER_TOKEN]",
  },
  {
    family: "generic_secret_assignment",
    sample: join("api_key=", '"supersecretvalue123"'),
    core: "supersecretvalue123",
    label: "[REDACTED]",
  },
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

test("every declared secret family has a synthetic sample (no drift)", () => {
  const sampled = new Set(SECRET_SAMPLES.map((s) => s.family));
  for (const def of SECRET_PATTERN_DEFS) {
    assert.ok(sampled.has(def.name), `missing synthetic sample for ${def.name}`);
  }
});

test("redacts labelled phone PII", () => {
  const { text, redactions } = new Sanitizer().sanitizeText("phone: +1 202 555 0100");
  assert.ok(!text.includes("202 555 0100"), text);
  assert.ok(text.includes("[PHONE]"), text);
  assert.ok(redactions >= 1);
});

test("redacts conservative E.164 phone PII", () => {
  const { text } = new Sanitizer().sanitizeText("call +12025550100 now");
  assert.ok(!text.includes("+12025550100"), text);
  assert.ok(text.includes("[PHONE]"), text);
});

test("does not treat a ticket id as a phone number", () => {
  const { text, redactions } = new Sanitizer().sanitizeText("see TICKET-1042 for details");
  assert.equal(text, "see TICKET-1042 for details");
  assert.equal(redactions, 0);
});

test("normalizeForScan strips zero-width and control characters", () => {
  assert.equal(normalizeForScan("a\u200Bb\u0000c"), "abc");
});

test("NFKC and zero-width characters cannot smuggle a GitHub token", () => {
  const hidden = join("gh", "\u200B", "p_", "0123456789abcdef0123456789abcdef0123");
  const { text, redactions } = new Sanitizer().sanitizeText(`token ${hidden}`);
  assert.ok(!text.includes("0123456789abcdef0123456789abcdef0123"), text);
  assert.ok(redactions >= 1);
});

test("sanitizeText returns per-rule redaction events", () => {
  const { events, redactions } = new Sanitizer().sanitizeText("reach me at user@example.com");
  assert.ok(redactions >= 1);
  assert.ok(events.some((e) => e.rule === "email" && e.count >= 1));
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
