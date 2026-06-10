import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ContextChunk } from "../src/index.js";

const cli = join(process.cwd(), "dist/src/cli.js");

function run(args: string[]): string {
  return execFileSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

/** Run the CLI expecting a nonzero exit; returns { status, stderr }. */
function runExpectFail(args: string[]): { status: number; stderr: string } {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  assert.notEqual(
    result.status,
    0,
    `expected nonzero exit for: ${args.join(" ")}\nstdout: ${result.stdout}`,
  );
  return { status: result.status ?? -1, stderr: result.stderr };
}

function writeChunks(chunks: ContextChunk[]): string {
  const path = join(mkdtempSync(join(tmpdir(), "cf-cli-")), "chunks.json");
  writeFileSync(path, JSON.stringify(chunks));
  return path;
}

const candidateCorpus: ContextChunk[] = [
  {
    id: "approved",
    text: "Acme Shop approved checkout note.",
    project: "acme-shop",
    channel: "#acme-shop",
    tags: ["approved"],
    sensitivity: "public",
    score: 1,
  },
  {
    id: "candidate",
    text: "Acme Shop draft candidate note.",
    project: "acme-shop",
    channel: "#acme-shop",
    tags: ["candidate"],
    sensitivity: "public",
    score: 2,
  },
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
  const out = run([
    "assemble",
    "--query",
    "checkout",
    "--project",
    "acme-shop",
    "--channel",
    "#acme-shop",
    "--chunks",
    chunks,
    "--tags",
    "approved, checkout",
  ]);
  const bundle = JSON.parse(out);
  assert.deepEqual(bundle.request.tags, ["approved", "checkout"]);
});

test("CLI assemble excludes candidate chunks by default", () => {
  const chunks = writeChunks(candidateCorpus);
  const out = run([
    "assemble",
    "--query",
    "checkout",
    "--project",
    "acme-shop",
    "--channel",
    "#acme-shop",
    "--chunks",
    chunks,
  ]);
  const ids = JSON.parse(out).chunks.map((c: ContextChunk) => c.id);
  assert.deepEqual(ids, ["approved"]);
});

test("CLI assemble forwards --includeCandidates to let candidates through", () => {
  const chunks = writeChunks(candidateCorpus);
  // --includeCandidates is a presence-only switch; the following flag must not be swallowed.
  const out = run([
    "assemble",
    "--includeCandidates",
    "--query",
    "checkout",
    "--project",
    "acme-shop",
    "--channel",
    "#acme-shop",
    "--chunks",
    chunks,
  ]);
  const ids = JSON.parse(out)
    .chunks.map((c: ContextChunk) => c.id)
    .sort();
  assert.deepEqual(ids, ["approved", "candidate"]);
});

const mixedSensitivityCorpus: ContextChunk[] = [
  {
    id: "pub",
    text: "Acme Shop public note.",
    project: "acme-shop",
    sensitivity: "public",
    score: 1,
  },
  {
    id: "int",
    text: "Acme Shop internal note.",
    project: "acme-shop",
    sensitivity: "internal",
    score: 2,
  },
];

test("CLI assemble fails closed: internal chunks are excluded by default", () => {
  const chunks = writeChunks(mixedSensitivityCorpus);
  const bundle = JSON.parse(
    run(["assemble", "--query", "note", "--project", "acme-shop", "--chunks", chunks]),
  );
  assert.deepEqual(
    bundle.chunks.map((c: ContextChunk) => c.id),
    ["pub"],
  );
  assert.ok(
    bundle.droppedChunks.some(
      (d: { id: string; reason: string }) => d.id === "int" && d.reason === "sensitivity_blocked",
    ),
  );
});

test("CLI assemble includes internal chunks only with explicit --maxSensitivity internal", () => {
  const chunks = writeChunks(mixedSensitivityCorpus);
  const bundle = JSON.parse(
    run([
      "assemble",
      "--query",
      "note",
      "--project",
      "acme-shop",
      "--chunks",
      chunks,
      "--maxSensitivity",
      "internal",
    ]),
  );
  assert.deepEqual(bundle.chunks.map((c: ContextChunk) => c.id).sort(), ["int", "pub"]);
});

