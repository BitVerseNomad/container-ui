# Changelog

Newest first. Older entries record what was true when they were written; later entries supersede them (the Overview, for example, was replaced by the Containers home screen).

## Loop 5, round 43: copy-out commands never lose data

1. **Doctor amd64 row** shows only the `pull --platform` line under "Or run it yourself". The text says to recreate the container the way you first created it (its Compose file or your own run command). No `rm -f` and no bare `docker run` in any Doctor block (the replace fixes keep their rename-first form).
2. **Port warning** drops "Pick another host port." (the button is the pick) and sets the container name in the code font.
3. **Port clash on Run** shows the plain-words message, checked in both engines.

## Loop 5, round 42: the status never disappears, ink warnings, one click past a port clash

1. **Compose row**: the path is cut with an ellipsis, never the status. The full path is in the title.
2. **Doctor "Or run it yourself"** is a light code block, the same as the Run drawer's.
3. **Warnings are ink text**, with the colour on the icon only: Run drawer "Before you run", and the Kubernetes "needs attention" level and the "starting" badge.
4. **Compose menu hints** say when: Restart, Update images and start, Remove containers.
5. **Port clash** in the Run drawer has a "Use 8081 instead" button (the next free host port). If Run is pressed anyway, the error is the plain-words one, not raw docker output.
6. **Doctor amd64 row** still has no main button. The text says what it means (slower, emulated) and the pull, remove and run commands are under "Or run it yourself".

## Loop 5, round 41: plain buttons, one-line problems, long names get the room

1. **Compose card main button** is a white push button, not filled green. The status dot already says running or stopped.
2. **Problem summary** is one ink line, "3 need attention", with the colour on the icon only. Per-service detail stays on home.
3. **Long names** get the room: the status moved to the folder line ("~/Dev/global-search-service · Not running"). The full name is in the title and the accessible name.
4. **Menu hints** say when you would use each item (Stop, Show logs, Run it yourself, Show in Finder). Row-menu hints that were raw commands are plain words now.
5. **Remove containers** asks first, and never removes volumes.
6. **Run drawer**: "The image sets N defaults itself" and the docker run command use the app's chevron disclosure ("Show command"), with a light code block.
7. **Doctor amd64 row** has no main button. The app cannot pull and run the matching build (the allowlist has no `--platform`, and a pull does not change a running container), so the command is under "Or run it yourself".

## Loop 5, round 40: one main action, a menu for the rest, links only go places

1. **Compose card** is one compact row: dot, name, count, Start (or Stop), and a "More actions for <name>" menu. The menu has Stop (partly running), Restart, Rebuild and start, Update images and start, Show logs, Run it yourself, Show in Finder and Remove containers (was Down; compose down never gets `-v`, so volumes stay). Each item has a one-line hint. The menu opens across the card so hints fit.
2. **Links to buttons**: Don't ask again, Run again, the fix Dismiss, Show it again and Show the docker run command are push buttons now. The links left (All commands, Change in Profiles, Go to the fix, Docker Hub, docs, port links, Find it on Docker Hub, Show N projects, a pod's name) all go to a place.
3. **Menu**: Escape closes only the menu, not the panel around it. "Not an issue" has a plain hint.
4. **Drawer toolbar**: the search takes its own line, so Scan again and Add a folder never wrap.
5. **First launch without Homebrew**: Open Terminal and install runs Homebrew's installer in Terminal (`open_homebrew_install`); Copy command stays as the second option.

## Loop 5, round 39: Start VM never changes meaning, the way back is checked before it runs

1. **Two buttons on the stopped card.** While the profile still has the failed folder list saved, the card offers a plain **Start VM** (starts what is saved) and the filled **Start with the folders you had** on the right edge, with one line: "The last change didn't start. `~/code/web` is still saved in the profile, so Start VM tries it again." With nothing to go back to, the card is just Start VM. This replaces round 38 item 6, where the plain Start VM ran the way back by itself.
2. **Checked before it runs.** `colima_config` is read again before the way back runs, from either card (`wayBackApplies`, `stillFailed` in `lib/vmChange.ts`). It goes back only while the saved mounts still equal the failed list (order, `~` and a missing list as the home folder are read the same way). If the file was fixed by hand or changed in Profiles, the way back is dropped without a word and the plain card shows.
3. **Survives a relaunch.** The way back is kept in `localStorage` (`colima-ui.wayBack`: profile, failed change with its before list), every access in try/catch, and is checked the same way when the app opens. It is cleared when any change or start works.
4. **Tests**: the unplugged-disk case (the saved list differs, the way back is dropped and nothing runs), the hand-edited file case, the relaunch case (a fresh module reads it from storage), junk in storage, and `stillFailed` / `wayBackNote` unit cases. `check-mounts.mjs` group 4b and 4c cover the card, the focus and the plain start.
5. **Focus after Dismiss** on the home failed card goes to the stopped card's filled button (the way back if offered, else Start VM), not the page title. `dismiss` prefers an explicit `after` over `afterDismiss`.
6. **Proxy line** prints the full path in code font: `~/.colima/<profile>/colima.yaml`, from the home folder `colima_config` already reports.
7. **Doctor**: the gap under the success row is the same as between groups. The status line kept for it left the column when it has nothing to show (it stays in the page for a reader), and the row's own bottom margin is gone, since the page already spaces its blocks.
8. **Two fixes found by the full run.** A size change from Settings or Doctor (no folder change) never showed its result: `startAgain` finished only when a change was set. It finishes every time again. And Profiles' "New profile" form could open on `default` while the list of profiles was still arriving, then show "already exists": the free name now follows the list until the user types their own.
9. Not verified on a real Mac: as in round 37.

## Loop 5, round 38: a done result matches its rows, a failed card that reads left to right

