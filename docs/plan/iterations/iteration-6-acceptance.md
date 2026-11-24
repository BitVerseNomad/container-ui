# Iteration 6 acceptance checklist

Walk this by eye after `sh docs/plan/iterations/verify-iteration-6.sh` prints no FAIL. Part 1 covers WO-8.1a to WO-8.8. Part 2 (8.9 to 8.15) is appended below by the plan's author.

Preview: `npm run preview`, then `http://localhost:4173/?scenario=<name>#/<route>`. Pictures are in `docs/plan/design/shots/<name>-light.png` and `-dark.png`. A "skip" line in the script means a step had nothing to run here: list it for the owner (section "Open gaps" at the end), do not count them as failures.

## Cheats to look for in every work order

1. A test that was weakened, skipped (`.skip`, `#[ignore]`, `xit`) or deleted. `git diff main --stat -- '*.test.*' src-tauri/src` should only show new or longer tests.
2. `scripts/not-migrated.json` longer than before.
3. A colour, size or shadow written in a component, a `style=` outside `Meters.tsx`, `LogView.tsx` and `VirtualRows.tsx` and the `Meters.tsx` block, a class that `container-ui.css` does not define.
4. A new `localStorage` key that is not `openpier:...`.
5. A `TODO`, `FIXME`, `unimplemented!()` or `todo!()` left in. `grep -rn "todo!()\|unimplemented!()" src-tauri/src` prints nothing.
6. A widened `src-tauri/capabilities/default.json` or a changed CSP in `tauri.conf.json`. Both must be byte for byte as before this part.
7. A person's name, an email, a PagerDuty name or data anywhere in the new files.
8. A command that changes the machine run during the work (no `docker`, `colima`, `brew` outside the nightly workflow).
9. An em dash or a double dash in prose the work order asked for.
10. A pull request text file `docs/plan/iterations/pr/wo-<id>.md` that has no evidence (pasted outputs) or no "Not done or changed" section.

## WO-8.1a and WO-8.1b: menu bar item (needs the real app on a Mac)

Open the built app (`npm run tauri dev` or a build), with Colima running.

