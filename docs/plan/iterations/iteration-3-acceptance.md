# Iteration 3: acceptance checklist

Walk this after `sh docs/plan/iterations/verify-iteration-3.sh` prints `failed: 0`. A pass of the script and a fail here means the iteration is not done.

Setup for every screen: run `npm run preview`, open `http://localhost:4173/?scenario=design#/<route>` in WebKit at 1280x800, and put the matching picture from `docs/plan/design/shots/` beside it. Do light and dark. Pixel numbers are a weak proof (two different mockup screens differ by under 4 percent), so the eye test below is the real one.

## Checks that apply to every work order

1. `scripts/not-migrated.json` only lost entries. `git diff main -- scripts/not-migrated.json` shows only deleted lines.
2. Open `scripts/dropped-checks.json`. Each entry has a reason that is a changed word or a removed feature, never "flaky" or "slow". More than three for one work order is a weakened check.
3. For each ported check, compare `scripts/check-baselines/<name>.messages.txt` with the new script. Spot-check five conditions: none is `true`, none is commented out, none was loosened from an exact match to `.test(...)` of a vague word.
4. `scripts/mockup-pairs.json`: every row for this iteration has `threshold` 0.005. A masked row names only the live text in `why` (the one other mask is the Settings pair's machine name and facts, because the preview machine is `colima`). Masks do not cover rows or buttons.
5. No colour, size, shadow or icon that is not in `src/ui/container-ui.css`. `git diff main -- src/ui/container-ui.css` is empty (the stylesheet is the design; only the author changes it).
6. No `TODO`, `FIXME`, commented-out code, or `skip` in tests. `git diff main | grep -nE '^\+.*(\.skip|it\.todo|xit\()'` prints nothing.
7. Every new `.test.ts` and `.test.tsx` name reads Given, When, Then. Tests were committed before the code (the commit order shows the failing tests first).
8. The PR text file `docs/plan/iterations/pr/wo-<id>.md` exists, has all six headings, lists "Not done or changed" honestly, and has screenshots in both themes.
9. Imports of new components are `from "./ui/op"`, not the old index.
10. Words: sentence case, no full stop on labels or buttons, buttons are verbs, and no `Profile`, `Runtime`, `Context`, `Inspect`, `Down` in anything the user reads.
11. Open the screen with each of these and look: `&slow=1500` (four grey skeleton rows), `&blank=<list>` (a centred empty state), `?scenario=stopped` (`{name} is stopped. Your containers and data are kept.` and a blue Start button), type `zzzz-no-match` (`Nothing matches "zzzz-no-match".` and `Clear search`). For not reachable, open the browser console and run `__mock.unreach(true)`: a red banner appears with `Try again`, and the rows stay.

## WO-3.4 Images

Open `#/images`. Compare with `images-light.png`, `images-dark.png`.

1. A small caption `Space inside the VM`, then four tiles in a row: Build cache, Images, Stopped containers, Volumes.
2. The first two tiles have a small button inside (`Clear`, `Remove unused`). The last two have only a blue link (`Show in Containers`, `Show in Volumes`). No button on Volumes, ever.
3. Header: `Images`, `5 · 1.6 GB`, a search field, and one blue button `Pull`.
4. Each row, left to right: image icon, name with a grey `:tag`, grey used-by text, the short ID in the mono font, size, age, a `Run` button, `⋯`. The ID, size and age columns line up down the list.
5. `⋯` has `Pull again` (with its hint), `Copy name`, a line, `Remove…`. For `nginx` the Remove item is greyed with `Used by web. Remove web first`.
6. Click `Clear`: a confirm that says `build cache`, then a toast `Freed 3.4 GB from build cache.` and the button greys.
7. The sentence about the VM disk file not shrinking is inside the confirm, not on the page.
8. `src/DiskCard.tsx` is gone.

Cheats: the tiles drawn with inline styles; a `<table>`; the check for `check-disk` now only checks that a card exists; `Clear` that does not ask first; Containers or Volumes tiles that got a prune button.

## WO-3.5 Volumes

Open `#/volumes`. Compare with `volumes-light.png`, `volumes-dark.png`.

1. Two captions in this order: `In use`, `Not used`.
2. Names with no name show eleven letters, `…` and a grey `no name`. `pgdata-old` shows `Last used by a container that was removed`.
3. No main button on any row. Only `⋯` at the right. Sizes line up.
4. Header: `Volumes`, summary, search, one default button `Remove unused…`. No blue button on this screen.
5. Click `Remove unused…`: a confirm states how many volumes and the total size, and how many of them have no name. It has one tick box, `Only volumes with no name`. Confirm with it ticked: only the no-name volumes are removed (check the list afterwards).
6. `⋯` on `mysql-data` shows `Remove…` greyed with `Used by db. Remove db first`. There is no `Show what's inside` item (not built, see the author's notes below).
7. No sort, filter or select controls anywhere.

Cheats: the confirm that removes without listing; "Only volumes with no name" that is always on; the lock rule dropped (`Waits for what is changing Docker now.` must still appear while a Fix runs); `check-volumes` lines turned into `true`.

## WO-3.6 Networks and Test a connection

Open `#/networks`. Compare with `networks-light.png`, `networks-dark.png`, then click `devnet` and compare with `network-sheet-light.png`.

1. Captions `Yours` and `Built in`. `devnet` shows four grey chips and a `+2` chip, then `172.18.0.0/16` in the mono font.
2. `bridge`, `host`, `none` have a `Built in` chip.
3. Under `bridge`, a yellow-tinted line: `kafka-ui can't find other containers by name here. Put containers that talk to each other on a network of your own.` with a small button `Move to devnet…`.
4. There is no paragraph of teaching text anywhere on the page.
5. Header: `Networks`, count, search, default `Test a connection`, blue `New` (opens a sheet with the name field and its options).
6. The sheet: members with an address and a small ghost `Disconnect`, a caption `Add a container`, a select and `Connect`, and the muted hint `Connecting only adds. Nothing is restarted.`.
7. `Test a connection` opens a sheet with From, To, Port, `Check`, then steps with ticks and crosses. For `kafka-ui` to `kafka` it says they do not share a network and offers `Connect kafka-ui to devnet`.

Cheats: the test sheet shows fewer steps than before; the localhost warning or the setup-notes link was dropped; the problem line shows on `bridge` all the time (it must depend on a container that is only on `bridge`).

## WO-3.7 Kubernetes

Open `#/kubernetes/pods`. Compare with `kubernetes-light.png`, `kubernetes-dark.png`.

1. Header summary reads `1 node · v1.30.2+k3s1 · 3 of 6 pods running`. A namespace select showing `All namespaces`, and `Open in k9s`.
2. Four chip tabs, Pods selected. The address changes with the tab.
3. Group captions `Need attention · 4` and `Running · 2`. Dots: two red, two yellow, then two green.
4. The state words are the problem's own words: `Keeps crashing and restarting`, `Can't download its image`, `Can't be placed on a node`, `Restarted after running out of memory`, `Running`. A pod that is Running but restarted after running out of memory sits under `Need attention` with its yellow dot. No `CrashLoopBackOff` visible; hover shows the raw status.
5. Columns: name, namespace, ready, status, restarts, age line up.
6. Click a pod: a sheet with the plain-words title, `What to check`, `Last events`, and logs with `Copy kubectl logs command`.
7. The old "Needs attention" block above the table is gone.
8. With Kubernetes off, an empty state offers `Turn on Kubernetes`; without kubectl it shows `brew install kubectl`.

Cheats: raw reasons in the status column; the pod sheet without events or logs; a `dropped-checks.json` entry for `check-k8s` left after WO-3.9.

## WO-3.8a Doctor

Open `#/doctor`. Compare with `doctor-light.png`, `doctor-dark.png`, and for See why with `problem-inspector-light.png`.

1. Header: `Doctor`, `Checked n seconds ago`, one default button `Check again`.
2. Groups `Needs action · 2` and `Worth knowing · 3`. Below them two folded lines, each a chip button with a chevron: `Passed · 14` and `Hidden by you · 1`. Click one: it unfolds and the chevron turns down.
3. Each finding is two lines: a dark title, a grey evidence line you can select. An icon at the left, one button, `⋯` at the right.
4. The first group's buttons are blue and end with `…` (`Fix kafka and kafka-ui…`, `Install Compose…`). The yellow group's are default (`Show how`, `Open Images`).
5. `Show how` opens a sheet with the explanation and a copyable command. No command text sits on a row, folded or not.
6. `⋯` has `Not an issue` and `Run it yourself`. Hide a finding: it moves into `Hidden by you`, and can be brought back.
7. The number in the sidebar badge equals the number of rows under `Needs action`.
8. With nothing wrong: a check icon, `Nothing needs action`, and a passed count.
9. Container problems are still not counted here, and a line says where they are.

Cheats: raw `Or run it yourself` blocks left unfolded; commands with `rm -f` (a check asserts none); a Fix that runs without a confirm; the badge and page disagree; `check-netfix` lines about DNS, VPN and proxy missing from the baseline match.

## WO-3.8b Fix and health pieces

In Doctor, click `Fix kafka and kafka-ui…` and confirm.

1. A line appears under the row: blue dot, plain words, button `Fixing…` disabled.
2. Then a green tick, `Fixed.`, and a `Done` button. `Done` puts the row back to normal.
3. In Containers, the sidebar and row Stop buttons are disabled during the fix.
4. Compare the tint and spacing of this line with the problem lines in `containers-light.png`: same look.

Cheats: a test assertion value changed in `src/Health.test.tsx` (only a query may change); the count of passing tests dropped.

## WO-3.9 Settings

Open `#/settings/machines`. Compare with `settings-machines-light.png`, `settings-machines-dark.png`.

1. A left list: General, Machines, Engines, Updates, About. Machines is selected. The address changes with the section.
2. A grey sentence and a blue `New machine` on the right. Two rows: `default` (green dot, `Running`, `Stop`) and `work` (grey dot, `Stopped`, `Start`).
3. Under a machine's name: `CPU` (`Your Mac has 10. Changing it restarts the VM.`), `Memory`, `Disk`, `Kubernetes` with a switch, and `Shared folders`. Changing CPU shows `Apply and restart…`, which asks first.
4. There is no `Start when I log in` row: the design dropped it (task 8.12 adds two rows to General instead). Nothing is masked for it.
5. The word `Profile` appears nowhere in the app. Search the screens by eye: Doctor, Containers, Kubernetes, menus.
6. General: choose Dark. The app turns dark at once. Reload: no white flash. Choose System with the Mac in dark mode: dark.
7. Engines lists the contexts, marks the current one, and says how to add one with `docker context create`.
8. Updates shows the version only. About shows version, `License` `MIT`, and three links (Repository, Changelog, Discussions).
9. Start a machine from the stopped Containers page: the strip above the list (`VmStrip`) is now a banner with real buttons, same words as before.
10. Resize flow (Doctor, `Give the VM ... GiB…`): spinner, one status line, result row with `Dismiss`, same behaviour as before.

Cheats: `src/VmStrip.tsx` still on the not-migrated list; `Start at login` or `Check now` drawn but doing nothing; `Profile` kept in a string; the word `Licence`; a storage key renamed again (WO-0.4 did it); `src/EditPanel.tsx` still present.

## WO-3.10 Setup

Open `/?scenario=missing#/setup`. Compare with `setup-light.png`, `setup-dark.png`.

1. No sidebar. One centred column about 520 px wide.
2. Title `Set up containers on this Mac`, the lede, four steps: Homebrew, Colima, Docker command line tools, Start the first machine.
3. Done step: green tick. Running step: blue dot and `Show output`. To do: grey dot.
4. A blue `Install and start` and a ghost `Use Docker Desktop instead`. The hint line sits under them in grey.
5. With no Homebrew (`nobrew` scenario) the first step offers `Open Terminal to install Homebrew`.
6. When the engine answers, the screen closes and Containers opens.
7. The Docker Desktop leftovers and Bring over are not on this screen; they are in Doctor.

Cheats: the install-card lines of `check-containers.mjs` deleted without a matching line in `check-setup.mjs` (read `dropped-checks.json`: each must say `moved to check-setup.mjs`); Containers still showing the old install card; the Fix all list still on Setup; `useSetup` or `useSetupActions` no longer exported (Doctor breaks).

## WO-3.11 Bring over

Open Doctor (`?scenario=desktop#/doctor`), click `Bring it over…` on its finding. Compare the frame with `run-sheet-light.png` and the confirm with `confirm-dialog-light.png`.

1. A right-hand sheet. The head has a title and a close button. The foot has one blue main button.
2. Volumes are listed as rows with sizes; images are not picked by default; a volume Colima already has cannot be picked.
3. The copy shows one bar under the item being copied; `Stop` replaces the main button while it runs; after it, `Done`.
4. A stopped container is started again in one click.
5. The replace confirm lists what is replaced and the backup name.
6. The empty Containers page has no `Bring over` button, and the `New` menu has no such item.
7. `scripts/checks-pending/` has no `check-*.mjs`.
8. The `BringOver` tests pass with the same count as before the work order.

Cheats: the copy flow changed (order of steps, the stop and start of containers, the backup name); an `aria-*` attribute lost (the a11y check lists them); a `check-bring-home` line removed instead of its condition flipped.

## The whole iteration, once

1. Walk the app from first load: Setup, Containers, Images, Volumes, Networks, Kubernetes, Doctor, Settings. No screen has an old-style table, a grey native button or a stray unstyled control.
2. Check the dark theme on each screen at least once.
3. Read the "Not verified" and "Open for the author" notes in the PR text files. For each, decide: confirm, or send back to the plan.

## Reconcile notes

1. `check-netfix.mjs` comes back in WO-3.8a (the table in `scripts/checks-pending/README.md` names it), because it tests Doctor findings.
2. `check-bring-home.mjs` and the other bring-over checks stay in `scripts/checks-pending/` until WO-3.11. Bring over is built once, there.

## Author's notes (decisions only the author can make)

1. Volumes: `Show what's inside` is in spec 7.4 and not built (no backend command, feature G6).
2. Settings: `Start at login`, `Check for updates automatically` and `Check now` are in spec 7.8 and not built here (tasks 8.12 and 6.2).
3. Engines: runtime, address and "answers" wait for `list_engines` (task 4.1).
4. Words the author accepted from the work orders (not in the spec): empty titles `No images yet`, `Pull an image`, `No volumes yet`, `No networks yet`, `No pods`; the Volumes confirm; `{n} checks passed` under `Nothing needs action`. Still open: the New machine field that holds the old `runtime` label (spec 9 bans the word and names no replacement).
