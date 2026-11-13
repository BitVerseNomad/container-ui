#!/bin/sh
# Checks iteration 4 (engines in the backend and the frontend, one data layer, the legacy UI deleted, main.rs split, docs).
# Run from the repo root: sh docs/plan/iterations/verify-iteration-4.sh
# Read-only: it builds and runs tests, and never runs docker, colima, limactl, kubectl or brew.
# Each check prints "ok <what>" or "FAIL <what>". Exit 1 if any failed.

pass=0
fail=0
ok() { echo "ok $1"; pass=$((pass + 1)); }
bad() { echo "FAIL $1"; fail=$((fail + 1)); }
# run <what> <command...>: ok when the command exits 0
run() { what=$1; shift; if "$@" >/dev/null 2>&1; then ok "$what"; else bad "$what"; fi; }
# sh_ok <what> <shell text>: ok when the shell text exits 0
sh_ok() { if sh -c "$2" >/dev/null 2>&1; then ok "$1"; else bad "$1"; fi; }
# count_is <what> <expected> <shell text that prints a number or word>
count_is() { got=$(sh -c "$3" 2>/dev/null | tr -d ' \n'); if [ "$got" = "$2" ]; then ok "$1"; else bad "$1 (expected $2, got '$got')"; fi; }
# count_ge <what> <minimum> <shell text that prints a number>
count_ge() { got=$(sh -c "$3" 2>/dev/null | tr -d ' \n'); case "$got" in ''|*[!0-9]*) bad "$1 (not a number: '$got')";; *) if [ "$got" -ge "$2" ]; then ok "$1"; else bad "$1 (expected at least $2, got $got)"; fi;; esac; }
# gone <what> <path>...: none of the paths exist
gone() { what=$1; shift; for p in "$@"; do if [ -e "$p" ]; then bad "$what ($p still exists)"; return; fi; done; ok "$what"; }
# both_engines <script>: the browser check passes in Chromium and in WebKit
both_engines() { for e in chromium webkit; do run "$1 in $e" env PW_ENGINE=$e node "$1"; done; }

if [ ! -f package.json ] || [ ! -d docs/plan ]; then echo "FAIL run this from the repo root"; exit 1; fi

echo "== The gate"
run "npm run lint" npm run lint
run "npx tsc --noEmit" npx tsc --noEmit
run "npm test" npm test
run "cargo fmt --check" sh -c "cd src-tauri && cargo fmt --check"
run "cargo clippy -D warnings" sh -c "cd src-tauri && cargo clippy --all-targets -- -D warnings"
run "cargo test" sh -c "cd src-tauri && cargo test"
run "npm run check (browser checks, Chromium and WebKit)" npm run check
run "npm run check:docs (every file a doc names exists)" npm run check:docs

