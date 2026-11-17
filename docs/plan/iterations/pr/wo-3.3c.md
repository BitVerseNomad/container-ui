wo-3.3c: Compose projects as a sheet with live logs

## What changed

`src/ComposeProjects.tsx` converted from `Drawer` to `Sheet`: it now renders as a sheet titled "Start a Compose project" using `Sheet`, `Field`, `Fields`, `FormRow`, `Button`, `Icon`, `DropdownMenu` from `src/ui/op`, with project cards, start/stop/restart/rebuild/pull/down actions, a "More actions" menu, per-project live logs (`ComposeLogs`), and compose-progress output.

`src/ComposeLogs.tsx` converted to read-only sheet content using `Banner`, `Icon`, `Select`, `Button` from `src/ui/op` (no `Drawer`, no `./ui` imports). Live logs poll `compose_logs` every 2 s, filter by service/text, follow/pause on scroll, and mark compose runs in the stream.

`src/Containers.tsx` renders `ComposeProjects` directly (it draws its own sheet, so the outer "Compose projects" sheet is gone), and wraps `ComposeLogs` in a `Sheet` titled "Logs of {project}".

## Changed tests and checks

- `src/ComposeProjects.test.tsx`: "Add a folder" renamed to "Choose a folder…" (the spec's word), selector and test name updated, behaviour unchanged. New: "given the sheet opens, then its dialog is named Start a Compose project".
- `scripts/check-compose.mjs`: dialog selector "Compose projects" to "Start a Compose project" (5 lines), "Add a folder" selector to "Choose a folder" (2 lines). The 61 `check(` lines are unchanged.
- `scripts/check-menus.mjs`: the New menu item now expects the dialog "Start a Compose project" (one line).

`src/PullPanel.tsx` fixed: `useBringBusy()` (reactive boolean) replaces the `busy` function from fixStore for disable/fetch-busy state.

`scripts/checks-pending/check-compose.mjs` moved to `scripts/check-compose.mjs` (61 check lines kept). `scripts/not-migrated.json` no longer lists `ComposeProjects.tsx` or `ComposeLogs.tsx`.

## Steps done

- [x] Step 1: Fix PullPanel.tsx TS parse error and type errors (failure state, Banner tone, Icon size, FormRow htmlFor, busy function → useBringBusy)
- [x] Step 2: Fix ComposeProjects.tsx (duplicate Button import, useConfirm from ui/op, ConfirmOptions object, Banner tone/title, title prop on Button, Select options)
- [x] Step 3: Fix ComposeLogs.tsx (imports from ui/op, Select with options, Button instead of native button/select)
- [x] Step 4: Fix Containers.tsx (onClose prop passed to ComposeProjects)
- [x] Step 5: Move checks-pending/check-compose.mjs to scripts/check-compose.mjs
- [x] Step 6: Fix ComposeProjects.test.tsx ConfirmProvider import (./ui → ./ui/op) so useConfirm resolves

## Evidence

```bash
$ npx tsc --noEmit
(no output, exit 0)
$ npm run lint
✖ 59 problems (0 errors, 59 warnings)
$ npx vitest run
Test Files  56 passed (56)
     Tests  275 passed (275)
$ grep -c "check(" scripts/check-compose.mjs
61
```

## Not done or changed from the work order

- `scripts/check-compose.mjs` mockup comparison not yet run (needs preview running, done in step 4 of the iteration finish)

## Found on the way

- `ComposeProjects` uses `useConfirm` from `./ui/op` (object-based) while its test wrapped in `ConfirmProvider` from `./ui` (deprecated); fixed the test import to `./ui/op` so the confirm context resolves.

## Contract differences

None.
