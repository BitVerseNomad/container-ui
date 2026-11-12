# What is missing to be the reference

A critical review, as product manager and principal engineer, of what OpenPier lacks. Written on 2026-11-12 after the owner asked for it.

How to read the "today" column: it comes from reading the code and from a keyword search of `src/` and `src-tauri/src/main.rs`. It is good enough to rank, not to quote. Confirm before building. (A reviewer already caught one miss: X7.) What other tools have comes from `docs/research/2026-10-11-landscape.md` where it is listed there, and otherwise from general knowledge of those products, which was not checked again for this review.

## 1. The honest picture

1. **The app's edge is real and rare**: it says what is wrong in plain words and fixes it. Keep spending there.
2. **It is behind on things every user expects** from a container app: something in the menu bar, being told when a container dies, looking at files, building an image. A person who installs it on day one notices these in the first hour.
3. **"Reference" does not mean most features.** It means the common jobs are done better than anywhere else, and the repo is one others copy. Docker Desktop has more features and nobody calls it a reference.
4. **The risk is scope.** Sections 3 and 4 add work to an already long plan. Section 7 says what that costs and what to cut first.

## 2. The jobs a container app is hired for

Ranked by how often a developer does them. The reference bar is: each one in two clicks or fewer, and never a dead end.

| # | Job | Today | Verdict |
|---|---|---|---|
| J1 | See what is running and whether it is healthy | Yes, with problem lines | Strong. Keep |
| J2 | Find out why something broke | Yes (Doctor, See why) | The edge. Deepen (G3) |
| J3 | Read logs | One container at a time; Compose logs exist in the backend | Gap (G4) |
| J4 | Run several projects at once | Compose groups only; Projects tab is broken and Lima-only | **Gap, now in scope (`07-projects-spec.md`)** |
| J5 | Start, stop, restart | Yes | Fine |
| J6 | Get a shell | Opens Terminal, with a fallback for minimal images | Good enough |
| J7 | Free disk space | Yes (disk card, prune) | Fine |
| J8 | Know the engine is up without opening a window | No menu bar item | **Gap (G1)** |
| J9 | Be told when something dies | No notifications | **Gap (G2)** |
| J10 | Look at or copy files in a container or volume | Mounts are listed; files are not | Gap (G6) |
| J11 | Change a setting of a running container | Read-only Inspect | Gap (G7) |
| J12 | Build an image | Only through Compose (`up --build`). A plain `docker build` of a folder is refused by the allowlist | Gap (G9) |
| J13 | Use a private registry (a company one, AWS and so on) | Pulling works when the Mac is already signed in from Terminal. The app cannot sign in, list or push; `docker login` is refused | **Gap, first release (G10)** |
| J15 | Look inside an image | No. The list has Run and Remove only | **Gap, first release (G17)** |
| J14 | Move data between machines or back it up | Bring over from Docker Desktop only | Gap (G8) |

## 3. Must be in the first release

Without these the app is not a reference, whatever else it does. Each is small next to its effect.

### G1. Menu bar item

