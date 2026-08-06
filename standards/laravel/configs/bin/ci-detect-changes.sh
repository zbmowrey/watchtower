#!/usr/bin/env sh
# ci-detect-changes — classify what a PR changed so CI can skip the steps that
# have nothing to test. Emits boolean flags (true|false) to $GITHUB_ENV and
# $GITHUB_OUTPUT (whichever are set) and a human summary to stderr. Each step in
# ci.yml / build-check.yml then guards itself with `if: env.<flag> == 'true'`.
#
# Pure POSIX sh + git/grep — no language runtime required (CI or a git hook).
#
# FAIL-SAFE — the cardinal rule: every flag DEFAULTS TO TRUE. A flag is narrowed
# to false ONLY when we hold a trustworthy diff against the PR's merge-base. Any
# uncertainty (manual run, unreachable merge-base, git error) leaves the flags
# all-true, i.e. run everything. A detection bug must never SILENTLY SKIP a real
# check — over-running is cheap, a green-but-untested merge is not.
#
# Run AFTER a checkout that has the branch tip AND origin/<default> reachable:
#   git clone --depth 100 --branch "$REF" <repo> .
#   git fetch --depth 100 origin main:refs/remotes/origin/main
#
# Cross-language coupling (why some flags span PHP and JS):
#   - static_js (tsc/eslint/knip) includes PHP changes: Wayfinder generates the
#     TS under @/routes & @/actions FROM PHP routes/controllers/FormRequests, and
#     those generated files are exactly what tsc/eslint/knip resolve. A PHP route
#     rename MUST re-run the JS type check or it breaks main silently.
#   - vitest (tests_js) does NOT include PHP: a PHP change cannot alter JS unit
#     behaviour, and a Wayfinder import break is already caught by static `tsc`
#     and by the tests job's `npm run build`.
#
# The derived flag vars are produced and consumed dynamically in the emit loop
# (`eval "v=\$$k"`), which shellcheck can't trace — silence the false positives.
# shellcheck disable=SC2034,SC2154
set -u

DEFAULT_BRANCH="${CI_DEFAULT_BRANCH:-main}"

# ---- safe defaults: run everything ----
php=true js=true composer=true node=true docker=true ci=true allrun=true

# narrow() — recompute the granular flags from a TRUSTED changed-file list ($FILES).
# Only ever called once we are confident the diff is real.
narrow() {
  php=false js=false composer=false node=false docker=false ci=false allrun=false

  m() { printf '%s\n' "$FILES" | grep -Eq "$1"; }

  # PHP: any .php, the app source roots, or a PHP tool's config
  m '\.php$'                                              && php=true
  m '^(app|bootstrap|config|database|routes|tests|lang)/' && php=true
  m '(^|/)(phpstan[^/]*\.neon(\.dist)?|phpmd\.xml|phpmd\.baseline\.xml|pint\.json|psalm\.xml(\.dist)?|psalm-baseline\.xml|phpstan-baseline\.neon|phpunit\.xml(\.dist)?|rector\.php)$' && php=true

  # Composer dependency manifests
  m '^composer\.(json|lock)$' && composer=true

  # npm dependency manifests
  m '^package(-lock)?\.json$' && node=true

  # JS/TS/CSS source under resources/, or a JS tool's config
  m '^resources/.*\.(ts|tsx|js|jsx|mjs|cjs|vue|css|scss)$' && js=true
  m '(^|/)(eslint\.config\.(js|ts|mjs|cjs)|\.eslintrc[^/]*|\.prettierrc[^/]*|prettier\.config\.(js|cjs|mjs)|tsconfig[^/]*\.json|jsconfig\.json|vite\.config\.(js|ts)|vitest\.config\.(js|ts)|knip\.(json|jsonc|ts|js)|components\.json|tailwind\.config\.(js|ts)|postcss\.config\.(js|cjs))$' && js=true

  # Container build
  m '(^|/)Dockerfile([.-][^/]*)?$' && docker=true
  m '^\.dockerignore$'             && docker=true
  m '^compose\.ya?ml$'            && docker=true
  m '^docker/'                     && docker=true

  # CI workflows + the bin/ tooling scripts. A change here can alter how anything
  # runs, so it forces a full run (allrun) below — we can't reason about its blast radius.
  m '^\.forgejo/' && ci=true
  m '^bin/'       && ci=true
  [ "$ci" = true ] && allrun=true
}

