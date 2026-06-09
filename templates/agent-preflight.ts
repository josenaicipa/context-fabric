import { runPreflight, ContextFabricClient } from "@context-fabric/sdk";

// Generic example only. Fetch Memory Fabric records in your trusted backend,
// then pass sanitized active/verified records into runPreflight.
const result = runPreflight({
  message: "Prepare a code handoff",
  scope: { project: "acme-shop", channel: "demo" },
  memoryRecords: [],
  repoChunks: [],
});

console.log(result.agentContext);

// Optional internal API client. Keep tokens in env/secret stores, never source.
const client = new ContextFabricClient({
  baseUrl: "http://127.0.0.1:8765",
  token: process.env.CONTEXT_FABRIC_API_TOKEN,
});
void client.health();