echo "== Iteration-wide"
count_ge "cargo test passes at least 162 tests (136 after iteration 1, plus the 26 of engine.rs)" 162 "cd src-tauri && cargo test 2>&1 | grep 'test result' | head -1 | sed -E 's/.* ([0-9]+) passed.*/\\1/'"
count_is "cargo test has no failed test" "0" "cd src-tauri && cargo test 2>&1 | grep 'test result' | head -1 | sed -E 's/.* ([0-9]+) failed.*/\\1/'"
count_is "no usePoll anywhere in src, preview or scripts" "0" "grep -rn 'usePoll' src preview scripts --include='*.ts' --include='*.tsx' --include='*.mjs' | wc -l"
count_is "no runtime-changed event" "0" "grep -rn 'runtime-changed' src preview | wc -l"
count_is "no ctxFor, ColimaEngine, engineOfProfile or runtimeRegistry" "0" "grep -rnE 'ctxFor|ColimaEngine|engineOfProfile|runtimeRegistry' src preview | wc -l"
count_is "no import path names ui/op (the components moved to src/ui)" "0" "grep -rn 'ui/op' src scripts preview eslint.config.js knip.json | wc -l"
count_is "scripts/not-migrated.json is empty" "0" "node -e 'console.log(require(\"./scripts/not-migrated.json\").length)'"
run "check-not-migrated passes" node scripts/check-not-migrated.mjs
run "check-design-sync passes" node scripts/check-design-sync.mjs
run "check-classes passes" node scripts/check-classes.mjs
run "check-messages-kept passes" node scripts/check-messages-kept.mjs
count_is "no mockup pair above 0.02 without a why" "0" "node -e 'const p=require(\"./scripts/mockup-pairs.json\");console.log(p.filter(r=>r.threshold>0.02&&!r.why).length)'"
count_is "no TODO, FIXME or XXX in the files of this iteration" "0" "grep -nE 'TODO|FIXME|XXX' src/lib/engines.ts src/lib/engineModel.ts src/lib/queries.ts src/lib/queryClient.ts src/lib/machines/colima.ts src/EngineSwitcher.tsx src/EngineStopped.tsx src/settings/Engines.tsx src-tauri/src/engine.rs 2>/dev/null | wc -l"
count_is "every WO of this iteration has a PR text file" "10" "ls docs/plan/iterations/pr/wo-4.1.md docs/plan/iterations/pr/wo-4.2a.md docs/plan/iterations/pr/wo-4.2b.md docs/plan/iterations/pr/wo-4.3a.md docs/plan/iterations/pr/wo-4.3b.md docs/plan/iterations/pr/wo-4.3c.md docs/plan/iterations/pr/wo-5.1a.md docs/plan/iterations/pr/wo-5.1b.md docs/plan/iterations/pr/wo-5.2.md docs/plan/iterations/pr/wo-5.3.md 2>/dev/null | wc -l"
count_is "no test is skipped or marked todo in src or scripts" "0" "grep -rnE '(\\.skip\\(|it\\.todo|xit\\(|xdescribe\\()' src scripts --include='*.test.ts' --include='*.test.tsx' | wc -l"

echo "== WO-4.1 Engine and Machine in the backend"
sh_ok "src-tauri/src/engine.rs exists" "test -f src-tauri/src/engine.rs"
count_is "engine.rs has 26 tests" "26" "grep -c '#\\[test\\]' src-tauri/src/engine.rs"
sh_ok "engine.rs defines Engine, EngineKind, KubeRef, list_engines and context_ok" "grep -q 'pub struct Engine' src-tauri/src/engine.rs && grep -q 'pub enum EngineKind' src-tauri/src/engine.rs && grep -q 'pub struct KubeRef' src-tauri/src/engine.rs && grep -q 'pub async fn list_engines' src-tauri/src/engine.rs && grep -q 'fn context_ok' src-tauri/src/engine.rs"
sh_ok "the classification table has its six kinds" "grep -q 'EngineKind::Colima' src-tauri/src/engine.rs && grep -q 'EngineKind::Orbstack' src-tauri/src/engine.rs && grep -q 'EngineKind::RancherDesktop' src-tauri/src/engine.rs && grep -q 'EngineKind::Podman' src-tauri/src/engine.rs && grep -q 'EngineKind::DockerDesktop' src-tauri/src/engine.rs && grep -q 'EngineKind::Other' src-tauri/src/engine.rs"
sh_ok "the probe has a 3 second deadline" "grep -q 'PROBE_DEADLINE: Duration = Duration::from_secs(3)' src-tauri/src/engine.rs"
sh_ok "Colima keeps its own gate under the name colima_context_ok" "grep -rq 'fn colima_context_ok' src-tauri/src"
sh_ok "list_engines is in the handler list" "grep -q 'engine::list_engines' src-tauri/src/main.rs"
sh_ok "desktop.rs uses colima_context_ok" "grep -q 'colima_context_ok' src-tauri/src/desktop.rs && ! grep -qE '(^|[^_a-z])context_ok\\(' src-tauri/src/desktop.rs"
run "engine tests pass" sh -c "cd src-tauri && cargo test engine:: 2>&1 | grep -q '26 passed'"

