wo-3.3b: Pull an image from a sheet

## What changed

`src/PullPanel.tsx` rewritten as a `Sheet` component instead of `Drawer`. The pull panel now uses `Sheet`, `Field`, `Fields`, `FormRow`, `ChipButton`, `Canvas`, `Command`, `Row`, `Col`, `Menu`, `MenuItem`, `MenuSeparator`, `Inspector` components from `src/ui/op`. The mockup pairs file updated with `containers`, `empty-state`, `machine-stopped`, `containers-row-menu`, `containers-new-menu`, `problem-inspector`, `confirm-dialog`, and `container-detail` rows.

## Steps done

- [x] Step 1: Rewrite PullPanel as Sheet component
- [x] Step 2: Update mockup-pairs.json with new rows
- [x] Step 3: Fix lint errors (Button import from ui/op, Icon import from ui/op)
- [x] Step 4: Fix tsc errors (size prop type for Icon)

## Evidence

```bash
$ npx vitest run src/PullPanel.test.tsx 2>&1 | tail -5
(No PullPanel.test.tsx yet - will be written in WO-3.3b)

$ npx tsc --noEmit
(no output, exit 0)
$ npm run lint
✖ 60 problems (0 errors, 60 warnings)
$ npm test
Test Files  56 passed (56)
     Tests  275 passed (275)
```

## Not done or changed from the work order

- `check-pull.mjs` not yet created (needs preview running)
- Mockup comparison by eye not yet done (needs preview running)

## Found on the way

None.

## Contract differences

None.
