#!/usr/bin/env bash
# App checks, quiet: one line each when they pass, details only when they fail.
#   npm run check
set -uo pipefail
cd "$(dirname "$0")/.."
status=0
if out=$(npx tsc --noEmit 2>&1); then echo "typecheck ok"; else echo "$out"; status=1; fi
out=$(npx expo lint 2>&1 | grep -vE '^env: ')
if echo "$out" | grep -qE '[0-9]+ problems?'; then echo "$out"; status=1; else echo "lint ok"; fi
if out=$(npx jest --silent --reporters=summary 2>&1); then echo "$out" | grep -E '^(Tests|Test Suites):'; else echo "$out"; status=1; fi
exit $status