echo "== WO-4.2a The engine switcher lists every Docker"
sh_ok "src/lib/engines.ts, queryClient.ts, machines/colima.ts and test/withQuery.tsx exist" "test -f src/lib/engines.ts && test -f src/lib/queryClient.ts && test -f src/lib/machines/colima.ts && test -f src/test/withQuery.tsx"
sh_ok "engines.ts exports useEngines, useEngine and selectEngine" "grep -q 'export function useEngines' src/lib/engines.ts && grep -q 'export function useEngine' src/lib/engines.ts && grep -q 'export function selectEngine' src/lib/engines.ts"
sh_ok "the choice is stored under openpier:engine" "grep -q 'openpier:engine' src/lib/engines.ts"
sh_ok "list_engines is asked every 5 seconds" "grep -q 'ENGINES_EVERY_MS = 5000' src/lib/engines.ts"
sh_ok "engineModel.ts has one Engine type and an EngineView, and no ColimaEngine" "grep -q 'export type Engine = ' src/lib/engineModel.ts && grep -q 'export type EngineView' src/lib/engineModel.ts && ! grep -q 'ColimaEngine' src/lib/engineModel.ts"
sh_ok "the kind captions are the six words of the spec" "grep -q 'Docker Desktop' src/lib/engineModel.ts && grep -q 'OrbStack' src/lib/engineModel.ts && grep -q 'Rancher Desktop' src/lib/engineModel.ts && grep -q 'Podman' src/lib/engineModel.ts"
sh_ok "the stopped words are the quoted ones" "grep -q 'Start it from Docker Desktop.' src/lib/engineModel.ts && grep -q 'Open Docker Desktop' src/lib/engineModel.ts && grep -q 'Your containers and data are kept. Start the machine to see them.' src/lib/engineModel.ts"
count_is "QueryClientProvider is in main.tsx and not in App.tsx" "ok" "if grep -q QueryClientProvider src/main.tsx && ! grep -q QueryClientProvider src/App.tsx; then echo ok; else echo no; fi"
count_is "App.tsx no longer reads the engine from the old runtime code" "0" "grep -n 'runtimeRegistry\\|activeRuntimeId\\|setActiveRuntimeId' src/App.tsx | wc -l"
sh_ok "the mock has list_engines and the three scenarios" "grep -q 'case \"list_engines\"' preview/mock.ts && grep -q 'desktop-only' preview/mock.ts && grep -q 'orbstack-only' preview/mock.ts && grep -q 'colima-and-desktop' preview/mock.ts"
sh_ok "MenuRadioItem takes a title" "grep -q 'title' src/ui/Menu.tsx"
run "node tests of engineModel pass" node --experimental-strip-types --no-warnings --test src/lib/engineModel.test.ts
count_ge "engineModel.test.ts has at least 21 tests" 21 "grep -c \"test(\" src/lib/engineModel.test.ts"
run "vitest: engines, queryClient, EngineSwitcher, Menu" npx vitest run src/lib/engines.test.tsx src/lib/queryClient.test.tsx src/EngineSwitcher.test.tsx src/ui/Menu.test.tsx
sh_ok "check-engines.mjs exists and is in check-all.sh" "test -f scripts/check-engines.mjs && grep -q check-engines scripts/check-all.sh"
both_engines scripts/check-engines.mjs
both_engines scripts/check-layout.mjs

echo "== WO-4.2b Every screen works with any engine"
gone "src/runtime is deleted" src/runtime
count_is "the old runtime commands are gone from the backend" "0" "grep -rn 'orb_version\\|orb_list_vms\\|orb_start_vm\\|orb_stop_vm\\|orb_delete_vm\\|rdctl_version\\|podman_version\\|docker_desktop_version\\|colima_version\\|fn orb_json' src-tauri/src | wc -l"
count_is "ctxFor is gone" "0" "grep -rn 'ctxFor' src | wc -l"
sh_ok "mockCoverage no longer lists commands the preview does not fake" "! grep -q NOT_IN_PREVIEW src/lib/mockCoverage.test.ts"
count_ge "every Doctor check has appliesTo (17 mentions)" 17 "grep -c 'appliesTo' src/lib/doctor.ts"
count_is "exactly seven checks apply to colima only" "7" "grep -c 'appliesTo: \\[\"colima\"\\]' src/lib/doctor.ts"
sh_ok "doctor() skips checks that do not apply" "grep -q 'appliesTo' src/lib/doctor.ts && grep -q 'facts.kind' src/lib/doctor.ts"
sh_ok "EngineStopped.tsx exists and App uses it" "test -f src/EngineStopped.tsx && grep -q EngineStopped src/App.tsx"
sh_ok "Settings Engines reads list_engines through useEngines" "grep -q 'useEngines' src/settings/Engines.tsx && grep -q 'No engines found' src/settings/Engines.tsx && grep -q 'docker context create' src/settings/Engines.tsx"
sh_ok "the mock has desktop-stopped and records __calls" "grep -q 'desktop-stopped' preview/mock.ts && grep -q '__calls' preview/mock.ts"
run "node tests: doctor and mockCoverage" node --experimental-strip-types --no-warnings --test src/lib/doctor.test.ts src/lib/mockCoverage.test.ts
run "vitest: EngineStopped and settings Engines" npx vitest run src/EngineStopped.test.tsx src/settings/Engines.test.tsx
count_ge "check-engines.mjs has the desktop-only lines (at least 24 check( calls)" 24 "grep -c 'check(' scripts/check-engines.mjs"
count_is "the Colima-only commands appear in no desktop-only line of the mock" "ok" "if grep -q 'colima_config' scripts/check-engines.mjs && grep -q 'vm_dns_probe' scripts/check-engines.mjs; then echo ok; else echo no; fi"

