#!/bin/sh
# Checks for iteration 2 (the shell, Containers, container detail, the Run, Pull and Compose sheets).
# Run from the repo root:  sh docs/plan/iterations/verify-iteration-2.sh
# Read-only: it builds and runs tests. It never runs docker, colima, limactl, kubectl or brew, and edits nothing.
# Each check prints "ok <what>" or "FAIL <what>". Exit code 1 when any check failed. A count is printed at the end.

PASS=0
FAIL=0

ok() { echo "ok $1"; PASS=$((PASS + 1)); }
bad() { echo "FAIL $1"; FAIL=$((FAIL + 1)); }

# chk "what" command...   (passes when the command exits 0)
chk() {
  what="$1"
  shift
  if "$@" >/dev/null 2>&1; then ok "$what"; else bad "$what"; fi
}

# has "what" file text   (the file contains the fixed text)
has() { if [ -f "$2" ] && grep -qF -- "$3" "$2"; then ok "$1"; else bad "$1"; fi; }

# lacks "what" file text   (the file exists and does not contain the fixed text)
lacks() { if [ -f "$2" ] && ! grep -qF -- "$3" "$2"; then ok "$1"; else bad "$1"; fi; }

# present "what" path...   (every path exists)
present() {
  what="$1"
  shift
  for p in "$@"; do
    if [ ! -e "$p" ]; then bad "$what (missing $p)"; return; fi
  done
  ok "$what"
}

# absent "what" path...   (no path exists)
absent() {
  what="$1"
  shift
  for p in "$@"; do
    if [ -e "$p" ]; then bad "$what (still there: $p)"; return; fi
  done
  ok "$what"
}

# atleast "what" N file pattern   (the pattern matches at least N lines)
atleast() {
  n=$(grep -c -- "$4" "$3" 2>/dev/null)
  [ -z "$n" ] && n=0
  if [ "$n" -ge "$2" ]; then ok "$1 ($n)"; else bad "$1 ($n, need $2)"; fi
}

[ -f package.json ] && [ -d src-tauri ] || { echo "FAIL run this from the repo root"; exit 1; }

echo "== The gate (HANDOFF.md section 5) =="
chk "gate: npm run lint" npm run lint
chk "gate: npx tsc --noEmit" npx tsc --noEmit
chk "gate: npm test" npm test
chk "gate: cargo fmt --check" sh -c 'cd src-tauri && cargo fmt --check'
chk "gate: cargo clippy" sh -c 'cd src-tauri && cargo clippy --all-targets -- -D warnings'
chk "gate: cargo test" sh -c 'cd src-tauri && cargo test'
chk "gate: npm run check (browser checks, Chromium and WebKit)" npm run check

echo "== Rules that hold for the whole iteration =="
chk "not-migrated list only shrank (node scripts/check-not-migrated.mjs)" node scripts/check-not-migrated.mjs
chk "design stylesheet equals the plan's (check-design-sync)" node scripts/check-design-sync.mjs
# The design files are the source of truth: nobody edits them during the iteration (check-design-sync only compares the copy).
chk "design files unchanged (docs/plan/design/SHA256SUMS)" sh -c 'cd docs/plan/design && shasum -a 256 -c SHA256SUMS >/dev/null 2>&1'
chk "mockup comparison passes (check-mockup, WebKit only, needs npm run preview running or started by check-all)" env PW_ENGINE=webkit node scripts/check-mockup.mjs
chk "every class used is defined (check-classes)" node scripts/check-classes.mjs
# migrateStorage moves the old keys to the new ones, so it (and its test) must name them.
chk "no old names left in src (wharf, colima-ui storage keys)" sh -c '! grep -rniE "wharf:|colima-ui:|colima-ui\." src --include=*.ts --include=*.tsx --exclude=migrateStorage.ts --exclude=migrateStorage.test.ts'
EMDASH=$(printf '\342\200\224')
chk "no leftover Design gap marker in the iteration 2 files" sh -c '! grep -n "Design gap\|PROPOSED" docs/plan/iterations/iteration-2-work-orders.md docs/plan/iterations/iteration-2-acceptance.md'
chk "no em dash in the iteration 2 files" sh -c '! cat docs/plan/iterations/iteration-2-*.md docs/plan/iterations/verify-iteration-2.sh docs/plan/iterations/pr/wo-2.*.md docs/plan/iterations/pr/wo-3.*.md 2>/dev/null | grep -q "$1"' sh "$EMDASH"
chk "no TODO or FIXME added in the new files" sh -c '! grep -rnE "TODO|FIXME" src/containers src/lib/router.ts src/lib/routes.ts src/lib/containerRows.ts src/lib/engineModel.ts src/lib/liveStats.ts src/lib/shortcuts.ts src/lib/paletteModel.ts src/lib/inspectorContent.ts src/Header.tsx src/EngineSwitcher.tsx src/Activity.tsx src/ui/op/Palette.tsx src/ui/op/EngineButton.tsx 2>/dev/null'
chk "no style= and no raw button, select or table in the new screen files" sh -c '! grep -nE "<button|<select|<table|style=" src/containers/*.tsx src/Header.tsx src/EngineSwitcher.tsx src/Activity.tsx src/Shell.tsx src/CommandPalette.tsx src/HelpModal.tsx src/Containers.tsx src/ContainerDetail.tsx src/Logs.tsx src/StatsTab.tsx src/RunPanel.tsx src/RunPicker.tsx src/PullPanel.tsx src/ComposeProjects.tsx src/ComposeLogs.tsx'
chk "pull request texts exist for every work order (docs/plan/iterations/pr/)" sh -c 'for id in 2.1 2.2 2.3 2.4 2.5 3.1a 3.1b 3.1b-2 3.1c-1 3.1c-2 3.1c-3 3.2 3.3a 3.3b 3.3c; do test -f docs/plan/iterations/pr/wo-$id.md || exit 1; done'

