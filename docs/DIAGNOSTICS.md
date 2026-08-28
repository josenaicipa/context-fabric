# Routing diagnostics

Context Fabric can explain *why* a chunk was kept or dropped. Diagnostics use
the same public router the assembler uses — they do not expose proprietary
weights from any private engine.

## SDK

```ts
import { explainRoute, emptyDiagnostic, routeReportToMarkdown } from "@context-fabric/sdk";

const report = explainRoute(
  { query: "checkout", project: "acme-shop", channel: "#acme-shop", threadId: "thread-billing" },
  chunks,
  config,
);

console.log(routeReportToMarkdown(report));
```

`explainRoute` returns a `RouteReport` with one decision per input chunk:

| `reason` | Meaning |
| --- | --- |
| `kept` | In the routed set (survives `maxChunks`). |
| `out_of_scope` | Project or channel mismatch. |
| `out_of_scope_workspace` | Both sides named a workspace and they differ. |
| `out_of_scope_thread` | Thread-private chunk, sibling thread, or unfocused request. |
| `required_tags` | A matching routing rule required tags the chunk lacks. |
| `max_chunks` | Ranked out by the request `maxChunks` cap. |

Assembly-time drops (`candidate_excluded`, `sensitivity_blocked`, `duplicate`,
`per_chunk_cap`, `over_budget`) appear on `bundle.droppedChunks`, not in the
router report.

## Empty bundles

When every chunk is dropped, `emptyDiagnostic(bundle)` returns a short summary
plus hints (sensitivity ceiling, thread focus, budget, …). The CLI prints this
for `assemble --format text` instead of a blank line.

## CLI

```bash
context-fabric diagnose \
  --query "checkout" --project acme-shop --channel "#acme-shop" \
  --chunks examples/chunks.json --config examples/fabric.config.json \
  --format markdown

context-fabric assemble \
  --query "checkout" --project acme-shop \
  --chunks examples/chunks.json --format text

context-fabric isolation --format markdown
context-fabric validate-config --config examples/fabric.config.json
```

`isolation` runs a built-in scorecard against the fictional `acme-shop` /
`other-co` corpus and exits `2` if any public isolation guarantee regresses.
