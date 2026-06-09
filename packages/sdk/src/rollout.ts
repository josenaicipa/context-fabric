/**
 * Public-safe client/team rollout kit.
 *
 * Reads a generic channel/team rollout policy (fictional scopes only), validates
 * that it carries no forbidden scopes or secret material, and runs a local smoke
 * over the public assemble path: expected chunks present, forbidden chunks absent,
 * candidate chunks excluded unless explicitly allowed. Produces a machine-readable
 * report and optional markdown. Clean-room: no dependency on the private core.
 */
import { Fabric } from "./fabric.js";
import type { ContextChunk, ContextRequest, Sensitivity } from "./schemas.js";

export interface RolloutRouteMatch {
  platform?: string;
  channel?: string;
  threadPrefix?: string;
}

export interface RolloutScope {
  project: string;
  channel?: string;
  workspace?: string;
}

export interface RolloutRoute {
  match: RolloutRouteMatch;
  scope: RolloutScope;
  budgetProfile?: string;
  maxSensitivity?: Sensitivity;
  notes?: string;
}

export interface RolloutDefaults {
  budgetProfile?: string;
  fallback?: string;
  forbiddenDataClasses?: string[];
  criticalTags?: string[];
}

export interface RolloutPolicy {
  version?: number;
  description?: string;
  defaults?: RolloutDefaults;
  routes: RolloutRoute[];
  guardrails?: string[];
}

export interface RolloutFinding {
  code: string;
  severity: "blocker" | "warning";
  message: string;
  where?: string;
}

export interface RolloutValidation {
  passed: boolean;
  findings: RolloutFinding[];
}

export interface RolloutSmokeCase {
  name: string;
  scope: RolloutScope;
  query: string;
  chunks: ContextChunk[];
  expectedChunkIds: string[];
  forbiddenChunkIds?: string[];
  includeCandidates?: boolean;
  budgetProfile?: string;
  maxSensitivity?: Sensitivity;
}

export interface RolloutCaseResult {
  name: string;
  routeMatched: boolean;
  expectedPresent: string[];
  expectedMissing: string[];
  forbiddenPresent: string[];
  candidateLeaks: number;
  secretLeaks: number;
  keptChunkIds: string[];
  passed: boolean;
}

export interface RolloutReport {
  validation: RolloutValidation;
  cases: number;
  recall: number;
  contamination: number;
  candidateLeaks: number;
  secretLeaks: number;
  unroutedCases: number;
  reliabilityPassed: boolean;
  passed: boolean;
  caseResults: RolloutCaseResult[];
}

/** Fictional scopes that are safe to ship in the public repo (mirrors boundary.manifest.json). */
export const DEFAULT_SCOPE_ALLOWLIST = ["acme-shop", "other-co", "demo", "example"] as const;

/** Secret signatures that must never appear in a public-safe policy or smoke fixture. */
const SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9]{36}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /sk-[A-Za-z0-9]{32,}/,
  /sk_live_[0-9a-zA-Z]{24,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /[Bb]earer\s+[A-Za-z0-9._-]{20,}/,
  /(?:password|api[_-]?key|access[_-]?token|client[_-]?secret)["']?\s*[:=]\s*["'][^"'\s]{12,}/i,
];

function baseScope(value: string): string {
  return value.startsWith("#") ? value.slice(1) : value;
}

function isAllowedScope(value: string, allowlist: ReadonlyArray<string>): boolean {
  const base = baseScope(value);
  if (allowlist.includes(base)) return true;
  // ALL_CAPS placeholders (e.g. YOUR_PROJECT) are accepted as template fill-in tokens
  // ONLY — they mark a scope a team must replace, never a real project/channel name.
  return /^[A-Z][A-Z0-9_]*$/.test(base);
}

function scopeValues(route: RolloutRoute): string[] {
  const values = [route.scope.project];
  if (route.scope.channel) values.push(route.scope.channel);
  if (route.scope.workspace) values.push(route.scope.workspace);
  if (route.match.channel) values.push(route.match.channel);
  return values;
}

export interface ValidateRolloutPolicyOptions {
  scopeAllowlist?: ReadonlyArray<string>;
}

