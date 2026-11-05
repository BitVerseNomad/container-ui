# Spec: what is left to do

Status date: 2026-10-23 (backend facts below; the backlog items keep their original wording). Read `README.md` for what exists today and `docs/SUMMARY.md` for the Oct 11 snapshot. Work on branch `integration`. Effort: S under a day, M a few days, L a week or more.

## 1. Product
**One line:** a Colima/Docker desktop app that explains what is wrong in plain words and fixes the common mistakes, instead of only listing containers.

**Principles (non-negotiable)**
1. Guide plainly; no unexplained jargon, no "clever" automation. Show the exact command before anything that changes the machine; installs and destructive actions only on a click, with a confirmation.
2. Research official documentation before building a feature; keep sources in `docs/research/<date>-<topic>.md`; link to the image's/tool's own docs in the UI instead of encoding per-image rules.
3. Test first for logic; browser checks for flows; say plainly what is unverified.
4. Safety by design: allowlisted commands (no free-form passthrough), no stored secrets, read-only where possible, backups before touching user files.
5. One primary button per screen; AA contrast in both themes; keyboard and screen-reader friendly.

**Jobs to be done (from the owner)**
- "My Kafka UI can't connect to my Kafka": networks, discoverability, troubleshooting. (Built; needs real-machine confirmation.)
- Run an image with sensible defaults and env vars. (Guided Run built; env editor and recreate pending.)
- See what is unhealthy, restarting or out of memory, in containers and Kubernetes. (Built.)
- Private (AWS) registries; Compose files already in repos. (Registries parked; Compose not started.)
- Prune suggestions, search and bulk actions on lists; menu bar awareness. (Not started.)

