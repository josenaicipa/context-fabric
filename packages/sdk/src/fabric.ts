/** End-to-end public fabric pipeline: route -> sanitize -> dedupe -> budget. */
import { Budgeter } from "./budgeter.js";
import { Router } from "./router.js";
import { Sanitizer } from "./sanitizer.js";
import { citationFor, tokenEstimate, type ContextBundle, type ContextChunk, type ContextRequest, type DroppedChunk, type FabricConfig, type Sensitivity } from "./schemas.js";

const sensitivityRank: Record<Sensitivity, number> = { public: 0, internal: 1, restricted: 2 };

function fingerprint(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 400);
}

export class Fabric {
  private readonly router: Router;
  private readonly sanitizer: Sanitizer;
  private readonly config: FabricConfig;

  constructor(config: FabricConfig = {}) {
    this.config = config;
    this.router = new Router(config.routing ?? []);
    this.sanitizer = new Sanitizer(config.sanitization ?? []);
  }

  private budgetFor(request: ContextRequest): { name: string; budgeter: Budgeter } {
    const profile = request.budgetProfile ?? request.taskType ?? "default";
    const policy = this.config.budgetProfiles?.[profile] ?? this.config.budgetProfiles?.default ?? this.config.budget ?? { maxTokens: 8000, name: "default" };
    return { name: policy.name ?? profile, budgeter: new Budgeter(policy) };
  }

  assemble(request: ContextRequest, chunks: ContextChunk[]): ContextBundle {
    const routed = this.router.route(request, chunks);
    const routedIds = new Set(routed.map((c) => c.id));
    const droppedChunks: DroppedChunk[] = chunks.filter((c) => !routedIds.has(c.id)).map((c) => ({ id: c.id, reason: "out_of_scope", tokens: tokenEstimate(c.text) }));
    const warnings = [];
    const maxSensitivity = request.maxSensitivity ?? "restricted";
    const allowed = routed.filter((chunk) => {
      const ok = sensitivityRank[chunk.sensitivity ?? "internal"] <= sensitivityRank[maxSensitivity];
      if (!ok) droppedChunks.push({ id: chunk.id, reason: "sensitivity_blocked", tokens: tokenEstimate(chunk.text) });
      return ok;
    });
    const seen = new Set<string>();
    const deduped: ContextChunk[] = [];
    for (const chunk of allowed) {
      const fp = fingerprint(chunk.text);
      if (seen.has(fp)) {
        droppedChunks.push({ id: chunk.id, reason: "duplicate", tokens: tokenEstimate(chunk.text) });
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
    for (const id of dropped) {
      const chunk = sanitized.find((c) => c.id === id);
      droppedChunks.push({ id, reason: "over_budget", tokens: chunk ? tokenEstimate(chunk.text) : undefined });
    }
    if (kept.length === 0) warnings.push({ code: "empty_bundle", message: "The final bundle is empty." });
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
