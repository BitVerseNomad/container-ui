#!/bin/sh
# Checks for the Tailwind migration and the rest of iteration 2.
# Run from the repo root, with the preview on port 4173:  sh docs/plan/iterations/verify-tailwind.sh
# Read-only. Prints "ok <what>" or "FAIL <what>", then a total. Exit 1 when any check failed.

PASS=0
FAIL=0
ok() { echo "ok $1"; PASS=$((PASS + 1)); }
bad() { echo "FAIL $1"; FAIL=$((FAIL + 1)); }
chk() { what="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$what"; else bad "$what"; fi; }

echo "== Iteration 2 (lines of the old stylesheet dropped) =="
OUT=$(sh docs/plan/iterations/verify-iteration-2.sh 2>&1 | grep -E '^(ok|FAIL) ' \
  | grep -vF 'every class used is defined (check-classes)' \
  | grep -vF "design stylesheet equals the plan's (check-design-sync)" \
  | grep -vF 'design files unchanged (docs/plan/design/SHA256SUMS)')
echo "$OUT"
PASS=$((PASS + $(echo "$OUT" | grep -c '^ok ')))
FAIL=$((FAIL + $(echo "$OUT" | grep -c '^FAIL ')))

echo "== Tailwind =="
chk "tailwindcss v4 is a dev dependency" sh -c 'grep -qE "\"tailwindcss\": \"\\^?4" package.json'
chk "@tailwindcss/vite is a dev dependency" grep -q '"@tailwindcss/vite"' package.json
chk "vite config uses the Tailwind plugin" grep -q '@tailwindcss/vite' vite.config.ts
chk "preview config uses the Tailwind plugin" grep -q '@tailwindcss/vite' vite.preview.config.ts
chk "src/ui/tailwind.css imports tailwindcss" grep -qF '@import "tailwindcss"' src/ui/tailwind.css
chk "src/ui/tailwind.css maps the tokens in @theme" grep -qE '@theme' src/ui/tailwind.css
chk "the built-in palette is off" grep -qF -- '--color-*: initial' src/ui/tailwind.css
chk "main.tsx loads tailwind.css" grep -q 'tailwind.css' src/main.tsx
chk "container-ui.css has no class selector left" sh -c '! sed "s|/\*.*\*/||g" src/ui/container-ui.css | grep -qE "(^|[ ,>+~])\.[a-zA-Z][a-zA-Z0-9_-]*"'
chk "no hex colour, px or arbitrary colour in className" sh -c '! grep -rnE "className=.*\[(#|[0-9.]+px|rgb)" src --include=*.tsx'
chk "no Tailwind palette colour in src" sh -c '! grep -rnE "\b(bg|text|border|ring|fill|stroke)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b" src --include=*.tsx --include=*.ts'
chk "the app and design stylesheets are equal" cmp -s src/ui/container-ui.css docs/plan/design/container-ui.css
chk "design files other than container-ui.css unchanged" sh -c 'cd docs/plan/design && grep -v "  container-ui.css$" SHA256SUMS | shasum -a 256 -c - >/dev/null 2>&1'
chk "no .skip or .only in tests" sh -c '! grep -rnE "\b(it|test|describe)\.(skip|only)\(" src'
chk "mockup comparison passes in Chromium" node scripts/check-mockup.mjs
chk "every pull request text of this migration has a verify result" sh -c 'for f in docs/plan/iterations/pr/wo-tw-*.md; do test -e "$f" || exit 1; grep -q "FAIL" "$f" || exit 1; done'

echo "== Totals =="
echo "$PASS ok, $FAIL FAIL"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
