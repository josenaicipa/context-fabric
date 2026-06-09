# Changelog

All notable changes to `@context-fabric/sdk` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/). Pre-1.0,
minor versions may carry breaking changes; they are called out below.

## [Unreleased]

### Added

- Project-maturity scaffolding: GitHub Actions CI (`doctor` + build/test on
  Node 20 and 22), `CODEOWNERS`, PR and issue templates, `CONTRIBUTING.md`,
  `SECURITY.md`, this changelog, and a `Makefile` task runner.

### Changed

- `scripts/doctor.sh`: the private-core check now matches genuine
  import/dependency edges instead of any prose mentioning the core, and the
  example-scope check accepts `ALL_CAPS` template placeholders (e.g.
  `YOUR_PROJECT`) alongside the fictional-scope allowlist.
- Install now uses a single authoritative root `package-lock.json` (this is an
  npm workspace); `npm ci` works from the repo root and from `packages/sdk`.

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
[0.1.0]: https://keepachangelog.com/en/1.1.0/
