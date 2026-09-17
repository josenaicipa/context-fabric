# v1.2 public capability inventory

This inventory compares the public SDK with the private reference at the level
of product capabilities, not source code or internal implementation details.
The public implementation is independently written and constrained by
[`boundary.manifest.json`](../boundary.manifest.json).

## Portable capabilities in v1.2

| Capability | Public surface |
| --- | --- |
| Scoped context assembly | `Fabric`, `Router`, CLI `assemble` with project, channel, workspace, and thread guards. |
| Agent preflight | `runPreflight`; `runGuardedPreflight` adds provider/session/route evidence. |
| Idempotent profile rollout | `planProfileRollout` produces declarative changes and no host writes. |
| Operator-oriented controls | Pure scope-probe, rollout-plan, and readiness helpers suitable for any control plane. |
| Readiness verification | `evaluateReadiness` aggregates probe and rollout blockers. |
| Retrieval v2 integration | `memoryFabricV2ToRecords` accepts healthy, session-backed generic retrieval responses and filters conflicting scopes. |
| Scope-probe fail-closed behavior | Missing route, provider session, reachability, project, or channel blocks guarded preflight. |
| Diagnostics and isolation | Route explanations, empty-bundle hints, policy audit, and isolation scorecard. |
| Sanitization | Normalization plus secret and PII redaction before context leaves the fabric. |

## Deliberately excluded

- Host-specific profile discovery, mutation, backups, service restarts, and
  rollout manifests: these require a particular filesystem and operational
  authority, so a public SDK cannot safely own them.
- Provider wrappers, sessions, retrieval endpoints, and credentials: they are
  deployment secrets and belong in the host application.
- Real routing maps, channel directories, customer records, and project data:
  publishing them violates the repository boundary.
- Proprietary scoring formulas and operational heuristics: the public product
  exposes deterministic, documented interfaces instead of protected internals.

## Verification model

The SDK tests each portable feature with fictional scopes. `make doctor`
enforces the public boundary, and the release process runs an additional scan
for environment paths, identifiers, private-network addresses, and credential
markers before publication.
