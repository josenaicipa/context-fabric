/**
 * context-fabric CLI (public SDK).
 *
 * Usage:
 *   context-fabric assemble --query Q --project P [--channel C] \
 *     --chunks chunks.json [--config fabric.json]
 *
 * Reads a JSON chunk corpus and an optional JSON config, runs the pipeline,
 * and prints a JSON bundle. No network access, no private dependencies.
 */
import { readFileSync } from "node:fs";
import { Fabric } from "./fabric.js";
import type { ContextChunk, FabricConfig } from "./schemas.js";

interface Args {
  [key: string]: string | undefined;
}

function parseArgs(argv: string[]): { command: string; args: Args } {
  const [command = "", ...rest] = argv;
  const args: Args = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    if (!key?.startsWith("--")) continue;
    args[key.slice(2)] = rest[i + 1];
  }
  return { command, args };
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function cmdAssemble(args: Args): number {
  if (!args.query || !args.project || !args.chunks) {
    process.stderr.write("error: --query, --project, and --chunks are required\n");
    return 1;
  }
  const config: FabricConfig = args.config ? loadJson<FabricConfig>(args.config) : {};
  const chunks = loadJson<ContextChunk[]>(args.chunks);
  const fabric = new Fabric(config);
  const bundle = fabric.assemble(
    {
      query: args.query,
      project: args.project,
      channel: args.channel,
      maxChunks: args.maxChunks ? Number(args.maxChunks) : undefined,
    },
    chunks,
  );
  process.stdout.write(
    JSON.stringify(
      {
        query: bundle.request.query,
        project: bundle.request.project,
        channel: bundle.request.channel ?? null,
        totalTokens: bundle.totalTokens,
        redactions: bundle.redactions,
        droppedChunkIds: bundle.droppedChunkIds,
        chunks: bundle.chunks.map((c) => ({ id: c.id, text: c.text })),
      },
      null,
      2,
    ) + "\n",
  );
  return 0;
}

export function main(argv: string[]): number {
  const { command, args } = parseArgs(argv);
  try {
    switch (command) {
      case "assemble":
        return cmdAssemble(args);
      default:
        process.stderr.write(
          "usage: context-fabric assemble --query Q --project P --chunks chunks.json\n",
        );
        return command ? 1 : 0;
    }
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }
}

// Run when invoked directly (node cli.js ...).
const invokedDirectly =
  typeof process !== "undefined" && process.argv[1]?.endsWith("cli.js");
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
