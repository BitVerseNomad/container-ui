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
