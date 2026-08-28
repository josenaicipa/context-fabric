import test from "node:test";
import assert from "node:assert/strict";
import {
  Fabric,
  emptyDiagnostic,
  emptyDiagnosticToText,
  explainRoute,
  routeReportToMarkdown,
  type ContextChunk,
} from "../src/index.js";

const chunks: ContextChunk[] = [
  {
    id: "in",
    text: "Acme checkout note.",
    project: "acme-shop",
    channel: "#acme-shop",
    sensitivity: "public",
    score: 1,
  },
  {
    id: "other",
    text: "Other-co playbook.",
    project: "other-co",
    channel: "#other-co",
    sensitivity: "public",
    score: 9,
  },
];

test("explainRoute keeps in-scope chunks and drops the other project", () => {
  const report = explainRoute(
    { query: "checkout", project: "acme-shop", channel: "#acme-shop" },
    chunks,
  );
  assert.deepEqual(
    report.kept.map((d) => d.id),
    ["in"],
  );
  const other = report.dropped.find((d) => d.id === "other");
  assert.equal(other?.reason, "out_of_scope");
  assert.match(routeReportToMarkdown(report), /Route diagnostics/);
});

test("emptyDiagnostic explains a default-ceiling miss", () => {
  const bundle = new Fabric().assemble({ query: "q", project: "acme-shop" }, [
    {
      id: "int",
      text: "Internal only.",
      project: "acme-shop",
      sensitivity: "internal",
      score: 1,
    },
  ]);
  const diagnostic = emptyDiagnostic(bundle);
  assert.ok(diagnostic);
  assert.equal(diagnostic.empty, true);
  assert.ok((diagnostic.byReason.sensitivity_blocked ?? 0) >= 1);
  assert.match(emptyDiagnosticToText(diagnostic), /sensitivity/);
});

test("emptyDiagnostic is null when the bundle has chunks", () => {
  const bundle = new Fabric().assemble({ query: "q", project: "acme-shop" }, [
    { id: "p", text: "Public.", project: "acme-shop", sensitivity: "public", score: 1 },
  ]);
  assert.equal(emptyDiagnostic(bundle), null);
});