echo "== WO-2.1 routes =="
present "WO-2.1: router files and tests exist" src/lib/routes.ts src/lib/router.ts src/lib/tabRoutes.ts src/lib/routes.test.ts src/lib/router.test.tsx
has "WO-2.1: parseRoute exported" src/lib/routes.ts "export function parseRoute"
has "WO-2.1: buildPath exported" src/lib/routes.ts "export function buildPath"
has "WO-2.1: useRoute exported" src/lib/router.ts "export function useRoute"
has "WO-2.1: go exported" src/lib/router.ts "export function go"
has "WO-2.1: last route is remembered under openpier:last-route" src/lib/router.ts "openpier:last-route"
# Comment lines may name the gallery (router.ts says where it lives); code lines may not.
chk "WO-2.1: router has no gallery logic (the gallery lives in main.tsx)" sh -c '! grep -v "^[[:space:]]*//" src/lib/router.ts | grep -q gallery'
lacks "WO-2.1: App no longer keeps the tab in useState" src/App.tsx "useState<Tab>"
atleast "WO-2.1: at least 12 route tests" 12 src/lib/routes.test.ts "^test("
atleast "WO-2.1: at least 5 router tests" 5 src/lib/router.test.tsx "^\s*\(it\|test\)("

echo "== WO-2.2 shell =="
present "WO-2.2: Header, liveStats, hook and tests exist" src/Header.tsx src/lib/liveStats.ts src/hooks/useLiveStats.ts src/lib/liveStats.test.ts src/Shell.test.tsx
has "WO-2.2: window has a hidden overlay title bar" src-tauri/tauri.conf.json '"titleBarStyle": "Overlay"'
has "WO-2.2: hiddenTitle is true" src-tauri/tauri.conf.json '"hiddenTitle": true'
has "WO-2.2: minimum width 900" src-tauri/tauri.conf.json '"minWidth": 900'
has "WO-2.2: minimum height 600" src-tauri/tauri.conf.json '"minHeight": 600'
has "WO-2.2: window can be dragged by the app" src-tauri/capabilities/default.json "core:window:allow-start-dragging"
has "WO-2.2: header is a drag region" src/Header.tsx "data-tauri-drag-region"
has "WO-2.2: main.tsx mounts the tooltip provider" src/main.tsx "TooltipProvider"
has "WO-2.2: the shell mounts the toast provider inside .main" src/Shell.tsx "ToastProvider"
has "WO-2.2: the shell mounts the portal provider" src/Shell.tsx "PortalProvider"
has "WO-2.2: sidebar items are NavItem components" src/Shell.tsx "NavItem"
absent "WO-2.2: no AppProviders file" src/AppProviders.tsx
has "WO-2.2: sidebar fold key is openpier:sidebar-folded" src/Shell.tsx "openpier:sidebar-folded"
lacks "WO-2.2: no Runtime select left in the shell" src/Shell.tsx "Runtime"
lacks "WO-2.2: no Switch profile in the shell" src/Shell.tsx "Switch profile"
present "WO-2.2: check-layout and check-restyle are back in scripts/" scripts/check-layout.mjs scripts/check-restyle.mjs
absent "WO-2.2: check-layout and check-restyle left checks-pending" scripts/checks-pending/check-layout.mjs scripts/checks-pending/check-restyle.mjs
chk "WO-2.2: check-layout passes in Chromium" node scripts/check-layout.mjs
chk "WO-2.2: check-layout passes in WebKit" env PW_ENGINE=webkit node scripts/check-layout.mjs
chk "WO-2.2: check-restyle passes in Chromium" node scripts/check-restyle.mjs
chk "WO-2.2: check-restyle passes in WebKit" env PW_ENGINE=webkit node scripts/check-restyle.mjs
chk "WO-2.2: the window config compiles (cargo check)" sh -c 'cd src-tauri && cargo check'
chk "WO-2.2: mockup pairs file has a containers row with a why" sh -c 'grep -q "\"mockup\": \"containers\"" scripts/mockup-pairs.json && grep -q "\"why\"" scripts/mockup-pairs.json'

