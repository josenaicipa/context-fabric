/**
 * Shared, public-safe secret signatures.
 *
 * Single source of truth for the high-confidence credential families that both
 * the runtime {@link Sanitizer} (redaction) and the rollout/boundary checks
 * (detection) must agree on. Keeping one list prevents drift where, for example,
 * the boundary doctor blocks a token family the runtime sanitizer would still
 * leak.
 *
 * The patterns here are signatures, not real secrets. They are intentionally
 * conservative (prefix- and length-anchored) to keep false positives low.
 *
 * ReDoS note: every source below is linear-time (no nested/ambiguous
 * quantifiers over overlapping character classes). If you add a family, keep it
 * free of catastrophic-backtracking shapes such as `(a+)+`, since these run
 * against untrusted chunk text.
 */
import type { SanitizationRule } from "./schemas.js";

export interface SecretPatternDef {
  /** Stable identifier for the family. */
  name: string;
  /** Pattern source used for detection (`RegExp` without flags). */
  detect: string;
  /** Pattern source used for runtime redaction; defaults to `detect`. */
  redact?: string;
  /** Replacement label/template used by the runtime sanitizer. */
  replacement: string;
}

/**
 * High-confidence credential families.
 *
 * Detection (rollout/boundary) and redaction (sanitizer) share these sources.
 * A handful of families redact a slightly wider span than they detect (for
 * example PEM blocks redact through the END marker); those carry an explicit
 * `redact` source. Order matters for redaction: specific token shapes run
 * before the generic `key = value` rule so single-family inputs get a precise
 * label.
 */
export const SECRET_PATTERN_DEFS: ReadonlyArray<SecretPatternDef> = [
  { name: "aws_access_key", detect: "AKIA[0-9A-Z]{16}", replacement: "[AWS_KEY]" },
  { name: "github_pat", detect: "github_pat_[A-Za-z0-9_]{30,}", replacement: "[GITHUB_TOKEN]" },
  { name: "github_token", detect: "ghp_[A-Za-z0-9]{36}", replacement: "[GITHUB_TOKEN]" },
  { name: "slack_token", detect: "xox[baprs]-[A-Za-z0-9-]{10,}", replacement: "[SLACK_TOKEN]" },
  { name: "google_api_key", detect: "AIza[0-9A-Za-z_\\-]{35}", replacement: "[GOOGLE_API_KEY]" },
  { name: "stripe_live_key", detect: "sk_live_[0-9a-zA-Z]{24,}", replacement: "[STRIPE_KEY]" },
  { name: "secret_key_sk", detect: "sk-[A-Za-z0-9]{32,}", replacement: "[SECRET_KEY]" },
  {
    name: "pem_private_key",
    detect: "-----BEGIN [A-Z ]*PRIVATE KEY-----",
    // Redact the whole block when an END marker is present; fall back to the
    // header alone so a truncated block is never left partly intact.
    redact: "-----BEGIN [A-Z ]*PRIVATE KEY-----(?:[\\s\\S]*?-----END [A-Z ]*PRIVATE KEY-----)?",
    replacement: "[PRIVATE_KEY]",
  },
  {
    name: "bearer_token",
    // Detection stays strict (>=20) to avoid flagging short prose; redaction
    // catches shorter real tokens too (>=12).
    detect: "[Bb]earer\\s+[A-Za-z0-9._-]{20,}",
    redact: "[Bb]earer\\s+[A-Za-z0-9._-]{12,}",
    replacement: "[BEARER_TOKEN]",
  },
  {
    name: "generic_secret_assignment",
    // Detection requires quotes + a known key name (high confidence for policy
    // scans); redaction also catches unquoted `api_key = value` assignments.
    detect:
      "(?:password|api[_-]?key|access[_-]?token|client[_-]?secret)[\"']?\\s*[:=]\\s*[\"'][^\"'\\s]{12,}",
    redact: "(api[_-]?key|secret|token|password)\\s*[:=]\\s*['\"]?[^\\s'\"]{6,}",
    replacement: "$1=[REDACTED]",
  },
];

/**
 * Non-global compiled patterns for detection (`.test()` / `.match()` without
 * mutation). Consumed by rollout policy validation and chunk scanning so they
 * stay in lockstep with sanitizer redaction.
 */
export function secretDetectionPatterns(): RegExp[] {
  return SECRET_PATTERN_DEFS.map((def) => new RegExp(def.detect));
}

/**
 * Redaction rules (no email/PII — those live in the sanitizer's own baseline).
 * Returned as plain {@link SanitizationRule} so they compose with user rules.
 */
export const SECRET_SANITIZATION_RULES: ReadonlyArray<SanitizationRule> = SECRET_PATTERN_DEFS.map(
  (def) => ({
    name: def.name,
    pattern: def.redact ?? def.detect,
    replacement: def.replacement,
  }),
);