/** Validate a rollout policy is public-safe: allowlisted scopes only, no secrets, well-formed. */
export function validateRolloutPolicy(policy: RolloutPolicy, opts: ValidateRolloutPolicyOptions = {}): RolloutValidation {
  const allowlist = opts.scopeAllowlist ?? DEFAULT_SCOPE_ALLOWLIST;
  const findings: RolloutFinding[] = [];

  if (!Array.isArray(policy.routes) || policy.routes.length === 0) {
    findings.push({ code: "no_routes", severity: "blocker", message: "Policy must declare at least one route." });
  }

  (policy.routes ?? []).forEach((route, index) => {
    const where = `routes[${index}]`;
    if (!route.scope || !route.scope.project) {
      findings.push({ code: "missing_scope", severity: "blocker", message: "Route is missing scope.project.", where });
      return;
    }
    for (const value of scopeValues(route)) {
      if (!isAllowedScope(value, allowlist)) {
        findings.push({ code: "non_allowlisted_scope", severity: "blocker", message: `Scope '${value}' is not in the fictional allowlist (${allowlist.join(", ")}).`, where });
      }
    }
  });

  const serialized = JSON.stringify(policy);
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(serialized)) {
      findings.push({ code: "secret_material", severity: "blocker", message: `Policy contains secret-like material matching /${pattern.source}/.` });
    }
  }

  return { passed: findings.every((f) => f.severity !== "blocker"), findings };
}

function findRoute(policy: RolloutPolicy, scope: RolloutScope): RolloutRoute | undefined {
  return (policy.routes ?? []).find((route) => {
    if (route.scope.project !== scope.project) return false;
    if (scope.channel && route.scope.channel && route.scope.channel !== scope.channel) return false;
    return true;
  });
}

function requestFor(policy: RolloutPolicy, smoke: RolloutSmokeCase, route: RolloutRoute | undefined): ContextRequest {
  return {
    query: smoke.query,
    project: smoke.scope.project,
    channel: smoke.scope.channel,
    workspace: smoke.scope.workspace,
    budgetProfile: smoke.budgetProfile ?? route?.budgetProfile ?? policy.defaults?.budgetProfile ?? "handoff",
    maxSensitivity: smoke.maxSensitivity ?? route?.maxSensitivity ?? "internal",
    includeCandidates: smoke.includeCandidates,
  };
}

function isCandidate(chunk: ContextChunk): boolean {
  return (chunk.tags ?? []).includes("candidate");
}

/** Every chunk field that could carry a leaked secret — body plus identity/metadata. */
function scannableChunkStrings(chunk: ContextChunk): string[] {
  const values = [chunk.text, chunk.id, chunk.project];
  if (chunk.channel) values.push(chunk.channel);
  if (chunk.workspace) values.push(chunk.workspace);
  if (chunk.tags) values.push(...chunk.tags);
  return values.filter((v) => typeof v === "string" && v.length > 0);
}

function hasSecret(chunk: ContextChunk): boolean {
  // Scan the whole chunk, not just its body: secrets can hide in the id, tags, or
  // project/channel/workspace metadata of a chunk that assembly would otherwise drop.
  return scannableChunkStrings(chunk).some((value) => SECRET_PATTERNS.some((pattern) => pattern.test(value)));
}

function smokeCase(fabric: Fabric, policy: RolloutPolicy, smoke: RolloutSmokeCase): RolloutCaseResult {
  const route = findRoute(policy, smoke.scope);
  const bundle = fabric.assemble(requestFor(policy, smoke, route), smoke.chunks);
  const kept = new Set(bundle.chunks.map((c) => c.id));
  const expectedPresent = smoke.expectedChunkIds.filter((id) => kept.has(id));
  const expectedMissing = smoke.expectedChunkIds.filter((id) => !kept.has(id));
  const forbiddenPresent = (smoke.forbiddenChunkIds ?? []).filter((id) => kept.has(id));
  // Candidates are only a leak when the case did not explicitly allow them.
  const candidateLeaks = smoke.includeCandidates ? 0 : bundle.chunks.filter(isCandidate).length;
  // Defense-in-depth: scan the raw fixture (body + metadata), not just chunks that
  // survived assembly. A secret in a dropped or forbidden chunk — or hidden in its
  // id/tags/scope metadata — is still something we must never ship, so it has to
  // fail the report even when routing/budget would have excluded the chunk.
  const secretLeaks = smoke.chunks.filter(hasSecret).length;
  const passed = Boolean(route) && expectedMissing.length === 0 && forbiddenPresent.length === 0 && candidateLeaks === 0 && secretLeaks === 0;
  return {
    name: smoke.name,
    routeMatched: Boolean(route),
    expectedPresent,
    expectedMissing,
    forbiddenPresent,
    candidateLeaks,
    secretLeaks,
    keptChunkIds: bundle.chunks.map((c) => c.id),
    passed,
  };
}

