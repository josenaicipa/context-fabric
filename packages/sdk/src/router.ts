/**
 * Scope-aware context router.
 *
 * Ranks chunks for a request and hard-excludes any chunk from a different
 * project, preventing cross-project context contamination.
 */
import type { ContextChunk, ContextRequest, RoutingRule } from "./schemas.js";

const CHANNEL_MATCH_WEIGHT = 10;
const PROJECT_MATCH_WEIGHT = 5;
const TAG_OVERLAP_WEIGHT = 1;
const EXCLUDED = Number.NEGATIVE_INFINITY;
const CRITICAL_TAGS = new Set(["must_keep", "critical"]);

function isCritical(chunk: ContextChunk): boolean {
  return (chunk.tags ?? []).some((tag) => CRITICAL_TAGS.has(tag));
}

export class Router {
  private readonly rules: RoutingRule[];

  constructor(rules: RoutingRule[] = []) {
    this.rules = rules;
  }

  private ruleBoost(chunk: ContextChunk, _request: ContextRequest): number {
    let boost = 0;
    const chunkTags = new Set(chunk.tags ?? []);
    for (const rule of this.rules) {
      if (rule.project !== chunk.project) continue;
      if (rule.channel !== undefined && rule.channel !== chunk.channel) continue;
      const required = rule.requiredTags ?? [];
      if (required.length > 0 && !required.every((t) => chunkTags.has(t))) {
        return EXCLUDED;
      }
      boost += rule.boost ?? 1;
    }
    return boost;
  }

  score(chunk: ContextChunk, request: ContextRequest): number {
    // Hard scope guard: different project is never in scope.
    if (chunk.project !== request.project) return EXCLUDED;
    if (request.channel !== undefined && chunk.channel !== undefined && chunk.channel !== request.channel) return EXCLUDED;

    let score = chunk.score ?? 0;
    score += PROJECT_MATCH_WEIGHT;
    if (request.channel !== undefined && chunk.channel === request.channel) {
      score += CHANNEL_MATCH_WEIGHT;
    }

    const requestTags = request.tags ?? [];
    if (requestTags.length > 0) {
      const chunkTags = new Set(chunk.tags ?? []);
      const overlap = requestTags.filter((t) => chunkTags.has(t)).length;
      score += overlap * TAG_OVERLAP_WEIGHT;
    }

    const boost = this.ruleBoost(chunk, request);
    if (boost === EXCLUDED) return EXCLUDED;
    return score + boost;
  }

  route(request: ContextRequest, chunks: ContextChunk[]): ContextChunk[] {
    const maxChunks = request.maxChunks ?? 20;
    const ranked = chunks
      .map((chunk) => ({ chunk, value: this.score(chunk, request) }))
      .filter((item) => item.value !== EXCLUDED)
      .sort((a, b) => b.value - a.value || a.chunk.id.localeCompare(b.chunk.id));
    const critical = ranked.filter((item) => isCritical(item.chunk));
    const optional = ranked.filter((item) => !isCritical(item.chunk));
    const remaining = Math.max(0, maxChunks - critical.length);
    return [...critical, ...optional.slice(0, remaining)]
      .map((item) => item.chunk);
  }
}
