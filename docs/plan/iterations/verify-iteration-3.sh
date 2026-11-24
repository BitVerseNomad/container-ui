#!/bin/sh
# Checks iteration 3 (Images, Volumes, Networks, Kubernetes, Doctor, Settings, Setup, Bring over).
# Run from the repo root: sh docs/plan/iterations/verify-iteration-3.sh
# Read-only: it builds and runs tests, and never runs docker, colima, limactl, kubectl or brew.
# Each check prints "ok <what>" or "FAIL <what>". Exit 1 if any failed.

pass=0
fail=0
ok() { echo "ok $1"; pass=$((pass + 1)); }
bad() { echo "FAIL $1"; fail=$((fail + 1)); }
# run <what> <command...>: ok when the command exits 0
run() { what=$1; shift; if "$@" >/dev/null 2>&1; then ok "$what"; else bad "$what"; fi; }
# sh_ok <what> <shell text>
sh_ok() { if sh -c "$2" >/dev/null 2>&1; then ok "$1"; else bad "$1"; fi; }
# count_is <what> <expected> <shell text that prints a number>
count_is() { got=$(sh -c "$3" 2>/dev/null | tr -d ' \n'); if [ "$got" = "$2" ]; then ok "$1"; else bad "$1 (expected $2, got '$got')"; fi; }
# out_not_in_list <file>: file is not named in scripts/not-migrated.json
not_listed() { count_is "$1 is out of scripts/not-migrated.json" "false" "node -e 'console.log(require(\"./scripts/not-migrated.json\").includes(\"$1\"))'"; }
# clean_markup <file>...: no raw button, select, table or inline style
clean_markup() { count_is "$* have no <button, <select, <table or style=" "0" "grep -nE '<button|<select|<table|style=' $* | wc -l"; }

if [ ! -f package.json ] || [ ! -d docs/plan ]; then echo "FAIL run this from the repo root"; exit 1; fi

echo "== The gate"
run "npm run lint" npm run lint
run "npx tsc --noEmit" npx tsc --noEmit
run "npm test" npm test
run "cargo fmt --check" sh -c "cd src-tauri && cargo fmt --check"
run "cargo clippy -D warnings" sh -c "cd src-tauri && cargo clippy --all-targets -- -D warnings"
run "cargo test" sh -c "cd src-tauri && cargo test"
run "npm run check (browser checks, Chromium and WebKit)" npm run check

