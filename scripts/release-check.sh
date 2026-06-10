#!/usr/bin/env bash
#
# Context Fabric (public) — full release gate.
#
# Runs every merge gate end-to-end (doctor, clean install, lint, format,
# build, tests, public benchmark) and then proves the *published artifact*
# works: `npm pack` -> install the tarball into a fresh temp project -> run
# the installed `context-fabric` bin. Catches shebang/bin/files-field
# regressions that unit tests over dist/ can never see. Fully offline for the
# smoke: the SDK has zero runtime dependencies.
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1m== release-check: %s ==\033[0m\n' "$1"; }
die()  { echo "release-check: $1" >&2; exit 1; }

step "boundary doctor"
bash scripts/doctor.sh

step "clean install"
npm ci

step "lint + format"
npm run lint
npm run format:check

step "build + test"
npm run build
npm test

step "public benchmark gate"
npm run benchmark -- artifacts/benchmarks

step "npm pack -> fresh install -> installed bin smoke"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

PACK_JSON="$(npm pack --json --workspace @context-fabric/sdk --pack-destination "$WORK_DIR")"

# The tarball must carry the license, the compiled entrypoints, and the bin.
TARBALL_NAME="$(node -e '
  const pack = JSON.parse(process.argv[1]);
  const paths = pack[0].files.map((f) => f.path);
  for (const required of ["LICENSE", "README.md", "package.json", "dist/src/cli.js", "dist/src/index.js"]) {
    if (!paths.includes(required)) {
      console.error(`release-check: tarball is missing ${required}`);
      process.exit(1);
    }
  }
  process.stdout.write(pack[0].filename);
' "$PACK_JSON")"
TARBALL="$WORK_DIR/$TARBALL_NAME"
[ -f "$TARBALL" ] || die "expected tarball at $TARBALL"

APP_DIR="$WORK_DIR/app"
mkdir -p "$APP_DIR"
printf '{"name":"cf-release-smoke","version":"0.0.0","private":true}\n' > "$APP_DIR/package.json"
( cd "$APP_DIR" && npm install --no-audit --no-fund --loglevel=error "$TARBALL" >/dev/null )

BIN="$APP_DIR/node_modules/.bin/context-fabric"
[ -x "$BIN" ] || die "installed bin is missing or not executable: $BIN"

"$BIN" --version | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' || die "installed bin --version output unexpected"
"$BIN" --help | grep -q 'Usage: context-fabric <command>' || die "installed bin --help output unexpected"
"$BIN" doctor | grep -q '^OK: config version=' || die "installed bin doctor output unexpected"

# Assemble smoke from the installed bin: the fail-closed default ceiling must
# admit only the public chunk.
cat > "$APP_DIR/chunks.json" <<'JSON'
[
  { "id": "pub", "text": "Acme Shop public note.", "project": "acme-shop", "sensitivity": "public", "score": 1 },
  { "id": "int", "text": "Acme Shop internal note.", "project": "acme-shop", "sensitivity": "internal", "score": 2 }
]
JSON
( cd "$APP_DIR" && "$BIN" assemble --query note --project acme-shop --chunks chunks.json > bundle.json )
node -e '
  const bundle = require(process.argv[1]);
  const ids = bundle.chunks.map((c) => c.id).join(",");
  if (ids !== "pub") {
    console.error(`release-check: assemble must admit only the public chunk; got: ${ids}`);
    process.exit(1);
  }
' "$APP_DIR/bundle.json"

# The shipped cli.js must keep its shebang as the very first bytes.
head -c 19 "$APP_DIR/node_modules/@context-fabric/sdk/dist/src/cli.js" \
  | grep -q '^#!/usr/bin/env node' || die "installed cli.js lost its shebang"

printf '\n\033[32mrelease-check: all gates passed\033[0m\n'
