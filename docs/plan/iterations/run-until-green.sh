#!/bin/sh
# Runs the implementer in OpenCode, round after round, until verify-done.sh prints 0 FAIL.
# Then it takes the README screenshots, pushes a release branch and creates a DRAFT GitHub release.
# The owner publishes the draft. The loop never pushes main and never publishes.
# The loop decides when the work is over. The agent cannot stop it by reporting.
#
# One command, from the repo root:   sh docs/plan/iterations/run-until-green.sh
# Options (env): MAX=25 rounds, CONTAINER_UI_MODEL=<opencode model id>, DRY_RUN=1 (print push and gh, do not run them)
# Results: .tw-loop/DONE.txt (what happened, in plain words) and .tw-loop/round-<n>.log.

MAX="${MAX:-${1:-25}}"
MODEL="${CONTAINER_UI_MODEL:-openrouter/nvidia/nemotron-3.5-super-vl:free}"
START="tw-base"    # the commit before the migration: tsc was 0 here (checked 2026-11-16)
GUARD="tw-guard"   # the commit that added these files: nothing guarded may change after it
LOGDIR=".tw-loop"
VERIFY="docs/plan/iterations/verify-done.sh"
GUARDED="docs/plan/iterations/verify-done.sh docs/plan/iterations/verify-tailwind.sh docs/plan/iterations/verify-iteration-2.sh docs/plan/iterations/run-until-green.sh docs/plan/iterations/tailwind-migration.md docs/plan/iterations/PROMPT-tailwind.md scripts/lib scripts/readme-shots.mjs"
mkdir -p "$LOGDIR"
say() { echo "$1"; echo "$1" >>"$LOGDIR/DONE.txt"; }
: >"$LOGDIR/DONE.txt"

for t in "$START" "$GUARD"; do
  git rev-parse -q --verify "refs/tags/$t" >/dev/null || { say "STOP: missing git tag $t"; exit 2; }
done
if ! curl -s -o /dev/null http://localhost:4173/; then
  npm run preview >"$LOGDIR/preview.log" 2>&1 &
  sleep 8
fi

# Facts the agent cannot argue with, written before each round into fails.txt.
facts() {
  echo "== Facts from the loop (true, checked by a script; do not argue with them) =="
  dirty=$(git status --porcelain | grep -v "^?? $LOGDIR/")
  if [ -n "$dirty" ]; then
    echo "FAIL main has uncommitted changes. Commit them on a wo-tw branch and merge, or restore them:"
    echo "$dirty" | sed 's/^/  /'
  fi
  npx tsc --noEmit >"$LOGDIR/tsc.txt" 2>&1
  if [ -s "$LOGDIR/tsc.txt" ]; then
    echo "FAIL npx tsc --noEmit has errors. tsc printed 0 errors at tag $START, so every error below was made after it:"
    sed 's/^/  /' "$LOGDIR/tsc.txt" | head -20
    for f in $(grep -oE '^src/[^()]+' "$LOGDIR/tsc.txt" | sort -u); do
      echo "  $f changed since $START only in: $(git log --format='%h %s' "$START"..main -- "$f" | cut -c1-70 | tr '\n' ';')"
    done
    echo "  Never call these 'pre-existing'. Fix them first: nothing else can pass while the app does not compile."
  fi
  if ! node scripts/check-tw-classes.mjs >"$LOGDIR/classes.txt" 2>&1; then
    echo "FAIL classes that produce no CSS (each renders unstyled). First place of each, up to 80:"
    grep '^unknown class' "$LOGDIR/classes.txt" | head -80 | sed 's/^/  /'
    grep -q '^unknown class' "$LOGDIR/classes.txt" || sed 's/^/  /' "$LOGDIR/classes.txt" | tail -15
  fi
}

