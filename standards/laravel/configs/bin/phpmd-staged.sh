#!/usr/bin/env sh
# phpmd-staged — run phpmd on ONLY the files lint-staged hands us (the staged *.php),
# not the whole app. lint-staged passes each path as a separate argument; phpmd wants
# them as a SINGLE comma-separated argument (space-separated makes it read the 2nd path
# as the report format and error), so we join here. We also drop the same paths ci.yml's
# `composer md` excludes — Filament panels + Domain/*/Data DTOs — so a staged file there
# can't trip a check the CI run would skip (divergence-proofing). Every rule in phpmd.xml
# is intra-file (complexity, npath, code-size, unused-private, naming, cleancode), so the
# verdict on just these files is identical to a full run's verdict for them — sound to scope.
#
# Pure POSIX sh. Runs INSIDE the vite container via .husky/pre-commit (see
# [[pre-commit-hooks]]); cwd is the repo root, so phpmd.xml + the vendor-bin path resolve.
#
#   phpmd-staged.sh <file.php> [file.php ...]
set -e

root=$(pwd)

list=
for f in "$@"; do
  # lint-staged hands us ABSOLUTE paths, but every prefix match below is
  # repo-relative. Without this, each path fell through to `continue`, the list
  # came out empty, and the hook exited 0 without ever invoking phpmd — a green
  # gate that checked nothing, so complexity violations reached CI instead.
  case "$f" in
    "$root"/*) f=${f#"$root"/} ;;
  esac
  case "$f" in
    # composer md scans `app` ONLY — a staged file outside it (seeders,
    # migrations, tests) must not trip a check the CI run would skip.
    app/*) ;;
    *)                 continue ;;
  esac
  case "$f" in
    */Filament/*)      continue ;;
    */Domain/*/Data/*) continue ;;
  esac
  if [ -z "$list" ]; then list="$f"; else list="$list,$f"; fi
done

# Nothing left after the carve-outs → clean, don't invoke phpmd.
[ -z "$list" ] && exit 0

exec php -d error_reporting=24575 vendor-bin/phpmd/vendor/bin/phpmd "$list" ansi phpmd.xml
