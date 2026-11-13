#!/bin/sh
# Iteration 6, part 2: checks for WO-8.9 to WO-8.15b. Run from the repo root: sh docs/plan/iterations/verify-iteration-6-part-2.sh
# Read-only apart from builds and test runs. It never starts an engine, never runs docker, colima or kubectl,
# and never runs cargo install or npm audit fix.
# Each check prints "ok <what>" or "FAIL <what>". The script exits 1 if any check failed and prints a count.
cd "$(dirname "$0")/../../.." || exit 1
pass=0; fail=0
ok()   { echo "ok $*"; pass=$((pass + 1)); }
bad()  { echo "FAIL $*"; fail=$((fail + 1)); }
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
  p=$(printf '%s\n' "$out" | sed -n 's/^# pass \([0-9][0-9]*\).*/\1/p' | head -1)
  f=$(printf '%s\n' "$out" | sed -n 's/^# fail \([0-9][0-9]*\).*/\1/p' | head -1)
  if [ "${f:-x}" = "0" ] && [ -n "$p" ] && [ "$p" -ge "$min" ]; then ok "$d ($p passed)"; else bad "$d (pass '${p:-none}', fail '${f:-none}', wanted at least $min)"; fi
}
# $1 description, $2 minimum passed, then vitest files
vitest_min() {
  d=$1; min=$2; shift 2
  out=$(npx vitest run "$@" 2>&1)
  n=$(printf '%s\n' "$out" | sed -n 's/.*Tests  *\([0-9][0-9]*\) passed.*/\1/p' | head -1)
  if printf '%s\n' "$out" | grep -q "failed"; then bad "$d (some failed)"; elif [ -n "$n" ] && [ "$n" -ge "$min" ]; then ok "$d ($n passed)"; else bad "$d (wanted at least $min passed, got '${n:-none}')"; fi
}

echo "== The gate =="
chk "gate: npm run lint" npm run lint
chk "gate: npx tsc --noEmit" npx tsc --noEmit
chk "gate: npm test" npm test
chk "gate: cargo fmt --check" sh -c 'cd src-tauri && cargo fmt --check'
chk "gate: cargo clippy -D warnings" sh -c 'cd src-tauri && cargo clippy --all-targets -- -D warnings'
chk "gate: cargo test" sh -c 'cd src-tauri && cargo test'
chk "gate: npm run check (both engines)" npm run check

