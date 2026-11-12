# Engineering review (principal engineer)

Reviewed on 2026-11-12, at commit `61fa3df` on `main`, plus the uncommitted changes in the working tree.

Method: static read of the code and git history, and screenshots of every screen in WebKit with the mocked backend. No tests, builds or container commands were run for this review, so every test count below is what the repo's own docs claim, not a result from this review.

Severity: **P0** blocks any public release. **P1** blocks calling it 1.0. **P2** is cleanup.

## Verdict

The Rust core that was built in October is good: argv-only command execution, per-command allowlists, deadlines, process-group kills, 138 tests. That is the asset to protect.

Three things were added on top of it in November and they are what hurts today:

1. A UI migration that deleted the stylesheet before the screens stopped using it. This is why the app looks broken.
2. A "Projects" feature (dev environments on Lima) that bypasses the safety model the README promises.
3. A multi-runtime layer that is mostly stubs, wired so that the profile list never loads at startup.

The fix is not a rewrite. It is: close the security holes, finish one runtime model properly, rebuild the UI on one design system (see `04-design-spec.md`), and delete what is dead.

## P0: security

### E1. A private key is committed to a public repository

1. Fact: `private.key` (348 bytes) and `private.key.pub` are tracked in git, added in commits `f2c3de5` and `cbb1227`, and are on `origin/main` of the public repo `BitVerseNomad/container-ui`.
2. Fact: `src-tauri/tauri.conf.json:31` configures an updater public key. This review did not open the key file, so it is not confirmed that the two are a pair, or whether the private key has a password.
3. Risk if they are a pair: anyone can sign an update that every installed copy will accept.
4. Prescription:
   1. Treat the key as leaked. Generate a new pair with `npm run tauri signer generate -- -w ~/.tauri/openpier.key` and a strong password. Never write it inside the repo.
   2. Put the new public key in `tauri.conf.json`. Store the private key and its password as GitHub Actions secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
   3. `git rm private.key private.key.pub`, add both names and `*.key` to `.gitignore`.
   4. The old key stays in history. Since the repo is being renamed anyway (see `03-review-product.md`), the clean option is a fresh repository with a squashed history. The other option is `git filter-repo --path private.key --path private.key.pub --invert-paths` and a force push. Either way the old key is dead once the public key in the app changes.
   5. Releases v0.1.0 and v0.2.0 were built with the old public key. They cannot auto-update to a build signed with the new key. Say so in the release notes: "reinstall once".
5. Done when: `git ls-files | grep -iE '\.key(\.pub)?$'` prints nothing, and a release build verifies an update signed by the CI secret.

### E2. The webview can read any file on the Mac

1. Fact: `src-tauri/src/lima.rs:760` `fs_read_text_file(path)` returns the content of any path. `lima.rs:749` `fs_read_dir(path)` lists any directory. Both are `#[tauri::command]`, so the page can call them.
2. Fact: the README says "The page can only ask the backend for allowlisted commands". This is no longer true.
3. Prescription: delete both commands. `project_detect_config` (`lima.rs:812`) already runs in Rust and can read the three files it needs itself (`.devcontainer/devcontainer.json`, compose files, `Dockerfile`), from a path that passed the same home-folder check the Run panel uses (`run_args_ok` in `main.rs`).
4. Done when: grep for `fs_read_text_file` and `fs_read_dir` in `src/` and `src-tauri/src/` returns nothing, and a Rust test proves `project_detect_config("/etc")` is refused.

### E3. The GitHub token is exposed twice

1. Fact: `lima.rs:696` `get_gh_token` is a `#[tauri::command]`. It returns the output of `gh auth token` to the page.
2. Fact: `lima.rs:409-415` puts the same token in `-e GH_TOKEN=<token>` and `-e GITHUB_TOKEN=<token>` in the argv of `docker run`. Process arguments are visible to every process on the machine (`ps`), and they are stored in the container's config (`docker inspect`).
3. Fact: this happens for every project environment, with no question asked.
4. Prescription:
   1. Remove `get_gh_token` from the command list. The page never needs the token.
   2. Make credential sharing opt-in per project, off by default, with a sentence that says what is shared.
   3. When on, pass secrets with `--env-file` pointing at a file created with mode `0600` in a private temp dir and deleted after `docker run` returns. Never in argv.
   4. `SSH_AUTH_SOCK` (`lima.rs:388`) is passed as an env var but the socket is not mounted, so it does nothing. Either mount the agent socket properly or remove the line.
5. Done when: a Rust test asserts that no argv built by `project_env_create` contains the substring `TOKEN=`.

### E4. One shell string is built by concatenation

