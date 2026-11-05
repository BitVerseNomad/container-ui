#!/bin/sh
# Runs every UI check against the built preview, in Chromium and in WebKit (the engine the app ships with).
# A script that crashes counts as failed, not as "0 FAIL lines". Needs playwright resolvable (NODE_PATH).
# Build first: npm run preview. One engine only: PW_ENGINES=webkit sh scripts/check-all.sh
cd "$(dirname "$0")/.." || exit 1
bad=0
for engine in ${PW_ENGINES:-chromium webkit}; do
  echo "== $engine"
  for f in scripts/check-*.mjs; do
    out=$(PW_ENGINE=$engine node "$f" 2>&1); code=$?
    n=$(printf '%s\n' "$out" | grep -c '^FAIL')
    if [ "$code" -ne 0 ] && [ "$n" -eq 0 ]; then n=crashed; fi
    echo "$engine $f: $n"
    printf '%s\n' "$out" | grep -E '^FAIL|Error' | head -5
    [ "$n" = 0 ] || bad=1
  done
done
exit $bad
