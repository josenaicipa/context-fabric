#!/usr/bin/env node
/** context-fabric CLI (public SDK). */
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Fabric } from "./fabric.js";
import { buildPack } from "./packs.js";
import { renderAgentContext } from "./handoff.js";
import { runEvals } from "./evals.js";
import {
  runRolloutSmoke,
  rolloutReportToMarkdown,
  type RolloutPolicy,
  type RolloutSmokeCase,
} from "./rollout.js";
import { VERSION } from "./index.js";
import type { ContextChunk, FabricConfig, Sensitivity, TaskType } from "./schemas.js";

interface Args {
  [key: string]: string | undefined;
}

/** Flags that take no value; treated as booleans when present. */
const BOOLEAN_FLAGS = new Set(["includeCandidates", "help", "version"]);

function parseArgs(argv: string[]): { command: string; args: Args } {
  const [command = "", ...rest] = argv;
  const args: Args = {};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    if (!key?.startsWith("--")) continue;
    const name = key.slice(2);
    const next = rest[i + 1];
    // A boolean flag, or a flag immediately followed by another flag / nothing,
    // is a presence-only switch — don't swallow the following token as its value.
    if (BOOLEAN_FLAGS.has(name) || next === undefined || next.startsWith("--")) {
      args[name] = "true";
      continue;
    }
    args[name] = next;
    i += 1;
  }
  return { command, args };
}

const SENSITIVITIES: ReadonlyArray<Sensitivity> = ["public", "internal", "restricted"];
const TASK_TYPES: ReadonlyArray<TaskType> = [
  "general",
  "code",
  "research",
  "qa",
  "summarize",
  "agent_handoff",
];

function loadJson<T>(path: string, what: string): T {
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (err) {
    throw new Error(`cannot read ${what} file '${path}': ${(err as Error).message}`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error(`malformed JSON in ${what} file '${path}': ${(err as Error).message}`);
  }
}
function loadConfig(args: Args): FabricConfig {
  return args.config ? loadJson<FabricConfig>(args.config, "--config") : {};
}
function loadChunks(args: Args): ContextChunk[] {
  if (!args.chunks) throw new Error("--chunks is required");
  const chunks = loadJson<unknown>(args.chunks, "--chunks");
  if (!Array.isArray(chunks))
    throw new Error(`--chunks file '${args.chunks}' must contain a JSON array of ContextChunk`);
  chunks.forEach((chunk, index) => {
    if (chunk === null || typeof chunk !== "object")
      throw new Error(`--chunks entry [${index}] is not an object`);
    const c = chunk as Partial<ContextChunk>;
    for (const field of ["id", "text", "project"] as const) {
      if (typeof c[field] !== "string" || c[field].length === 0) {
        throw new Error(
          `--chunks entry [${index}]${c.id ? ` (id '${c.id}')` : ""} is missing required string field '${field}'`,
        );
      }
    }
    if (c.sensitivity !== undefined && !SENSITIVITIES.includes(c.sensitivity)) {
      throw new Error(
        `--chunks entry [${index}] (id '${c.id}') has invalid sensitivity '${c.sensitivity}' (expected ${SENSITIVITIES.join(" | ")})`,
      );
    }
  });
  return chunks as ContextChunk[];
}
function parseTags(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const tags = value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return tags.length > 0 ? tags : undefined;
}
function parseMaxChunks(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1)
    throw new Error(`--maxChunks must be a positive integer, got '${value}'`);
  return n;
}
function parseChoice<T extends string>(
  value: string | undefined,
  flag: string,
  choices: ReadonlyArray<T>,
): T | undefined {
  if (value === undefined) return undefined;
  if (!choices.includes(value as T))
    throw new Error(`${flag} must be one of: ${choices.join(" | ")}; got '${value}'`);
  return value as T;
}
function requestFrom(args: Args) {
  if (!args.query || !args.project) throw new Error("--query and --project are required");
  return {
    query: args.query,
    project: args.project,
    channel: args.channel,
    workspace: args.workspace,
    tags: parseTags(args.tags),
    maxChunks: parseMaxChunks(args.maxChunks),
    taskType: parseChoice(args.taskType, "--taskType", TASK_TYPES),
    budgetProfile: args.budgetProfile,
    maxSensitivity: parseChoice(args.maxSensitivity, "--maxSensitivity", SENSITIVITIES),
    includeCandidates: args.includeCandidates === "true" ? true : undefined,
  };
}

