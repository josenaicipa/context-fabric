import { Fabric } from "./fabric.js";
import { secretDetectionPatterns } from "./secret-patterns.js";
import type { ContextChunk, ContextRequest } from "./schemas.js";

export interface EvalCase {
  name: string;
  request: ContextRequest;
  chunks: ContextChunk[];
  expectedChunkIds: string[];
  forbiddenChunkIds?: string[];
}

export interface EvalReport {
  cases: number;
  recall: number;
  contamination: number;
  secretLeaks: number;
  passed: boolean;
}

export function runEvals(fabric: Fabric, cases: EvalCase[]): EvalReport {
  let hits = 0,
    expected = 0,
    contaminated = 0,
    forbidden = 0,
    leaks = 0;
  for (const item of cases) {
    const bundle = fabric.assemble(item.request, item.chunks);
    const kept = new Set(bundle.chunks.map((c) => c.id));
    expected += item.expectedChunkIds.length;
    hits += item.expectedChunkIds.filter((id) => kept.has(id)).length;
    forbidden += item.forbiddenChunkIds?.length ?? 0;
    contaminated += item.forbiddenChunkIds?.filter((id) => kept.has(id)).length ?? 0;
    leaks += bundle.chunks.filter((chunk) =>
      secretDetectionPatterns().some((pattern) => pattern.test(chunk.text)),
    ).length;
  }
  const recall = expected ? hits / expected : 1;
  const contamination = forbidden ? contaminated / forbidden : 0;
  return {
    cases: cases.length,
    recall,
    contamination,
    secretLeaks: leaks,
    passed: recall >= 0.9 && contamination === 0 && leaks === 0,
  };
}

export function evalReportToMarkdown(report: EvalReport): string {
  const verdict = report.passed ? "PASS" : "FAIL";
  return [
    `# Eval ${verdict}`,
    "",
    `- Cases: ${report.cases}`,
    `- Recall: ${report.recall.toFixed(3)}`,
    `- Contamination: ${report.contamination.toFixed(3)}`,
    `- Secret leaks: ${report.secretLeaks}`,
    "",
  ].join("\n");
}