echo "== Iteration-wide"
count_is "scripts/checks-pending holds no check-*.mjs" "0" "ls scripts/checks-pending/check-*.mjs 2>/dev/null | wc -l"
run "check-not-migrated passes (the list only shrinks)" node scripts/check-not-migrated.mjs
run "check-messages-kept passes (no old check message lost)" node scripts/check-messages-kept.mjs
run "check-design-sync passes (src/ui/container-ui.css equals the design copy)" node scripts/check-design-sync.mjs
run "check-classes passes" node scripts/check-classes.mjs
count_is "dropped-checks.json has at most 12 entries in total" "ok" "node -e 'const d=require(\"./scripts/dropped-checks.json\");const n=Object.values(d).reduce((a,b)=>a+b.length,0);console.log(n<=12?\"ok\":n)'"
count_is "every dropped check has a reason" "0" "node -e 'const d=require(\"./scripts/dropped-checks.json\");console.log(Object.values(d).flat().filter(x=>!x.why||!x.message).length)'"
count_is "no mockup pair above 0.02 without a why" "0" "node -e 'const p=require(\"./scripts/mockup-pairs.json\");console.log(p.filter(r=>r.threshold>0.02&&!r.why).length)'"
count_is "no mockup pair above 0.005 in this iteration's screens" "0" "node -e 'const names=[\"images\",\"volumes\",\"networks\",\"kubernetes\",\"doctor\",\"settings-machines\",\"setup\"];const p=require(\"./scripts/mockup-pairs.json\");console.log(p.filter(r=>names.includes(r.mockup)&&r.threshold>0.005).length)'"
count_is "no TODO, FIXME or XXX in the files of this iteration" "0" "grep -nE 'TODO|FIXME|XXX' src/Images.tsx src/Volumes.tsx src/Networks.tsx src/ConnectionTest.tsx src/Kubernetes.tsx src/PodSheet.tsx src/Doctor.tsx src/FixIt.tsx src/Health.tsx src/Resize.tsx src/VmStrip.tsx src/Settings.tsx src/settings/*.tsx src/Setup.tsx src/InstallCard.tsx src/InstallTool.tsx src/BringOver.tsx 2>/dev/null | wc -l"
count_is "the migrated files import new components from ui/op, never the old index" "0" "grep -nE \"from \\\"(\\./|\\.\\./)+ui\\\"|from \\\"(\\./|\\.\\./)+ui/index\\\"\" src/Images.tsx src/Volumes.tsx src/Networks.tsx src/ConnectionTest.tsx src/Kubernetes.tsx src/PodSheet.tsx src/Doctor.tsx src/FixIt.tsx src/Health.tsx src/Resize.tsx src/VmStrip.tsx src/Settings.tsx src/settings/*.tsx src/Setup.tsx src/InstallCard.tsx src/InstallTool.tsx src/BringOver.tsx 2>/dev/null | wc -l"
count_is "the migrated files do not import the old Ticks, OutputLog or Drawer" "0" "grep -nE 'ui/Ticks|ui/OutputLog|Drawer' src/Images.tsx src/Volumes.tsx src/Networks.tsx src/ConnectionTest.tsx src/Kubernetes.tsx src/PodSheet.tsx src/Doctor.tsx src/FixIt.tsx src/Health.tsx src/Resize.tsx src/VmStrip.tsx src/Settings.tsx src/settings/*.tsx src/Setup.tsx src/InstallCard.tsx src/InstallTool.tsx src/BringOver.tsx 2>/dev/null | wc -l"
count_is "every WO of this iteration has a PR text file" "9" "ls docs/plan/iterations/pr/wo-3.4.md docs/plan/iterations/pr/wo-3.5.md docs/plan/iterations/pr/wo-3.6.md docs/plan/iterations/pr/wo-3.7.md docs/plan/iterations/pr/wo-3.8a.md docs/plan/iterations/pr/wo-3.8b.md docs/plan/iterations/pr/wo-3.9.md docs/plan/iterations/pr/wo-3.10.md docs/plan/iterations/pr/wo-3.11.md 2>/dev/null | wc -l"

echo "== WO-P.1 preview port per worktree (docs/plan/PARALLEL.md) =="
has "WO-P.1: the preview reads PREVIEW_PORT" vite.preview.config.ts "process.env.PREVIEW_PORT"
has "WO-P.1: check-all passes the port to every check" scripts/check-all.sh 'export PREVIEW_URL="$url"'
present "WO-P.1: pull request text" docs/plan/iterations/pr/wo-P.1.md

echo "== WO-3.4 Images"
for f in src/Images.tsx src/DiskCard.tsx; do not_listed "$f"; done
sh_ok "src/DiskCard.tsx is deleted" "test ! -e src/DiskCard.tsx"
clean_markup src/Images.tsx
sh_ok "src/lib/rows.ts, rows.test.ts, ticks.tsx and useOutput.ts exist" "test -f src/lib/rows.ts && test -f src/lib/rows.test.ts && test -f src/lib/ticks.tsx && test -f src/lib/useOutput.ts"
sh_ok "preview/states.ts and scripts/lib/states.mjs exist" "test -f preview/states.ts && test -f scripts/lib/states.mjs"
sh_ok "mock exposes unreach, holdNext and failOnce" "grep -q 'stateApi' preview/mock.ts && grep -q 'holdNext' preview/states.ts && grep -q 'failOnce' preview/states.ts && grep -q 'unreach' preview/states.ts"
sh_ok "check-baselines tools exist" "test -f scripts/make-baseline.mjs && test -f scripts/check-messages-kept.mjs && test -f scripts/dropped-checks.json && test -f scripts/check-baselines/check-disk.messages.txt"
sh_ok "check-disk.mjs and check-images.mjs are in scripts/" "test -f scripts/check-disk.mjs && test -f scripts/check-images.mjs"
sh_ok "Images words: tile captions and menu items are in the file" "grep -q 'Space inside the VM' src/Images.tsx && grep -q 'Show in Containers' src/Images.tsx && grep -q 'Show in Volumes' src/Images.tsx && grep -q 'Pull again' src/Images.tsx && grep -q 'Copy name' src/Images.tsx"
sh_ok "Images rows use Dim and the id and age column kinds" "grep -q 'Dim' src/Images.tsx && grep -q 'kind=\"id\"' src/Images.tsx && grep -q 'kind=\"age\"' src/Images.tsx"
sh_ok "mockup pair: images" "node -e 'process.exit(require(\"./scripts/mockup-pairs.json\").some(r=>r.mockup===\"images\"&&r.themes.length===2)?0:1)'"
run "check-disk in Chromium" env PW_ENGINE=chromium node scripts/check-disk.mjs
run "check-disk in WebKit" env PW_ENGINE=webkit node scripts/check-disk.mjs
run "check-images in Chromium" env PW_ENGINE=chromium node scripts/check-images.mjs
run "check-images in WebKit" env PW_ENGINE=webkit node scripts/check-images.mjs

