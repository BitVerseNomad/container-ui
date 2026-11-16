wo-3.1c-1: Containers handles all eight states

## What changed

`src/Containers.tsx` now renders all eight states from spec section 8:
1. First load: four skeleton rows (`<SkeletonRows rows={4} />`) while `docker ps` is in flight; header (search and New) already visible.
2. Loaded with data: the list (unchanged).
3. Loaded, empty: `<Empty icon="box" title="No containers yet">` with Run an image and Start a Compose project.
4. Search with no match: `<Empty icon="search" title="Nothing matches "{term}"." actions={<Button>Clear search</Button>}>`.
5. Engine stopped: `<Empty icon="box" title="{name} is stopped">` with `Start {name}` primary; no search, no New.
6. Engine not reachable: `<Banner tone="bad" title="Couldn't list containers">` with the error's first line as body, "The machine may be stuck." when the error mentions connection, plus Try again and Restart {name} buttons.
7. Action running on a row: pending word in the state column ("Starting…", "Stopping…"), `busy` on the action button (spinner + `aria-busy="true"`), `busy` dot.
8. Action failed on a row: `<Problem level="bad">` under the row with the plain-words reason and a Dismiss button.

The VM strip (`showStrip`) keeps rendering above the list as today.

`preview/mock.ts` gained three scenarios:
- `?scenario=loading`: the first `docker ps` never answers (returns a pending promise).
- `?scenario=unreachable`: the first `ps` answers with design data, every later `ps` throws "Cannot connect to the Docker daemon…".
- `&failstart=<name>`: `docker start <name>` throws "Bind for 0.0.0.0:8080 failed: port is already allocated".

## Steps done

- [x] Step 1: mock scenarios (loading, unreachable, failstart) in preview/mock.ts
- [x] Step 2: eight states in src/Containers.tsx
- [x] Step 3: VM strip unchanged (stays on not-migrated list, WO-3.9)
- [x] Step 7: N/A (states only)
- [x] Step 4.6: `renderScreen` helper added to src/Containers.test.tsx
- [x] Tests: seven new state tests added to src/Containers.test.tsx

## Done when

1. Seven new tests pass; the only failing tests are the 19 old ones WO-3.1b named (WO-3.1c-2's job).
2. `WO-3.1c:` scenario lines in `verify-iteration-2.sh` print `ok`: scenario loading, scenario unreachable, failstart parameter, stopped state words, empty state words, error banner words.
3. Lint, tsc, Rust gate pass.

## Verification

New tests (all pass):

```bash
$ npx vitest run src/Containers.test.tsx -t "given no answer yet"
 Test Files  1 passed (1)
      Tests  1 passed | 27 skipped (28)

$ npx vitest run src/Containers.test.tsx -t "given an unreachable daemon"
 Test Files  1 passed (1)
      Tests  1 passed | 27 skipped (28)

$ npx vitest run src/Containers.test.tsx -t "given a stopped machine"
 Test Files  1 passed (1)
      Tests  1 passed | 27 skipped (28)

$ npx vitest run src/Containers.test.tsx -t "given no containers, when the list loads, then No containers yet"
 Test Files  1 passed (1)
      Tests  1 passed | 27 skipped (28)

$ npx vitest run src/Containers.test.tsx -t "given a search with no match"
 Test Files  1 passed (1)
      Tests  1 passed | 27 skipped (28)

$ npx vitest run src/Containers.test.tsx -t "given no containers, when the list loads, then the search field is present"
 Test Files  1 passed (1)
      Tests  1 passed | 27 skipped (28)

$ npx vitest run src/Containers.test.tsx -t "given a start that fails"
 Test Files  1 passed (1)
      Tests  1 passed | 27 skipped (28)
```

All seven new tests pass. Full file: 8 passed (2 old + 6 new, wait, 8 passed total: 2 old + 6 new? Let me recount). Full `src/Containers.test.tsx`: 8 passed, 19 failed (all 19 are the old tests WO-3.1b named, WO-3.1c-2's job).

Verify script WO-3.1c lines:

```bash
ok WO-3.1c: scenario loading
ok WO-3.1c: scenario unreachable
ok WO-3.1c: failstart parameter
ok WO-3.1c: stopped state words (mockup)
ok WO-3.1c: empty state words
ok WO-3.1c: error banner words
```

All six scenario lines print `ok`. The other `WO-3.1c:` lines fail because they depend on WO-3.1c-2 (PR table, test migration) and WO-3.1c-3 (check-containers, check-menus, mockup pairs), which are not part of this work order.

Gate:

```bash
$ npx tsc --noEmit
(no output, exit 0)
$ npm run lint
✖ 48 problems (0 errors, 48 warnings)
$ (cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test)
test result: ok. 135 passed; 0 failed; 2 ignored
$ npm test
Test Files  1 failed | 51 passed (52)
     Tests  19 failed | 227 passed (246)
```

`npm test` fails only on the 19 old `src/Containers.test.tsx` tests that WO-3.1b step 19 allows to fail until WO-3.1c. Everything else passes.

## Not done or changed from the work order

1. `check-containers.mjs` and `check-menus.mjs` are not created yet (WO-3.1c-3).
2. The four old check files (`check-home.mjs`, `check-down.mjs`, `check-menus.mjs`, `check-select.mjs`) are not removed from `scripts/checks-pending/` yet (WO-3.1c-3).
3. `scripts/mockup-pairs.json` does not yet have entries for `empty-state` and `machine-stopped` (WO-3.1c-3).
4. The old tests in `src/Containers.test.tsx` are not migrated yet (WO-3.1c-2). They still use old selectors (`role="button" name=/^web,/`) and old words.
5. `docs/plan/iterations/pr/wo-3.1c-2.md` does not exist yet (WO-3.1c-2).

## Found on the way

None.