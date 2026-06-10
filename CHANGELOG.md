# Changelog

All notable changes to `@context-fabric/sdk` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/). Pre-1.0,
minor versions may carry breaking changes; they are called out below.

## [Unreleased]

_No unreleased changes._

## [1.0.0] — 2026-06-10

### Added

- v1 public contracts for citations, context packs, agent handoff text, eval
  scorecards, dropped-chunk metadata, and CLI `doctor`, `pack`, and `eval`
  commands.
- Public v1 router, budget profiles, policy audit helpers, repo packs, and the
  readiness contract; v1 quickstart, beta report, and security-hardening docs.
- `ContextFabricClient` for trusted backend/internal API calls, plus a public
  agent preflight template and the clean-room memory-record bridge.
- Public-safe rollout kit: policy validation, local assemble smoke, and a
  machine-readable report (`runRolloutSmoke`, `validateRolloutPolicy`).
- Shared `secret-patterns` module so runtime sanitizer redaction and
  rollout/boundary detection draw from one high-confidence credential set
  (GitHub `ghp_`/`github_pat_`, Slack `xox*`, Google `AIza`, Stripe `sk_live_`,
  `sk-`, AWS, PEM private-key blocks, bearer tokens, generic assignments).
- CLI `--help`/`--version`, plus `--tags` and `--includeCandidates` forwarding
  on `assemble`.
- Project-maturity scaffolding: GitHub Actions CI (`doctor` + build/test on
  Node 20 and 22), `CODEOWNERS`, PR/issue templates, `CONTRIBUTING.md`,
  `SECURITY.md`, this changelog, and a `Makefile` task runner.

### Changed

- **Fail-closed default.** `Fabric.assemble` now defaults `maxSensitivity` to
  `public` (was `restricted`), matching the default `auditBundle` ceiling. A
  default bundle over public-safe input passes the default audit and never
  carries internal/restricted material unless the caller opts in.
- `assemble` emits the full v1 bundle shape (citations, warnings, budget
  profile, dropped-chunk details, full selected chunk objects).
- Dedupe now fingerprints the full normalized chunk text (hashed) instead of a
  400-char prefix, so distinct long chunks sharing an opening are no longer
  collapsed as duplicates.
- `Sanitizer` raises a clear `SanitizerRuleError` (with rule name and pattern)
  for an invalid custom regex instead of a cryptic raw `RegExp` throw.
- `scripts/doctor.sh`: the private-core check matches genuine import/dependency
  edges (not prose), and the example-scope check accepts `ALL_CAPS` template
  placeholders alongside the fictional-scope allowlist.
- Install uses a single authoritative root `package-lock.json` (npm workspace);
  `npm ci` works from the repo root and from `packages/sdk`.
- Packaging: the published tarball includes `LICENSE`, and `prepublishOnly`
  guards publishes with a fresh build + test run.

### Security

- Runtime `Sanitizer` redaction now covers the same high-confidence secret
  families as the rollout/boundary detection set, closing a parity gap where a
  token family could be detected but not redacted.

## [0.1.0] — 2026-06-09

### Added

- Clean-room TypeScript SDK with the routing → sanitizing → budgeting pipeline.
- Scope-aware `Router` with hard cross-project exclusion.
- `Sanitizer` with a baseline redaction ruleset plus config-supplied rules.
- Token-budget `Budgeter` using a deterministic, dependency-free estimate.
- Reference `context-fabric` CLI (`assemble`).
- Concepts, configuration, boundary, architecture, roadmap, decisions, and
  release documentation.
- Generic, fictional examples and starter templates.
- `boundary.manifest.json` and `scripts/doctor.sh` to enforce the public/private
  boundary.

[Unreleased]: https://keepachangelog.com/en/1.1.0/
[1.0.0]: https://keepachangelog.com/en/1.1.0/
[0.1.0]: https://keepachangelog.com/en/1.1.0/