# Self-test: `ci-detect-changes.sh --classify <<<'path1\npath2'` prints the
# granular flags for a given file list (no git). Used by the bin self-tests and
# handy for debugging a CI classification by hand.
if [ "${1:-}" = "--classify" ]; then
  FILES="$(cat)"
  narrow
  echo "php=$php js=$js composer=$composer node=$node docker=$docker ci=$ci allrun=$allrun"
  exit 0
fi

# ---- attempt to narrow from the real PR diff; otherwise keep the all-true safe default ----
if [ "${GITHUB_EVENT_NAME:-}" = "pull_request" ]; then
  base_ref="origin/${DEFAULT_BRANCH}"
  BASE="$(git merge-base "$base_ref" HEAD 2>/dev/null || true)"
  if [ -z "$BASE" ]; then
    # deepen once and retry before giving up to the fail-safe
    git fetch --quiet --deepen=300 origin "${DEFAULT_BRANCH}:refs/remotes/origin/${DEFAULT_BRANCH}" 2>/dev/null || true
    git fetch --quiet --deepen=300 origin HEAD 2>/dev/null || true
    BASE="$(git merge-base "$base_ref" HEAD 2>/dev/null || true)"
  fi
  if [ -n "$BASE" ]; then
    # `git diff --name-only` exits 0 whether or not there are differences; a
    # non-zero rc means a real git error -> keep the all-true safe default.
    if FILES="$(git diff --name-only "$BASE" HEAD 2>/dev/null)"; then
      printf 'ci-detect-changes: %d file(s) changed vs %s\n' \
        "$(printf '%s' "$FILES" | grep -c . || true)" "$BASE" >&2
      narrow
    else
      echo "ci-detect-changes: git diff failed — running everything (fail-safe)." >&2
    fi
  else
    echo "ci-detect-changes: no merge-base with origin/${DEFAULT_BRANCH} — running everything (fail-safe)." >&2
  fi
else
  echo "ci-detect-changes: event='${GITHUB_EVENT_NAME:-unknown}' (not a PR) — running everything." >&2
fi

# ---- derive the per-step flags the workflows actually gate on ----
or() { for a in "$@"; do [ "$a" = true ] && { echo true; return; }; done; echo false; }

any_code=$(or "$php" "$js" "$composer" "$node" "$docker" "$ci")

# static job
static_php=$(or "$php" "$composer" "$allrun")                 # pint·phpmd·larastan·psalm·jscpd·baseline-guard
static_js=$(or "$js" "$node" "$php" "$allrun")                # tsc·eslint·knip (Wayfinder-coupled, see header)
static_prettier=$(or "$js" "$allrun")                         # prettier --check resources/
static_composer=$(or "$composer" "$allrun")                   # composer-normalize·composer audit
static_npm_audit=$(or "$node" "$allrun")                      # npm audit
static_setup_composer=$(or "$static_php" "$static_js" "$static_composer")  # composer install + app key
static_setup_npm=$(or "$static_php" "$static_js" "$static_prettier" "$static_npm_audit")  # npm ci (jscpd needs it too)

# tests job
tests_php=$(or "$php" "$composer" "$allrun")                  # pest --coverage·type-coverage
tests_js=$(or "$js" "$node" "$allrun")                        # vitest
tests_bundle=$(or "$js" "$node" "$allrun")                    # bundle:check
tests_build=$(or "$tests_php" "$tests_bundle")               # npm run build (manifest for pest, or bundle)
tests_setup_npm=$(or "$tests_build" "$tests_js")             # npm ci (build, or vitest)

# ---- emit ----
KEYS="php js composer node docker ci allrun any_code \
static_php static_js static_prettier static_composer static_npm_audit static_setup_composer static_setup_npm \
tests_php tests_js tests_bundle tests_build tests_setup_npm"

echo "ci-detect-changes: flags ->" >&2
for k in $KEYS; do
  eval "v=\$$k"
  printf '  %-22s %s\n' "$k" "$v" >&2
  [ -n "${GITHUB_ENV:-}" ]    && printf '%s=%s\n' "$k" "$v" >> "$GITHUB_ENV"
  [ -n "${GITHUB_OUTPUT:-}" ] && printf '%s=%s\n' "$k" "$v" >> "$GITHUB_OUTPUT"
done

exit 0