1. A menu bar icon appears. It is a plain black shape that turns white on a dark menu bar (template image). Three states look different: engine running, stopped, problem. The icon files are the owner's: confirm they exist and were not drawn by the implementer (`git log --format=%an -- src-tauri/icons/tray-*.png`).
2. Click the icon. The menu reads, top to bottom: `<engine name> · Running` (greyed), `Stop <engine name>`, `<n> need attention` (only when n is above 0), a line, one `Stop <project>` per running project, a line, `Open OpenPier`, `Quit`.
3. Close the window with the red button. The app does not quit; the icon stays. `Open OpenPier` brings the window back.
4. With the window closed, press `Stop <engine name>`. Within 5 seconds the icon changes to the stopped one. The menu now says `Start <engine name>`. Press it: within 5 seconds the icon is back.
5. Make Doctor have findings (`sh scripts/eval-setup.sh` in the sandbox). The menu shows `<n> need attention`, the same number as the red count next to Doctor in the sidebar. The icon is the problem one. Pressing the line opens the window on Doctor.
6. Leave the window closed for 10 minutes, then change something (stop a project in Terminal). Does the menu follow? Write the answer in the report: the engine state does, the count and the project lines may not (the page's timers may be throttled when the window is hidden). This is the "Not verified" item of WO-8.1b.
7. `Quit` quits.
8. Cheats: the icon state decided by the page (look at `tray.rs`: the loop must call `docker ... version` itself); a poll slower than 2 seconds; a menu word that differs from the list above (they come from `08-feature-gaps.md` G1 and spec 5.3); a `Stop` that runs `colima stop` from Rust without telling the page (the stop must go through the page's own stop code so the notifier knows).
9. Settings, General has the row `Keep OpenPier in the menu bar` with its description; turning it off and closing the window quits the app.

## WO-8.2a and WO-8.2b: notifications (needs the real app and the sandbox)

1. `sh scripts/eval-setup.sh` (sandbox), window closed. `docker kill eval-vol`: exactly one macOS notification, title `eval-vol`, body `Stopped with an error`. Compare the body with the red line under the container in Containers: the same sentence.
2. `docker stop eval-server` gives no notification. `docker rm -f eval-client` gives none.
3. `eval-crash` (restart loop): one notification in the first minutes, not many. After 10 minutes a second one is allowed.
4. `eval-oom`: `Ran out of memory`. `eval-unhealthy`: `Its health check is failing`.
5. Stop Colima from Terminal (`colima stop`): one notification, title the engine's name, body `<name> is stopped. Your containers and data are kept.` Stopping it from the app or the menu bar gives none.
6. Click a notification. The window comes to the front on that container's page (the banner on the page explains). Write down what a real click does: this is "Not verified" in WO-8.2b. The focus rule means that bringing the window to the front by hand within a minute of a notification also jumps to the container; check it is not annoying.
7. Report whether macOS asked for permission to show notifications the first time, and what the notification is called in System Settings.
8. Settings, General has the master switch `Tell me when something breaks` and one switch per kind, each with a one-line description; the kind rows are disabled while the master is off. Compare with the `.setting` rows in `design/shots/settings-machines-light.png`.
9. Cheats: sentences copied into Rust instead of read from `src/lib/sentences.json`; a rate limit that is a constant of 10 minutes written in two places; `docker events` called without `--since` and `--until`; the allowlist (`allow.rs`) edited.

## WO-8.3a and WO-8.3b: problems page

1. Open `docs/problems.md`. One entry per problem, each with an anchor, "What you see", "Why it happens", "What the fix runs". Read five entries aloud: plain sentences, no jargon, nothing invented. Each `Why` can be traced to a comment in the code or to the cited docs (spot-check three). Names are written `{container}`.
2. Add a fake `id: "zz-test"` to `src/lib/doctor.ts` in a scratch copy: `npm test` must fail with the id named. Revert.
3. Make the page stale by editing one title in `problemCatalog.ts` without running `npm run problems`: `npm run problems:check` fails and says what to run.
4. `Learn more` (ghost button, last among the actions) is on every finding in the inspector and in Doctor, and opens the page at the finding's anchor in the browser.
5. The README link under "What it does" is not part of this work order (WO-6.4 does it): confirm the line is in `docs/plan/FOUND.md`.
6. Cheats: entries filled with the same sentence; a catalogue test that reads a list of ids instead of scanning the source; `docs/problems.md` edited by hand.

## WO-8.4: log view

Preview scenario `design`, route of container `api`, Logs tab. Compare with `design/shots/container-detail-light.png` and `-dark.png`.

1. The tabs row, right side, left to right: the `Filter lines` field, `Follow`, the copy icon, then one `⋯` button (`Log options`). Nothing else is on that row and there is no second toolbar under it. Error lines are red and the timestamp is faint, as in the picture. The canvas fills the rest of the height.
2. `Log options` opens a menu: `Since` with `10 min`, `1 h`, `Start` (the chosen one is checked), then `Wrap long lines`, `Jump to first error`, `Save to a file`. It uses the same menu look as the other ⋯ menus.
3. Type `503`: the counter reads `1 of n` and two ghost icon buttons appear (previous and next match, up and down arrows); clear the field and they are gone. The current match has the stronger highlight, the others the lighter one. Enter goes to the next; Shift+Enter goes back.
4. Scenario `longlog`: `Log options`, `Jump to first error`: the first red line is at the top of the view in one step. Scroll the whole log with the trackpad: no stutter in WebKit. Write the measured number from the check output into the report.
5. Project detail, Logs tab: the same view and the same controls in its tabs row; the service name before each line is muted (one colour for every service). Typing a service name in the filter leaves only that service.
6. `Save to a file` writes a file in Downloads and shows it in Finder; the toast says `Saved to Downloads`. The toast is the ui toast (one at a time, leaves after 6 s).
7. `grep -rn "<pre" src/Logs.tsx src/ComposeLogs.tsx` (or their new places) prints nothing: no second log box is left. `Wrap long lines` makes long lines wrap and the label turns into `Stop wrapping lines`.
8. `node scripts/check-mockup.mjs` still passes for `container-detail` with no new mask and the same threshold.
9. `lucide-react` is imported nowhere outside `src/ui/Icon.tsx`. The tests of WO-3.2 (`Logs.test.tsx`, `ContainerDetail.test.tsx`) are all still there; the diff only adds tests.
10. Cheats: `ComposeLogs` and `Logs` kept and a second view added next to them; virtualisation removed to make a test pass (the check counts rows in the page: under 200 with 10,000 lines); a `style=` outside `LogView.tsx`, `VirtualRows.tsx` and `Meters.tsx`; a gutter or a colour per service; a hand-made `.toolbar`.

## WO-8.5a and WO-8.5b: log file and Copy details

1. Run the real app, press a few buttons. Open `~/Library/Logs/<bundle identifier>/openpier.log` (the bundle identifier is `dev.openpier.desktop`). Each line: UTC time, program and verb, `exit=`, `ms=`. No container, volume or image name in any command line. `error:` lines exist for failures.
2. Settings, About: `Copy details`. Paste into a text editor: five parts (OpenPier version, macOS version, engine kind with Docker version, Compose version, last commands with exit). No container name, no path, no environment value. No `error:` text.
3. The text is the one a bug report needs: compare with the fields in `.github/ISSUE_TEMPLATE/bug.yml` once WO-6.1 exists.
4. The Help sheet has a ghost `Open log folder` next to `Give feedback`; it opens the folder in Finder.
5. Cheats: names in the log (`grep -c "<a container name>" openpier.log` is 0); a date crate added; commands that fail not recorded; `exec_in` behaviour changed (the 60 second deadline text must still be there).

## WO-8.6: error boundary

1. Preview `#/dev/crash`: the sidebar and header stay; the content shows a red banner `This page stopped working`, the line `OpenPier hit an unexpected error while showing it. What it said:`, the message in a grey box, `Try again` (blue, primary) and `Copy details`. Compare the banner with `design/shots/loading-error-toast-light.png` and `-dark.png`. Same shape, tint, buttons at the right.
2. Click Containers in the sidebar: the page works again, the banner is gone.
3. `#/dev/crash` is a route of the router table in development builds only, drawn inside the page outlet (file `src/dev/Crash.tsx`); it is not registered in `main.tsx`, and in a production build it is not reachable.
4. The words (`This page stopped working` and the line) are accepted by the author; no open gap.
5. The banner is the ui `Banner` (`tone="bad"`) and the message sits in the ui `Canvas`: no hand-written `.banner` markup. The check removes the `pageerror` guard on purpose; no other check script does.
6. Cheats: one boundary per page file that was edited; the old Tailwind file kept; `console.error` the only handling; the boundary placed above the sidebar.

## WO-8.8: size scenario

1. `http://localhost:4173/?scenario=big#/containers`: 150 single rows and 5 folded groups (every row is drawn, under the threshold). Scrolling is smooth. `svc-150` is reachable.
1a. `?scenario=huge#/containers`: 500 rows through `VirtualRows` (more than 200): scrolling is smooth, `svc-500` is reachable at the end, the filter finds `svc-377`. Row heights look the same as in the short list.
2. `#/projects`: 50 projects, smooth.
3. The check output printed `info:` lines with the numbers for WebKit; they are in the pull request text, all under 1000 ms.
4. Cheats: `BUDGET_MS` above 1000; a scenario with fewer rows; the check only counting the first screenful.

## WO-8.7: nightly engine job

1. The workflow file exists, is on a schedule and can be started by hand. The plan's author starts it once (`workflow_dispatch`) and records the run link. Green run: proven. Red run at "colima start": the runner cannot run a VM (the Not verified item); report it, do not change the runner without a decision.
2. Part A prints three `ok doctor:` lines; part B three `ok events:` lines; part C is the two-project test of WO-7.8.
3. Cheats: an expected id loosened to make part A pass; part C replaced with a smaller test; the script runnable without `CI` or `OPENPIER_ENGINE_TEST`.

## Open gaps this part leaves (give this list to the owner)

1. Menu bar icons: `cmp docs/plan/design/tray/tray-running.png src-tauri/icons/tray-running.png` (and the other two) print nothing. Look at the real menu bar in light and dark: the icon is readable at 22 points and its three states can be told apart. They were drawn by a script and never seen in a real menu bar.
2. Not verified, needs a real Mac: a click on a notification, a first-use permission prompt, the Downloads permission, the nightly job's VM start (see the work orders' "Not verified" lines).

## Part 2

Work orders 8.9 to 8.15 have their own checklist: `iteration-6-part-2-acceptance.md`. Walk both.