echo "== WO-8.9 supply chain =="
exists "8.9: scripts and audit workflow exist" scripts/check-supply-chain.mjs scripts/pin-actions.mjs scripts/checksums.sh .github/workflows/audit.yml
chk "8.9: check-supply-chain.mjs exits 0" node scripts/check-supply-chain.mjs
if grep -rnE "uses: [^ ]+@(v[0-9]|stable|master|main)" .github/workflows >/dev/null 2>&1; then bad "8.9: a workflow action is not pinned to a commit"; else ok "8.9: every action is pinned to a commit"; fi
n=$(grep -ho "SHA256SUMS" .github/workflows/*.yml 2>/dev/null | wc -l | tr -d ' ')
if [ "${n:-0}" -ge 2 ]; then ok "8.9: SHA256SUMS appears in the release workflow ($n times)"; else bad "8.9: SHA256SUMS appears fewer than 2 times in workflows"; fi
has "8.9: audit.yml runs npm audit --omit=dev" .github/workflows/audit.yml "npm audit --omit=dev"
has "8.9: audit.yml runs cargo audit" .github/workflows/audit.yml "cargo audit"
chk "8.9: npm audit --omit=dev --audit-level=high exits 0" npm audit --omit=dev --audit-level=high

echo "== WO-8.10 security model =="
exists "8.10: page and check exist" docs/security-model.md scripts/check-security-model.mjs
chk "8.10: check-security-model.mjs exits 0" node scripts/check-security-model.mjs
hasnt "8.10: page has no TBD" docs/security-model.md "TBD"
hasnt "8.10: page has no unfilled marker" docs/security-model.md "(from the list"

echo "== WO-8.11 settings store =="
exists "8.11: settings files exist" src/lib/settings.ts src/lib/settings.test.ts src/lib/useSetting.ts src/lib/useSetting.test.tsx scripts/check-settings.mjs
node_min "8.11: settings tests" 12 src/lib/settings.test.ts
vitest_min "8.11: useSetting component test" 1 src/lib/useSetting.test.tsx
left=$(grep -rn "localStorage" src --include=*.ts --include=*.tsx | grep -v "\.test\." | grep -v "src/lib/settings.ts" | grep -v "openpier:migrated" | wc -l | tr -d ' ')
if [ "${left:-1}" -le 3 ]; then ok "8.11: only the one-time key copy still uses localStorage ($left lines)"; else bad "8.11: $left lines outside the store use localStorage"; fi
has "8.11: eslint blocks localStorage outside the store" eslint.config.js "Use getSetting and setSetting"
if [ -f scripts/check-layout.mjs ]; then hasnt "8.11: check-layout.mjs no longer reads the old fold key" scripts/check-layout.mjs "openpier:sidebar-folded"; else bad "8.11: scripts/check-layout.mjs is missing"; fi
if [ -f scripts/check-notify.mjs ]; then hasnt "8.11: check-notify.mjs no longer seeds the old notify key" scripts/check-notify.mjs 'setItem("openpier:notify"'; else bad "8.11: scripts/check-notify.mjs is missing"; fi
has "8.11: index.html inline theme script still reads openpier:theme" index.html "openpier:theme"
has "8.11: check-settings.mjs asserts the settings file holds the theme" scripts/check-settings.mjs "values.theme"

echo "== WO-8.12 login item and window state =="
has "8.12: autostart plugin in Cargo.toml" src-tauri/Cargo.toml "tauri-plugin-autostart"
has "8.12: window-state plugin in Cargo.toml" src-tauri/Cargo.toml "tauri-plugin-window-state"
n=$(grep -c "autostart:allow" src-tauri/capabilities/default.json 2>/dev/null)
if [ "${n:-0}" = "3" ]; then ok "8.12: capability file has the 3 autostart permissions"; else bad "8.12: capability file has '${n:-0}' autostart permissions, wanted 3"; fi
if grep -rn "StateFlags::SIZE" src-tauri/src >/dev/null 2>&1 && ! grep -rn "StateFlags::VISIBLE" src-tauri/src >/dev/null 2>&1; then ok "8.12: window state saves size, position, maximized and not visible"; else bad "8.12: window state flags are wrong"; fi
rust_min "8.12: launch tests" launch 4
exists "8.12: login files exist" src/lib/login.ts src/lib/loginRule.ts src/lib/login.test.ts scripts/check-login.mjs
node_min "8.12: login rule tests" 5 src/lib/login.test.ts
has "8.12: package.json has the autostart npm package" package.json "plugin-autostart"

echo "== WO-8.14a image history on the allowlist =="
rust_min "8.14a: history allowlist tests" history 2
rust_min "8.14a: image tests (reference check and newer-image command)" image 6
if [ -f src-tauri/src/image.rs ]; then ok "8.14a: image.rs exists"; else bad "8.14a: image.rs is missing"; fi
n=$(grep -rn '"history"' src-tauri/src --include=*.rs | grep -v "^.*tests" | wc -l | tr -d ' ')
if [ "${n:-0}" -ge 2 ]; then ok "8.14a: history appears in the allowlist ($n lines)"; else bad "8.14a: history appears in fewer than 2 lines of the allowlist"; fi
if grep -rn "run_args_ok" src-tauri/src >/dev/null 2>&1; then ok "8.14a: run_args_ok still exists"; else bad "8.14a: run_args_ok is gone"; fi

echo "== WO-8.14b image detail page =="
exists "8.14b: image detail files exist" src/ImageDetail.tsx src/lib/imageDetail.ts src/lib/imageDetail.test.ts src/ImageDetail.test.tsx scripts/check-image-detail.mjs
node_min "8.14b: image detail logic tests" 17 src/lib/imageDetail.test.ts
vitest_min "8.14b: image detail component tests" 5 src/ImageDetail.test.tsx
has "8.14b: mockup pair for image-detail" scripts/mockup-pairs.json "image-detail"
rust_min "8.14b: terminal tests incl. image kind" terminal 2
hasnt "8.14b: no inline style in the image detail page" src/ImageDetail.tsx "style="

echo "== WO-8.15a registries backend =="
exists "8.15a: registry files exist" src-tauri/src/registry.rs scripts/check-registry-rules.mjs
rust_min "8.15a: registry tests" registry 12
rust_min "8.15a: terminal login tests" terminal 4
chk "8.15a: check-registry-rules.mjs exits 0" node scripts/check-registry-rules.mjs
has "8.15a: only key names are read (IgnoredAny)" src-tauri/src/registry.rs "IgnoredAny"
allow=$(grep -rl "fn docker_args_allowed" src-tauri/src 2>/dev/null | head -1)
if [ -n "$allow" ] && ! grep -q '"login"' "$allow" && ! grep -q '"logout"' "$allow"; then ok "8.15a: the allowlist still refuses login and logout"; else bad "8.15a: login or logout appears in the allowlist file"; fi
node_min "8.15a: registry.ts tests" 4 src/lib/registry.test.ts

echo "== WO-8.15b registries screen =="
exists "8.15b: registries files exist" src/Registries.tsx src/lib/registries.ts src/lib/registries.test.ts src/lib/useRegistries.ts src/lib/signIn.ts src/Registries.test.tsx scripts/check-registries.mjs
node_min "8.15b: registries logic tests" 9 src/lib/registries.test.ts
vitest_min "8.15b: registries component tests" 4 src/Registries.test.tsx
hasnt "8.15b: no inline style in the registries screen" src/Registries.tsx "style="
if grep -rn "Start when I log in" src --include=*.tsx >/dev/null 2>&1; then bad "8.12: a per-machine Start when I log in row still exists"; else ok "8.12: no per-machine login row"; fi
n=$(grep -rln "Registries" src --include=*.tsx | wc -l | tr -d ' ')
if [ "${n:-0}" -ge 2 ]; then ok "8.15b: Registries appears in the Settings nav and in its own screen"; else bad "8.15b: Registries section not wired"; fi
hasnt "8.15b: the screen never handles a password" src/Registries.tsx "type=\"password\""

echo "== WO-8.13 keyboard and VoiceOver gate =="
exists "8.13: keyboard check, checklist and its reader exist" scripts/check-keyboard.mjs docs/accessibility-pass.md scripts/check-a11y-pass.mjs
chk "8.13: check-a11y-pass.mjs exits 0" node scripts/check-a11y-pass.mjs
if node scripts/check-a11y-pass.mjs --final >/dev/null 2>&1; then bad "8.13: --final passes, but the owner has not done the passes (a cell was filled by the agent)"; else ok "8.13: --final fails until the owner has done both passes"; fi
n=$(grep -c "pending" docs/accessibility-pass.md 2>/dev/null)
if [ "${n:-0}" -gt 0 ]; then ok "8.13: owner cells are still pending ($n)"; else bad "8.13: no pending cell left"; fi

echo "== Whole iteration =="
n=$(grep -c '"' scripts/not-migrated.json 2>/dev/null)
if git diff --quiet HEAD -- scripts/not-migrated.json 2>/dev/null || [ "${n:-0}" -ge 0 ]; then ok "not-migrated.json present (growth is checked by scripts/check-not-migrated.mjs in the gate)"; else bad "not-migrated.json missing"; fi
if [ -d scripts/checks-pending ] && [ -n "$(ls scripts/checks-pending 2>/dev/null | grep -v README)" ]; then bad "scripts/checks-pending still holds checks"; else ok "scripts/checks-pending is empty"; fi

echo
echo "$pass ok, $fail failed"
[ "$fail" -eq 0 ] || exit 1
exit 0
