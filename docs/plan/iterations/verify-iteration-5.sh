#!/bin/sh
# Checks iteration 5 (Projects, WO-7.1 to WO-7.8). Run from the repo root: sh docs/plan/iterations/verify-iteration-5.sh
# Read-only: it builds and runs tests, and never starts, stops or changes a container, a machine or a file.
# It never runs the sandbox (scripts/eval-projects.sh merge|two): that is the owner's step.
# Prints "ok <what>" or "FAIL <what>" per check, then a count. Exit 1 if any check failed.
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 1
fails=0
total=0
em=$(printf '\342\200\224')
export em

ok() { total=$((total + 1)); echo "ok $1"; }
bad() { total=$((total + 1)); fails=$((fails + 1)); echo "FAIL $1"; }
# chk "<what>" "<command>": ok when the command exits 0.
chk() { if sh -c "$2" >/dev/null 2>&1; then ok "$1"; else bad "$1"; fi; }
# atleast "<what>" "<command that prints a number>" <n>
atleast() {
  n=$(sh -c "$2" 2>/dev/null | tr -d ' \n')
  case "$n" in ''|*[!0-9]*) bad "$1 (no number)"; return;; esac
  if [ "$n" -ge "$3" ]; then ok "$1 ($n >= $3)"; else bad "$1 ($n < $3)"; fi
}
# nothing "<what>" "<command>": ok when the command prints nothing.
nothing() { out=$(sh -c "$2" 2>/dev/null); if [ -z "$out" ]; then ok "$1"; else bad "$1"; fi; }

echo "== gate (HANDOFF section 5)"
chk "npm run lint" "npm run lint"
chk "tsc --noEmit" "npx tsc --noEmit"
chk "npm test" "npm test"
chk "cargo fmt --check" "cd src-tauri && cargo fmt --check"
chk "cargo clippy" "cd src-tauri && cargo clippy --all-targets -- -D warnings"
chk "cargo test" "cd src-tauri && cargo test"
chk "npm run check (browser checks, Chromium and WebKit)" "npm run check"

echo "== WO-7.1 projects.json"
chk "projects.rs exists and no Lima file is back" "test -f src-tauri/src/projects.rs && test ! -f src-tauri/src/lima.rs && test ! -d src/_parked"
atleast "projects.rs has at least 31 given_ tests" "grep -c 'fn given_' src-tauri/src/projects.rs" 31
chk "composeName rows pass" "cd src-tauri && cargo test projects:: 2>&1 | grep -q 'test result: ok'"
chk "sha2 is a dependency" "grep -q '^sha2' src-tauri/Cargo.toml"
chk "projects commands are registered" "grep -q 'projects::projects_read' src-tauri/src/main.rs && grep -q 'projects::projects_write' src-tauri/src/main.rs && grep -q 'projects::project_name_decide' src-tauri/src/main.rs"
chk "src/lib/projects.ts tests pass" "node --experimental-strip-types --no-warnings --test src/lib/projects.test.ts"
nothing "projects.ts is pure (no invoke)" "grep -n 'invoke' src/lib/projects.ts"

echo "== WO-7.2 override file and version check"
atleast "override_yaml.rs has at least 17 given_ tests" "grep -c 'fn given_' src-tauri/src/override_yaml.rs" 17
chk "override tests pass" "cd src-tauri && cargo test override_yaml:: 2>&1 | grep -q 'test result: ok'"
chk "the sandbox merge test is listed as ignored" "cd src-tauri && cargo test override_yaml -- --ignored --list 2>&1 | grep -q sandbox_override_merge"
chk "the override writes the spec example" "grep -q 'container_name: !reset null' src-tauri/src/override_yaml.rs && grep -q 'ports: !override' src-tauri/src/override_yaml.rs"
chk "MIN_COMPOSE is a real version" "grep -Eq 'MIN_COMPOSE = \"[0-9]+\.[0-9]+\.[0-9]+\"' src/lib/composeVersion.ts"
chk "composeVersion tests pass" "node --experimental-strip-types --no-warnings --test src/lib/composeVersion.test.ts"
chk "Doctor has the compose-old check" "grep -q 'Compose is too old for Projects' src/lib/doctor.ts"
chk "fixtures a/app and b/app exist and are equal" "cmp scripts/fixtures/projects/a/app/compose.yaml scripts/fixtures/projects/b/app/compose.yaml"
chk "recorded config of the fixture" "node -e 'const j=require(\"./scripts/fixtures/projects/config-b.json\");process.exit(j.name===\"app\"&&j.services.db.container_name===\"db\"?0:1)'"
chk "eval-projects.sh is valid sh" "sh -n scripts/eval-projects.sh"
chk "eval-projects.sh dry mode passes and starts nothing" "sh scripts/eval-projects.sh --dry | grep -q 'ok dry run'"
nothing "eval-projects.sh runs no compose command itself" "grep -n 'compose up\|compose down\|docker run' scripts/eval-projects.sh"