test("CLI rejects an invalid --maxChunks with a clear error", () => {
  const chunks = writeChunks(candidateCorpus);
  for (const bad of ["0", "-2", "abc", "1.5"]) {
    const { stderr } = runExpectFail([
      "assemble",
      "--query",
      "q",
      "--project",
      "acme-shop",
      "--chunks",
      chunks,
      "--maxChunks",
      bad,
    ]);
    assert.match(stderr, /--maxChunks must be a positive integer/);
  }
});

test("CLI rejects an invalid --maxSensitivity with a clear error", () => {
  const chunks = writeChunks(candidateCorpus);
  const { stderr } = runExpectFail([
    "assemble",
    "--query",
    "q",
    "--project",
    "acme-shop",
    "--chunks",
    chunks,
    "--maxSensitivity",
    "secret",
  ]);
  assert.match(stderr, /--maxSensitivity must be one of: public \| internal \| restricted/);
});

test("CLI rejects an invalid --taskType with a clear error", () => {
  const chunks = writeChunks(candidateCorpus);
  const { stderr } = runExpectFail([
    "assemble",
    "--query",
    "q",
    "--project",
    "acme-shop",
    "--chunks",
    chunks,
    "--taskType",
    "hacking",
  ]);
  assert.match(stderr, /--taskType must be one of/);
});

test("CLI rejects malformed chunk JSON with a clear error instead of an empty bundle", () => {
  const dir = mkdtempSync(join(tmpdir(), "cf-cli-bad-"));
  const path = join(dir, "broken.json");
  writeFileSync(path, "{ not json ]");
  const { stderr } = runExpectFail([
    "assemble",
    "--query",
    "q",
    "--project",
    "acme-shop",
    "--chunks",
    path,
  ]);
  assert.match(stderr, /malformed JSON in --chunks file/);
});

test("CLI rejects a missing chunks file with a clear error", () => {
  const { stderr } = runExpectFail([
    "assemble",
    "--query",
    "q",
    "--project",
    "acme-shop",
    "--chunks",
    "/nonexistent/chunks.json",
  ]);
  assert.match(stderr, /cannot read --chunks file/);
});

test("CLI rejects a chunk missing required text with a clear error", () => {
  const dir = mkdtempSync(join(tmpdir(), "cf-cli-bad-"));
  const path = join(dir, "chunks.json");
  writeFileSync(path, JSON.stringify([{ id: "c1", project: "acme-shop" }]));
  const { stderr } = runExpectFail([
    "assemble",
    "--query",
    "q",
    "--project",
    "acme-shop",
    "--chunks",
    path,
  ]);
  assert.match(stderr, /entry \[0\].*missing required string field 'text'/);
});

test("CLI rejects a non-array chunks file with a clear error", () => {
  const dir = mkdtempSync(join(tmpdir(), "cf-cli-bad-"));
  const path = join(dir, "chunks.json");
  writeFileSync(path, JSON.stringify({ id: "c1" }));
  const { stderr } = runExpectFail([
    "assemble",
    "--query",
    "q",
    "--project",
    "acme-shop",
    "--chunks",
    path,
  ]);
  assert.match(stderr, /must contain a JSON array/);
});

test("CLI rejects malformed --config JSON with a clear error", () => {
  const dir = mkdtempSync(join(tmpdir(), "cf-cli-bad-"));
  const chunks = writeChunks(candidateCorpus);
  const config = join(dir, "config.json");
  writeFileSync(config, "not-json");
  const { stderr } = runExpectFail([
    "assemble",
    "--query",
    "q",
    "--project",
    "acme-shop",
    "--chunks",
    chunks,
    "--config",
    config,
  ]);
  assert.match(stderr, /malformed JSON in --config file/);
});
