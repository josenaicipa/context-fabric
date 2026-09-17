/**
 * Generic operational controls for agent-context integrations.
 *
 * These helpers are intentionally pure: callers own their provider clients,
 * profile storage and deployment mechanism. The SDK only verifies the facts
 * that make it safe to assemble context and plans idempotent desired state.
 */
import { Fabric } from "./fabric.js";
import {
  runPreflight,
  type ChannelScope,
  type PreflightInput,
  type PreflightResult,
} from "./preflight.js";

export interface ScopeRoute {
  project: string;
  workspace?: string;
  channel?: string;
  threadId?: string;
}

export interface ScopeProbe {
  scope: ChannelScope;
  /** Opaque provider-side session handle; its value is never rendered. */
  providerSession?: string;
  route?: ScopeRoute;
  providerReachable?: boolean;
}

export interface ScopeProbeResult {
  passed: boolean;
  blockers: string[];
}

export class ScopeProbeError extends Error {
  constructor(readonly result: ScopeProbeResult) {
    super(`Context preflight blocked: ${result.blockers.join(", ")}`);
    this.name = "ScopeProbeError";
  }
}

function sameOptional(expected: string | undefined, actual: string | undefined): boolean {
  return expected === undefined || expected === actual;
}

/**
 * Verifies the minimal provenance needed for an external retrieval call.
 * A missing route, provider session, or reachability signal is a blocker;
 * callers must deliberately choose an out-of-band fallback instead of silently
 * assembling unscoped context.
 */
export function evaluateScopeProbe(probe: ScopeProbe): ScopeProbeResult {
  const blockers: string[] = [];
  const { scope, route } = probe;
  if (!scope.project?.trim()) blockers.push("missing_project");
  if (!scope.channel?.trim()) blockers.push("missing_channel");
  if (!probe.providerSession?.trim()) blockers.push("missing_provider_session");
  if (probe.providerReachable !== true) blockers.push("provider_unreachable");
  if (!route) blockers.push("missing_route");
  else if (
    route.project !== scope.project ||
    !sameOptional(scope.workspace, route.workspace) ||
    !sameOptional(scope.channel, route.channel) ||
    !sameOptional(scope.threadId, route.threadId)
  ) {
    blockers.push("route_scope_mismatch");
  }
  return { passed: blockers.length === 0, blockers };
}

/** Run normal assembly only after its external scope provenance has passed. */
export function runGuardedPreflight(
  input: PreflightInput,
  probe: ScopeProbe,
  fabric = new Fabric(),
): PreflightResult {
  const result = evaluateScopeProbe(probe);
  if (!result.passed) throw new ScopeProbeError(result);
  return runPreflight(input, fabric);
}

export interface ProfileRolloutSpec {
  id: string;
  scope: ChannelScope;
  providerSession?: string;
  providerReachable?: boolean;
  /** Existing, caller-owned profile state. It is never read from disk by this SDK. */
  settings?: { contextFabric?: { enabled?: boolean; scope?: ScopeRoute } };
}

export interface ProfileRolloutChange {
  id: string;
  changed: boolean;
  blockers: string[];
  nextSettings?: { contextFabric: { enabled: true; scope: ScopeRoute } };
}

export interface ProfileRolloutPlan {
  passed: boolean;
  changes: ProfileRolloutChange[];
}

function scopeRoute(scope: ChannelScope): ScopeRoute {
  return {
    project: scope.project,
    workspace: scope.workspace,
    channel: scope.channel,
    threadId: scope.threadId,
  };
}

function routesEqual(left: ScopeRoute | undefined, right: ScopeRoute): boolean {
  return (
    left?.project === right.project &&
    left?.workspace === right.workspace &&
    left?.channel === right.channel &&
    left?.threadId === right.threadId
  );
}

/**
 * Produce a declarative, idempotent profile rollout plan. A caller may persist
 * `nextSettings` in its own config store; this package does not know profile
 * paths, host layout, credentials, or service-manager details.
 */
export function planProfileRollout(specs: ProfileRolloutSpec[]): ProfileRolloutPlan {
  const seen = new Set<string>();
  const changes = specs.map((spec) => {
    const route = scopeRoute(spec.scope);
    const probe = evaluateScopeProbe({
      scope: spec.scope,
      route,
      providerSession: spec.providerSession,
      providerReachable: spec.providerReachable,
    });
    if (!spec.id.trim()) probe.blockers.push("missing_profile_id");
    if (seen.has(spec.id)) probe.blockers.push("duplicate_profile_id");
    seen.add(spec.id);
    if (!probe.passed || probe.blockers.length > 0)
      return { id: spec.id, changed: false, blockers: probe.blockers };
    const current = spec.settings?.contextFabric;
    const changed = current?.enabled !== true || !routesEqual(current.scope, route);
    return {
      id: spec.id,
      changed,
      blockers: [],
      nextSettings: { contextFabric: { enabled: true as const, scope: route } },
    };
  });
  return { passed: changes.every((change) => change.blockers.length === 0), changes };
}

export interface ReadinessScorecard {
  passed: boolean;
  blockers: string[];
  profiles: number;
  changesRequired: number;
}

/** Summarize probe and rollout evidence into a CI-friendly readiness gate. */
export function evaluateReadiness(
  probes: ScopeProbe[],
  rollout: ProfileRolloutPlan,
): ReadinessScorecard {
  const probeBlockers = probes.flatMap((probe, index) =>
    evaluateScopeProbe(probe).blockers.map((blocker) => `probe_${index}:${blocker}`),
  );
  const rolloutBlockers = rollout.changes.flatMap((change) =>
    change.blockers.map((blocker) => `profile_${change.id}:${blocker}`),
  );
  const blockers = [...probeBlockers, ...rolloutBlockers];
  return {
    passed: blockers.length === 0 && rollout.passed,
    blockers,
    profiles: rollout.changes.length,
    changesRequired: rollout.changes.filter((change) => change.changed).length,
  };
}
