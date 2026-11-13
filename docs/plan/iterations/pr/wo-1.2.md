wo-1.2: a check proves every text and state colour is readable

## What changed

A check now measures every design text and state colour against its surfaces, in light and dark.
It fails when a colour drops below 4.5:1 for text or 3:1 for state icons and dots.
No colour value changed.

## Steps done

- [x] 1. Created `scripts/check-contrast.mjs` with the given code.
- [x] 2. Ran it: 44 lines start with `ok`, 0 start with `FAIL`, exit 0.

## Evidence

Done when checks:

```text
$ node scripts/check-contrast.mjs | grep -c "^ok"
44
```

```text
$ node scripts/check-contrast.mjs | grep -c "^FAIL"
0
```

Lowest measured pairs match the work order: text `--fg-muted` on `--bg-sidebar` is 5.20:1, state `--ok` on `--bg-sidebar` is 4.35:1.

`npm run check` now runs the script in both engines:

```text
chromium scripts/check-contrast.mjs: 0
webkit scripts/check-contrast.mjs: 0
```

Gate (all exit 0):

```text
$ npm ci
12 vulnerabilities (9 moderate, 1 high, 2 critical)
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
test=0
```

```text
$ cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
test result: ok. 135 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 3.26s
cargo=0
```

```text
$ npm run check
== chromium
chromium scripts/check-contrast.mjs: 0
...
== webkit
webkit scripts/check-contrast.mjs: 0
...
check=0
```

## Screenshots

None. This work order adds a check and changes nothing on screen.

## Not done or changed from the work order

- Nothing.

## Found on the way

Nothing.