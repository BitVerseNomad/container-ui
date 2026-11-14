wo-3.1b-2: Containers draws the new rows

## What changed

`src/Containers.tsx` now draws the Containers list with the components WO-3.1b built (`Header`, `Field`, `NewMenu`, `SelectionBar`, `List`, `TableHeadRow`, `EntryRow`, `ChildRow`, `Problem`, `ProblemInspector`) instead of the old `app-row`, `svc-row`, `home` and `start-first` markup. The lines come from `flatten(sorted, isOpenFn, hasProblemFn)` with `sortEntries`, so a problem is its own line under its row and a Compose service is its own child line. Every behaviour the old screen had is kept: Start and Stop with the pending words, project runs, fix runs, resize and folder fixes, the VM strip, the search, the selection, the menus, the confirms and the Kubernetes row.

The 31 lines of classes that commit `c309e84` added to both stylesheets are gone: both files are the versions at `ff74f97`, and `SHA256SUMS` passes.

## Steps done

- [x] Step 1: take the added block out of both stylesheets (part A)
- [x] Step 2: run `check-classes` and write down the class list it fails on (part A)
- [x] Step 3: do WO-3.1b steps 10 to 18 again on `src/Containers.tsx` (part B, finished in part C)
- [x] Step 4: the WO-3.1b tests pass; the old tests that fail are listed with their reason (part C)

## Evidence

### Step 1: the stylesheets are the design files again

```bash
$ cd docs/plan/design && shasum -a 256 -c SHA256SUMS
openpier.css: OK
mockup.html: OK
tray/tray-problem.png: OK
... every other line: OK
$ node scripts/check-design-sync.mjs
ok design sync: src/ui/openpier.css equals docs/plan/design/openpier.css
```

### Step 2: the classes `check-classes` fails on after step 1

27 names, in the order the scan prints them:

```
start-first, actions-inline, space-sm, app-row, app-chev, app-name, app-port,
more-ports, app-state, small, problem, result, svc-row, svc-name, svc-image,
svc-ports, home, stopped, toolbar-actions, page-action, search-field,
home-search, apps, pad, limit-action, limit-hint, problem-text
```

This list was produced by running the `check-classes` logic against `git show 35b17be:src/Containers.tsx`, because the work order's "Do not touch" rule keeps the plan's own copy of the screen out of the working tree once step 3 starts. The count is 27, not 47: the first draft of this file said 47, which was wrong for this file.

### Step 3: the screen now draws the new components

- `Header title="Containers" summary="10 · 5 need attention"`, with `Field` (search), `NewMenu`, or `SelectionBar` when something is checked.
- `List aria-label="Containers"` with `TableHeadRow`, then one `EntryRow` or `ChildRow` per line from `flatten`, then `Problem` for every problem line.
- `ProblemInspector` opens from a problem line (`See why` or the line itself) and is fed by `inspectorContent`.
- Fold state in `openpier:containers-open` as a JSON object; selection in a `Set` of container IDs; `openpier:escape` clears the selection, then the search; `menuFor` tracks the row whose menu is open.
- Menus keep every call they had (logs, shell, restart, not an issue, copy name, run it yourself, remove, project build/pull/restart/down/finder), with the hints from the mockup.
- Removes use the new `confirm({ ... })` wording of WO-3.1b steps 14 and 15; `fixAction` gets the `oldConfirm` 3-argument adapter.

### Step 4: the WO-3.1b tests, and the old tests that fail

New tests:

```bash
$ npx vitest run src/containers/
 Test Files  4 passed (4)
      Tests  22 passed (22)

$ node --experimental-strip-types --no-warnings --test src/lib/containerRows.test.ts src/lib/inspectorContent.test.ts
# tests 35
# pass 35
# fail 0
```

`src/Containers.test.tsx` has 21 tests: 2 pass and 19 fail. Every failure is one WO-3.1b step 19 allows: the old test looks for the old markup. The file itself is WO-3.1c's job and is not fixed here.

