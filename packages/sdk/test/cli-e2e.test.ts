import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ContextChunk } from "../src/index.js";

const cli = join(process.cwd(), "dist/src/cli.js");

function run(args: string[]): string {
  return execFileSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

function writeChunks(chunks: ContextChunk[]): string {
  const path = join(mkdtempSync(join(tmpdir(), "cf-cli-")), "chunks.json");
  writeFileSync(path, JSON.stringify(chunks));
  return path;
}

const candidateCorpus: ContextChunk[] = [
  { id: "approved", text: "Acme Shop approved checkout note.", project: "acme-shop", channel: "#acme-shop", tags: ["approved"], sensitivity: "public", score: 1 },
  { id: "candidate", text: "Acme Shop draft candidate note.", project: "acme-shop", channel: "#acme-shop", tags: ["candidate"], sensitivity: "public", score: 2 },
];

test("CLI --version prints the SDK version", () => {
  assert.match(run(["--version"]), /^1\.0\.0/);
  assert.match(run(["-v"]), /^1\.0\.0/);
  assert.match(run(["version"]), /^1\.0\.0/);
});

test("CLI --help prints usage and the command list", () => {
  const help = run(["--help"]);
  assert.match(help, /Usage: context-fabric <command>/);
  assert.match(help, /assemble/);
  assert.match(help, /rollout/);
  // Help works alongside a command too.
  assert.match(run(["assemble", "--help"]), /Usage: context-fabric/);
});

test("CLI assemble forwards --tags into the request", () => {
  const chunks = writeChunks(candidateCorpus);
  const out = run(["assemble", "--query", "checkout", "--project", "acme-shop", "--channel", "#acme-shop", "--chunks", chunks, "--tags", "approved, checkout"]);
  const bundle = JSON.parse(out);
  assert.deepEqual(bundle.request.tags, ["approved", "checkout"]);
});

test("CLI assemble excludes candidate chunks by default", () => {
  const chunks = writeChunks(candidateCorpus);
  const out = run(["assemble", "--query", "checkout", "--project", "acme-shop", "--channel", "#acme-shop", "--chunks", chunks]);
  const ids = JSON.parse(out).chunks.map((c: ContextChunk) => c.id);
  assert.deepEqual(ids, ["approved"]);
});

test("CLI assemble forwards --includeCandidates to let candidates through", () => {
  const chunks = writeChunks(candidateCorpus);
  // --includeCandidates is a presence-only switch; the following flag must not be swallowed.
  const out = run(["assemble", "--includeCandidates", "--query", "checkout", "--project", "acme-shop", "--channel", "#acme-shop", "--chunks", chunks]);
  const ids = JSON.parse(out).chunks.map((c: ContextChunk) => c.id).sort();
  assert.deepEqual(ids, ["approved", "candidate"]);
});
