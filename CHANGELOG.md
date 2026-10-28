# Changelog

Newest first. Older entries record what was true when they were written; later entries supersede them (the Overview, for example, was replaced by the Containers home screen).

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
