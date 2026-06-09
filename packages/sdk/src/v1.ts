import { DEFAULT_PUBLIC_ROUTES } from "./channelRouter.js";
import { V1_BUDGET_PROFILES } from "./budgetProfiles.js";
import { VERSION } from "./index.js";

export interface V1Readiness { version: string; routes: number; budgetProfiles: number; ready: boolean; gates: string[] }

export function v1Readiness(): V1Readiness {
  const routes = Object.keys(DEFAULT_PUBLIC_ROUTES).length;
  const budgetProfiles = Object.keys(V1_BUDGET_PROFILES).length;
  return { version: VERSION, routes, budgetProfiles, ready: VERSION === "1.0.0" && routes >= 3 && budgetProfiles >= 6, gates: ["tests", "doctor", "evals", "opus-audit", "hermes-audit", "ci"] };
}
