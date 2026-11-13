# Iteration 5 acceptance: Projects

Walk this after `sh docs/plan/iterations/verify-iteration-5.sh` prints no `FAIL`. The script proves what a command can prove. This file is what only eyes (and the owner's machine) can tell. Anything that passes the script and fails here is not done.

Open the preview with `npm run preview` (http://localhost:4173). Pictures are in `docs/plan/design/shots/`. Compare in WebKit, 1280x800, light and dark.

## First, the cheats to look for in the whole iteration

1. `git diff main~N --stat -- scripts/not-migrated.json`: the list must not have grown (it only shrinks; this iteration adds new files only).
2. `scripts/mockup-pairs.json`: every `project*` row has `threshold` 0.005 or lower, or a `why` that says what is masked and why. A mask that covers a whole row, a button or a column is a cheat.
3. A weakened test: `git diff` of `src/ComposeProjects.test.tsx` and the old checks (`check-compose.mjs`, `check-palette.mjs`, `check-shortcuts.mjs`, `check-doctor.mjs`) must only add lines, or change a condition for the new behaviour with the message kept. No `.skip`, no `it.todo`, no condition turned into `true`.
4. `grep -rn "TODO\|FIXME\|PROPOSED\|design gap" src/Projects.tsx src/ProjectDetail.tsx src/projects src/lib/project*.ts src-tauri/src/projects.rs src-tauri/src/override_yaml.rs src-tauri/src/ports.rs` prints nothing.
5. Colours, sizes and fonts: `grep -rn "#[0-9a-fA-F]\{3,6\}\|[0-9]px" src/Projects.tsx src/ProjectDetail.tsx src/projects` prints nothing. No inline `style`.
6. Words: every sentence on screen is in the work orders or the mockup. Any other sentence is listed under "Words added here" in the pull request file of the work order.
7. Dependencies: `git diff -- package.json src-tauri/Cargo.toml` adds only `sha2`.
8. Nothing was pushed or tagged; there is one `wo-<id>` branch per work order, each merged with `--no-ff`; each has `docs/plan/iterations/pr/wo-<id>.md` whose first line is the title the work order gives.
9. The implementer did not run the sandbox: every pull request file for 7.2 and 7.8 says "not run, owner runs it".
10. The user's Compose files are never edited by the code: `grep -rn "writeFile\|fs::write" src-tauri/src/compose.rs src-tauri/src/override_yaml.rs src-tauri/src/projects.rs` shows writes only to `projects.json` and `override.yaml` (through `write_atomic`).

## WO-7.1 and WO-7.2 (no screen)

1. Read `src-tauri/src/projects.rs`: the name rule is one function with the four rules in the order of spec section 4; its tests have the 14 rows N1 to N14 of the work order. Look for a test that was written to match the code and not the table (for example a vector that is not `app-2402` for `/Users/me/b/app`).
2. `PortOrRange` serializes a range as an array. `Project` has the two added fields (`renamed`, `separate`): they are the plan addition reported to you.
3. Read `src/lib/composeVersion.ts`: the number in `MIN_COMPOSE` has a URL above it that names both `!override` and `!reset`. Open the URL yourself. If the comment says "from memory" or has no URL, the step was skipped.
4. Doctor (`#/doctor`, scenario `&composeold=1`): a finding `Compose is too old for Projects` with the version of the engine and the minimum. Without the flag, none.
5. Read `override_yaml()` output in its tests against spec section 5: the example text is exact (`container_name: !reset null`, `ports: !override`), the whole port list is written for a changed service, an empty override is `services: {}`.
6. **Owner's sandbox step 1.** With Colima running and `sh scripts/eval-setup.sh` done: `sh scripts/eval-projects.sh merge`. Expect `sandbox_override_merge ... ok` and `docker ps -a` shows nothing of `app` afterwards. This closes the "merge has not been run" item of spec section 5.

## WO-7.3 (no screen)

1. `compose_action` still works for the old Compose sheet (`file`): start a folder from the sheet in the preview: it runs.
2. Two projects can start at once: in `compose.rs` the lock is a set of names, not one flag. A second action on the same project is refused with `{name} is still starting or stopping. Wait for it, or cancel it.`
3. `-v` is written in one place only. Delete data is the only caller that passes `volumes: true`.
4. `ports_in_use` drops a Mac listener on a port a container publishes (the engine's own forwarder). Read its test.

## WO-7.4a and WO-7.4b: the Start check

1. Open `/?scenario=design&projects=2#/projects`. Click `Start` on `billing`. The sheet must look like `project-start-check-light.png` (and dark): title `Start billing`; the lede; three neutral lines with a green check (port 8080 to 8081, port 5432 to 5433, name `db` to `billing-db-1`) each with `Use another…` on the two ports; one amber line about the volume `pgdata` with `Share it` and the filled `Keep separate`; the `Show command` chip; `Cancel` and a `Start` that is disabled.
2. Click `Keep separate`: `Start` enables. Click `Show command`: one command line with `-p billing`, the project folder, `-f .../compose.yaml`, `-f .../override.yaml`, and `up -d`. Copy works.
3. `Use another…`: type 80, then 8090. 80 is refused in words; 8090 changes the sentence.
4. Press `Start`: the sheet closes, the row shows `Starting…`, then `3 of 3 running`.
5. In `/?scenario=design&projects=1#/projects` start `search`: no sheet at all (nothing to ask).
6. Cheats: a finding sentence that is not in the work order; `Start anyway` showing when there is no memory finding; the sheet opening for a host or image warning alone (the work order says it must not); `Start` enabled while a volume question is open.

## WO-7.5a and WO-7.5b: the list

1. `/?scenario=design&projects=1#/projects` against `projects-light.png` and `projects-dark.png`:
   1. Header: `Projects`, `3 · 2 running` (the count includes the found project only if the mockup does; it does not), search field, filled `Add project`.
   2. Column order: dot, Project, Folder (muted, with `~`), Services blocks, CPU 10 min, Ports (links like `:8081`), State, one action, ⋯.
   3. `shop` has a tinted red problem line right under it: `api: its health check is failing` with `See why`.
   4. Action buttons are plain, not filled. Only `Add project` is filled.
   5. The caption `Found on this engine` and the row `kafka-local` with `Add` and no ⋯.
   6. Sidebar: `Projects` first, with a count; `Cmd+1` goes there.
2. `/?scenario=design&projects=0#/projects` against `projects-empty-light.png` and dark: folder icon, `No projects yet`, the sentence, one filled `Add project`, then `Found on this Mac` with `shop` and `billing`, each with `Add`, no state text.
3. Click through: ⋯ menu has the nine items in order, hints under `Rebuild and start`, `Pull newer images`, `Stop and remove containers`; `Delete data…` is red. `Stop and remove containers` asks first and says volumes stay. `Delete data…` lists the volumes. `Remove from OpenPier` asks first.
4. `Add project`: with the mock picker set, the sheet shows the folder, the ticked Compose file, the name, and `Compose name` only when it differs. `Add` and `Add and start`.
5. Try `/?scenario=stopped&projects=1#/projects`, `slow=1500`, a search with no match, `unreach`, `&projects=broken`: each has the words of the table in WO-7.5a.
6. Cheats: a second ports cell written by hand instead of the Containers one; a sparkline drawn with fake numbers; counts in the header that do not follow the rows; the Compose sheet removed instead of kept (it must still open from `New`).

## WO-7.6a and WO-7.6b: the detail

1. `/?scenario=design&projects=1#/projects/22222222-billing/ports` against `project-detail-light.png` and dark: back arrow, `billing`, green dot, `3 of 3 running`, `Restart`, `Stop`, ⋯; facts line; info banner `Ports were moved so this project can run next to shop` with `Show what changed`; tab chips with Ports selected; table `Service`, `In the container`, `On this Mac`; rows `web 80 :8081 Wanted 8080, used by shop · web`, `db 5432 :5433 Wanted 5432, used by shop · db`, `mail 8025 :8025`; `Change…` on each.
2. Services tab: rows like Containers rows; a service never started says `Not started`.
3. Logs tab: lines carry the service name in muted text (no colour per service), `Follow`, `Since`, the service chips; no mockup picture exists, so compare the look with the container logs tab (`container-detail-light.png`).
4. Settings tab: name, folder, files with up and down, env file, profiles, `Show what OpenPier changed` (read only), `Reset changes`, `Remove from OpenPier`. Compare form rows with `settings-machines-light.png`.
5. Cheats: a placeholder panel left in a tab; the Ports note written from a stored string instead of the live holder; `Change…` writing without checking the port; the override text editable.

## WO-7.7: links

1. Containers: the group name of `shop` is a link; its group menu starts with `Open project`.
2. `New` > `Start a Compose project`: the sheet is still there; `shop`'s row says `Open project`; an unsaved folder keeps `Start` and offers `Add as a project`.
3. Palette (`Cmd+K`): type `bill`, `start sea`, `stop bill`. `Add project` is in Actions.
4. Doctor: in `&projects=1&portclash=1` the clash of a project container is not a finding.
5. Cheats: palette items for projects when the query is empty; the Compose sheet's old tests edited to pass.

## WO-7.8: the two-project test, run by the owner

The implementer only wrote it. You run it. Colima must be running, `sh scripts/eval-setup.sh` done, ports 5432, 5433, 8080, 8081 free on the Mac.

1. `sh scripts/eval-projects.sh --dry` prints `ok dry run`.
2. `sh scripts/eval-projects.sh two`. Expect `sandbox_two_projects ... ok` and `ok fixtures unchanged`. It covers spec section 10 steps 1 to 7: a runs on 5432 and 8080 with the name `db`; b gets `app-xxxx`, `app-xxxx-db-1`, 5433 and 8081; four containers; both web ports answer; the Compose files unchanged; stop a, b stays; start a again, same ports; start both at once, same ports; Delete data on b keeps a's volume.
3. Afterwards `docker ps -a` shows no container of project `app` or `app-xxxx`, and `docker volume ls` none of theirs. If something is left, the script's cleanup is wrong: report it.
4. Cheats: a test that asserts less than the spec (for example no HTTP check, no volume check); a hard-coded name instead of the hash; the port plan different from the TypeScript fixture test.

### WO-7.8, by hand (spec section 10, steps 1 to 8, in the app)

Run the real app (`npm run tauri dev`) on Colima. Use copies of the fixtures in two folders under your home, both ending in `app`.

1. Add the first folder, press Start: no dialog, ports 5432 and 8080.
2. Add the second folder: the Add sheet shows the name `app-xxxx`. Start: the Start check shows three findings (db renamed, 5432 to 5433, 8080 to 8081). Press Start.
3. `docker ps` shows four containers; `curl localhost:8080` and `curl localhost:8081` answer; the Compose files did not change.
4. Stop the first: the second keeps running. Start the first again: no dialog, same ports.
5. Stop both, start the second and then the first at once: both start, no dialog, same ports.
6. `Delete data…` on the second removes its volume only.
7. **Step 8, on a second engine** (Docker Desktop, OrbStack or another Colima profile): switch the engine in the switcher. Both projects show `Not started` there. Start both: the same result. Record which engine you used in the report. If you have no second engine, say so: this step is then not done, and the iteration is not finished.

## Open points to decide before you accept

These are in the final report of the drafter. None blocks a work order; each is a decision you may reverse.

1. The `renamed` and `separate` fields added to `Project` (needed for steps 5 and 6 of the spec's test).
2. `compose_action` takes a project id and the backend reads the record (spec section 9 lists the fields instead).
3. Host-network and same-image warnings do not open the sheet alone.
4. Memory is estimated from declared limits only.
5. The Compose sheet of WO-3.3c is kept; Projects reuses it.
