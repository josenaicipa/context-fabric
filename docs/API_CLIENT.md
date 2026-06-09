# API Client

`ContextFabricClient` is a small helper for trusted server-side callers of an internal Context Fabric API.

```ts
import { ContextFabricClient, createAssemblePayload } from "@context-fabric/sdk";

const client = new ContextFabricClient({
  baseUrl: "http://127.0.0.1:8765",
  token: process.env.CONTEXT_FABRIC_API_TOKEN,
});

const payload = createAssemblePayload(request, chunks);
const bundle = await client.assemble(payload);
```

Security rules:

- Use from backends/agents only, not browsers.
- Store tokens in environment/secret managers.
- Pass sanitized Memory Fabric records; this SDK does not connect to private memory systems.