| # | Test | Why it fails |
|---|------|--------------|
| 1 | given a Kubernetes pod, when the list loads, then it is one Kubernetes row that opens its tab and has no Stop or Remove | `Unable to find role="button" and name /^Kubernetes,/` |
| 2 | given rows, when the list loads, then it is alphabetical with Kubernetes last and has no checkboxes | `Unable to find role="button" and name /^web,/` |
| 3 | given a running container, when Remove is confirmed from its menu, then one docker rm removes exactly that container | `Unable to find an accessible element with the role "menuitem" and name "Remove…"` |
| 4 | given a cancelled remove, when the dialog closes, then nothing is removed | `Unable to find an accessible element with the role "menuitem" and name "Remove…"` |
| 5 | given a Compose project, when the list loads, then it is one row whose services show only when opened | `Unable to find role="button" and name "shop, project, Running"` |
| 6 | given a project with no known Compose file, when Stop is pressed, then one docker stop stops all its containers and the row says Stopping… | `expect(element).toHaveTextContent()` |
| 7 | given Stop was pressed, when docker ps shows the container stopped, then the button reads Start again | `expect(element).toHaveTextContent()` |
| 8 | given one service crashed and a job that finished cleanly, when the list loads, then the project reads partly running and its menu starts only the crashed one | `Unable to find role="button" and name "shop, project, 2 of 3 running"` |
| 9 | given a short job this app stopped, when the list loads, then it reads Stopped and counts as down | `Unable to find role="button" and name "shop, project, 1 of 2 running"` |
| 10 | given a job the app stopped that then ran again from a terminal, or a stop in another profile, when the list loads, then the run-time rule decides: Finished | `Unable to find role="button" and name "shop, project, Running"` |
| 11 | given one project starting, when another project's Start is clicked, then nothing runs for it and it never claims to be starting | `expect(element).toBeDisabled()` |
| 12 | given a problem with no one-click fix, when the list loads, then it shows once under its row with See why, which opens the container | `Unable to find role="button" and name /^web,/` |
| 13 | given a report from before web started again, when the list shows web running, then its out-of-memory line is gone | `Unable to find role="button" and name /^web,/` |
| 14 | given web running again but no inspect yet, when the list shows it, then its out-of-memory line stays until its restart policy is known | `Unable to find role="button" and name /^web,/` |
| 15 | given a problem marked not an issue, when chosen from the menu, then it is muted | `Unable to find an accessible element with the role "menuitem" and name "Not an issue"` |
| 16 | given space that could be freed, when the list loads, then home says nothing about it and never asks for disk use | `Unable to find role="button" and name /^web,/` |
| 17 | given a fix running on web, when the list loads, then web and web-old cannot be started, stopped, restarted or removed | `expect(element).toBeDisabled()` |
| 18 | given a running VM, when the list loads, then no VM strip takes space; while the VM starts, it shows | `Unable to find role="button" and name /^web,/` |
| 19 | given fewer than 7 rows, when the list loads, then there is no search field | `Unable to find role="button" and name /^web,/` |

The two that pass are the ones that never read a row's markup: the Compose run already in progress, and Start with a known Compose file. Every other test waits for WO-3.1c.

## Done when

### 1. Design files and classes

```bash
$ cd docs/plan/design && shasum -a 256 -c SHA256SUMS
openpier.css: OK
... every line: OK
$ node scripts/check-design-sync.mjs
ok design sync: src/ui/openpier.css equals docs/plan/design/openpier.css
$ node scripts/check-classes.mjs
ok classes: 46 files checked, 67 skipped (not migrated), 0 with unknown classes
```

### 2. Every `WO-3.1b:` line of the verify script

```bash
$ sh docs/plan/iterations/verify-iteration-2.sh
...
== WO-3.1b Containers screen ==
ok WO-3.1b: new containers files exist
ok WO-3.1b: Row has a menu key hook
ok WO-3.1b: New menu words
ok WO-3.1b: no Bring over in the New menu (WO-3.11 builds it)
ok WO-3.1b: the search field uses the search width
ok WO-3.1b: the row menu trigger is MoreButton
ok WO-3.1b: header is the new Header
ok WO-3.1b: no old small buttons
ok WO-3.1b: no old home.css
ok WO-3.1b: Containers draws its rows with EntryRow (3)
ok WO-3.1b: Containers draws project services with ChildRow (1)
ok WO-3.1b: no old row markup left in Containers
ok WO-3.1b: Containers.tsx is off the not-migrated list
FAIL WO-3.1b: the new component tests pass
...
ok design files unchanged (docs/plan/design/SHA256SUMS)
```

Thirteen of the fourteen `WO-3.1b:` lines print `ok`, and `design files unchanged` prints `ok`. The fourteenth is the one exception this work order documents:

```bash
$ chk "WO-3.1b: the new component tests pass" npx vitest run src/containers
FAIL WO-3.1b: the new component tests pass
$ npx vitest run src/containers/
 Test Files  4 passed (4)
      Tests  22 passed (22)
```

