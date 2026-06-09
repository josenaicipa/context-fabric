# CLAUDE.md — context-fabric (public)

Public client/team repository for Context Fabric. Safe to open-source. Read
this before editing.

## Product boundary

- **This repo** is public: the TypeScript SDK/CLI (`packages/sdk`), docs,
  generic examples, and templates.
- **Private counterpart**: `../context-fabric-core` holds the proprietary
  engine and any operator-specific data. It is **not** public.
- Canonical separation rules live in [`boundary.manifest.json`](./boundary.manifest.json).

## Hard rules (non-negotiable)

1. **No private data, ever.** No private operator/client project names, channel maps,
   customer/lead data, or internal notes. Every example uses fictional scopes
   from the allowlist: `acme-shop`, `other-co`, `demo`, `example`.
2. **No secrets.** No credentials, tokens, API keys, service-account JSON, or
   `.env` contents — not in source, docs, examples, or tests.
3. **No dependency on the private core.** No package here may import or vendor
   `context-fabric-core`. The SDK is a clean-room implementation.
4. **One-way flow.** Code is ported *into* this repo only after manual review
   confirms it carries no private data or IP. Nothing auto-syncs.

## Layout

```
packages/sdk/      TypeScript SDK + CLI (clean-room, zero deps)
docs/              sanitized public docs
examples/          generic runnable chunk corpus + config
templates/         starter configs and integration snippets
boundary.manifest.json   machine-readable separation policy
```

## Commands

```bash
cd packages/sdk
npm install
npm run build        # tsc -> dist/
npm test             # build + node --test
```

## Before committing

- [ ] No real project/channel/customer names (use the allowlist scopes).
- [ ] No secrets (grep for keys/tokens/emails/.env).
- [ ] No import of `context-fabric-core` anywhere.
- [ ] `npm test` is green in `packages/sdk`.
- [ ] New examples/templates are generic and self-explanatory.
