wo-3.3b: Pull an image from a sheet

## What changed

The Pull panel is now a `Sheet` titled "Pull an image", built from the `src/ui/op` components. It has two modes: Docker Hub (search, then pick an image) and Other registry (host, path and tag, with cloud presets). Pull progress is one meter with "{done} of {total}" layers, computed by a new pure function in `src/lib/pullProgress.ts`. A failed pull that needs a sign-in shows "Sign in to {host} first" with the login command. The raw output is folded under "Show output".

`scripts/checks-pending/check-pull.mjs` moved to `scripts/check-pull.mjs` with its selectors updated for the sheet. `scripts/not-migrated.json` no longer lists `src/PullPanel.tsx`. `scripts/check-menus.mjs` expects the sheet title "Pull an image".

## Steps done

- [x] Step 1: `pullProgress` test first, then the pure function
- [x] Step 2: Rewrite `PullPanel` as a `Sheet` with `Field`, `FormRow`, `ChipButton`, `Row`, `Progress`, `Command`, `Canvas`, `Banner`
- [x] Step 3: `PullPanel.test.tsx` with 8 tests written first
- [x] Step 4: Move `check-pull.mjs` out of checks-pending with `git mv`, update selectors
- [x] Step 5: Remove the old entry from `not-migrated.json`

## Evidence

```bash
$ WO="WO-3.3b" sh verify-wo.sh
ok WO-3.3b: PullPanel has no Drawer
ok WO-3.3b: PullPanel has no old out-log box
ok WO-3.3b: progress is the Progress component
ok WO-3.3b: pullProgress and its test exist
ok WO-3.3b: Other registry
ok WO-3.3b: searching downloads nothing, kept
ok WO-3.3b: PullPanel test exists
ok WO-3.3b: check-pull left checks-pending
ok WO-3.3b: check-pull keeps its old lines (32)
9 ok, 0 FAIL
```

`npx vitest run src/PullPanel.test.tsx`: 8 passed. `npm test`: 676 node tests and 283 vitest tests pass. `check-pull.mjs` was not run in a browser here; the loop runs it.

## Not done here

- Cmd+P opens the sheet from Containers: the `App.tsx` shortcut still switches to Images and `setPullOnOpen` stays. Left for WO-3.3c or a later step, since `App.tsx` is not owned by this work order.
