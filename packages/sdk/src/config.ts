/**
 * Fail-fast validation of a FabricConfig document (JSON from disk or a
 * caller-supplied object). Unknown keys, wrong types, and patterns that will
 * not compile as regular expressions are rejected with a path-qualified error
 * instead of failing later in the pipeline.
 */
import type {
  BudgetPolicy,
  FabricConfig,
  RoutingRule,
  SanitizationRule,
  TaskType,
} from "./schemas.js";

const TOP_LEVEL_KEYS = new Set(["version", "routing", "budget", "budgetProfiles", "sanitization"]);

const ROUTING_KEYS = new Set([
  "project",
  "channel",
  "boost",
  "requiredTags",
  "workspace",
  "threadId",
  "taskType",
]);

const BUDGET_KEYS = new Set(["maxTokens", "reserveTokens", "perChunkMaxTokens", "name"]);

const SANITIZATION_KEYS = new Set(["name", "pattern", "replacement"]);

const TASK_TYPES: ReadonlyArray<TaskType> = [
  "general",
  "code",
  "research",
  "qa",
  "summarize",
  "agent_handoff",
];

export class ConfigError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(path ? `${path}: ${message}` : message);
    this.name = "ConfigError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: Set<string>,
  path: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new ConfigError(path ? `${path}.${key}` : key, `unknown key '${key}'`);
    }
  }
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ConfigError(path, "must be a non-empty string");
  }
  return value;
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  return requireString(value, path);
}

function requireFiniteNumber(
  value: unknown,
  path: string,
  opts: { integer?: boolean; min?: number } = {},
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ConfigError(path, "must be a finite number");
  }
  if (opts.integer && !Number.isInteger(value)) {
    throw new ConfigError(path, "must be an integer");
  }
  if (opts.min !== undefined && value < opts.min) {
    throw new ConfigError(path, `must be >= ${opts.min}`);
  }
  return value;
}

function optionalFiniteNumber(
  value: unknown,
  path: string,
  opts: { integer?: boolean; min?: number } = {},
): number | undefined {
  if (value === undefined) return undefined;
  return requireFiniteNumber(value, path, opts);
}

function optionalStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    throw new ConfigError(path, "must be an array of non-empty strings");
  }
  return value;
}

function optionalTaskType(value: unknown, path: string): TaskType | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !TASK_TYPES.includes(value as TaskType)) {
    throw new ConfigError(path, `must be one of: ${TASK_TYPES.join(" | ")}`);
  }
  return value as TaskType;
}

function parseBudget(value: unknown, path: string): BudgetPolicy {
  if (!isPlainObject(value)) throw new ConfigError(path, "must be an object");
  rejectUnknownKeys(value, BUDGET_KEYS, path);
  const maxTokens = requireFiniteNumber(value.maxTokens, `${path}.maxTokens`, {
    integer: true,
    min: 1,
  });
  const reserveTokens = optionalFiniteNumber(value.reserveTokens, `${path}.reserveTokens`, {
    integer: true,
    min: 0,
  });
  const perChunkMaxTokens = optionalFiniteNumber(
    value.perChunkMaxTokens,
    `${path}.perChunkMaxTokens`,
    {
      integer: true,
      min: 1,
    },
  );
  if (reserveTokens !== undefined && reserveTokens >= maxTokens) {
    throw new ConfigError(`${path}.reserveTokens`, "must be smaller than maxTokens");
  }
  return {
    maxTokens,
    reserveTokens,
    perChunkMaxTokens,
    name: optionalString(value.name, `${path}.name`),
  };
}

function parseRoutingRule(value: unknown, path: string): RoutingRule {
  if (!isPlainObject(value)) throw new ConfigError(path, "must be an object");
  rejectUnknownKeys(value, ROUTING_KEYS, path);
  return {
    project: requireString(value.project, `${path}.project`),
    channel: optionalString(value.channel, `${path}.channel`),
    boost: optionalFiniteNumber(value.boost, `${path}.boost`),
    requiredTags: optionalStringArray(value.requiredTags, `${path}.requiredTags`),
    workspace: optionalString(value.workspace, `${path}.workspace`),
    threadId: optionalString(value.threadId, `${path}.threadId`),
    taskType: optionalTaskType(value.taskType, `${path}.taskType`),
  };
}

function parseSanitizationRule(value: unknown, path: string): SanitizationRule {
  if (!isPlainObject(value)) throw new ConfigError(path, "must be an object");
  rejectUnknownKeys(value, SANITIZATION_KEYS, path);
  const rule: SanitizationRule = {
    name: requireString(value.name, `${path}.name`),
    pattern: requireString(value.pattern, `${path}.pattern`),
    replacement: optionalString(value.replacement, `${path}.replacement`),
  };
  try {
    // Compile once so an invalid pattern fails at config load, not mid-assemble.
    new RegExp(rule.pattern, "gi");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`${path}.pattern`, `invalid regex /${rule.pattern}/: ${reason}`);
  }
  return rule;
}

/**
 * Validate and normalize an unknown config document into a {@link FabricConfig}.
 * Throws {@link ConfigError} with a dotted path on the first problem.
 */
export function validateConfig(raw: unknown): FabricConfig {
  if (!isPlainObject(raw)) throw new ConfigError("", "config must be a JSON object");
  rejectUnknownKeys(raw, TOP_LEVEL_KEYS, "");

  const config: FabricConfig = {};

  if (raw.version !== undefined) {
    config.version = requireFiniteNumber(raw.version, "version", { integer: true, min: 1 });
  }

  if (raw.routing !== undefined) {
    if (!Array.isArray(raw.routing)) throw new ConfigError("routing", "must be an array of rules");
    config.routing = raw.routing.map((item, index) => parseRoutingRule(item, `routing[${index}]`));
  }

  if (raw.budget !== undefined) {
    config.budget = parseBudget(raw.budget, "budget");
  }

  if (raw.budgetProfiles !== undefined) {
    if (!isPlainObject(raw.budgetProfiles)) {
      throw new ConfigError("budgetProfiles", "must be an object of named budget policies");
    }
    const profiles: Record<string, BudgetPolicy> = {};
    for (const [name, policy] of Object.entries(raw.budgetProfiles)) {
      if (name.length === 0)
        throw new ConfigError("budgetProfiles", "profile name must be non-empty");
      profiles[name] = parseBudget(policy, `budgetProfiles.${name}`);
    }
    config.budgetProfiles = profiles;
  }

  if (raw.sanitization !== undefined) {
    if (!Array.isArray(raw.sanitization)) {
      throw new ConfigError("sanitization", "must be an array of rules");
    }
    config.sanitization = raw.sanitization.map((item, index) =>
      parseSanitizationRule(item, `sanitization[${index}]`),
    );
  }

  return config;
}
