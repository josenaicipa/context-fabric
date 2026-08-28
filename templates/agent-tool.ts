/**
 * Integration template: expose Context Fabric as a single agent tool.
 *
 * Copy this into your agent runtime and replace `retrieve`. The tool returns
 * a scoped, sanitized, budgeted bundle — never raw retrieval hits.
 *
 * Placeholders (`YOUR_PROJECT`) are ALL_CAPS so the public-boundary doctor
 * accepts this file; replace them before use. No private dependencies.
 */
import { Fabric, type ContextChunk, type ContextBundle } from "@context-fabric/sdk";

const fabric = new Fabric({
  routing: [{ project: "YOUR_PROJECT", channel: "#YOUR_CHANNEL", boost: 2 }],
  budget: { maxTokens: 4000, reserveTokens: 500 },
});

async function retrieve(_query: string): Promise<ContextChunk[]> {
  return [
    {
      id: "doc-1",
      text: "Example retrieved passage.",
      project: "YOUR_PROJECT",
      channel: "#YOUR_CHANNEL",
      sensitivity: "public",
      score: 1,
    },
  ];
}

export const assembleContextTool = {
  name: "assemble_context",
  description:
    "Assemble in-scope, sanitized, budgeted context for a project. Use before answering.",
  parameters: {
    query: "string",
    project: "string",
    channel: "string?",
    threadId: "string?",
  },
  async execute(args: {
    query: string;
    project: string;
    channel?: string;
    threadId?: string;
  }): Promise<ContextBundle> {
    const chunks = await retrieve(args.query);
    return fabric.assemble(
      {
        query: args.query,
        project: args.project,
        channel: args.channel,
        threadId: args.threadId,
      },
      chunks,
    );
  },
};
