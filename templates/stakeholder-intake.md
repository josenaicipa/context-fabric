# Stakeholder intake questionnaire (template)

Fill this out with the team adopting Context Fabric. **Keep it public-safe:**
replace every `ALL_CAPS` placeholder with *generic* values, and keep real
project/channel/customer names, secrets, and raw data in your private system —
never commit them here. See [docs/boundary.md](../docs/boundary.md).

> All examples below use fictional scopes (`acme-shop`, `other-co`, `demo`).

## 1. Context & goals

- Team / owner: `TEAM_NAME` (owner: `OWNER_PLACEHOLDER`)
- One-line problem we are solving: `PROBLEM_STATEMENT`
- Primary success metric (reliability first): `e.g. zero cross-scope leaks in pilot`
- Secondary metric (cost): `e.g. observed token reduction once gates pass`
- Target go-live date: `YYYY-MM-DD`

## 2. Scopes (projects & channels)

How many distinct projects/clients share the agent? List the mapping using
generic placeholders. Real maps stay private.

| Channel / surface (generic) | Project scope | Must isolate from |
| --- | --- | --- |
| `#acme-shop` | `acme-shop` | `other-co` |
| `#other-co` | `other-co` | `acme-shop` |
| `PLACEHOLDER_CHANNEL` | `PLACEHOLDER_PROJECT` | `...` |

- Any cross-project comparison allowed? `no / yes (describe the explicit route)`

## 3. Corpus (kept in your private system)

- Source types: `docs / repo notes / handoff summaries / support history / other`
- Approximate size: `# chunks or # docs`
- Already sanitized of secrets & PII? `yes / no — if no, sanitize before pilot`
- Where it lives (private): `PRIVATE_STORE_PLACEHOLDER` *(do not put a real
  hostname or path in this repo)*

## 4. Eval expectations

For 2–3 representative requests, what *must* and *must not* appear?

| Request (generic) | Must appear (expected) | Must NOT appear (forbidden) |
| --- | --- | --- |
| `"How does checkout work?"` | `expected chunk id` | `cross-scope or candidate chunk id` |
| `REQUEST_PLACEHOLDER` | `EXPECTED_ID` | `FORBIDDEN_ID` |

- A known secret-like string to confirm redaction (use a fake one): `e.g. sk-FAKEFAKEFAKE...`

## 5. Budget intent

| Request type | Rough token ceiling | Budget profile |
| --- | --- | --- |
| Quick answer | `TOKENS` | `quick-answer` |
| Deep research | `TOKENS` | `deep-research` |
| Code change | `TOKENS` | `code-change` |
| Handoff | `TOKENS` | `handoff` |

## 6. Integration & safety

- Where is the agent call made? `service / framework (generic)`
- Fail policy when context cannot be assembled safely: `fail-open / fail-closed`
- Who owns the policy file? `OWNER_PLACEHOLDER`
- Who owns the eval/smoke set? `OWNER_PLACEHOLDER`
- CI in place to gate policy changes? `yes / no`

## 7. Confirmed boundaries

- [ ] No real names, customer data, or raw memories will be committed to the
      public repo.
- [ ] No secrets / tokens / `.env` values will appear in policy, examples, or docs.
- [ ] No dependency on the private core will be introduced.
- [ ] Real corpus and channel maps stay in the private system.
