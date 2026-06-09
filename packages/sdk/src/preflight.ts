import { Fabric } from "./fabric.js";
import { renderAgentContext } from "./handoff.js";
import { memoryRecordsToChunks, type MemoryRecord } from "./memory.js";
import { buildPack } from "./packs.js";
import type { ContextChunk, ContextPack, ContextRequest, Sensitivity, TaskType } from "./schemas.js";

export interface ChannelScope {
  project: string;
  workspace?: string;
  channel?: string;
  taskType?: TaskType;
  budgetProfile?: string;
  maxSensitivity?: Sensitivity;
}

export interface PreflightInput {
  message: string;
  scope: ChannelScope;
  memoryRecords?: MemoryRecord[];
  repoChunks?: ContextChunk[];
  includeCandidates?: boolean;
  maxChunks?: number;
}

export interface PreflightResult {
  request: ContextRequest;
  chunks: ContextChunk[];
  pack: ContextPack;
  agentContext: string;
}

export function runPreflight(input: PreflightInput, fabric = new Fabric()): PreflightResult {
  const request: ContextRequest = {
    query: input.message,
    project: input.scope.project,
    workspace: input.scope.workspace,
    channel: input.scope.channel,
    taskType: input.scope.taskType ?? "agent_handoff",
    budgetProfile: input.scope.budgetProfile ?? "handoff",
    maxSensitivity: input.scope.maxSensitivity ?? "internal",
    maxChunks: input.maxChunks,
  };
  const memoryChunks = memoryRecordsToChunks(input.memoryRecords ?? [], {
    project: input.scope.project,
    workspace: input.scope.workspace,
    channel: input.scope.channel,
    includeCandidates: input.includeCandidates,
  });
  const bundle = fabric.assemble(request, [...memoryChunks, ...(input.repoChunks ?? [])]);
  return {
    request,
    chunks: bundle.chunks,
    pack: buildPack({ id: `${input.scope.project}-preflight`, summary: `Preflight context for ${input.scope.project}`, chunks: bundle.chunks, project: input.scope.project, channel: input.scope.channel, workspace: input.scope.workspace, sensitivity: input.scope.maxSensitivity ?? "internal", budgetProfile: bundle.budgetProfile }),
    agentContext: renderAgentContext(bundle),
  };
}
