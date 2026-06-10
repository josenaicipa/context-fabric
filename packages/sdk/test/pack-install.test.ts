/**
 * P0 packaging gate: `npm pack` -> install the tarball into a fresh project ->
 * execute the installed `context-fabric` bin. Catches shebang/bin/files-field
 * regressions that unit tests over dist/ can never see. Fully offline: the SDK
 * has zero runtime dependencies, so installing the local tarball needs no
 * registry access.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pkgRoot = process.cwd();

function npm(args: string[], cwd: string): string {
  return execFileSync("npm", [...args, "--no-audit", "--no-fund", "--loglevel=error"], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, npm_config_update_notifier: "false" },
  });
}

test(
  "npm pack -> install -> installed bin runs --version/--help/doctor/assemble",
  { timeout: 120_000 },
  () => {
    const workDir = mkdtempSync(join(tmpdir(), "cf-pack-"));

    // 1. Pack the SDK and assert the tarball manifest carries the essentials.
    const packJson = JSON.parse(
      npm(["pack", "--json", "--pack-destination", workDir], pkgRoot),
    ) as Array<{ filename: string; files: Array<{ path: string }> }>;
    const tarball = join(workDir, packJson[0].filename);
    const paths = packJson[0].files.map((f) => f.path);
    for (const required of [
      "LICENSE",
      "README.md",
      "package.json",
      "dist/src/cli.js",
      "dist/src/index.js",
    ]) {
      assert.ok(
        paths.includes(required),
        `tarball must contain ${required}; got: ${paths.join(", ")}`,
      );
    }

    // 2. Install the tarball into a fresh, empty project.
    const appDir = mkdtempSync(join(tmpdir(), "cf-app-"));
    writeFileSync(
      join(appDir, "package.json"),
      JSON.stringify({ name: "cf-smoke", version: "0.0.0", private: true }),
    );
    npm(["install", tarball], appDir);

    // 3. The installed bin must execute directly (shebang + bin wiring).
    const bin = join(appDir, "node_modules", ".bin", "context-fabric");
    const version = execFileSync(bin, ["--version"], { encoding: "utf8" });
    assert.match(version, /^\d+\.\d+\.\d+/);
    const help = execFileSync(bin, ["--help"], { encoding: "utf8" });
    assert.match(help, /Usage: context-fabric <command>/);
    const doctor = execFileSync(bin, ["doctor"], { encoding: "utf8" });
    assert.match(doctor, /^OK: config version=/);

    // 4. Assemble smoke from the installed bin, with fail-closed default ceiling.
    const chunksPath = join(appDir, "chunks.json");
    writeFileSync(
      chunksPath,
      JSON.stringify([
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
      ]),
    );
    const bundle = JSON.parse(
      execFileSync(
        bin,
        ["assemble", "--query", "note", "--project", "acme-shop", "--chunks", chunksPath],
        { encoding: "utf8" },
      ),
    );
    assert.deepEqual(
      bundle.chunks.map((c: { id: string }) => c.id),
      ["pub"],
    );

    // 5. Validation failures from the installed bin exit nonzero with stderr.
    const bad = spawnSync(
      bin,
      [
        "assemble",
        "--query",
        "q",
        "--project",
        "acme-shop",
        "--chunks",
        chunksPath,
        "--maxSensitivity",
        "bogus",
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /--maxSensitivity must be one of/);

    // 6. The shipped cli.js must keep its shebang as the very first bytes.
    const cliSource = readFileSync(
      join(appDir, "node_modules", "@context-fabric", "sdk", "dist", "src", "cli.js"),
      "utf8",
    );
    assert.ok(
      cliSource.startsWith("#!/usr/bin/env node"),
      "installed cli.js must start with a node shebang",
    );
  },
);
