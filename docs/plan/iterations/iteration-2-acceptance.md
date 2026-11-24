# Iteration 2: acceptance checklist

Walk this by eye after `sh docs/plan/iterations/verify-iteration-2.sh` passes. Anything that passes the script and fails here is not done.

How to look: run `npm run preview`, open `http://localhost:4173/?scenario=design#/containers`, set the window to 1180x760 (and 900x600 where a line says so), look in light and dark. Mockup pictures are `docs/plan/design/shots/<name>-light.png` and `<name>-dark.png`. Open the picture next to the page.

Two kinds of comparison. `scripts/check-mockup.mjs` (WebKit only, always 1280x800) compares the closed screens listed in `scripts/mockup-pairs.json`: the shell and Containers (WO-2.2, tightened in WO-3.1c), `empty-state`, `machine-stopped` (WO-3.1c) and `container-detail` (WO-3.2). It only opens a path and takes a picture, so it cannot click or resize. Everything that needs a click first is compared by eye, and this file lists each one: the engine popover, the palette, Help, Activity, the folded sidebar, 900x600, the row menu, the New menu, the problem inspector, the confirm dialog, the Run, Pull and Compose sheets, the toast and the error banner.

## Whole iteration (cheats to look for first)

1. `git diff main -- scripts/not-migrated.json`: only removed lines. Any added line is a cheat.
2. `git diff main --stat -- '*.test.*'`: no test file lost lines without a row in the matching `pr/wo-<id>.md` table (old test, kept or changed or removed, reason). A test with `.skip`, `.todo`, `xit` or a deleted assertion is a cheat (`grep -rn "\.skip\|\.todo\|xit(\|xdescribe" src scripts`).
3. `grep -rn "TODO\|FIXME\|HACK" src/containers src/lib scripts` shows nothing new.
4. Colours and sizes: `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgb\(|px\"" src/containers src/Header.tsx src/EngineSwitcher.tsx src/Shell.tsx src/Activity.tsx` shows no literal colours or pixel sizes. No `style=` anywhere in a migrated file.
5. `ls scripts/checks-pending`: only the checks of iteration 3 are left (`check-disk`, `check-volumes`, `check-network`, `check-netfix`, `check-k8s`, `check-doctor`, `check-resize`, `check-setup`, `check-bring`, `check-bring-home`, `check-replace`, `check-a11y`).
6. Every brought-back check has about as many `check(` lines as it had before. The work orders give the floor (observe 40, mounts 70, guided 28, pull 27, compose 55, containers 100). A check that was shortened to pass is a cheat: compare `git show main:scripts/checks-pending/<name>.mjs` with the new file, line by line, against the list in the work order (each old behaviour is listed as kept, adapted, moved or gone by design with a spec rule).
7. Mockup pairs (`scripts/mockup-pairs.json`): default threshold 0.005; a row above 0.02 has a real `why`; masks hide only live numbers, never a whole screen (a mask on `.content` is allowed only in the shell row of WO-2.2). Run it as `PW_ENGINE=webkit node scripts/check-mockup.mjs` with `npm run preview` running. A row for a screen that needs a click is a cheat (the check cannot click, so such a row would compare the wrong picture).
8. Every work order has `docs/plan/iterations/pr/wo-<id>.md` with the "Contract differences" list, the pasted gate output, screenshots in light and dark next to the mockup picture, and "Found on the way".
9. Words: no "profile", "context", "runtime", "inspect", "mounts", "activity" (as a tab) in visible text where spec section 9 says Machine, Engine, Settings, Folders, History. `grep -rniE "\"(profile|runtime|inspect|mounts)\"" src/containers src/ContainerDetail.tsx src/EngineSwitcher.tsx`.
10. No em dashes in any file written by this iteration: `grep -rl "$(printf '\342\200\224')" src docs/plan/iterations scripts`.
11. New components are imported from `src/ui/op`, never from `src/ui` (the old folder stays until WO-5.1). Any new `import ... from "./ui"` in a migrated file is a cheat; ESLint should already refuse it.
12. Every component this iteration extended (`Menu` open, `contentClassName` and radio item, `EngineButton`, `Palette`, `Row` `onMenuKey`, `Problem` levels). Icons, `Tabs` aside, `Canvas` ref and `onScroll`, `Banner` without title, `Row` `dot` and `tall`, `RowHead` `menuGap`, `NavItem`, `Fields`, `Progress` and `PortalProvider` are iteration 1's: nobody re-adds them (`git diff main -- src/ui/op/Icon.tsx src/ui/op/Tabs.tsx src/ui/op/Canvas.tsx src/ui/op/Banner.tsx` shows nothing from this iteration) has the tests its work order lists, in the component's own test file. No extension without tests.
13. The author closed the design gaps (decisions of 2026-11-12). A work order that says "design gap" or "stop and report" for something now in `container-ui.css` section 11 is a defect. What is still open and named in the pull request files: the Doctor has no filter by container until WO-3.8 (the "and N more" link opens plain Doctor), the Doctor has no evidence or numbered findings until WO-3.8 (the inspector draws neither heading), and there is no picture for Stats, Settings, Folders, Network, History, Pull or Compose-start (compare with the Run sheet and the other rows).

