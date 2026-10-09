# Colima UI

A small Tauri desktop app that manages Colima profiles by shelling out to the `colima` CLI.

## Run
Prereqs: Node 18+, Rust (rustup), Colima.

    npm install
    npx tauri icon path/to/any-1024px.png   # one-time, generates src-tauri/icons
    npm run tauri dev

## Build
    npm run tauri build

## Tabs
Containers (start, stop, restart, remove, live logs), Images, Volumes, and Colima profiles.
Needs the Docker CLI (`brew install docker`). The app talks to the docker context Colima creates
for the selected profile (`colima`, or `colima-<profile>`); check with `docker context ls`.

## Pull images and edit profiles
Images tab: "Pull image" searches Docker Hub and streams the pull. Colima tab: "Edit" changes CPU,
memory and disk. Colima applies these on start, so a running profile is stopped first (its containers
stop). Run the Rust unit tests with `cd src-tauri && cargo test`.

## Run images and inspect containers
- Images tab: **Run** opens a panel (name, ports prefilled from the image, volumes, environment).
  mysql, mariadb and postgres prefill the password variable they need to start.
- Pull panel: one-click picks (hello-world, nginx, mysql, ...) and a Run button after the pull.
- Containers tab: click a container for logs, inspect, live stats and mounts, plus
  start/stop/restart/pause/remove and clickable localhost links for published ports.

## Tests
    npm test                      # TypeScript helpers (Node 22.6+)
    cd src-tauri && cargo test    # Rust helpers

## Browser preview (no install of Tauri or Rust)
    npm run preview     # writes preview/index.html; open it in any browser
The same UI code runs against a simulated Docker/Colima backend (`preview/mock.ts`).

## Changelog

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
    npm run preview && node scripts/check-layout.mjs && node scripts/check-overview.mjs && node scripts/check-restyle.mjs   # needs playwright
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
