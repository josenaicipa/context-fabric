/**
 * Public type definitions for the Context Fabric SDK.
 *
 * This is a clean-room client implementation. It shares concepts with the
 * private core engine but no code or data — see boundary.manifest.json.
 */

export type Sensitivity = "public" | "internal" | "restricted";

/** A single retrievable unit of context. */
export interface ContextChunk {
  id: string;
  text: string;
  project: string;
  channel?: string;
  tags?: string[];
  sensitivity?: Sensitivity;
  /** Optional pre-computed relevance score; higher is better. */
  score?: number;
}

/** A request for context, scoped to a project and optional channel. */
export interface ContextRequest {
  query: string;
  project: string;
  channel?: string;
  tags?: string[];
  maxChunks?: number;
}

/** A rule that adjusts chunk relevance during routing. */
export interface RoutingRule {
  project: string;
  channel?: string;
  boost?: number;
  requiredTags?: string[];
}

/** Token budget applied by the budgeter. */
export interface BudgetPolicy {
  maxTokens: number;
  reserveTokens?: number;
  perChunkMaxTokens?: number;
}

/** A named regex rule that redacts sensitive substrings. */
export interface SanitizationRule {
  name: string;
  /** Source for a RegExp; compiled with the global flag. */
  pattern: string;
  replacement?: string;
}

/** The final assembled context returned to a caller. */
export interface ContextBundle {
  request: ContextRequest;
  chunks: ContextChunk[];
  totalTokens: number;
  droppedChunkIds: string[];
  redactions: number;
}

/** Full fabric configuration. */
export interface FabricConfig {
  version?: number;
  routing?: RoutingRule[];
  budget?: BudgetPolicy;
  sanitization?: SanitizationRule[];
}

/** Rough token estimate (~4 chars per token, min 1). */
export function tokenEstimate(text: string): number {
  return Math.max(1, Math.floor(text.length / 4));
}

/** Render a bundle's chunks as a single string. */
export function bundleToText(bundle: ContextBundle, separator = "\n\n---\n\n"): string {
  return bundle.chunks.map((c) => c.text).join(separator);
}
