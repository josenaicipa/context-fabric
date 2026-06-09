# Onboarding & commercial playbook

This is the public, sanitized playbook for introducing Context Fabric to a
client or internal team and handing the rollout off cleanly. It complements the
operational steps in [Client/team rollout](./CLIENT_TEAM_ROLLOUT.md) with the
"why", the conversation, and the acceptance gates a stakeholder cares about.

Everything here is public-safe: it names only fictional scopes (`acme-shop`,
`other-co`, `demo`, `example`) and `ALL_CAPS` placeholders. No real client,
channel, customer, or operator data belongs in this repo. See
[boundary policy](./boundary.md).

---

## Who it is for

Context Fabric is for teams running **LLM agents or assistants over a shared
corpus** — docs, repo notes, support history, handoff summaries — where the same
agent serves more than one project, client, or channel.

It fits best when you can answer "yes" to two or more of these:

- Multiple projects/clients share one agent and **must not see each other's
  context** (a `#acme-shop` thread must never pull an `other-co` note).
- Retrieved context sometimes carries **secrets** (keys, tokens, emails) that
  must never reach the model.
- Prompts are **over budget** — you are paying for repeated or off-topic chunks.
- You need **repeatable proof** that scoping and redaction work before each
  rollout, not a one-off manual spot check.

It is **not** a memory store, a vector database, or an agent framework. It is the
selection-and-sanitization layer that decides *which* existing context is safe
and useful for *this* request, right before the model call.

## The problem it solves

Most context bugs are not "the model is wrong" — they are "the model was handed
the wrong context":

| Failure | What it looks like | Context Fabric's answer |
| --- | --- | --- |
| Cross-scope leak | An agent answers a client using another client's data | Hard project isolation in routing |
| Secret leak | A token or email reaches the model/transcript | Sanitize stage redacts before assembly |
| Token bloat | Prompts balloon with duplicate/off-topic chunks | Dedupe + budget trimming |
| Silent regressions | Scoping breaks and nobody notices | Deterministic eval + rollout smoke report |

## Positioning: reliability first

Lead with reliability, not cost. The order of guarantees is deliberate:

```txt
1. contamination == 0      (no cross-project/scope leaks)
2. secret leaks == 0       (nothing sensitive reaches the model)
3. critical facts preserved (must-keep handoff context survives trimming)
4. recall >= target        (the right context is actually present)
5. then: token reduction   (optimize cost only after 1–4 hold)
```