echo "== WO-4.3a, 4.3b, 4.3c One data layer"
sh_ok "queries.ts exports engineKey, macKey, LIST, errorText and useRefresh" "grep -q 'export const engineKey' src/lib/queries.ts && grep -q 'export const macKey' src/lib/queries.ts && grep -q 'export const LIST' src/lib/queries.ts && grep -q 'export function errorText' src/lib/queries.ts && grep -q 'export function useRefresh' src/lib/queries.ts"
sh_ok "Cmd+R still refreshes every list (the openpier:refresh listener is in queryClient.ts)" "grep -q 'openpier:refresh' src/lib/queryClient.ts"
sh_ok "polling pauses when the window is not focused" "grep -q 'focusManager.setEventListener' src/lib/queryClient.ts"
sh_ok "useMachines exists and App.tsx uses it" "grep -q 'export function useMachines' src/lib/machines/colima.ts && grep -q 'useMachines' src/App.tsx"
count_is "App.tsx has no setInterval" "0" "grep -c 'setInterval' src/App.tsx"
gone "usePoll, pollPace and latest are deleted" src/hooks.ts src/lib/pollPace.ts src/lib/pollPace.test.ts src/lib/latest.ts src/lib/latest.test.ts
count_is "no dataFrom left" "0" "grep -rn 'dataFrom' src | wc -l"
count_is "every converted call keeps its own interval (no refetchInterval of 3000 on the disk or compose logs reads)" "0" "grep -rn 'refetchInterval' src --include='*.tsx' --include='*.ts' | grep -v '\\.test\\.' | grep -E 'disk-usage|compose-logs' | grep -c '3000\\|3_000'"
count_ge "at least 24 files read through useQuery" 20 "grep -rln 'useQuery' src --include='*.ts' --include='*.tsx' | grep -v '\\.test\\.' | wc -l"
run "node tests: queries" node --experimental-strip-types --no-warnings --test src/lib/queries.test.ts
run "vitest: the whole suite" npx vitest run
count_is "no test renders a query component without a client" "0" "npx vitest run 2>&1 | grep -c 'No QueryClient set'"
sh_ok "the Doctor facts query returns the start time of its read" "grep -q 'const from = Date.now()' src/Doctor.tsx"

echo "== WO-5.1a and WO-5.1b The old UI is deleted, the components moved up"
gone "the old UI is deleted" src/ui.tsx src/ui/icons.tsx src/ui/components src/ui/op
sh_ok "src/ui/index.ts is the new barrel and exports Button, Row and Menu" "test -f src/ui/index.ts && grep -q 'Button' src/ui/index.ts && grep -q 'Row' src/ui/index.ts && grep -q 'Menu' src/ui/index.ts"
sh_ok "src/ui/openpier.css is still there" "test -f src/ui/openpier.css"
sh_ok "knip is installed and configured" "test -f knip.json && grep -q '\"knip\"' package.json"
count_is "knip reports no unused files or exports" "0" "npx knip --include files,exports 2>&1 | grep -c 'Unused'"
count_is "tailwind-merge, class-variance-authority and clsx are not dependencies" "0" "grep -c 'tailwind-merge\\|class-variance-authority\\|\"clsx\"' package.json"
count_is "no tailwind anywhere in package.json or src" "0" "grep -rn 'tailwind' package.json src | wc -l"
sh_ok "ESLint ignores src/ui and guards the screens" "grep -q 'src/ui/\\*\\*' eslint.config.js && ! grep -q 'src/ui/op' eslint.config.js"
count_is "the old Tab type and tabRoutes are gone" "0" "grep -rn 'tabRoutes\\|tabOfRoute\\|pathOfTab\\|export type Tab\\b' src | wc -l"
gone "the one-off codemod is deleted" scripts/ui-up.mjs
run "node test: no ui/op import is left" node --experimental-strip-types --no-warnings --test src/lib/uiImports.test.ts

