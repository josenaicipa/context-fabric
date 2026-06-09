# Architecture

Context Fabric's public SDK is a small, dependency-free TypeScript library. It
has no network surface and no persistent state: given a request and a corpus of
chunks, it returns one assembled bundle.

## Pipeline

```
ContextRequest ─┐
                ├─▶ Router ──▶ Sanitizer ──▶ Budgeter ──▶ ContextBundle
ContextChunk[] ─┘   (scope)     (redact)      (token fit)
```

Each stage is pure and independently testable. `Fabric` (in
`packages/sdk/src/fabric.ts`) wires them together and is the entry point callers
import.

1. **Router** (`router.ts`) — filters and ranks chunks for the request's
   project/channel. Cross-project chunks are *hard-excluded*: a chunk from a
   different project can never appear in the bundle, regardless of score.
2. **Sanitizer** (`sanitizer.ts`) — runs every surviving chunk through a regex
   redaction ruleset (emails, AWS keys, bearer tokens, generic secret
   assignments) plus any config-supplied rules. Bias is toward over-redaction.
3. **Budgeter** (`budgeter.ts`) — greedily admits chunks in rank order until the
   token ceiling (minus a reserve) is reached; the rest are recorded in
   `droppedChunkIds`.

## Data model

Schema types live in `schemas.ts`. Transforms are non-mutating: a sanitized
chunk is a new object (`{ ...chunk, text }`), never an in-place edit.

| Type | Role |
| --- | --- |
| `ContextChunk` | A unit of context: id, text, project, channel, tags, score. |
| `ContextRequest` | The query plus its scope (project/channel/tags) and limits. |
| `RoutingRule` | Scope match + boost + required tags. |
| `SanitizationRule` | Named regex pattern + replacement. |
| `BudgetPolicy` | `maxTokens`, `reserveTokens`, `perChunkMaxTokens`. |
| `ContextBundle` | The result: surviving chunks, totals, redaction count, dropped ids. |

Token counts use a deterministic estimate, not a model tokenizer, so behaviour
is reproducible and dependency-free.

## Package layout

```
packages/sdk/
  src/
    fabric.ts      Fabric — the public entry point
    router.ts      scope-aware ranking
    sanitizer.ts   secret/PII redaction
    budgeter.ts    token-budget fitting
    schemas.ts     the data model (types)
    cli.ts         reference CLI
    index.ts       public exports
  test/            node:test suites
docs/              concepts, configuration, boundary, architecture, roadmap…
examples/          runnable generic chunk corpus + config
templates/         starter config + integration snippet
```

## Boundary architecture

This is the **public** half of a two-repo design:

- `context-fabric` (this repo, public) — clean-room TypeScript SDK/CLI, docs, and
  generic examples. **Zero** dependency on any private engine.
- A private core (not published) holds proprietary heuristics and operator
  configuration.

The SDK is a clean-room implementation. It shares *concepts* and a config shape
with the private core, but never a dependency edge or any private data. The
separation is enforced by [`boundary.manifest.json`](../boundary.manifest.json),
by `scripts/doctor.sh`, and by code review. See [DECISIONS.md](./DECISIONS.md)
for the rationale and [boundary.md](./boundary.md) for the policy.

## Design properties

- **Deterministic** — same inputs, same bundle. No clocks, no randomness.
- **Zero runtime dependencies** — the published package ships only its own code.
- **Fail-safe redaction** — the sanitizer runs on every chunk before it can
  enter a bundle.
- **Single responsibility per module** — routing, redaction, and budgeting never
  bleed into each other.

## Extension points

- New redaction rules: add a `SanitizationRule` to `DEFAULT_RULES` or supply via
  config.
- New routing signals: extend `RoutingRule` and the ranking in `router.ts`.
- Alternative token estimators: replace the estimate behind the same contract;
  the budgeter is agnostic to how tokens are counted.
