#!/bin/sh
# Checks iteration 7 (WO-6.1 to WO-6.6). Run from the repo root: sh docs/plan/iterations/verify-iteration-7.sh
# Read only: it builds and runs tests, it never changes the machine, pushes, tags or runs a workflow.
# Prints "ok <what>" or "FAIL <what>", then a count. Exits 1 if any FAIL.
# Lines starting with "owner-step" are not checks: they are what only the owner can prove.

pass=0
fail=0
ok() { printf 'ok %s\n' "$1"; pass=$((pass + 1)); }
bad() { printf 'FAIL %s\n' "$1"; fail=$((fail + 1)); }
# check "<what>" <command...>: ok when the command exits 0
check() { what="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$what"; else bad "$what"; fi; }
# has <file> <fixed text>
has() { [ -f "$1" ] && grep -qF -- "$2" "$1"; }
# hasnt <file> <fixed text>: file exists and does not contain the text
hasnt() { [ -f "$1" ] && ! grep -qF -- "$2" "$1"; }
yaml() { ruby -ryaml -e 'YAML.load_file(ARGV[0])' "$1"; }
count_ge() { [ "$(grep -c -- "$2" "$1" 2>/dev/null)" -ge "$3" ]; }

[ -f package.json ] && [ -d src-tauri ] || { echo "FAIL run this from the repo root"; exit 1; }

echo "== gate"
check "npm run lint" npm run lint
check "tsc --noEmit" npx tsc --noEmit
check "npm test" npm test
check "cargo fmt --check" sh -c 'cd src-tauri && cargo fmt --check'
check "cargo clippy -D warnings" sh -c 'cd src-tauri && cargo clippy --all-targets -- -D warnings'
check "cargo test" sh -c 'cd src-tauri && cargo test'
check "npm run check (Chromium and WebKit)" npm run check

echo "== WO-6.1 community files"
check "LICENSE is MIT with the holder" sh -c 'head -3 LICENSE | grep -q "MIT License" && grep -qF "Copyright (c) 2026 OpenPier contributors" LICENSE'
check "SECURITY.md: private report, 7 days, key note" sh -c 'grep -qF "Report a vulnerability" SECURITY.md && grep -qF "7 days" SECURITY.md && grep -qF "not trusted" SECURITY.md && grep -qF "scripts/install.sh" SECURITY.md'
check "CODE_OF_CONDUCT.md names Contributor Covenant 2.1" sh -c 'grep -qF "Contributor Covenant" CODE_OF_CONDUCT.md && grep -qF "2.1" CODE_OF_CONDUCT.md'
check "ROADMAP.md has Now, Next, Later, Never" sh -c '[ "$(grep -cE "^## (Now|Next|Later|Never)" ROADMAP.md)" = 4 ]'
check "CONTRIBUTING.md has install, run, check, design and review parts" sh -c 'grep -qF "npm ci" CONTRIBUTING.md && grep -qF "npm run preview" CONTRIBUTING.md && grep -qF "npm run tauri dev" CONTRIBUTING.md && grep -qF "docs/plan/design" CONTRIBUTING.md && grep -qF "When reviews happen" CONTRIBUTING.md && grep -qF "Xcode command line tools" CONTRIBUTING.md'
for f in bug.yml feature.yml config.yml; do
  check "issue template $f parses" yaml ".github/ISSUE_TEMPLATE/$f"
done
check "bug.yml asks the five things" sh -c 'grep -qF "What happened" .github/ISSUE_TEMPLATE/bug.yml && grep -qF "What you expected" .github/ISSUE_TEMPLATE/bug.yml && grep -qF "Engine and version" .github/ISSUE_TEMPLATE/bug.yml && grep -qF "macOS version" .github/ISSUE_TEMPLATE/bug.yml && grep -qF "Steps" .github/ISSUE_TEMPLATE/bug.yml'
check "feature.yml asks the three things" sh -c 'grep -qF "The problem" .github/ISSUE_TEMPLATE/feature.yml && grep -qF "Who has it" .github/ISSUE_TEMPLATE/feature.yml && grep -qF "What you do today" .github/ISSUE_TEMPLATE/feature.yml'
check "config.yml turns blank issues off" has .github/ISSUE_TEMPLATE/config.yml "blank_issues_enabled: false"
check "old feedback template is gone" sh -c '! git ls-files --error-unmatch .github/ISSUE_TEMPLATE/feedback.md >/dev/null 2>&1 && [ ! -f .github/ISSUE_TEMPLATE/feedback.md ]'
check "PR template has capitals in git" sh -c 'git ls-files .github | grep -qx ".github/PULL_REQUEST_TEMPLATE.md" && ! git ls-files .github | grep -qx ".github/pull_request_template.md"'
check "dependabot.yml parses and covers npm, cargo, github-actions weekly" sh -c 'ruby -ryaml -e "d = YAML.load_file(%q(.github/dependabot.yml)); e = d[%q(updates)].map { |u| [u[%q(package-ecosystem)], u[%q(schedule)][%q(interval)]] }; exit(e.sort == [[%q(cargo), %q(weekly)], [%q(github-actions), %q(weekly)], [%q(npm), %q(weekly)]] ? 0 : 1)"'
check "no private key file is tracked" sh -c '[ -z "$(git ls-files | grep -iE "\.key(\.pub)?$")" ]'

