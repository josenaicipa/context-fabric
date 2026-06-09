import type { BudgetPolicy } from "./schemas.js";

export const V1_BUDGET_PROFILES: Record<string, BudgetPolicy> = {
  "quick-answer": { maxTokens: 1800, reserveTokens: 250, perChunkMaxTokens: 500, name: "quick-answer" },
  debug: { maxTokens: 5000, reserveTokens: 800, perChunkMaxTokens: 1100, name: "debug" },
  "code-change": { maxTokens: 7000, reserveTokens: 1200, perChunkMaxTokens: 1400, name: "code-change" },
  audit: { maxTokens: 9000, reserveTokens: 1800, perChunkMaxTokens: 1800, name: "audit" },
  "deep-research": { maxTokens: 12000, reserveTokens: 2500, perChunkMaxTokens: 2200, name: "deep-research" },
  handoff: { maxTokens: 8000, reserveTokens: 1200, perChunkMaxTokens: 1600, name: "handoff" },
};

export function getBudgetProfile(name = "quick-answer"): BudgetPolicy {
  return V1_BUDGET_PROFILES[name] ?? V1_BUDGET_PROFILES["quick-answer"];
}