## WO-2.1 Routes

1. Open `#/images`, then `#/volumes`; the browser back button returns to Images; forward returns to Volumes.
2. Reload on `#/networks`: Networks shows, not Containers.
3. Type `#/nowhere`: the app goes to the last page you used, or Containers.
4. `?scenario=design` stays in the address after every click.
5. Cheats: the router tests only test `parseRoute` and skip the hook; `App.tsx` still holds a second copy of the tab; gallery code inside `router.ts` (the gallery is mounted in `src/main.tsx` by iteration 1 and the router must not know it: open `#/dev/gallery` in the preview and it still works).

## WO-2.2 Shell

Compare with `containers-light.png` and `containers-dark.png`.
1. Sidebar 208 px: engine area at the top, then Containers (with a muted count), Images, Volumes, Networks, Kubernetes; a gap; Doctor with a red count; the foot has Settings, Activity, Help, a spacer, Fold.
2. No "Profiles" item, no shortcut list, no Runtime select.
3. Header: title, muted summary, three meters (the bar turns amber above 60 percent for memory; the `design` data uses about 1.2 of 8 GB, so here it is not amber, and the `memHot` unit test proves the colour), then the right-hand controls. Meters are in list page headers only. Meters show real numbers from the mock, not the picture's.
4. The active item is solid blue with white text; folded sidebar (Cmd+B) shows icons only (the CSS does it; the shell only sets the class) and survives a reload (`openpier:sidebar-folded` is `"1"`; any other value or none means open). The Settings foot button has `aria-current="page"` on Settings.
5. At 900x600 Doctor is fully visible and clickable (U21). At 899 px the window cannot get smaller (`minWidth`).
6. In the real app (`npm run tauri dev` is not needed; read `tauri.conf.json`): `titleBarStyle` Overlay, `hiddenTitle` true, 1180x760 default, drag permission present.
7. Compared by the check: the shell row `containers` (threshold 0.02 with a `why`, in light and dark). Compared by eye only: the folded sidebar (click Fold, reload), the Activity sheet, and 900x600.
8. `src/main.tsx` wraps the app in the old provider and `TooltipProvider`; `src/Shell.tsx` mounts `PortalProvider` (container: `main.main`), the new `ToastProvider` and `ConfirmProvider` inside `main.main`. There is no `AppProviders.tsx`. A sheet, a confirm and a toast are drawn inside `.main` and leave the sidebar uncovered. Sidebar items are `NavItem` (`a.nav-item`), and `scripts/check-start.mjs` uses `.sidebar .nav-item`.
9. The mockup meter numbers (Memory 5.1 of 8, Disk 41 of 60) cannot come from the `design` data, so the meters are masked in the row (decision D6).
10. Cheats: `meters` shown on the detail page (the mockup has none); drag attribute on the buttons; a mask on `.content` in a row other than the shell row; `check-layout.mjs` lost the "window does not scroll" lines.

