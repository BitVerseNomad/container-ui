#!/bin/sh
# The done gate for the Tailwind migration and the release. Written by the planner, guarded by the loop.
# Run from the repo root, with the preview on port 4173:  sh docs/plan/iterations/verify-done.sh
# Read-only. Prints "ok <what>" or "FAIL <what>", then a total. Exit 1 when any check failed.
# It runs verify-tailwind.sh, then adds what that script missed in round 2:
#   classes that produce no CSS, arbitrary var() colours, a build that fails, and the release files.

PASS=0
FAIL=0
ok() { echo "ok $1"; PASS=$((PASS + 1)); }
bad() { echo "FAIL $1"; FAIL=$((FAIL + 1)); }
chk() { what="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$what"; else bad "$what"; fi; }
EMDASH=$(printf '\342\200\224')

OUT=$(sh docs/plan/iterations/verify-tailwind.sh 2>&1 | grep -E '^(ok|FAIL) ')
echo "$OUT"
PASS=$((PASS + $(echo "$OUT" | grep -c '^ok ')))
FAIL=$((FAIL + $(echo "$OUT" | grep -c '^FAIL ')))

echo "== It builds and the tests pass =="
chk "gate: npx tsc --noEmit (exit 0)" npx tsc --noEmit
chk "gate: npm run build" npm run build
chk "gate: every unit test passes (npx vitest run)" npx vitest run

echo "== Tailwind, the holes of round 2 =="
chk "every class in src produces CSS (check-tw-classes)" node scripts/check-tw-classes.mjs
chk "no arbitrary var() value in src: use the mapped name (text-warn, not text-[var(--warn)])" \
  sh -c '! grep -rnE "\[var\(--" src --include="*.tsx" --include="*.ts"'
chk "every :root token of openpier.css has a mapping in tailwind.css @theme" sh -c '
  for t in $(sed -n "/^:root *{/,/^}/p" src/ui/openpier.css | grep -oE "^ *--[a-z0-9-]+" | tr -d " "); do
    grep -qF "var($t)" src/ui/tailwind.css || { echo "unmapped $t"; exit 1; }
  done'

echo "== WO-TW-6 the plan says Tailwind =="
chk "04-design-spec.md names src/ui/tailwind.css" grep -q 'src/ui/tailwind.css' docs/plan/04-design-spec.md
chk "HANDOFF.md names src/ui/tailwind.css" grep -q 'src/ui/tailwind.css' docs/plan/HANDOFF.md

echo "== WO-TW-7 release text =="
VER=$(node -p 'require("./package.json").version' 2>/dev/null)
chk "version is raised above 0.2.1 (package.json)" sh -c "[ \"$VER\" != 0.2.1 ] && [ -n \"$VER\" ]"
chk "versions agree (check-version-sync)" node scripts/check-version-sync.mjs
chk "CHANGELOG.md has a section for $VER" grep -qE "^## (v)?$VER\b" CHANGELOG.md
chk "CHANGELOG.md has no Unreleased section left" sh -c '! grep -q "^## Unreleased" CHANGELOG.md'
chk "README.md mentions Tailwind" grep -qi 'tailwind' README.md
chk "every image the README shows exists" sh -c '
  for p in $(grep -oE "\]\(([^)]+\.(png|jpg|gif|svg))\)" README.md | sed -E "s/^\]\(//; s/\)$//"); do
    case "$p" in http*) continue;; esac; test -e "$p" || { echo "missing $p"; exit 1; }
  done'
chk "release notes exist (docs/plan/iterations/pr/release-notes.md)" test -s docs/plan/iterations/pr/release-notes.md
chk "no em dash in the new CHANGELOG section, README, release notes or wo-tw texts" sh -c \
  '{ awk -v v="$2" "/^## /{on=(\$0 ~ \"^## v?\" v)} on" CHANGELOG.md; cat README.md docs/plan/iterations/pr/release-notes.md docs/plan/iterations/pr/wo-tw-*.md; } 2>/dev/null | grep -q "$1" && exit 1; exit 0' sh "$EMDASH" "$VER"

echo "== Totals =="
echo "$PASS ok, $FAIL FAIL"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
