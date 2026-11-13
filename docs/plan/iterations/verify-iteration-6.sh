#!/bin/sh
# Iteration 6, part 1: checks for WO-8.1a to WO-8.8. Run from the repo root: sh docs/plan/iterations/verify-iteration-6.sh
# Read-only apart from builds and test runs. It never starts an engine and never runs scripts/real-engine-test.sh.
# Each check prints "ok <what>" or "FAIL <what>". A "skip" line is only for a step that has nothing to run here.
# Part 2 (WO-8.9 to 8.15) is in verify-iteration-6-part-2.sh; this script runs it at the end.
cd "$(dirname "$0")/../../.." || exit 1
pass=0; fail=0; skipped=0
ok()   { echo "ok $*"; pass=$((pass + 1)); }
bad()  { echo "FAIL $*"; fail=$((fail + 1)); }
skip() { echo "skip $*"; skipped=$((skipped + 1)); }
chk()  { d=$1; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi; }
has()  { d=$1; f=$2; p=$3; if [ -f "$f" ] && grep -q -- "$p" "$f"; then ok "$d"; else bad "$d"; fi; }
hasnt(){ d=$1; f=$2; p=$3; if [ -f "$f" ] && ! grep -q -- "$p" "$f"; then ok "$d"; else bad "$d"; fi; }
exists(){ d=$1; shift; for f in "$@"; do [ -e "$f" ] || { bad "$d (missing $f)"; return; }; done; ok "$d"; }

# $1 description, $2 cargo test filter, $3 minimum passed
rust_min() {
  out=$(cd src-tauri && cargo test "$2" 2>&1)
  n=$(printf '%s\n' "$out" | sed -n 's/^test result: ok\. \([0-9][0-9]*\) passed.*/\1/p' | head -1)
  if [ -n "$n" ] && [ "$n" -ge "$3" ]; then ok "$1 ($n passed)"; else bad "$1 (wanted at least $3 passed, got '${n:-none}')"; fi
}
# $1 description, $2 minimum pass, then the test files
node_min() {
  d=$1; min=$2; shift 2
  out=$(node --experimental-strip-types --no-warnings --test "$@" 2>&1)
  p=$(printf '%s\n' "$out" | sed -n -E 's/^(ℹ|#) pass ([0-9]+)$/\2/p' | head -1)
  f=$(printf '%s\n' "$out" | sed -n -E 's/^(ℹ|#) fail ([0-9]+)$/\2/p' | head -1)
  if [ -n "$p" ] && [ "$p" -ge "$min" ] && [ "${f:-1}" = "0" ]; then ok "$d ($p passed)"; else bad "$d (wanted at least $min passed and 0 failed, got pass='${p:-none}' fail='${f:-none}')"; fi
}
# $1 description, $2 minimum passed, then the vitest files
vitest_min() {
  d=$1; min=$2; shift 2
  out=$(npx vitest run "$@" 2>&1)
  p=$(printf '%s\n' "$out" | sed -n 's/^ *Tests  *\([0-9][0-9]*\) passed.*/\1/p' | head -1)
  if [ -n "$p" ] && [ "$p" -ge "$min" ] && ! printf '%s\n' "$out" | grep -q "failed"; then ok "$d ($p passed)"; else bad "$d (wanted at least $min passed and none failed)"; fi
}

echo "== The gate (HANDOFF section 5; npm ci is not run here)"
chk "gate: npm run lint" npm run lint
chk "gate: npx tsc --noEmit" npx tsc --noEmit
chk "gate: npm test" npm test
chk "gate: cargo fmt --check" sh -c 'cd src-tauri && cargo fmt --check'
chk "gate: cargo clippy" sh -c 'cd src-tauri && cargo clippy --all-targets -- -D warnings'
chk "gate: cargo test" sh -c 'cd src-tauri && cargo test'
echo "== npm run check (every browser check, both engines; it starts the preview itself)"
browser_out=$(npm run check 2>&1); browser_code=$?
if [ "$browser_code" -eq 0 ]; then ok "gate: npm run check"; else bad "gate: npm run check (exit $browser_code)"; fi
# $1 description, $2 script name: both engines must print ": 0" for it
browser_ok() {
  c=$(printf '%s\n' "$browser_out" | grep -c "^chromium scripts/$2: 0$")
  w=$(printf '%s\n' "$browser_out" | grep -c "^webkit scripts/$2: 0$")
  if [ "$c" = "1" ] && [ "$w" = "1" ]; then ok "$1"; else bad "$1 ($2 did not report 0 in both engines)"; fi
}

