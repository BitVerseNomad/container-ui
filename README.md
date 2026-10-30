# Colima UI

A small desktop app (Tauri 2, React, TypeScript) for running Docker on a Mac with [Colima](https://github.com/abiosoft/colima), as a replacement for Docker Desktop. It shells out to the `colima`, `docker` and `kubectl` CLIs and never edits their config files unless you click a fix that shows its command first.

**Start here:** `docs/SUMMARY.md` (what was built and learned), `docs/SPEC.md` (what is left), `docs/VERIFY-ON-YOUR-MAC.md` (15-minute real-machine check), `docs/EVALUATION.md` (comparison with other tools), `CHANGELOG.md`. Branch: `integration`.

## Install
For Apple Silicon Macs. The app is not signed by Apple, so macOS needs one extra step the first time.

1. Install the app, one of two ways:
   1. **One line** (downloads the latest release, puts it in Applications, opens it):

          curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/scripts/install.sh | sh -s -- <owner>/<repo>

      Run the same line again to update. The old copy goes to the Trash.
   2. **By hand:** download the `.dmg` from the latest [release](../../releases/latest), open it, drag Colima UI to Applications. The first time you open it, macOS says it can't check the app. Open System Settings, Privacy & Security, and click **Open Anyway** (or run `xattr -dr com.apple.quarantine "/Applications/Colima UI.app"`).
2. Open Colima UI. If Colima or Docker is missing, it offers **Install with Homebrew** and installs Colima, the Docker CLI, Compose and Buildx for you. If Homebrew itself is missing, it shows the one command to install it (Homebrew asks for your password, so you run that one).

## Release
Push a version tag and GitHub Actions runs the tests, builds the `.dmg` on an Apple Silicon runner and attaches it to a Release (`.github/workflows/release.yml`):

    git tag v0.2.0 && git push origin v0.2.0

Bump `version` in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` first, so the file name matches the tag.

## Build from source
Prereqs: Node 22.6+, Rust (rustup), Colima and the Docker CLI (`brew install colima docker`).

    npm install
    npm run tauri dev       # development
    npm run tauri build     # release .app and .dmg

The app talks to the docker context Colima creates for the selected profile (`colima`, or `colima-<profile>`).

## What it does
- **Containers** (home): the VM in one line (state, CPU, memory, disk, Restart, Stop), then every container with status, problems, port links, CPU and memory. Compose projects are grouped; Kubernetes pod containers sit in their own folded group and can't be stopped or removed here. Rows are one line; their checkbox and Logs, Shell, Restart, Stop and Remove show on hover or focus. Pick several rows to start, stop or remove them together (only rows you can see: folded groups are left out). The New menu runs or pulls an image, or lists the Compose projects on your Mac (found with Spotlight when the app opens), with the command to start each in the profile on screen. The profile switcher at the top of the sidebar changes profile and starts or stops any of them; Doctor and Profiles sit at the bottom. The sidebar folds to icons and remembers it. A container page has logs, inspect, stats, mounts, health, activity, network checks and Open a shell.
- **Images**: search your images, pull (Docker Hub search, a name, or a private registry such as GHCR, ECR or Google Artifact Registry), guided Run that reads what the image declares, and what takes space inside the VM, with one cleanup per kind (never your volumes).
- **Volumes**: sizes and which containers use them; in-use volumes can't be removed.
- **Networks**: create, connect, and Test a connection ("why can't A reach B?").
- **Kubernetes** (shown when the profile has it): Colima's K3s cluster, read-only, with plain-words pod problems and Open in k9s.
- **Profiles**: create, edit CPU, memory and disk, start, stop, delete.
- **Doctor**: every check in one place, with a sidebar badge for what needs action. See below.

When a start or stop fails, the app says why and offers the next step.

## Doctor
Doctor checks your setup and what runs on it, and says what it found in plain words, with the evidence ("DATABASE_URL is postgres://localhost:5432"). Findings are grouped: **Needs action**, **Worth knowing**, and the checks that passed (folded). Each one also shows on its container's row and page. Nothing changes until you click a fix, and every fix asks first.
- **Setup**: what Docker Desktop used to handle (plugins, credentials, context, start at login, VM size).
- **Containers**: crashed, ran out of memory, keeps restarting, failing health check; postgres or mysql stopped for a missing password setting.
- **Network**: a container that looks for another one at `localhost`; containers that use each other's names but share no network (or sit on Docker's default network, which has no name lookup); a container that couldn't start because its port is taken, and who holds it; Kafka UI and apache/kafka set up so other containers can't reach the broker.
- **Images**: an image built for another CPU than the VM's.
- **Storage and VM**: a database whose data isn't in a named volume; space held by unused images and build cache; a VM too small for what runs on it.

Fixes come in four kinds:
- **Fix**: replaces a container with a copy that has the right settings (same image, ports, volumes, networks, restart policy and environment), and puts the old one back if the copy doesn't stay up. It keeps the old one as `<name>-old` until the new one runs. Only offered when the app can carry every setting over; otherwise you get the commands.
- **Connect**: adds containers to a shared network. It only adds, so nothing is restarted or removed.
- **Commands to copy**, when only you can decide (a password) or the container comes from Compose or Kubernetes, where its file is the source.
- **Open a page** (Profiles, Images) for changes made there.

"Not an issue" hides a finding here and on its container; the page lists what you hid so you can bring it back. **Test a connection** checks whether one container can reach another, step by step. Every command names the profile's context, so it works whatever your terminal points at.

## Tests and checks
    npm test                                   # TypeScript logic (node --test), then the screens in jsdom (vitest)
    npm run test:ui                            # only the screens
    cd src-tauri && cargo test                 # Rust: allowlists, deadlines, process groups
    npm run check                              # builds the browser preview, runs every browser check (needs Playwright)

If Playwright isn't installed in this repo, point `NODE_PATH` at a `node_modules` that has it.

## Browser preview (no Tauri or Rust needed)
    npm run preview                            # writes preview/index.html

The same UI runs against a simulated backend (`preview/mock.ts`). Pick a scenario with `?scenario=`: running, stopped, failed, stuck, stopfail, missing, partial, nobrew, none, two, nonet, desktop, mismatch, k8spods, nocompose. Add `&k8s=on` for Kubernetes.

## Safety
The page can only ask the backend for allowlisted commands: per-command flag lists for `docker`, `docker rename` with exactly two container names, a shape check for `docker run` (detached only, a fixed set of flags including `--restart`, named volumes or folders under your home outside `~/Library` and hidden folders, no host network), read-only `kubectl`, a fixed Spotlight query for Compose files (paths only, no file is read), and Colima contexts and profile names only. Publishing ports on 127.0.0.1 and mounting your folders read-only are the Run panel's defaults, not rules the backend enforces. Every command has a deadline. A strict Content Security Policy is set for release builds.
