import type { ContextBundle } from "./schemas.js";

export function renderAgentContext(bundle: ContextBundle): string {
  const lines = [
    "# AGENT_CONTEXT",
    "",
    "## Scope",
    `- Workspace: ${bundle.request.workspace ?? "n/a"}`,
    `- Project: ${bundle.request.project}`,
    `- Channel: ${bundle.request.channel ?? "n/a"}`,
    `- Task type: ${bundle.request.taskType ?? "general"}`,
    `- Budget profile: ${bundle.budgetProfile}`,
    `- Total tokens estimate: ${bundle.totalTokens}`,
    "",
    "## Citations",
    ...(bundle.citations.length ? bundle.citations.map((c) => `- ${c.sourceId}: ${c.title ?? "untitled"} ${c.uri ?? ""}`.trim()) : ["- none"]),
    "",
    "## Context chunks",
  ];
  for (const chunk of bundle.chunks) lines.push(`### ${chunk.id}`, chunk.text, "");
  lines.push("## Guardrails", "- Do not use context outside the declared scope.", "- Do not infer redacted values.", "");
  return lines.join("\n");
}