echo "== WO-2.3 engine switcher =="
present "WO-2.3: files and tests exist" src/lib/engineModel.ts src/lib/engineModel.test.ts src/EngineSwitcher.tsx src/EngineSwitcher.test.tsx
absent "WO-2.3: the legacy profile switch is gone" src/LegacyProfileSwitch.tsx
chk "WO-2.3: no profile picker left (Switch profile, profile-switch)" sh -c '! grep -rnE "Switch profile|profile-switch" src --include=*.tsx --include=*.ts'
has "WO-2.3: choice kept under openpier:engine" src/App.tsx "openpier:engine"
present "WO-2.3: Menu radio item, EngineButton and their tests exist" src/ui/op/EngineButton.tsx src/ui/op/EngineButton.test.tsx
has "WO-2.3: Menu has a radio item" src/ui/op/Menu.tsx "MenuRadioItem"
has "WO-2.3: Menu can be controlled" src/ui/op/Menu.tsx "onOpenChange"
has "WO-2.3: Menu takes a content class (engines popover)" src/ui/op/Menu.tsx "contentClassName"
has "WO-2.3: the popover uses the engines class" src/EngineSwitcher.tsx "engines"
has "WO-2.3: Machines item" src/EngineSwitcher.tsx "Machines…"
has "WO-2.3: Stop item with the hint from the mockup" src/EngineSwitcher.tsx "Stops the VM. Containers and data are kept"
has "WO-2.3: Machines hint from the mockup" src/EngineSwitcher.tsx "Create, resize or delete a Colima VM"
lacks "WO-2.3: popover does not say profile" src/EngineSwitcher.tsx "profile"
atleast "WO-2.3: check-layout has the switcher lines" 20 scripts/check-layout.mjs "check("

echo "== WO-2.4 palette, Help, Activity =="
present "WO-2.4: Palette component and its test exist" src/ui/op/Palette.tsx src/ui/op/Palette.test.tsx
has "WO-2.4: Palette uses the portal container" src/ui/op/Palette.tsx "usePortalContainer"
has "WO-2.4: Palette words when nothing matches" src/ui/op/Palette.tsx "Nothing matches"
present "WO-2.4: files and tests exist" src/lib/shortcuts.ts src/lib/shortcuts.test.ts src/lib/paletteModel.ts src/lib/paletteModel.test.ts src/Activity.tsx src/CommandPalette.test.tsx src/HelpModal.test.tsx scripts/check-palette.mjs
has "WO-2.4: SHORTCUTS table exists" src/lib/shortcuts.ts "export const SHORTCUTS"
has "WO-2.4: Projects shortcut is pending until WO-7.5" src/lib/shortcuts.ts "pending: true"
chk "WO-2.4: no Cmd+0 to Cmd+7 style entries left in App" sh -c '! grep -nE "key: \"(0|7)\", meta: true" src/App.tsx'
chk "WO-2.4: Help has no Portuguese text" sh -c '! grep -nE "Atalhos|Fechar" src/HelpModal.tsx'
has "WO-2.4: Help links to feedback" src/HelpModal.tsx "Give feedback"
has "WO-2.4: Cmd+R refresh event listened in usePoll" src/hooks.ts "openpier:refresh"
lacks "WO-2.4: Commands.tsx has no Drawer" src/Commands.tsx "<Drawer"
chk "WO-2.4: check-palette passes in Chromium" node scripts/check-palette.mjs
chk "WO-2.4: check-palette passes in WebKit" env PW_ENGINE=webkit node scripts/check-palette.mjs

