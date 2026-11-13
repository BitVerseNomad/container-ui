# Iteration 4: acceptance checklist

Walk this after `sh docs/plan/iterations/verify-iteration-4.sh` prints `failed: 0`. A pass of the script and a fail here means the iteration is not done.

Setup: run `npm run preview`, open `http://localhost:4173/?scenario=design#/<route>` in WebKit at 1280x800, and put the matching picture from `docs/plan/design/shots/` beside it. Do light and dark. Scenarios used below: `?scenario=colima-and-desktop`, `?scenario=desktop-only`, `?scenario=orbstack-only`, `?scenario=desktop-stopped`.

## Checks that apply to every work order

1. `scripts/not-migrated.json` did not grow. `git diff main -- scripts/not-migrated.json` shows only deleted lines. After WO-5.1a the file is `[]`.
2. `scripts/dropped-checks.json` and `scripts/mockup-pairs.json` have no new entry. Any new row has a reason that is a changed word or a removed feature, never "flaky" or "slow".
3. No test was deleted or weakened to make the code pass. `git diff main --stat -- 'src/**/*.test.*' 'scripts/*.test.*'` shows no file with more lines removed than added, except the tests that WO-4.3c and WO-5.1a name for deletion (`hooks`, `pollPace`, `latest`). For each changed test, read the diff: no assertion became `true`, no `expect` was removed, no exact text became a loose match.
4. Test counts only grew. `cargo test` passes at least 162 tests, and the node and vitest counts are not lower than the end of iteration 3.
5. `git diff main -- src/ui/openpier.css` is empty. No colour, size, shadow or icon that is not in that file. No inline `style` outside `Meters.tsx`, `LogView.tsx`, `VirtualRows.tsx`.
6. No `TODO`, `FIXME`, commented-out code, or `skip` in tests. `git diff main | grep -nE '^\+.*(TODO|FIXME|\.skip|it\.todo|xit\()'` prints nothing.
7. No ignore entry was added to `knip.json` to make it pass (`git diff main -- knip.json` shows only the first version of the file, and `ignore` lists nothing under `src/`).
8. Every new test name reads Given, When, Then. Tests were committed before the code (the commit order shows the failing tests first).
9. The PR text file `docs/plan/iterations/pr/wo-<id>.md` exists for every work order, has all six headings, and "Not done or changed" is honest.
10. The branch history has one merge commit per work order (`git log --merges --oneline main`), named `wo-4.1` to `wo-5.3`.
11. Words: sentence case, no full stop on labels or buttons, buttons are verbs, and no `Profile`, `Runtime`, `Context`, `Inspect`, `Down` in anything the user reads. Use `Engine` and `Machine` as the design does.

## WO-4.1 Engine and Machine in the backend

There is nothing to look at in the app yet. Check the code.

1. Open `src-tauri/src/engine.rs`. The classification table in the code has the six rows in the order of the work order (`/.colima/`, `/.orbstack/`, `/.rd/`, endpoint with `podman`, `desktop-linux` or `/.docker/run/docker.sock`, everything else). A reordered table is a bug: a Colima context under a Podman path must still read as Colima.
2. `context_ok` accepts only a name that `list_engines` returned last. Try to find a path where a name the user typed reaches `docker` without that check.
3. The probe has a 3 second deadline and runs for all engines at once (look for `join_all` or one thread per engine), never one after the other.
4. The Colima gate still exists under `colima_context_ok`. `kubectl`, `k9s` and the Docker Desktop bring-over use it. The old name `context_ok` is not left in `desktop.rs`.
5. `cargo test engine::` prints 26 passed. Read five of the tests: each calls the real function with a real sample, none asserts `true`.

Cheats: `list_engines` that returns a fixed list; a probe with no deadline; the 26 tests copied from the work order but their asserts shortened.

## WO-4.2a The engine switcher lists every Docker

Open `?scenario=colima-and-desktop#/containers`. Compare with `engine-switcher-light.png`, `engine-switcher-dark.png`.

