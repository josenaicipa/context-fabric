import type { ContextBundle, ContextChunk, Sensitivity } from "./schemas.js";

export interface PolicyFinding { code: string; severity: "blocker" | "warning"; message: string; chunkId?: string }
export interface PolicyAudit { passed: boolean; findings: PolicyFinding[] }

const rank: Record<Sensitivity, number> = { public: 0, internal: 1, restricted: 2 };

export function auditChunkScope(chunk: ContextChunk, project: string, channel?: string, maxSensitivity: Sensitivity = "public"): PolicyFinding[] {
  const findings: PolicyFinding[] = [];
  if (chunk.project !== project) findings.push({ code: "cross_project", severity: "blocker", message: "Chunk project does not match request", chunkId: chunk.id });
  if (channel && chunk.channel && chunk.channel !== channel) findings.push({ code: "cross_channel", severity: "blocker", message: "Chunk channel does not match request", chunkId: chunk.id });
  if (rank[chunk.sensitivity ?? "internal"] > rank[maxSensitivity]) findings.push({ code: "sensitivity_ceiling", severity: "blocker", message: "Chunk exceeds sensitivity ceiling", chunkId: chunk.id });
  if ((chunk.tags ?? []).includes("candidate")) findings.push({ code: "candidate_in_context", severity: "blocker", message: "Candidate reached context", chunkId: chunk.id });
  return findings;
}

export function auditBundle(bundle: ContextBundle): PolicyAudit {
  const findings = bundle.chunks.flatMap((chunk) => auditChunkScope(chunk, bundle.request.project, bundle.request.channel, bundle.request.maxSensitivity ?? "public"));
  return { passed: findings.every((f) => f.severity !== "blocker"), findings };
}
