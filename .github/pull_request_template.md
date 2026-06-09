<!--
Thanks for contributing to Context Fabric. Keep this repo open-source-clean:
no secrets, no private/operator data, no dependency on the private core.
-->

## Summary

<!-- What does this change do, and why? -->

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change
- [ ] Docs / examples / templates
- [ ] Tooling / CI / chore

## Boundary & hygiene checklist

- [ ] No real project / channel / customer names — examples use allowlisted
      scopes (`acme-shop`, `other-co`, `demo`, `example`).
- [ ] No secrets (keys, tokens, credentials, `.env`, service-account JSON).
- [ ] No import of or dependency on `context-fabric-core`.
- [ ] New examples/templates are generic and self-explanatory.

## Verification

- [ ] `make doctor` passes locally.
- [ ] `make test` is green in `packages/sdk`.
- [ ] Added/updated tests for behavioural changes.
- [ ] `CHANGELOG.md` updated under `Unreleased` (for user-facing changes).

## Notes for reviewers

<!-- Anything reviewers should focus on, trade-offs, follow-ups. -->
