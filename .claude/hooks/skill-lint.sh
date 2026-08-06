#!/usr/bin/env bash
# Claude hook compatibility wrapper. The shared implementation lives in
# bin/skill-lint so Claude and Codex enforce the same skill rules.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec "$ROOT/bin/skill-lint" "$@"
