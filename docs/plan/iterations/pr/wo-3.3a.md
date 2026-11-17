wo-3.3a: Run an image from a sheet, with every guided check kept

## What changed

- `src/RunPicker.tsx`: the picker is a `Sheet` with a `Field` (labelled "Image to run"), a `List` of the images you have, and Cancel and Continue. Its behaviour is the same.
- `src/RunPanel.tsx`: the Run sheet is a `Sheet` titled `Run {image}`. It has, in order: the image's warnings (CPU mismatch, unpinned `latest`, name clash), the Name row with the setup notes, Docker Hub and source links, the Ports rows (with the taken-port banner and its `Use {port} instead` button), the "Settings the image needs" rows (password fields for password variables), the "Keep its data" rows (named volume suggestion, read-only folder checkbox, Library and hidden folders refused), and two chips: More options (defaults line, network, extra environment, add folder or port, exposing to the network) and Show command (`Command` with copy).
- A failed run shows a `Banner` with a plain title ("The host port is taken" for a port clash). The raw Docker text sits behind Show output.
- While a run is starting, Escape asks "Stop the run?" before the sheet closes. Idle Escape and a click on the overlay close the sheet through `Sheet`.
- `src/RunPanel.test.tsx`: 15 tests in Given/When/Then form (5 existing, 10 new).
- `src/RunPicker.test.tsx` (new): one test, picking an image through Continue.
- `scripts/checks-pending/check-guided.mjs` moved to `scripts/check-guided.mjs` with `git mv`. All 32 `check(` lines are kept (one check was split in two, for the two chips). Selectors now use the `Sheet` markup (`.sheet`, `.banner`, `.cmd`, the network combobox, the chips).

Why: the guided Run is the product's best idea (U9, U15, P3). It now sits on the mockup's sheet, and every guided check still runs.

## Steps done

- [x] Step 1: RunPicker and RunPanel use `Sheet`; no `Drawer` in either file.
- [x] Step 2: RunPicker keeps its list and `onPick(ref)`; the field has a label.
- [x] Step 3: RunPanel body, in the order of the work order (see above).
- [x] Step 4: failure shows a plain title, with raw output behind Show output.
- [x] Step 5: Escape asks before closing a running sheet; idle close is `Sheet`'s.
- [x] Step 6: `check-guided.mjs` moved and selectors updated; the checks are kept.
- [x] Step 7: `src/Containers.tsx` and `src/App.tsx` already passed `(id, name)` to `onRan` and already render the picker from `runPicker` state (from the earlier commit on this branch). Not changed here.
- [x] Step 8: `scripts/not-migrated.json` does not list `src/RunPanel.tsx` or `src/RunPicker.tsx`, so nothing to remove.

## Evidence

```bash
$ WO="WO-3.3a" sh scratchpad/verify-wo.sh
12 ok, 0 FAIL

$ npx vitest run src/RunPanel.test.tsx src/RunPicker.test.tsx src/Containers.test.tsx src/containers/NewMenu.test.tsx
Tests  50 passed (50)

$ npx vitest run        (whole suite)
Test Files  57 passed (57)
Tests  285 passed (285)

$ npx tsc --noEmit
exit 0

$ npx eslint src/RunPanel.tsx src/RunPicker.tsx src/RunPanel.test.tsx src/RunPicker.test.tsx
(no output)

$ node --experimental-strip-types --no-warnings --test "src/lib/*.test.ts" "src/runArgs*.test.ts"
# pass 662  # fail 0
```

`lib/guided.ts` and `runArgs.ts` are not changed (`git diff --stat` on them is empty).

## Not done or changed from the work order

- Not run: `check-guided.mjs` in Chromium and WebKit, and the preview. The loop runs them. The check selectors are updated but not yet proven in a browser.
- Not done: the mockup comparison by eye (`run-sheet-light.png`, `-dark.png`). The loop does this with the preview.
- Ports: each declared port gets its own row, and the declared port is kept as the default. A clash is warned about, not changed for the user. The work order's "first free port" default would have hidden the clash the check and the banner test for.
- More options has no restart policy. `buildRunArgs` does not support one, and the old panel had none.
- Extra folders: every folder row lives under "Keep its data". "Add a folder or volume" is in More options. The "Let the container change files here" box sits under each host folder row, not in More options.
- "Settings the image needs" shows the setting name as text, not as an input. Its hint comes from a small map in `RunPanel.tsx` (postgres, mysql, mariadb). `hintFor` is for Docker errors, so it was not used for this.
- Stop wording: the old panel had no words for stopping. The sheet says the container may still come up, because closing does not cancel `docker run`.
- `Fields` is a column in `src/ui/op/Field.tsx`, so side-by-side fields sit in a row `div` inside it. `Field.tsx` was not changed.
- The row focus and toast after Run (step 4 in Containers) were not checked in a browser.

## Found on the way

- The earlier wip commit left the sheet without ports editing, the password check (`^PASSWORD` never matched `POSTGRES_PASSWORD`) and the network menu. They are back here.

## Contract differences

- `RunPanel` and `RunPicker` keep their default exports and props (`onRan(id, name)` is the only change, from the earlier commit).
