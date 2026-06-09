# Contributing to Context Fabric

Thanks for your interest. This is the **public** Context Fabric repository: the
TypeScript SDK/CLI, docs, generic examples, and templates. Contributions are
welcome as long as they respect the boundary that keeps this repo open-source.

## The one rule that matters most

This repo must stay safe to open-source. **Nothing operator-specific,
proprietary, or secret may ever land here.** Concretely:

- No real project / channel / customer / lead names — use the allowlisted
  fictional scopes: `acme-shop`, `other-co`, `demo`, `example`.
- No secrets — credentials, API keys, tokens, OAuth secrets, service-account
  JSON, or `.env` contents, in source, docs, examples, or tests.
- No dependency on the private core (`context-fabric-core`). The SDK is a
  clean-room implementation.

The policy is machine-checked by [`scripts/doctor.sh`](./scripts/doctor.sh) and
described in [`docs/boundary.md`](./docs/boundary.md) and
[`boundary.manifest.json`](./boundary.manifest.json). CI fails on violations.

## Development setup

Requires Node.js **>= 20**.

```bash
git clone <your-fork-url> context-fabric
cd context-fabric
make install     # installs packages/sdk dependencies
make build       # tsc -> dist/
make test        # build + node --test
make doctor      # boundary & hygiene checks
make ci          # everything CI runs, locally
```

`make help` lists every target.

## Workflow

1. **Branch** from `main` (e.g. `feat/routing-diagnostics`, `fix/budget-edge`).
2. **Write a test first** where practical — the SDK uses `node:test` and aims to
   keep behaviour covered (see `packages/sdk/test/`).
3. **Implement** the change. Keep modules small and single-purpose; routing,
   sanitization, and budgeting must not bleed into each other.
4. **Run `make ci`** and make sure it is green.
5. **Update `CHANGELOG.md`** under `Unreleased` for any user-facing change.
6. **Open a PR** using the template; fill in the boundary checklist.

## Coding standards

- TypeScript, ES modules, **zero runtime dependencies** in the published SDK.
- Non-mutating transforms — return new objects, never edit inputs in place.
- Deterministic behaviour — no clocks or randomness in the pipeline.
- Prefer clear names and early returns over cleverness or deep nesting.

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the design properties
and [`docs/DECISIONS.md`](./docs/DECISIONS.md) for the rationale behind them.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`, `perf:`.

## Reporting bugs and proposing features

Open an issue with the relevant template. For anything security-sensitive, do
**not** open a public issue — follow [`SECURITY.md`](./SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the
project's [MIT License](./LICENSE).