1. **Home's result waits for a fresh list.** A VM change's result now shows only after the container list (and the Doctor's facts) were read again once everything ran (`addChangeRefresh` in `Resize.tsx`; the Doctor and the container list each add their read). The settle step that kept rows on "Restarting…" no longer runs for a change, so no row says Restarting… or spins next to a done result. check-mounts asserts it.
2. **Show the log is a push button** (`button.small`), not a link.
3. **Failed card order**, right-aligned under the text: Dismiss, Show the log, Try again, then the one filled button, Start with the folders you had, on the right edge. Same in the Doctor.
4. **The way back keeps its card.** `card` in the resize state keeps the failure card mounted through the way back and shows the good result in it, once, with focus there; the row's own status steps aside. Keyboard-only check with `&unshared=1&vmfail=1`: the page does not say it a second time.
5. **The same log error is read again**: the message is cleared, then written after 50 ms. Vitest watches the region.
6. **Option picked: Start runs the way back.** After Dismiss, the stopped card's Start VM runs the folders the profile had (`startWayBack`, forced stop then start) while the saved list is the one that failed, and says "The VM started with the folders it had." It is dropped once a start works. (The other option, keeping the failure line with no Dismiss, was not chosen.)
7. **Proxy line**: ends "Add these lines to the profile's `colima.yaml`, then restart the VM:" with the two lines in a short block (`env:`, `HTTPS_PROXY`, `HTTP_PROXY`, the Mac's proxy), then "If `colima.yaml` already has an `env:` section, add the two lines inside it." The old sentence is gone. The screenshot is of the whole row.
8. **Parser**: a mount location starting with `$` makes the list unknown (null).
9. Not verified on a real Mac: as in round 37.

## Loop 5, round 37: the failed-folder card, fresh facts after a change, safer reading

1. **Failed folder change on home**: the stopped card's Start VM is hidden while the failure shows (it would start the same saved list that failed). The one filled button is **Start with the folders you had**; Try again is plain; **Show the log** is a quiet link last. The words sit on top at full width (two lines), the buttons in one row under them at the right.
2. **The way back stops by force first**: `apply_mounts` and `apply_env` take `force`; the app sends it for the way back, and the backend runs `colima stop --force <profile>` then the same start (like `force_restart_profile`), so a half-up Lima instance can't swallow it. Cargo test `forced`.
3. **No stale finding after success**: a change that worked has the Doctor read `colima_config` and the facts again before its result shows (`setChangeRefresh` in `Resize.tsx`), and the hold on the report lets go for that fresh read. The "doesn't share" finding and the home "sees an empty" line are gone the moment the success row shows. Tests: vitest (hook runs before the result) and check-mounts.
4. **Parser**: a list at the key's own indent (`mounts:\n- location: /a`) is read; `writable:` is read in any case (True, TRUE); any other value makes the list unknown (null). Tests for both.
5. **Read-only check** reads container logs with stderr merged, so EROFS lines on stderr are seen. Home line: "Can't write to `~/code/docs` (shared read-only)" (after the container's name inside a project), button unchanged.
6. **Speech and names**: a good result is spoken by the page's announcer when focus moved during the restart (it stays quiet only when a status line took focus to it); the log-error region stays mounted and says "Couldn't open the VM log in Finder."; a busy button's name says "Starting…: <row>"; the way-back button stays on screen while it runs.
7. **Copy**: code font and `overflow-wrap: anywhere` for inline code in findings and results; the proxy line drops "yet" and ends on a step: add `HTTPS_PROXY` under `env:` in `colima.yaml`, then restart the VM.
8. Not verified on a real Mac: `colima stop --force` then `colima start --mount` after a failed start, and `docker logs` stderr for a read-only error.

## Loop 5, round 36: round 35's folder and network checks, made safe and quiet

Round 35 scored 8 to 9.4. This round fixes the 15 findings. Nothing was run against a real Colima; the Colima facts come from its source (see the research notes).

1. **An unreadable folder list is never an empty one** (`src/lib/colimaConfig.ts`). `parseColimaConfig` returns `mounts` and `env` as `null` ("unknown") for flow style (`[...]`, `{...}`), a bare `-`, a block with a line it does not read, or an item with no location. With `null` the app offers no Share, Make writable or Use the proxy button, and the Doctor says "The app can't read which folders Colima shares" (Worth knowing, no button) when a running container uses a Mac folder.
2. **A failed start keeps the new setting saved, and the app says so.** Colima's `start` saves the config before it starts the VM (`cmd/start.go`, `--save-config` defaults to true). The result now says "`~/code/web` stays saved in the profile, so a plain start tries it again", and a second button, **Start with the folders you had**, starts the stopped VM with the list read before the change (`apply_mounts`, `restart: false`).
3. **The proxy line needs evidence and has no button.** It shows only after an image pull failed like a blocked network (timeout, refused, TLS handshake; `src/lib/netEvidence.ts`, in memory, 30 minutes) while the Mac has an HTTP or HTTPS proxy and the VM does not. A proxy found only as an auto-config file is not read. `apply_env` stays in the backend, waiting on a check on a real Mac; env values that are not proxy variables show as `…` in any command the app prints.
4. **Read-only share only on evidence.** The Doctor reads `docker logs --tail 200` of a container that writes into a read-only share, and says so only if a line holds "Read-only file system" (or EROFS) and the mount's path.
5. **sshfs or 9p has no button** and shows only while a running container uses a Mac folder.
6. **A restart for the network checks the lookup after.** `vm_dns_probe` runs once the VM and its containers are back (asked again after 3 s when it fails). Three results: "The VM can look up names again.", "The VM restarted, but it still can't look up names. Check the Mac's network, or your VPN's DNS." (stays in its row, with its buttons), or "The VM restarted. The app couldn't check names from inside it, so run the checks again." A good result in the Doctor is its own row (green check, Dismiss on the right), never inside Needs action.
7. **Failure words come from the change** (`changeFail`): "Colima couldn't start the VM with `~/code/web` shared. The VM is stopped. ..." or "Colima couldn't restart the VM.", never "the new size".
8. **Home's failed card**: the result comes first, above the stopped-VM card; Try again is a plain small button, so Start VM is the one filled button; **Show the log** reveals the VM's log in Finder (`reveal_vm_log`, `open -R` on `ha.stderr.log`, name checked, no path in the text).
9. **Confirm buttons say what happens**: "Share and restart", "Make writable and restart"; the network restart keeps "Restart the VM".
10. **Code font** for paths, addresses and `colima.yaml` in lines, results, progress and confirms (`Ticks`; aria labels use `plain`).
11. **Home lines**: "web · sees an empty `~/code/web` (not shared with Colima)" and "`~/code/docs` is shared read-only" (with the container's name before it inside a project).
12. **Or run it yourself** for a VM change is one line of inline code (commands joined with " && "), not a dark block; other fixes keep their block.
13. **Focus and speech**: a result that no status line has shown yet takes focus when its line mounts (a failed one always; a good one when focus was lost), and the page's own announcer stays quiet for a result that was already focused. Proven keyboard-only with `&unshared=1&vmfail=1`, and the away case (another page open) is still said by the alert.
14. **Names**: "Try again: ...", "Start with the folders you had: ...", "Show the log: ..." carry the row's title; the home Fix button's name starts with its visible "Try again".
15. **The reason a disabled button waits is spoken with it** (`aria-describedby` to a hidden span, `useId`) on the VM change and size buttons.
16. **Tests**: cargo 134, `npm test` 581, vitest 70, browser checks for mounts (10 groups, including keyboard-only and away) and network (DNS restart, DNS that stays broken, VPN, proxy before and after a failed pull). New preview flags: `&bind=1`, `&flowmounts=1`, `&pullfail=1`, `&stuckdns=1`; `&vmfail=1` now fails only a start with a folder the profile did not have, and the failed list stays saved. Screenshots `r36-*.png`.
17. **Not verified on a real Mac**: everything in round 35's list, plus `docker logs` output for a read-only error through Colima, and `open -R` on the VM's log.

## Loop 5, round 35: Doctor checks for folders and the network, each ending on a step the app runs

Two new groups of checks. Each problem is one plain sentence and one button; nothing runs without a confirm, and the app never edits `~/.colima` (Colima saves its own profile when the VM starts).

1. **Folder shared with the VM is missing.** A running container binds a Mac folder (under `/Users` or `/Volumes`) that no Colima mount covers. In the VM that path doesn't exist, so Docker makes an empty folder there and the app finds no files. Home says "web · its folder ~/code/web isn't shared with Colima" with **Share folder…**; Doctor lists it as Needs action on the container. The button restarts the VM with the full saved list plus the new folder (`colima start --mount` replaces the whole list, and a list that holds only the new folder would drop the home share, so the home folder is passed too when the profile had none). Confirm, then the same stop, start and start-again-what-ran flow as the VM size change, with the result under the row until Dismiss.
2. **Folder shared read-only, but a container writes to it.** Detected from the container's own mount (`RW` true) inside a Colima mount with `writable: false`. Button: **Make it writable…**, the same flow.
3. **sshfs or 9p on a vz VM.** Worth knowing, not counted. There is no one-click change on purpose: Colima discards a new mount type on a VM that already exists ("cannot be updated after initial setup"). The row says so and opens Profiles; a new profile starts with virtiofs.
4. **The VM can't look up names.** A read-only probe, `colima ssh --profile <name> -- getent hosts registry-1.docker.io` (fixed arguments, 25 s limit, skipped while a VM operation runs). Only a clear "not found" (exit 2) counts, asked twice 3 s apart; an ssh or colima error says nothing and the check is left out. Fix: **Restart the VM…** (Colima's own restart), because the VM looks names up through the Mac's resolver and a restart follows the current network. With a VPN tunnel up (a `utun` with an IPv4 address in `ifconfig`) the same finding names the tunnel.
5. **The Mac has a proxy the VM doesn't.** From `scutil --proxy`. Worth knowing. Colima and Lima do not read the macOS proxy settings, only environment variables of the process that starts them. Fix: **Use the proxy…** restarts the VM with `--env HTTP_PROXY`, `http_proxy`, `HTTPS_PROXY`, `https_proxy`, keeping the other saved variables (`--env` replaces the saved map). Not offered for a proxy on localhost, or when a saved value holds a comma or quote.
6. **Backend** (`src-tauri/src/main.rs`): `colima_config` (reads the profile's yaml, first 64 KB), `network_facts` (`scutil --proxy`, `ifconfig`), `vm_dns_probe`, and `apply_mounts` and `apply_env`. Every check on the folders and settings runs before the VM stops, and a refusal starts "Nothing changed" so the page says the VM is as it was. Folders must exist on the Mac as folders, can't overlap by Colima's string-prefix rule, and never are the root, system folders, other users' folders, hidden folders or `~/Library`.
7. **Smaller fixes along the way**: a change that stopped the VM and failed shows its result and **Try again** (which only starts the VM) above the stopped-VM card on home; the size buttons elsewhere don't show a size during one of these changes.
8. **Tests**: cargo 133 (7 new), `npm test` and vitest (new: `colimaConfig`, `mounts`, `netFacts`, `vmChange`, Doctor checks, `VmChange.test.tsx`), browser checks `check-mounts.mjs` and `check-netfix.mjs`. Preview flags: `&unshared=1`, `&missing=1`, `&rofs=1`, `&sshfs=1`, `&dns=1`, `&vpn=1`, `&proxy=1`, `&vmfail=1`. Screenshots `r35-*.png`.
9. **Not verified on a real Mac**: `colima ssh` and `getent` exit codes through Colima, that `colima start --mount` keeps the saved yaml consistent on a real profile, and whether image pulls use the VM's proxy variables (Docker's own `proxies` setting lives in the `docker:` section of the yaml, which the app doesn't edit). Proxy auto-config (PAC) files are not read.

## Home says what is down: round 34 fixes

1. Every Open button's accessible name starts with its visible words, then ": " and the detail: "Open in TextEdit: compose.yaml, report-job", "Show in Finder: compose.yaml", "Opening…: compose.yaml". "Open compose.yaml: report-job" is unchanged.
2. Each target app is its own Open button. When the app changes while the button has focus (it is looked up again when the window gets focus), focus moves to the new button and "It now opens in TextEdit." is said. Nothing is said when the first lookup lands.
3. When the app is known, the button names it ("Open in Cursor"). It stays "Open compose.yaml" when the app can't be told.
4. A failed open ends "Open it from Finder."
5. Bare `open -t` is never used: it opens whatever the plain-text default is (it can be iTerm), past the deny list. With no YAML or plain-text editor that passes, and for the retry when the chosen app is gone, Open uses TextEdit by its bundle id, and only that is called TextEdit.

## Home says what is down: round 33 fixes

1. A failed open names the app and puts `compose.yaml` in the code font: "Couldn't open `compose.yaml` in Cursor: the application can't be opened. Show it in Finder and open it from there." With no reason from macOS it ends "in Cursor."; with no app known it says "in an editor".
2. Home's lines keep their icon on the first line of text when the text wraps (the TextEdit note, a failed open, raised with db stopped), and the button stays centered.
3. The Finder button reads "Show in Finder". Its name for screen readers stays "Show compose.yaml in Finder".
4. When TextEdit is what Open uses, the line says so before any click ("It opens in TextEdit: turn off Edit > Substitutions > Smart Quotes before you type.") and the button reads "Open in TextEdit". The click opens at once; the 1.5 s wait is gone. This is the same on Doctor and the container page.
5. While `open` runs, the button reads "Opening…" and is disabled, and a second press does nothing. "Still opening `compose.yaml`…" is said once.
6. Open's deadline counts only a real kill as still opening, and an open error never gets the "Docker or Colima may be stuck" sentence. The app lookup runs off the main thread.

## Home says what is down: round 32 fixes

1. The TextEdit hint comes before the file opens. The app first asks macOS which app will open it (a lookup, nothing opens). If it is TextEdit, it shows and says "Opening in TextEdit. Turn off Edit > Substitutions > Smart Quotes before you type." a moment ahead, then opens. The hint is part of the line when read, is said once per session, and sits in the Open button's title while TextEdit is what Open uses.
2. Open uses the app registered to edit YAML, then the app registered to edit plain text, then the default text editor. The deny list still applies. TextEdit is recognised by its bundle id either way.
3. A failed open says it once: "Couldn't open compose.yaml in an editor. Show it in Finder and open it from there." (macOS's reason in place of "in an editor" when it gives one). Open becomes "Show compose.yaml in Finder", with focus moved to it.
4. `open` runs with a 30 s deadline. If it is still going, the page says "Still opening compose.yaml…" and nothing is retried. A second try with the default text editor happens only when macOS says the chosen app can't be found, so a cancelled dialog never lands the file in TextEdit.

## Home says what is down: round 31 fixes

1. A limit line's notes change only when the file side really changes (raised and unchanged, or the button itself). Then a "still sets" refusal goes, but a failed start's alert stays. A re-read that can't read the file no longer wipes a fresh "didn't start" alert or a status.
2. When compose.yaml opens in TextEdit (no app set for YAML, or the one set is refused), the page says once per session "Opened in TextEdit. Turn off Smart Quotes in Edit > Substitutions before you type." It is a status, not an alert, and shows on home, Doctor and the container page.
3. The app set for YAML is used only if macOS also lists it as an editor of plain text; otherwise `open -t`. The deny list still applies first.
4. Reading a macOS string checks the call's 0/1 result properly.
5. Opening waits for `open` to finish. If the YAML app can't be reached (a stale record), it tries once more with the default text editor; if that fails too, the page says "Couldn't open compose.yaml. …".

## Home says what is down: round 30 fixes

1. Open compose.yaml uses the editor set for YAML on this Mac (LaunchServices' default for public.yaml), as `open -b <its bundle id> <real path>`, so even a file swapped for a script opens as a document. When none is set, or the one set is a terminal, script runner or other non-editor (a short deny list), it falls back to `open -t`. Plain `open <file>` is never used. Every path check stays; Show in Finder keeps -R.
2. Doctor's limit buttons end where the other rows' buttons end, before the menu column.
3. Raised line: "report-job · its limit in `compose.yaml` is now 1 GiB (was 256 MiB). Apply it to start." Doctor and the container page say the same.
4. A "still sets 256 MiB" refusal goes once the file reads differently. Doctor's second button is its own button per state; when it changes, focus moves to the new one and the change is said politely, as on home.
5. The fallback project name drops a leading _ or - like Compose does. A Compose file under a linked folder that leads out of home is still refused, now with "compose.yaml is in a linked folder outside your home, so it can't be opened from here".

## Home says what is down: round 29 fixes

1. Opening a Compose file can no longer launch code. `open_compose` and `reveal_compose` resolve symlinks, require a regular file whose real path is still a listed Compose file in an ordinary home folder, and open it with `open -t` (the default text editor), never the app linked to the file. A compose.yaml that links to a script, links outside home, or is a folder is refused.
2. Reading a project's limit retries plain `compose config` only when the first error is about the `*` profile or an unknown flag; any other error (a broken file, a missing variable) is the answer.
3. Memory values accept k, m, g, t, p with an optional i and b, and bytes with no unit. What report-job depends on, and the service list's labeled fallback, only count containers of the same Compose project (by name), not any project in that folder.
4. Home's limit line: each button state is its own button, so a screen reader never hears one button rename itself. If the old button had focus, focus moves to the new one, and the polite region says "compose.yaml now sets 1 GiB for report-job. The button is now Apply and start."
5. Apply and start reads "Starting…" on home too while it runs, and its accessible name says "Starting report-job" to match.
6. Raised line: "report-job · `compose.yaml` raised its limit from 256 MiB to 1 GiB. Apply it to start." in the neutral stopped tint with the stop icon (nothing is failing; one step is waiting). Doctor and the container page show the same sentence.
7. Doctor: the "still sets 256 MiB" refusal appears only after Apply is pressed, as a warning line at the text's width under the body, never in the button column. report-job never splits inside the word.
8. Doctor's limit row puts its two buttons in a row under the text, right-aligned, so the body runs the full width like the rows beside it.

## Home says what is down: round 28 fixes
- **The limit line reads the file again.** `docker compose config` (every profile, overrides merged) gives report-job's current `mem_limit` or `deploy.resources.limits.memory`; it is read on opening, on window focus (saved, then back) and after each Compose run, never on a timer. Home shows one button on the right: while the file still sets 256 MiB (or can't be read, when nothing is said about its value), "Open compose.yaml", which opens the file in its default app (`open_compose`, listed files only); once raised, "`compose.yaml` now sets 1 GiB for report-job." with Apply and start.
- **Doctor and the container page keep both, short:** Open compose.yaml, then Apply and start on the right (full names for screen readers). Apply pressed while the file still sets the old limit doesn't run: "`compose.yaml` still sets 256 MiB for report-job. Raise it, then press Apply and start."
- **Apply touches only report-job.** It runs `docker compose up -d --no-deps report-job`, so a finished job isn't rerun and a db the user stopped stays stopped. When what it depends on isn't running (or a job it needs hasn't finished), the line says "Start the project first." and offers the project's Start instead.
- **Profiles count.** The service name is checked against `docker compose --profile '*' config --services`, or, on an older Compose, the active ones plus any service a container of this project already carries.
- **"Nothing was started" when nothing was.** A refusal before Compose ran (the file can't be read, a name not of the project) comes back marked, and the page doesn't add "Part of the project may have been created; Down removes what was left."
- **Said and focused.** "Starting report-job…", then "report-job started with its new limit.", in the polite region (home's own, or the line's on Doctor and the container page); a failure, or a file that can't be opened, goes to an alert. A line that goes under focus hands it to the row's name on home; on Doctor, to the row that was after it. A locked button's reason ("Waits for the Compose run that is going.") is read with it.

## Home says what is down: round 27 fixes
- **A raised limit gets applied.** A plain start keeps the old limit (Docker applies a new one only to a recreated container), so the limit line's first button is Apply and start report-job: `docker compose up -d report-job` for that one service, on home, its page and Doctor. The backend takes the name only if `docker compose config --services` lists it and it can't be read as a flag. Shown only for a container from a listed Compose project. Doctor: "report-job is allowed 256 MiB and used more, so Docker stopped it. A bigger VM won't help: raise its memory limit in `compose.yaml`, then press Apply and start."
- **No key we can't see.** The limit is "set in `compose.yaml`" (or "in the project's Compose files" when an override is listed too), never `mem_limit`: it may be `deploy.resources.limits.memory` or `docker run -m`. File names are in the code font on home as on Doctor; buttons stay sans.
- **Show compose.yaml in Finder** says where it opens.
- **Its own limit only when clearly below the VM** (at most 75% of the VM's memory). Near the VM's size, or with the VM's size unknown, the bigger VM stays the offer and the text mentions the limit.
- **The memory failure's next size is a plain button**, not a second filled one; its text ends "Give the VM more memory, or make report-job use less."
- **No inspect yet, no change.** An out-of-memory or "stopped with an error" line stays until the restart policy is known.

## Home says what is down: round 26 fixes
- **Its own memory limit is not the VM's.** The Doctor's inspect now reads `HostConfig.Memory`. A container killed for memory with its own limit (set and not above the VM's memory) says "report-job hit its own 256 MiB limit (mem_limit in compose.yaml)" on home, its page and Doctor, and offers Show compose.yaml (reveal_compose) when the scan lists its project; otherwise See why only. A bigger VM is offered only with no limit, or a limit above the VM's memory. Preview: `&limit=1`.
- **When memory still isn't enough, Start isn't the first answer.** "report-job didn't start: 8 GiB still isn't enough for it. Give the VM more memory, or lower report-job's memory limit." The next step comes first ("Give the VM 12 GiB…", the next common size within half the Mac), or Change in Profiles when none fits; then See why and Dismiss. Start stays for what a retry can fix (a port in use, an unknown error).
- **No counts in the result.** "The VM has 8 GiB now. Everything that was running is running again, and report-job started again." With a failure: "Everything else that was running is running again." Progress: "Starting everything that was running…".
- **No "is stopped" line during a resize**: what ran is about to start, and the line waits for the list read after it.
- **Dismiss keeps focus on something real**: the next row's first reachable button (never a Compose row's hidden chevron), else this row's name, else Doctor's first button, else the page heading.
- **Held until a read that counts.** Doctor's report is released only by a read that worked and started after the resize ended; a failed reload keeps holding until the next poll lands.
- **A recreate isn't ours.** Once a stop was pinned when it ran, a container with no pin under it (a new ID) is not "stopped by the app"; only a stop that never got that pin falls back to comparing clocks.
- **No flicker in a crash loop.** An out-of-memory or "stopped with an error" line goes when the container runs only if it has no restart policy, or its new run has lasted over a minute (read from `docker ps`, so no clocks are compared).

## Home says what is down: round 25 fixes
- **A resize from an out-of-memory line ends on a clean row.** Once the container runs, its red line goes (an out-of-memory or "stopped with an error" line is about the last run, so it returns only if a new run ends the same way). The result moves to its own row under the project, tinted like the "is stopped" line, with a green check, ink text and Dismiss at the right edge, and takes focus if nothing has it. A failure stays in the red line, with the ✕ in red, not a triangle.
- **The result says only what changed, and counts only what ran.** "The VM has 8 GiB now. The 7 that were running are running again. report-job started again." CPUs are named only when they change. The same count replaces "Your N containers" everywhere it appeared, the progress line too ("Starting the 7 that were running again…").
- **Docker's reason, in plain words.** "report-job didn't start: the VM didn't have the memory to start it." When the app can't say it plainly: "report-job didn't start. See why shows Docker's message." The result's buttons line up under its text, not its icon.
- **The out-of-memory container starts in its depends_on place.** Its compose labels are read with `docker inspect` (it still exists, exited), so a db killed for memory starts before the api that needs it. It still isn't counted among the ones that were running; without its labels it starts last, as before.
- **Other lines survive the resize.** Doctor's report is held until a read made after the resize, so kafka and kafka-ui keep their lines (the report read while the containers were stopped had dropped them).
- **"Stopped by the app" is pinned at stop time.** Right after the app's `docker stop` (or `compose stop`, found by its project label and folder), `docker inspect` keeps that run's StartedAt, so the Mac's clock is never compared with the VM's. The first-look pin stays as the fallback when that read fails.
- **Screen readers.** "Start them: cache and db" (the label starts with the words on the button); done says "cache and db started" for both the line and the menu's "Start the 2 stopped (…)", not "shop started"; the row's name counts the line apart ("3 problems, 1 stopped"); when the line goes under focus, focus goes to the row's name.
- **Previews match.** check-down now uses the same 2 GiB VM as check-resize, so report-job's line offers "Give the VM 8 GiB…" in both (the "See why" seen before came from the 8 GiB VM in the other preview scenario, where no bigger size fits; it was not a timing gap).

## Home says what is down
- **Every container a project is short of is on a line.** Under a partly running project, a service that counts as down and has no problem line of its own gets one plain line, last: "cache is stopped" with Start, or "cache and db are stopped" with Start them (three names, then "and N more"). Start starts exactly those, by ID, and its wait ends once they run, even while a crashed job keeps the project partly running (the menu's "Start the 2 stopped (cache, report-job)" had the same wait and gets the same fix). Finished jobs are not counted, so they get no line; a project that is all stopped says Stopped and gets none either. The row's name counts the line with the others.
- **A bigger VM from an out-of-memory line starts that container too.** From home, the container's page or Doctor, the container is started on its own once the VM is back, after the usual restart waves: "The VM has 6 CPUs and 8 GiB now. Your 7 containers are running again. report-job started again." If it still won't start, its own "didn't start" line has Start and See why. On home the result takes its own row under the line, so the line's text isn't squeezed. A resize from the VM size row is unchanged.
- **"Stopped by the app" uses one clock.** The Mac's time of a stop is used only until the first look; then the stopped run's StartedAt (the VM's clock) is kept, and later looks compare to that, so a VM clock a few minutes behind can't hide a terminal start. With no VM running, nothing reads as stopped by the app.
- **The confirm says "You can start it again from here afterwards."**

## Bring over from home, and the first morning's empty volume
- **The first morning gets one line.** When `docker compose up` ran in Colima before the app, Compose made an empty `shop_db`. The shop row now says "`shop_db` is nearly empty here; Docker Desktop has 392.9 MiB." with one button, Bring it over…, which opens Bring over with only that volume picked. Same rule as the panel: Colima's copy under 64 MiB and Docker Desktop's bigger, on a volume a home container uses (stopped ones too). While it holds, Doctor's row is a warning ("shop_db is nearly empty in Colima") and the badge counts it; otherwise it stays a note.
- **Docker Desktop is read once**, when home opens and again after a copy, never on a poll (`src/desktopOffer.ts`, volumes only).
- **An empty home offers it first.** "Bring over from Docker Desktop" is the main button, with Run an image and Start a Compose project beside it in one row; the line above says "Your Docker Desktop volumes are still on this Mac. Bring them over first, so your projects start with their data." While something is left, New ends with "Bring over from Docker Desktop…". Nothing else is new on screen; home still has no VM note and no setup strip.
- **The offer follows what is still missing**, not a flag: the volumes the panel picks by default (missing in Colima, or a fresh empty copy). A partial copy or a restored replace keeps offering the rest. The old flag is kept only for when Docker Desktop can't be asked (closed or removed), and is set only when nothing was left.
- **One panel, pinned to its VM.** Doctor, the empty state, the problem line and New open the same panel, which the app owns. Its follow-ups (Start in Colima, Try again) run on the VM it opened on. Switching profile closes it; during a copy (where Close waits) it stays and says which VM it is for.
- **Focus and VoiceOver.** When the panel closes and its opener is gone, focus goes to the empty state's main button, else Doctor's Run checks again, else the row the line was under, else the page heading. A line that goes away under focus hands it to its row too. The line's button reads "Bring it over: shop_db from Docker Desktop", and the row's problem count includes it. After a copy, the app says "Volumes are in Colima now." once.
- **Words that match.** One named volume gets "Bring it over…", several "Bring them over…", on home and in Doctor; "Bring over from Docker Desktop" is only where no volume is named. Doctor's warning reads "`shop_db` is nearly empty in Colima" (in the code font) over "11.4 MiB here; Docker Desktop has 392.9 MiB. Colima's copy is backed up first.", and it too opens the panel with only that volume picked. On home the line comes first among the project's problem lines, since an empty database can explain the rest.
- **The pick is checked again.** The panel picks a named volume only if its own fresh read still finds a fresh empty copy (under 64 MiB). One that filled up since is left unpicked with "Colima's `shop_db` has 300.4 MiB now.", and home's line is read again so it clears.
- **No stale answer wins.** Reads of Docker Desktop that overlap (VM open, after a copy, a profile switch) keep only the newest. Docker Desktop opened after the app is noticed on the next window focus, at most every 10 minutes and only while something is unknown or a line shows.
- **Counts hold through a replace.** A replace stops `shop-db-1` (a clean Postgres stop exits 0, which home counts as finished), so shop read one fewer running until the next poll. Home now reads the list the moment a copy ends, and the count is back at once.
- **A folder on the Mac is never emptied.** A Colima volume that is a bind to a folder on the Mac (a local volume with options), or uses another driver, is never offered, picked or shown on home; its row says "Colima's `shop_db` is a folder on your Mac (~/code/shop/data), so it isn't replaced. Docker Desktop's 392.9 MiB stays there." (the folder from the volume's `device` option, when it is under /Users). There is no Show in Finder: the app's only reveal command, `reveal_compose`, accepts nothing but a listed Compose file. The backend refuses it too, before anything stops and again right before each emptying (`plain_volume` on `volume inspect`). A Colima size that can't be read is never "nearly empty".
- **The backend checks the size itself.** The panel sends the size it showed; after the backup, the backup's real byte count must be under 64 MiB or twice that size. Otherwise the backup is dropped, the containers start again, and the row says "Colima's `shop_db` has 300.4 MiB now, so it was left alone." The same check runs on a count of Colima's volume before the backup is made, so an 8 GB volume is refused before it is copied; a count that can't be read leaves the decision to the check after the backup.
- **The confirm uses today's sizes.** Both sizes are read again just before it; a copy that grew in between is dropped without asking, and its row says "Colima's `shop_db` grew to 300.4 MiB since we checked, so it isn't replaced." When the panel opened for that volume alone, its main button is Done. When the click itself finds that every pick grew, the footer says "Nothing was replaced. Colima's `shop_db` grew to 300.4 MiB while you were picking." above Done. The rows it names drop their own note, so it isn't said twice. When other picks remain, the confirm asks "Bring `uploads` over?", says who stops first, and ends with a notice set apart with a warning mark: "`shop_db` isn't replaced: Colima's copy grew to 300.4 MiB since we checked." It is in the confirm, not an alert (the dialog takes focus and VoiceOver would cut the alert); the alert is kept only when nothing is left to confirm. Every alert in the panel is cleared and set again a moment later, so the same words are read twice. With Done in the footer the header Close goes, so the panel has one way out (the header keeps Close's height, so the title doesn't move); Escape still closes it, and Done is described by the line that explains it. Home's line, the badge and Doctor's row follow every read the panel makes, while it is still open.
- **A stopped service is not a finished job.** A container that exited 0 reads Finished, and leaves the count, only when it is a one-shot: nothing published, no health check, no restart policy, no named volume (kept data means a service), and a last run under 2 minutes (`State.StartedAt` to `State.FinishedAt`, from the `docker inspect` the Doctor already reads). The window is short on purpose: a longer one would hide more outages. A Compose service that another waits for with `condition: service_completed_successfully` is a job whatever its run time or volumes. Anything this app stopped reads Stopped until it starts again from anywhere (each stop keeps its time, per Docker context, and counts only while the container's current run began before it); the stops the backend makes during Bring over count too. An unknown run time, or no inspect yet, reads Stopped: the exit code alone never makes it Finished. In the preview, shop reads "5 of 7 running" (`cache`, a Redis that ran for days, and `report-job` are down). The project menu names what it starts: "Start the 2 stopped (cache, report-job)", with "and N more" after three.
- **Buttons that open a confirm end in "…"**: "Give it 6 CPUs and 8 GiB…", "Give the VM 8 GiB…".
- **Doctor's out-of-memory row has one button.** "Other numbers? Change in Profiles" moved into its text, as on the VM size row.

## An empty Colima volume is replaced, with a backup
- **The usual case is one click.** When `docker compose up` ran in Colima before the data came over, Colima's `shop_db` is a nearly empty one beside Docker Desktop's real one. Its row in Bring them over says "392.9 MiB · replaces 11.4 MiB", with one note: "Colima's copy is backed up first. `shop-db-1` stops on both sides; the Colima one starts again after." It is picked by default only when Colima's copy is under 64 MiB, the size of a freshly made one (an empty Postgres is about 40 MB). A bigger one is listed unpicked as "Colima has 85.8 MiB", with a note that it may hold newer data. Size is the only rule; reading file times would cost another helper run per volume. A volume Colima has at full size is still never touched.
- **Nothing is lost.** Colima's copy goes into `shop_db-colima-backup-20261029-1912` first (copied inside the VM, labels kept), and the backup must match in files, folders and bytes before anything is emptied. Sizes are read with `stat`, so no file is read twice, and the count gets 10 minutes plus 1 per 5 GB of the larger of the listed size and what the copy really streamed. Then the original is emptied and filled from Docker Desktop, with the same check. The in-VM copy and the count run with `pipefail` (the count with `-e` too), so a step that fails partway fails. The original volume is never removed, so containers that reference it keep working. Before emptying, copying and restoring, the app checks again that nothing started on the volume.
- **A failure puts it back, and the rest waits.** If the copy fails or is stopped, Colima's copy is restored from the backup and the line leads with that: "`shop_db` wasn't replaced. Colima's copy is back as it was (also saved as `…`)." The picks not reached stay picked, so the button reads "Try shop_db and uploads again". The row says it in plain words ("Colima's disk had a write error partway through."), with Docker's own text behind Show output. A write error adds "Restart the VM, then try again." with a Restart the VM button (the app's own VM restart). If the restore fails too, the alert names the backup and the containers that stay stopped.
- **The whole app waits during a copy.** One rule, `dockerLocked`, now decides for every button that changes Docker (VM, resize, container rows and page, Fix, Run, Compose, Remove on Volumes, where a backup removed mid-replace would leave nothing to restore): it waits while the VM changes, a resize, a copy, a Compose run or a Fix is running.
- **Volumes marks the backups**: "Backup from bringing over shop_db, October 29", so they are easy to find and remove.
- **Each step is on the row**: Backing up Colima's copy…, Emptying…, the bar and bytes only while the data streams in, Checking…, Starting shop-db-1….
- **The confirm puts each side on its own line** and says what is replaced and the backup's name. Start buttons name their side: "Start shop-db-1 in Docker Desktop", "Start shop-db-1 in Colima".
- **The result is short lines**: "2 volumes are in Colima now." (a replaced one counts), "`shop_db` replaced Colima's nearly empty copy. The old one is in `…`; remove it in Volumes once you've checked.", "`shop-db-1` is running again in Colima.", then what is stopped. No remove button, on purpose: check the data first.

## A small VM is one click from a good size
- **One button instead of Profiles.** Doctor's "The VM has 2 CPUs and 2 GiB" row says "Your Mac has 32 GB, so the VM can have 6 CPUs and 8 GiB" and its button does it: the size this Mac would start a new VM with, never less than now and never more than half the Mac's memory. Change in Profiles stays as a quiet link. A container that ran out of memory gets one button on its line, "Give the VM 8 GiB", on Containers, its page and Doctor.
- **Nothing to start by hand.** The confirm says "Your 7 running containers stop and start again after (about a minute)". After the restart the app starts every container that was running with plain `docker start`, never `compose up`, so nothing is recreated, rebuilt or started a second time on new volumes, and no compose file is needed. Compose services start in waves, after what they depend on (read from the label Compose writes on each container); one that needs a healthy service waits up to a minute for it. Loose containers start last. Kubernetes pods are left to Kubernetes, which brings them back on its own; they aren't counted, and the confirm and the result say so. If the app can't read which containers run, it doesn't restart the VM.
- **One that won't start is named** on the result line, "6 of 7 containers are running again. web didn't start: port 8080 is in use on your Mac.", with Start web, See why and Dismiss under it.
- **Not enough memory** is one line, "8 GiB didn't fit in free memory. The VM is stopped.", with "Try 6 CPUs and 6 GiB", "Start it as it was" and Dismiss; the row's own sentence hides while a result shows. Free memory isn't read first: macOS counts its file cache as used and the VM takes memory as it needs it, so the Mac's total is the cap.
- **The row is the one place that reports.** No command toast during the run (the commands are still in All commands). On another tab the VM strip shows the same line as Doctor, with a spinner, container rows say "Restarting…" and keep their last button label, locked, until the list shows the real state, and VoiceOver hears each step and the result once. The problem count and the badge hold still meanwhile. Focus moves to each result, with a ring only from the keyboard, and the result scrolls into view above the toast's place.
- **Not in Fix all**, because it restarts the VM; Fix all counts it as left for you ("Fix 5 of 6 problems").

## Bring Docker Desktop's volumes and images over
- **One button instead of a command to paste.** Doctor's "Your Docker Desktop volumes and images stay behind" opens a panel. It lists Docker Desktop's named volumes (picked) and tagged images (not picked, since Colima downloads them again) with their sizes, then copies them one at a time, volumes first, with progress and Stop.
- **Docker Desktop keeps its copy.** Volumes are read through a read-only mount and images with `docker save`. A volume Colima already has is never replaced; when Colima's is under half the size, the row shows both sizes and says to remove the empty one first.
- **No half copies.** A container writing to a picked volume (running, paused or restarting) is stopped first, after a confirm. The summary names it, and one click starts it again. A failed or stopped copy removes its helper containers and the half-made volume. The copy is kept only when both sides have the same number of files and folders.
- **Before and after.** A free-space estimate warns when the picks won't fit. A full disk says so in plain words, with Open Profiles as the main button. The row also shows when Docker Desktop is closed (Open Docker Desktop) or removed with its 30 GiB disk left behind (Download, Check again). After a copy, the Doctor row moves to the passing checks.
- **Every confirm returns focus** to the button that opened it, and a drawer's Close stays focusable while it waits.
- **Scorecard**: rounds 8 to 10, same six reviewers. Product 8, 8.5, 9; UX 8, 9, 9.5; visual 8, 8.5, 9; engineering 7, 8.5, 9; daily user 9, 9.5, 9.5; accessibility 7.5, 9, 9. No round has run against a real Docker Desktop yet.

## Round 4: the cause of a crash loop, Compose projects in reach
- **A crash loop names its cause.** The container page reads the last log lines and shows the error behind the restarts. A line whose cause it knows wins over the last error line, with what to do: "Nothing is mounted at /data/in, so /data/in/4182.png isn't there. Mount the folder that has it at /data/in", or that localhost inside a container is the container itself.
- **Compose projects has its own button** on the Containers toolbar, with the count. It stays under New too.
- **Small fixes**: the logs service picker is wider, and Commands entries keep the words and the command on separate lines.
- **Scorecard**: loop 4 scored 45/48 against loop 3's 37 from the same reviewer. Totals from different reviewers differ by up to 8 points, so only same-reviewer comparisons count.

## Compose, round 3: live logs, Run again, one-click port fixes
- **Project logs are live.** New lines every 2 seconds, each with its service and time. Filter by service or text; scrolling up pauses following.
- **Run again** in Commands, for a container start, stop, restart, pause, resume or shell. It waits while a Fix runs. Remove, Down, VM and Compose actions stay copy-only. Each entry says what it did in words.
- **A port clash is one click**: "Stop web and start blog" stops the container holding the port, then starts the project.
- **Search by port**: typing 8080 finds the container that publishes it.
- **Scorecard**: `scripts/scorecard.md` is the fixed test for every improvement loop, scored blind by a fresh reviewer. Loop 1 scored 31/48, loop 2 40 (38 from a second reviewer), loop 3 45.

## Compose, round 2: rebuild, logs, add a folder, a shell for every container
- **Rebuild and Update images** on each project (`up -d --build`, `up -d --pull always`). On a stopped project they say "and start", because they do.
- **Logs** under a project's card: the last 300 lines of every service, with Refresh and the command to follow them live.
- **Add a folder…** for a project Spotlight missed. It is remembered, checked on every scan, and listed even past the 300-file cut. Hidden folders, ~/Library and dependency folders are refused with the reason.
- **Each card names what needs attention**, from the same checks as the Doctor ("worker: it keeps restarting").
- **Open a shell picks bash, then sh.** A minimal image with neither gets a toolbox shell next to it (a throwaway, pinned busybox that shares its processes and network), and the toast says why. The check gives up after 5 s, and a stopped container or a stuck Docker is reported as itself.
- **Steadier panel**: buttons wrap instead of running off the edge, cards keep their place while it is open, Close works during a run, a failed Start offers the Down its note mentions, and "Run it yourself" labels each command.
- **Fixes**: Refresh no longer closes the logs, a late log answer can't land under the wrong project, a scan can't drop a folder added meanwhile, and the recall checkbox sits next to its label.

## Run Compose projects, see every command
- **Compose projects run from the app.** Start, Stop, Restart and Down run `docker compose` in the project's own folder, as typing it there would. A running project offers "Start the N stopped" first and Down in red, with a confirm that says volumes stay. Every action's command is under "Run it yourself", with its own Copy.
- **A failed Start says why.** A taken port names the container and project holding it, and says Down removes what was left. Missing `docker compose` points to the Doctor.
- **Search that finds what you meant**: "search service" and "sss" both find service-search-service, by name, initials, word starts or folder. When no container matches, the list offers the Compose projects that do.
- **Every click shows its command.** A toast says what happened ("Stopped web"), then the command with the profile's `--context`, then Copy. The Commands button lists the whole session. Now and then the toast asks you to recall the command first; you can turn that off.
- **Fix, safer**: while a Fix runs, Compose actions and the sidebar VM Stop and Restart wait. A Fix turns the old copy's restart policy off and puts it back on undo, says so if it couldn't, and fails when the new copy restarted or was still starting at the last look. Containers with `--rm`, tmpfs, sysctls, log options and a few other settings stay copy-only. The Doctor flags a `NAME-old` left by an unfinished Fix, with the command to put it back.
- **Small things**: rows keep their place while the pointer is over the list, so a click never lands on the row that moved in. One Escape closes only the top panel.

## Doctor
- **Setup is now Doctor.** One page, at the bottom of the sidebar, for every check: setup, containers, network, images, storage and the VM. The badge counts what needs action. Findings are grouped as Needs action and Worth knowing, with passed checks folded. The setup checks and their Fix all are unchanged.
- **Fix where it's broken.** Each broken container row has a Fix column with one always-visible button that says where it goes: Fix…, Fix both… (linked rows like Kafka and Kafka UI offer the same fix), Connect…, Logs or Show steps. While a fix runs the row says so; afterwards it says Fixed (with a note that Kafka takes about 30 s to start) or Fix failed with Details. Problems carry an icon, not only a color. Docker problems in your terminal show as one line in the VM row with its fix. Every change asks first, and the Replace confirm says files saved inside the container don't carry over.
- **New checks**, each showing what it found: a container looking for another at `localhost`; containers using each other's names with no shared network (or on the default network, which has no name lookup); a start that failed over a taken port, naming who holds it; an image built for another CPU; postgres or mysql stopped for a missing password setting; a database without a named volume; space held by unused images and cache; a VM too small for Elasticsearch, Kafka and the like.
- **Connect**: a one-click fix that adds containers to a shared network. It only adds, so nothing restarts.
- **Not an issue** hides a finding on the Doctor page, the Containers list and the badge, and can be undone.
- **One source for problems.** The Containers list, its Needs attention filter, the container page and the Doctor badge use the same checks, so they agree. Crash titles name their container on the Doctor page.
- **Test a connection** is the new name for the two-container network tester. It opens from Doctor, Networks and the container page.
- **Doctor, reviewed**: fewer false alarms. A `localhost` setting that is a CORS origin, a callback URL or a listen address is left alone, and so is a container that shares another's network. When several containers could be the target, the finding says so and offers no one-click fix. A postgres or mysql stop is blamed on a missing password only on a first start, and says its logs have the final word. A normal stop is not read as a CPU problem. A check that couldn't get its data is skipped, not shown as passed, and a container removed mid-check no longer hides the rest. Passed never contradicts Needs action, and the badge, the page and the Needs attention filter count the same things. "Not an issue" is per profile.
- **Fix, reviewed**: checks every step before changing anything (a leftover `-old`, the backend's rules, an image tag that moved or a container started with its own command); waits for a health check; keeps the result on screen after the panel closes; locks Start, Stop and Remove while it runs; carries over 127.0.0.1 ports, restart counts and the broker's other settings, and stays copy-only for settings it can't carry.

## One-click Fix for the Kafka checks
- **Fix replaces the broken containers for you.** On the container page, Fix (or Fix both, when Kafka UI needs its broker fixed first) asks once, then for each container: renames it to `<name>-old`, stops it, starts the fixed copy, and waits about 12 seconds. The page shows each step as it happens.
- **If the copy doesn't stay up, the old one comes back** under its own name and starts again. The page shows why, with the copy's last log lines. A leftover `<name>-old` stops the fix before anything changes.
- **Only when the app can do it safely.** Containers with a mount the app can't recreate (a folder outside your home, or tmpfs), Compose containers and Kubernetes pods keep the copy-only commands. The commands are still under "Or run the commands yourself".
- **Backend**: `docker rename` is allowed with exactly two container names, and `docker run` accepts `--restart`.

## Known-app checks: Kafka and Kafka UI
- **"No clusters found" in Kafka UI now has an answer in the app.** The containers list reads every container's settings and flags three setups that run but can't work: Kafka UI with no cluster, Kafka UI pointed at `localhost`, and an apache/kafka broker that only advertises `localhost:9092` while other containers want it. The row says it in a few words ("No Kafka set up", "Only reachable from your Mac"); the container page explains it and gives the commands.
- **Commands you run, built from the container itself**: same image, ports, volumes, restart policy, networks and settings, with only the broken address changed. The broker gets a full single-node setup, because any `KAFKA_` setting turns off all the image defaults. The page says when topics live inside the container and will not carry over.
- **Safe to run**: the old container is renamed to `<name>-old` and stopped, and removed only once the new one starts. Every line names the profile's context.
- **Not flagged**: host networking, stopped containers, Kafka UI with a config file or dynamic config, and brokers that already advertise a container address. Compose containers get compose-file lines, Kubernetes pods get advice only, and with no Kafka container the app suggests `host.docker.internal`.

## Review round 7: controls where a daily user looks first
- **Switch profile at the top of the sidebar.** The switcher shows the current profile and its state. Its menu lists every profile with a tick on the current one, New profile, and Manage profiles. Each profile row has its own Start or Stop: it switches to that profile and shows the progress on Containers. A failure card stays with the profile it happened on.
- **Logs and Shell on every container row.** Hover a row for Logs (opens the container on its Logs tab) and Shell (a running container, not a Kubernetes pod). The tools have their own column, so they never cover the Memory value.
- **Setup and Profiles sit at the bottom of the sidebar**, under a thin line; daily screens stay at the top. A failing setup check still shows the strip on every screen.
- **One status style everywhere**: a dot and a word. The container page, Profiles (Status and Kubernetes columns) and Kubernetes pods now match Containers. Pods keep Kubernetes' own words (CrashLoopBackOff) with a red, amber or green dot.
- **The green button is on the title row on every screen.** Containers' New moved up next to the title, the same spot as Pull image and New profile, lined up at every window width.
- **A stopped VM has one Start**, inside the "is stopped" card (Start default), like Start on the other tabs. While a start or stop runs, the switcher says Starting… or Stopping….
- **The container page agrees with its dot**: a red dot reads "Running · Unhealthy", and the failed-checks line shows once.
- **Title-row slot is for the page's main action only.** Volumes' cleanup button and Networks' Troubleshoot moved next to their table.
- **Narrow windows**: below 700 px the top bar is icons only and never scrolls sideways; Ports stay visible and CPU and Memory go instead.
- **Smaller fixes**: New profile from the switcher opens on a free name instead of an error; "Built in" tags, Setup titles and "In use by" read as labels, not links; the docker-context warning strip is amber, not red; between 701 and 900 px the icon-only sidebar no longer spills the switcher text or overlaps the page title; the stale "unhealthy badge" check now tests the plain-words status.
- **Left as they are on purpose**: quiet Restart and Stop VM, checkboxes on hover, the bulk bar at the bottom (round 5 and 6 decisions), and Kubernetes' own words for pod states.

## Review round 6: a calmer Containers screen
- **One line per container.** Name and image sit side by side. The row's checkbox and its Restart, Stop and Remove show only on hover or keyboard focus; once one row is picked, every checkbox shows. On touch screens everything stays visible.
- **The dot shows health, not just running.** Red when the health check fails or the container ran out of memory, amber when it keeps restarting, green when fine. The problem replaces the status text ("Ran out of memory"); the status moves to the tooltip.
- **One New menu** replaces the Run, Pull and Compose buttons: Run image, Pull image, Compose projects (with "3 on this Mac"). Arrow keys move through it, Escape closes it and returns focus.
- **The sidebar folds to icons** and remembers it. Icons keep their names as tooltips.
- **Quieter VM line**: no box, thin meters, the profile name lined up with the meter labels.
- **Smaller fixes**: the status column is wider so problem text is not cut; port chips never wrap; while rows are picked the row tools hide, so the bottom bar is the only place to act; Images' Pull button has the same icon style as New, and image sizes use the same number style as the Containers table.
- **Kept on purpose**: the bulk bar keeps disabled buttons in place so it never jumps; the space card on Images stays in GB to match `docker system df`.

## Review round 5: ideas from an earlier prototype, and Compose projects on your Mac
- **Kubernetes pods are protected.** With Kubernetes on the docker runtime, each pod shows up as `k8s_` containers. They now sit in their own folded "Kubernetes pods" group, named by container, pod and namespace (coredns · coredns-6799… · kube-system), with no checkbox and no stop, restart or remove, on the list or on the container page. The group links to the Kubernetes tab.
- **Pick several containers** with the new checkboxes, then Start, Restart, Stop or Remove them together. Remove asks once, names them, and says when running ones will be stopped first. Only rows you can see are acted on: filtered out, gone, or inside a folded group means left alone. The bar sits at the bottom so ticking a box never moves the rows; picked rows are tinted and the header box shows "some picked".
- **Compose projects on your Mac.** When the app opens it asks Spotlight for Compose files in your home folder (no crawling, no file contents read, hidden folders, `~/Library` and dependency folders skipped). The Compose button in Containers lists them with how many containers run from each, the `docker --context <profile> compose up -d` command shown in full with Copy, and Show in Finder. Spotlight output is read NUL-separated, relative paths are refused, Go, Python, CocoaPods and Bower caches are skipped, and the list says when it stops at 300 files. Scan again repeats it. The app never runs Compose itself.
- **Private registries in Pull**: GHCR, public and private ECR, Google Artifact Registry or any host. The panel shows the exact reference before pulling. A host with no dot or port is refused, because docker would quietly pull it from Docker Hub. The sign-in step comes before Pull (and is left out for public ECR), and its command is only offered for a valid host. The "permission denied" socket error is no longer mistaken for a sign-in problem.
- **Smaller fixes**: database port chips show just the port (no more clipped "localhost:330"); VM meters read "1.3 GiB of 8 GiB"; the sidebar shows runtime, CPU and memory; a quiet note on Containers links to Images when unused images and build cache pass 1 GiB (volumes never count); Images has a search box whose Docker Hub fallback carries what you typed; the duplicate "Remove unused" button on Images is gone.
- **Component tests**: `npm test` now also renders the Containers screen in jsdom with a fake backend (vitest and Testing Library, dev only); `npm run test:ui` runs just those.

## Review round 4: a four-person panel (product, design, engineering, blind challenger)
- **Folder mounts are safer.** Run has a Choose folder button (the native macOS chooser). Mac folders are mounted read-only unless you tick "Let the container change files here", remembered per folder. `~/Library` (any spelling) and hidden folders are refused by both the page and the backend. Named volumes stay writable.
- **Setup does only what it shows.** Fix all runs failing and warning rows only, so it no longer turns on start at login unasked. The login-service row runs the `restart` it shows. Command boxes hold real commands only; config edits are listed as plain steps. Passing checks fold into one row. New note when a Docker Desktop context exists: its images and volumes stay behind, with an export command. The Testcontainers fix now gives shell exports that work.
- **`~/.docker/config.json` is never wiped.** A fix refuses to touch a file that isn't valid JSON, writes through a temp file and rename, and keeps a uniquely named backup, whose path it reports. The install card shows the link result instead of hiding errors.
- **Space inside the VM** card on Images: build cache, images, stopped containers and volumes, with Clear build cache and Remove unused images. Volumes are never bulk removed.
- **Port links only for web ports.** Database and broker ports (3306, 5432, 6379...) show a "localhost:3306" chip that copies instead of opening a broken browser tab.
- **Polling really never overlaps** now (the first load counts as in flight), and an old error clears when you switch profiles.
- **Kubernetes** shows in the nav only when the profile has it; turn it on from Profiles. Profiles moved below Setup. Memory and disk read GiB everywhere.
- **Backend**: Cancel between a stop and a start skips the start; waits after a kill are bounded; the connection doctor's helper image is pinned to `nicolaka/netshoot:v0.16`.

## Review rounds 1 to 3: hardening, failures you can act on, and a stricter backend
- **Starts that fail say why.** A failed start or stop shows a card with the reason and the next step (Force stop, Try again), with the raw Colima output folded under "Show output". A running VM operation can be cancelled, and a second one is refused instead of racing the first.
- **Setup tab** replaces the leftover Docker Desktop checks: compose and buildx plugins, credential helper, docker context, start at login, VM size, Testcontainers. Every fix shows its exact command first and runs only on click. One count drives the sidebar badge, the home strip and the Setup intro. It also warns when your terminal's docker talks to a different Colima VM than the app.
- **Containers**: compose projects are grouped, rows have port links, and each container page has Open a shell (Terminal, `docker exec -it NAME sh`).
- **Logs** fetch only new lines (`--since`), carry a time on each line, cap at 5,000 lines, and have a real Follow toggle and Copy.
- **Empty states** say what to do: install the tools, start the VM, or create the first VM.
- **Kubernetes**: a pod that ran out of memory and recovered is a warning, not an error; an unschedulable pod is a warning.
- **Backend safety**: every `docker` call goes through a per-command flag allowlist. `docker run` is allowlisted shape by shape (detached only, named volumes or folders under your home, ports on 127.0.0.1 unless you opt in, no host network). Only Colima contexts and valid profile names are accepted. Every command has a deadline and kills its whole process group, output is capped, and streams stop after 10 minutes of silence.
- **Polling slows to every 30 seconds** while the window is hidden or unfocused, and never overlaps a request still in flight.
- **Checks**: `npm run check` builds the preview and runs every browser check, reporting a crashed script as a crash instead of a pass.

### Containers is home, a denser layout, and the "handed-back localhost" check
- **Containers is the home screen**, like Docker Desktop. The Overview is gone: the VM sits in one line at the top (state, CPU, memory and disk bars, Restart and Stop), then one table. Containers with a problem sort first and show the reason under their status; an **All / Running / Needs attention** filter narrows the table. The Overview's "Recent activity" and "Heaviest right now" were dropped; the CPU and Memory columns and each container's Activity tab cover them.
- **Port quick links**: every published port shows as a `8080 ↗` button that opens `http://localhost:8080`. A range is one button, at most three show (then "+N"), ports bound to one specific address are skipped, and the full port text is in the tooltip. Rows keep Restart, Stop and Remove.
- Also dropped with the Overview: the "stopped containers and reclaimable space" nudge.
- **Fits the default 980x640 window**: smaller type and padding, screen actions in the title row, Kubernetes summary in one line, network members as chips.
- **Connection doctor finds "handed-back localhost"** for any image, not only Kafka: settings whose names contain advertis, announce, publish or broadcast (Kafka's advertised listeners, Elasticsearch's publish host, Redis announce addresses), read from the target's environment and its startup log, with localhost, 127.0.0.1, [::1] and 0.0.0.0 all counted as loopback. When the same setting also gives a container address (a two-listener Kafka on the Mac's port), the doctor points the client at that address instead of suggesting a rewrite. Mongo replica hosts set by `rs.initiate` are not visible to it. Verified on a real Kafka and Kafka UI pair.
- **Security**: a Content Security Policy for the release build (and a looser one only for `tauri dev`).
- **Verified on a real Mac** (Colima 0.10.1, Docker 29.3.1): `cargo test` (24), `npm test` (156, including fixtures captured from real docker output), every browser check, and a release `.dmg` build.
- Checks need Playwright; if it is not installed in this repo, point `NODE_PATH` at a `node_modules` that has it.

### Shell, visual system and Overview
- New fixed-sidebar shell: only the content area scrolls (logs no longer move the page). Icon navigation, active-profile footer, status pill on every page.
- Sage palette with light and dark modes; contrast is pinned by tests (`src/lib/contrast.test.ts`).
- **Overview**: VM card with start, stop, restart and retry, CPU/memory/disk meters, searchable containers, Pull image and Run image, and a quiet "needs attention" strip.
- **Onboarding**: if Colima or Docker is missing, the Overview offers `brew install ...` (runs only on click). If Homebrew is missing it shows the official installer to run yourself.
- Cleaner Colima output: colour codes, logfmt and progress redraws are tidied; **Copy raw output** keeps the original text.
- The old "Colima" tab is now **Profiles**, with a one-line explainer.
- Row actions are labelled icon buttons; no screen scrolls sideways.

### Checks
    npm test                                    # TypeScript logic (Node 22.6+)
    cd src-tauri && cargo test                  # Rust (not run in the authoring sandbox)
    npm run preview && node scripts/check-layout.mjs && node scripts/check-home.mjs && node scripts/check-restyle.mjs   # needs playwright
Preview scenarios: `preview/index.html?scenario=running|stopped|failed|missing|partial|nobrew|none|two`.

### Review fixes (design, accessibility and code review)
- Volumes show which containers use them; in-use volumes can't be removed; bulk removal is limited to unused *anonymous* volumes, so a database's named volume is never swept up.
- Run publishes ports on `127.0.0.1` by default; "Let other devices on my network connect" opts in.
- The `docker` command the page can invoke is allowlisted (no exec, cp, build, login, privileged runs or Docker-socket mounts), and only Colima contexts are accepted.
- `main` landmark, table header scopes, modal side panels (Escape, focus trap, focus return), and muted text that meets 4.5:1 on every surface.
- More checks: `node scripts/check-volumes.mjs`, `node scripts/check-a11y.mjs`.

Not done yet: a strict Content-Security-Policy in `tauri.conf.json` (needs testing on a real machine; the allowlist above is the safety net until then).

### Guided Run (any image, no per-image rules)
The Run panel reads what the image itself declares (`docker image inspect`) and guides you:
- **Setup notes** links: the image's own documentation label, then its Docker Hub page, plus source code when declared. Links show their host and open in your browser only after a click.
- **Shared network** (`devnet`, created for you) so containers reach each other by name, with the other containers on it listed as copyable `name:port`.
- **Ports** and **Data** prefilled from the image's declared ports and volume paths, with a named volume suggested so data survives recreation.
- **Settings**: the image's built-in defaults are shown; you add your own.
- **Before you run** warnings in plain words: port or name already used, unpinned version, image built for a different CPU.
- **Show the docker run command** for transparency.
Sources are in `docs/research/2026-10-07-guided-run.md`. It will not know image-specific rules (a database's password variable, a broker's advertised address); that is what the setup-notes link is for.
Checks: `node scripts/check-guided.mjs`.

### Pull panel
Two clear steps: **1. Find** (search Docker Hub, nothing is downloaded; sort by stars, name or official first; the chosen result is highlighted) and **2. Pull** (the image named in its own field, with a Pull button that says what it will download). Official images carry an Official tag (Docker prints it as "OK", which the old code missed). Checks: `node scripts/check-pull.mjs`.

### Networks and the connection doctor
- **Networks tab**: every network with its containers and addresses; create, remove (when empty), connect and disconnect containers. A plain explanation of why containers need a network of their own (the default bridge doesn't do name lookup).
- **Connection doctor** ("Why can't one container reach another?", also on each container's new **Network** tab): pick the container that can't connect (From) and the one it should reach (To). It checks, from From's side, that they share a network, that the name resolves, and that the port answers, using a throwaway helper container (`nicolaka/netshoot`, downloaded on first use) that joins From's network, so nothing has to exist inside your own images. It also warns about settings in From that point at `localhost`, which inside a container means the container itself, and offers a corrected value to copy. One-click fix: connect the containers to a shared network.
- When every network check passes and the app still fails, it says so and links to the image's setup notes (some services hand clients a different address after the first connection).
- Not done yet: "recreate this container with the fix" (Docker can't change a running container's settings); for now copy the corrected setting into the Run panel.
- Sources: `docs/research/2026-10-08-networking-k8s.md`. Checks: `node scripts/check-network.mjs`.
- Unverified on a real machine: the helper container's `nslookup`/`nc` output and exit codes; the parsing is based on typical output and the exit markers the script prints.

### Observability
- **Needs attention** on the Overview lists containers with problems in plain words, each with an Open button: a failing health check (with what the last check said), a container that keeps restarting (3 or more restarts), a stop for using too much memory (only when Docker's own OOM flag is set; exit code 137 alone says "killed"), or an exit with an error (with the code explained).
- **Health badges** (healthy, unhealthy, starting) in the container lists; a **Health panel** on each container page with restarts, uptime, and the same explanations plus an "Open the logs" button. An image with no health check is told so plainly.
- **Activity**: a timeline of starts, restarts, deaths, out-of-memory kills and health changes. "Recent activity" on the Overview, and an Activity tab per container. It only ever runs `docker events` with a bounded time window.
- **Heaviest right now** on the Overview (top three by memory) and a **Size** column on Volumes.
- Sources: `docs/research/2026-10-09-observability.md`. Checks: `node scripts/check-observe.mjs`.
- Unverified on a real VM: the exact JSON of `docker events` and of `docker system df -v --format json` (sizes show a dash if unreadable).

### Kubernetes
- **Kubernetes tab** (Colima's K3s cluster): nodes ready, pods running, and a **Needs attention** list that says in plain words what is wrong with a pod (keeps crashing, can't download its image, couldn't be created, ran out of memory, can't be placed on a node, stuck starting, running but not ready), each with what to check, from Kubernetes' own failure states (`docs/research/2026-10-10-kubernetes.md`).
- Pods, Deployments, Services and Events views with a namespace filter. Click a pod for its problems, Kubernetes warnings, logs (with "previous run" after restarts) and a copyable `kubectl logs` command.
- **Turn on Kubernetes** from the tab when it isn't on for a profile (restarts the VM; the app says so first). **Open in k9s** opens Terminal with `k9s --context <cluster>`; kubectl and k9s each have a Homebrew install step that runs only on click.
- Read-only: the app only ever runs `kubectl get ... -o json`, `kubectl logs` and `kubectl config get-contexts`, against Colima contexts only.
- Fixed along the way: `usePoll` ignores a slow older answer once a newer request started, and the container Activity tab no longer flashes an empty message while loading.
- Checks: `node scripts/check-k8s.mjs`. Unverified on a real machine: the Kubernetes context name Colima registers, and opening Terminal through `osascript` (macOS asks permission the first time).
