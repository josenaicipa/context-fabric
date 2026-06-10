#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { benchmarkReportToMarkdown, runPublicBenchmarks } from "../packages/sdk/dist/src/index.js";

const outDir = process.argv[2] ?? "artifacts/benchmarks";
await mkdir(outDir, { recursive: true });
const report = runPublicBenchmarks();
const markdown = benchmarkReportToMarkdown(report);
console.log(markdown);
await writeFile(join(outDir, "benchmark-report.md"), markdown, "utf8");
await writeFile(
  join(outDir, "benchmark-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);
if (!report.passed) process.exit(2);
