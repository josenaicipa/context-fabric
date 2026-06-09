#!/usr/bin/env bash
#
# Context Fabric (public) — boundary & hygiene doctor.
#
# Fails (non-zero exit) if the tree violates the public boundary rules in
# boundary.manifest.json. Runs locally (`make doctor`) and in CI as a merge gate.
#
# Checks:
#   1. boundary       — boundary.manifest.json present, visibility=public
#   2. private-imports— no source depends on / imports the private core
#   3. secrets        — no credential/token/key material in tracked files
#   4. example-scopes — examples/templates use only allowlisted fictional scopes
#   5. operator-data  — no operator/private business data in the tree
#   6. docs           — required docs exist and README relative links resolve
#
# Scans only git-tracked files. Fixtures and the sanitizer (which defines
# detection patterns) are excluded from secret scans by design.
#
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

FAIL=0
section() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }
pass()    { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail()    { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAIL=1; }

if ! command -v git >/dev/null 2>&1; then
  echo "doctor: git is required" >&2
  exit 2
fi

mapfile -t ALL_FILES < <(git ls-files 2>/dev/null)

SECRET_EXCLUDE='^(examples/|templates/|.*/test/|scripts/doctor\.sh$|boundary\.manifest\.json$|SECURITY\.md$|.*sanitizer\.ts$)'
mapfile -t SCAN_FILES < <(printf '%s\n' "${ALL_FILES[@]}" | grep -Ev "$SECRET_EXCLUDE")
mapfile -t CODE_FILES < <(printf '%s\n' "${SCAN_FILES[@]}" | grep -Ev '\.(md|markdown)$')

grep_files() { local pat="$1"; shift; [ "$#" -eq 0 ] && return 1; grep -InE "$pat" "$@" 2>/dev/null; }

# ---- 1. boundary ------------------------------------------------------------
section "Boundary manifest"
if [ ! -f boundary.manifest.json ]; then
  fail "boundary.manifest.json is missing"
elif command -v node >/dev/null 2>&1; then
  if node -e '
    const m = require("./boundary.manifest.json");
    if (m.repo !== "context-fabric") throw new Error("repo name mismatch");
    if (m.visibility !== "public") throw new Error("visibility must be public");
  ' 2>/dev/null; then
    pass "boundary.manifest.json valid (public)"
  else
    fail "boundary.manifest.json failed validation"
  fi
else
  grep -q '"visibility": *"public"' boundary.manifest.json \
    && pass "boundary.manifest.json declares visibility=public" \
    || fail "boundary.manifest.json missing visibility=public"
fi

# ---- 2. private imports -----------------------------------------------------
section "Private core separation"
# Documentation may freely *name* the private repo; only a real import or
# dependency edge is forbidden. Match genuine module syntax (import/require/from
# a quoted specifier, or a package.json dependency key) rather than prose that
# happens to contain the words "import"/"dependencies".
EDGE_PATTERNS=(
  "from[[:space:]]+['\"][^'\"]*context[-_]fabric[-_]core"
  "require\\([[:space:]]*['\"][^'\"]*context[-_]fabric[-_]core"
  "import[[:space:]]+['\"][^'\"]*context[-_]fabric[-_]core"
  "\"context-fabric-core\"[[:space:]]*:"
)
edge_hit=0
for pat in "${EDGE_PATTERNS[@]}"; do
  if hits="$(grep_files "$pat" "${ALL_FILES[@]}")"; then
    edge_hit=1
    fail "source imports/depends on the private core:"
    printf '%s\n' "$hits" | sed 's/^/       /'
  fi
done
[ "$edge_hit" -eq 0 ] && pass "no import/dependency edge to context-fabric-core (doc references allowed)"

# ---- 3. secrets -------------------------------------------------------------
section "Secret material"
HIGH_CONF=(
  'AKIA[0-9A-Z]{16}'
  'ghp_[A-Za-z0-9]{36}'
  'github_pat_[A-Za-z0-9_]{30,}'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  'AIza[0-9A-Za-z_\-]{35}'
  'sk_live_[0-9a-zA-Z]{24,}'
  'sk-[A-Za-z0-9]{32,}'
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  '[Bb]earer[[:space:]]+[A-Za-z0-9._-]{20,}'
)
secret_hit=0
for pat in "${HIGH_CONF[@]}"; do
  if hits="$(grep_files "$pat" "${SCAN_FILES[@]}")"; then
    secret_hit=1
    fail "possible secret matching /$pat/:"
    printf '%s\n' "$hits" | sed 's/^/       /'
  fi
done
GENERIC='(password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)[[:space:]"'"'"']*[:=][[:space:]]*["'"'"'][^"'"'"' ]{12,}'
if hits="$(grep_files "$GENERIC" "${CODE_FILES[@]}")"; then
  secret_hit=1
  fail "possible hardcoded credential assignment:"
  printf '%s\n' "$hits" | sed 's/^/       /'
fi
[ "$secret_hit" -eq 0 ] && pass "no secret signatures in tracked source/config"

# ---- 4. example scopes ------------------------------------------------------
section "Example scope allowlist"
# Allowlisted fictional scopes (mirrors boundary.manifest.json).
ALLOW='acme-shop|other-co|demo|example'
scope_bad=0
mapfile -t EXAMPLE_FILES < <(printf '%s\n' "${ALL_FILES[@]}" | grep -E '^(examples|templates)/.*\.json$')
for f in "${EXAMPLE_FILES[@]}"; do
  # Pull every "project"/"channel" string value and check its base scope.
  while IFS= read -r scope; do
    [ -z "$scope" ] && continue
    base="${scope#\#}"            # strip leading channel '#'
    # Allow allowlisted fictional scopes, or obvious ALL-CAPS placeholders
    # (e.g. YOUR_PROJECT) that templates ask the user to replace.
    if ! printf '%s' "$base" | grep -qE "^($ALLOW)$" \
       && ! printf '%s' "$base" | grep -qE '^[A-Z][A-Z0-9_]*$'; then
      fail "non-allowlisted scope '$scope' in $f"
      scope_bad=1
    fi
  done < <(grep -oE '"(project|channel)"[[:space:]]*:[[:space:]]*"[^"]*"' "$f" \
            | sed -E 's/.*:[[:space:]]*"([^"]*)"/\1/')
done
[ "$scope_bad" -eq 0 ] && pass "examples/templates use only allowlisted scopes ($ALLOW) or ALL_CAPS placeholders"

# ---- 5. operator data -------------------------------------------------------
section "Operator/private data"
OPERATOR='(real[-_](client|customer|lead|operator)[-_][a-z0-9]|production[-_](crm|ads|payments|calendar)[-_][a-z0-9]|private[-_](channel|project|workspace|memory)[-_][a-z0-9])'
mapfile -t BRAND_FILES < <(printf '%s\n' "${ALL_FILES[@]}" | grep -Ev '^(scripts/doctor\.sh$|\.github/CODEOWNERS$)')
if hits="$(grep_files "$OPERATOR" "${BRAND_FILES[@]}")"; then
  fail "operator/private data found in a public file:"
  printf '%s\n' "$hits" | sed 's/^/       /'
else
  pass "no operator/private business data in tracked files"
fi

# ---- 6. docs ----------------------------------------------------------------
section "Public docs"
REQUIRED_DOCS=(
  README.md LICENSE CONTRIBUTING.md SECURITY.md CHANGELOG.md
  docs/concepts.md docs/configuration.md docs/boundary.md
  docs/ARCHITECTURE.md docs/ROADMAP.md docs/DECISIONS.md docs/RELEASE.md
)
docs_bad=0
for d in "${REQUIRED_DOCS[@]}"; do
  [ -f "$d" ] || { fail "missing required doc: $d"; docs_bad=1; }
done
# README relative links must resolve.
while IFS= read -r link; do
  case "$link" in http*|\#*|mailto:*) continue ;; esac
  target="${link%%#*}"
  [ -z "$target" ] && continue
  if [ ! -e "$target" ]; then
    fail "README links to missing path: $link"
    docs_bad=1
  fi
done < <(grep -oE '\]\(([^)]+)\)' README.md | sed -E 's/\]\(([^)]+)\)/\1/')
[ "$docs_bad" -eq 0 ] && pass "required docs present and README links resolve"

# ---- summary ----------------------------------------------------------------
echo
if [ "$FAIL" -eq 0 ]; then
  printf '\033[32mdoctor: all checks passed\033[0m\n'
  exit 0
fi
printf '\033[31mdoctor: checks failed\033[0m\n'
exit 1
