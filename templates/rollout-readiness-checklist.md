# Rollout readiness checklist (template)

Copy this checklist into your pilot tracker and check each item before declaring a
scope production-adjacent. It pairs with the acceptance gate in
[docs/PLAYBOOK.md](../docs/PLAYBOOK.md) and
[docs/CLIENT_TEAM_ROLLOUT.md](../docs/CLIENT_TEAM_ROLLOUT.md).

Keep all committed examples public-safe: fictional scopes (`acme-shop`,
`other-co`, `demo`, `example`) or `ALL_CAPS` placeholders only.

## Scope: `PLACEHOLDER_PROJECT` (channel `PLACEHOLDER_CHANNEL`)

### Reliability (blockers)

- [ ] Rollout smoke report verdict is **PASS**.
- [ ] Contamination = 0 (a forbidden cross-scope case proves isolation).
- [ ] Secret leaks = 0 (a secret-like string case proves redaction).
- [ ] Candidate leaks = 0 (unverified chunks excluded by default).
- [ ] Unrouted cases = 0 (every smoke case maps to a route).
- [ ] Recall ≥ target on the eval set.
- [ ] Critical / must-keep facts survive budget trimming.

### Boundary & safety (blockers)

- [ ] No real project/channel/customer/lead/operator names committed here.
- [ ] No secrets/tokens/`.env` in policy, examples, docs, or tests.
- [ ] No dependency on the private core anywhere in the tree.
- [ ] `make doctor` passes (boundary & hygiene).
- [ ] Agent integration declares fail-open / fail-closed explicitly.

### Operability

- [ ] `make ci` (doctor + build + test) is green.
- [ ] Rollout smoke runs in CI as a merge gate for policy changes.
- [ ] Policy file has a named owner: `OWNER_PLACEHOLDER`.
- [ ] Eval/smoke set has a named owner: `OWNER_PLACEHOLDER`.
- [ ] A markdown rollout report is saved as acceptance evidence.

### Cost (only after reliability is green)

- [ ] Token reduction measured on the team's own corpus (not a fixed promise).
- [ ] Reduction reported only with reliability gates passing.

## Sign-off

| Role | Name (placeholder) | Date |
| --- | --- | --- |
| Pilot owner | `OWNER_PLACEHOLDER` | `YYYY-MM-DD` |
| Reviewer | `REVIEWER_PLACEHOLDER` | `YYYY-MM-DD` |
