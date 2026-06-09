# Sample handoff message (template)

A short message to hand a Context Fabric rollout to a team or client. Replace
`ALL_CAPS` placeholders. Keep it public-safe — no real names, data, or secrets.

---

**Subject:** Context Fabric pilot ready for `PLACEHOLDER_PROJECT`

Hi `RECIPIENT_PLACEHOLDER`,

The Context Fabric pilot for `PLACEHOLDER_PROJECT` (channel
`PLACEHOLDER_CHANNEL`) is ready to hand over.

**What it does:** before each agent call, it routes only in-scope context,
redacts secrets, dedupes, and trims to a token budget — so the agent never sees
another scope's data or sensitive material. Reliability comes first; token
savings are a measured by-product.

**Status:**

- Rollout smoke report: **PASS** (contamination 0, secret leaks 0, candidate
  leaks 0, recall ≥ target, 0 unrouted cases).
- `make ci` (boundary doctor + build + tests): green.
- Fail policy: `fail-open / fail-closed`.

**What's included:**

- Policy: `templates/channel-context-policy.json` (mapped to your scopes).
- Smoke cases: `examples/rollout-smoke.json` (expected, forbidden, candidate).
- Report evidence: `PATH_TO_SAVED_REPORT.md`.

**How to re-run the gate:**

```bash
make ci
node packages/sdk/dist/src/cli.js rollout \
  --policy templates/channel-context-policy.json \
  --smoke examples/rollout-smoke.json --format markdown
```

**Owners:**

- Policy file: `OWNER_PLACEHOLDER`
- Eval/smoke set: `OWNER_PLACEHOLDER`

**Boundary reminder:** keep the real corpus, channel maps, and any secrets in our
private system. Only fictional, sanitized scopes go in the public repo. Details:
`docs/boundary.md`.

Next step: `e.g. wire the smoke command into your CI and schedule a 2-week check-in`.

Thanks,
`SENDER_PLACEHOLDER`

---

> See [docs/PLAYBOOK.md](../docs/PLAYBOOK.md) for the full onboarding script and
> acceptance checklist.
