wo-tw-2: WO-TW-2 step 1: migrate the Button building block to Tailwind utilities

## What changed

- `src/ui/op/Button.tsx`: replaced its `openpier.css` `.btn`/variant/size classes with Tailwind utilities mapped to the design tokens in `src/ui/tailwind.css`. Variants live in a small `variants` map joined with `cn()`/`clsx` from `tailwind-merge`/`clsx`. Public props and the `Icon`/`Spinner` usage are unchanged; screens keep importing from `./ui/op`.
- `src/ui/op/Button.test.tsx`: updated the class assertions to the new Tailwind classes (same five test scenarios, same coverage).
- `src/ui/openpier.css` section 1: added spacing tokens `--spacing-6/8/10/12` and shadow tokens `--shadow-btn`/`--shadow-danger` needed by the migrated components (the Tailwind migration adds tokens when a value is missing from the design system).
- `docs/plan/design/openpier.css`: synced to `src/ui/openpier.css` (the two files stay equal, per the plan rule).
- `src/ui/tailwind.css`: mapped the new spacing and shadow tokens in the `@theme inline` block.

`openpier.css` still keeps the `.btn` rule and all other component rules until the screens that use them are migrated in WO-TW-3 and the rules are removed in WO-TW-4.

## Steps done

- [x] Added the missing spacing/shadow tokens to `src/ui/openpier.css` section 1.
- [x] Synced `src/ui/openpier.css` over `docs/plan/design/openpier.css`.
- [x] Mapped the new tokens in `src/ui/tailwind.css`.
- [x] Migrated `Button` to Tailwind utilities + `cn()`/`clsx` variants map.
- [x] Updated `Button.test.tsx` class assertions.
- [x] `npx vitest run src/ui/op/Button.test.tsx` passes (5 tests).
- [x] `check-mockup` in WebKit shows no regression vs. the WO-TW-1 state (the pre-existing mockup diff is unchanged).

## Evidence

```
$ npx vitest run src/ui/op/Button.test.tsx 2>&1 | grep "Tests "
Tests  5 passed (5)
```

```
$ npm run lint 2>&1 | tail -1
✖ 59 problems (0 errors, 59 warnings)
```

```
$ npx tsc --noEmit
(exit 0)
```

## Not done or changed from the work order

- WO-TW-2 continues with the remaining `src/ui/op/` components (Field, Select, Checkbox, Switch, Tabs, Chip, Dot, Sev, Tile, Row, Menu, Tooltip, Sheet, ConfirmDialog, Toast, Banner, Empty, Problem, Progress, Meters, Sparkline, Facts, Inspector, Canvas, Command, Palette, NavItem, GroupCaption, EngineButton, Blocks, SkeletonRows, Icon, Portal).
- `openpier.css` still holds component rules; they are removed in WO-TW-4 once no file in `src/` uses them.
- The `check-classes` guard now reports Button's Tailwind classes as undefined (expected: Tailwind classes are not in a CSS file; verify-tailwind.sh drops that line from its display).

## Contract differences

None: Button's public props and names are unchanged.

## Verify result (`sh docs/plan/iterations/verify-tailwind.sh`, preview on 4173)

```
ok no .skip or .only in tests
ok mockup comparison passes in Chromium
ok every pull request text of this migration has a verify result
== Totals ==
161 ok, 59 FAIL
```
