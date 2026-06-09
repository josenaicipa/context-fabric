# Architecture Decision Record

Lightweight ADR log for the public SDK. Newest first.

---

## ADR-0004 — Boundary enforced by a doctor script

**Status:** Accepted · 2026-06-09

**Context.** The public repo must never carry secrets, operator data, or a
dependency on the private core. Documentation alone does not prevent regressions.

**Decision.** Add `scripts/doctor.sh`, run in CI and via `make doctor`, that
checks: visibility, no import/dependency edge to the private core, no secret
signatures, example scopes within an allowlist, no operator data, and that
required docs exist with resolving README links.

**Consequences.** Boundary violations fail the build before merge. The sanitizer
source and fixtures are excluded from secret scans because they legitimately
contain detection patterns.

---

## ADR-0003 — Deterministic, dependency-free token estimate

**Status:** Accepted · 2026-06-09

**Context.** Budgeting needs a token count, but pulling a model tokenizer adds a
heavy dependency and non-determinism across versions.

**Decision.** Use a simple deterministic estimate in the SDK. Keep the estimator
behind a stable contract so a tokenizer adapter can replace it later.

**Consequences.** Reproducible bundles and a zero-dependency package, at the cost
of approximate counts. Good enough for budgeting headroom; exactness is a
future, opt-in concern.

---

## ADR-0002 — Non-mutating transforms

**Status:** Accepted · 2026-06-09

**Context.** Chunks pass through three stages. Mutating shared objects makes
leaks and ordering bugs hard to reason about.

**Decision.** Each stage returns new objects (`{ ...chunk, text }`); the input
corpus is never modified.

**Consequences.** Easier reasoning and testing; slightly more allocation.

---

## ADR-0001 — Clean-room public SDK, zero dependency on the private core

**Status:** Accepted · 2026-06-09

**Context.** We want a credible open-source SDK without exposing proprietary
heuristics or operator data held in a private core.

**Decision.** Implement the SDK independently in TypeScript with **zero**
dependency on the private package. Ship only generic, fictional examples. The two
repos may share concepts and a config shape, never code or data.

**Consequences.** Some duplication of concepts across implementations, accepted
as the cost of a clean, auditable boundary. Any future port from the private core
is a manual, reviewed rewrite — never an automated sync.
