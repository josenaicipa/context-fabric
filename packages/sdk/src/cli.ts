/** context-fabric CLI (public SDK). */
import { readFileSync, writeFileSync } from "node:fs";
import { Fabric } from "./fabric.js";
import { buildPack } from "./packs.js";
import { renderAgentContext } from "./handoff.js";
import { runEvals } from "./evals.js";
import type { ContextChunk, FabricConfig } from "./schemas.js";

interface Args { [key: string]: string | undefined; }

function parseArgs(argv: string[]): { command: string; args: Args } {
  const [command = "", ...rest] = argv;
  const args: Args = {};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    if (!key?.startsWith("--")) continue;
    args[key.slice(2)] = rest[i + 1];
    i += 1;
  }
  return { command, args };
}

function loadJson<T>(path: string): T { return JSON.parse(readFileSync(path, "utf-8")) as T; }
function loadConfig(args: Args): FabricConfig { return args.config ? loadJson<FabricConfig>(args.config) : {}; }
function requestFrom(args: Args) {
  if (!args.query || !args.project) throw new Error("--query and --project are required");
  return { query: args.query, project: args.project, channel: args.channel, workspace: args.workspace, maxChunks: args.maxChunks ? Number(args.maxChunks) : undefined, taskType: args.taskType as never, budgetProfile: args.budgetProfile, maxSensitivity: args.maxSensitivity as never };
}

function cmdAssemble(args: Args): number {
  if (!args.chunks) throw new Error("--chunks is required");
  const chunks = loadJson<ContextChunk[]>(args.chunks);
  const bundle = new Fabric(loadConfig(args)).assemble(requestFrom(args), chunks);
  if (args.format === "agent-context") process.stdout.write(renderAgentContext(bundle));
  else process.stdout.write(JSON.stringify(bundle, null, 2) + "\n");
  return 0;
}

function cmdPack(args: Args): number {
  if (!args.id || !args.summary || !args.chunks || !args.output) throw new Error("--id, --summary, --chunks and --output are required");
  const chunks = loadJson<ContextChunk[]>(args.chunks);
  const pack = buildPack({ id: args.id, summary: args.summary, chunks, workspace: args.workspace, project: args.project, channel: args.channel, budgetProfile: args.budgetProfile, sensitivity: args.sensitivity as never });
  writeFileSync(args.output, JSON.stringify(pack, null, 2) + "\n");
  process.stdout.write(`OK: wrote pack ${pack.id} with ${pack.chunks.length} chunk(s)\n`);
  return 0;
}

function cmdDoctor(args: Args): number {
  const config = loadConfig(args);
  process.stdout.write(`OK: config version=${config.version ?? 1} routing=${config.routing?.length ?? 0}\n`);
  return 0;
}

function cmdEval(args: Args): number {
  if (!args.chunks) throw new Error("--chunks is required");
  const report = runEvals(new Fabric(loadConfig(args)), [{ name: "cli", request: requestFrom(args), chunks: loadJson<ContextChunk[]>(args.chunks), expectedChunkIds: args.expect ? [args.expect] : [], forbiddenChunkIds: args.forbid ? [args.forbid] : [] }]);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  return report.passed ? 0 : 2;
}

export function main(argv: string[]): number {
  const { command, args } = parseArgs(argv);
  try {
    switch (command) {
      case "assemble": return cmdAssemble(args);
      case "pack": return cmdPack(args);
      case "doctor": return cmdDoctor(args);
      case "eval": return cmdEval(args);
      default:
        process.stderr.write("usage: context-fabric <assemble|pack|doctor|eval> [options]\n");
        return command ? 1 : 0;
    }
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }
}

if (typeof process !== "undefined" && process.argv[1]?.endsWith("cli.js")) process.exit(main(process.argv.slice(2)));
