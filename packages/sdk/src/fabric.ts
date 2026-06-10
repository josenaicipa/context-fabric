/** End-to-end public fabric pipeline: route -> sanitize -> dedupe -> budget. */
import { createHash } from "node:crypto";
import { Budgeter } from "./budgeter.js";
import { isCriticalChunk, Router } from "./router.js";
import { Sanitizer } from "./sanitizer.js";
import {
  citationFor,
  tokenEstimate,
  type ContextBundle,
  type ContextChunk,
  type ContextRequest,
  type DroppedChunk,
  type FabricConfig,
  type Sensitivity,
  type TokenCounter,
} from "./schemas.js";

/**
 * Runtime (non-serializable) options for {@link Fabric}. Kept separate from
 * {@link FabricConfig} so config stays a plain JSON document.
 */
export interface FabricOptions {
  /** Custom token counter; defaults to the built-in ~4 chars/token heuristic. */
  tokenCounter?: TokenCounter;
}

const sensitivityRank: Record<Sensitivity, number> = { public: 0, internal: 1, restricted: 2 };

/**
 * Fail-closed default ceiling: when a caller omits `maxSensitivity`, only
 * `public` chunks pass. This keeps a default bundle aligned with the default
 * `auditBundle` ceiling (also `public`), so an un-opted-in bundle never carries
 * internal/restricted material. Callers opt in explicitly to widen the ceiling.
 */
const DEFAULT_MAX_SENSITIVITY: Sensitivity = "public";

/**
 * Dedupe fingerprint over the *full* normalized text. Hashing (rather than a
 * 400-char prefix) prevents two distinct long chunks that share an opening from
 * being collapsed as duplicates, while keeping keys bounded. `node:crypto` is a
 * built-in, so this adds no dependency.
 */
function fingerprint(text: string): string {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex");
}

export class Fabric {
  private readonly router: Router;
  private readonly sanitizer: Sanitizer;
  private readonly config: FabricConfig;
  private readonly countTokens: TokenCounter;

  constructor(config: FabricConfig = {}, options: FabricOptions = {}) {
    this.config = config;
    this.router = new Router(config.routing ?? []);
    this.sanitizer = new Sanitizer(config.sanitization ?? []);
    this.countTokens = options.tokenCounter ?? tokenEstimate;
  }

  private budgetFor(request: ContextRequest): { name: string; budgeter: Budgeter } {
    const profile = request.budgetProfile ?? request.taskType ?? "default";
    const policy = this.config.budgetProfiles?.[profile] ??
      this.config.budgetProfiles?.default ??
      this.config.budget ?? { maxTokens: 8000, name: "default" };
    return { name: policy.name ?? profile, budgeter: new Budgeter(policy, this.countTokens) };
  }

  assemble(request: ContextRequest, chunks: ContextChunk[]): ContextBundle {
    const routed = this.router.route(request, chunks);
    const routedIds = new Set(routed.map((c) => c.id));
    const droppedChunks: DroppedChunk[] = chunks
      .filter((c) => !routedIds.has(c.id))
      .map((c) => ({ id: c.id, reason: "out_of_scope", tokens: this.countTokens(c.text) }));
    const warnings = [];
    const maxSensitivity = request.maxSensitivity ?? DEFAULT_MAX_SENSITIVITY;
    const allowed = routed.filter((chunk) => {
      if ((chunk.tags ?? []).includes("candidate") && !request.includeCandidates) {
        droppedChunks.push({
          id: chunk.id,
          reason: "candidate_excluded",
          tokens: this.countTokens(chunk.text),
        });
        warnings.push({
          code: "candidate_excluded",
          message: `Chunk ${chunk.id} was tagged candidate and excluded by default.`,
        });
        return false;
      }
      const ok =
        sensitivityRank[chunk.sensitivity ?? "internal"] <= sensitivityRank[maxSensitivity];
      if (!ok)
        droppedChunks.push({
          id: chunk.id,
          reason: "sensitivity_blocked",
          tokens: this.countTokens(chunk.text),
        });
      return ok;
    });
    const seen = new Set<string>();
    const deduped: ContextChunk[] = [];
    for (const chunk of allowed) {
      const fp = fingerprint(chunk.text);
      if (seen.has(fp)) {
        droppedChunks.push({
          id: chunk.id,
          reason: "duplicate",
          tokens: this.countTokens(chunk.text),
        });
        continue;
      }
      seen.add(fp);
      deduped.push(chunk);
    }
    const sanitized: ContextChunk[] = [];
    let redactions = 0;
    for (const chunk of deduped) {
      const result = this.sanitizer.sanitizeChunk(chunk);
      sanitized.push(result.chunk);
      redactions += result.redactions;
    }
    const { name, budgeter } = this.budgetFor(request);
    const { kept, dropped, totalTokens } = budgeter.fit(sanitized);
    const sanitizedById = new Map(sanitized.map((chunk) => [chunk.id, chunk]));
    const criticalBudgetDrops: string[] = [];
    for (const id of dropped) {
      const chunk = sanitizedById.get(id);
      if (chunk && isCriticalChunk(chunk)) criticalBudgetDrops.push(id);
      droppedChunks.push({
        id,
        reason: "over_budget",
        tokens: chunk ? this.countTokens(chunk.text) : undefined,
      });
    }
    if (criticalBudgetDrops.length > 0) {
      warnings.push({
        code: "critical_dropped",
        message: `Critical chunk(s) dropped by token budget: ${criticalBudgetDrops.join(", ")}`,
      });
    }
    if (kept.length === 0)
      warnings.push({ code: "empty_bundle", message: "The final bundle is empty." });
    return {
      request,
      chunks: kept,
      totalTokens,
      droppedChunkIds: droppedChunks.map((d) => d.id),
      redactions,
      citations: kept.map(citationFor),
      droppedChunks,
      warnings,
      budgetProfile: name,
    };
  }
}
