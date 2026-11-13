wo-0.6: a workflow checks every pull request (not yet run)

## What changed

Every pull request now runs the web checks and the Rust checks on GitHub.
It has not run yet; only the owner can push it and watch the first run.
Release builds are untouched.

## Steps done

- [x] 1. Created `.github/workflows/ci.yml` with the YAML from `docs/plan/06-open-source-launch.md` section 3, copied exactly, including `- run: npm run check`.
- [x] 2. Checked the YAML with Ruby: it printed `valid`.
- [x] 3. `actionlint` is not installed, so it was not run and was not installed.

## Evidence

Done when checks:

```text
$ ruby -e 'require "yaml"; y = YAML.load_file(".github/workflows/ci.yml"); puts y["jobs"].keys.sort.join(",")'
rust,web
```

```text
$ grep -c "npm run check" .github/workflows/ci.yml
1
```

Gate (all exit 0):

```text
$ npm ci
ci=0
```

```text
$ npm run lint
✖ 33 problems (0 errors, 33 warnings)
lint=0
```

```text
$ npx tsc --noEmit
tsc=0
```

```text
$ npm test
 Test Files  8 passed (8)
      Tests  79 passed (79)
# pass 592
# fail 0
test=0
```

```text
$ cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
test result: ok. 135 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 3.27s
cargo=0
```

```text
$ npm run check
== chromium
chromium scripts/check-entitlements.mjs: 0
chromium scripts/check-icon.mjs: 0
chromium scripts/check-start.mjs: 0
chromium scripts/check-version-sync.mjs: 0
== webkit
webkit scripts/check-entitlements.mjs: 0
webkit scripts/check-icon.mjs: 0
webkit scripts/check-start.mjs: 0
webkit scripts/check-version-sync.mjs: 0
check=0
```

## Screenshots

None. This work order only adds a workflow file and changes nothing on screen.

## Not done or changed from the work order

- The workflow has never run. This work order does not push, so only the owner can watch the first run and report back.
- `actionlint` was not run because it is not installed. The work order says not to install it.
- No changes from the work order.

## Found on the way

Nothing.