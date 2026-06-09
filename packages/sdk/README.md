# @context-fabric/sdk

Public TypeScript client for [Context Fabric](../../README.md): scope-aware,
sanitized, budget-aware context assembly for LLMs and agents.

- **Zero runtime dependencies.**
- **Clean-room** — no dependency on any private engine.
- Ships an SDK and a `context-fabric` CLI.

## Install

```bash
npm install @context-fabric/sdk
```

## Usage

```ts
import { Fabric } from "@context-fabric/sdk";

const fabric = new Fabric({
  routing: [{ project: "acme-shop", channel: "#acme-shop", boost: 2 }],
  budget: { maxTokens: 4000, reserveTokens: 500 },
  sanitization: [{ name: "ticket", pattern: "TICKET-\\d+", replacement: "[TICKET]" }],
});

const bundle = fabric.assemble(
  { query: "checkout", project: "acme-shop", channel: "#acme-shop" },
  [{ id: "c1", text: "Checkout uses a two-step form.", project: "acme-shop", channel: "#acme-shop", score: 1 }],
);

bundle.chunks;          // in-scope, sanitized, within budget
bundle.totalTokens;     // estimated tokens kept
bundle.redactions;      // count of secrets redacted
bundle.droppedChunkIds; // chunks dropped to fit budget
```

### Pieces

`Router`, `Sanitizer`, and `Budgeter` are exported individually if you want to
compose the stages yourself.

## CLI

```bash
context-fabric assemble \
  --query "checkout" --project acme-shop --channel "#acme-shop" \
  --chunks chunks.json --config fabric.config.json
```

## Develop

```bash
npm install
npm run build     # tsc -> dist/
npm test          # build + node --test
```

## License

MIT
