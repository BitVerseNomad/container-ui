#!/bin/sh
# Checks iteration 1 on the current checkout. Run from the repo root, on main, after the last work order is merged:
#   sh docs/plan/iterations/verify-iteration-1.sh
# It builds and tests. It never touches a container engine and changes nothing outside the repo's build folders.
# Quick mode (skips the gate, only the cheap checks): QUICK=1 sh docs/plan/iterations/verify-iteration-1.sh
cd "$(dirname "$0")/../../.." || exit 1
pass=0; fail=0
ok() { echo "ok   $1"; pass=$((pass + 1)); }
no() { echo "FAIL $1"; fail=$((fail + 1)); }
# t "<what must be true>" <command...>: the command's exit status decides.
t() { what=$1; shift; if "$@" >/dev/null 2>&1; then ok "$what"; else no "$what"; fi; }
# empty "<what>" "<shell that must print nothing>"
empty() { out=$(sh -c "$2" 2>/dev/null); if [ -z "$out" ]; then ok "$1"; else no "$1"; printf '%s\n' "$out" | head -5 | sed 's/^/       /'; fi; }

echo "== the gate"
if [ -z "$QUICK" ]; then
  t "gate: npm run lint" npm run lint
  t "gate: npx tsc --noEmit" npx tsc --noEmit
  t "gate: npm test" npm test
  t "gate: cargo fmt --check" sh -c "cd src-tauri && cargo fmt --check"
  t "gate: cargo clippy -D warnings" sh -c "cd src-tauri && cargo clippy --all-targets -- -D warnings"
  t "gate: cargo test" sh -c "cd src-tauri && cargo test"
  t "gate: npm run check (Chromium and WebKit)" npm run check
  t "gate: npm run build" npm run build
else
  echo "     skipped (QUICK=1)"
fi

echo "== WO-0.0 the gate is green"
t "0.0 eslint-plugin-react-hooks is installed" grep -q '"eslint-plugin-react-hooks"' package.json
empty "0.0 no #[allow] was added" "git diff 0bdafcf -- src-tauri/src | grep -E '^\+' | grep -n '#\[allow'"

echo "== WO-0.2 Lima environments and AI chat removed"
t "0.2 lima.rs is gone" test ! -e src-tauri/src/lima.rs
t "0.2 projects.rs is gone" test ! -e src-tauri/src/projects.rs
t "0.2 migrations are gone" test ! -e src-tauri/migrations
t "0.2 src/features, src/ai, src/shared are gone" sh -c "test ! -e src/features && test ! -e src/ai && test ! -e src/shared"
empty "0.2 no file-reading, token or ollama code in Rust" "grep -rnE 'fs_read_text_file|fs_read_dir|get_gh_token|GH_TOKEN|ollama|lima::|projects::' src-tauri/src"
empty "0.2 no sqlx, tokio, uuid, chrono in Cargo.toml" "grep -nE 'sqlx|tokio|uuid|chrono' src-tauri/Cargo.toml"
empty "0.2 no xterm in package.json" "grep -n 'xterm' package.json"
t "0.2 the app starts on Containers" grep -q 'useState<Tab>("Containers")' src/App.tsx

