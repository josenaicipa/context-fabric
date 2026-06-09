# Configuration

The SDK accepts a `FabricConfig` object (or JSON file via the CLI). All sections
are optional; sensible defaults apply.

```jsonc
{
  "version": 1,

  // Routing rules — applied on top of built-in scope scoring.
  "routing": [
    { "project": "acme-shop", "channel": "#acme-shop", "boost": 2.0 },
    { "project": "acme-shop", "boost": 0.5, "requiredTags": ["approved"] }
  ],

  // Token budget for the assembled bundle.
  "budget": {
    "maxTokens": 4000,        // hard ceiling
    "reserveTokens": 500,     // held back for prompt overhead
    "perChunkMaxTokens": 1200 // drop any single chunk larger than this
  },

  // Extra redaction rules, applied after the baseline ruleset.
  "sanitization": [
    { "name": "internal_ticket", "pattern": "TICKET-[0-9]{4,}", "replacement": "[TICKET]" }
  ]
}
```

## Routing rules

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `project` | string | — | Required. Rule applies only to chunks in this project. |
| `channel` | string? | any | If set, rule applies only to matching-channel chunks. |
| `boost` | number? | `1.0` | Added to a matching chunk's score. |
| `requiredTags` | string[]? | `[]` | A matching-scope chunk lacking these tags is excluded. |

## Budget

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `maxTokens` | number | `8000` | Hard ceiling on bundle tokens. |
| `reserveTokens` | number? | `0` | Subtracted from `maxTokens` before fitting. |
| `perChunkMaxTokens` | number? | none | Per-chunk cap; oversized chunks are dropped. |

## Sanitization

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `name` | string | — | Rule identifier (for your own bookkeeping). |
| `pattern` | string | — | Source for a `RegExp`; compiled with the global flag. |
| `replacement` | string? | `[REDACTED]` | Replacement text. Supports `$1` group refs. |

The baseline ruleset (always on) redacts emails, AWS access keys, bearer
tokens, and `apiKey/secret/token/password` assignments. Disable defaults by
constructing a `Sanitizer` with `useDefaults = false`.

## Python core parity

The private `context-fabric-core` Python package uses an equivalent YAML config
(`max_tokens`, `reserve_tokens`, `per_chunk_max_tokens`, `required_tags`). The
field semantics match; only the casing and file format differ.
