/**
 * Routing and empty-bundle diagnostics. Explains *why* a chunk was ranked,
 * excluded, or dropped without exposing proprietary scoring internals — only
 * the public weights already documented in the router.
 */
import type { RouteDecision } from "./router.js";
import { Router } from "./router.js";
import type {
  ContextBundle,
  ContextChunk,
  ContextRequest,
  DropReason,
  FabricConfig,
  PolicyWarning,
} from "./schemas.js";

export interface ChunkDiagnostic {
  id: string;
  score: number;
  boost: number;
  critical: boolean;
  reason: RouteDecision["reason"];
  summary: string;
}

export interface RouteReport {
  request: ContextRequest;
  kept: ChunkDiagnostic[];
  dropped: ChunkDiagnostic[];
  decisions: ChunkDiagnostic[];
}

export interface EmptyDiagnostic {
  empty: true;
  summary: string;
  byReason: Partial<Record<DropReason, number>>;
  hints: string[];
  warnings: PolicyWarning[];
}

const REASON_SUMMARY: Record<RouteDecision["reason"], string> = {
  kept: "kept in the routed set",
  out_of_scope: "excluded: project or channel does not match the request",
  out_of_scope_workspace: "excluded: workspace does not match the request",
  out_of_scope_thread: "excluded: thread-private chunk is out of the request thread",
  required_tags: "excluded: routing rule required tags are missing",
  max_chunks: "ranked out: above the request maxChunks cap",
  candidate_excluded: "excluded: candidate tag and includeCandidates was not set",
  duplicate: "dropped: duplicate of a higher-ranked chunk",
  sensitivity_blocked: "excluded: chunk sensitivity exceeds the request ceiling",
  per_chunk_cap: "dropped: chunk exceeds perChunkMaxTokens",
  over_budget: "dropped: did not fit the remaining token budget",
};

export function explainRoute(
  request: ContextRequest,
  chunks: ContextChunk[],
  config: FabricConfig = {},
): RouteReport {
  const decisions = new Router(config.routing ?? []).inspect(request, chunks).map((item) => ({
    id: item.chunk.id,
    score: Number.isFinite(item.score) ? item.score : Number.NEGATIVE_INFINITY,
    boost: item.boost,
    critical: item.critical,
    reason: item.reason,
    summary: REASON_SUMMARY[item.reason],
  }));
  return {
    request,
    kept: decisions.filter((d) => d.reason === "kept"),
    dropped: decisions.filter((d) => d.reason !== "kept"),
    decisions,
  };
}

export function routeReportToMarkdown(report: RouteReport): string {
  const lines = [
    "# Route diagnostics",
    "",
    `Query: ${report.request.query}`,
    `Project: ${report.request.project}`,
    `Channel: ${report.request.channel ?? "n/a"}`,
    `Workspace: ${report.request.workspace ?? "n/a"}`,
    `Thread: ${report.request.threadId ?? "n/a"}`,
    "",
    `Kept: ${report.kept.length}  Dropped: ${report.dropped.length}`,
    "",
    "| id | score | boost | critical | reason |",
    "| --- | ---: | ---: | --- | --- |",
  ];
  for (const item of report.decisions) {
    const score = Number.isFinite(item.score) ? item.score.toFixed(2) : "-inf";
    lines.push(
      `| ${item.id} | ${score} | ${item.boost} | ${item.critical ? "yes" : "no"} | ${item.reason} |`,
    );
  }
  return lines.join("\n") + "\n";
}

export function emptyDiagnostic(bundle: ContextBundle): EmptyDiagnostic | null {
  if (bundle.chunks.length > 0) return null;
  const byReason: Partial<Record<DropReason, number>> = {};
  for (const dropped of bundle.droppedChunks) {
    byReason[dropped.reason] = (byReason[dropped.reason] ?? 0) + 1;
  }
  const hints: string[] = [];
  if ((byReason.out_of_scope ?? 0) > 0) {
    hints.push(
      "No in-project / in-channel chunks survived routing. Check --project and --channel.",
    );
  }
  if ((byReason.out_of_scope_thread ?? 0) > 0) {
    hints.push(
      "Thread-private chunks were excluded. Pass --threadId to focus a thread, or omit thread stamps on shared chunks.",
    );
  }
  if ((byReason.sensitivity_blocked ?? 0) > 0) {
    hints.push(
      "Chunks exceeded the sensitivity ceiling (default: public). Pass --maxSensitivity internal|restricted to opt in.",
    );
  }
  if ((byReason.candidate_excluded ?? 0) > 0) {
    hints.push(
      "Candidate-tagged chunks are excluded by default. Pass --includeCandidates to admit them.",
    );
  }
  if ((byReason.over_budget ?? 0) > 0 || (byReason.per_chunk_cap ?? 0) > 0) {
    hints.push(
      "Every surviving chunk exceeded the token budget. Raise maxTokens or perChunkMaxTokens.",
    );
  }
  if ((byReason.required_tags ?? 0) > 0) {
    hints.push("A routing rule required tags that no chunk carried.");
  }
  if (hints.length === 0) {
    hints.push(
      "The corpus was empty or every chunk was dropped. Inspect droppedChunks for reasons.",
    );
  }
  const parts = Object.entries(byReason).map(([reason, n]) => `${n} ${reason}`);
  const summary =
    parts.length === 0
      ? "The final bundle is empty (no input chunks)."
      : `The final bundle is empty (${parts.join(", ")}).`;
  return { empty: true, summary, byReason, hints, warnings: bundle.warnings };
}

export function emptyDiagnosticToText(diagnostic: EmptyDiagnostic): string {
  return [diagnostic.summary, ...diagnostic.hints.map((hint) => `hint: ${hint}`)].join("\n") + "\n";
}