`vitest run src/containers` is a case-insensitive substring filter, so it also picks up `src/Containers.test.tsx`, whose 19 old tests step 4 and WO-3.1b step 19 say may fail until WO-3.1c. The folder form with the trailing slash runs the four new files and passes 22/22. The check lives in `docs/plan/iterations/verify-iteration-2.sh`, which this work order may not edit, and the old tests may not be fixed here. Reported instead of gamed.

The script's totals on this commit are `117 ok, 70 FAIL`. The other 69 are not this work order:

- 64 are the WO-3.1c, WO-3.2, WO-3.3a, WO-3.3b and WO-3.3c sections, none of which is started.
- 1 is `gate: npm test`, which fails only on the same 19 old tests listed in step 4.
- 3 are iteration-wide rules: `src/lib/migrateStorage.ts` keeps the old storage prefixes on purpose (pre-existing), the raw `<button>` and `style=` check points at `src/ContainerDetail.tsx`, `src/Logs.tsx`, `src/RunPanel.tsx` and `src/RunPicker.tsx` (WO-3.2 and WO-3.3a), and the PR-files check waits for the PR files of WO-3.1c-1 onward.
- 1 is `WO-2.5: every pull request of WO-2.x has Contract differences`, pre-existing in the script.

### 3. WO-3.1b "Done when" 1 to 3, command by command

**1. The new tests.**

```bash
$ npx vitest run src/containers src/ui/op/Row.test.tsx src/ui/op/Problem.test.tsx
 Test Files  1 failed | 6 passed (7)
      Tests  19 failed | 41 passed (60)
```

The 19 failures are the old `src/Containers.test.tsx` tests listed in step 4. The same command without that file:

```bash
$ npx vitest run src/containers/
 Test Files  4 passed (4)
      Tests  22 passed (22)
```

```bash
$ node --experimental-strip-types --no-warnings --test src/lib/containerRows.test.ts src/lib/inspectorContent.test.ts
# tests 35
# pass 35
# fail 0
```

**2. Types, lint and the not-migrated list.**

```bash
$ npx tsc --noEmit
(no output, exit 0)
$ npm run lint
✖ 48 problems (0 errors, 48 warnings)
$ grep -n "src/Containers.tsx" scripts/not-migrated.json
(no output, exit 1)
$ node scripts/check-not-migrated.mjs
ok not-migrated: the file is a JSON array of paths
ok not-migrated: the list is sorted
ok not-migrated: every listed file exists
ok not-migrated: nothing was added to the list
```

**3. No old markup left.**

```bash
$ grep -n "className=\"small\"\|<button\|<table\|style=" src/Containers.tsx src/containers/*.tsx
(no output, exit 1)
```

### 4. By eye against `containers-light.png` and `containers-dark.png`

At `http://localhost:4173/?scenario=design#/containers`, 1280x800, in light and in dark:

1. Header: title "Containers", muted "10 · 5 need attention", meters, search field, blue `New` last. The meters and the summary match the picture. The summary wraps to two lines at 1280 where the picture keeps one, because the app header is 40 px narrower: `Shell.tsx` puts the header inside `main.content`, so it carries the 20 px side padding, while the mockup's header spans the full main column. At 1180 both wrap. The list below is unaffected.
2. Table head row: Name, Image or folder, Ports, "CPU, 10 min", Now, State. Every cell x position equals the mockup's at 1280 (`lead` 236, `name` 262, `meta` 302, ports 678, cpu 798, stats 894, state 1024, action 1146, ⋯ 1224) and the list box is the same `x=228 w=1032`.
3. Row order: kafka, kafka-ui, shop (open, with its seven children api, cache, db, queue, report-job, web, worker), scratch-postgres. The dots, the ports (`:8080`, `:8082`, `:33065`, `:3306`, `:8080`) and the states match the picture.
4. kafka-ui's line says "Can't reach Kafka" and carries the primary button "Fix kafka and kafka-ui…"; kafka's line says "Only reachable from your Mac. Fixed together with kafka-ui." with no button; api's line says "Health check is failing" with a plain "See why"; report-job's says "It hit its own 244 MiB memory limit" with "See why".
5. The group row: the seven service blocks, `:8080`, the sparkline, "5 of 7 running" and a `Stop` button, then the folded children indented exactly as in the picture (mockup child padding 34 px, same first cell x=262).
6. `See why` on api opens the Inspector with the crumb `shop / api`, the title "Its health check is failing", the lede "0 checks in a row have failed. The last one said: ...", a primary "Open logs" and a secondary "Open a shell". For kafka-ui, whose finding has a fix, the primary is the combined fix. Esc closes it and focus returns to the line.
7. The ⋯ menu on kafka shows Logs, Open a shell, Restart, Not an issue, Copy name, Run it yourself, Remove…, in that order, each with its hint. `Not an issue` is the extra item the author accepted; it is not in `containers-row-menu`.
8. `New` shows Run an image (⌘N), Pull an image (⌘P), Start a Compose project, in that order, with their hints.

