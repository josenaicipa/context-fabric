/**
 * Scope-aware context router.
 *
 * Ranks chunks for a request and hard-excludes any chunk from a different
 * project, preventing cross-project context contamination.
 */
import type { ContextChunk, ContextRequest, DropReason, RoutingRule } from "./schemas.js";

const CHANNEL_MATCH_WEIGHT = 10;
const PROJECT_MATCH_WEIGHT = 5;
const WORKSPACE_MATCH_WEIGHT = 3;
const THREAD_MATCH_WEIGHT = 8;
const TAG_OVERLAP_WEIGHT = 1;
const EXCLUDED = Number.NEGATIVE_INFINITY;
export const CRITICAL_TAGS = new Set(["must_keep", "critical"]);

/** Why the router kept or dropped a chunk. `kept` is not a {@link DropReason}. */
export type RouteReason = DropReason | "kept";

export interface RouteDecision {
  chunk: ContextChunk;
  score: number;
  reason: RouteReason;
  boost: number;
  critical: boolean;
}

export function isCriticalChunk(chunk: ContextChunk): boolean {
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
      if (rule.workspace !== undefined && rule.workspace !== chunk.workspace) continue;
      if (rule.threadId !== undefined && rule.threadId !== chunk.threadId) continue;
      const required = rule.requiredTags ?? [];
      if (required.length > 0 && !required.every((t) => chunkTags.has(t))) {
        return EXCLUDED;
      }
      boost += rule.boost ?? 1;
    }
    return boost;
  }

  /**
   * Classify a single chunk against the request without applying `maxChunks`.
   * Negative-infinity scores are excluded; callers that need a drop reason
   * should use {@link inspect}.
   */
  score(chunk: ContextChunk, request: ContextRequest): number {
    return this.classify(chunk, request).score;
  }

  private classify(
    chunk: ContextChunk,
    request: ContextRequest,
  ): {
    score: number;
    reason: Exclude<RouteReason, "kept" | "max_chunks"> | "eligible";
    boost: number;
  } {
    // Hard scope guard: different project is never in scope.
    if (chunk.project !== request.project) {
      return { score: EXCLUDED, reason: "out_of_scope", boost: 0 };
    }
    if (
      request.channel !== undefined &&
      chunk.channel !== undefined &&
      chunk.channel !== request.channel
    ) {
      return { score: EXCLUDED, reason: "out_of_scope", boost: 0 };
    }
    if (
      request.workspace !== undefined &&
      chunk.workspace !== undefined &&
      chunk.workspace !== request.workspace
    ) {
      return { score: EXCLUDED, reason: "out_of_scope_workspace", boost: 0 };
    }
    // Thread-private chunks never enter a sibling thread or an unfocused
    // (no-thread) request. Unstamped chunks stay as thread-wide fallback.
    if (chunk.threadId !== undefined) {
      if (request.threadId === undefined || chunk.threadId !== request.threadId) {
        return { score: EXCLUDED, reason: "out_of_scope_thread", boost: 0 };
      }
    }

    let score = chunk.score ?? 0;
    score += PROJECT_MATCH_WEIGHT;
    if (request.workspace !== undefined && chunk.workspace === request.workspace) {
      score += WORKSPACE_MATCH_WEIGHT;
    }
    if (request.channel !== undefined && chunk.channel === request.channel) {
      score += CHANNEL_MATCH_WEIGHT;
    }
    if (request.threadId !== undefined && chunk.threadId === request.threadId) {
      score += THREAD_MATCH_WEIGHT;
    }

    const requestTags = request.tags ?? [];
    if (requestTags.length > 0) {
      const chunkTags = new Set(chunk.tags ?? []);
      const overlap = requestTags.filter((t) => chunkTags.has(t)).length;
      score += overlap * TAG_OVERLAP_WEIGHT;
    }

    const boost = this.ruleBoost(chunk, request);
    if (boost === EXCLUDED) {
      return { score: EXCLUDED, reason: "required_tags", boost: 0 };
    }
    return { score: score + boost, reason: "eligible", boost };
  }

  /**
   * Explain every input chunk: kept, ranked-out by `maxChunks`, or excluded
   * for a specific scope reason. Stable order: original corpus order.
   */
  inspect(request: ContextRequest, chunks: ContextChunk[]): RouteDecision[] {
    const maxChunks = request.maxChunks ?? 20;
    const classified = chunks.map((chunk) => {
      const { score, reason, boost } = this.classify(chunk, request);
      return { chunk, score, reason, boost, critical: isCriticalChunk(chunk) };
    });
    const eligible = classified
      .filter((item) => item.reason === "eligible")
      .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id));
    const critical = eligible.filter((item) => item.critical);
    const optional = eligible.filter((item) => !item.critical);
    const remaining = Math.max(0, maxChunks - critical.length);
    const keptIds = new Set(
      [...critical, ...optional.slice(0, remaining)].map((item) => item.chunk.id),
    );
    return classified.map((item) => {
      if (item.reason !== "eligible") {
        return {
          chunk: item.chunk,
          score: item.score,
          reason: item.reason,
          boost: item.boost,
          critical: item.critical,
        };
      }
      return {
        chunk: item.chunk,
        score: item.score,
        reason: keptIds.has(item.chunk.id) ? "kept" : "max_chunks",
        boost: item.boost,
        critical: item.critical,
      };
    });
  }

  route(request: ContextRequest, chunks: ContextChunk[]): ContextChunk[] {
    const kept = this.inspect(request, chunks).filter((item) => item.reason === "kept");
    const byScore = (a: RouteDecision, b: RouteDecision): number =>
      b.score - a.score || a.chunk.id.localeCompare(b.chunk.id);
    const critical = kept.filter((item) => item.critical).sort(byScore);
    const optional = kept.filter((item) => !item.critical).sort(byScore);
    return [...critical, ...optional].map((item) => item.chunk);
  }
}