1. Click the engine name in the sidebar. A menu opens with a caption for each kind of tool (`Colima`, `Docker Desktop`) and one row per engine under it.
2. Each row has a coloured dot (green running, grey stopped), the name, and a state line (`Running`, `Not running`). The chosen engine has a check mark.
3. A stopped Colima machine row has `Start` as its action. A stopped Docker Desktop row has no action, and its tooltip reads `Not running. Start it from Docker Desktop.`.
4. Pick Docker Desktop. The page header and the lists change to that engine's containers. Reload the page: the same engine is still chosen.
5. Open `?scenario=desktop-only`. The switcher still opens and lists Docker Desktop. There is no Colima row and no `Create` row.
6. Open `?scenario=orbstack-only`. The caption is `OrbStack` and the name matches the mock.
7. Keyboard: Tab to the switcher, Enter opens, arrow keys move, Enter picks, Escape closes and focus returns to the button.
8. Run `node scripts/check-engines.mjs` once with `PW_ENGINE=chromium` and once with `PW_ENGINE=webkit`. Both print only `ok` lines.

Cheats: the menu drawn with inline styles; the engine list hard-coded in `App.tsx`; the saved choice read from a global variable instead of `openpier:engine`; a `ColimaEngine` kept "for now" next to the new `Engine`.

## WO-4.2b Every screen works with any engine

Open `?scenario=desktop-only` and walk every route.

1. `#/containers`, `#/images`, `#/volumes`, `#/networks`, `#/compose`: each loads and shows its list. None shows an error or a Colima word.
2. `#/settings`: the Machines section is hidden, or it says no Colima machine exists. A section named `Engines` lists every engine with its kind caption and state. With no engine at all it reads `No engines found` and shows `docker context create` in the mono font.
3. `#/doctor`: only the eight checks that apply to every engine run. The seven Colima-only checks (memory of the VM, mounts, DNS in the VM, proxy) are not listed, and none shows as "passed" without having run. Open `?scenario=colima-and-desktop` and pick Colima: all fifteen show.
4. Open `?scenario=desktop-stopped`. Compare with `machine-stopped-light.png`, `machine-stopped-dark.png`: the same layout, with the title `Docker Desktop is stopped`, the text `Start it from Docker Desktop.` and a blue button `Open Docker Desktop`. Click it. In the console, `__calls` lists `open_docker_desktop` once. No text says "Your containers and data are kept" here (that is the Colima wording).
5. In the same scenario pick OrbStack from the switcher (use `?scenario=orbstack-only` with `stopped`): the text is `Start it from OrbStack.` and there is no button.
6. Open `?scenario=stopped` (a stopped Colima machine): the old wording `Your containers and data are kept. Start the machine to see them.` and a blue `Start` button. This path did not change.
7. `src/runtime/` is gone. `grep -rn "orb_\|rdctl" src src-tauri/src` finds nothing.

Cheats: the Doctor list filtered by a hard-coded name instead of `appliesTo`; the stopped screen with the Docker Desktop wording copied for every engine; the Settings Engines list read from the mock directly; `NOT_IN_PREVIEW` removed but the commands it listed also removed from the mock.

## WO-4.3a, 4.3b, 4.3c One data layer

1. Open `#/containers` and watch the network list in the browser tools (or `__calls` in the mock). While the window is focused the list is read every 3 seconds. Switch to another app for 10 seconds: the reads stop. Come back: one read happens at once.
2. Press Cmd+R: every visible list is read again at once, and the loading state is not shown (the old rows stay until the new ones arrive).
3. Start a container from the app. The list changes within one read, and the toast shows. Stop it again. No spinner covers the page.
4. Kill the Docker connection (`?scenario=stopped` then `__mock.unreach(true)`): the red banner with `Try again` appears, the rows stay, and the banner goes away when the next read works.
5. Switch engine in the switcher. The lists change to the new engine and nothing from the old engine stays visible (no row from engine A under engine B).
6. Open `#/doctor`. Change the VM memory in Settings, then return to Doctor. The memory check does not report the old number: it holds until a read that started after the change.
7. `grep -rn usePoll src` prints nothing. `src/hooks.ts`, `src/lib/pollPace.ts`, `src/lib/latest.ts` are gone.
8. Open `src/lib/queries.ts` and the table in WO-4.3a. Pick five call sites at random in `src/`. Each uses `useQuery` with the key in the table and the interval of the table (not a blanket 3000).
9. No `setInterval` in `src/App.tsx`.