echo "== WO-8.1a menu bar item, Rust"
exists "8.1a: tray module and the three icons exist" src-tauri/src/tray.rs src-tauri/icons/tray-running.png src-tauri/icons/tray-stopped.png src-tauri/icons/tray-problem.png
for n in running stopped problem; do if cmp -s "docs/plan/design/tray/tray-$n.png" "src-tauri/icons/tray-$n.png"; then ok "8.1a: tray-$n.png is the design file"; else bad "8.1a: tray-$n.png differs from docs/plan/design/tray"; fi; done
has "8.1a: tauri has the tray-icon feature" src-tauri/Cargo.toml '"tray-icon"'
has "8.1a: tray module is declared" src-tauri/src/main.rs 'mod tray'
has "8.1a: closing the window is intercepted" src-tauri/src/main.rs 'prevent_close'
has "8.1a: tray_sync is registered" src-tauri/src/main.rs 'tray::tray_sync'
has "8.1a: the capability file still has only the event permission" src-tauri/capabilities/default.json 'core:event:default'
hasnt "8.1a: the capability file was not widened (no tray, window, notification)" src-tauri/capabilities/default.json 'tray\|window\|notification'
rust_min "8.1a: tray tests" tray:: 12

echo "== WO-8.1b menu bar item, page"
exists "8.1b: bridge, settings module and check exist" src/lib/trayBridge.ts src/lib/watchSettings.ts src/lib/trayBridge.test.ts scripts/check-tray.mjs
node_min "8.1b: bridge node tests" 5 src/lib/trayBridge.test.ts
vitest_min "8.1b: bridge component tests" 4 src/lib/trayBridge.test.tsx
has "8.1b: the mock answers tray_sync" preview/mock.ts 'tray_sync'
has "8.1b: every stop tells the notifier" src/lib/machines/colima.ts 'watch_expect_stop'
browser_ok "8.1b: check-tray passes in both engines" check-tray.mjs
chk "8.1b: the keep-in-menu-bar setting is written from Settings" sh -c 'grep -rl writeKeepInMenuBar src --include=*.tsx | grep -q .'

echo "== WO-8.2a notifications, watcher"
exists "8.2a: notifier, sentences and settings module exist" src-tauri/src/notify.rs src/lib/sentences.json src/lib/notifySettings.ts
chk "8.2a: sentences.json has the five keys" node -e 'const s=JSON.parse(require("fs").readFileSync("src/lib/sentences.json","utf8"));for(const k of ["crashed","oom","unhealthy","restarting","engine-stopped"])if(!s[k])process.exit(1)'
has "8.2a: health.ts reads the sentences file" src/lib/health.ts 'sentences.json'
has "8.2a: tsconfig allows JSON modules" tsconfig.json 'resolveJsonModule'
has "8.2a: the notification crate is a dependency" src-tauri/Cargo.toml 'tauri-plugin-notification'
has "8.2a: the plugin is initialised" src-tauri/src/main.rs 'tauri_plugin_notification::init'
hasnt "8.2a: the page has no notification permission (Rust sends them)" src-tauri/capabilities/default.json 'notification'
hasnt "8.2a: no npm notification package (the page never calls it)" package.json 'plugin-notification'
rust_min "8.2a: notifier tests" notify:: 21
node_min "8.2a: sentence and settings node tests" 4 src/lib/sentences.test.ts src/lib/notifySettings.test.ts

echo "== WO-8.2b notifications, settings and click"
has "8.2b: the page listens for notice-open" src/lib/trayBridge.ts 'notice-open'
has "8.2b: the backend can raise it" src-tauri/src/notify.rs 'notice-open'
browser_ok "8.2b: check-notify passes in both engines" check-notify.mjs
chk "8.2b: Settings writes the notify config" sh -c 'grep -rl writeNotifyConfig src --include=*.tsx | grep -q .'

echo "== WO-8.3a problems page"
exists "8.3a: catalogue, script and page exist" src/lib/problemCatalog.ts src/lib/problemCatalog.test.ts scripts/problems-doc.mjs docs/problems.md
node_min "8.3a: catalogue tests (every id in the code has an entry)" 7 src/lib/problemCatalog.test.ts
chk "8.3a: docs/problems.md is up to date" npm run problems:check
ids=$(grep -ho 'id: "[a-z][a-z0-9-]*"' src/lib/doctor.ts src/lib/health.ts src/lib/apps.ts | sort -u | wc -l | tr -d ' ')
anchors=$(grep -c '<a id=' docs/problems.md)
if [ "$ids" = "$anchors" ] && [ "$ids" -gt 0 ]; then ok "8.3a: the page has one anchor per id in the code ($anchors)"; else bad "8.3a: ids in code $ids, anchors in page $anchors"; fi
has "8.3a: CI fails when the page is stale" .github/workflows/ci.yml 'problems:check'
hasnt "8.3a: no TODO left in the catalogue" src/lib/problemCatalog.ts 'TODO'
hasnt "8.3a: no em dash in the page" docs/problems.md '—'

