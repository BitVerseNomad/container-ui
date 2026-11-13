wo-1.4: a check fails when a class name does not exist in the stylesheet

## What changed

`scripts/check-classes.mjs` guards every migrated screen: each class name in a `className` must be defined in `src/ui/openpier.css`. Files still on the old components (`scripts/not-migrated.json`) are skipped until rebuilt. It catches a wrong class name but never adds a class to the stylesheet.

## Steps done

- [x] Step 1: created `scripts/check-classes.mjs` exactly as given.
- [x] Step 2: ran it; `Button.tsx` flagged `default` (a variant value, not a CSS class; `openpier.css` deliberately has no `.default`). Fixed `Button.tsx` so the variant comparison is outside the `className` expression; rendered classes unchanged (`default` = plain `btn`). Re-ran: 0 unknown classes.
- [x] Step 3: changed `chip` to `chipp` in `Chip.tsx`; the script reported `FAIL classes: src/ui/op/Chip.tsx uses classes that openpier.css does not define: chipp` and exit 1; reverted `Chip.tsx`.

## Evidence

Done when:

```text
$ node scripts/check-classes.mjs | tail -1
ok classes: 33 files checked, 71 skipped (not migrated), 0 with unknown classes
```

Probe output (Chip `chip` → `chipp`):

```text
FAIL classes: src/ui/op/Chip.tsx uses classes that openpier.css does not define: chipp
FAIL classes: 33 files checked, 71 skipped (not migrated), 1 with unknown classes
```

Button fix kept `default` out of the className expression; no class added to `openpier.css`.

Gate on the branch:

```text
npm ci: exit 0
npm run lint: 0 errors, 33 warnings
npx tsc --noEmit: exit 0
npm test: Test Files 40 passed (40), Tests 170 passed (170)
cargo: 135 passed; 0 failed; 2 ignored
npm run check: all lines 0 (check-classes.mjs now runs in both engines)
```

## Screenshots

Nothing on screen changes; nothing to capture.

## Not done or changed from the work order

Nothing.

## Found on the way

Nothing new; `docs/plan/FOUND.md` keeps its three earlier entries.
