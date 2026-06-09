# Release Candidate Runbook

Target tag: `v0.2.0-rc.1`
Package version: `0.2.0-rc.1`

## Gates

1. `npm ci`
2. `npm run build`
3. `npm test`
4. `npm run release:check`
5. Opus audit returns `NO_BLOCKERS`
6. Codex audit returns `NO_BLOCKERS`, or the release notes explicitly record a local Codex auth blocker and the scheduled remediation.
7. `npm pack --dry-run` confirms only public SDK/docs are included.

## Publish policy

Creating the GitHub RC is safe once the gates pass. `npm publish --tag rc` is a separate public distribution step and should only be run after Jose explicitly confirms publication.