## 2. Architecture (current)
- **UI**: React 18 + TypeScript, built by Vite. Screens in `src/`, shared components and tokens in `src/ui/`, pure logic in `src/lib/` (each file has a `*.test.ts`). Polling through `usePoll` (latest-answer-wins, pauses while the window is hidden, optional `enabled`).
- **Backend (Rust)**, commands the UI may call: `list_profiles`, `start_profile`, `apply_resources`, `stop_profile`, `restart_profile`, `delete_profile`, `docker` (allowlisted subcommands, Colima contexts only), `docker_pull` (streams), `env_check`, `install_tools` (brew, allowlisted names), `network_probe` (helper container in the client's network namespace, target and port as positional parameters), `kubectl` (read-only, JSON only, Colima contexts only), `open_terminal` (k9s, or a shell in one container), `setup_report` and `setup_fix` (Setup tab), `cancel_vm_op`, `force_stop_profile`, `open_url` (localhost and plain https). Output is streamed as frames (`\r` prefix means "replace last line") on `colima-progress`, `pull-progress`, `brew-progress`.
- **Preview**: `scripts/build-preview.mjs` bundles the real UI with `preview/mock.ts` (simulated Docker, Colima, kubectl) into one HTML file; scenarios by URL (`?scenario=`, `?k8s=`).
- **Tests**: `npm test` (Node, pure logic), `cargo test` (Rust), `scripts/check-*.mjs` (Playwright against the preview: layout, overview, restyle, volumes, a11y, guided, pull, network, observe, k8s).
- **Security model**: the page can only reach allowlisted commands; docker `run` refuses privileged flags, the Docker socket and host networking; kubectl is get/logs/config only; Setup fixes may remove dead Docker Desktop plugin links, remove `credsStore`, add Homebrew's plugin folder to `cliPluginsExtraDirs`, switch the docker context and start the login service, each shown first and run on a click, with a backup of `~/.docker/config.json`; links open only after a click and only https/localhost.

## 3. Branch and integration state
`integration` = `feat/kubernetes` + docs and contains everything except the AWS registries tab. `feat/registries` (off `feat/guided-run`) holds that tab. A trial merge hit conflicts in four files and was aborted cleanly; the resolution is mechanical:
- `src/useEnv.ts`: union of optional tools: `kubectl`, `k9s`, `aws`, `ecr_helper`; assume-OK fallback includes all.
- `src/styles.css`: keep both appended blocks.
- `src-tauri/src/main.rs` (8 hunks): union everything. Both sides add functions and tests. `EnvReport` and `env_check` gain `kubectl`, `k9s`, `aws`, `ecr_helper`; `validate_install` allows `colima`, `docker`, `kubectl`, `k9s`, `awscli`, `docker-credential-helper-ecr`; `parse_version` also splits on `/`; the handler list gets `aws`, `docker_config_read`, `docker_config_write` next to `network_probe`, `kubectl`, `open_terminal`.
- `preview/mock.ts` (2 hunks): union the env object and the invoke cases (`aws`, `docker_config_read/write` plus `kubectl`, `open_terminal`).

## 4. Work items

### P0: do first
**W1. Real-machine verification and Rust compile (S, needs the owner's Mac)**
- Done: `cargo test` runs and passes on `integration`; `feat/registries` still to check.
- Walk `docs/VERIFY-ON-YOUR-MAC.md`; capture the real outputs it asks for (helper container `nslookup`/`nc`, `docker events` JSON, `docker system df -v --format json`, Colima Kubernetes context names, `docker ps` health text).
- Acceptance: app launches; Containers home, Setup, Run, delete, Networks, doctor, Activity, Volumes sizes, Kubernetes behave on a real VM; parsers adjusted to the real output; list of fixes closed.

**W2. Merge the registries branch and finish it (M)**
- Resolve as in section 3; then add the AWS scenarios to `preview/mock.ts` that `scripts/check-registries.mjs` expects: `?aws=ready|expired|noaws|noconfig|nohelper`; mock `aws` (`configure list-profiles`, `configure get sso_session|sso_start_url|role_arn|region`, `sts get-caller-identity`, `ecr describe-repositories`, `ecr describe-images`), `docker_config_read/write`, `env_check` with `aws` and `ecr_helper`, `install_tools` for `awscli` and `docker-credential-helper-ecr`.
- Acceptance: `check-registries.mjs` green; all ten other suites and all unit tests green; add the registries suite to the list; README and research notes updated; real-account verification flagged (SSO behaviour with the helper).

**W3. Decide scope from the side-by-side test (S, needs the owner)**
- Owner runs `scripts/eval-setup.sh` and fills `artifacts/eval-scorecard.html`; pastes the summary.
- Acceptance: a decision recorded in `docs/research/2026-10-11-landscape.md`: use an existing tool, or narrow this project to the guidance layer plus integrations.

### P1: next value
**W4. List UX: search, filter, sort, bulk actions, prune suggestions (M)**
- Containers, Images, Volumes, Networks: search box; running-only filter; sortable columns; select rows (selected row clearly highlighted; `aria-selected`) with **Remove selected**, **Remove stopped (N)**, bulk start/stop; usage (CPU/memory) column in lists.
- Prune suggestions: Docker does not record last-used time, so the app records when it first saw an image or volume unused (in app storage, not Docker) and suggests cleanup after a chosen number of days, with sizes. Never auto-delete; named volumes are never bulk-suggested; confirmations name exactly what goes.
- Research first: Podman Desktop's list behaviour (filters, bulk delete), `docker image prune`/`volume prune` semantics.
- Tests: pure selection/filter/sort/suggestion logic; browser check for select-all, bulk delete confirm, highlight, suggestion appearing after the threshold (simulated clock).
- Acceptance: all four lists have search, sort and bulk actions; suggestion strip appears and is dismissible.

**W5. Run panel: env editor and "recreate with changes" (M)**
- Key/value rows with add/remove, `.env` import (`parseDotenv`: `export`, quotes, comments), masked secret-looking values with show/hide, restart policy, memory/CPU limits, command override.
- **Recreate from an existing container** (inspect to run args) so fixes can be applied: the doctor's localhost-setting fix, env changes. Docker cannot edit a running container's env; stop, remove and run again, with a preview of what changes and a backup of the old settings.
- Acceptance: tested arg builder round-trips an inspected container; the doctor offers "Recreate with this fix".

**W6. Compose projects (M-L)**
- Research first: containers carry `com.docker.compose.project`, `.working_dir`, `.config_files`, `.service` labels (verify); `docker compose` plugin presence (`brew install docker-compose`).
- Read-only first: group containers by project, show file path and services; then `up -d`, `down`, `restart`, per-service logs via allowlisted `docker compose -f <path> ...`; "Open project folder" for compose files in the user's repos (path picked by the user, validated). Do not build a compose editor (Dockge/Arcane do that well).
- Acceptance: existing compose projects appear without importing; up/down work on a sample project.

**W7. Colima settings coverage (M)**
- Research `colima start`/`template` flags (vm-type vz/qemu, mount type, network address, DNS and `--dns-host`, Rosetta, docker daemon config, Kubernetes version and disable list, provisioning); show current settings; edit with restart warning; turn Kubernetes off.
- Acceptance: settings page reads real values, applies via `apply_resources` (extended), shows streamed output.

**W8. Diagnostics page and command log (S-M), inspired by ColimaStack**
- Diagnostics: versions and paths of colima, docker, kubectl, brew, aws; active docker context and socket; VM state; one "Copy diagnostics" button for bug reports.
- Command log: every command the app ran (argv, exit code, stdout/stderr tail), searchable, with Copy.
- Acceptance: tested log formatter; a "what did the app just do?" answer for every action.

**W9. Menu bar item and notifications (M)**
- Tauri tray showing VM state and problem count; macOS notification when a container turns unhealthy or is OOM-killed (from the existing problem detection); quick Start/Stop VM.
- Research first: Tauri 2 tray and notification plugin permissions on macOS.

**W10. Command palette and shortcuts (S-M)**
- ⌘K opens a palette: jump to any container, image, network, pod; run common actions. Keyboard-first lists.

### P2: later
- **W11 Packaging and release (M)**: icons, `npm run tauri build` (.dmg), universal binary, code signing and notarization (Apple Developer account needed; Tauri documents this), GitHub Releases through `tauri-action`, Homebrew tap/cask depending on `colima` and `docker`, updater plugin.
- **W12 Hardening (S)**: `csp` and `devCsp` are set and `docker` calls go through per-command flag allowlists; left: confirm the release build loads under the CSP on a real Mac, and move to typed commands over time.
- **W13** Image build and push; more registries (GHCR, Docker Hub private) through credential helpers; "Open in lazydocker" (research first); in-app terminal (pty plus xterm); remote hosts; Linux; onboarding tour; localization.
- **W14** Extend the doctor: HTTP probes, link from health-check output that says "connection refused", "connect all to a network".

## 5. Cross-cutting requirements
- Every feature: research note, pure-logic tests first, browser check against the preview, screenshot review in light, dark, mid and phone widths, README entry, honest list of what is unverified.
- Add each new screen to the nav loops in `check-layout`, `check-a11y` and `check-restyle`.
- Mock parity: any new backend command gets a preview mock and scenarios; mocks must return fresh objects per call (React bails out on identical state).
- Error handling pattern: `Banner` for errors, `OutputLog` for streamed output with a headline and Copy raw output.
- Commits: small, test-first, with a `Co-authored-by` trailer.

## 6. Known issues and unverified assumptions
| Item | How to verify |
|---|---|
| Helper container output (`nslookup`, `nc -zv -w 3`) and exit markers | Command in `docs/VERIFY-ON-YOUR-MAC.md` section 2 |
| `docker events --format '{{json .}}'` fields | Command in section 3 |
| `docker system df -v --format json` shape (volume sizes show a dash if unreadable) | Command in section 3 |
| Colima's Kubernetes context name (assumed `colima`, `colima-<profile>`) | `kubectl config get-contexts -o name` |
| Opening Terminal through `osascript` (macOS asks permission once) | Click Open in k9s |
| `docker ps` health text "(healthy)" | `docker ps` with a health-checked container |
| Real SSO behaviour with the ECR credential helper | W2, real AWS account |
| Podman Desktop sees Colima's engine; ColimaStack build steps | Evaluation kit |
| Release build under the strict CSP not yet opened on a real Mac | `npm run tauri build`, open the .app |
| Prune suggestions need app-side tracking (Docker has no last-used time) | W4 design |
| First-use image downloads (`nicolaka/netshoot`) | W1 |

## 7. Decisions needed from the owner
1. After the scorecard: keep the full roadmap, narrow to the guidance layer plus integrations, or adopt an existing tool.
2. Distribution: personal use only, or share (decides notarization and a Homebrew tap).
3. Registries: is AWS ECR the only private registry that matters?
4. Compose: read-only discovery plus up/down enough, or is editing required?
5. Menu bar and notifications: wanted by default, or opt in?

## 8. Definition of done (per feature)
Research note committed; unit tests and browser checks green; all existing suites still green; screenshots reviewed; README updated; unverified items listed; owner-verifiable steps added to `docs/VERIFY-ON-YOUR-MAC.md`.
