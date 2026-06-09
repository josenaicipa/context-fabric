/** Public type definitions for the Context Fabric SDK. */

export type Sensitivity = "public" | "internal" | "restricted";
export type TaskType = "general" | "code" | "research" | "qa" | "summarize" | "agent_handoff";
export type DropReason = "out_of_scope" | "duplicate" | "sensitivity_blocked" | "per_chunk_cap" | "over_budget";

export interface Citation {
  sourceId: string;
  title?: string;
  uri?: string;
  locator?: string;
}

/** A single retrievable unit of context. */
export interface ContextChunk {
  id: string;
  text: string;
  project: string;
  channel?: string;
  tags?: string[];
  sensitivity?: Sensitivity;
  score?: number;
  workspace?: string;
  source?: Citation;
}

/** A request for context, scoped to a project and optional channel. */
export interface ContextRequest {
  query: string;
  project: string;
  channel?: string;
  tags?: string[];
  maxChunks?: number;
  workspace?: string;
  taskType?: TaskType;
  budgetProfile?: string;
  maxSensitivity?: Sensitivity;
}

export interface RoutingRule {
  project: string;
  channel?: string;
  boost?: number;
  requiredTags?: string[];
  workspace?: string;
  taskType?: TaskType;
}

export interface BudgetPolicy {
  maxTokens: number;
  reserveTokens?: number;
  perChunkMaxTokens?: number;
  name?: string;
}

export interface SanitizationRule {
  name: string;
  pattern: string;
  replacement?: string;
}

export interface DroppedChunk {
  id: string;
  reason: DropReason;
  tokens?: number;
}

export interface PolicyWarning {
  code: string;
  message: string;
}

export interface ContextBundle {
  request: ContextRequest;
  chunks: ContextChunk[];
  totalTokens: number;
  droppedChunkIds: string[];
  redactions: number;
  citations: Citation[];
  droppedChunks: DroppedChunk[];
  warnings: PolicyWarning[];
  budgetProfile: string;
}

export interface ContextPack {
  version: string;
  id: string;
  scope: { workspace?: string; project?: string; channel?: string };
  summary: string;
  sources: Citation[];
  chunks: ContextChunk[];
  sensitivity: Sensitivity;
  budgetProfile: string;
}

export interface FabricConfig {
  version?: number;
  routing?: RoutingRule[];
  budget?: BudgetPolicy;
  budgetProfiles?: Record<string, BudgetPolicy>;
  sanitization?: SanitizationRule[];
}

export function tokenEstimate(text: string): number {
  return Math.max(1, Math.floor(text.length / 4));
}

export function bundleToText(bundle: ContextBundle, separator = "\n\n---\n\n"): string {
  return bundle.chunks.map((c) => c.text).join(separator);
}

export function citationFor(chunk: ContextChunk): Citation {
  return chunk.source ?? { sourceId: chunk.id };
}
