/**
 * Content sanitizer.
 *
 * Redacts secrets and PII from chunk text before it leaves the fabric. Ships
 * with a baseline ruleset and accepts extra rules from configuration.
 */
import type { ContextChunk, SanitizationRule } from "./schemas.js";

/** Baseline rules applied to every sanitizer instance. */
export const DEFAULT_RULES: SanitizationRule[] = [
  {
    name: "email",
    pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
    replacement: "[EMAIL]",
  },
  {
    name: "aws_access_key",
    pattern: "AKIA[0-9A-Z]{16}",
    replacement: "[AWS_KEY]",
  },
  {
    name: "bearer_token",
    pattern: "[Bb]earer\\s+[a-zA-Z0-9._\\-]{12,}",
    replacement: "[BEARER_TOKEN]",
  },
  {
    name: "generic_secret_assignment",
    pattern: "(api[_-]?key|secret|token|password)\\s*[:=]\\s*['\"]?[^\\s'\"]{6,}",
    replacement: "$1=[REDACTED]",
  },
];

interface CompiledRule {
  regex: RegExp;
  replacement: string;
}

export class Sanitizer {
  private readonly compiled: CompiledRule[];

  constructor(extraRules: SanitizationRule[] = [], useDefaults = true) {
    const rules = useDefaults ? [...DEFAULT_RULES, ...extraRules] : [...extraRules];
    this.compiled = rules.map((rule) => ({
      // Global flag so subn-style counting and full replacement work.
      regex: new RegExp(rule.pattern, "g"),
      replacement: rule.replacement ?? "[REDACTED]",
    }));
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