echo "== WO-2.5 fixes from the review =="
lacks "WO-2.5: palette no longer draws every caption first" src/ui/op/Palette.tsx "sections.map((section, si) => ("
has "WO-2.5: palette groups entries under their caption" src/ui/op/Palette.tsx "<Fragment key={section.group}>"
has "WO-2.5: palette order test" src/ui/op/Palette.test.tsx "Then the order of captions and options"
has "WO-2.5: Settings button marks the page" src/Shell.tsx 'aria-current={settingsActive ? "page" : undefined}'
has "WO-2.5: App passes the Containers count" src/App.tsx "counts={{ containers: containerCount }}"
has "WO-2.5: the count leaves out Kubernetes pods" src/App.tsx 'owner(toApp(c as Inspect)) !== "kubernetes"'
atleast "WO-2.5: check-restyle keeps its old lines" 7 scripts/check-restyle.mjs "check("
chk "WO-2.5: check-restyle passes in Chromium" node scripts/check-restyle.mjs
chk "WO-2.5: check-restyle passes in WebKit" env PW_ENGINE=webkit node scripts/check-restyle.mjs
chk "WO-2.5: every pull request of WO-2.x has Contract differences" sh -c 'for id in 2.1 2.2 2.3 2.4 2.5; do grep -q "## Contract differences" docs/plan/iterations/pr/wo-$id.md || exit 1; done'

echo "== WO-2.6 the app picks its engine at startup =="
has "WO-2.6: the registry activates the first engine that answers" src/runtime/index.ts "async activateFirstAvailable()"
has "WO-2.6: App activates the engine at startup" src/App.tsx "runtimeRegistry.activateFirstAvailable()"
lacks "WO-2.6: the preview no longer chooses the engine for the app" preview/mock.ts "runtimeRegistry.setActive"
has "WO-2.6: the preview answers colima_version" preview/mock.ts 'case "colima_version"'
has "WO-2.6: registry test, Colima becomes active" src/runtime/index.test.tsx "Then Colima is the active engine"
has "WO-2.6: registry test, nothing answers" src/runtime/index.test.tsx "Then it returns null and no engine is active"
has "WO-2.6: registry test, keeps the active engine" src/runtime/index.test.tsx "Then it keeps that engine and asks nothing"
has "WO-2.6: registry test, half-built engines are not chosen" src/runtime/index.test.tsx "Given only podman_version answers"
has "WO-2.6: App activates inside reloadProfiles" src/App.tsx "runtimeRegistry.getActive() ?? (await runtimeRegistry.activateFirstAvailable())"
chk "WO-2.6: registry tests pass" npx vitest run src/runtime/index.test.tsx
atleast "WO-2.6: check-engine-start has its five lines" 5 scripts/check-engine-start.mjs "check("
has "WO-2.6: check-engine-start opens the running scenario" scripts/check-engine-start.mjs "scenario=running"
has "WO-2.6: check-engine-start opens the stopped scenario" scripts/check-engine-start.mjs "scenario=stopped"
has "WO-2.6: check-engine-start opens the none scenario" scripts/check-engine-start.mjs "scenario=none"
has "WO-2.6: check-engine-start opens the unreachable scenario" scripts/check-engine-start.mjs "scenario=unreachable"
has "WO-2.6: check-engine-start opens the missing scenario" scripts/check-engine-start.mjs "scenario=missing"
has "WO-2.6: check-engine-start looks for the onboarding words" scripts/check-engine-start.mjs "Start your first VM"
lacks "WO-2.6: check-engine-start has no empty check" scripts/check-engine-start.mjs "check(true"
chk "WO-2.6: check-engine-start passes in Chromium" node scripts/check-engine-start.mjs
chk "WO-2.6: check-engine-start passes in WebKit" env PW_ENGINE=webkit node scripts/check-engine-start.mjs

