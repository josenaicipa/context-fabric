import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = join(process.cwd(), "dist/src/cli.js");
const chunks = join(process.cwd(), "../../examples/chunks.json");
const config = join(process.cwd(), "../../examples/fabric.config.json");

test("CLI doctor, agent-context, pack and eval commands work", () => {
  assert.match(
    execFileSync(process.execPath, [cli, "doctor", "--config", config], { encoding: "utf8" }),
    /OK: config/,
  );
  assert.match(
    execFileSync(
      process.execPath,
      [
        cli,
        "assemble",
        "--query",
        "support",
        "--project",
        "acme-shop",
        "--channel",
        "#acme-shop",
        "--chunks",
        chunks,
        "--config",
        config,
        "--format",
        "agent-context",
      ],
      { encoding: "utf8" },
    ),
    /AGENT_CONTEXT/,
  );
  const out = join(mkdtempSync(join(tmpdir(), "cf-")), "pack.json");
  execFileSync(
    process.execPath,
    [
      cli,
      "pack",
      "--id",
      "demo",
      "--summary",
      "Demo",
      "--project",
      "acme-shop",
      "--chunks",
      chunks,
      "--output",
      out,
    ],
    { encoding: "utf8" },
  );
  assert.equal(JSON.parse(readFileSync(out, "utf8")).id, "demo");
  const pass = spawnSync(
    process.execPath,
    [
      cli,
      "eval",
      "--query",
      "support",
      "--project",
      "acme-shop",
      "--channel",
      "#acme-shop",
      "--chunks",
      chunks,
      "--config",
      config,
      "--expect",
      "c2",
      "--forbid",
      "c3",
    ],
    { encoding: "utf8" },
  );
  assert.equal(pass.status, 0);
  const fail = spawnSync(
    process.execPath,
    [
      cli,
      "eval",
      "--query",
      "support",
      "--project",
      "acme-shop",
      "--channel",
      "#acme-shop",
      "--chunks",
      chunks,
      "--config",
      config,
      "--expect",
      "missing",
    ],
    { encoding: "utf8" },
  );
  assert.equal(fail.status, 2);
});
