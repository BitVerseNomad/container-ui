#!/bin/sh
# Runs every check (scripts/check-*.mjs) in Chromium and in WebKit (the engine the app ships with).
# Starts the preview (npm run preview, http://localhost:4173) if it is not already running, and stops it at the end.
# A script that crashes counts as failed, not as "0 FAIL lines".
# One engine only: PW_ENGINES=webkit sh scripts/check-all.sh
cd "$(dirname "$0")/.." || exit 1
url="${PREVIEW_URL:-http://localhost:4173/}"
started=""
if ! curl -s -o /dev/null "$url"; then
  port=$(echo "$url" | sed -E "s#.*:([0-9]+).*#\1#")
  npx vite --config vite.preview.config.ts --port "$port" --strictPort >/tmp/container-ui-preview.log 2>&1 &
  started=$!
  i=0
  until curl -s -o /dev/null "$url"; do
    i=$((i + 1))
    if [ "$i" -gt 60 ]; then echo "FAIL the preview did not start; see /tmp/container-ui-preview.log"; kill "$started" 2>/dev/null; exit 1; fi
    sleep 1
  done
fi
trap '[ -n "$started" ] && kill "$started" 2>/dev/null' EXIT
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