Every desktop container tool lives in the menu bar (Podman Desktop's tray is in the landscape note; Docker Desktop, OrbStack and Rancher Desktop do the same). Today closing the window is the end of the app.

1. Icon shows engine state: running, stopped, a problem.
2. Menu: the selected engine with Start or Stop; "{n} need attention" that opens Doctor; running projects with Stop; Open OpenPier; Quit.
3. Closing the window keeps the app in the menu bar. A setting turns that off.
4. Build: Tauri's tray icon feature. Not installed today (`tauri = { features = [] }`).
5. Done when: with the window closed, starting and stopping the engine works from the menu bar, and the icon changes within 5 seconds of a state change.

### G2. Tell me when something breaks

The edge is "it tells you what is wrong", and today it only tells you while you are looking.

1. A macOS notification when a container the user started exits with an error, runs out of memory, starts restarting in a loop, or turns unhealthy; and when the engine stops by itself.
2. The text is the same plain sentence as the problem line. Clicking it opens the container on the explanation.
3. At most one notification per container per 10 minutes. A setting per kind, and one switch for all.
4. Built on the Docker events stream the backend already allows (`main.rs:87`), not on polling.
5. Done when: killing a container's process in the sandbox produces one notification, and a restart loop produces one, not twenty.

### G3. A public list of every problem the app can explain

This is the product's claim, so it should be on a page anyone can read and link to.

1. Each check in `src/lib/doctor.ts` and each row problem gets an id, a title, what the user sees, why it happens, and what the fix runs.
2. `scripts/problems-doc.mjs` writes `docs/problems.md` from those, so the page cannot drift from the code. CI fails when it is stale.
3. The README links to it under "What it does". Each finding in the app has "Learn more" that opens its entry.
4. Done when: the page lists every check, and a new check without the fields fails the build.

### G4. Logs worth using

1. Project logs: all services merged, coloured by service (in `07`, section 7.2).
2. In any log view: search with next and previous, Follow, Since, wrap on and off, copy, save to a file.
3. Lines that look like errors are marked in the gutter; "Jump to first error".
4. Done when: finding the first error in a 10,000-line log takes one click and the view stays smooth (measure: scrolling keeps up in WebKit; state the number in the PR).

### G5. Copy details, for bug reports

One button in Settings, About: app version, macOS version, engine kind and version, Compose version, the last 20 commands with exit codes. No container names, no paths, no environment values. The bug template asks for it. Without it, every issue starts with five questions.

### G10. Private registries

The owner asked for this on 2026-11-12: company registries, AWS and others, next to Docker Hub.

1. **Fact**: Docker keeps who is signed in where in `~/.docker/config.json`, and pulls use it. So a private image already pulls today if the user signed in from Terminal. The app only lacks the screen.
2. Settings, Registries: list the registries in that file (read only), each with "Signed in" or not. Design spec 7.13.
3. `Sign in`: the app opens Terminal with the right command and the user types the password there. **The app never sees or stores a password or token.** For an AWS registry the command is the AWS one (`aws ecr get-login-password … | docker login …`), and the row says when the sign-in will expire (AWS tokens last 12 hours).
4. Pull sheet: Docker Hub search stays the default (it exists today). A signed-in registry is a source: type the image name; for AWS, list repositories when the `aws` command is installed and signed in.
5. A pull that fails with "denied" or "unauthorized" becomes a plain sentence with a `Sign in` button ("You are not signed in to 1234.dkr.ecr.eu-west-1.amazonaws.com").
6. Push: after the first release.
7. Needs a threat review: the allowlist refuses `login` today on purpose. Keep it refused; sign-in happens in Terminal.
8. Done when: with a registry signed in from Terminal, the app lists it, pulls a private image, and explains an expired sign-in with a working `Sign in`.

### G17. Look inside an image

The owner asked for this on 2026-11-12.

1. Image detail page (design spec 7.12, mockup `image-detail`): overview, layers, the settings it starts with.
2. `Look inside`: a shell in a throwaway container from the image, in Terminal. Reuses the existing shell code, including the fallback for images with no shell (`src/lib/shell.ts`).
3. `Check for a newer one`: compares the local image with the registry and offers `Pull`.
4. Backend: `image inspect` is already allowed. `history` must be added to the allowlist (read only).
5. Files inside the image: after the first release (needs an export; design it with G6).
6. Done when: for `postgres:16` the page shows its layers with sizes, says it listens on 5432 and where it keeps data, and `Look inside` opens a shell.

### G15. Start at login, and come back where you were

A setting to start OpenPier at login (in the menu bar only), and one to start the selected machine with it. The window reopens at its last size, position and page. Small, and every desktop tool has it.

### G16. Works without a mouse and with VoiceOver

Rule 8 of `AGENTS.md` already asks for it. Make it an exit check: before the first release, one pass through every screen with the keyboard only, and one with VoiceOver, with the problems found fixed or listed. Not a task that adds code by itself; it is a gate.

## 4. Next: the first releases after

Ordered by value for the effort.

| # | Gap | What to build | Note |
|---|---|---|---|
| G6 | Files | Browse a container's or a volume's files, read only: list, preview text, save a copy to the Mac | Docker Desktop has it. Read only keeps it safe |
| G7 | Change and recreate | Edit ports, environment, restart rule, memory limit of a container; the app shows the new command, recreates it, keeps the volumes | Fits rule 7 of `AGENTS.md`: asks first, says what it runs |
| G8 | Volume backup | Save a volume to a `.tar.gz`, restore it, copy it to another engine | The bring-over code already copies volumes; reuse it |
| G9 | Build | "Build this folder" with live output and plain-word errors | Needs an allowlist entry and a threat review: a build runs code |
| G10b | Push to a registry | After sign-in exists (G10) | |
| G11 | Local names for projects | `web.billing.localhost` in place of `localhost:8081` | Makes Projects feel finished. Needs a small reverse proxy; design before building |
| G12 | Machine over time | CPU, memory and disk of the machine for the last hour, and which containers used them | Answers "why is my Mac hot" |
| G13 | Wrong-architecture warning | A Doctor check when an image runs under emulation on Apple Silicon, with what it costs | Common and invisible |
| G14 | Company networks | Proxy, custom certificates and registry mirrors, set once and applied to the machine | Blocks adoption at work. Colima only at first |

## 4b. What Docker can do that the app cannot

The backend only runs the Docker commands on its allowlist (`src-tauri/src/main.rs:71-88`). Everything else is refused. This is the full list of what is missing, so nothing is forgotten. "Allow" means adding it to the allowlist with its own argument check and tests.

| Docker can | In the app today | Plan |
|---|---|---|
| `exec` (run a command inside) | Only as a shell in Terminal | Keep. An in-app terminal is Later |
| `history`, image `inspect` | `inspect` allowed, not shown; `history` refused | First release (G17) |
| `search` (Docker Hub) | Yes, in Pull | Keep |
| `pull` | Yes | Keep; add registries (G10) |
| `login`, `logout` | Refused | Stays refused; sign-in in Terminal (G10) |
| `push`, `tag` | Refused | Next (G10b) |
| `build`, `buildx` | Only through Compose | Next (G9) |
| `cp` (copy files in or out) | Refused | Next, with Files (G6) |
| `diff` (what a container changed) | Refused | Next: a "Changed files" tab, read only |
| `top` (processes inside) | Refused | Next: a "Processes" tab, read only. Cheap |
| `commit` (save a container as an image) | Refused | Later |
| `save`, `load`, `export`, `import` | Refused | Next, with backup (G8) |
| `kill`, `wait`, `attach`, `port` | Refused | Not needed: Stop, logs and the Ports page cover them |
| `volume create`, `inspect`, `prune` | `ls` and `rm` only | Next (G8) |
| `network prune` | Refused | Later |
| `system prune` | Refused; the app prunes by kind, with a confirm | Keep refused |
| `compose` up, stop, logs, config, build | Yes | Extend for Projects (`07`) |
| `compose` `run`, `exec`, `pull`, `down -v` | `pull` and `down` come with Projects | First release (`07`) |
| `context` (list, use) | The app reads contexts | First release (E8) |
| `scout`, scans | No | Later, optional tool |

## 5. Later, and never

Later: Kubernetes actions (restart, scale, logs across pods), image layers and history, security scan through an optional tool the user installs, Dev Container support, one machine per project, Windows and Linux, other languages, a command-line companion, links that open the app on a container.

Never, or not without a new decision:

1. **Telemetry without an explicit opt-in.**
2. **A plugin system.** Podman Desktop owns that. It multiplies the surface to secure and document.
3. **A chat assistant.** The owner dropped it on 2026-11-12. Doctor is the answer to "why".
4. **Storing registry passwords or tokens in the app.**
5. **Remote server fleets.** Portainer and its alternatives do that.

## 6. Engineering gaps

What a principal engineer would not sign off on today. Things already in `01-review-engineering.md` are not repeated.

| # | Gap | Fact | Prescription | When |
|---|---|---|---|---|
| X1 | No test on a real engine in CI | All browser checks use the mocked backend | One nightly job on a macOS runner: install Colima, run the two-project test of `07` section 10 and three Doctor scenarios. Nightly, because it is slow | First release |
| X2 | No size test | Nothing checks 200 containers or 50 projects | A mock scenario `big` and a check that the list renders and scrolls; state a budget (first paint under 1 second in the preview) | First release |
| X3 | Polling where events exist | Lists poll every 3 seconds; `docker events` is already allowed | Keep one events stream per engine and invalidate queries from it; keep a slow poll as a safety net | Next |
| X4 | Supply chain | Workflows use tags (`@v4`, `@v0`), no dependency audit | Pin actions by commit, add `cargo audit` and `npm audit --omit=dev` to CI, publish checksums with each release | First release |
| X5 | No written threat model | The allowlist is good and undocumented | `docs/security-model.md`: what the page may ask the backend to run, what is refused, why. One page | First release |
| X6 | Settings have no version | `localStorage` keys, renamed twice already | One settings file with a `version` field and a migration function; tested | First release (with task 0.4) |
| X7 | Error boundary used in one place | `src/ui/ErrorBoundary.tsx` exists and only wraps the old Projects page | Wrap every route with it: a failure shows the error state of the design spec and `Copy details`, not a blank window | First release |
| X8 | No diagnostics | No log file | A rolling log of commands and errors in the app's log folder, opened from Help. Feeds G5 | First release |

Two things to keep exactly as they are: the content security policy in `tauri.conf.json:15` (strict, no inline script) and the one-permission capability file. Any task that widens either needs a line in the PR saying why.

## 7. What this costs, and what to cut first

Estimates in working days for one experienced person, from reading the code, not from doing the work.

| Addition | Days |
|---|---|
| Projects (`07`, tasks 7.1 to 7.8) | 8 to 12 |
| G1 Menu bar | 2 to 3 |
| G2 Notifications | 2 to 3 |
| G3 Problems page | 1 to 2 |
| G4 Logs | 2 to 3 |
| G5 Copy details, X7, X8, G15 | 3 |
| G10 Registries | 3 to 4 |
| G17 Image detail | 3 to 4 |
| X1, X2, X4, X5, X6 | 4 to 6 |
| Total added | 28 to 40 |

With the 28 to 43 days of `05-implementation-plan.md`, the first release is 56 to 83 working days. That is the price of "reference from the first release".

If it has to be shorter, cut in this order, last first:

1. Kubernetes page (ship it unchanged, restyled only).
2. Bring volumes over (keep it as a Doctor finding with today's flow).
3. G4 beyond project logs.
4. G1 menu bar (it hurts, and it is the first thing to add back).

Do not cut: the security fixes, the design system, Projects, G2, G3, the updater, X1.

## 8. Tasks

Added to `05-implementation-plan.md` as phase 8. Each task follows the rules at the top of that file.

| Task | What | Needs |
|---|---|---|
| 8.1 | G1 Menu bar item | Phase 4 |
| 8.2 | G2 Notifications on the events stream | Phase 4 |
| 8.3 | G3 Problem ids, `docs/problems.md`, "Learn more" | 3.8 |
| 8.4 | G4 Log view component used by container and project logs | 3.2 |
| 8.5 | G5 Copy details, X8 log file | 3.9 |
| 8.6 | X7 Error boundary per page | 1.3 |
| 8.7 | X1 Nightly real-engine job | 7.8 |
| 8.8 | X2 Size scenario and check | 3.1 |
| 8.9 | X4 Pinned actions, audits, checksums | 0.6 |
| 8.10 | X5 Security model page | 0.2 |
| 8.11 | X6 Versioned settings file | 0.4 |
| 8.12 | G15 Start at login, window state | 8.1 |
| 8.13 | G16 Keyboard and VoiceOver pass (gate before launch) | Phase 3, 7 |
| 8.14 | G17 Image detail, `history` on the allowlist | 3.4 |
| 8.15 | G10 Registries list, sign-in through Terminal, registry sources in Pull | 3.3, 3.9 |
