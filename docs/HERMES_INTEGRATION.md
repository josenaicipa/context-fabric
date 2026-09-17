# Generic Hermes integration

This guide connects a fresh Hermes installation to Context Fabric without
assuming a filesystem layout, profile name, service manager, provider URL, or
credential store. The integration is a host-owned adapter around the public SDK.

## Install from scratch

On the machine that runs your Hermes agent, install the public package in the
agent's application project:

```bash
npm install @context-fabric/sdk
cp ./templates/hermes-context-fabric.config.json context-fabric.config.json
```

Copy the checked-in
[`templates/hermes-context-fabric.config.json`](../templates/hermes-context-fabric.config.json)
into your application before this step. Replace the uppercase placeholders in
your private configuration.
Set `CONTEXT_FABRIC_RETRIEVAL_COMMAND` and `CONTEXT_FABRIC_PROVIDER_SESSION`
through your platform's secret/configuration mechanism; neither value belongs in
source control. The session value is an opaque handle, not a credential.

## Preflight adapter

Start from [`templates/hermes-preflight.example.ts`](../templates/hermes-preflight.example.ts).
The adapter obtains retrieval data, converts it through
`memoryFabricV2ToRecords`, then calls `runGuardedPreflight`.

The guard is deliberately fail-closed. It stops assembly if any of these facts
is missing or inconsistent:

- explicit project and channel scope;
- a matching configured route;
- an opaque provider session;
- a positive provider reachability result.

Choose and document an application-level fallback for a blocked preflight. Do
not reuse a bundle from a different route or provider session.

## Agent-context assembly example

For a simple file-backed local demo, use the installed CLI after compiling your
application:

```bash
context-fabric assemble \
  --query "summarize the current task" \
  --project acme-shop --channel "#acme-shop" \
  --chunks ./chunks.json --format agent-context
```

`--format agent-context` emits a system-owned `AGENT_CONTEXT` block. Your
Hermes adapter should insert it immediately before the model invocation, not
append it to untrusted user text.

## Profile rollout and readiness

Use `planProfileRollout` to calculate desired profile settings in memory, then
persist `nextSettings` with your own configuration API. Re-running the same
plan produces `changed: false`, so callers can make their write step
idempotent. The SDK never reads profile directories or modifies host files.

Run `evaluateReadiness(probes, rolloutPlan)` in CI or a deployment check. A
passing scorecard confirms that every supplied scope probe and profile plan has
route/session/reachability evidence. It does not claim that a host deployment
was performed.

## Security boundary

Keep real routes, profile identifiers, retrieval commands, session handles, and
provider configuration outside this repository. The public template is only a
shape; it contains no usable connection information.