echo "== WO-3.5 Volumes"
not_listed src/Volumes.tsx
clean_markup src/Volumes.tsx
sh_ok "Volumes: Remove unused… and group captions present" "grep -q 'Remove unused…' src/Volumes.tsx && grep -q 'In use' src/Volumes.tsx && grep -q 'Not used' src/Volumes.tsx && grep -q 'Only volumes with no name' src/Volumes.tsx"
count_is "Volumes: no sort, filter, bulk-select or Show what's inside" "0" "grep -nE \"Sort|Filter|Show what's inside|selectAll\" src/Volumes.tsx | wc -l"
sh_ok "Volumes: the confirm uses the one-checkbox option, with no body component or ref workaround" "grep -q 'option:' src/Volumes.tsx && ! grep -q 'RemoveUnusedBody' src/Volumes.tsx && grep -q 'Dim' src/Volumes.tsx"
sh_ok "Volumes: the dockerLocked rule is still used" "grep -q 'useDockerLocked\\|dockerLocked' src/Volumes.tsx"
sh_ok "removalPlan exists and is tested" "grep -q 'removalPlan' src/lib/volumes.ts && grep -q 'removalPlan' src/lib/volumes.test.ts"
sh_ok "check-volumes.mjs is in scripts/ with its baseline" "test -f scripts/check-volumes.mjs && test -f scripts/check-baselines/check-volumes.messages.txt && test ! -e scripts/checks-pending/check-volumes.mjs"
sh_ok "mockup pair: volumes" "node -e 'process.exit(require(\"./scripts/mockup-pairs.json\").some(r=>r.mockup===\"volumes\")?0:1)'"
run "check-volumes in Chromium" env PW_ENGINE=chromium node scripts/check-volumes.mjs
run "check-volumes in WebKit" env PW_ENGINE=webkit node scripts/check-volumes.mjs

echo "== WO-3.6 Networks"
for f in src/Networks.tsx src/ConnectionTest.tsx; do not_listed "$f"; done
clean_markup src/Networks.tsx src/ConnectionTest.tsx
count_is "the teaching paragraph is gone" "0" "grep -rn \"doesn't do name lookup\" src --include=*.tsx | grep -v 'test\\.' | wc -l"
sh_ok "Networks words: Yours, Built in, Test a connection, Move to, hint" "grep -q 'Yours' src/Networks.tsx && grep -q 'Built in' src/Networks.tsx && grep -q 'Test a connection' src/Networks.tsx && grep -q 'Move to' src/Networks.tsx && grep -q 'Connecting only adds. Nothing is restarted.' src/Networks.tsx"
sh_ok "Networks use Col subnet, Members and a stacked Sheet for New network" "grep -q 'kind=\"subnet\"' src/Networks.tsx && grep -q 'Members' src/Networks.tsx && grep -q '<Sheet' src/Networks.tsx && grep -q 'stack' src/Networks.tsx"
sh_ok "moveTarget exists and is tested" "grep -q 'moveTarget' src/lib/network.ts && grep -q 'moveTarget' src/lib/network.test.ts"
sh_ok "check-network.mjs is in scripts/ with its baseline" "test -f scripts/check-network.mjs && test -f scripts/check-baselines/check-network.messages.txt && test ! -e scripts/checks-pending/check-network.mjs"
sh_ok "mockup pair: networks" "node -e 'process.exit(require(\"./scripts/mockup-pairs.json\").some(r=>r.mockup===\"networks\")?0:1)'"
run "check-network in Chromium" env PW_ENGINE=chromium node scripts/check-network.mjs
run "check-network in WebKit" env PW_ENGINE=webkit node scripts/check-network.mjs