## WO-2.3 Engine switcher

Compare by eye with `engine-switcher-light.png` and `-dark.png` (no mockup row: the popover needs a click). Open `?scenario=two#/containers` and click the engine button.
1. Button: dot, "Colima · default", muted "Running · 4 CPU · 8 GB" (numbers from the mock), up-down chevron.
2. Click: popover 300 px wide (`.pop.engines`), bare caption "Colima", ticked row, then (with `?scenario=two`) a stopped row with a small `Start` button; a separator; "Stop default" and "Machines…" each with a grey hint line.
3. `Start` on the stopped machine: the button reads "Starting…", the page is Containers, it ends Running.
4. Cmd+E opens it; Escape closes it and focus returns to the button.
5. "Machines…" goes to `#/settings/machines` (today's Profiles page, titled Settings).
6. The picture also shows Docker Desktop and OrbStack. They are not expected (iteration 4). Anything else different is a defect.
7. The menu is the real `Menu` with the radio item and `onOpenChange` added in WO-2.3 step 2, and the button is `EngineButton`. Cheats: a hand-made popover that is not `Menu`; the words profile, context or runtime inside the popover; the legacy switch file still present; the Start click works in Chromium only (WebKit run missing).

## WO-2.4 Palette, Help, Activity, shortcuts

Compare by eye with `command-palette-light.png` and `-dark.png` (no mockup row: it needs a key press).
1. Cmd+K opens the palette: search field with `esc`, captions "Containers", "Actions"; typing "kaf" shows kafka and kafka-ui, "Restart kafka", "Logs of kafka"; the highlighted row follows the arrow keys.
2. Empty query: "Go to" first, then recent actions.
3. "?" opens Help. It is in English, generated from the same table as the keys, has "Docs" and "Give feedback". No Portuguese.
4. Cmd+1 does nothing (Projects is not built); Cmd+2 to Cmd+6 go to Containers, Images, Volumes, Networks, Kubernetes; Cmd+0, Cmd+7, Cmd+Shift+A, Cmd+Shift+N do nothing.
5. Activity (foot button) opens a sheet titled "Activity" with the commands, newest first.
6. Design decisions to confirm: Help is built in a Sheet (spec says dialog; no information-dialog class exists); the Images group of the palette is empty until WO-3.4; the palette has no words for "nothing matches" (no design).
7. The palette is the new `Palette` component in `src/ui/op/Palette.tsx` (its own tests); `CommandPalette.tsx` is a thin wrapper. Container entries come from the palette's own `docker ps -a`, not from the Doctor list.
8. Cheats: a second shortcut list typed by hand in `HelpModal.tsx` or `CommandPalette.tsx`; Cmd+R reloads the whole window instead of refreshing data; `/` fires while typing in a field.

## WO-2.5 Fixes from the review

1. Cmd+K, type "kaf": the caption "Containers" with kafka and kafka-ui right under it, then "Actions" with its rows. No caption without rows under it.
2. The sidebar shows a muted `10` next to Containers in `?scenario=design`.
3. On `#/settings/general` the Settings foot button has `aria-current="page"`.
4. Cheats: `check-restyle.mjs` under 7 `check(` lines, or old line 48 brought back; the new Palette order test checks only that captions exist; the count typed as a number in `App.tsx`.

## WO-3.1a Row model

1. Open `src/lib/containerRows.test.ts`: 30 tests, names in Given/When/Then, one per row of the spec 6.4 table.
2. The file imports nothing from React or the DOM.
3. Cheats: `stateView` returns the old `Finished`; "paused" is silently treated as stopped; the sort puts Kubernetes anywhere but last.

## WO-3.1b and WO-3.1c Containers

The check compares `containers` (0.01), `empty-state` and `machine-stopped`. Everything else here is by eye, one picture at a time: `containers-row-menu-*.png`, `containers-new-menu-*.png`, `problem-inspector-*.png`, `confirm-dialog-*.png`, `loading-error-toast-*.png` (no row: three states in one picture). Open each next to the page in both themes.

1. Header: "Containers", muted "10 · 5 need attention" (the number counts containers that have a problem line; the sidebar says `10`), meters, search (220 px, shrinks under 1040 px), blue `New` last.
2. Table head: Name, Image or folder, Ports, "CPU, 10 min", Now, State. Columns line up on every row; nothing shifts when a value is missing.
3. Order: kafka, kafka-ui, shop (open, seven children), scratch-postgres.
4. Problem lines: tinted red or amber over the whole line; kafka-ui has the blue `Fix kafka and kafka-ui…`; kafka says "Fixed together with kafka-ui" and has no button; others have a plain `See why`.
5. The shop row: blocks "booowbx" (red, ok, ok, ok, amber, red, off), `:8080`, "5 of 7 running", `Stop`.
6. A running row has a sparkline; a stopped row has none; stats read like "1% · 120 MB".
7. ⋯ menu matches the picture (Logs, Open a shell, Restart, Copy name, Run it yourself, Remove…), each with its grey hint. `Not an issue` shows on rows with a problem: it is not in the picture and the author accepted it.
8. `New` menu: three items with hints and `⌘N`, `⌘P`. There is no `Bring over from Docker Desktop` item and none in the empty state (WO-3.11 builds it).
9. `Remove…`: dialog titled "Remove kafka-ui?", the command in a `.cmd` line, `Cancel` first and focused, red `Remove`.
10. `See why`: a sheet from the right with the crumb "shop / api"; the sections "What it said" and "What OpenPier found" are missing until WO-3.8 (the Doctor has no evidence field yet).
11. Hover a row: a checkbox replaces the dot (on a project row it replaces the dot and the chevron stays; checking it checks every container of the project). The Kubernetes row has no checkbox, no button and no menu, and a click on it goes to Kubernetes. Check two: "2 selected" with Start, Stop, Remove…, Cancel. Escape clears it, a second Escape clears the search.
12. Keyboard: arrows move, Enter opens, Space checks, Left and Right fold the project, Shift+F10 or the ContextMenu key opens ⋯ (`onMenuKey` on `Row`).
13. States, one URL each: `?scenario=loading` (four skeleton rows), `?scenario=design&empty=1` ("No containers yet" with two buttons), type "zzzz" ('Nothing matches "zzzz".' with `Clear search`), `?scenario=stopped` ("default is stopped", "Your containers and data are kept. Start the machine to see them.", primary `Start default`, engine button says Stopped), `?scenario=unreachable` (red banner "Couldn't list containers" with `Try again` and `Restart default`, old rows kept), Stop on a row (button "Stopping…", blue dot, rows do not move), `?scenario=design&failstart=report-job` then Start (a line with the plain reason and `Try again`; no raw docker text).
14. Still not built, said in the pull request: the virtual list for more than 200 rows (WO-8.8), the inspector evidence (WO-3.8).
15. Cheats: any of the eight states missing; `Containers.test.tsx` reduced (compare the count in the pull request table); a `check-containers.mjs` with far fewer `check(` lines than the three old files; row text hard-coded in the check; a hand-made virtual list with `style=` (all rows render; `VirtualRows` is WO-8.8); `VmStrip` deleted (it must stay, on the not-migrated list); the old `Line` component still imported; the header count counting Kubernetes pod containers.

## WO-3.2 Container detail

The check compares `container-detail` at `#/containers/api/logs` (threshold 0.01, masks on the canvas, the facts line and the filter field). Compare the rest by eye with `container-detail-light.png` and `-dark.png`.
1. Click `api`: the address becomes `#/containers/<id>/logs`. Reload keeps the page; back returns to the list.
2. Header: back, "api", red dot, "Running · Unhealthy", `Open a shell`, `Restart`, `Stop`, ⋯. No meters.
3. Facts line: image, project, "Started 3 h ago", "0 restarts", `:8080`.
4. Red banner "Its health check is failing" with a blue `See why` (and "and N more" when there are more findings).
5. Six tabs: Logs, Stats, Settings, Folders, Network, History. The tab is in the address.
6. Logs: filter field, `Follow` chip pressed, copy icon on the tabs row (all in the `Tabs` `aside` slot); the canvas fills the rest of the height and scrolls inside itself (`Canvas fill` in `.content.stack`; the page does not scroll); the filter field is 180 px; 10,000 lines are kept; times muted; error lines red; scrolling up un-presses Follow.
7. Stats, Settings, Folders, Network, History have no picture. They must still look like the rest: rows of `name` and `meta`, tiles, canvases. Stats shows a CPU sparkline. Flag anything that looks invented. Settings values can be selected for copying (`metaSelectable`).
8. Stop a container with a fix running: Stop, Restart and Remove… are disabled and the header says "A fix is running".
9. Cheats: tabs kept in `useState` (reload loses the tab); the old words Inspect, Mounts, Activity; `check-observe` or `check-mounts` shortened; the Doctor and Volumes lines deleted instead of kept or moved (volumes line must carry the comment "WO-3.5 moves this line").

## WO-3.3a Run sheet

Compare by eye with `run-sheet-light.png` and `-dark.png` (no mockup row: the sheet needs a click). Open Images in `?scenario=guided` and press `Run`.
1. New, Run an image: a sheet titled "Choose an image to run"; pick postgres; "Run postgres:16" opens from the right, 480 px.
2. Rows: Name; Ports with "on this Mac, to" and "in the container"; a taken port is red (the banner has no title, so it is the one-line banner) with the amber banner "Port 5432 on this Mac is already used by db." and `Use 5433 instead`; "Settings the image needs" with a Required password field; "Keep its data" with the volume and the path; two folded chips "More options" and "Show command".
3. Foot: `Cancel` quiet, `Run` blue. Escape while running asks first.
4. After Run: the sheet closes, the new row is focused and a toast says "Started {name}" (it no longer opens the detail).
5. Port fields sit side by side in `<Fields>` (`Field width="port"`). Placement the author accepted: the setup-notes and source links under Name; the CPU and `latest` warnings as banners at the top; "defaults itself" at the top of More options.
6. Cheats: `guided.ts` or `runArgs.ts` edited; a guided check dropped (CPU mismatch, read-only folder, network creation); raw docker text shown on a port clash.

## WO-3.3b Pull sheet

No picture exists. Compare with the Run sheet.
1. Same head and foot; one primary `Pull {reference}`; suggestion chips; Docker Hub search with the sentence that nothing is downloaded; `Official` tag; `Most stars` and `Name` sorting; "Other registry" with host, path, tag, the login command.
2. Progress is a `Progress` bar with "{done} of {total}" under it ("0 of 1" then "1 of 1" in the preview); the raw lines show only on a failure, under `Show output`.
3. Cheats: the private-registry lines of `check-pull.mjs` dropped; a hand-made progress bar with its own colours (it must be `Progress`).

## WO-3.3c Compose sheet

No picture exists. Compare with the Run sheet.
1. New, Start a Compose project: a sheet with project rows (name, folder with `~`, status, small `Start`, ⋯) and `Choose a folder…`.
2. ⋯ items and their hints: "Rebuild and start", "Update images and start", Restart, Show logs, Show in Finder, Copy command, "Remove containers of {name}".
3. A failed start keeps docker's own error under the project, says who holds the port, offers `Stop web and start blog`.
4. Logs open in a sheet with the service picker and a canvas; a restart is marked in the lines.
5. Cheats: `runCompose`, `useComposeRun` or `composeRunState` renamed or changed; the quoted-folder copy test removed; `CommandToast` left on the old markup without a line in the pull request file; `ls scripts/checks-pending` still shows `check-compose.mjs`.