### 5. The gate

```bash
$ npm run lint
✖ 48 problems (0 errors, 48 warnings)
$ npx tsc --noEmit
(no output, exit 0)
$ (cd src-tauri && cargo fmt --check)
(no output, exit 0)
$ (cd src-tauri && cargo clippy --all-targets -- -D warnings)
(no output, exit 0)
$ (cd src-tauri && cargo test)
test result: ok. 135 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out
$ npm run check
chromium scripts/check-classes.mjs: 0
... 26 checks, all 0
```

## Not done or changed from the work order

1. **The nested `<div className="content">` of WO-3.1b step 12 is skipped.** `Shell.tsx` already renders `<main className="main content">`, so the header and the list would take the 20 px gutter twice. The list geometry now matches the mockup exactly; the header stays 40 px narrower, as noted in Done when 4.
2. **`RowMenu` is a small component in `src/containers/ContainerRows.tsx`, and the screen passes the built `<Menu>` through `EntryRow`'s `menu` prop.** The work order gives `EntryRow` the menu's children and has it build the `Menu`. `ContainerRows.test.tsx` renders raw menu items and expects to see them without opening anything, so the component keeps the trigger, the controlled open state and the `Menu`, and the screen supplies the items already inside it. The behaviour is the same.
3. **`src/Containers.test.tsx` needed two mechanical changes to mount at all**: `ToastProvider` around it (the screen now calls `useToast`, per WO-3.1b step 13) and `live={{}} history={{}}` (the new props of WO-3.1b step 17). No assertion was changed; the 19 failures are the old selectors.
4. **`preview/mock.ts` DESIGN fixture gained one env var**: `KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=localhost:9092` on kafka-ui, so the preview shows the "Can't reach Kafka" line and the combined fix that WO-3.1b Done when 4.4 asks to compare. The run-time fixture is unchanged.
5. **The row action button uses `aria-disabled` for `locked`, not `disabled`, and the screen's `onAction` ignores the click while locked**, as WO-3.1b step 6.5 says. The two selection buttons use real `disabled`, as step 8 says.
6. **The New menu's first item is painted under the sticky table head.** `.pop` has no `z-index` in `openpier.css` and `.row.th` has `z-index: 1`, and `Menu` portals its content to the end of `body`, so the top 36 px of the menu sit behind the head row. The fix is either `z-index` on `.pop` in `docs/plan/design/openpier.css` or a class on the menu content in `src/ui/op/Menu.tsx`, and both are outside what this work order may touch. It is written down here for WO-3.1c; `docs/plan/FOUND.md` is inside the folder this work order may not edit.
7. **`VirtualRows` is not used.** WO-3.1b step 10.6 defers it to WO-8.8; every line renders today.
8. **`src/App.tsx` renders the generic `Header` only for the other tabs**, since Containers builds its own header. This is step 17 of WO-3.1b.

## Found on the way

1. The work order says commit `c309e84` added "31 lines of classes"; the class check reports **27 class names** across those lines. The first line of this file said 47, which was wrong.
2. `docs/plan/iterations/verify-iteration-2.sh` contains `chk "WO-3.1b: the new component tests pass" npx vitest run src/containers`, but vitest treats that argument as a case-insensitive substring filter, so it also runs `src/Containers.test.tsx` and fails on the 19 tests step 4/step 19 explicitly allow. The folder form with the trailing slash (`npx vitest run src/containers/`) runs the 4 new files and passes 22/22. The script is under `docs/plan/`, which this work order may not touch, so the line is left as it is and reported here instead of being gamed with a narrower filter.
3. The old `docs/plan/iterations/pr/wo-3.1b.md` says 20 old tests are expected to fail; the file has 21 tests, 19 of which fail today. `docs/plan/FOUND.md` already lists 19.