1. Fact: `lima.rs:262-267` `compose_via_lima` runs `sh -c "cd {project_path} && docker compose {args}"`. The path is not quoted. A folder named `x; rm -rf ~` runs as a command inside the VM.
2. Prescription: pass the directory as an argument, not as text: `limactl shell --workdir <path> <instance> docker compose <args…>`, every piece its own argv element. This is the rule the rest of the backend already follows (`main.rs:99-122`).
3. Done when: grep for `format!("cd ` in `src-tauri/src/` returns nothing.

### E5. The updater cannot work as wired

1. Fact: `tauri.conf.json:33` expects `{{target}}/{{current_version}}.json` on the release.
2. Fact: `.github/workflows/release.yml:163-191` writes `latest.yml` instead, with `signature: ""`, with file names that start with `Container%20UI_`, and with `${VERSION}` in a step that has no `env:` block (so it is empty).
3. Fact: `createUpdaterArtifacts` is not set in `tauri.conf.json`, and `TAURI_SIGNING_PRIVATE_KEY` is not passed to the build. So no signed update bundle is produced at all.
4. Fact: the updater plugin is not installed. `src-tauri/Cargo.toml` has no `tauri-plugin-updater` and no capability grants `updater:*`. The app never checks for updates, whatever the config says.
5. Prescription: install the plugin, then replace the hand-written manifest with what `tauri-apps/tauri-action` generates. Both are in `06-open-source-launch.md`, section 4.
6. Done when: installing version N, then publishing N+1, makes the app offer the update and apply it.

## P0: the app is visibly broken

### E6. The stylesheet was deleted while the screens still use it

1. Fact: `src/styles.css` was 60,656 bytes at commit `e103e1e` (2026-10-31). Commit `5defa01` ("Phase 8 Task 1 - Onboarding Tour", 2026-11-05) removed 887 lines. It is 2,696 bytes today.
2. Fact: the screens still use the old class names (1,181 `className="…"` strings in `src/**/*.tsx`). With no rules behind them, the browser draws native grey buttons, unstyled tables and overlapping text. See `02-review-ux.md` for the screenshots.
3. Fact: `src/ui/components/Table.css` (248 lines) is not imported anywhere.
4. Prescription: do not restore the old CSS. Rebuild on the one design system in `04-design-spec.md`. The implementation plan (`05-implementation-plan.md`) migrates screen by screen and ends with a check that fails the build when a `className` string has no rule in `src/ui/openpier.css`.

### E7. The profile list never loads at startup

1. Fact: the runtime registry starts with no active adapter (`src/runtime/index.ts:12`). `setActive` is only called when the user changes the runtime picker (`src/Shell.tsx:75`). `reloadProfiles` in `src/App.tsx:91-103` does nothing while the active adapter is null.
2. Not run: this is from reading the code. Confirm on a real launch.
3. Prescription: the registry picks a default as soon as detection finishes (the last one used, saved in `localStorage`, else the first available). See the runtime model below.

## P1: architecture

### E8. Replace five adapters with two layers: Engine and Machine

Today there are five adapters (`src/runtime/*.ts`). One works (Colima), one is partial (OrbStack), three throw "Not yet implemented". None of their methods except `isAvailable` and `getVersion` is called outside `src/runtime/`. Meanwhile the backend only accepts Colima contexts (`main.rs:398-400` `context_ok`). So "multi-runtime" is a picker in the sidebar and nothing behind it.

Every engine this app wants to support (Colima, Docker Desktop, OrbStack, Rancher Desktop, Podman, Lima) speaks the Docker API and shows up as a **docker context**. That gives a much smaller design:

1. **Engine** (universal, required): one docker context. Containers, images, volumes, networks, Compose, logs, stats and Doctor's container checks all work against any context with zero runtime-specific code. The list of engines is `docker context ls --format json`.
2. **Machine** (optional, per runtime): the VM behind the context. Start, stop, resize, delete, mounts. Only Colima has this in 1.0. A context with no Machine driver still works; the VM strip just says "Managed by Docker Desktop" with an "Open Docker Desktop" button.

Prescription:

1. `src/runtime/types.ts` becomes:
   ```ts
   export type EngineId = string;            // the docker context name
   export interface Engine {
     id: EngineId;                           // "colima", "colima-work", "desktop-linux", "orbstack", "rancher-desktop", "default"
     label: string;                          // "Colima · work"
     kind: "colima" | "docker-desktop" | "orbstack" | "rancher" | "podman" | "lima" | "other";
     endpoint: string;                       // unix:///…
     reachable: boolean;
     machine?: MachineDriver;                // undefined when the app cannot manage the VM
     kubernetes?: { context: string };
   }
   export interface MachineDriver {
     list(): Promise<Machine[]>;
     start(name: string, opts?: StartOpts): Promise<void>;
     stop(name: string): Promise<void>;
     resize?(name: string, r: Resources): Promise<void>;
     remove?(name: string): Promise<void>;
   }
   ```
