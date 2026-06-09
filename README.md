# Context Fabric

> Scope-aware, sanitized, budget-aware context assembly for LLMs and agents.

Context Fabric takes a corpus of context chunks and a request, and returns a
bundle that is **in scope**, **free of secrets**, and **within a token budget**:

1. **Route** — rank chunks for the request's project/channel, hard-excluding
   any chunk from a different project.
2. **Sanitize** — redact emails, tokens, keys, and other secrets from chunk text.
3. **Dedupe** — remove repeated context before spending tokens.
4. **Budget** — trim to a token ceiling, keeping the most relevant chunks.
5. **Handoff/eval** — emit agent-ready context packs and deterministic scorecards.

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

Or use the repo task runner from the root (`make help` lists every target):

```bash
make install   # install SDK dependencies
make build     # compile to dist/
make test      # build + run the test suite
make doctor    # public-boundary & hygiene checks
make ci        # everything CI runs: doctor + install + build + test
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
node packages/sdk/dist/src/cli.js doctor --config examples/fabric.config.json
node packages/sdk/dist/src/cli.js assemble \
  --query "checkout" --project acme-shop --channel "#acme-shop" \
  --chunks examples/chunks.json --config examples/fabric.config.json
node packages/sdk/dist/src/cli.js assemble \
  --query "checkout" --project acme-shop --channel "#acme-shop" \
  --chunks examples/chunks.json --config examples/fabric.config.json \
  --format agent-context
node packages/sdk/dist/src/cli.js pack \
  --id acme-demo --summary "Demo pack" --project acme-shop \
  --chunks examples/chunks.json --output /tmp/acme-demo-pack.json
node packages/sdk/dist/src/cli.js eval \
  --query "support" --project acme-shop --channel "#acme-shop" \
  --chunks examples/chunks.json --config examples/fabric.config.json \
  --expect c2 --forbid c3
```

## Documentation

- [Quickstart](./docs/QUICKSTART.md) — 5-minute local demo
- [v1 spec](./docs/V1_SPEC.md) — public contracts and guarantees
- [Dogfooding](./docs/DOGFOODING.md) — fictional internal-agent scenario
- [Memory bridge](./docs/MEMORY_BRIDGE.md) — clean-room memory-record helper
- [API client payloads](./docs/API_CLIENT.md) — JSON bodies for API integrations
- [Packaging](./docs/PACKAGING.md) — release-check and npm pack smoke
- [Benchmarks](./docs/BENCHMARKS.md) — reliability-first gates plus the current 75% token-reduction target
- [Agent preflight](./docs/AGENT_PREFLIGHT.md) — clean-room agent preflight helper
- [Release candidate](./docs/RELEASE_RC.md) — RC checklist
- [Concepts](./docs/concepts.md) — the data model and pipeline stages
- [Configuration](./docs/configuration.md) — config file reference
- [Architecture](./docs/ARCHITECTURE.md) — module design and design properties
- [Boundary policy](./docs/boundary.md) — what may and may not live here
- [Roadmap](./docs/ROADMAP.md) — direction and non-goals
- [Decisions](./docs/DECISIONS.md) — architecture decision record
- [Release process](./docs/RELEASE.md) — versioning and publishing

## Examples & templates

- [`examples/`](./examples) — runnable generic chunk corpus and config
- [`templates/`](./templates) — starter config and integration snippets

## Contributing & governance

- [Contributing guide](./CONTRIBUTING.md) — setup, workflow, and standards
- [Security policy](./SECURITY.md) — how to report vulnerabilities privately
- [Changelog](./CHANGELOG.md) — notable changes per version

CI runs the boundary doctor plus build and tests on every push and pull request
(see [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)).

## Boundary

This repo is governed by [`boundary.manifest.json`](./boundary.manifest.json).
**No operator, customer, or private project data belongs here**, and no package
may depend on the private core. All examples use fictional scopes
(`acme-shop`, `other-co`). See [docs/boundary.md](./docs/boundary.md).

## License

MIT — see [LICENSE](./LICENSE).


## v0.2.0 RC

The RC adds public agent preflight helpers, clean-room memory record conversion, and a minimal trusted-backend API client. Runtime tokens belong in env/secret stores and must never be used from browser code.


## v1.0

Context Fabric v1 adds the stable public SDK surface: preflight, channel routing, budget profiles, policy audit, repo packs, API client, and v1 readiness checks.
