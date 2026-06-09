/**
 * @context-fabric/sdk — public client for Context Fabric.
 *
 * Zero runtime dependencies. Clean-room implementation; does not depend on the
 * private core engine.
 */
export { Fabric } from "./fabric.js";
export { Router } from "./router.js";
export { Sanitizer, DEFAULT_RULES } from "./sanitizer.js";
export { Budgeter, type BudgetResult } from "./budgeter.js";
export {
  tokenEstimate,
  bundleToText,
  type ContextChunk,
  type ContextRequest,
  type RoutingRule,
  type BudgetPolicy,
  type SanitizationRule,
  type ContextBundle,
  type FabricConfig,
  type Sensitivity,
} from "./schemas.js";

export const VERSION = "0.1.0";