echo "== WO-8.3b Learn more"
has "8.3b: problemUrl exists" src/lib/links.ts 'problemUrl'
node_min "8.3b: link tests" 3 src/lib/links.test.ts
# the one file that renders <Inspector (WO-1.3b), found by grep, not by a fixed path
if grep -rl "Learn more" src --include=*.tsx | grep -v test | grep -q .; then ok "8.3b: the Learn more button exists in src"; else bad "8.3b: no .tsx file under src contains Learn more"; fi
browser_ok "8.3b: check-learn-more passes in both engines" check-learn-more.mjs

echo "== WO-8.4 log view"
exists "8.4: view, pure logic, tests and check exist" src/ui/LogView.tsx src/lib/logView.ts src/lib/logView.test.ts src/ui/LogView.test.tsx scripts/check-logs.mjs src-tauri/src/logsave.rs
node_min "8.4: log view logic tests" 20 src/lib/logView.test.ts
vitest_min "8.4: log view component tests" 6 src/ui/LogView.test.tsx
has "8.4: LogView is in the style= allowlist" eslint.config.js 'LogView.tsx'
hasnt "8.4: lucide-react is not imported by LogView" src/ui/LogView.tsx 'lucide-react'
rust_min "8.4: save_log tests" logsave:: 4
has "8.4: LogView is exported" src/ui/index.ts 'LogView'
has "8.4: the view keeps 10,000 lines" src/lib/logView.ts 'LOG_CAP = 10000'
for f in $(grep -rl 'compose_logs\|"--timestamps"' src --include=*.tsx | grep -v test | grep -v "src/ui/LogView.tsx"); do
  hasnt "8.4: $f has no private <pre> log box any more" "$f" '<pre'
done
browser_ok "8.4: check-logs passes in both engines" check-logs.mjs
has "8.4: LogControls puts the Log options menu in the tabs row" src/ui/LogView.tsx 'Log options'
has "8.4: Wrap uses the stylesheet class through Canvas wrap" src/ui/LogView.tsx 'wrap'
has "8.4: the service name uses .svc" src/ui/LogView.tsx 'svc'
hasnt "8.4: no gutter class was invented" src/ui/LogView.tsx 'gut'
chk "8.4: no .toolbar is used for the log" sh -c '! grep -rn "className=\"toolbar\"" src/ui/LogView.tsx src/Logs.tsx src/ContainerDetail.tsx'
has "8.4: chev-up comes from the ui Icon (WO-1.3a)" src/ui/Icon.tsx 'chev-up'

echo "== WO-8.5a command log"
exists "8.5a: applog module exists" src-tauri/src/applog.rs
rust_min "8.5a: applog tests" applog:: 16
n=$(grep -c "applog::record" src-tauri/src/exec.rs); if [ "$n" -ge 3 ]; then ok "8.5a: exec and stream record their commands ($n calls)"; else bad "8.5a: expected 3 or more applog::record calls in exec.rs, got $n"; fi
has "8.5a: the log folder is started" src-tauri/src/main.rs 'applog::init'
has "8.5a: reveal_logs is registered" src-tauri/src/main.rs 'applog::reveal_logs'
has "8.5a: log folder comes from Tauri, not a hard-coded identifier" src-tauri/src/main.rs 'app_log_dir'
hasnt "8.5a: no date crate was added" src-tauri/Cargo.toml 'chrono'

echo "== WO-8.5b Copy details"
exists "8.5b: diagnostics in Rust and TypeScript, and the check" src-tauri/src/diagnostics.rs src/lib/diagnostics.ts src/lib/diagnostics.test.ts scripts/check-copy-details.mjs
node_min "8.5b: formatter tests" 5 src/lib/diagnostics.test.ts
has "8.5b: the backend command is registered" src-tauri/src/main.rs 'diagnostics::diagnostics'
browser_ok "8.5b: check-copy-details passes in both engines" check-copy-details.mjs
chk "8.5b: the About section has the Copy details button" sh -c 'grep -rl "Copy details" src --include=*.tsx | grep -v test | grep -q .'
chk "8.5b: Help opens the log folder" sh -c 'grep -rl reveal_logs src --include=*.tsx | grep -q .'

echo "== WO-8.6 error boundary"
exists "8.6: boundary, its test and the check exist" src/ui/ErrorBoundary.tsx src/ui/ErrorBoundary.test.tsx scripts/check-error-boundary.mjs
vitest_min "8.6: boundary tests" 6 src/ui/ErrorBoundary.test.tsx
chk "8.6: the crash page is src/dev/Crash.tsx and main.tsx does not register it" sh -c 'test -f src/dev/Crash.tsx && ! grep -q "dev/crash" src/main.tsx'
hasnt "8.6: the boundary has no Tailwind or token-in-class styling left" src/ui/ErrorBoundary.tsx 'bg-\[var\|className="flex'
chk "8.6: the shell wraps the page outlet" sh -c 'grep -rl "<ErrorBoundary" src --include=*.tsx | grep -v test | grep -v "src/ui/ErrorBoundary.tsx" | grep -q .'
browser_ok "8.6: check-error-boundary passes in both engines" check-error-boundary.mjs

