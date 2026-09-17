/** Strict, vendor-neutral adapter for retrieval payloads from a v2 memory API. */
import type { MemoryRecord } from "./memory.js";
import type { ChannelScope } from "./preflight.js";

export interface MemoryFabricV2Item {
  id: string;
  summary?: string;
  content: string;
  project: string;
  workspace?: string;
  channel?: string;
  threadId?: string;
  status?: "candidate" | "active" | "verified" | string;
  sensitivity?: "public" | "internal" | "restricted";
  sourceRef?: string;
  confidence?: number;
}

export interface MemoryFabricV2Response {
  /** Opaque provider session handle. Do not put credentials in this field. */
  providerSession?: string;
  status?: "ok" | "healthy" | "error" | string;
  results?: MemoryFabricV2Item[];
}

export class MemoryFabricV2Error extends Error {
  constructor(readonly code: string) {
    super(`Memory retrieval v2 rejected: ${code}`);
    this.name = "MemoryFabricV2Error";
  }
}

function exactOrUnstamped(expected: string | undefined, actual: string | undefined): boolean {
  return expected === undefined || actual === undefined || expected === actual;
}

/**
 * Converts only a healthy, session-backed, exact-project retrieval response.
 * Scoped fields may be unstamped for broad context, but a conflicting stamp is
 * never widened into the requested scope.
 */
export function memoryFabricV2ToRecords(
  response: MemoryFabricV2Response,
  scope: ChannelScope,
): MemoryRecord[] {
  if (!response.providerSession?.trim()) throw new MemoryFabricV2Error("missing_provider_session");
  if (response.status !== "ok" && response.status !== "healthy")
    throw new MemoryFabricV2Error("provider_not_healthy");
  if (!Array.isArray(response.results)) throw new MemoryFabricV2Error("missing_results");
  return response.results
    .filter((item) => item.project === scope.project)
    .filter((item) => exactOrUnstamped(scope.workspace, item.workspace))
    .filter((item) => exactOrUnstamped(scope.channel, item.channel))
    .filter((item) => exactOrUnstamped(scope.threadId, item.threadId))
    .map((item) => ({
      id: item.id,
      summary: item.summary ?? item.id,
      content: item.content,
      project: item.project,
      workspace: item.workspace,
      channel: item.channel,
      threadId: item.threadId,
      status: item.status ?? "active",
      sensitivity: item.sensitivity ?? "internal",
      sourceRef: item.sourceRef,
      confidence: item.confidence,
    }));
}