If a token-saving change would weaken any of the first four gates, it does not
ship. The rollout smoke report enforces this order automatically (see
[Interpreting the report](#interpreting-the-passfail-report)).

### On token-cost claims (qualified)

Token reduction is a **benefit, not the headline**, and it is **workload
dependent**. The repo tracks a reliability-gated target (currently a 75%
token-reduction target in [BENCHMARKS.md](./BENCHMARKS.md)) measured on the
public benchmark corpus. Do **not** promise a fixed percentage to a client.
Instead:

- Measure on **their** corpus with the benchmark/eval tooling.
- Report the reduction observed **only when** reliability gates pass.
- Frame savings as "fewer wasted tokens on duplicate/off-topic context", which
  scales with how noisy the corpus is.

---

## Onboarding: 30 / 60 / 90 minute scripts

Pick the depth that matches the audience. Each script is self-contained and uses
only fictional example data shipped in this repo.

### 30 minutes — Decision/demo session

Audience: a stakeholder deciding whether to pilot.

| Time | Segment | Goal |
| --- | --- | --- |
| 0–5 | Frame the problem | Name a real failure they have seen (leak, bloat, regression) |
| 5–10 | Pipeline walkthrough | Route → sanitize → dedupe → budget → handoff (see [concepts](./concepts.md)) |
| 10–20 | Live demo | Run quickstart assemble + a rollout smoke report on example data |
| 20–27 | Boundary & data | What they provide, what they must never share |
| 27–30 | Next step | Agree on a single pilot scope and a date for the 60-min workshop |

Commands to run live (from repo root):

```bash
cd packages/sdk && npm install && npm run build
# 1. Show a scoped, sanitized, budgeted assembly:
node dist/src/cli.js assemble \
  --query "How does checkout work?" --project acme-shop --channel "#acme-shop" \
  --chunks ../../examples/chunks.json --config ../../examples/fabric.config.json \
  --format agent-context
# 2. Show the PASS/FAIL rollout report:
node dist/src/cli.js rollout \
  --policy ../../templates/channel-context-policy.json \
  --smoke ../../examples/rollout-smoke.json --format markdown
```

### 60 minutes — Pilot workshop

Audience: the team that will own the pilot.

1. **(0–5) Recap & goals.** One pilot scope, one channel, success = green report.
2. **(5–15) Boundary.** Walk [boundary in plain language](#publicprivate-boundary-in-plain-language).
   Confirm where their real corpus lives (private system, never this repo).
3. **(15–30) Build a policy.** Copy
   [`templates/channel-context-policy.json`](../templates/channel-context-policy.json)
   and map their channels to scopes. For the workshop, keep fictional scopes.
4. **(30–45) Build smoke cases.** Copy
   [`examples/rollout-smoke.json`](../examples/rollout-smoke.json). Add an
   expected chunk, a forbidden cross-scope chunk, and a candidate chunk.
5. **(45–55) Run & read the report.** Validate policy, run smoke, read PASS/FAIL
   together. Break a case on purpose to see a FAIL, then fix it.
6. **(55–60) Acceptance & owners.** Walk the
   [acceptance checklist](#clientteam-acceptance-checklist); assign an owner per item.

### 90 minutes — Full enablement

Audience: a team taking it to production-adjacent use.

Run the 60-minute workshop, then add:

- **(60–70) Agent preflight.** Wire `AGENT_CONTEXT` into a sample call using
  [`templates/agent-preflight.ts`](../templates/agent-preflight.ts) and
  [docs/AGENT_PREFLIGHT.md](./AGENT_PREFLIGHT.md). Decide fail-open vs fail-closed.
- **(70–80) CI gate.** Add the rollout smoke + boundary doctor to their CI so a
  policy change cannot merge without a green report. See
  [Running the checks](#running-the-checks).
- **(80–90) Handoff.** Fill the
  [stakeholder intake](../templates/stakeholder-intake.md), the
  [rollout readiness checklist](../templates/rollout-readiness-checklist.md), and
  send the [handoff message](../templates/handoff-message.md).

---

## Client/team acceptance checklist

A pilot is accepted when **all** of these hold. This mirrors and extends the v0.1
acceptance gate in [CLIENT_TEAM_ROLLOUT.md](./CLIENT_TEAM_ROLLOUT.md).

**Reliability**

- [ ] Rollout smoke report verdict is **PASS** (contamination 0, secret leaks 0,
      candidate leaks 0, recall ≥ target, 0 unrouted cases).
- [ ] At least one **forbidden cross-scope** case proves isolation (it would FAIL
      if scoping broke).
- [ ] At least one **secret-like string** case proves redaction.
- [ ] Critical/must-keep facts survive budget trimming.

**Boundary & safety**

- [ ] No real project/channel/customer/lead names in anything committed here.
- [ ] No secrets in policy, examples, docs, or tests.
- [ ] No dependency on the private core anywhere in the tree.
- [ ] Agent integration declares an explicit fail-open / fail-closed policy.

**Operability**

- [ ] `make ci` (doctor + build + test) is green.
- [ ] The smoke report runs in the team's CI as a merge gate.
- [ ] An owner is assigned for the policy file and for the eval/smoke set.

---

## What the team provides — and what they must never share

### They provide (in their private system, not this repo)

- A **scope map**: which channels/threads belong to which project.
- A **sanitized corpus**: docs, repo notes, handoff summaries already cleared of
  secrets and PII.
- **Eval expectations**: for sample requests, which chunks must appear and which
  must not.
- **Budget intent**: rough token ceiling per request type (quick answer vs deep
  research vs code change).

The [stakeholder intake template](../templates/stakeholder-intake.md) collects
exactly this, with placeholders only.

### They must never share (into this public repo or any public artifact)

- Real client/customer/lead/operator names or identifiers.
- Raw memories, transcripts, or private channel maps.
- Credentials, tokens, API keys, `.env` contents, service-account JSON.
- Internal prompts or proprietary routing/eval internals.
- Private hostnames or production endpoints.

Real data stays in the team's **private** system. Only fictional, sanitized
patterns are published here.

---

## Public/private boundary in plain language

Think of it as two boxes:

- **Public box (this repo):** the *tools and patterns* — the SDK, the CLI, the
  doctor, generic docs, and fictional example data. Anyone can read it. It has
  **zero dependency** on any private engine.
- **Private box (the team keeps it):** the *real data and any proprietary
  engine* — actual channel maps, real corpus, secrets, internal prompts.

The rule is one-directional: clean, generic patterns can be **published** from
private to public after review; **nothing** real flows the other way, and the
public box never imports the private one. The boundary doctor
(`bash scripts/doctor.sh`) enforces this on every change. Full policy:
[boundary.md](./boundary.md) and
[`boundary.manifest.json`](../boundary.manifest.json).

---

## Running the checks

All commands run from the repo root unless noted.

### Quickstart

```bash
cd packages/sdk
npm install
npm run build
npm test
```

See [QUICKSTART.md](./QUICKSTART.md) for the minimal version.

### Policy validation

Confirms a policy is public-safe (allowlisted scopes, no secret material, at
least one route) before you trust it:

```ts
import { validateRolloutPolicy } from "@context-fabric/sdk";
import policy from "./channel-context-policy.json" assert { type: "json" };

const result = validateRolloutPolicy(policy);
if (!result.passed) throw new Error("policy is not public-safe");
```

### Rollout smoke

```bash
# JSON (exit 0 = pass, 2 = fail) — use this in CI:
node packages/sdk/dist/src/cli.js rollout \
  --policy templates/channel-context-policy.json \
  --smoke examples/rollout-smoke.json

# Markdown report to a file:
node packages/sdk/dist/src/cli.js rollout \
  --policy templates/channel-context-policy.json \
  --smoke examples/rollout-smoke.json \
  --format markdown --out rollout-report.md
```

### CI checks (boundary + build + test)

```bash
make ci        # doctor + install + build + test (what CI runs)
make doctor    # boundary & hygiene checks only
```

---

## Interpreting the PASS/FAIL report

The markdown report has a summary block and a per-case table:

```txt
# Context Fabric Rollout Smoke Report

- Policy validation: PASS
- Cases: 2
- Recall: 100.0%
- Contamination: 0.0%
- Candidate leaks: 0
- Secret leaks: 0
- Unrouted cases: 0
- Reliability gates: PASS
- Verdict: PASS
```

Read it top-down; reliability beats recall beats cost.

| Signal | Meaning | If it is bad, do this |
| --- | --- | --- |
| **Policy validation: FAIL** | The policy carries a non-allowlisted scope, secret-like text, or no routes | Fix the policy before anything else; the smoke result is untrustworthy |
| **Contamination > 0** | A forbidden cross-scope chunk survived | **Stop.** A scope leaks. Fix routing/match rules; never widen recall to mask it |
| **Secret leaks > 0** | Sensitive material reached the bundle | **Stop.** Fix the source data and confirm the sanitizer covers that pattern |
| **Candidate leaks > 0** | Unverified candidate chunks leaked without `includeCandidates` | Tag the chunk correctly or set the case flag deliberately |
| **Unrouted cases > 0** | A smoke case maps to no policy route | Add/adjust a route so the case is covered |
| **Recall below target** | Expected chunks were dropped | Raise budget, boost the route, or fix tagging — only after the gates above are clean |
| **Verdict: PASS** | All gates clean | Proceed; record the observed token reduction if you are reporting cost |

### What to do next

- **All PASS:** capture the report as the pilot's acceptance evidence, then wire
  the smoke command into CI so it stays green.
- **Any reliability gate FAIL:** treat it as a blocker, fix the policy or source
  data, and re-run. Do not relax a gate to get a green verdict.
- **Recall-only miss:** tune budget/boosts/tags; this is the only kind of failure
  you optimize rather than block on.

---

## Related docs

- [Client/team rollout](./CLIENT_TEAM_ROLLOUT.md) — the operational rollout kit
- [Quickstart](./QUICKSTART.md) — 5-minute local demo
- [Concepts](./concepts.md) — the data model and pipeline stages
- [Benchmarks](./BENCHMARKS.md) — reliability gates and the token-reduction target
- [Agent preflight](./AGENT_PREFLIGHT.md) — wiring `AGENT_CONTEXT` into a call
- [Boundary policy](./boundary.md) — what may and may not live here
