# Boundary Policy

Context Fabric is developed as **two repositories** with a strict, one-way
boundary. This document explains the separation and how it is enforced.

## The two repos

| Repo | Visibility | Holds |
| --- | --- | --- |
| `context-fabric-core` | **Private** | Proprietary engine, IP, operator-specific config. |
| `context-fabric` (this) | **Public** | TypeScript SDK/CLI, docs, generic examples, templates. |

Both repos carry a machine-readable `boundary.manifest.json` describing what may
live there.

## Rules

1. **No private data in the public repo.** No real project names, channel maps,
   customer/lead data, or internal notes. Examples use only the allowlisted
   fictional scopes: `acme-shop`, `other-co`, `demo`, `example`.
2. **No secrets anywhere.** Not in source, docs, examples, or tests.
3. **No dependency edge.** Public packages must not import or vendor
   `context-fabric-core`. The SDK is a clean-room implementation that shares
   concepts — not code — with the core.
4. **One-way, reviewed flow.** Code moves *into* the public repo only after a
   manual review confirms no private data or IP leaks. Nothing auto-syncs.

## Why a clean-room SDK

Shipping the public client as an independent implementation means the public
repo can be open-sourced without exposing the private engine's heuristics, and
external users can adopt the SDK without any private dependency.

## Enforcement

- `boundary.manifest.json` (both repos) is the source of truth and is meant to
  be checked by CI or a pre-commit hook.
- Reviewers verify the checklists in each repo's `CLAUDE.md` before merging.
- Suggested automated checks for this repo:
  - grep examples/docs for non-allowlisted project/channel names;
  - grep the tree for secret patterns (keys, tokens, `.env`);
  - assert no source imports `context-fabric-core`.
