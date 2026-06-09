# Roadmap

Directional, not a commitment. Items move as priorities and evidence change.

## Now (0.1.x — foundation)

- [x] Clean-room TypeScript SDK: routing / sanitizing / budgeting pipeline.
- [x] Reference CLI (`assemble`).
- [x] Concepts, configuration, and boundary docs.
- [x] Project-maturity scaffolding: CI, boundary doctor, governance docs.
- [ ] Coverage reporting in CI.
- [ ] Published, versioned releases of `@context-fabric/sdk`.

## Next (0.2.x — ergonomics & parity)

- [ ] Expanded baseline sanitizer ruleset (JWTs, more cloud keys, phone/PII).
- [ ] Pluggable token estimators (heuristic vs. model-tokenizer adapters).
- [ ] Routing diagnostics: explain why a chunk was ranked, excluded, or dropped.
- [ ] Typed config validation with helpful error messages (parity with the core
      loader's fail-fast behaviour).
- [ ] More framework integration templates beyond the current snippet.

## Later (exploratory)

- [ ] Browser/edge build target validation.
- [ ] Streaming / incremental assembly for very large corpora.
- [ ] Benchmark suite and a published performance budget.

## Non-goals

- Becoming a vector store or retrieval backend — the SDK consumes a ranked
  corpus; it does not own embeddings or storage.
- Bundling a server or network client — the SDK stays a pure, in-process library.
- Shipping any operator/customer data or proprietary heuristics — those never
  belong in this public repo (see [boundary.md](./boundary.md)).
