/**
 * Integration template: turn a Context Fabric bundle into chat messages.
 *
 * Works with any OpenAI-compatible chat completions API. The SDK stays
 * dependency-free; you supply `fetch` and your own endpoint.
 *
 * Placeholders are ALL_CAPS. Runtime tokens belong in env/secret stores —
 * never commit them, and never call this from browser code.
 */
import { Fabric, bundleToText, type ContextChunk } from "@context-fabric/sdk";

const fabric = new Fabric({
  routing: [{ project: "YOUR_PROJECT", boost: 1 }],
  budget: { maxTokens: 4000, reserveTokens: 800 },
});

export function bundleToMessages(
  system: string,
  user: string,
  chunks: ContextChunk[],
): Array<{ role: "system" | "user"; content: string }> {
  const bundle = fabric.assemble({ query: user, project: "YOUR_PROJECT" }, chunks);
  const context = bundleToText(bundle) || "(no in-scope context)";
  return [
    {
      role: "system",
      content: `${system}\n\nUse only the context below. Do not infer redacted values.\n\n${context}`,
    },
    { role: "user", content: user },
  ];
}