echo "== WO-3.1a row model =="
present "WO-3.1a: files exist" src/lib/containerRows.ts src/lib/containerRows.test.ts
has "WO-3.1a: the dot type is DotState from ui/op" src/lib/containerRows.ts "DotState"
lacks "WO-3.1a: no second Dot type" src/lib/containerRows.ts "export type Dot ="
has "WO-3.1a: stateView" src/lib/containerRows.ts "export function stateView"
has "WO-3.1a: flatten" src/lib/containerRows.ts "export function flatten"
has "WO-3.1a: sortEntries" src/lib/containerRows.ts "export function sortEntries"
atleast "WO-3.1a: at least 30 tests" 30 src/lib/containerRows.test.ts "^test("

echo "== WO-3.1b Containers screen =="
present "WO-3.1b: new containers files exist" src/containers/ContainerRows.tsx src/containers/NewMenu.tsx src/containers/SelectionBar.tsx src/containers/ProblemInspector.tsx src/lib/inspectorContent.ts
has "WO-3.1b: Row has a menu key hook" src/ui/op/Row.tsx "onMenuKey"
has "WO-3.1b: New menu words" src/containers/NewMenu.tsx "Start a Compose project"
lacks "WO-3.1b: no Bring over in the New menu (WO-3.11 builds it)" src/containers/NewMenu.tsx "Bring over"
has "WO-3.1b: the search field uses the search width" src/Containers.tsx "width=\"search\""
has "WO-3.1b: the row menu trigger is MoreButton" src/containers/ContainerRows.tsx "MoreButton"
has "WO-3.1b: header is the new Header" src/Containers.tsx "Header"
lacks "WO-3.1b: no old small buttons" src/Containers.tsx 'className="small"'
lacks "WO-3.1b: no old home.css" src/Containers.tsx "home.css"
atleast "WO-3.1b: Containers draws its rows with EntryRow" 1 src/Containers.tsx "<EntryRow"
atleast "WO-3.1b: Containers draws project services with ChildRow" 1 src/Containers.tsx "<ChildRow"
chk "WO-3.1b: no old row markup left in Containers" sh -c '! grep -qE "app-row|svc-row|app-chev|app-state|className=\"home\"|start-first" src/Containers.tsx'
chk "WO-3.1b: Containers.tsx is off the not-migrated list" sh -c '! grep -q "src/Containers.tsx" scripts/not-migrated.json'
chk "WO-3.1b: the new component tests pass" npx vitest run src/containers

echo "== WO-3.1c states, checks and migrated tests =="
present "WO-3.1c: check-containers and check-menus exist" scripts/check-containers.mjs scripts/check-menus.mjs
absent "WO-3.1c: old home, select, down checks are gone from scripts/" scripts/check-home.mjs scripts/check-select.mjs scripts/check-down.mjs
absent "WO-3.1c: four old checks left checks-pending" scripts/checks-pending/check-home.mjs scripts/checks-pending/check-down.mjs scripts/checks-pending/check-menus.mjs scripts/checks-pending/check-select.mjs
atleast "WO-3.1c: check-containers keeps its old lines" 100 scripts/check-containers.mjs "check("
has "WO-3.1c: scenario loading" preview/mock.ts '"loading"'
has "WO-3.1c: scenario unreachable" preview/mock.ts '"unreachable"'
has "WO-3.1c: failstart parameter" preview/mock.ts "failstart"
has "WO-3.1c: stopped state words (mockup)" src/Containers.tsx "Your containers and data are kept."
has "WO-3.1c: empty state words" src/Containers.tsx "No containers yet"
has "WO-3.1c: error banner words" src/Containers.tsx "Couldn't list containers"
chk "WO-3.1c: check-containers passes in Chromium" node scripts/check-containers.mjs
chk "WO-3.1c: check-containers passes in WebKit" env PW_ENGINE=webkit node scripts/check-containers.mjs
chk "WO-3.1c: check-menus passes in Chromium" node scripts/check-menus.mjs
chk "WO-3.1c: check-menus passes in WebKit" env PW_ENGINE=webkit node scripts/check-menus.mjs
chk "WO-3.1c: Containers.test.tsx keeps at least the 21 old tests" sh -c 'test "$(grep -cE "^[[:space:]]*(it|test)\(" src/Containers.test.tsx)" -ge 21'
# Every old test (as of 36a499b, the last commit before WO-3.1c) is in the new file, or named in the pull request table.
chk "WO-3.1c: every old Containers test is kept or has a row in the table" node -e 'const {execSync}=require("child_process");const fs=require("fs");const old=[...execSync("git show 36a499b:src/Containers.test.tsx").toString().matchAll(/^\s*it\("([^"]+)"/gm)].map(m=>m[1]);const now=fs.readFileSync("src/Containers.test.tsx","utf8");const pr=fs.existsSync("docs/plan/iterations/pr/wo-3.1c-2.md")?fs.readFileSync("docs/plan/iterations/pr/wo-3.1c-2.md","utf8"):"";const miss=old.filter(n=>!now.includes(n)&&!pr.includes(n.slice(0,60)));if(miss.length){console.error(miss.join("\n"));process.exit(1)}'
atleast "WO-3.1c: the pull request table has a row per old test" 22 docs/plan/iterations/pr/wo-3.1c-2.md "^| "
has "WO-3.1c: the Stop test still proves Stopping…" src/Containers.test.tsx "Stopping…"
chk "WO-3.1c: mockup rows (WebKit) for containers, empty-state and machine-stopped" sh -c 'grep -q "\"empty-state\"" scripts/mockup-pairs.json && grep -q "\"machine-stopped\"" scripts/mockup-pairs.json && grep -q "\"containers\"" scripts/mockup-pairs.json'
chk "WO-3.1c: no mockup row above 0.02 without a why" node -e 'const r=JSON.parse(require("fs").readFileSync("scripts/mockup-pairs.json","utf8"));const b=r.filter(x=>x.threshold>0.02&&!(x.why&&x.why.length>10));if(b.length){console.error(b.map(x=>x.mockup).join(","));process.exit(1)}'
chk "WO-3.1c: no mockup row has a threshold above 0.05" node -e 'const r=JSON.parse(require("fs").readFileSync("scripts/mockup-pairs.json","utf8"));process.exit(r.some(x=>x.threshold>0.05)?1:0)'

