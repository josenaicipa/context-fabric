import { Fabric } from "./fabric.js";
import type { ContextChunk, ContextRequest } from "./schemas.js";

const RESIDUAL_SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9]{36}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

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
      RESIDUAL_SECRET_PATTERNS.some((pattern) => pattern.test(chunk.text)),
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