echo "== WO-8.8 size scenario"
has "8.8: the mock has scenario big" preview/mock.ts 'scenario === "big"'
has "8.8: the mock has scenario huge" preview/mock.ts 'huge'
exists "8.8: VirtualRows and its test exist" src/ui/VirtualRows.tsx src/ui/VirtualRows.test.tsx
vitest_min "8.8: VirtualRows tests" 4 src/ui/VirtualRows.test.tsx
chk "8.8: the style= allowlist is exactly Meters, LogView, VirtualRows" sh -c 'test "$(grep -rln "style=" src --include=*.tsx | grep -v test | sort | xargs -n1 basename | tr "\n" " ")" = "LogView.tsx Meters.tsx VirtualRows.tsx "'
has "8.8: the budget is 1000 ms" scripts/check-big.mjs 'BUDGET_MS = 1000'
browser_ok "8.8: check-big passes in both engines" check-big.mjs

echo "== WO-8.7 nightly engine job (not run here: it needs a runner)"
exists "8.7: workflow and scripts exist" .github/workflows/nightly-engine.yml scripts/real-engine-test.sh scripts/real-doctor.mjs scripts/real-events-shape.mjs
chk "8.7: the script has valid shell syntax" sh -n scripts/real-engine-test.sh
out=$(env -u CI -u OPENPIER_ENGINE_TEST sh scripts/real-engine-test.sh 2>&1); code=$?
if [ "$code" = "2" ]; then ok "8.7: the script refuses to run without CI or OPENPIER_ENGINE_TEST"; else bad "8.7: expected exit 2 without the opt-in, got $code"; fi
out=$(OPENPIER_NO_ENGINE=1 node --experimental-strip-types --no-warnings scripts/real-doctor.mjs 2>&1); case "$out" in *"skip: no engine"*) ok "8.7: real-doctor skips without an engine";; *) bad "8.7: real-doctor did not skip";; esac
out=$(OPENPIER_NO_ENGINE=1 node --experimental-strip-types --no-warnings scripts/real-events-shape.mjs 2>&1); case "$out" in *"skip: no engine"*) ok "8.7: real-events-shape skips without an engine";; *) bad "8.7: real-events-shape did not skip";; esac
has "8.7: the workflow is nightly" .github/workflows/nightly-engine.yml 'cron:'
has "8.7: the workflow can be started by hand" .github/workflows/nightly-engine.yml 'workflow_dispatch'
has "8.7: the workflow runs on macOS" .github/workflows/nightly-engine.yml 'runs-on: macos'
has "8.7: the workflow runs the script" .github/workflows/nightly-engine.yml 'real-engine-test.sh'
hasnt "8.7: no CI step runs the real-engine script outside the nightly workflow" .github/workflows/ci.yml 'real-engine-test'
echo "info: 8.7 is proven only by a green run of the workflow on GitHub (workflow_dispatch). Ask for the run link."

echo "== Cross-cutting"
chk "all: the not-migrated list did not grow" sh -c 'if [ -f scripts/check-not-migrated.mjs ]; then node scripts/check-not-migrated.mjs; else true; fi'
bad_dash=$(grep -l '—' docs/problems.md src/lib/sentences.json src/lib/problemCatalog.ts src/ui/LogView.tsx src/ui/ErrorBoundary.tsx src/lib/diagnostics.ts src/lib/trayBridge.ts 2>/dev/null | head -3)
if [ -z "$bad_dash" ]; then ok "all: no em dash in the new files"; else bad "all: em dash in $bad_dash"; fi
chk "all: the capability file is unchanged by this part (one permission)" sh -c '[ "$(grep -c "\"core:" src-tauri/capabilities/default.json)" = "1" ]'
chk "all: the CSP in tauri.conf.json is unchanged" sh -c 'grep -q "default-src '"'"'self'"'"'; script-src '"'"'self'"'"'; style-src '"'"'self'"'"'" src-tauri/tauri.conf.json'

# ---------------------------------------------------------------- Part 2 (WO-8.9 to 8.15)
echo
echo "== Part 2 =="
if sh docs/plan/iterations/verify-iteration-6-part-2.sh; then ok "part 2: verify-iteration-6-part-2.sh passed"; else bad "part 2: verify-iteration-6-part-2.sh failed (see its lines above)"; fi

echo
echo "$pass ok, $fail FAIL, $skipped skipped"
[ "$fail" -eq 0 ]