echo "== WO-7.3 Compose commands"
chk "per-project locks replace the global lock" "! grep -q 'static COMPOSE_LOCK:' src-tauri/src/compose.rs && grep -q 'COMPOSE_LOCKS' src-tauri/src/compose.rs"
atleast "compose.rs and ports.rs have at least 40 passing tests of the new code" "cd src-tauri && cargo test compose:: ports:: 2>&1 | grep -c '\.\.\. ok'" 40
chk "new commands are registered" "for c in compose_down compose_validate compose_ls engine_memory ports_in_use project_command_line; do grep -q \"\$c\" src-tauri/src/main.rs || exit 1; done"
chk "-v appears only in action_tail" "test \$(grep -c '\"down\", \"-v\"' src-tauri/src/compose.rs) -eq 1"
nothing "no shell string in compose.rs or ports.rs" "grep -n '\"sh\", \"-c\"\|\"-c\"' src-tauri/src/compose.rs src-tauri/src/ports.rs"
chk "the old Compose sheet still works with a file" "npx vitest run src/ComposeProjects.test.tsx"

echo "== WO-7.4a Start check"
atleast "projectCheck tests (at least 36)" "grep -c '^test(' src/lib/projectCheck.test.ts src/lib/projectCheck.fixture.test.ts | awk -F: '{s+=\$2} END {print s}'" 36
chk "projectCheck tests pass" "node --experimental-strip-types --no-warnings --test src/lib/projectCheck.test.ts src/lib/projectCheck.fixture.test.ts"
nothing "projectCheck.ts is pure" "grep -n 'invoke\|window\|document\|react' src/lib/projectCheck.ts"

echo "== WO-7.4b Start check sheet"
chk "StartCheck, findingText, engineState, useStartProject exist" "test -f src/projects/StartCheck.tsx && test -f src/projects/findingText.ts && test -f src/projects/engineState.ts && test -f src/projects/useStartProject.ts"
chk "Banner has the ok tone" "grep -q '\"ok\"' src/ui/Banner.tsx"
chk "sheet and hook tests pass" "npx vitest run src/projects src/ui/Banner.test.tsx"
chk "projects mock is hooked into the preview" "grep -q projectsInvoke preview/mock.ts && test -f preview/projectsMock.ts"

echo "== WO-7.5a Projects list"
chk "Projects page exists" "test -f src/Projects.tsx && test -f src/projects/AddProject.tsx"
chk "go-projects is no longer pending" "! grep 'go-projects' src/lib/shortcuts.ts | grep -q 'pending: true'"
chk "Projects is a NavItem in the shell" "grep -q 'href=\"#/projects\"' src/Shell.tsx"
chk "Projects tests pass" "npx vitest run src/Projects.test.tsx"
chk "row model and data tests pass" "node --experimental-strip-types --no-warnings --test src/lib/projectRows.test.ts src/lib/projectData.test.ts"
chk "check-projects.mjs exists" "test -f scripts/check-projects.mjs"
atleast "check-projects.mjs has at least 62 checks" "grep -c 'check(' scripts/check-projects.mjs" 62