echo "== WO-0.3 the preview and the checks"
t "0.3 vite.preview.config.ts exists" test -f vite.preview.config.ts
t "0.3 the hand-written bundler is gone" test ! -e scripts/build-preview.mjs
t "0.3 playwright.config.ts is gone" test ! -e playwright.config.ts
t "0.3 scripts/lib/check.mjs exists" test -f scripts/lib/check.mjs
t "0.3 check-start.mjs exists" test -f scripts/check-start.mjs
t "0.3 the mock coverage test exists" test -f src/lib/mockCoverage.test.ts
empty "0.3 no check opens a file:// page" "grep -ln 'file://' scripts/check-*.mjs | grep -v check-mockup.mjs"
pending=$(ls scripts/checks-pending/*.mjs 2>/dev/null | wc -l | tr -d ' ')
rows=$(grep -c '^| `check-' scripts/checks-pending/README.md 2>/dev/null || echo 0)
if [ "$pending" = "$rows" ]; then ok "0.3 checks-pending: $pending files, $rows rows in its README"; else no "0.3 checks-pending: $pending files but $rows rows in its README"; fi
for f in check-entitlements.mjs check-icon.mjs check-version-sync.mjs; do t "0.3 $f was not moved to pending" test -f "scripts/$f"; done
empty "0.3 pending checks were moved, not edited (only the address and storage keys may differ)" "for f in scripts/checks-pending/*.mjs; do [ -e \"\$f\" ] || continue; b=\$(basename \$f); git show 0bdafcf:scripts/\$b 2>/dev/null | sed 's#file://\${root}/preview/index.html#http://localhost:4173/#g; s#colima-ui\\.wayBack#container-ui:wayBack#g; s#colima-ui:compose-folders#container-ui:compose-folders#g' | cmp -s - \$f || echo \"\$b was edited\"; done"

echo "== WO-0.5 the repo root"
empty "0.5 only expected names at the root" "git ls-files | awk -F/ '{print \$1}' | sort -u | grep -vxE '\.github|\.gitignore|AGENTS\.md|CHANGELOG\.md|CONTRIBUTING\.md|README\.md|docs|eslint\.config\.js|index\.html|package-lock\.json|package\.json|preview|scripts|src|src-tauri|test-baselines|tsconfig\.json|vite\.config\.ts|vite\.preview\.config\.ts|vitest\.config\.ts|private\.key|private\.key\.pub'"
empty "0.5 docs holds only plan, research, screenshots" "git ls-files docs | awk -F/ '{print \$2}' | sort -u | grep -vxE 'plan|research|screenshots'"
if git ls-files | grep -qE '\.key(\.pub)?$'; then echo "note the signing key files are still tracked: WO-0.1 is the owner's and is not done"; fi

echo "== WO-0.4 the name"
empty "0.4 no old name outside the migration" "git grep -niE 'wharf|container ui|container-ui|colima-ui|colima_ui' -- . ':!docs' ':!CHANGELOG.md' | grep -vE '^src/lib/migrateStorage(\.test)?\.ts:|^scripts/eval-setup\.sh:'"
t "0.4 identifier is dev.containerui.desktop" grep -q '"identifier": "dev.containerui.desktop"' src-tauri/tauri.conf.json
t "0.4 Cargo package is container-ui" grep -q '^name = "container-ui"' src-tauri/Cargo.toml
t "0.4 REPO_URL exists" grep -q 'https://github.com/BitVerseNomad/container-ui' src/lib/links.ts
t "0.4 migrateStorage is called at startup" grep -q 'migrateStorage(window.localStorage)' src/main.tsx

echo "== WO-0.6 CI"
t "0.6 ci.yml is valid YAML with jobs web and rust" sh -c "ruby -e 'require \"yaml\"; y = YAML.load_file(\".github/workflows/ci.yml\"); exit(y[\"jobs\"].keys.sort == [\"rust\", \"web\"] ? 0 : 1)'"
t "0.6 ci.yml uses Node 22" grep -q 'node-version: 22' .github/workflows/ci.yml

echo "== WO-1.1 one stylesheet"
css=$(find src -name '*.css' | tr '\n' ' ')
if [ "$css" = "src/ui/container-ui.css " ]; then ok "1.1 the only CSS file is src/ui/container-ui.css"; else no "1.1 CSS files found: $css"; fi
t "1.1 the shipped stylesheet equals the design" cmp -s src/ui/container-ui.css docs/plan/design/container-ui.css
empty "1.1 no tailwindcss or fontsource in package.json" "grep -nE 'tailwindcss|fontsource' package.json"
t "1.1 the design folder is as the author left it (docs/plan/design/SHA256SUMS)" sh -c "cd docs/plan/design && shasum -a 256 -c SHA256SUMS"

echo "== WO-1.2 contrast"
t "1.2 check-contrast passes" node scripts/check-contrast.mjs

echo "== WO-1.3 components"
n=$(ls src/ui/op/*.tsx 2>/dev/null | grep -vc test)
if [ "$n" -ge 32 ]; then ok "1.3 $n component files in src/ui/op"; else no "1.3 only $n component files in src/ui/op (need 32)"; fi
for c in Icon Button Field Select Switch Chip Tabs Dot Sev Tooltip Banner Empty SkeletonRows Canvas Command Tile Facts GroupCaption Row Problem Menu Sheet ConfirmDialog Toast Blocks Meters Sparkline Inspector NavItem Checkbox Progress Portal; do
  t "1.3 $c has a component and a test" sh -c "test -f src/ui/op/$c.tsx && test -f src/ui/op/$c.test.tsx"
done
empty "1.3 lucide-react is imported only by Icon (and the old icons file)" "grep -rln 'lucide-react' src --include='*.tsx' --include='*.ts' | grep -vE '^src/ui/op/Icon\.tsx$|^src/ui/icons\.tsx$|^src/ui/components/'"
empty "1.3 no inline style in the components except Meters" "grep -rln 'style=' src/ui/op --include='*.tsx' | grep -v test | grep -vx 'src/ui/op/Meters.tsx'"
empty "1.3 no test is skipped" "grep -rnE '\b(it|test|describe)\.(skip|only|todo)\b|\bxit\(|\bxdescribe\(' src scripts"
t "1.3 the gallery exists" test -f src/dev/Gallery.tsx
t "1.3 not-migrated list is valid" node scripts/check-not-migrated.mjs
empty "1.3 no new component file is on the not-migrated list" "grep -nE 'src/ui/op/|src/dev/' scripts/not-migrated.json"

echo "== WO-1.4 classes"
t "1.4 check-classes passes" node scripts/check-classes.mjs

echo "== WO-1.5 mockup comparison"
t "1.5 check-mockup.mjs exists" test -f scripts/check-mockup.mjs
t "1.5 mockup-pairs.json is empty for now" sh -c "node -e 'process.exit(require(\"./scripts/mockup-pairs.json\").length === 0 ? 0 : 1)'"
t "1.5 the design scenario exists" grep -q '"design"' preview/mock.ts
empty "1.5 the design scenario uses no random or clock values" "awk '/\"design\"/{f=1} f&&/Math\.random|Date\.now|new Date\(\)/{print NR\": \"\$0} /^}/{f=0}' preview/mock.ts"

echo "== across the iteration"
empty "no TODO, FIXME or HACK was added" "git diff 0bdafcf -- src src-tauri/src scripts preview | grep -E '^\+' | grep -nE 'TODO|FIXME|HACK|XXX'"
empty "no eslint-disable was added" "git diff 0bdafcf -- src | grep -E '^\+' | grep -n 'eslint-disable'"
empty "no stopped work order (every wo- branch is merged into main)" "git branch --no-merged main --list 'wo-*'; ls docs/plan/iterations/STOPPED-wo-*.md 2>/dev/null"
t "the report exists" test -f docs/plan/iterations/iteration-1-report.md
for w in 0.0 0.2 0.3 0.5 0.4 0.6 1.1 1.2 1.3a 1.3b 1.3c 1.4 1.5; do t "pull request text for wo-$w exists" test -f "docs/plan/iterations/pr/wo-$w.md"; done

echo
echo "$pass ok, $fail failed"
[ "$fail" -eq 0 ]
