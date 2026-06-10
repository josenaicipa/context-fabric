import { DEFAULT_PUBLIC_ROUTES } from "./channelRouter.js";
import { V1_BUDGET_PROFILES } from "./budgetProfiles.js";
import { VERSION } from "./index.js";

export interface V1Readiness {
  version: string;
  routes: number;
  budgetProfiles: number;
  ready: boolean;
  gates: string[];
}

/**
 * Readiness is pinned to the v1 major, not an exact version, so patch/minor
 * releases stay ready. Fully anchored: prerelease builds (e.g. 1.1.0-rc.1)
 * are intentionally not ready.
 */
const V1_MAJOR = /^1\.\d+\.\d+$/;

export function v1Readiness(): V1Readiness {
  const routes = Object.keys(DEFAULT_PUBLIC_ROUTES).length;
  const budgetProfiles = Object.keys(V1_BUDGET_PROFILES).length;
  return {
    version: VERSION,
    routes,
    budgetProfiles,
    ready: V1_MAJOR.test(VERSION) && routes >= 3 && budgetProfiles >= 6,
    gates: ["tests", "doctor", "evals", "opus-audit", "hermes-audit", "ci"],
  };
}
