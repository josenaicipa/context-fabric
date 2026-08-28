/**
 * Content sanitizer.
 *
 * Redacts secrets and PII from chunk text before it leaves the fabric. Ships
 * with a baseline ruleset and accepts extra rules from configuration.
 *
 * The secret families live in {@link SECRET_SANITIZATION_RULES} so runtime
 * redaction stays in lockstep with the rollout/boundary detection patterns;
 * email and phone PII live here because the detection set is credential-only.
 */
import { SECRET_SANITIZATION_RULES } from "./secret-patterns.js";
import type { ContextChunk, RedactionEvent, SanitizationRule } from "./schemas.js";

/** Email is PII rather than a credential, so it lives outside the shared secret set. */
const EMAIL_RULE: SanitizationRule = {
  name: "email",
  pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
  replacement: "[EMAIL]",
};

/**
 * Labelled phone numbers (PII). Requires a phone-like keyword so a bare
 * digit string in a ticket id is not treated as a phone number.
 */
const PHONE_LABELLED_RULE: SanitizationRule = {
  name: "phone_labelled",
  pattern:
    "(phone|tel(?:e(?:phone|fono))?|mobile|whatsapp|celular)(\\s*[:=]\\s*['\"]?)(?:\\+?[0-9][0-9\\s\\-().]{7,20})",
  replacement: "$1$2[PHONE]",
};

/**
 * Conservative E.164: a leading `+` plus 8–15 digits with optional separators.
 * Shorter local numbers stay untouched to keep false positives low.
 */
const PHONE_E164_RULE: SanitizationRule = {
  name: "phone_e164",
  pattern: "\\+[1-9]\\d{0,2}(?:[\\s.-]?\\d){7,11}\\b",
  replacement: "[PHONE]",
};

/**
 * Baseline rules applied to every sanitizer instance: PII (email, labelled
 * phone, E.164) plus the full shared high-confidence secret families (GitHub,
 * Slack, Google, Stripe, AWS, Anthropic, OpenAI-shaped `sk-`, JWT, npm, PEM
 * private keys, bearer tokens, and generic credential assignments).
 */
export const DEFAULT_RULES: SanitizationRule[] = [
  EMAIL_RULE,
  PHONE_LABELLED_RULE,
  PHONE_E164_RULE,
  ...SECRET_SANITIZATION_RULES,
];

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
      // `i` is public-safe: credential prefixes and PII labels are matched
      // regardless of case. Patterns stay linear-time; see secret-patterns.ts.
      regex: new RegExp(rule.pattern, "gi"),
      replacement: rule.replacement ?? "[REDACTED]",
    };
  } catch (err) {
    // Surface a clear, actionable error instead of a cryptic raw RegExp throw.
    throw new SanitizerRuleError(rule.name, rule.pattern, err);
  }
}

/**
 * Zero-width / invisible format characters (ZWSP, ZWNJ, ZWJ, word joiner,
 * BOM, soft hyphen). An attacker can splice these inside a token (e.g. a
 * U+200B between "gh" and "p_") so a prefix-anchored pattern no longer matches
 * while the secret survives a copy-paste. They carry no visible content, so
 * stripping them before rule matching is a safe normalization.
 */
const ZERO_WIDTH_CHARS = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;

/** True for C0/C1 controls except tab/newline/carriage-return. */
function isSmuggledControl(code: number): boolean {
  if (code === 9 || code === 10 || code === 13) return false;
  return code <= 31 || (code >= 127 && code <= 159);
}

function stripControlChars(text: string): string {
  let out = "";
  for (const ch of text) {
    if (!isSmuggledControl(ch.charCodeAt(0))) out += ch;
  }
  return out;
}

/**
 * NFKC-normalize and strip zero-width/control characters before scanning so
 * fullwidth/compatibility forms and invisible separators cannot smuggle a
 * secret past the pattern set.
 */
export function normalizeForScan(text: string): string {
  return stripControlChars(text.normalize("NFKC").replace(ZERO_WIDTH_CHARS, ""));
}

export class Sanitizer {
  private readonly compiled: Array<CompiledRule & { name: string }>;

  constructor(extraRules: SanitizationRule[] = [], useDefaults = true) {
    const rules = useDefaults ? [...DEFAULT_RULES, ...extraRules] : [...extraRules];
    this.compiled = rules.map((rule) => ({ name: rule.name, ...compileRule(rule) }));
  }

  sanitizeText(text: string): { text: string; redactions: number; events: RedactionEvent[] } {
    let clean = normalizeForScan(text);
    let redactions = 0;
    const events: RedactionEvent[] = [];
    for (const { name, regex, replacement } of this.compiled) {
      const matches = clean.match(regex);
      if (matches) {
        redactions += matches.length;
        events.push({ rule: name, count: matches.length });
      }
      clean = clean.replace(regex, replacement);
    }
    return { text: clean, redactions, events };
  }

  sanitizeChunk(chunk: ContextChunk): {
    chunk: ContextChunk;
    redactions: number;
    events: RedactionEvent[];
  } {
    const { text, redactions, events } = this.sanitizeText(chunk.text);
    // Text can change with zero redactions (zero-width stripping), so compare
    // the text itself rather than the redaction count.
    if (text === chunk.text) return { chunk, redactions, events };
    return { chunk: { ...chunk, text }, redactions, events };
  }
}