echo "== WO-6.2a updater in the app"
check "updater unit tests: 11 pass, 0 fail" sh -c 'out=$(node --experimental-strip-types --no-warnings --test src/lib/updater.test.ts 2>&1); echo "$out" | grep -q "^# pass 11" && echo "$out" | grep -q "^# fail 0"'
check "package.json has both JS plugins" sh -c 'grep -qF "@tauri-apps/plugin-updater" package.json && grep -qF "@tauri-apps/plugin-process" package.json'
check "Cargo.toml has both Rust plugins" sh -c 'grep -qF "tauri-plugin-updater" src-tauri/Cargo.toml && grep -qF "tauri-plugin-process" src-tauri/Cargo.toml'
check "builder registers both plugins" sh -c 'grep -rqF "tauri_plugin_updater::Builder::new().build()" src-tauri/src && grep -rqF "tauri_plugin_process::init()" src-tauri/src'
check "capability grants updater:default and process:default" sh -c 'grep -qF "\"updater:default\"" src-tauri/capabilities/default.json && grep -qF "\"process:default\"" src-tauri/capabilities/default.json'
check "updater store is the only importer of the plugins in src" sh -c '[ "$(grep -rlE "@tauri-apps/plugin-(updater|process)" src --include=*.ts --include=*.tsx | grep -v "\.test\." | sort | tr "\n" " ")" = "src/lib/updaterStore.ts " ]'
check "preview has fakes for both plugins and aliases them" sh -c 'test -f preview/plugin-updater.ts && test -f preview/plugin-process.ts && grep -q "plugin-updater" vite.preview.config.ts && grep -q "plugin-process" vite.preview.config.ts'
check "check-updates.mjs exists with 8 or more check lines" sh -c 'test -f scripts/check-updates.mjs && [ "$(grep -c "check(" scripts/check-updates.mjs)" -ge 8 ]'
check "Settings, Updates has Check now with a progress bar, and check-settings.mjs is untouched by this iteration" sh -c 'grep -q "Check now" src/settings/Updates.tsx && grep -q "Progress" src/settings/Updates.tsx && grep -q "Updates shows the version" scripts/check-settings.mjs && ! grep -q "Check now" scripts/check-settings.mjs'
check "Settings, General has the automatic check switch on useSetting" sh -c 'grep -q "Check for updates automatically" src/settings/General.tsx && grep -q "useSetting(\"autoUpdateCheck\")" src/settings/General.tsx'
check "the startup check reads the setting through the settings store" sh -c 'grep -rq "getSetting(\"autoUpdateCheck\")" src/Shell.tsx src/App.tsx && ! grep -rn "localStorage" src/settings/General.tsx src/lib/updater.ts src/lib/updaterStore.ts | grep -q autoUpdateCheck'
check "UPDATER_WORDS is final (no proposal marker left anywhere)" sh -c 'grep -q "UPDATER_WORDS" src/lib/updater.ts && ! grep -rqiE "PROPOSED WORDS|design gap" src/lib/updater.ts src/settings/Updates.tsx src/settings/General.tsx'
check "no 'Check for updates' button label left in Settings" sh -c '! grep -rn "Check for updates\"" src --include=*.tsx | grep -v "\.test\." | grep -v "automatically" | grep -q .'
check "check-updates.mjs and check-settings.mjs pass in WebKit" sh -c 'out=$(PW_ENGINES=webkit sh scripts/check-all.sh 2>&1); echo "$out" | grep -q "webkit scripts/check-updates.mjs: 0" && echo "$out" | grep -q "webkit scripts/check-settings.mjs: 0"'
check "check-updates.mjs passes in Chromium" sh -c 'out=$(PW_ENGINES=chromium sh scripts/check-all.sh 2>&1); echo "$out" | grep -q "chromium scripts/check-updates.mjs: 0"'