2. Rust: `context_ok` stops matching the string "colima". At startup and on refresh the backend reads `docker context ls` once and keeps the set of known context names. `context_ok(c)` is "c is in that set and matches `^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$`". The set comes from Docker, not from the page, so the page still cannot invent a context.
3. `kind` is derived in one Rust function from the context name and endpoint path (`~/.colima/` → colima, `desktop-linux` → docker-desktop, `~/.orbstack/` → orbstack, `~/.rd/` → rancher, `podman` in the path → podman). One table, one test per row.
4. Delete `docker-desktop-adapter.ts`, `podman-adapter.ts`, `rancher-adapter.ts`, and the `orb_*` commands until a Machine driver is really built for them. Stubs that throw are worse than nothing.
5. Everything Colima-specific moves behind `engine.kind === "colima"`: `src/lib/bringOver.ts`, `src/lib/setup.ts`, `src/lib/mounts.ts`, the VM checks in `src/lib/doctor.ts`, `setup.rs`. Doctor checks declare which kinds they apply to.
6. `src/api.ts:28` `ctxFor(profile)` is replaced by `engine.id` everywhere.

Done when: with Docker Desktop or OrbStack running and Colima stopped, the app lists that engine's containers, images, volumes and networks, and the VM controls are replaced by the "managed by" line.

### E9. One navigation model, one data model

