# Packaging

Run `npm run release:check` from the repo root. It first executes `scripts/doctor.sh` as the enforced public/private boundary check, then installs from lockfile, builds, tests, and produces an npm tarball in `/tmp`.