Cheats: a `usePoll` wrapper renamed and kept; `refetchInterval: 3000` copied to every call; `staleTime: Infinity` to hide a refresh bug; the focus pause left out of `queryClient.ts`; mutations that do not call `invalidateQueries` (the list only updates on the next timer).

## WO-5.1a and WO-5.1b The old UI is deleted

1. `ls src/ui` shows the moved files at the top level (`Button.tsx`, `Row.tsx`, `Menu.tsx`, `index.ts`, `openpier.css` and the rest) and no `op` folder. `src/ui.tsx` and `src/ui/icons.tsx` do not exist.
2. `npx knip` prints nothing. Open `knip.json`: it has `entry` and `project` only, with no `ignore` lists that name a source file.
3. `package.json` has no `tailwind-merge`, `class-variance-authority` or `clsx` (unless a file still imports it, in which case the work order says why).
4. `grep -rn "ui/op" src scripts` prints nothing. `grep -rn "from \"./ui\"" src | head` shows the new import path.
5. Open three screens at random (for example `#/containers`, `#/settings`, `#/doctor`) beside their pictures. They look exactly like before the move. A move must not change a pixel.
6. `npm run check` still runs every browser check in both engines and ends with `all checks passed`.
7. The `Tab` type and `src/lib/tabRoutes.ts` are gone. Deep links work: `#/volumes` opens Volumes and a reload keeps it.

Cheats: files left in `src/ui/op` as re-exports; `knip` made quiet by `ignoreExportsUsedInFile` or `ignore`; a component kept alive by one test that imports it; the codemod `scripts/ui-up.mjs` left in the repo.

## WO-5.2 main.rs is split

1. `wc -l src-tauri/src/main.rs` is under 200 (the work order expects about 70). It holds `mod` lines, `use` lines, `main` and the handler list.
2. The files `allow.rs`, `colima.rs`, `compose.rs`, `desktop.rs`, `engine.rs`, `exec.rs`, `kube.rs`, `setup.rs`, `system.rs`, `tools.rs` exist, each with a one-line comment on top that says what it holds.
3. Open the table in WO-5.2 and check five functions at random: each is in the file the table names.
4. `cargo test` prints the same count as before the split plus nothing lost. Run `cargo test -- --list | sort > /tmp/after.txt` and compare with the PR text: the test names are the same, only the module path changed.
5. `git diff main --stat` shows the moves as additions in new files and removals in `main.rs`. No function body changed (the diff of any one function, with the path ignored, is empty).
6. `scripts/split-main-rs.mjs` and its homes file are gone.

Cheats: a test that disappeared in the move (count equal only because a new one was added); `#[allow(dead_code)]` or `#[allow(unused)]` added to silence the compiler; `pub` added to everything; the handler list unchanged but pointing at `main`-level re-exports.

## WO-5.3 The docs match the app

1. Open `AGENTS.md`. It has a section that says where the design is (`docs/plan/design/`), names the mockup pictures, and keeps the eight UX rules. Every file name it mentions exists.
2. Open `CHANGELOG.md`. Under `## Unreleased` there are at least seven numbered lines. Each one is true today: pick three and verify in the app (for example the engine switcher, the Docker Desktop stopped screen, one converted list).
3. Run `npm run check:docs`. It prints `ok` lines and no `FAIL`. Rename one mentioned file for a minute and run it again: it fails and names the doc and the file. Put it back.
4. `.github/workflows/ci.yml` has a step that runs `npm run check:docs`.
5. The checker looks only at the current docs. The long list of old notes is marked as history in `scripts/doc-links.json`, with a one-line reason. No old note was edited.

Cheats: the checker with an `ignore` for every file that fails; `CHANGELOG` lines that describe a plan, not the app; `AGENTS.md` that links the design folder but lost a UX rule.

## Last look

1. Open the app on a real machine with Docker Desktop (or OrbStack) installed and Colima stopped: the switcher lists both, the lists load, Doctor shows the eight checks, and the stopped screen for the stopped one is correct. This is the one check the mock cannot do, and the script cannot either.
2. `git status` is clean and `git log --merges --oneline main` shows ten merges of this iteration.