echo "== WO-6.2b release workflow and tools"
check "release tools tests pass (21 or more)" sh -c 'out=$(npm run test:release 2>&1); echo "$out" | grep -qE "^# pass (2[1-9]|[3-9][0-9])" && echo "$out" | grep -q "^# fail 0"'
check "scripts/release-check.mjs passes every rule" npm run check:release
check "release.yml parses" yaml .github/workflows/release.yml
check "release.yml has no latest.yml, no APPLE_, no workflow_dispatch" sh -c '! grep -qE "latest\.yml|APPLE_|workflow_dispatch" .github/workflows/release.yml'
check "release.yml: draft, tauri-action, max-parallel 1" sh -c 'grep -q "releaseDraft: true" .github/workflows/release.yml && grep -q "tauri-apps/tauri-action" .github/workflows/release.yml && grep -q "max-parallel: 1" .github/workflows/release.yml'
check "release.yml uses Node 22, like ci.yml" sh -c 'grep -q "node-version: 22" .github/workflows/release.yml && grep -q "node-version: 22" .github/workflows/ci.yml'
check "release.yml: 9 steps" sh -c 'ruby -ryaml -e "exit(YAML.load_file(%q(.github/workflows/release.yml))[%q(jobs)][%q(build)][%q(steps)].length == 9 ? 0 : 1)"'
check "actionlint is clean when installed" sh -c 'if command -v actionlint >/dev/null 2>&1; then actionlint .github/workflows/*.yml; else true; fi'
check "tauri.conf.json: updater artifacts, app+dmg, endpoint" sh -c 'node -e "const c=require(\"./src-tauri/tauri.conf.json\"); process.exit(c.bundle.createUpdaterArtifacts===true && c.bundle.targets.join()===\"app,dmg\" && c.plugins.updater.endpoints[0]===\"https://github.com/BitVerseNomad/container-ui/releases/latest/download/latest.json\" ? 0 : 1)"'
check "bundle identifier is dev.containerui.desktop" sh -c 'node -e "process.exit(require(\"./src-tauri/tauri.conf.json\").identifier===\"dev.containerui.desktop\"?0:1)"'
check "three versions agree" node scripts/check-version-sync.mjs
check "bump.mjs refuses a bad version" sh -c '! node scripts/bump.mjs 1.0 >/dev/null 2>&1'
check "changelog-section.mjs needs a version" sh -c '! node scripts/changelog-section.mjs >/dev/null 2>&1'
check "ci.yml runs the release tests and rules" sh -c 'grep -q "npm run test:release" .github/workflows/ci.yml && grep -q "npm run check:release" .github/workflows/ci.yml'
check "release-draft-check.mjs exists and refuses a bad tag" sh -c 'test -f scripts/release-draft-check.mjs && ! node scripts/release-draft-check.mjs nonsense >/dev/null 2>&1'

echo "== WO-6.3 install script"
check "install.sh is valid sh and executable" sh -c 'sh -n scripts/install.sh && test -x scripts/install.sh'
check "install.sh has no sudo, xattr or spctl" sh -c '! grep -qE "\bsudo\b|xattr|spctl" scripts/install.sh'
check "install.sh verifies a SHA-256 and prints the first-open step" sh -c 'grep -q "shasum -a 256" scripts/install.sh && grep -q "Open Anyway" scripts/install.sh'
check "install-smoke.yml parses and runs on publish" sh -c 'ruby -ryaml -e "y = YAML.load_file(%q(.github/workflows/install-smoke.yml)); on = y[%q(on)] || y[true]; exit(on[%q(release)][%q(types)] == [%q(published)] ? 0 : 1)"'

echo "== WO-6.5 signing"
check "docs/signing.md has the first-open steps and the later notarisation steps" sh -c 'grep -q "Open Anyway" docs/signing.md && grep -q "Privacy & Security" docs/signing.md && grep -q "spctl -a -vv /Applications/OpenPier.app" docs/signing.md'
check "the app is ad-hoc signed with the hardened runtime" sh -c 'node -e "const m=require(\"./src-tauri/tauri.conf.json\").bundle.macOS; process.exit(m.signingIdentity===\"-\" && m.hardenedRuntime===true ? 0 : 1)"'

