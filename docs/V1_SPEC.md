# Context Fabric v1 Public Spec

Context Fabric v1 defines a public, clean-room contract for scoped context assembly: `ContextRequest`, `ContextChunk`, `ContextBundle`, and `ContextPack`. The public repo contains SDK/docs/templates only and does not depend on the private core.

## Public guarantee
- Runnable demo in under 5 minutes.
- Scope-aware routing by project/channel/workspace.
- Sanitization and token budgeting.
- Citations and dropped-chunk metadata.
- Agent handoff text for Claude/Codex/Hermes-style agents.
- Critical chunks tagged `must_keep` or `critical` are prioritized ahead of optional chunks before `maxChunks` and token budgeting, so token savings do not silently discard declared must-keep context. If critical content exceeds the token budget, the bundle emits a `critical_dropped` warning.
