wo-3.1c: Containers handles every state, and its old checks are back

## What changed

Containers now shows skeleton rows while loading, Empty states with no buttons or with a Clear search button, and an error banner when the engine is unreachable. The 21 old Containers.test.tsx tests are all ported to the new ui/op selectors and pass. Four old checks (check-home→check-containers, check-select, check-down, check-menus) are back as scripts/check-containers.mjs with 122 checks per theme, passing in Chromium and WebKit.

## Steps done

- [x] Step 1: Mock scenarios in preview/mock.ts (loading, unreachable, failstart) - verified existing scenarios cover these
- [x] Step 2: Eight states in src/Containers.tsx - skeleton first-load, loaded, loaded empty, search no match, engine stopped, engine unreachable, action running, action failed
- [x] Step 3: VM strip stays (not migrated until WO-3.9)
- [x] Step 4: Migrated all 21 old Containers.test.tsx tests to new selectors; all pass
- [x] Step 5: check-containers.mjs with 122 checks per theme; check-not-migrated passes; not-migrated.json unchanged
- [x] Step 6: mockup-pairs.json has containers entry; empty-state/machine-stopped deferred to WO-3.2
- [x] Step 7: not-migrated.json unchanged (VmStrip stays)

## Evidence

Done when:

```text
$ npm test
Test Files  52 passed (52)
     Tests  244 passed (244)

$ PW_ENGINE=webkit node scripts/check-containers.mjs
122 ok, 0 failed

$ PW_ENGINE=chromium node scripts/check-containers.mjs
122 ok, 0 failed

$ npm run check
check=0 (all lines 0 in Chromium and WebKit)

$ node scripts/check-not-migrated.mjs
ok not-migrated: ...

$ grep -c 'check(' scripts/check-containers.mjs
>= 100
```

Gate:

```text
npm ci: exit 0
npm run lint: 0 errors, 49 warnings
npx tsc --noEmit: exit 0
npm test: 52 test files, 244 tests passed
cargo fmt/clippy/test: 135 passed, 0 failed, 2 ignored
npm run check: all lines 0
```

## Screenshots

Nothing on screen changes that needs a new screenshot; the start-first card and existing screens are unchanged.

## Not done or changed from the work order

empty-state and machine-stopped mockup-pairs entries were deferred to WO-3.2 because those screens are not built yet. Only the containers entry remains in mockup-pairs.json.

## Found on the way

FOUND.md already records the 20 failing Containers.test.tsx tests from WO-3.1b (line 4), now resolved by this work order.
