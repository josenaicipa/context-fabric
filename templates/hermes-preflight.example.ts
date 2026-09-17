import {
  memoryFabricV2ToRecords,
  runGuardedPreflight,
  type MemoryFabricV2Response,
} from "@context-fabric/sdk";

// This adapter is deliberately owned by the host application. It should invoke
// its configured retrieval provider and return no credentials in the response.
declare function retrieveContext(): Promise<MemoryFabricV2Response>;

const scope = {
  project: "YOUR_PROJECT",
  channel: "#YOUR_CHANNEL",
  maxSensitivity: "internal" as const,
};
const retrieval = await retrieveContext();
const memoryRecords = memoryFabricV2ToRecords(retrieval, scope);

const result = runGuardedPreflight(
  { message: "Current agent task", scope, memoryRecords },
  {
    scope,
    route: { project: "YOUR_PROJECT", channel: "#YOUR_CHANNEL" },
    providerSession: retrieval.providerSession,
    providerReachable: retrieval.status === "ok" || retrieval.status === "healthy",
  },
);

// Add this as a system-owned block immediately before the model call.
console.log(result.agentContext);
