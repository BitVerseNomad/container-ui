# Implementation plan

The work to turn today's repo into OpenPier 1.0, as ordered tasks. Each task is one pull request. Each says what to change, in which files, and how to prove it is done.

Read `README.md` in this folder first, then the review that a task cites (E = engineering, U = UX, P = product), then `04-design-spec.md` for anything on screen.

## Work orders win

This file is the plan. `iterations/` holds the same work as recipes, written after measuring the repo, and an implementer follows those. Where the two differ, the work order wins. Known differences:

1. **0.0 is new**: lint, `cargo fmt` and `cargo clippy` fail on today's `main`, so the first work order makes the gate pass.
2. **0.2 deletes, it does not park.** The Lima environments, their database and the AI chat are removed (git keeps them). There are no cargo features `workspaces` or `assistant` and no `src/_parked/`.
3. **0.3**: the preview is a Vite dev server on port 4173. Almost every old browser check fails against today's UI, so the failing ones wait in `scripts/checks-pending/` and each screen task brings its own back. That folder must be empty when phase 3 ends.
4. **Order in phase 0**: 0.0, 0.2, 0.3, 0.5, 0.4, 0.6 (clean the repo before renaming, so there is less to rename).
5. **0.4**: the bundle identifier is `dev.openpier.desktop` (Tauri warns about identifiers that end in `.app`).
6. **1.1** keeps `tailwind-merge`, `class-variance-authority` and `clsx` until 5.1, because the old components import them.
7. **1.3** is three work orders (1.3a, 1.3b, 1.3c). The new components live in `src/ui/op/` until 5.1 deletes the old ones.
8. **1.5**: the default threshold is half a percent, not 2. Two different mockup screens differ by only 3.7 percent of their pixels, so the pixel number is a weak proof and each screen also has a by-eye list.
9. Nothing is pushed by the implementer. Work orders are merged into the local `main`; the pull request text is a file under `iterations/pr/`.

## Rules for whoever implements this

1. **One task, one branch, one PR.** Branch name `task-<id>` (for example `task-1.3`). Do not start a task whose "Needs" are not merged.
2. **Do exactly the task.** If you find something else that is wrong, add a line to `docs/plan/FOUND.md` and carry on. Do not fix it in the same PR.
3. **The mockup is the design.** No colour, size or shadow outside `src/ui/openpier.css`. If the mockup lacks what you need, stop and say so in the PR; do not invent.
4. **Every task ends green**: `npm run lint && npx tsc --noEmit && npm test && (cd src-tauri && cargo test)`. From task 0.3 on, also `npm run check`.
5. **Never weaken a test to make it pass.** If a test is wrong, say why in the PR and change it in its own commit.
6. **Do not run commands that change the developer's machine**: no `docker rm`, `colima delete`, `brew install` and so on outside the `eval-*` sandbox (`scripts/eval-setup.sh`). The browser preview with the mocked backend is the place to see screens.
7. **UI tasks attach screenshots**, light and dark, WebKit, 1280x800, next to the mockup screenshot of the same screen.
8. **Stop and ask** when a task says "owner decision", when a step would delete user data, or when two sources in this folder disagree.
9. Commit messages: `<type>: <what the user can now do>`. No people's names in commits or code.

## Phase 0. Make it safe and buildable

Nothing visible changes in this phase. It unblocks everything else.

### 0.1 Rotate the signing key and remove it from the repo (E1)

1. Decided (P9.1): rotate the key only; the history is not rewritten. The owner does the key generation; the key never passes through an AI session.
2. Steps:
   1. Owner runs `npm run tauri signer generate -- -w ~/.tauri/openpier.key`, with a password, outside the repo.
   2. Owner adds repo secrets `TAURI_SIGNING_PRIVATE_KEY` (file content) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
   3. Put the new public key in `src-tauri/tauri.conf.json` `plugins.updater.pubkey`.
   4. `git rm private.key private.key.pub`. Add `*.key`, `*.key.pub`, `.env*` to `.gitignore`.
   5. Add one line to `SECURITY.md` (task 6.1 creates the file; until then put it in the PR text): "A signing key committed before 1.0 is public and is not trusted. Releases from 1.0 on are signed with a new key."
   6. Check that no published release can be updated with the old key: versions 0.1 and 0.2 have no working updater (E5), so there is nothing to revoke. Say so in the PR.
