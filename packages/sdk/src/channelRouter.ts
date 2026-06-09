import type { Sensitivity, TaskType } from "./schemas.js";

export interface ChannelRoute {
  channel: string;
  project: string;
  workspace?: string;
  taskType: TaskType;
  budgetProfile: string;
  maxSensitivity: Sensitivity;
  requiredSkills: string[];
  enabledToolsets: string[];
  repoHint?: string;
}

export interface RouterDecision { route: ChannelRoute; confidence: number; warnings: string[] }

export const DEFAULT_PUBLIC_ROUTES: Record<string, ChannelRoute> = {
  demo: { channel: "demo", project: "acme-shop", taskType: "general", budgetProfile: "quick-answer", maxSensitivity: "public", requiredSkills: [], enabledToolsets: [] },
  support: { channel: "support", project: "acme-shop", taskType: "qa", budgetProfile: "debug", maxSensitivity: "public", requiredSkills: [], enabledToolsets: [] },
  engineering: { channel: "engineering", project: "acme-shop", taskType: "code", budgetProfile: "code-change", maxSensitivity: "public", requiredSkills: [], enabledToolsets: [] },
};

export function detectTaskType(message: string): TaskType {
  const text = message.toLowerCase();
  if (["bug", "error", "debug", "broken"].some((x) => text.includes(x))) return "qa";
  if (["code", "repo", "commit", "test", "implement"].some((x) => text.includes(x))) return "code";
  if (["research", "investigate", "find"].some((x) => text.includes(x))) return "research";
  if (["summarize", "summary"].some((x) => text.includes(x))) return "summarize";
  return "general";
}

export function resolveChannelRoute(channel: string | undefined, message = "", routes = DEFAULT_PUBLIC_ROUTES): RouterDecision {
  if (channel && routes[channel]) return { route: routes[channel], confidence: 0.95, warnings: [] };
  return { route: { channel: channel ?? "", project: "demo", taskType: detectTaskType(message), budgetProfile: "quick-answer", maxSensitivity: "public", requiredSkills: [], enabledToolsets: [] }, confidence: 0.35, warnings: ["unknown_channel_fallback"] };
}