export interface RunRolloutSmokeOptions {
  scopeAllowlist?: ReadonlyArray<string>;
  fabric?: Fabric;
}

/** Validate a policy and run the local assemble smoke across the provided cases. */
export function runRolloutSmoke(policy: RolloutPolicy, cases: RolloutSmokeCase[], opts: RunRolloutSmokeOptions = {}): RolloutReport {
  const validation = validateRolloutPolicy(policy, { scopeAllowlist: opts.scopeAllowlist });
  const fabric = opts.fabric ?? new Fabric();
  const caseResults = cases.map((smoke) => smokeCase(fabric, policy, smoke));

  const expectedTotal = cases.reduce((sum, c) => sum + c.expectedChunkIds.length, 0);
  const expectedKept = caseResults.reduce((sum, r) => sum + r.expectedPresent.length, 0);
  const forbiddenTotal = cases.reduce((sum, c) => sum + (c.forbiddenChunkIds?.length ?? 0), 0);
  const forbiddenKept = caseResults.reduce((sum, r) => sum + r.forbiddenPresent.length, 0);
  const candidateLeaks = caseResults.reduce((sum, r) => sum + r.candidateLeaks, 0);
  const secretLeaks = caseResults.reduce((sum, r) => sum + r.secretLeaks, 0);
  const unroutedCases = caseResults.filter((r) => !r.routeMatched).length;

  const recall = expectedTotal ? expectedKept / expectedTotal : 1;
  const contamination = forbiddenTotal ? forbiddenKept / forbiddenTotal : 0;
  const reliabilityPassed = recall >= 0.9 && contamination === 0 && candidateLeaks === 0 && secretLeaks === 0 && unroutedCases === 0;

  return {
    validation,
    cases: caseResults.length,
    recall,
    contamination,
    candidateLeaks,
    secretLeaks,
    unroutedCases,
    reliabilityPassed,
    passed: validation.passed && reliabilityPassed,
    caseResults,
  };
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function rolloutReportToMarkdown(report: RolloutReport): string {
  const lines = [
    "# Context Fabric Rollout Smoke Report",
    "",
    `- Policy validation: ${report.validation.passed ? "PASS" : "FAIL"}`,
    `- Cases: ${report.cases}`,
    `- Recall: ${pct(report.recall)}`,
    `- Contamination: ${pct(report.contamination)}`,
    `- Candidate leaks: ${report.candidateLeaks}`,
    `- Secret leaks: ${report.secretLeaks}`,
    `- Unrouted cases: ${report.unroutedCases}`,
    `- Reliability gates: ${report.reliabilityPassed ? "PASS" : "FAIL"}`,
    `- Verdict: ${report.passed ? "PASS" : "FAIL"}`,
    "",
  ];
  if (report.validation.findings.length > 0) {
    lines.push("## Policy findings", "");
    for (const finding of report.validation.findings) {
      lines.push(`- [${finding.severity}] ${finding.code}: ${finding.message}${finding.where ? ` (${finding.where})` : ""}`);
    }
    lines.push("");
  }
  lines.push(
    "| Case | Routed | Expected Kept | Forbidden Leaked | Candidate Leaks | Secret Leaks | Verdict |",
    "|---|:---:|---:|---:|---:|---:|:---:|",
  );
  for (const result of report.caseResults) {
    lines.push(
      `| ${result.name} | ${result.routeMatched ? "yes" : "no"} | ${result.expectedPresent.length}/${result.expectedPresent.length + result.expectedMissing.length} | ${result.forbiddenPresent.length} | ${result.candidateLeaks} | ${result.secretLeaks} | ${result.passed ? "PASS" : "FAIL"} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}