echo "== WO-3.2 container detail =="
has "WO-3.2: detail comes from the route" src/App.tsx "buildPath"
has "WO-3.2: the Logs controls sit in the Tabs aside" src/ContainerDetail.tsx "aside="
has "WO-3.2: the facts line is the Facts component" src/ContainerDetail.tsx "<Facts"
has "WO-3.2: the log fills the page" src/Logs.tsx "fill"
has "WO-3.2: tabs have the new words" src/ContainerDetail.tsx "Folders"
has "WO-3.2: History tab" src/ContainerDetail.tsx "History"
lacks "WO-3.2: old tab name Mounts gone" src/ContainerDetail.tsx '"Mounts"'
lacks "WO-3.2: old tab name Inspect gone" src/ContainerDetail.tsx '"Inspect"'
chk "WO-3.2: logs keep 10,000 lines" grep -qE "10_?000" src/Logs.tsx
has "WO-3.2: filter field" src/Logs.tsx "Filter lines"
has "WO-3.2: Follow chip" src/ContainerDetail.tsx "Follow"
present "WO-3.2: detail tests exist" src/ContainerDetail.test.tsx src/Logs.test.tsx
absent "WO-3.2: observe and mounts left checks-pending" scripts/checks-pending/check-observe.mjs scripts/checks-pending/check-mounts.mjs
atleast "WO-3.2: check-observe keeps its old lines" 40 scripts/check-observe.mjs "check("
atleast "WO-3.2: check-mounts keeps its old lines" 70 scripts/check-mounts.mjs "check("
chk "WO-3.2: check-observe passes in Chromium" node scripts/check-observe.mjs
chk "WO-3.2: check-observe passes in WebKit" env PW_ENGINE=webkit node scripts/check-observe.mjs
chk "WO-3.2: check-mounts passes in Chromium" node scripts/check-mounts.mjs
chk "WO-3.2: check-mounts passes in WebKit" env PW_ENGINE=webkit node scripts/check-mounts.mjs
chk "WO-3.2: ContainerDetail, Logs, StatsTab are off the not-migrated list" sh -c '! grep -qE "src/(ContainerDetail|Logs|StatsTab).tsx" scripts/not-migrated.json'
chk "WO-3.2: detail mockup row exists" sh -c 'grep -q "\"container-detail\"" scripts/mockup-pairs.json'