round=1; stall=0; apierr=0
while [ "$round" -le "$MAX" ]; do
  if ! git diff --quiet "$GUARD" -- $GUARDED scripts/check-*.mjs; then
    say "STOP: a guarded file changed since $GUARD (the agent edited a check):"; git diff --stat "$GUARD" -- $GUARDED scripts/check-*.mjs | tee -a "$LOGDIR/DONE.txt"
    exit 3
  fi
  [ "$(git branch --show-current)" = "main" ] || git switch -q main 2>/dev/null

  sh "$VERIFY" >"$LOGDIR/verify.txt" 2>&1
  total=$(tail -1 "$LOGDIR/verify.txt")
  say "round $round: $total"
  if grep -q '^0 FAIL\|, 0 FAIL$' "$LOGDIR/verify.txt" && [ -z "$(git status --porcelain | grep -v "^?? $LOGDIR/")" ]; then
    say "GREEN after $((round - 1)) rounds."; break
  fi

  { facts; echo; echo "== FAIL lines from $VERIFY =="; grep '^FAIL ' "$LOGDIR/verify.txt"; } >"$LOGDIR/fails.txt"
  head_before=$(git rev-parse main)
  opencode run --auto -m "$MODEL" --title "container-ui tailwind round $round" \
    -f docs/plan/iterations/PROMPT-tailwind.md -f "$LOGDIR/fails.txt" \
    "Round $round of $MAX. Verify says: $total. Read the attached fails.txt: the Facts section first, then the FAIL lines. Follow the attached prompt. Work until your context runs low, merge what you finished with --no-ff, then end. The loop runs the checks again and starts the next round." \
    >"$LOGDIR/round-$round.log" 2>&1

  # A round that never reached the model is not a round: retry once, then stop with the reason.
  if grep -qiE 'model unavailable|rate limit|429|quota|insufficient credits|unauthorized|ECONNRESET' "$LOGDIR/round-$round.log"; then
    apierr=$((apierr + 1))
    say "round $round: model or API error: $(grep -iE 'model unavailable|rate limit|429|quota|insufficient|unauthorized|ECONNRESET' "$LOGDIR/round-$round.log" | head -1 | cut -c1-160)"
    [ "$apierr" -ge 3 ] && { say "STOP: 3 model or API errors. Set CONTAINER_UI_MODEL to a working id (opencode models) and run again."; exit 4; }
    sleep 90; continue
  fi
  apierr=0
  if [ "$(git rev-parse main)" = "$head_before" ]; then stall=$((stall + 1)); else stall=0; fi
  [ "$stall" -ge 3 ] && { say "STOP: 3 rounds in a row merged nothing into main. See $LOGDIR/round-$round.log."; exit 5; }
  round=$((round + 1))
done
grep -q '^0 FAIL\|, 0 FAIL$' "$LOGDIR/verify.txt" || { say "NOT GREEN after $MAX rounds. Last: $(tail -1 "$LOGDIR/verify.txt")"; exit 1; }

# ===== Release: run by the loop, never by the agent =====
VER=$(node -p 'require("./package.json").version')
BR="release/v$VER"
run() { if [ -n "$DRY_RUN" ]; then say "DRY_RUN would run: $*"; else "$@"; fi; }

if git ls-files --error-unmatch private.key >/dev/null 2>&1; then
  say "STOP before release: private.key is tracked by git (and is on origin/main). The owner must decide: remove it from the repo and rotate the signing key. The app is green; only the release waits."
  exit 6
fi

git switch -q -c "$BR" main || git switch -q "$BR"
node scripts/readme-shots.mjs >"$LOGDIR/readme-shots.log" 2>&1 || { say "STOP: readme-shots.mjs failed, see $LOGDIR/readme-shots.log"; git switch -q main; exit 7; }
if ! git diff --quiet -- docs/screenshots; then
  git add docs/screenshots && git commit -q -m "docs: retake README screenshots for v$VER"
  say "README screenshots retaken: $(git diff --name-only HEAD~1 -- docs/screenshots | tr '\n' ' ')"
else
  say "README screenshots: unchanged by the retake (the look did not change)."
fi
sh "$VERIFY" >"$LOGDIR/verify-release.txt" 2>&1 || { say "STOP: verify failed on $BR after the screenshots: $(tail -1 "$LOGDIR/verify-release.txt")"; exit 8; }

DMG=""
if npm run tauri build >"$LOGDIR/tauri-build.log" 2>&1; then
  DMG=$(ls -t src-tauri/target/release/bundle/dmg/*.dmg 2>/dev/null | head -1)
  say "tauri build ok: ${DMG:-no dmg found}"
else
  say "tauri build failed (see $LOGDIR/tauri-build.log); the draft release has no installer attached."
fi

GH_TOKEN=$(gh auth token --user BitVerseNomad); export GH_TOKEN   # the account that owns the repo
run git push -u origin "$BR"
run gh release create "v$VER" --draft --target "$BR" --title "OpenPier v$VER" \
  --notes-file docs/plan/iterations/pr/release-notes.md $DMG
git switch -q main
say "DONE: branch $BR pushed, draft release v$VER created. Open it on GitHub, check it, press Publish. Merge $BR into main when happy."
exit 0
