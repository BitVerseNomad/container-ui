# Colima UI

A small desktop app (Tauri 2, React, TypeScript) for running Docker on a Mac with [Colima](https://github.com/abiosoft/colima), as a replacement for Docker Desktop. It shells out to the `colima`, `docker` and `kubectl` CLIs and never edits their config files unless you click a fix that shows its command first.

**Start here:** `docs/SUMMARY.md` (what was built and learned), `docs/SPEC.md` (what is left), `docs/VERIFY-ON-YOUR-MAC.md` (15-minute real-machine check), `docs/EVALUATION.md` (comparison with other tools), `CHANGELOG.md`. Branch: `integration`.

## Run
Prereqs: Node 22.6+, Rust (rustup), Colima and the Docker CLI (`brew install colima docker`).

    npm install
    npm run tauri dev       # development
    npm run tauri build     # release .app and .dmg

The app talks to the docker context Colima creates for the selected profile (`colima`, or `colima-<profile>`).

## What it does
- **Containers** (home): the VM in one line (state, CPU, memory, disk, Restart, Stop), then every container with status, problems, port links, CPU and memory. Compose projects are grouped; Kubernetes pod containers sit in their own folded group and can't be stopped or removed here. Rows are one line; their checkbox and Logs, Shell, Restart, Stop and Remove show on hover or focus. Pick several rows to start, stop or remove them together (only rows you can see: folded groups are left out). The New menu runs or pulls an image, or lists the Compose projects on your Mac (found with Spotlight when the app opens), with the command to start each in the profile on screen. The profile switcher at the top of the sidebar changes profile and starts or stops any of them; Setup and Profiles sit at the bottom. The sidebar folds to icons and remembers it. A container page has logs, inspect, stats, mounts, health, activity, network checks and Open a shell.
- **Images**: search your images, pull (Docker Hub search, a name, or a private registry such as GHCR, ECR or Google Artifact Registry), guided Run that reads what the image declares, and what takes space inside the VM, with one cleanup per kind (never your volumes).
- **Volumes**: sizes and which containers use them; in-use volumes can't be removed.
- **Networks**: create, connect, and the connection doctor ("why can't A reach B?").
- **Kubernetes** (shown when the profile has it): Colima's K3s cluster, read-only, with plain-words pod problems and Open in k9s.
- **Profiles**: create, edit CPU, memory and disk, start, stop, delete.
- **Setup**: what Docker Desktop used to handle (plugins, credentials, context, start at login), each fix shown before it runs.

When a start or stop fails, the app says why and offers the next step.

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
The page can only ask the backend for allowlisted commands: per-command flag lists for `docker`, a shape check for `docker run` (detached only, named volumes or folders under your home outside `~/Library` and hidden folders, no host network), read-only `kubectl`, a fixed Spotlight query for Compose files (paths only, no file is read), and Colima contexts and profile names only. Publishing ports on 127.0.0.1 and mounting your folders read-only are the Run panel's defaults, not rules the backend enforces. Every command has a deadline. A strict Content Security Policy is set for release builds.
