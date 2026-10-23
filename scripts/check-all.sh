#!/bin/sh
# Runs every UI check against the built preview. A script that crashes counts as failed, not as "0 FAIL lines".
# Needs playwright resolvable (NODE_PATH). Build first: npm run preview
cd "$(dirname "$0")/.." || exit 1
bad=0
for f in scripts/check-*.mjs; do
  out=$(node "$f" 2>&1); code=$?
  n=$(printf '%s\n' "$out" | grep -c '^FAIL')
  if [ "$code" -ne 0 ] && [ "$n" -eq 0 ]; then n=crashed; fi
  echo "$f: $n"
  printf '%s\n' "$out" | grep -E '^FAIL|Error' | head -5
  [ "$n" = 0 ] || bad=1
done
exit $bad
