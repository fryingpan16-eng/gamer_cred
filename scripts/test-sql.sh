#!/usr/bin/env bash
# SQL migration tests (Deno + PGlite), quiet: dots, then failures and the totals.
#   npm run test:sql                 all files
#   npm run test:sql -- replays      only files whose name contains "replays"
set -uo pipefail
cd "$(dirname "$0")/../supabase/tests"
DENO=$(command -v deno || echo "npx --yes deno@2.9.6")
files=()
if [ $# -gt 0 ]; then
  for f in *_test.ts; do [[ "$f" == *"$1"* ]] && files+=("$f"); done
  [ ${#files[@]} -eq 0 ] && { echo "No SQL test file matches \"$1\""; exit 1; }
fi
NO_COLOR=1 $DENO test -A --reporter=dot "${files[@]}" 2>&1 | grep -vE '^(Check|Download) |^[.!]*$|^$'
exit "${PIPESTATUS[0]}"