1. Fact: navigation is a `useState<Tab>` in `src/App.tsx:56` with conditionals at `:241-320`. There is no URL, so no back button, no deep link from Doctor to a container, and the palette cannot address a container.
2. Prescription: a 40-line hash router (no dependency): `#/containers`, `#/containers/<id>/logs`, `#/images`, `#/volumes`, `#/networks`, `#/kubernetes`, `#/doctor`, `#/settings/<section>`. `location.hash` is the single source of truth; the back and forward mouse buttons and Cmd+[ work with no extra code.
3. Fact: data loading is split between `usePoll` (22 call sites, `src/hooks.ts:6`), a hand-rolled `setInterval` (`src/App.tsx:107`) and React Query (7 `useQuery`, 24 `useMutation`).
4. Prescription: keep React Query only. Each list is one `useQuery` with `refetchInterval: 3000` and `refetchIntervalInBackground: false`; each action is one `useMutation` that invalidates the list key. Delete `usePoll` when the last caller is gone. Keys are `[engineId, "containers"]` etc., so changing engine can never show the previous engine's data.

### E10. Two of everything in `src/ui`

1. Fact: `src/ui.tsx` (115 lines) and `src/ui/ui.tsx` (110 lines) are near copies; `src/main.tsx:4` imports one and `src/ui/index.ts:21` re-exports the other. Two `ConfirmProvider`s means a confirm dialog can be opened in a provider that is not mounted.
2. Fact: `src/ui/` holds a legacy set (Badge, Button, Card, Dialog, Select, …) and `src/ui/components/` holds a new set with the same names. 31 files import the old barrel, 20 import the new one.
3. Fact: `Profile` and `StartOpts` are declared twice (`src/api.ts:4-23`, `src/runtime/types.ts:3-21`).
4. Prescription: one folder, `src/ui/`, one barrel, one component per name, as specified in `04-design-spec.md`. The plan deletes the legacy set in the same commit that migrates its last user. An ESLint `no-restricted-imports` rule bans the old paths so they cannot come back.

### E11. `main.rs` is 2,915 lines with 52 commands

1. Prescription: split by area with no behaviour change: `exec.rs` (run, deadlines, process groups), `allow.rs` (allowlists and their tests), `engine.rs` (contexts), `colima.rs` (machine), `compose.rs`, `kube.rs`, `setup.rs`, `desktop.rs`. `main.rs` keeps only the handler list.
2. Do this after E8, in one mechanical commit, with `cargo test` before and after.

### E12. The Projects feature is a second product inside the first

1. Fact: `lima.rs` (1,286 lines, 25 commands), `projects.rs` (537 lines, SQLite via sqlx, migrations), 8 React components, a terminal (xterm), port forwarding and credential injection. It manages dev environments on a Lima instance hardcoded to `default` (`lima.rs:212, 242-247, 275, 486`).
2. It carries E2, E3 and E4, it adds a database to an app that had no state, and it does not use the engine the user picked.
3. Engineering recommendation: move it behind a build flag (`--features projects`) and out of the default navigation until it runs on the selected engine and passes the same allowlist rules. The product view is in `03-review-product.md` (P3).
4. The same applies to `src/ai/` (chat on Ollama or OpenRouter, 3 backend commands): behind a setting, off by default, no network call unless the user turns it on.

## P1: quality gates

### E13. There is no CI for pull requests

1. Fact: `.github/workflows/` has only `release.yml`, and it runs no test.
2. Prescription: `ci.yml` on every PR and push to `main`: `npm ci`, `npm run lint`, `tsc --noEmit`, `npm test`, `cargo test`, `npm run check` in WebKit and Chromium. Full file in `06-open-source-launch.md`.
3. Make `main` a protected branch that requires this check.

### E14. The browser preview is broken, so the browser checks cannot run

1. Fact, seen on 2026-11-12: `npm run preview` builds, then the page fails at load with `preview: unknown module @tanstack/react-query`. The preview uses its own small bundler (`scripts/build-preview.mjs:69`) that only knows a fixed list of vendored packages, and `src/App.tsx` and `src/ui` now import packages that are not on it. (`RESUME.md` records an older, different failure: "useEnv_1 before initialization".)
2. Fact: `preview/mock.ts` is behind the code. It has no answer for `colima_version`, `orb_version`, `docker_desktop_version`, `get_home_dir`, `fs_read_dir`, `fs_read_text_file`, so runtime detection fails and Projects shows "Failed to load projects".
3. Consequence: all 26 `scripts/check-*.mjs` files and `readme-shots.mjs` depend on that preview, so "checks pass in both engines" has not been true since it broke.
4. Prescription: delete the hand-written bundler. Build the preview with Vite, using a second config that aliases `@tauri-apps/api/core` and `@tauri-apps/api/event` to `preview/mock.ts` (this is how the screenshots in `current-ui/` were taken). Add a test that fails when the app calls a command the mock does not know. Then run `npm run check` and fix or delete each failing check. This is task 0.3, before any UI work, because the UI work needs the checks.

### E15. The docs disagree on the test counts

`RESUME.md` and `docs/SPEC.md` say 98 tests, `CONTEXT.md` says 586, `docs/HIGHLIGHTS.md` says 226. Prescription: no doc states a count. CI is the only source. See P2 below for which docs to delete.

## P2: cleanup

1. **Root junk, all tracked**: `screenshot-*.png` (5 files, identical size), `take-all.cjs`, `take-screenshots.cjs`, `take-screenshots.js`, `test-results/` (7 files), `opencode.json`, `RESUME.md`, `TODO.md`, `CONTEXT.md`. Delete them and add `test-results/` to `.gitignore`.
2. **Nine visual-regression scripts** in `scripts/`; only `visual-regression.mjs` is wired. Delete the other eight and `native-interaction.test.ts`.
3. **Docs**: 12 top-level files in `docs/` plus about 70 under `docs/superpowers/` and `docs/temporary/`. They contradict each other on the name, the branch and what is done. Keep `docs/plan/` (this set), `docs/screenshots/`, and move `docs/EVALUATION.md` and `docs/research/` under `docs/research/`. Delete the rest; git keeps the history.
4. **Names**: the product is called colima-ui, Container UI and Wharf across 40+ places, and two GitHub owners appear (`BitVerseNomad`, `filipesousaduty`). The rename to OpenPier is one task with one grep-based check (plan task 0.4).
5. **Storage keys** use three prefixes (`colima-ui:`, `colima-ui.`, `wharf:`). One prefix, `openpier:`, with a one-time migration that copies old keys.
6. **Language**: `src/Onboarding.tsx:17` is in Portuguese in an English app. Onboarding was "removed" by commit `40f40cb` but the file and its CSS remain. Delete both.
7. **`playwright.config.ts`** lists Firefox and Mobile Chrome projects for a Mac desktop app that ships in WebKit. Keep WebKit and Chromium.
8. **Homebrew cask** `homebrew-colima-ui/Casks/container-ui.rb` has `sha256 "REPLACE_WITH_SHA256"`, version 0.1.0 and the wrong owner. A cask belongs in its own tap repo, generated by the release workflow. Remove the folder here.
9. **Error style**: 103 `.unwrap()` in the Rust sources. Not urgent; when splitting `main.rs` (E11), replace the ones on I/O and JSON with `?` and a plain-words message.

## What to keep exactly as it is

1. `exec` with argv arrays, `EXEC_DEADLINE`, `OUTPUT_CAP`, process-group kill (`main.rs:39-122`).
2. `docker_args_allowed`, `run_args_ok`, `kubectl_args_allowed`, `validate_install` and their tests.
3. The Doctor engine (`src/lib/doctor.ts`, `src/guidance/`) and the replace-with-rollback fix flow. This is the product's edge.
4. The mocked preview and the per-engine browser checks, once E14 is fixed.
5. Tauri. See the decision record in `README.md` of this folder.
