import { Fabric } from "./fabric.js";
import type { ContextChunk, ContextRequest, TaskType, Sensitivity } from "./schemas.js";
import { tokenEstimate } from "./schemas.js";

export interface BenchmarkCase {
  name: string;
  request: ContextRequest;
  chunks: ContextChunk[];
  expectedChunkIds: string[];
  forbiddenChunkIds: string[];
}

export interface CaseResult {
  name: string;
  baselineTokens: number;
  sameScopeTokens: number;
  keptTokens: number;
  tokenReduction: number;
  sameScopeTokenReduction: number;
  recall: number;
  contamination: number;
  candidateLeaks: number;
  secretLeaks: number;
  keptChunkIds: string[];
  expectedKept: string[];
  forbiddenKept: string[];
}

export interface BenchmarkReport {
  cases: number;
  targetTokenReduction: number;
  medianTokenReduction: number;
  meanTokenReduction: number;
  minTokenReduction: number;
  medianSameScopeTokenReduction: number;
  recall: number;
  contamination: number;
  candidateLeaks: number;
  secretLeaks: number;
  reliabilityPassed: boolean;
  reductionTargetMet: boolean;
  passed: boolean;
  caseResults: CaseResult[];
}

function paragraph(label: string, repeat = 24): string {
  return Array.from({ length: repeat }, (_, i) => `${label} operational detail ${i} with generic fictional process notes and non-actionable filler.`).join(" ");
}

function chunk(id: string, text: string, project: string, channel?: string, opts: { tags?: string[]; sensitivity?: Sensitivity; score?: number } = {}): ContextChunk {
  return { id, text, project, channel, tags: opts.tags ?? [], sensitivity: opts.sensitivity ?? "internal", score: opts.score ?? 0.5 };
}

function noise(prefix: string, project: string, channel: string, count = 8): ContextChunk[] {
  return Array.from({ length: count }, (_, i) => chunk(`${prefix}-noise-${i}`, paragraph(`${prefix} noise ${i}`, 28), project, channel, { score: 0.2 }));
}

function sameScopeNoise(prefix: string, project: string, channel: string, count = 8): ContextChunk[] {
  return Array.from({ length: count }, (_, i) => chunk(`${prefix}-same-scope-noise-${i}`, paragraph(`${prefix} same scope noise ${i}`, 30), project, channel, { score: 0.05 }));
}

function scenario(index: number, name: string, channelName: string, taskType: TaskType, budgetProfile: string, topic: string): BenchmarkCase {
  const project = index % 2 === 0 ? "acme-shop" : "demo";
  const otherProject = project === "acme-shop" ? "other-co" : "example";
  const primary = `${name}-primary`;
  const guardrail = `${name}-guardrail`;
  return {
    name,
    request: { query: `handle ${topic}`, project, channel: channelName, taskType, budgetProfile, maxSensitivity: "internal", maxChunks: 2 },
    chunks: [
      chunk(primary, `${topic} primary context: exact action, source of truth, and safe response path.`, project, channelName, { tags: [topic, "primary"], score: 0.98 }),
      chunk(guardrail, `${topic} guardrail: stay read-only, cite evidence, and escalate ambiguity.`, project, channelName, { tags: [topic, "guardrail"], score: 0.95 }),
      chunk(`${name}-candidate`, "Candidate note excluded unless explicitly requested.", project, channelName, { tags: ["candidate"], score: 0.35 }),
      ...sameScopeNoise(name, project, channelName, 8),
      ...noise(`${name}-adjacent`, project, "adjacent", 8),
      ...noise(`${name}-foreign`, otherProject, channelName, 8),
    ],
    expectedChunkIds: [primary, guardrail],
    forbiddenChunkIds: [`${name}-candidate`, `${name}-adjacent-noise-0`, `${name}-foreign-noise-0`],
  };
}

