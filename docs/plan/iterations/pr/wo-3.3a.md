wo-3.3a: Run an image from a sheet, with every guided check kept

## What changed

`src/RunPicker.tsx` and `src/RunPanel.tsx` were rewritten as sheets (using `Sheet` from `src/ui/op`) instead of drawers. The RunPicker now uses `Field` and `List`/`Row` components. The RunPanel now uses `Field`, `Fields`, `FormRow`, `ChipButton`, `Canvas`, `Command`, and `Banner` components for the Run sheet UI. `App.tsx` was updated to render `RunPicker`/`RunPanel` when `runPicker` state is set, and the `Cmd+N` shortcut opens the picker. `Containers.tsx` `New` menu triggers the picker via `onRun`. `src/Containers.tsx` `onRan` now passes the container name and shows a toast. `src/RunPanel.tsx` and `src/RunPicker.tsx` were removed from `scripts/not-migrated.json`.

## Steps done

- [x] Step 1: Rewrite RunPicker as Sheet with Field and List/Row
- [x] Step 2: Rewrite RunPanel as Sheet with Field, Fields, FormRow, ChipButton, Canvas, Command, Banner
- [x] Step 3: Update App.tsx with runPicker state and Cmd+N shortcut
- [x] Step 4: Update Containers.tsx onRan to pass name and show toast
- [x] Step 5: Remove RunPanel.tsx and RunPicker.tsx from not-migrated.json
- [x] Step 6: Write RunPanel.test.tsx with 5 tests

## Evidence

```bash
$ npx vitest run src/RunPanel.test.tsx
 Test Files  1 passed (1)
      Tests  5 passed (5)

$ npx tsc --noEmit
(no output, exit 0)
$ npm run lint
✖ 59 problems (0 errors, 59 warnings)
$ npm test
Test Files  56 passed (56)
     Tests  275 passed (275)
```

## Not done or changed from the work order

- `check-guided.mjs` not yet created (needs preview running)
- Mockup comparison by eye not yet done (needs preview running)

## Found on the way

None.

## Contract differences

None.
