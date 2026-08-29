/**
 * Token budgeter.
 *
 * Trims a ranked list of chunks so the bundle fits within a BudgetPolicy.
 * Chunks are consumed in rank order, so the most relevant context survives.
 */
import {
  tokenEstimate,
  type BudgetPolicy,
  type ContextChunk,
  type TokenCounter,
} from "./schemas.js";

export interface BudgetDrop {
  id: string;
  reason: "per_chunk_cap" | "over_budget";
  tokens: number;
}

export interface BudgetResult {
  kept: ContextChunk[];
  dropped: string[];
  droppedDetails: BudgetDrop[];
  totalTokens: number;
}

export class Budgeter {
  private readonly policy: BudgetPolicy;
  private readonly countTokens: TokenCounter;

  constructor(
    policy: BudgetPolicy = { maxTokens: 8000 },
    tokenCounter: TokenCounter = tokenEstimate,
  ) {
    this.policy = policy;
    this.countTokens = tokenCounter;
  }

  private available(): number {
    return Math.max(0, this.policy.maxTokens - (this.policy.reserveTokens ?? 0));
  }

  fit(chunks: ContextChunk[]): BudgetResult {
    const available = this.available();
    const perChunkCap = this.policy.perChunkMaxTokens;

    const kept: ContextChunk[] = [];
    const dropped: string[] = [];
    const droppedDetails: BudgetDrop[] = [];
    let total = 0;

    for (const chunk of chunks) {
      const cost = this.countTokens(chunk.text);
      if (perChunkCap !== undefined && cost > perChunkCap) {
        dropped.push(chunk.id);
        droppedDetails.push({ id: chunk.id, reason: "per_chunk_cap", tokens: cost });
        continue;
      }
      if (total + cost > available) {
        dropped.push(chunk.id);
        droppedDetails.push({ id: chunk.id, reason: "over_budget", tokens: cost });
        continue;
      }
      kept.push(chunk);
      total += cost;
    }

    return { kept, dropped, droppedDetails, totalTokens: total };
  }
}
