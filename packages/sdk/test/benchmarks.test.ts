import assert from "node:assert/strict";
import test from "node:test";
import { benchmarkReportToMarkdown, runPublicBenchmarks } from "../src/index.js";

test("public benchmark gate proves 75 percent token reduction safely", () => {
  const report = runPublicBenchmarks();
  assert.equal(report.passed, true);
  assert.equal(report.cases, 12);
  assert.ok(report.medianTokenReduction >= 0.75);
  assert.ok(report.medianSameScopeTokenReduction >= 0.75);
  assert.ok(report.recall >= 0.9);
  assert.equal(report.contamination, 0);
  assert.equal(report.candidateLeaks, 0);
  assert.equal(report.secretLeaks, 0);
});

test("public benchmark markdown is explicit and non-empty", () => {
  const report = runPublicBenchmarks();
  const markdown = benchmarkReportToMarkdown(report);
  assert.match(markdown, /Context Fabric Public Benchmark Report/);
  assert.match(markdown, /Median token reduction vs same-scope baseline/);
  assert.doesNotMatch(markdown.toLowerCase(), /reduction[^\n]*100\.0%/);
});
