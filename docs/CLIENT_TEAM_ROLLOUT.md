# Client/team rollout guide

This guide is the public, sanitized way to introduce Context Fabric to a client
or internal team. It intentionally avoids private engine details, operator data,
and production channel maps.

## What teams get

Context Fabric gives agents a scoped context pack before they answer:

```txt
request + project/channel scope
  -> route relevant chunks
  -> redact sensitive text
  -> dedupe repeated facts
  -> fit the token budget
  -> emit AGENT_CONTEXT
```

The goal is not to store memory. The goal is to decide which existing memory,
docs, repo notes, or handoff chunks are safe and useful for the current task.

## Recommended rollout phases

### Phase 1 — Read-only pilot

- Pick one fictional or non-sensitive project scope, for example `acme-shop`.
- Add sanitized docs and memory chunks to `examples/chunks.json` or your own
  private corpus.
- Run local assembly with the CLI.
- Verify recall, contamination, and secret-redaction behavior before connecting
  an agent.

```bash
cd packages/sdk
npm install
npm test
node dist/src/cli.js assemble \
  --query "How does checkout work?" \
  --project acme-shop \
  --channel "#acme-shop" \
  --chunks ../../examples/chunks.json \
  --config ../../examples/fabric.config.json \
  --format agent-context
```

### Phase 2 — Agent preflight

Use the SDK to build an `AGENT_CONTEXT` block immediately before the model call.
Treat that block as system-owned context, not as new user text.

Required behavior:

- Keep project/channel scope explicit.
- Exclude chunks from other projects.
- Redact secrets before the context reaches the model.
- Preserve critical handoff facts even when reducing tokens.
- Fail open or fail closed deliberately; do not silently mix scopes.

### Phase 3 — Team templates

Give each team a small policy file rather than embedding routing rules in code.
Start from [`templates/channel-context-policy.json`](../templates/channel-context-policy.json).

Each entry should answer:

- Which project does this channel/thread belong to?
- What budget profile should it use?
- Which facts are critical/must-keep?
- Which data classes are forbidden from agent context?

### Phase 4 — Evaluation gate

Before expanding to more teams, run an evaluation set with:

- expected chunks that must be recalled;
- forbidden chunks that must not appear;
- known secret-like strings that must be redacted;
- token-budget pressure cases.

A good rollout optimizes for reliability first:

```txt
recall >= target
contamination == 0
secret leaks == 0
critical facts preserved
then optimize token reduction
```

## v0.1 rollout kit (policy + smoke + report)

The SDK ships a small, public-safe kit so a client or team can validate a rollout
policy and prove scope isolation locally before connecting an agent. It reads a
generic channel/team policy (fictional scopes only), checks it carries no
forbidden scopes or secret material, then runs the public `assemble` path over a
set of smoke cases and emits a machine-readable report (optionally markdown).

The kit lives entirely in the public SDK; it never imports the private engine.

### What the kit checks

- **Policy validation** — every `project`/`channel` scope is in the fictional
  allowlist (`acme-shop`, `other-co`, `demo`, `example`) or an `ALL_CAPS`
  placeholder a team is expected to replace; no secret-like material is present;
  at least one route is declared.
- **Smoke per case** — expected chunk IDs survive assembly, forbidden chunk IDs
  are absent, candidate-tagged chunks are excluded unless the case explicitly
  sets `includeCandidates`, and the case maps to a covering policy route.
- **Aggregate gates** — recall ≥ 0.9, contamination = 0, candidate leaks = 0,
  secret leaks = 0, and zero unrouted cases.

### Run it from the CLI

```bash
cd packages/sdk
npm install
npm run build

# Machine-readable JSON report (exit code 0 = pass, 2 = fail):
node dist/src/cli.js rollout \
  --policy ../../templates/channel-context-policy.json \
  --smoke ../../examples/rollout-smoke.json

# Markdown report written to a file:
node dist/src/cli.js rollout \
  --policy ../../templates/channel-context-policy.json \
  --smoke ../../examples/rollout-smoke.json \
  --format markdown --out rollout-report.md
```

### Run it from the SDK

```ts
import { runRolloutSmoke, validateRolloutPolicy } from "@context-fabric/sdk";
import policy from "./channel-context-policy.json" assert { type: "json" };
import cases from "./rollout-smoke.json" assert { type: "json" };

const validation = validateRolloutPolicy(policy);
if (!validation.passed) throw new Error("policy is not public-safe");

const report = runRolloutSmoke(policy, cases);
if (!report.passed) process.exit(2);
```

Start from [`templates/channel-context-policy.json`](../templates/channel-context-policy.json)
for the policy and [`examples/rollout-smoke.json`](../examples/rollout-smoke.json)
for the smoke cases. Keep real channel maps and raw memories in your private
system; only fictional, sanitized scopes belong in this repo.

## Public/private boundary

This public repo may include:

- SDK interfaces;
- CLI examples;
- fictional chunks;
- sanitized integration templates;
- generic docs.

This public repo must not include:

- private channel maps;
- customer data;
- raw memories;
- internal prompts;
- proprietary router/eval internals;
- credentials or `.env` values.

Keep private implementation and operator-specific routing in your private system.
Only publish clean-room, generic patterns here.

## v0.1 acceptance checklist

A client/team adoption of v0.1 is acceptable when all of the following hold:

- [ ] No private data: no real operator/client project, channel, customer, or
      lead names — only fictional allowlist scopes (`acme-shop`, `other-co`,
      `demo`, `example`) or `ALL_CAPS` placeholders.
- [ ] No secrets: no credentials, tokens, API keys, or `.env` values in policy,
      examples, docs, or tests.
- [ ] CI green: `npm test` passes in `packages/sdk` and the boundary doctor
      (`bash scripts/doctor.sh` / `make doctor`) passes.
- [ ] Example scopes fictional: `validateRolloutPolicy` passes on the policy and
      `runRolloutSmoke` reports `passed: true` (recall ≥ 0.9, contamination 0,
      candidate leaks 0, secret leaks 0, 0 unrouted cases).
- [ ] A team can assemble an `AGENT_CONTEXT` from fictional example data.
- [ ] No dependency on the private core anywhere in the tree.
- [ ] Agent integration has an explicit fail-open / fail-closed fallback policy.
