# Context Fabric

> Scope-aware, sanitized, budget-aware context assembly for LLMs and agents.

Context Fabric takes a corpus of context chunks and a request, and returns a
bundle that is **in scope**, **free of secrets**, and **within a token budget**:

1. **Route** — rank chunks for the request's project/channel, hard-excluding
   any chunk from a different project.
2. **Sanitize** — redact emails, tokens, keys, and other secrets from chunk text.
3. **Budget** — trim to a token ceiling, keeping the most relevant chunks.

This is the **public** repository: the TypeScript SDK/CLI, documentation,
generic examples, and templates. It has **zero dependency** on any private
engine and ships only fictional example data.

## Packages

| Package | Description |
| --- | --- |
| [`@context-fabric/sdk`](./packages/sdk) | TypeScript SDK + `context-fabric` CLI. Zero runtime dependencies. |

## Quick start

```bash
cd packages/sdk
npm install
npm run build
npm test
```

### SDK usage

```ts
import { Fabric } from "@context-fabric/sdk";

const fabric = new Fabric({
  routing: [{ project: "acme-shop", channel: "#acme-shop", boost: 2 }],
  budget: { maxTokens: 4000, reserveTokens: 500 },
});

const bundle = fabric.assemble(
  { query: "how does checkout work?", project: "acme-shop", channel: "#acme-shop" },
  [
    {
      id: "c1",
      text: "Acme checkout uses a two-step form.",
      project: "acme-shop",
      channel: "#acme-shop",
      score: 1,
    },
  ],
);

console.log(bundle.chunks);          // in-scope, sanitized, within budget
console.log(bundle.totalTokens, bundle.redactions, bundle.droppedChunkIds);
```

### CLI

```bash
node packages/sdk/dist/src/cli.js assemble \
  --query "checkout" --project acme-shop --channel "#acme-shop" \
  --chunks examples/chunks.json --config examples/fabric.config.json
```

## Documentation

- [Concepts](./docs/concepts.md) — the data model and pipeline stages
- [Configuration](./docs/configuration.md) — config file reference
- [Boundary policy](./docs/boundary.md) — what may and may not live here

## Examples & templates

- [`examples/`](./examples) — runnable generic chunk corpus and config
- [`templates/`](./templates) — starter config and integration snippets

## Boundary

This repo is governed by [`boundary.manifest.json`](./boundary.manifest.json).
**No operator, customer, or private project data belongs here**, and no package
may depend on the private core. All examples use fictional scopes
(`acme-shop`, `other-co`). See [docs/boundary.md](./docs/boundary.md).

## License

MIT — see [LICENSE](./LICENSE).