const USAGE = `context-fabric ${VERSION}

Usage: context-fabric <command> [options]

Commands:
  assemble   Route, sanitize, and budget chunks into a context bundle
  pack       Build a portable context pack from chunks
  doctor     Report effective config (version, routing rules)
  eval       Score a single assemble case (expected/forbidden chunks)
  rollout    Validate a rollout policy and run the local assemble smoke

Global flags:
  --help, -h       Show this help and exit
  --version, -v    Print the SDK version and exit

Common options:
  --query <q>              Request query (assemble/eval)
  --project <p>            Scope project (required for assemble/eval)
  --channel <c>            Scope channel
  --workspace <w>          Scope workspace
  --tags <a,b,c>           Comma-separated request tags (boost tag overlap)
  --maxChunks <n>          Cap on routed chunks
  --taskType <t>           Task type hint
  --budgetProfile <name>   Named budget profile
  --maxSensitivity <s>     Ceiling: public | internal | restricted (default public)
  --includeCandidates      Allow candidate-tagged chunks through
  --chunks <path>          JSON file of ContextChunk[]
  --config <path>          JSON FabricConfig
  --format <fmt>           assemble: agent-context; rollout: markdown
`;

function cmdAssemble(args: Args): number {
  const chunks = loadChunks(args);
  const bundle = new Fabric(loadConfig(args)).assemble(requestFrom(args), chunks);
  if (args.format === "agent-context") process.stdout.write(renderAgentContext(bundle));
  else process.stdout.write(JSON.stringify(bundle, null, 2) + "\n");
  return 0;
}

function cmdPack(args: Args): number {
  if (!args.id || !args.summary || !args.chunks || !args.output)
    throw new Error("--id, --summary, --chunks and --output are required");
  const chunks = loadChunks(args);
  const pack = buildPack({
    id: args.id,
    summary: args.summary,
    chunks,
    workspace: args.workspace,
    project: args.project,
    channel: args.channel,
    budgetProfile: args.budgetProfile,
    sensitivity: parseChoice(args.sensitivity, "--sensitivity", SENSITIVITIES),
  });
  writeFileSync(args.output, JSON.stringify(pack, null, 2) + "\n");
  process.stdout.write(`OK: wrote pack ${pack.id} with ${pack.chunks.length} chunk(s)\n`);
  return 0;
}

function cmdDoctor(args: Args): number {
  const config = loadConfig(args);
  process.stdout.write(
    `OK: config version=${config.version ?? 1} routing=${config.routing?.length ?? 0}\n`,
  );
  return 0;
}

function cmdEval(args: Args): number {
  const report = runEvals(new Fabric(loadConfig(args)), [
    {
      name: "cli",
      request: requestFrom(args),
      chunks: loadChunks(args),
      expectedChunkIds: args.expect ? [args.expect] : [],
      forbiddenChunkIds: args.forbid ? [args.forbid] : [],
    },
  ]);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  return report.passed ? 0 : 2;
}

function cmdRollout(args: Args): number {
  if (!args.policy || !args.smoke) throw new Error("--policy and --smoke are required");
  const policy = loadJson<RolloutPolicy>(args.policy, "--policy");
  const cases = loadJson<RolloutSmokeCase[]>(args.smoke, "--smoke");
  if (!Array.isArray(cases))
    throw new Error(`--smoke file '${args.smoke}' must contain a JSON array of smoke cases`);
  const report = runRolloutSmoke(policy, cases);
  const output =
    args.format === "markdown"
      ? rolloutReportToMarkdown(report)
      : JSON.stringify(report, null, 2) + "\n";
  if (args.out) writeFileSync(args.out, output);
  else process.stdout.write(output);
  return report.passed ? 0 : 2;
}

export function main(argv: string[]): number {
  const { command, args } = parseArgs(argv);
  // Global flags work as a bare command (`--help`) or alongside one (`assemble --help`).
  if (command === "--help" || command === "-h" || command === "help" || args.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (command === "--version" || command === "-v" || command === "version" || args.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  try {
    switch (command) {
      case "assemble":
        return cmdAssemble(args);
      case "pack":
        return cmdPack(args);
      case "doctor":
        return cmdDoctor(args);
      case "eval":
        return cmdEval(args);
      case "rollout":
        return cmdRollout(args);
      default:
        process.stderr.write(USAGE);
        return command ? 1 : 0;
    }
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }
}

/**
 * Main-module check that survives the npm bin symlink: `node_modules/.bin/context-fabric`
 * does not end in `cli.js`, so compare realpath-resolved entry URLs instead of suffixes.
 */
function isMainModule(): boolean {
  if (typeof process === "undefined" || !process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isMainModule()) process.exit(main(process.argv.slice(2)));
