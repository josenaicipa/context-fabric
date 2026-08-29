# Roadmap

Directional, not a commitment. Items move as priorities and evidence change.

## Now (1.1.x — diagnostics & isolation)

- [x] Clean-room TypeScript SDK: routing / sanitizing / budgeting pipeline.
- [x] Reference CLI (`assemble`, `pack`, `eval`, `rollout`, `validate-config`,
      `diagnose`, `isolation`).
- [x] Concepts, configuration, boundary, and diagnostics docs.
- [x] Project-maturity scaffolding: CI, boundary doctor, governance docs.
- [x] Coverage reporting in CI.
- [x] Expanded baseline sanitizer ruleset (JWTs, more cloud keys, phone/PII).
- [x] Routing diagnostics: explain why a chunk was ranked, excluded, or dropped.
- [x] Typed config validation with helpful error messages.
- [x] Pluggable token estimators (heuristic vs. caller-supplied `TokenCounter`).
- [x] Additional integration templates (agent tool, chat messages).
- [ ] Published, versioned npm releases of `@context-fabric/sdk`.

## Next (1.x — ergonomics)

- [ ] Optional streaming / incremental assembly for very large corpora.
- [ ] Browser/edge build target validation.

## Later (exploratory)

- [x] Benchmark suite and a published performance budget (public reliability-first gate).
- [ ] Caching of sanitized chunks keyed by content hash.

## Non-goals

- Becoming a vector store or retrieval backend — the SDK consumes a ranked
  corpus; it does not own embeddings or storage.
- Bundling a server or network client — the SDK stays a pure, in-process library.
- Shipping any operator/customer data or proprietary heuristics — those never
  belong in this public repo (see [boundary.md](./boundary.md)).
