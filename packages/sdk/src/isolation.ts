/**
 * Public isolation scorecard.
 *
 * Proves the documented scope guarantees against a fictional corpus
 * (`acme-shop` vs `other-co`) plus caller-supplied cases. No operator maps,
 * no live config, no proprietary heuristics — just the public router/sanitizer
 * contracts.
 */
import { Fabric } from "./fabric.js";
import type { ContextChunk, ContextRequest } from "./schemas.js";

export interface IsolationCase {
  name: string;
  request: ContextRequest;
  chunks: ContextChunk[];
  /** Chunk ids that must appear in the bundle. */
  mustKeep?: string[];
  /** Chunk ids that must never appear in the bundle. */
  mustDrop?: string[];
}

export interface IsolationCaseResult {
  name: string;
  passed: boolean;
  kept: string[];
  missing: string[];
  leaked: string[];
}

export interface IsolationScorecard {
  passed: boolean;
  cases: IsolationCaseResult[];
}

function chunk(id: string, project: string, extra: Partial<ContextChunk> = {}): ContextChunk {
  return {
    id,
    text: extra.text ?? `${id} body`,
    project,
    sensitivity: extra.sensitivity ?? "public",
    score: extra.score ?? 1,
    ...extra,
  };
}

/** Built-in, allowlisted fixtures used by the CLI `isolation` command. */
export function defaultIsolationCases(): IsolationCase[] {
  const acme = "acme-shop";
  const other = "other-co";
  return [
    {
      name: "cross-project chunks never enter the bundle",
      request: { query: "checkout", project: acme, channel: "#acme-shop" },
      chunks: [
        chunk("acme-public", acme, { channel: "#acme-shop", text: "Acme checkout is two steps." }),
        chunk("other-hot", other, {
          channel: "#other-co",
          text: "Other-co secret playbook.",
          score: 99,
        }),
      ],
      mustKeep: ["acme-public"],
      mustDrop: ["other-hot"],
    },
    {
      name: "sibling thread isolation",
      request: {
        query: "billing",
        project: acme,
        channel: "#acme-shop",
        threadId: "thread-billing",
      },
      chunks: [
        chunk("billing-private", acme, {
          channel: "#acme-shop",
          threadId: "thread-billing",
          text: "Billing thread note.",
        }),
        chunk("support-private", acme, {
          channel: "#acme-shop",
          threadId: "thread-support",
          text: "Support thread note.",
          score: 99,
        }),
      ],
      mustKeep: ["billing-private"],
      mustDrop: ["support-private"],
    },
    {
      name: "thread-private chunks stay out of an unfocused request",
      request: { query: "checkout", project: acme, channel: "#acme-shop" },
      chunks: [
        chunk("channel-wide", acme, { channel: "#acme-shop", text: "Shared checkout note." }),
        chunk("thread-private", acme, {
          channel: "#acme-shop",
          threadId: "thread-billing",
          text: "Billing-only note.",
          score: 99,
        }),
      ],
      mustKeep: ["channel-wide"],
      mustDrop: ["thread-private"],
    },
    {
      name: "thread-wide chunks remain as fallback under a thread focus",
      request: {
        query: "checkout",
        project: acme,
        channel: "#acme-shop",
        threadId: "thread-billing",
      },
      chunks: [
        chunk("channel-wide", acme, { channel: "#acme-shop", text: "Shared checkout note." }),
        chunk("billing-private", acme, {
          channel: "#acme-shop",
          threadId: "thread-billing",
          text: "Billing thread note.",
        }),
      ],
      mustKeep: ["channel-wide", "billing-private"],
    },
    {
      name: "default sensitivity ceiling blocks internal and restricted",
      request: { query: "checkout", project: acme, channel: "#acme-shop" },
      chunks: [
        chunk("pub", acme, { channel: "#acme-shop", sensitivity: "public", text: "Public note." }),
        chunk("int", acme, {
          channel: "#acme-shop",
          sensitivity: "internal",
          text: "Internal note.",
          score: 9,
        }),
        chunk("rst", acme, {
          channel: "#acme-shop",
          sensitivity: "restricted",
          text: "Restricted note.",
          score: 9,
        }),
      ],
      mustKeep: ["pub"],
      mustDrop: ["int", "rst"],
    },
    {
      name: "workspace mismatch is hard-excluded",
      request: { query: "checkout", project: acme, workspace: "demo" },
      chunks: [
        chunk("in-ws", acme, { workspace: "demo", text: "Demo workspace note." }),
        chunk("other-ws", acme, {
          workspace: "example",
          text: "Example workspace note.",
          score: 9,
        }),
      ],
      mustKeep: ["in-ws"],
      mustDrop: ["other-ws"],
    },
  ];
}

export function runIsolationScorecard(
  cases: IsolationCase[] = defaultIsolationCases(),
  fabric = new Fabric(),
): IsolationScorecard {
  const results: IsolationCaseResult[] = cases.map((item) => {
    const bundle = fabric.assemble(item.request, item.chunks);
    const kept = bundle.chunks.map((c) => c.id);
    const keptSet = new Set(kept);
    const missing = (item.mustKeep ?? []).filter((id) => !keptSet.has(id));
    const leaked = (item.mustDrop ?? []).filter((id) => keptSet.has(id));
    return {
      name: item.name,
      passed: missing.length === 0 && leaked.length === 0,
      kept,
      missing,
      leaked,
    };
  });
  return { passed: results.every((r) => r.passed), cases: results };
}

export function isolationScorecardToMarkdown(scorecard: IsolationScorecard): string {
  const lines = [
    `# Isolation scorecard: ${scorecard.passed ? "PASS" : "FAIL"}`,
    "",
    `| case | result | kept | missing | leaked |`,
    `| --- | --- | --- | --- | --- |`,
  ];
  for (const item of scorecard.cases) {
    lines.push(
      `| ${item.name} | ${item.passed ? "PASS" : "FAIL"} | ${item.kept.join(", ") || "—"} | ${item.missing.join(", ") || "—"} | ${item.leaked.join(", ") || "—"} |`,
    );
  }
  return lines.join("\n") + "\n";
}