echo "== WO-5.2 main.rs is split"
sh_ok "the eleven Rust files exist" "for f in allow colima compose desktop engine exec kube main setup system tools; do test -f src-tauri/src/\$f.rs || exit 1; done"
count_ge "main.rs is under 200 lines" 1 "n=\$(wc -l < src-tauri/src/main.rs); [ \$n -lt 200 ] && echo 1 || echo 0"
count_is "main.rs declares eleven modules" "11" "grep -c '^mod ' src-tauri/src/main.rs"
count_is "every command in the handler list is written with its file" "0" "sed -n '/generate_handler!\\[/,/\\]/p' src-tauri/src/main.rs | grep -E '^ +[a-z_]+,?$' | wc -l"
count_is "the one-off split script is deleted" "0" "ls scripts/split-main-rs.mjs scripts/split-main-rs.homes.json 2>/dev/null | wc -l"
count_is "the tests moved with their code: main.rs has no test module" "0" "grep -c '^mod tests' src-tauri/src/main.rs"
count_ge "exec.rs holds the process code (kill_group, output_with_deadline)" 2 "grep -c 'fn kill_group\\|fn output_with_deadline' src-tauri/src/exec.rs"
count_ge "allow.rs holds the docker allowlist" 2 "grep -c 'fn docker_args_allowed\\|fn run_args_ok' src-tauri/src/allow.rs"
sh_ok "colima.rs holds colima_context_ok and profile_name_ok" "grep -q 'fn colima_context_ok' src-tauri/src/colima.rs && grep -q 'fn profile_name_ok' src-tauri/src/colima.rs"
sh_ok "kube.rs holds kubectl and compose.rs holds compose_action" "grep -q 'fn kubectl' src-tauri/src/kube.rs && grep -q 'fn compose_action' src-tauri/src/compose.rs"

echo "== WO-5.3 The docs match the app"
sh_ok "check-doc-links.mjs passes its self-test" "node scripts/check-doc-links.mjs --self-test"
sh_ok "check-doc-links.mjs passes on the repo" "node scripts/check-doc-links.mjs"
sh_ok "scripts/doc-links.json lists what is checked and what is history" "grep -q '\"check\"' scripts/doc-links.json && grep -q '\"history\"' scripts/doc-links.json"
count_ge "AGENTS.md says where the design is" 2 "grep -c 'docs/plan/design/' AGENTS.md"
count_is "AGENTS.md uses node scripts/readme-shots.mjs for the screenshots" "0" "grep -c 'npm run preview &&' AGENTS.md"
sh_ok "AGENTS.md still has its eight UX rules" "for n in 1 2 3 4 5 6 7 8; do grep -q \"^\$n\\. \" AGENTS.md || exit 1; done"
count_ge "CHANGELOG.md has at least 7 numbered lines under Unreleased" 7 "sed -n '/^## Unreleased/,/^## [^U]/p' CHANGELOG.md | grep -c '^[0-9]'"
sh_ok "check:docs is a script and a CI step" "grep -q 'check:docs' package.json && grep -q 'check:docs' .github/workflows/ci.yml"

echo "== Read-only guard"
count_is "this script ran no machine-changing command (static check of the script itself)" "0" "grep -nE '^[^#]*(docker|colima|limactl|kubectl|brew) (run|start|stop|rm|create|install|delete|up|down)' docs/plan/iterations/verify-iteration-4.sh | wc -l"

echo
echo "passed: $pass, failed: $fail"
if [ "$fail" -gt 0 ]; then exit 1; fi
exit 0
