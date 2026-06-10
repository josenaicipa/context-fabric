/**
 * Content sanitizer.
 *
 * Redacts secrets and PII from chunk text before it leaves the fabric. Ships
 * with a baseline ruleset and accepts extra rules from configuration.
 *
 * The secret families live in {@link SECRET_SANITIZATION_RULES} so runtime
 * redaction stays in lockstep with the rollout/boundary detection patterns;
 * email is added here as the one PII family the detection set deliberately
 * omits.
 */
import { SECRET_SANITIZATION_RULES } from "./secret-patterns.js";
import type { ContextChunk, SanitizationRule } from "./schemas.js";

/** Email is PII rather than a credential, so it lives outside the shared secret set. */
const EMAIL_RULE: SanitizationRule = {
  name: "email",
  pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
  replacement: "[EMAIL]",
};

/**
 * Baseline rules applied to every sanitizer instance: email PII plus the full
 * shared high-confidence secret families (GitHub, Slack, Google, Stripe, AWS,
 * `sk-`, PEM private keys, bearer tokens, and generic credential assignments).
 */
export const DEFAULT_RULES: SanitizationRule[] = [EMAIL_RULE, ...SECRET_SANITIZATION_RULES];

interface CompiledRule {
  regex: RegExp;
  replacement: string;
}

/** Thrown when a sanitization rule carries an invalid regular expression. */
export class SanitizerRuleError extends Error {
  constructor(
    readonly ruleName: string,
    readonly pattern: string,
    readonly cause: unknown,
  ) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`Sanitizer: invalid regex in rule "${ruleName}" (/${pattern}/): ${reason}`);
    this.name = "SanitizerRuleError";
  }
}

function compileRule(rule: SanitizationRule): CompiledRule {
  try {
    // Global flag so subn-style counting and full replacement work.
    // NOTE: patterns run against untrusted chunk text — keep them linear-time
    // to avoid ReDoS. User-supplied rules are the caller's responsibility.
    return {
      regex: new RegExp(rule.pattern, "g"),
      replacement: rule.replacement ?? "[REDACTED]",
    };
  } catch (err) {
    // Surface a clear, actionable error instead of a cryptic raw RegExp throw.
    throw new SanitizerRuleError(rule.name, rule.pattern, err);
  }
}

export class Sanitizer {
  private readonly compiled: CompiledRule[];

  constructor(extraRules: SanitizationRule[] = [], useDefaults = true) {
    const rules = useDefaults ? [...DEFAULT_RULES, ...extraRules] : [...extraRules];
    this.compiled = rules.map(compileRule);
  }

  sanitizeText(text: string): { text: string; redactions: number } {
    let clean = text;
    let redactions = 0;
    for (const { regex, replacement } of this.compiled) {
      const matches = clean.match(regex);
      if (matches) redactions += matches.length;
      clean = clean.replace(regex, replacement);
    }
    return { text: clean, redactions };
  }

  sanitizeChunk(chunk: ContextChunk): { chunk: ContextChunk; redactions: number } {
    const { text, redactions } = this.sanitizeText(chunk.text);
    if (redactions === 0) return { chunk, redactions: 0 };
    return { chunk: { ...chunk, text }, redactions };
  }
}