3. Done when: `git ls-files | grep -iE '\.key(\.pub)?$'` prints nothing; the public key in `tauri.conf.json` differs from the one in commit `61fa3df`; the old key is still in the history on purpose.

### 0.2 Take dev environments and the AI chat out of the default build (E2, E3, E4, E12, P3)

1. Decided (P9.4): the AI chat is out. Projects stay as a feature and are rebuilt on Compose in phase 7; this task parks today's Lima implementation and closes its holes.
2. Steps:
   1. Rust: add a cargo feature `workspaces` (off by default). Gate `mod lima;`, `mod projects;` and their entries in the `generate_handler!` list (`src-tauri/src/main.rs:1939-1951`) behind `#[cfg(feature = "workspaces")]`. Make `sqlx`, `uuid` and `chrono` optional dependencies enabled by that feature. Try the same for `tokio` (it is declared twice in `Cargo.toml`, lines 19 and 22; keep one). Then run `cargo build`: keep as a normal dependency any crate the default build still needs, and list which in the PR.
   2. Rust: add a cargo feature `assistant` (off by default). Gate `ollama_chat`, `ollama_list_models`, `ollama_pull` (`main.rs:830-930`).
   3. TypeScript: remove today's `Projects` page from the `Tab` type and `NAV` (`src/Shell.tsx:10-23`), and its branch in `src/App.tsx`. The nav item comes back in task 7.5 with the new page. Remove the AI panel, its shortcut and `src/Onboarding.tsx` with its CSS in `src/styles.css`.
   4. Move `src/features/projects/`, `src/hooks/useProjectTerminal.ts` and `src/ai/` to `src/_parked/` and exclude that folder in `tsconfig.json` and `vitest.config.ts`. Remove `xterm`, `@xterm/*` from `dependencies`.
   5. Inside the parked Rust code, still fix the three holes so they cannot come back by accident: delete `fs_read_text_file`, `fs_read_dir` and `get_gh_token` as commands (`lima.rs:696, 749, 760`); replace `compose_via_lima` string building (`lima.rs:262-267`) with argv; remove the token `-e` arguments (`lima.rs:409-415`).
3. Done when:
   1. `cargo build` (default features) compiles with no reference to `lima` or `projects`.
   2. `grep -rn "fs_read_text_file\|fs_read_dir\|get_gh_token\|format!(\"cd " src-tauri/src` prints nothing.
   3. `cargo test --features workspaces` passes, including a new test that the argv built for an environment contains no `TOKEN=`.
   4. The app opens on Containers.

### 0.3 Fix the browser preview and bring the checks back (E14)

1. Steps:
   1. Reproduce: `npm run preview`, open `preview/index.html`, read the console error (`preview: unknown module @tanstack/react-query`).
   2. Replace the hand-written bundler. Add `vite.preview.config.ts`: same plugins as `vite.config.ts`, `resolve.alias` mapping `@tauri-apps/api/core` and `@tauri-apps/api/event` to `preview/mock.ts`, `build.outDir: "preview/dist"`. `npm run preview` becomes `vite --config vite.preview.config.ts`; the checks start it with Playwright's `webServer`. Delete `scripts/build-preview.mjs` and the generated `preview/index.html`.
   3. Make the mock complete. In `preview/mock.ts`, an unknown command must throw `mock: unsupported command <name>`. Add a vitest that collects every `invoke("<name>"` string in `src/` and fails if the mock has no handler for it. Add the missing handlers.
   4. If the old error ("useEnv_1 before initialization") appears once the build works: `src/useEnv.ts` must not import, directly or through another file, anything that imports `App.tsx` or `Shell.tsx`.
   5. Run `npm run check`. For each failing `scripts/check-*.mjs`: if it tests behaviour that still exists, fix the selector or the app; if it tests a removed feature, delete the script. List each decision in the PR.
   6. Delete the eight unused visual-regression files and `scripts/native-interaction.test.ts` (E, P2 item 2). In `playwright.config.ts` keep only WebKit and Chromium.
2. Done when: `npm run check` exits 0 in both engines on a clean checkout.

### 0.4 Rename to OpenPier everywhere (P4)

