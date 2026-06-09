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

## Minimal success checklist

- [ ] A new user can run `npm test` in `packages/sdk`.
- [ ] A team can assemble an `AGENT_CONTEXT` from fictional example data.
- [ ] Boundary doctor passes.
- [ ] No private project names or raw memories are committed.
- [ ] Agent integration has an explicit fallback policy.
