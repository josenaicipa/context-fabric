# Agent preflight integration

The public SDK exposes a clean-room `runPreflight` helper for client/team demos. It accepts a message, explicit scope, memory records, and repo chunks, then returns selected chunks, a context pack, and agent-context text.

Candidates are excluded by default; cross-project records are always excluded.


## Internal API client

The public SDK includes a tiny `ContextFabricClient` for teams calling a private Context Fabric API from a trusted backend. It is intentionally minimal and does not fetch Memory Fabric itself.

```ts
import { ContextFabricClient } from "@context-fabric/sdk";

const client = new ContextFabricClient({
  baseUrl: "http://127.0.0.1:8765",
  token: process.env.CONTEXT_FABRIC_API_TOKEN,
});

await client.health();
```

Never put the API token in browser code.


## Runner seam and fixture

`runPreflight` is the clean-room runner seam: your trusted backend fetches sanitized memory records, then the SDK builds an agent context and context pack. See `examples/demo-agent-preflight-memory.json` for a public fixture with active, verified, and candidate statuses.
