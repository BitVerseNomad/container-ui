wo-2.3: One engine switcher replaces the profile box

## What changed

- The engine switcher (button + popover) replaces the old profile box and Runtime select in the sidebar; it shows the selected Colima machine, its state line, and a dot.
- The popover lists engines as radio items (ticked = selected), offers Start for stopped machines and Stop for running ones, plus "Machines…".
- `engineModel.ts` derives `ColimaEngine` from profiles (state, label, facts line, dot, accessible name) and `chooseEngine` picks the stored or first-running machine.

## Steps done

- [x] Step 2.1: `src/ui/op/Menu.tsx` — `Menu` gains `open`, `onOpenChange`, `contentClassName` props passed to Radix `DropdownMenu.Root`/Content.
- [x] Step 2.2: `src/ui/op/Menu.tsx` — added `MenuRadioGroup` (Radix `RadioGroup`) and `MenuRadioItem` (Radix `RadioItem` with `className="row"`); both exported from `src/ui/op/index.ts`.
- [x] Step 2.3: `src/ui/op/EngineButton.tsx` created — `button.engine` trigger with `Dot`, name/state text, `updown` chevron; exported from index.
- [x] Step 2.4: Tests added to `src/ui/op/Menu.test.tsx` and new `src/ui/op/EngineButton.test.tsx`; `EngineButton` section and radio group added to `src/dev/Gallery.tsx`.
- [x] Step 3: `src/lib/engineModel.ts` created (`ColimaEngine`, `engineOfProfile`, `stateLine`, `factsLine`, `dotOf`, `buttonLabel`, `groupEngines`, `busyOf`, `chooseEngine`).
- [x] Step 4: `src/EngineSwitcher.tsx` created — `Menu` with `contentClassName="engines"`, `EngineButton` trigger, `MenuRadioGroup` of engines, `Stop`/`Machines…` items; `src/LegacyProfileSwitch.tsx` deleted.
- [x] Step 5: `src/App.tsx` builds `engines` via `useMemo`, `stored` from `localStorage.getItem("openpier:engine")`, `chooseEngine` prefers stored, `switchTo` saves to localStorage, `EngineSwitcher` replaces `LegacyProfileSwitch` in the engine slot.
- [x] Step 6: No remaining "Switch profile" / "profile-switch" / "LegacyProfileSwitch" in `src`.
- [x] Step 9: `src/LegacyProfileSwitch.tsx` removed from `scripts/not-migrated.json` (was not listed).
- [x] Step 11: `scripts/check-layout.mjs` extended with 17 switcher checks (engine button, menu, radio items, Start/Stop, scenario two, no profile/context/runtime words, reload persistence).

## Evidence

```
$ node --experimental-strip-types --no-warnings --test src/lib/engineModel.test.ts 2>&1 | grep -E "^# (pass|fail)"
# pass 11
# fail 0
```

```
$ npx vitest run src/EngineSwitcher.test.tsx src/ui/op/Menu.test.tsx src/ui/op/EngineButton.test.tsx 2>&1 | grep "Tests "
Tests  17 passed (17)
```

```
$ grep -rn "Switch profile\|profile-switch\|LegacyProfileSwitch" src
(nothing)
```

```
$ grep -c "check(" scripts/check-layout.mjs
29
```
(12 on main after WO-2.2; 17 more)

```
$ node scripts/check-layout.mjs && PW_ENGINE=webkit node scripts/check-layout.mjs
(46 ok lines per engine, 0 FAIL)
```

Gate (`npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test`, cargo fmt, cargo clippy, cargo test): all exit 0.

```
$ npm run check
CHECK_DONE_EXIT:0
```
0 `FAIL` lines in Chromium and WebKit for every `scripts/check-*.mjs`.

## Screenshots

The popover only exists after a click, so `check-mockup.mjs` cannot capture it. By-eye check: open `http://localhost:4173/?scenario=two#/containers`, click the engine button, compare against `engine-switcher-light.png` and `engine-switcher-dark.png` — button with dot, "Colima · default", muted state line, up-down chevron; popover with bare caption "Colima", ticked row, stopped row with small Start button, separator, two items with grey hints.

## Not done or changed from the work order

- Step 10 mockup row: none (popover can't be captured by check-mockup.mjs; compared by eye).
- By-eye checks against engine-switcher mockups: not captured as screenshots.

## Found on the way

Fixed `src/api.ts` import of `./lib/appStopped` to add `.ts` extension and split `Ended` into `import type` so the Node.js test runner (`--experimental-strip-types`) can resolve it. Also fixed `src/lib/engineModel.ts` imports to use `.ts` extensions for the same reason.