echo "== WO-6.4 README and pictures"
check "README starts with OpenPier and has 3 badges" sh -c 'head -1 README.md | grep -qx "# OpenPier" && [ "$(grep -cE "^\[!\[(CI|Latest release|License: MIT)\]" README.md)" = 3 ]'
check "README sections are in the planned order" sh -c 'a=$(grep -n "^## " README.md | sed "s/^[0-9]*:## //" | tr "\n" "|"); [ "$a" = "Install|What it does|Works with|How it compares|Development|More|" ]'
check "README has 7 picture elements and the one-line install" sh -c '[ "$(grep -c "<picture>" README.md)" = 7 ] && grep -qF "curl -fsSL https://raw.githubusercontent.com/BitVerseNomad/container-ui/main/scripts/install.sh | sh" README.md'
check "README says Open Anyway and keeps the comparison caveat" sh -c 'grep -q "Open Anyway" README.md && grep -q "It is not proof that it has none" README.md'
check "README has no old name, no coming soon" sh -c '! grep -qiE "Wharf|Container UI|colima-ui|coming soon" README.md'
check "readme-shots uses the setup-installing scenario and has no mockup-pairs dependency" sh -c 'grep -q "scenario=setup-installing" scripts/readme-shots.mjs && ! grep -q "mockup-pairs" scripts/readme-shots.mjs'
check "14 README pictures exist, and the old ones are gone" sh -c 'n=0; for name in hero containers doctor run networks engine-switcher setup; do for t in light dark; do test -s docs/screenshots/$name-$t.png && n=$((n+1)); done; done; [ $n = 14 ] && ! test -e docs/screenshots/home.png && ! test -e docs/screenshots/profiles.png'
check "every picture the README names exists (first-open.png is an owner step)" sh -c 'for f in $(grep -o "docs/screenshots/[a-z-]*\.png" README.md | sort -u); do [ "$f" = docs/screenshots/first-open.png ] || test -s "$f" || exit 1; done'
check "no README-script file name is picked up by check-all.sh by mistake" sh -c '! ls scripts/check-*.mjs | grep -E "draft|shots|release-check"'
check "a fresh run of readme-shots matches the committed pictures" sh -c 'rm -rf /tmp/container-ui-verify-shots && node scripts/readme-shots.mjs --out /tmp/container-ui-verify-shots >/dev/null 2>&1 && node scripts/shots-fresh.mjs /tmp/container-ui-verify-shots'
check "ci.yml has the shots-fresh job and parses" sh -c 'grep -q "shots-fresh:" .github/workflows/ci.yml && ruby -ryaml -e "YAML.load_file(%q(.github/workflows/ci.yml))"'

echo "== WO-6.6 launch checklist"
check "launch-checklist.md has 12 launch items" sh -c 'sed -n "/^## The launch, in order/,/^## After launch/p" docs/plan/launch-checklist.md | grep -cE "^[0-9]+\. \*\*" | grep -qx 12'
check "launch checklist tells old installs to replace by hand" has docs/plan/launch-checklist.md "cannot update themselves"

echo "== hygiene"
new="LICENSE SECURITY.md CODE_OF_CONDUCT.md ROADMAP.md CONTRIBUTING.md README.md docs/signing.md docs/plan/launch-checklist.md scripts/install.sh scripts/bump.mjs scripts/readme-shots.mjs scripts/shots-fresh.mjs scripts/release-check.mjs scripts/release-draft-check.mjs scripts/changelog-section.mjs scripts/check-updates.mjs scripts/lib/bump.mjs scripts/lib/draft.mjs .github/workflows/release.yml .github/workflows/install-smoke.yml .github/workflows/ci.yml .github/dependabot.yml .github/PULL_REQUEST_TEMPLATE.md src/lib/updater.ts src/lib/updaterStore.ts src/lib/useUpdater.ts"
check "no em dash in the files this iteration wrote" sh -c '! grep -l "—" '"$new"' 2>/dev/null | grep -q .'
check "no secrets or keys: no file named private.key, no *.key tracked" sh -c '! git ls-files | grep -qiE "private\.key|\.key$"'
check "scripts/not-migrated.json did not change in this iteration's files" sh -c 'git diff --quiet -- scripts/not-migrated.json'
check "no people's handles in the new docs" sh -c '! grep -nE "@[a-z0-9-]+\.(com|org)" LICENSE SECURITY.md CODE_OF_CONDUCT.md ROADMAP.md CONTRIBUTING.md README.md docs/signing.md docs/plan/launch-checklist.md | grep -q .'

echo
echo "owner-step: take docs/screenshots/first-open.png and check the first-open words on a real Mac (WO-6.5 owner steps)"
echo "owner-step: repo settings, Community standards ticked, branch protection (WO-6.1 owner steps)"
echo "owner-step: first tag, draft check with scripts/release-draft-check.mjs, real update test (WO-6.2b owner steps)"
echo "owner-step: Install smoke job green after the first publish (WO-6.3 owner steps)"
echo "not verified: release.yml, install-smoke.yml and the shots-fresh job have never run; the updater has never met a real release"
echo
echo "passed $pass, failed $fail"
[ "$fail" -eq 0 ]