export function publicBenchmarkCases(): BenchmarkCase[] {
  const specs: Array<[string, string, TaskType, string, string]> = [
    ["coding-agent-noisy-repo", "engineering", "code", "code-change", "checkout-bug"],
    ["support-agent-cross-customer", "support", "qa", "debug", "shipping-delay"],
    ["research-agent-document-pile", "research", "research", "deep-research", "returns-policy"],
    ["agent-handoff-memory-scope", "billing", "agent_handoff", "handoff", "billing-handoff"],
    ["sales-crm-handoff", "sales", "agent_handoff", "handoff", "lead-handoff"],
    ["qa-regression-triage", "qa", "qa", "debug", "regression"],
    ["docs-summarize", "docs", "summarize", "quick-answer", "docs-summary"],
    ["security-audit", "security", "qa", "audit", "security-audit"],
    ["research-brief", "research", "research", "deep-research", "research-brief"],
    ["code-review", "engineering", "code", "code-change", "code-review"],
    ["ops-runbook", "ops", "agent_handoff", "handoff", "runbook"],
    ["customer-success", "success", "qa", "debug", "success-response"],
  ];
  return specs.map((spec, i) => scenario(i, ...spec));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function hasSecretLikeText(text: string): boolean {
  return /api[_-]?key\s*=|bearer\s+[a-z0-9._-]{8,}/i.test(text);
}

function caseResult(fabric: Fabric, testCase: BenchmarkCase): CaseResult {
  const bundle = fabric.assemble(testCase.request, testCase.chunks);
  const keptIds = bundle.chunks.map((c) => c.id);
  const kept = new Set(keptIds);
  const expectedKept = testCase.expectedChunkIds.filter((id) => kept.has(id));
  const forbiddenKept = testCase.forbiddenChunkIds.filter((id) => kept.has(id));
  const baselineTokens = testCase.chunks.reduce((sum, c) => sum + tokenEstimate(c.text), 0);
  const sameScopeTokens = testCase.chunks
    .filter((c) => c.project === testCase.request.project && (testCase.request.channel === undefined || c.channel === undefined || c.channel === testCase.request.channel))
    .reduce((sum, c) => sum + tokenEstimate(c.text), 0);
  const keptTokens = bundle.totalTokens;
  return {
    name: testCase.name,
    baselineTokens,
    sameScopeTokens,
    keptTokens,
    tokenReduction: baselineTokens ? 1 - keptTokens / baselineTokens : 0,
    sameScopeTokenReduction: sameScopeTokens ? 1 - keptTokens / sameScopeTokens : 0,
    recall: testCase.expectedChunkIds.length ? expectedKept.length / testCase.expectedChunkIds.length : 1,
    contamination: testCase.forbiddenChunkIds.length ? forbiddenKept.length / testCase.forbiddenChunkIds.length : 0,
    candidateLeaks: bundle.chunks.filter((c) => (c.tags ?? []).includes("candidate")).length,
    secretLeaks: bundle.chunks.filter((c) => hasSecretLikeText(c.text)).length,
    keptChunkIds: keptIds,
    expectedKept,
    forbiddenKept,
  };
}

export function runPublicBenchmarks(cases = publicBenchmarkCases(), targetTokenReduction = 0.75, fabric = new Fabric()): BenchmarkReport {
  const caseResults = cases.map((c) => caseResult(fabric, c));
  const reductions = caseResults.map((r) => r.tokenReduction);
  const sameScopeReductions = caseResults.map((r) => r.sameScopeTokenReduction);
  const expectedTotal = cases.reduce((sum, c) => sum + c.expectedChunkIds.length, 0);
  const expectedKept = caseResults.reduce((sum, r) => sum + r.expectedKept.length, 0);
  const forbiddenTotal = cases.reduce((sum, c) => sum + c.forbiddenChunkIds.length, 0);
  const forbiddenKept = caseResults.reduce((sum, r) => sum + r.forbiddenKept.length, 0);
  const recall = expectedTotal ? expectedKept / expectedTotal : 1;
  const contamination = forbiddenTotal ? forbiddenKept / forbiddenTotal : 0;
  const candidateLeaks = caseResults.reduce((sum, r) => sum + r.candidateLeaks, 0);
  const secretLeaks = caseResults.reduce((sum, r) => sum + r.secretLeaks, 0);
  const medianTokenReduction = median(reductions);
  const medianSameScopeTokenReduction = median(sameScopeReductions);
  const reliabilityPassed = recall >= 0.9 && contamination === 0 && candidateLeaks === 0 && secretLeaks === 0;
  const reductionTargetMet = medianTokenReduction >= targetTokenReduction && medianSameScopeTokenReduction >= targetTokenReduction;
  return {
    cases: caseResults.length,
    targetTokenReduction,
    medianTokenReduction,
    meanTokenReduction: reductions.reduce((a, b) => a + b, 0) / reductions.length,
    minTokenReduction: Math.min(...reductions),
    medianSameScopeTokenReduction,
    recall,
    contamination,
    candidateLeaks,
    secretLeaks,
    reliabilityPassed,
    reductionTargetMet,
    passed: reliabilityPassed,
    caseResults,
  };
}

function pct(value: number): string {
  let percent = value * 100;
  if (value > 0 && value < 1 && Math.round(percent * 10) / 10 >= 100) percent = 99.9;
  return `${percent.toFixed(1)}%`;
}

export function benchmarkReportToMarkdown(report: BenchmarkReport): string {
  const lines = [
    "# Context Fabric Public Benchmark Report",
    "",
    `- Cases: ${report.cases}`,
    `- Target token reduction: ${pct(report.targetTokenReduction)}`,
    `- Median token reduction vs naive send-all: ${pct(report.medianTokenReduction)}`,
    `- Mean token reduction vs naive send-all: ${pct(report.meanTokenReduction)}`,
    `- Min token reduction vs naive send-all: ${pct(report.minTokenReduction)}`,
    `- Median token reduction vs same-scope baseline: ${pct(report.medianSameScopeTokenReduction)}`,
    `- Recall: ${pct(report.recall)}`,
    `- Contamination: ${pct(report.contamination)}`,
    `- Candidate leaks: ${report.candidateLeaks}`,
    `- Secret leaks: ${report.secretLeaks}`,
    `- Reliability gates: ${report.reliabilityPassed ? "PASS" : "FAIL"}`,
    `- Token reduction target: ${report.reductionTargetMet ? "MET" : "MISSED"}`,
    `- Verdict: ${report.passed ? "PASS" : "FAIL"}`,
    "",
    "| Case | Send-All Tokens | Kept Tokens | Send-All Reduction | Same-Scope Reduction | Recall | Contamination |",
    "|---|---:|---:|---:|---:|---:|---:|",
  ];
  for (const result of report.caseResults) {
    lines.push(`| ${result.name} | ${result.baselineTokens} | ${result.keptTokens} | ${pct(result.tokenReduction)} | ${pct(result.sameScopeTokenReduction)} | ${pct(result.recall)} | ${pct(result.contamination)} |`);
  }
  return `${lines.join("\n")}\n`;
}