echo "== WO-3.7 Kubernetes"
for f in src/Kubernetes.tsx src/PodDrawer.tsx; do not_listed "$f"; done
sh_ok "PodDrawer.tsx is renamed to PodSheet.tsx" "test ! -e src/PodDrawer.tsx && test -f src/PodSheet.tsx"
clean_markup src/Kubernetes.tsx src/PodSheet.tsx
sh_ok "podStatus helper and its test exist, and it is built on podProblems" "test -f src/lib/podStatus.ts && test -f src/lib/podStatus.test.ts && grep -q 'podProblems' src/lib/podStatus.ts"
sh_ok "Kubernetes rows use the ready, restarts, state-words and age-short columns" "grep -q 'kind=\"ready\"' src/Kubernetes.tsx && grep -q 'kind=\"restarts\"' src/Kubernetes.tsx && grep -q 'kind=\"state-words\"' src/Kubernetes.tsx && grep -q 'kind=\"age-short\"' src/Kubernetes.tsx"
sh_ok "Kubernetes words are present" "grep -q 'Open in k9s' src/Kubernetes.tsx && grep -q 'Need attention' src/Kubernetes.tsx && grep -q 'All namespaces' src/Kubernetes.tsx"
count_is "the old Needs attention block is gone" "0" "grep -n 'Needs attention' src/Kubernetes.tsx | wc -l"
sh_ok "check-k8s.mjs is in scripts/ with its baseline" "test -f scripts/check-k8s.mjs && test -f scripts/check-baselines/check-k8s.messages.txt && test ! -e scripts/checks-pending/check-k8s.mjs"
sh_ok "mockup pair: kubernetes" "node -e 'process.exit(require(\"./scripts/mockup-pairs.json\").some(r=>r.mockup===\"kubernetes\")?0:1)'"
run "check-k8s in Chromium" env PW_ENGINE=chromium node scripts/check-k8s.mjs
run "check-k8s in WebKit" env PW_ENGINE=webkit node scripts/check-k8s.mjs

echo "== WO-3.8a Doctor"
not_listed src/Doctor.tsx
clean_markup src/Doctor.tsx
sh_ok "Doctor words: groups, folded lines, Check again, empty state" "grep -q 'Needs action' src/Doctor.tsx && grep -q 'Worth knowing' src/Doctor.tsx && grep -q 'Passed' src/Doctor.tsx && grep -q 'Hidden by you' src/Doctor.tsx && grep -q 'Check again' src/Doctor.tsx && grep -q 'Nothing needs action' src/Doctor.tsx && grep -q 'Show how' src/Doctor.tsx && grep -q 'Not an issue' src/Doctor.tsx"
sh_ok "Doctor rows are Row tall, and the folded lines are ChipButtons with an icon" "grep -q 'tall' src/Doctor.tsx && grep -q 'ChipButton' src/Doctor.tsx && grep -q 'aria-expanded' src/Doctor.tsx"
sh_ok "inspectorContent returns the Inspector prop names" "grep -q 'lede' src/lib/inspectorContent.ts && ! grep -q 'paragraph' src/lib/inspectorContent.ts"
sh_ok "Doctor still exports useMuted, useDoctor and groups" "grep -q 'export function useMuted\\|export const useMuted' src/Doctor.tsx && grep -q 'useDoctor' src/Doctor.tsx && grep -q 'groups' src/Doctor.tsx"
sh_ok "fixKind exists and is tested" "grep -q 'fixKind' src/lib/doctor.ts && grep -q 'fixKind' src/lib/doctor.test.ts"
sh_ok "check-doctor.mjs and check-netfix.mjs are in scripts/ with baselines" "test -f scripts/check-doctor.mjs && test -f scripts/check-netfix.mjs && test -f scripts/check-baselines/check-doctor.messages.txt && test -f scripts/check-baselines/check-netfix.messages.txt && test ! -e scripts/checks-pending/check-doctor.mjs && test ! -e scripts/checks-pending/check-netfix.mjs"
sh_ok "mockup pair: doctor has a mask for the live time and a why" "node -e 'const r=require(\"./scripts/mockup-pairs.json\").find(r=>r.mockup===\"doctor\");process.exit(r&&r.mask.length>0&&r.why?0:1)'"
run "check-doctor in Chromium" env PW_ENGINE=chromium node scripts/check-doctor.mjs
run "check-doctor in WebKit" env PW_ENGINE=webkit node scripts/check-doctor.mjs
run "check-netfix in Chromium" env PW_ENGINE=chromium node scripts/check-netfix.mjs
run "check-netfix in WebKit" env PW_ENGINE=webkit node scripts/check-netfix.mjs

