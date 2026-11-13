wo-0.0: every check in the gate passes

## What changed

1. Lint runs with the React hooks plugin installed, so the gate no longer fails on a missing rule.
2. The Rust code is formatted and clippy clean.
3. Nothing a user sees changed.

## Steps done

- [x] Created branch `wo-0.0` from `main`.
- [x] Installed `eslint-plugin-react-hooks@^5`.
- [x] Replaced the whole content of `eslint.config.js`.
- [x] Ran `npm run lint`: 0 errors, 52 warnings.
- [x] Committed `chore: make lint pass`.
- [x] Formatted the Rust code and committed `style: format the Rust code`.
- [x] Ran `cargo clippy --fix`.
- [x] Fixed the remaining clippy errors by hand using the table.
- [x] Committed `chore: make clippy pass`.

## Evidence

`npm ci` (last 10 lines):

```text
12 vulnerabilities (9 moderate, 1 high, 2 critical)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

`npm run lint; echo "exit $?"`:

```text
✖ 52 problems (0 errors, 52 warnings)
  0 errors and 3 warnings potentially fixable with the `--fix` option.
exit 0
```

`npx tsc --noEmit; echo "exit $?"`:

```text
exit 0
```

`npm test`:

```text
# tests 586
# pass 586
# fail 0
Test Files  10 passed (10)
      Tests  98 passed (98)
```

`(cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test 2>&1 | grep "^test result")`:

```text
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.93s
test result: ok. 137 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 3.28s
```

`git diff main --stat -- src | tail -1`: no output (no file under `src/` changed).

## Screenshots

None. This work order changes no screen.

## Not done or changed from the work order

Nothing.

## Found on the way

Nothing.
