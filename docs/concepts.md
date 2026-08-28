# Concepts

Context Fabric assembles a **ContextBundle** from a corpus of **ContextChunks**
and a **ContextRequest**, running three deterministic stages.

## Data model

### ContextChunk

A single retrievable unit of context.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable identifier. |
| `text` | string | Content body. |
| `project` | string | Owning project scope, e.g. `acme-shop`. |
| `channel` | string? | Optional channel scope, e.g. `#acme-shop`. |
| `workspace` | string? | Optional workspace scope. Both-sides mismatch is a hard exclude. |
| `threadId` | string? | Optional conversation-thread stamp. Thread-private chunks never enter a sibling thread or an unfocused request; unstamped chunks are thread-wide fallback. |
| `tags` | string[]? | Free-form routing labels. |
| `sensitivity` | `public \| internal \| restricted`? | Classification. |
| `score` | number? | Optional pre-computed relevance; higher is better. |

### ContextRequest

| Field | Type | Notes |
| --- | --- | --- |
| `query` | string | The user/agent query. |
| `project` | string | Required scope. Chunks from other projects are excluded. |
| `channel` | string? | Optional; boosts matching chunks. Hard-excludes a different named channel. |
| `workspace` | string? | Optional; hard-excludes a different named workspace. |
| `threadId` | string? | Optional thread focus. See `ContextChunk.threadId`. |
| `tags` | string[]? | Boosts chunks with overlapping tags. |
| `maxChunks` | number? | Cap on routed chunks (default 20). |

### ContextBundle

The result: `chunks`, `totalTokens`, `droppedChunkIds`, and `redactions`.

## Pipeline

```
ContextRequest ─┐
                ├─▶ Router ──▶ Sanitizer ──▶ Budgeter ──▶ ContextBundle
ContextChunk[] ─┘   (scope)     (redact)      (token fit)
```

### 1. Router

Ranks chunks for the request. Scoring favours, in order:

- **Channel match** (project + channel align) — strongest signal.
- **Project match** — required; a different project scores `-Infinity` and is
  dropped. This is the cross-project contamination guard.
- **Tag overlap** between request and chunk.
- **Routing-rule boosts**, with optional `requiredTags` filters.

Results are sorted by score and capped at `maxChunks`.

### 2. Sanitizer

Redacts secrets/PII from each routed chunk's text. A baseline ruleset covers
email and phone PII plus high-confidence credential families (see
[configuration](./configuration.md)). Extra rules come from configuration.
Sanitizing is immutable: a clean chunk is returned unchanged by reference; a
redacted chunk is a new object. Text is NFKC-normalized and stripped of
zero-width/control characters before scanning.

### 3. Budgeter

Walks the ranked, sanitized chunks in order and keeps each one whose token
estimate (~4 chars/token) fits the remaining budget. Chunks over
`perChunkMaxTokens` are dropped outright. Available budget is
`maxTokens - reserveTokens`.

## Token estimation

A deliberately simple heuristic — `max(1, floor(length / 4))` — keeps the SDK
dependency-free. Swap in a real tokenizer upstream if you need exact counts.
