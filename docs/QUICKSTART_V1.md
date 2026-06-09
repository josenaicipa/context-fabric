# Quickstart v1

```ts
import { runPreflight, resolveChannelRoute, v1Readiness } from "@context-fabric/sdk";

const decision = resolveChannelRoute("engineering", "debug checkout bug");
const result = runPreflight({ message: "debug checkout bug", scope: decision.route });
console.log(result.agentContext);
console.log(v1Readiness());
```
