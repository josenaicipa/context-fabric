import { buildPack } from "./packs.js";
import type { ContextChunk, ContextPack } from "./schemas.js";

export interface RepoPackInput { project: string; channel?: string; files: Record<string, string>; summary?: string }

export function buildRepoPack(input: RepoPackInput): ContextPack {
  const chunks: ContextChunk[] = Object.entries(input.files).map(([name, text]) => ({
    id: `repo:${name}`, text: text.slice(0, 3000), project: input.project, channel: input.channel, tags: ["repo", "pack"], sensitivity: "public", score: 0.8, source: { sourceId: name, title: name },
  }));
  return buildPack({ id: `${input.project}-repo-pack`, summary: input.summary ?? "Repository context pack", chunks, project: input.project, channel: input.channel, sensitivity: "public", budgetProfile: "code-change" });
}