1. Needs: 0.2 (fewer files to rename).
2. Replace, case by case (do not blind search-and-replace "colima": it is also the runtime's name):

| Where | From | To |
|---|---|---|
| `package.json` name | `colima-ui` | `openpier` |
| `src-tauri/Cargo.toml` name | `wharf` | `openpier` |
| `tauri.conf.json` productName, window title | `Wharf` | `OpenPier` |
| `tauri.conf.json` identifier | `dev.colima.wharf` | `dev.openpier.desktop` |
| `index.html` title, README, CONTRIBUTING, issue templates, `release.yml` | Wharf, Container UI, colima-ui | OpenPier |
| Storage keys `colima-ui:*`, `colima-ui.*`, `wharf:*` | | `openpier:*` |
| Temp file prefixes `colima-ui-*` (`main.rs`, `setup.rs`, `desktop.rs`) | | `openpier-*` |
| `setup.rs:174` marker | `# Added by Wharf (Testcontainers)` | `# Added by OpenPier (Testcontainers)`, and still recognise the old marker when removing |
| Repo owner in URLs (`filipesousaduty/...`, `BitVerseNomad/container-ui`) | | the final repo URL, read from one constant `REPO_URL` in `src/lib/links.ts` and `scripts/install.sh` |

3. Storage migration: at startup, once, copy every `localStorage` key with an old prefix to the new prefix, then set `openpier:migrated=1`. Unit test it.
4. Changing the bundle identifier means macOS treats it as a new app. Say so in the changelog.
5. Done when: `grep -rniE "wharf|container ui|container-ui|colima-ui|colima_ui" --exclude-dir=node_modules --exclude-dir=target --exclude-dir=.git --exclude-dir=docs .` prints only the two old-marker and old-prefix lines kept for migration, each with a comment saying why.

### 0.5 Clean the repo (E, P2)

1. `git rm`: `screenshot-*.png`, `take-all.cjs`, `take-screenshots.cjs`, `take-screenshots.js`, `test-results/`, `opencode.json`, `RESUME.md`, `TODO.md`, `CONTEXT.md`, `homebrew-colima-ui/`, `src/ui/components/Table.css`.
2. `docs/`: keep `docs/plan/`, `docs/screenshots/`, `docs/research/`. Move `docs/EVALUATION.md` to `docs/research/evaluation-kit.md` and `docs/VERIFY-ON-YOUR-MAC.md` to `docs/research/verify-on-your-mac.md`. Move `app-icon.svg` to `src-tauri/icons/`. `git rm -r` everything else under `docs/` (git keeps the history).
3. `.gitignore`: add `test-results/`, `playwright-report/`, `.freebuff/`, `*.key`.
4. Done when: the repo root holds only: `.github/`, `docs/`, `preview/`, `scripts/`, `src/`, `src-tauri/`, `test-baselines/`, `AGENTS.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `README.md`, the files task 6.1 adds later (`LICENSE`, `ROADMAP.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`), and the config files (`package.json`, lockfile, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `index.html`, `.gitignore`).

### 0.6 CI on every pull request (E13)

1. Add `.github/workflows/ci.yml` from `06-open-source-launch.md` section 3.
2. Done when: a PR shows the check, and it fails when a test is broken on purpose (prove it once, then revert).

## Phase 1. The design system

### 1.1 Ship the stylesheet, remove the others (E6, E10, U1)

1. Needs: 0.3.
2. Steps:
   1. Copy `docs/plan/design/openpier.css` to `src/ui/openpier.css`. Import it once, in `src/main.tsx`, and nothing else.
   2. Delete `src/styles.css`, `src/home.css`, `src/Shell.css`, `src/ui/tokens.css`.
   3. Remove from `package.json`: `tailwindcss`, `@tailwindcss/vite`, `tailwind-merge`, `class-variance-authority` if present, `@fontsource/inter`, `@fontsource/jetbrains-mono`. Remove the Tailwind plugin from `vite.config.ts`.
   4. Add `scripts/check-design-sync.mjs`: fails if `src/ui/openpier.css` and `docs/plan/design/openpier.css` differ. Wire it into `npm run check`.
3. The app will look worse after this PR than before it. That is expected; phases 2 and 3 rebuild each screen. Say so in the PR.
4. Done when: the build passes, one CSS file is imported, and `check-design-sync` passes.

### 1.2 Contrast check for the tokens

1. Add `scripts/check-contrast.mjs`: parse the two token blocks of `openpier.css` and compute WCAG contrast for `--fg`, `--fg-muted`, `--accent-ink`, `--ok`, `--warn`, `--bad`, `--info` on `--bg`, `--bg-sidebar` and `--bg-raised`, in both themes. Fail under 4.5:1 for the first three, under 3:1 for the state colours (they colour icons and dots, which need 3:1).
2. If a token fails, change the token in `docs/plan/design/openpier.css` (and the copy), re-run `node docs/plan/design/shoot.mjs`, and note the change in the PR. The values in the mockup were chosen by eye from the reference and have not been measured.
3. Done when: the script passes and runs in `npm run check`.

### 1.3 Build the components (design spec section 6)

1. Needs: 1.1.
2. Create in `src/ui/`, one file each, API exactly as in the spec: `Button`, `Field`, `Select`, `Switch`, `Chip`, `Tabs`, `Dot`, `Sev`, `Row`, `Problem`, `GroupCaption`, `Menu` (with `MenuItem`, `MenuSeparator`, `MenuCaption`), `Sheet`, `ConfirmDialog` with `useConfirm`, `Empty`, `SkeletonRows`, `Banner`, `Toast` with `useToast`, `Tooltip`, `Canvas`, `Command`, `Tile`, `Facts`, `Icon` (thin wrapper over `lucide-react`).
3. `src/ui/index.ts` exports all of them and nothing else. Delete `src/ui.tsx`, `src/ui/ui.tsx`, `src/ui/components/` and the legacy files in `src/ui/` as each loses its last importer (track in the PRs of phase 3; the last one is task 5.1).
4. Add a gallery page reachable only in the preview at `#/dev/gallery`: every component in every variant and state, light and dark. It is what reviewers compare with the mockup for this task.
5. Tests (vitest): each component renders its class, forwards `aria-*`, and the interactive ones work by keyboard (menu opens with Enter and arrows, sheet traps focus and restores it, confirm starts on Cancel for danger).
6. Add an ESLint rule set: `no-restricted-imports` for the old paths; forbid `style=` except in an allowlist file; forbid `<button`, `<select`, `<table` in `src/**/*.tsx` outside `src/ui/`. The screens are not migrated yet (there are about 160 `<button` in `src/*.tsx` today), so the rules skip the files listed in `scripts/not-migrated.json`. This task creates that list with every screen file in it. Each phase 3 task removes its own files from the list. The list may only shrink; `scripts/check-not-migrated.mjs` fails when a file is added to it.
7. Done when: tests pass, lint passes with the list, and `scripts/check-gallery.mjs` passes. That script screenshots `#/dev/gallery` in WebKit, light and dark, and compares each component block with the same block cut from the mockup (the method of task 1.5; if 1.5 is not merged yet, attach the two images side by side in the PR and add the script in 1.5).

### 1.4 Class check

1. Add `scripts/check-classes.mjs`: collect every string in `className=` across `src/**/*.tsx` (static strings and the branches of `clsx(...)`), split into class names, and fail if one is not defined in `src/ui/openpier.css`.
2. Files in `scripts/not-migrated.json` (task 1.3) are skipped. They will render unstyled until their phase 3 task; that is the known cost of task 1.1.
3. Done when: it passes with the list and runs in `npm run check`. This is the guard that stops a repeat of E6.

### 1.5 Compare the app with the mockup

1. Add `scripts/check-mockup.mjs`: for each pair in a table (mockup screen name, preview route, mock scenario), take a WebKit screenshot of both at 1280x800 and report the pixel difference. Use `pixelmatch`. Threshold: a number per row of the table, 2% by default, ignoring anti-aliasing. A row can name regions to mask (clocks, relative times, anything that changes between runs). When a row needs more than 5%, say why in the table.
2. The mock data in `preview/mock.ts` gets a scenario `design` with exactly the data in the mockup (the same eleven containers, five images and so on), so the comparison is fair.
3. Start with an empty table. Each screen task in phase 3 adds its rows.
4. Done when: the script runs, prints a table, and exits non-zero over the threshold.

## Phase 2. The shell

### 2.1 Routes (E9)

1. Add `src/lib/router.ts`: `useRoute()` returns `{ page, id, tab }` parsed from `location.hash`; `go(path)` sets it. The routes are: `#/projects`, `#/projects/<id>/<services|logs|ports|settings>`, `#/containers`, `#/containers/<id>/<logs|settings|stats|folders|network|history>`, `#/images`, `#/images/<id>/<overview|layers|files|settings>`, `#/volumes`, `#/networks`, `#/kubernetes`, `#/doctor`, `#/settings/<general|machines|engines|registries|updates|about>`, `#/setup`, and `#/dev/gallery` (preview only). Unknown routes go to `#/containers`. The app opens on the route it had when it closed (`openpier:last-route`), and on `#/containers` the first time (U20).
2. Replace `useState<Tab>` in `src/App.tsx`. Cmd+[ and Cmd+] call `history.back()` and `history.forward()`.
3. Tests: parse and build every route; unknown route falls back.
4. Done when: reloading the preview on `#/images` opens Images, and Back returns to the previous page.

### 2.2 Sidebar and header (design spec 5.1, 5.2, 5.4; U4, U6)

1. Rewrite `src/Shell.tsx` to the mockup's structure. Delete the shortcuts list and the Runtime select.
2. Add `<Header title summary>` with a right slot, used by every page.
3. Tauri window: `titleBarStyle: "Overlay"`, `hiddenTitle: true`, min size 900x600; drag regions as in spec section 4.
4. `check-mockup` rows: `containers` (shell only is enough at this point; mask the content area).
5. Done when: `check-mockup` passes for the shell in both themes and folded, and `scripts/check-shell.mjs` passes: at 900x600 the Doctor item is inside the viewport and a click on it opens Doctor (U21).

### 2.3 Engine switcher, on today's data (design spec 5.3; U5)

1. Build `<EngineSwitcher>` against an `Engine[]` list. For now the list is built from Colima profiles only (one engine per profile, `kind: "colima"`). Task 4.1 widens the source without touching this component.
2. Remove the profile box and every other place a profile is picked.
3. Done when: starting, stopping and switching a Colima machine works from the switcher in the preview scenarios `running`, `stopped`, `two`.

### 2.4 Command palette, Help, Activity (design spec 6.12, 5.2)

1. Restyle the palette to `.palette`; add container and image results and per-thing actions.
2. Help dialog with the shortcuts table from spec section 10, generated from the same array that registers the shortcuts (one source).
3. Activity sheet from today's `Commands.tsx`.
4. Replace the shortcut set with spec section 10.
5. Done when: each shortcut in the table works in the preview (one browser check walks the table).

## Phase 3. The screens

Every task here: rebuild the screen with `src/ui` components only, to its section of the design spec; cover the eight states of spec section 8 with mock scenarios; add its rows to `check-mockup`; keep or update its `scripts/check-*.mjs`; attach screenshots. A screen is done when its mockup comparison passes in light and dark and its checks pass in both engines.

| Task | Screen | Spec | Files today | Fixes |
|---|---|---|---|---|
| 3.1 | Containers | 7.1 | `src/Containers.tsx`, `src/ComposeProjects.tsx`, `src/VmStrip.tsx` | U3, U7, U8 |
| 3.2 | Container detail | 7.2 | `src/ContainerDetail.tsx`, `src/Logs.tsx`, `src/StatsTab.tsx` | U11 |
| 3.3 | Run, Pull, Compose start sheets | 7.10 | `src/RunPanel.tsx`, `src/RunPicker.tsx`, `src/PullPanel.tsx`, `src/ComposeLogs.tsx` | U2 |
| 3.4 | Images | 7.3 | `src/Images.tsx`, `src/DiskCard.tsx` | U9 |
| 3.5 | Volumes | 7.4 | `src/Volumes.tsx` | U9 |
| 3.6 | Networks and Test a connection | 7.5 | `src/Networks.tsx`, `src/ConnectionTest.tsx` | U10 |
| 3.7 | Kubernetes | 7.6 | `src/Kubernetes.tsx`, `src/PodDrawer.tsx` | U12 |
| 3.8 | Doctor | 7.7 | `src/Doctor.tsx`, `src/FixIt.tsx` | U13 |
| 3.9 | Settings (General, Machines, Engines, Updates, About) | 7.8 | `src/Profiles.tsx`, `src/Resize.tsx`, `src/EditPanel.tsx` | U6, U19 |
| 3.10 | Setup | 7.9 | `src/Setup.tsx`, `src/InstallCard.tsx`, `src/InstallTool.tsx` | |
| 3.11 | Bring volumes over (as a Doctor finding and a sheet) | 7.7 | `src/BringOver.tsx` | |

Notes per task:

1. **3.1** Keep `VmStrip`'s failure handling ("when a start or stop fails, the app says why and offers the next step") but show it as the `machine-stopped` empty state or an error banner, not as a strip.
2. **3.2** Tab names change (Inspect to Settings, Mounts to Folders, Activity to History). Update the checks and the README.
3. **3.3** These become `Sheet`s. Today they render in the page flow (U2). The port-in-use suggestion and the plain-words error already exist in `src/lib/guided.ts` and `src/runArgs.ts`; reuse them.
4. **3.5** The header button is `Remove unused…` for all unused volumes, behind a confirm that lists them. Today's "Remove unused anonymous (1)" becomes a tick box inside that confirm ("Only volumes with no name").
5. **3.9** "Profiles" becomes "Machines" in every string the user sees. Internal names can stay. Theme: System (default), Light, Dark, saved as `openpier:theme`. A small inline script in `index.html` sets `data-theme` on the root before the first paint, from the saved choice or, for System, from `matchMedia("(prefers-color-scheme: dark)")`, and listens for changes. Check: with no saved choice, the preview opened in WebKit with `colorScheme: "dark"` has `data-theme="dark"`. Updates: a "Check for updates" button (plugin from task 6.2).
6. **3.11** Do not redesign the copy flow. Re-skin it and move its entry point.

Findings that are closed by an earlier task and not by one screen: U1 by 1.1; U4, U5, U21 by 2.2 and 2.3; U14, U15, U16 by the components of 1.3 (focus ring, `Empty`, `SkeletonRows`, `Banner`) and then by the eight states each screen task must cover; U17 by 0.2; U18 by 2.4; U20 by 0.2 and 2.1. Before closing phase 3, read U1 to U21 once more and tick each against the app.

## Phase 4. Engines

### 4.1 Engine and Machine in the backend (E8)

1. Needs: phase 3 (so UI churn and backend churn do not collide).
2. Rust, new `src-tauri/src/engine.rs`:
   1. `list_engines()` runs `docker context ls --format '{{json .}}'`, parses each line, classifies `kind` with one table (context name and endpoint path), probes reachability with `docker --context <name> version --format '{{.Server.Version}}'` under a 3 second deadline, in parallel.
   2. Keep the set of known context names in app state, refreshed by `list_engines`.
   3. `context_ok(c)` (`main.rs:398-400`) becomes: `c` is in that set and matches `^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$`.
3. Tests: one per row of the classification table; `context_ok` refuses a name that is not in the set, a name with a space, a name starting with `-`.
4. Kubernetes: `kubectl` is allowed only with the kube context the engine declares (Colima's today). Other engines show no Kubernetes item.
5. Done when: `cargo test` passes and, by hand on a Mac with Docker Desktop or OrbStack running and Colima stopped, `list_engines` returns it as reachable. Record the hand check in the PR; it cannot be automated in CI.

### 4.2 Engines in the frontend (E7, E8)

1. Replace `src/runtime/*` with `src/lib/engines.ts`: `useEngines()` (a query on `list_engines`, every 5 seconds), `useEngine()` (the selected one), `selectEngine(id)`.
2. Default at startup: the saved `openpier:engine` if it still exists, else the first reachable engine, else the first engine. This fixes E7.
3. Replace `ctxFor(profile)` (`src/api.ts:28`) and every `profile` argument passed to docker calls with `engine.id`.
4. Machine driver for Colima only: `src/lib/machines/colima.ts` wraps today's `list_profiles`, `start_profile`, `stop_profile`, `apply_resources`, `delete_profile`.
5. Delete `docker-desktop-adapter.ts`, `podman-adapter.ts`, `rancher-adapter.ts`, `orbstack-adapter.ts` and the `orb_*`, `rdctl_version`, `podman_version`, `docker_desktop_version` commands.
6. Gate Colima-only code on `engine.kind === "colima"`: `src/lib/bringOver.ts`, `src/lib/setup.ts`, `src/lib/mounts.ts`, VM checks in `src/lib/doctor.ts`. Each Doctor check gets `appliesTo: EngineKind[] | "all"`.
7. Mock scenarios: `desktop-only`, `orbstack-only`, `colima-and-desktop`.
8. Done when: in scenario `desktop-only` the four resource pages list data, the switcher shows no Start or Stop for it, Settings has no Machines section, and Doctor shows only checks that apply.

### 4.3 One data layer (E9)

1. Convert each `usePoll` call to `useQuery` with key `[engineId, name]`. Each call keeps the interval it has today (the key table in WO-4.3 lists them). Convert each action to `useMutation` that invalidates its list.
2. Delete `usePoll`, the `setInterval` in `src/App.tsx:107`, and the `runtime-changed` window event.
3. Done when: `grep -rn "usePoll\|setInterval" src --include=*.ts --include=*.tsx` shows only timers that are not data loading, each with a comment.

## Phase 5. Remove what is dead

### 5.1 Delete the legacy UI

1. Delete the old component set (`src/ui/*` outside `src/ui/op/`, `src/ui/components/`, `src/ui.tsx`, `src/ui/icons.tsx`, and the old `Tab`), then move `src/ui/op/*` up to `src/ui/`. It needs `scripts/not-migrated.json` to hold no screen; if it does, stop and report.
2. Done when: `npx tsc --noEmit` passes and `npx knip` (add it as a dev dependency) reports no unused files or exports in `src/`.

### 5.2 Split `main.rs` (E11)

1. Move code, do not change it: `exec.rs`, `allow.rs`, `engine.rs`, `colima.rs`, `compose.rs`, `kube.rs`, `system.rs`, `tools.rs`. Tests move with their code.
2. Done when: `cargo test` shows the same number of tests passing as before the move, and `main.rs` is under 200 lines.

### 5.3 Docs match the app

1. Rewrite `AGENTS.md`: the eight UX rules stay; add "the design is `docs/plan/design/`"; replace the README step with `node scripts/readme-shots.mjs`.
2. `CHANGELOG.md`: one entry for 1.0 that says what changed for a user.
3. Done when: no current doc mentions a file that does not exist (`scripts/check-doc-links.mjs` greps backticked paths in the docs WO-5.3 lists and tests each exists). The old notes under `docs/plan` are history and are not checked.

## Phase 7. Projects

Tasks 7.1 to 7.8 are in `07-projects-spec.md`, section 12. They need phase 4 (engines). Task 7.8, the two-project test, is the definition of done for the feature.

## Phase 8. What a reference app needs

Tasks 8.1 to 8.15 are in `08-feature-gaps.md`, section 8, with what each needs. They are part of the first release.

## Phase 6. Release

Phase 6 runs last, after phases 7 and 8.

Tasks 6.1 to 6.6 are the sections of `06-open-source-launch.md`: licence and community files, the release workflow, the install script, the README and its screenshots, signing, and the launch checklist.

## Order and what can run in parallel

1. Phase 0 tasks are independent of each other except 0.4 needs 0.2. Do 0.1 first: nothing may be published before it.
2. Phase 1 is serial (1.1, then 1.2 to 1.5 in any order).
3. Phase 2 is serial.
4. Phase 3 tasks are independent once 2.2 is merged; two people or agents can take different screens. 3.1 first, because the others copy its patterns.
5. Phase 4 after phase 3. Phase 5 after phase 4. Phases 7 and 8 after phase 4, and they can run side by side. Phase 6 documents (6.1, 6.2) can start any time after 0.4; the launch (6.6) is last.

## Size

High-level only, for one experienced person or a supervised agent, in working days. These are estimates from reading the code, not from doing the work.

| Phase | Days |
|---|---|
| 0 | 3 to 5 |
| 1 | 4 to 6 |
| 2 | 3 to 4 |
| 3 | 10 to 15 |
| 4 | 4 to 6 |
| 5 | 2 to 3 |
| 6 | 2 to 4 |
| 7 Projects | 8 to 12 |
| 8 Reference gaps | 20 to 28 |
| Total | 56 to 83 |

## What this plan does not cover

1. Real-machine verification of the October features (`docs/research/evaluation-kit.md`). Do it after phase 3, before the public launch.
2. A usability session with real engineers (P8.1).
3. Machine drivers for runtimes other than Colima, Windows and Linux builds, image build, and the rest of `08-feature-gaps.md` sections 4 and 5. All after the first release, in `ROADMAP.md`.
