/**
 * Integration template: wrap your retrieval layer with Context Fabric before
 * handing context to an LLM. Copy this into your app and replace `retrieve`.
 *
 * No private dependencies — uses only @context-fabric/sdk.
 */
import { Fabric, bundleToText, type ContextChunk } from "@context-fabric/sdk";

// 1. Configure the fabric once (load from a JSON file in real apps).
const fabric = new Fabric({
  routing: [{ project: "YOUR_PROJECT", channel: "#YOUR_CHANNEL", boost: 2 }],
  budget: { maxTokens: 8000, reserveTokens: 1000 },
});

// 2. Replace this with your real retrieval (vector search, DB, etc.).
async function retrieve(_query: string): Promise<ContextChunk[]> {
  return [
    {
      id: "doc-1",
      text: "Example retrieved passage.",
      project: "YOUR_PROJECT",
      channel: "#YOUR_CHANNEL",
      score: 1,
    },
  ];
}

// 3. Assemble a scoped, sanitized, budgeted bundle and build your prompt.
export async function buildContext(query: string): Promise<string> {
  const chunks = await retrieve(query);
  const bundle = fabric.assemble(
    { query, project: "YOUR_PROJECT", channel: "#YOUR_CHANNEL" },
    chunks,
  );

  if (bundle.droppedChunkIds.length > 0) {
    console.warn(`Dropped ${bundle.droppedChunkIds.length} chunk(s) to fit budget.`);
  }

  return [
    "Use only the context below to answer.",
    "",
    bundleToText(bundle),
  ].join("\n");
}
