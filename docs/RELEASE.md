# Release process

`@context-fabric/sdk` follows [Semantic Versioning](https://semver.org/).
Pre-1.0, minor versions may carry breaking changes; they are called out in the
changelog.

## Versioning

- `MAJOR.MINOR.PATCH`. The source of truth is `version` in
  `packages/sdk/package.json`. The root `package.json` version tracks it.

## Pre-release checklist

- [ ] `make ci` is green locally (doctor + install + build + test).
- [ ] CI is green on `main`.
- [ ] `CHANGELOG.md` has a dated section for the new version; `Unreleased` is
      moved into it.
- [ ] `version` in `packages/sdk/package.json` matches the new tag.
- [ ] `make doctor` passes (no secrets, no operator data, no core dependency).
- [ ] `README` examples still run against the current API.

## Cutting a release

```bash
# 1. Bump version in packages/sdk/package.json (and root package.json)
# 2. Update CHANGELOG.md (move Unreleased -> X.Y.Z with today's date)
git commit -am "chore: release vX.Y.Z"
git tag -a vX.Y.Z -m "context-fabric vX.Y.Z"

# 3. Build and verify the package contents before publishing
cd packages/sdk
npm ci
npm run build
npm pack --dry-run        # inspect the tarball file list
```

## Publishing (when enabled)

The package is MIT-licensed and intended for npm. Publishing is **manual** and
gated on a green release:

```bash
cd packages/sdk
npm publish --access public
```

> Note: `dist/` is git-ignored and built fresh by CI/release; only the built
> output and `README.md` are included in the published tarball (see the `files`
> field in `packages/sdk/package.json`).

## Post-release

- [ ] Push the tag once approved: `git push origin vX.Y.Z`.
- [ ] Create a GitHub release from the tag with the changelog section.
- [ ] Open a fresh `Unreleased` section in `CHANGELOG.md`.
