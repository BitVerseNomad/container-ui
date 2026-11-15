#!/bin/sh
# Runs the implementer in OpenCode, round after round, until verify-tailwind.sh prints 0 FAIL.
# The loop decides when the work is over. The agent cannot stop it by reporting.
# Run from the repo root:  sh docs/plan/iterations/run-until-green.sh [max_rounds]
# Needs: npm run preview on port 4173 (the loop starts it when the port is free).

MAX="${1:-15}"
MODEL="${OPENPIER_MODEL:-nvidia/nemotron-3.5-super-vl-120b-a12b#thinking}"
BASE="tw-base"   # git tag set by the planner on the commit that added these files
LOGDIR=".tw-loop"
GUARDED="docs/plan/iterations/verify-tailwind.sh docs/plan/iterations/verify-iteration-2.sh docs/plan/iterations/run-until-green.sh docs/plan/iterations/tailwind-migration.md docs/plan/iterations/PROMPT-tailwind.md scripts/lib"
mkdir -p "$LOGDIR"

if ! git rev-parse -q --verify "refs/tags/$BASE" >/dev/null; then echo "missing tag $BASE"; exit 2; fi

if ! curl -s -o /dev/null http://localhost:4173/; then
  npm run preview >"$LOGDIR/preview.log" 2>&1 &
  sleep 5
fi

round=1
while [ "$round" -le "$MAX" ]; do
  if ! git diff --quiet "$BASE" -- $GUARDED scripts/check-*.mjs; then
    echo "STOP: a guarded file changed since $BASE:"; git diff --stat "$BASE" -- $GUARDED scripts/check-*.mjs
    exit 3
  fi
  if [ "$(git branch --show-current)" != "main" ]; then git switch -q main 2>/dev/null; fi

  sh docs/plan/iterations/verify-tailwind.sh >"$LOGDIR/verify.txt" 2>&1
  total=$(tail -1 "$LOGDIR/verify.txt")
  echo "round $round: $total"
  if grep -q '^0 FAIL\|, 0 FAIL$' "$LOGDIR/verify.txt"; then
    echo "GREEN after $((round - 1)) rounds."; exit 0
  fi

  grep '^FAIL ' "$LOGDIR/verify.txt" >"$LOGDIR/fails.txt"
  opencode run --auto -m "$MODEL" --title "openpier tailwind round $round" \
    -f docs/plan/iterations/PROMPT-tailwind.md -f "$LOGDIR/fails.txt" \
    "Round $round of $MAX. Verify says: $total. The FAIL lines are attached (fails.txt). Follow the attached prompt. Work until your context runs low, merge what you finished with --no-ff, then end. The loop runs the verify again and starts the next round." \
    >"$LOGDIR/round-$round.log" 2>&1
  round=$((round + 1))
done
echo "NOT GREEN after $MAX rounds. Last: $(tail -1 "$LOGDIR/verify.txt")"
exit 1