echo "== WO-3.3a Run sheet =="
has "WO-3.3a: the Run sheet lays side by side fields with Fields" src/RunPanel.tsx "<Fields"
has "WO-3.3a: Run sheet title words" src/RunPanel.tsx "Run "
lacks "WO-3.3a: RunPanel has no Drawer" src/RunPanel.tsx "Drawer"
lacks "WO-3.3a: RunPicker has no Drawer" src/RunPicker.tsx "Drawer"
has "WO-3.3a: taken port button words" src/RunPanel.tsx "instead"
has "WO-3.3a: Settings the image needs" src/RunPanel.tsx "Settings the image needs"
has "WO-3.3a: Keep its data" src/RunPanel.tsx "Keep its data"
has "WO-3.3a: More options" src/RunPanel.tsx "More options"
has "WO-3.3a: Show command" src/RunPanel.tsx "Show command"
present "WO-3.3a: RunPanel test exists" src/RunPanel.test.tsx
absent "WO-3.3a: check-guided left checks-pending" scripts/checks-pending/check-guided.mjs
atleast "WO-3.3a: check-guided keeps its old lines" 28 scripts/check-guided.mjs "check("
chk "WO-3.3a: check-guided passes in Chromium" node scripts/check-guided.mjs
chk "WO-3.3a: check-guided passes in WebKit" env PW_ENGINE=webkit node scripts/check-guided.mjs

echo "== WO-3.3b Pull sheet =="
lacks "WO-3.3b: PullPanel has no Drawer" src/PullPanel.tsx "Drawer"
lacks "WO-3.3b: PullPanel has no old out-log box" src/PullPanel.tsx "out-log"
has "WO-3.3b: progress is the Progress component" src/PullPanel.tsx "<Progress"
present "WO-3.3b: pullProgress and its test exist" src/lib/pullProgress.ts src/lib/pullProgress.test.ts
has "WO-3.3b: Other registry" src/PullPanel.tsx "Other registry"
has "WO-3.3b: searching downloads nothing, kept" src/PullPanel.tsx "nothing is downloaded"
present "WO-3.3b: PullPanel test exists" src/PullPanel.test.tsx
absent "WO-3.3b: check-pull left checks-pending" scripts/checks-pending/check-pull.mjs
atleast "WO-3.3b: check-pull keeps its old lines" 27 scripts/check-pull.mjs "check("
chk "WO-3.3b: check-pull passes in Chromium" node scripts/check-pull.mjs
chk "WO-3.3b: check-pull passes in WebKit" env PW_ENGINE=webkit node scripts/check-pull.mjs

echo "== WO-3.3c Compose sheet =="
lacks "WO-3.3c: ComposeProjects has no Drawer" src/ComposeProjects.tsx "<Drawer"
lacks "WO-3.3c: ComposeLogs has no Drawer" src/ComposeLogs.tsx "<Drawer"
lacks "WO-3.3c: Containers has no Drawer" src/Containers.tsx "<Drawer"
has "WO-3.3c: sheet title" src/ComposeProjects.tsx "Start a Compose project"
has "WO-3.3c: Choose a folder" src/ComposeProjects.tsx "Choose a folder…"
absent "WO-3.3c: check-compose left checks-pending" scripts/checks-pending/check-compose.mjs
atleast "WO-3.3c: check-compose keeps its old lines" 55 scripts/check-compose.mjs "check("
chk "WO-3.3c: check-compose passes in Chromium" node scripts/check-compose.mjs
chk "WO-3.3c: check-compose passes in WebKit" env PW_ENGINE=webkit node scripts/check-compose.mjs
chk "WO-3.3c: old checks still pending are only those of iteration 3" sh -c 'for f in check-layout check-restyle check-home check-down check-menus check-select check-observe check-mounts check-compose check-guided check-pull; do test ! -e scripts/checks-pending/$f.mjs || exit 1; done'
chk "WO-3.3c: the pending folder shrank (iteration 3 owns what is left)" sh -c 'for f in scripts/checks-pending/*.mjs; do case "$(basename $f)" in check-disk.mjs|check-volumes.mjs|check-network.mjs|check-netfix.mjs|check-k8s.mjs|check-doctor.mjs|check-resize.mjs|check-setup.mjs|check-bring.mjs|check-bring-home.mjs|check-replace.mjs|check-a11y.mjs) ;; *) exit 1;; esac; done'

echo "== Totals =="
echo "$PASS ok, $FAIL FAIL"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