echo "== WO-3.8b FixIt and Health"
for f in src/FixIt.tsx src/Health.tsx; do not_listed "$f"; done
clean_markup src/FixIt.tsx src/Health.tsx
sh_ok "FixIt keeps the strings the checks assert (Fixing…, Fixed.)" "grep -q 'Fixing…' src/FixIt.tsx && grep -q 'Fixed\\.' src/FixIt.tsx"

echo "== WO-3.9 Settings"
for f in src/Profiles.tsx src/Resize.tsx src/EditPanel.tsx src/VmStrip.tsx; do not_listed "$f"; done
sh_ok "Profiles.tsx and EditPanel.tsx are gone" "test ! -e src/Profiles.tsx && test ! -e src/EditPanel.tsx"
sh_ok "Settings files exist" "test -f src/Settings.tsx && test -f src/settings/General.tsx && test -f src/settings/Machines.tsx && test -f src/settings/Engines.tsx && test -f src/settings/Updates.tsx && test -f src/settings/About.tsx"
clean_markup src/Resize.tsx src/VmStrip.tsx src/Settings.tsx src/settings/*.tsx
sh_ok "index.html sets data-theme before first paint" "grep -q 'data-theme' index.html && grep -q 'container-ui:theme' index.html && grep -q 'prefers-color-scheme' index.html"
sh_ok "theme and version helpers and tests exist" "test -f src/lib/theme.ts && test -f src/lib/theme.test.ts && test -f src/lib/version.ts"
count_is "no user-visible Profile or Profiles left" "0" "grep -rnE '\"[^\"]*\\bProfiles?\\b[^\"]*\"|>[^<{]*\\bProfiles?\\b[^<]*<' src --include=*.tsx | grep -v 'import\\|from \"\\|test\\.' | wc -l"
count_is "no old storage key prefix is left anywhere in src" "0" "grep -rn 'colima-ui\\.\\|wharf:' src --include=*.ts --include=*.tsx | grep -v 'test\\.' | wc -l"
sh_ok "Settings words: five sections and New machine" "grep -q 'General' src/Settings.tsx && grep -q 'Machines' src/Settings.tsx && grep -q 'Engines' src/Settings.tsx && grep -q 'Updates' src/Settings.tsx && grep -q 'About' src/Settings.tsx && grep -q 'New machine' src/settings/Machines.tsx && grep -q 'Apply and restart…' src/settings/Machines.tsx"
sh_ok "Settings sections are NavItems; no Start when I log in row; About says License, not Licence" "grep -q 'NavItem' src/Settings.tsx && ! grep -rq 'Start when I log in' src/settings && grep -q 'License' src/settings/About.tsx && ! grep -rq 'Licence' src/settings"
sh_ok "Updates shows the version and nothing else (no Check now)" "grep -q 'APP_VERSION' src/settings/Updates.tsx && ! grep -q 'Check now' src/settings/Updates.tsx"
sh_ok "check-resize.mjs and check-settings.mjs are in scripts/" "test -f scripts/check-resize.mjs && test -f scripts/check-settings.mjs && test -f scripts/check-baselines/check-resize.messages.txt && test ! -e scripts/checks-pending/check-resize.mjs"
count_is "check-k8s has no parked lines left (no dropped entry for it)" "0" "node -e 'const d=require(\"./scripts/dropped-checks.json\");console.log((d[\"check-k8s\"]||[]).length)'"
sh_ok "mockup pair: settings-machines has no mask for a Start when I log in row" "node -e 'const r=require(\"./scripts/mockup-pairs.json\").find(r=>r.mockup===\"settings-machines\");process.exit(r&&!JSON.stringify(r.mask||[]).includes(\"nth-of-type\")?0:1)'"
run "check-resize in Chromium" env PW_ENGINE=chromium node scripts/check-resize.mjs
run "check-resize in WebKit" env PW_ENGINE=webkit node scripts/check-resize.mjs
run "check-settings in Chromium" env PW_ENGINE=chromium node scripts/check-settings.mjs
run "check-settings in WebKit" env PW_ENGINE=webkit node scripts/check-settings.mjs

echo "== WO-3.10 Setup"
for f in src/Setup.tsx src/InstallCard.tsx src/InstallTool.tsx; do not_listed "$f"; done
clean_markup src/Setup.tsx src/InstallCard.tsx src/InstallTool.tsx
sh_ok "Setup is a route: replace to #/setup exists and Containers no longer renders InstallCard" "grep -rq '#/setup' src --include=*.tsx && ! grep -rn 'InstallCard' src/Containers.tsx src/containers 2>/dev/null | grep -q ."
sh_ok "Setup words are present" "grep -q 'Set up containers on this Mac' src/Setup.tsx && grep -q 'Install and start' src/Setup.tsx && grep -q 'Use Docker Desktop instead' src/Setup.tsx && grep -q 'Open Terminal to install Homebrew' src/Setup.tsx"
sh_ok "Setup.tsx keeps exporting useSetup and useSetupActions" "grep -q 'export function useSetup\\|export const useSetup' src/Setup.tsx && grep -q 'useSetupActions' src/Setup.tsx"
count_is "Setup.tsx has no old storage key" "0" "grep -n 'colima-ui\\.' src/Setup.tsx | wc -l"
sh_ok "Setup uses the bare app and tall step rows, and the setup-installing scenario exists" "grep -q 'app bare' src/Setup.tsx && grep -q 'tall' src/Setup.tsx && test \$(grep -c 'setup-installing' preview/mock.ts) -ge 1"
sh_ok "check-setup.mjs is in scripts/ with its baseline" "test -f scripts/check-setup.mjs && test -f scripts/check-baselines/check-setup.messages.txt && test ! -e scripts/checks-pending/check-setup.mjs"
sh_ok "mockup pair: setup" "node -e 'process.exit(require(\"./scripts/mockup-pairs.json\").some(r=>r.mockup===\"setup\")?0:1)'"
run "check-setup in Chromium" env PW_ENGINE=chromium node scripts/check-setup.mjs
run "check-setup in WebKit" env PW_ENGINE=webkit node scripts/check-setup.mjs

echo "== WO-3.11 Bring over"
not_listed src/BringOver.tsx
clean_markup src/BringOver.tsx
count_is "BringOver no longer uses Drawer" "0" "grep -n 'Drawer' src/BringOver.tsx | wc -l"
count_is "no Bring over entry outside Doctor" "0" "grep -rn 'Bring over from Docker Desktop' src --include=*.tsx | grep -v 'test\\.' | wc -l"
sh_ok "BringOver uses Checkbox and Progress, and no native progress" "grep -q 'Checkbox' src/BringOver.tsx && grep -q 'Progress' src/BringOver.tsx && ! grep -q '<progress' src/BringOver.tsx"
sh_ok "BringOver keeps its flow commands" "grep -q 'desktop_copy' src/BringOver.tsx && grep -q 'desktop_replace' src/BringOver.tsx && grep -q 'desktop_start' src/BringOver.tsx && grep -q 'desktop-progress' src/BringOver.tsx"
sh_ok "the four bring-over checks are in scripts/ with baselines" "for n in check-bring check-bring-home check-replace check-a11y; do test -f scripts/\$n.mjs && test -f scripts/check-baselines/\$n.messages.txt && test ! -e scripts/checks-pending/\$n.mjs || exit 1; done"
for n in check-bring check-bring-home check-replace check-a11y; do
  run "$n in Chromium" env PW_ENGINE=chromium node scripts/$n.mjs
  run "$n in WebKit" env PW_ENGINE=webkit node scripts/$n.mjs
done

echo "== Read-only guard"
count_is "this script ran no machine-changing command (static check of the script itself)" "0" "grep -nE '^[^#]*(docker|colima|limactl|kubectl|brew) (run|start|stop|rm|create|install|delete|up|down)' docs/plan/iterations/verify-iteration-3.sh | wc -l"

echo
echo "passed: $pass, failed: $fail"
if [ "$fail" -gt 0 ]; then exit 1; fi
exit 0