echo "== WO-7.5b Found, empty, missing folder"
chk "Found on this engine and Found on this Mac are in the page" "grep -q 'Found on this engine' src/Projects.tsx && grep -q 'Found on this Mac' src/Projects.tsx"
chk "the empty state uses the mockup words" "grep -q 'No projects yet' src/Projects.tsx"
chk "mockup pairs for projects and projects-empty" "node -e 'const p=require(\"./scripts/mockup-pairs.json\").map(x=>x.mockup);process.exit([\"projects\",\"projects-empty\",\"project-detail\"].every(n=>p.includes(n))?0:1)'"
chk "no mockup pair is looser than 0.02 without a why" "node -e 'const p=require(\"./scripts/mockup-pairs.json\");process.exit(p.every(x=>(x.threshold??0.005)<=0.02||x.why)?0:1)'"
chk "project pairs keep the default threshold or a why" "node -e 'const p=require(\"./scripts/mockup-pairs.json\").filter(x=>x.mockup.startsWith(\"project\"));process.exit(p.every(x=>x.threshold<=0.005||x.why)?0:1)'"

echo "== WO-7.6a / 7.6b Project detail"
chk "ProjectDetail, ProjectLogs, ProjectSettings exist" "test -f src/ProjectDetail.tsx && test -f src/projects/ProjectLogs.tsx && test -f src/projects/ProjectSettings.tsx"
nothing "no temporary panels left" "grep -n 'Coming in the next change' src/ProjectDetail.tsx"
chk "Row has metaLast" "grep -q metaLast src/ui/Row.tsx"
chk "detail tests pass" "npx vitest run src/ProjectDetail.test.tsx src/projects src/ui/Row.test.tsx"
chk "port and settings helpers pass" "node --experimental-strip-types --no-warnings --test src/lib/projectPorts.test.ts src/lib/projectSettings.test.ts"
atleast "check-project-detail.mjs has at least 39 checks" "grep -c 'check(' scripts/check-project-detail.mjs" 39
atleast "check-project-settings.mjs has at least 25 checks" "grep -c 'check(' scripts/check-project-settings.mjs" 25

echo "== WO-7.7 Links"
chk "palette has the Projects group" "grep -q '\"Projects\"' src/lib/paletteModel.ts"
chk "Doctor skips containers of saved projects" "grep -q projectNames src/lib/doctor.ts"
chk "Open project is in Containers and the Compose sheet" "grep -rq 'Open project' src/containers src/ComposeProjects.tsx"
chk "Add as a project is in the Compose sheet" "grep -q 'Add as a project' src/ComposeProjects.tsx"

echo "== WO-7.8 Two-project test (written, not run)"
chk "sandbox_two_projects is listed as ignored" "cd src-tauri && cargo test eval_two -- --ignored --list 2>&1 | grep -q sandbox_two_projects"
chk "the test calls the real code" "grep -q decide_compose_name src-tauri/src/eval_two.rs && grep -q project_args src-tauri/src/eval_two.rs && grep -q NameLock src-tauri/src/eval_two.rs"

echo "== rules of the whole iteration"
nothing "no inline style in the new files" "grep -rn 'style=' src/Projects.tsx src/ProjectDetail.tsx src/projects"
nothing "no raw button, select or table in the new files" "grep -rn '<button\|<select\|<table' src/Projects.tsx src/ProjectDetail.tsx src/projects"
nothing "no import from the old ui/op folder" "grep -rn 'ui/op' src"
chk "not-migrated.json did not grow" "node scripts/check-not-migrated.mjs"
chk "design files are in sync" "node scripts/check-design-sync.mjs"
chk "every class used is defined" "node scripts/check-classes.mjs"
nothing "no em dash in the work orders or the new sources" "grep -rn \"\$em\" docs/plan/iterations/iteration-5-work-orders.md src/projects src/Projects.tsx src/ProjectDetail.tsx"
nothing "no Lima or AI chat code is back" "grep -rln 'limactl\|ollama_' src src-tauri/src"
nothing "the old pending list holds nothing of this iteration" "ls scripts/checks-pending 2>/dev/null | grep -i project"

echo
echo "$((total - fails)) ok, $fails failed, $total checks"
if [ "$fails" -gt 0 ]; then exit 1; fi
exit 0
