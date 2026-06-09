# Security Policy

## Supported versions

Context Fabric is pre-1.0. Security fixes are applied to the latest released
minor of `@context-fabric/sdk` only.

| Version | Supported |
| --- | --- |
| `0.1.x` | ✅ |
| `< 0.1` | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately using GitHub's
[private vulnerability reporting](https://docs.github.com/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability):
open the repository's **Security** tab and choose **Report a vulnerability**.

When reporting, please include:

- A description of the issue and its impact.
- A minimal reproduction using only fictional scopes (`acme-shop`, `other-co`).
- Affected version(s) and environment.

Do **not** include real secrets, credentials, or private/operator data in your
report — redact them.

### What to expect

- Acknowledgement of your report within a few business days.
- An assessment and, if accepted, a fix on a coordinated timeline.
- Credit in the release notes if you would like it.

## Scope

This repository is the public client SDK, CLI, docs, examples, and templates. In
scope:

- Sanitizer bypasses — input that should be redacted but is not.
- Routing leaks — a chunk from one project surfacing under another's scope.
- Any path by which secrets or private data could pass through the pipeline
  unredacted.
- Dependency or supply-chain issues in the published package.

Out of scope: the private core (reported through its own channel) and issues in
your own downstream configuration or data.

## Hardening notes for users

- The SDK never persists data and has no network surface; keep it that way in
  your integration.
- Treat the sanitizer as defense-in-depth, not a guarantee — do not feed it
  data you are not authorised to process.
- Keep secrets in environment variables or a secret manager, never in chunk
  text, config files, or examples.
