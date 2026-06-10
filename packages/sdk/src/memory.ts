import type { Citation, ContextChunk, Sensitivity } from "./schemas.js";

export interface MemoryRecord {
  id: string;
  summary: string;
  content: string;
  project: string;
  workspace?: string;
  channel?: string;
  status?: "candidate" | "active" | "verified" | string;
  sensitivity?: Sensitivity;
  sourceRef?: string;
  confidence?: number;
}

export function memoryRecordsToChunks(
  records: MemoryRecord[],
  input: { project: string; workspace?: string; channel?: string; includeCandidates?: boolean },
): ContextChunk[] {
  const allowed = new Set(["active", "verified"]);
  if (input.includeCandidates) allowed.add("candidate");
  return records
    .filter((record) => allowed.has(record.status ?? "active"))
    .filter((record) => record.project === input.project)
    .filter(
      (record) =>
        input.workspace === undefined ||
        record.workspace === undefined ||
        record.workspace === input.workspace,
    )
    .filter(
      (record) =>
        input.channel === undefined ||
        record.channel === undefined ||
        record.channel === input.channel,
    )
    .map((record) => {
      const source: Citation = {
        sourceId: record.id,
        title: record.summary,
        uri: record.sourceRef,
      };
      return {
        id: `memory:${record.id}`,
        text: `${record.summary}\n\n${record.content}`.trim(),
        project: record.project,
        workspace: record.workspace,
        channel: record.channel,
        tags: ["memory", record.status ?? "active"],
        sensitivity: record.sensitivity ?? "internal",
        score: record.confidence ?? 1,
        source,
      };
    });
}
