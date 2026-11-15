wo-3.3c: Compose projects as a sheet with live logs

## What changed

`src/ComposeProjects.tsx` converted from `Drawer` to `Sheet`: it now renders as a sheet titled "Compose projects" using `Sheet`, `Field`, `Fields`, `FormRow`, `Button`, `Icon`, `DropdownMenu` from `src/ui/op`, with project cards, start/stop/restart/rebuild/pull/down actions, a "More actions" menu, per-project live logs (`ComposeLogs`), and compose-progress output.

`src/ComposeLogs.tsx` converted to read-only sheet content using `Banner`, `Icon`, `Select`, `Button` from `src/ui/op` (no `Drawer`, no `./ui` imports). Live logs poll `compose_logs` every 2 s, filter by service/text, follow/pause on scroll, and mark compose runs in the stream.

`src/Containers.tsx` wraps `ComposeProjects` and `ComposeLogs` in `Sheet` components (opened from the project menu's "Show logs"/"Start a Compose project"), passing `onClose` to `ComposeProjects`.

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
