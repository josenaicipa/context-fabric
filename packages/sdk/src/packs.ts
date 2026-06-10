import { citationFor, type ContextChunk, type ContextPack, type Sensitivity } from "./schemas.js";

export function buildPack(input: {
  id: string;
  chunks: ContextChunk[];
  summary: string;
  workspace?: string;
  project?: string;
  channel?: string;
  budgetProfile?: string;
  sensitivity?: Sensitivity;
}): ContextPack {
  const chunks = input.chunks.filter(
    (chunk) =>
      (input.workspace === undefined ||
        chunk.workspace === undefined ||
        chunk.workspace === input.workspace) &&
      (input.project === undefined || chunk.project === input.project) &&
      (input.channel === undefined || chunk.channel === input.channel),
  );
  const seen = new Set<string>();
  const sources = chunks.map(citationFor).filter((source) => {
    if (seen.has(source.sourceId)) return false;
    seen.add(source.sourceId);
    return true;
  });
  return {
    version: "1.0",
    id: input.id,
    scope: { workspace: input.workspace, project: input.project, channel: input.channel },
    summary: input.summary,
    sources,
    chunks,
    sensitivity: input.sensitivity ?? "internal",
    budgetProfile: input.budgetProfile ?? "default",
  };
}
