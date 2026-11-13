# Projects: run several Compose projects side by side

Decided by the owner on 2026-11-12: Projects ship in the first OpenPier release. This file is the specification. The screens are in `design/mockup.html` (`projects`, `project-detail`, `project-start-check`).

## 1. The promise

> Add a folder. Press Start. It runs next to your other projects and nothing collides.

Two projects that both want port 5432, both call a container `db`, or both live in a folder named `app` must run at the same time, on whatever engine is selected, without the user editing a Compose file.

## 2. What a project is

**A project is a folder with a Compose file, run as its own Compose project on the selected engine.**

1. It is not a virtual machine and not a new runtime. It uses the engine picked in the engine switcher (E8), so it works on Colima, Docker Desktop, OrbStack and the rest.
2. Its containers show in Containers, grouped under the project, as today.
3. OpenPier never edits the user's Compose file. What it changes, it puts in a separate file that it owns (section 5).

### Why not the Projects code that exists today

`src-tauri/src/lima.rs` builds a second virtual machine (a Lima instance named `default`, `lima.rs:242-247`) and runs every command inside it (`lima.rs:254-258`). So today's Projects ignore the selected engine, their containers do not show in Containers, they need Lima installed, and they carry the three P0 security findings (E2, E3, E4). The backend already has what Projects need on any engine: `compose_action`, `compose_config`, `compose_logs` and `find_compose_files` (`src-tauri/src/main.rs:1441-1890`) take a `context`. Projects are built on those. The Lima code is parked by task 0.2 as planned.

## 3. What Compose already isolates, and what it does not

Compose gives each project its own name, and prefixes containers, the default network and named volumes with it. Two projects only collide in five places. These are the five things OpenPier must handle:

| # | Collision | Example | What OpenPier does |
|---|---|---|---|
| C1 | **Mac ports** | Both publish `5432:5432` | Finds a free port and remaps one of them (section 5) |
| C2 | **Project name** | Two folders named `app` | Gives each project a unique name with `-p` (section 4) |
| C3 | **Fixed container names** | Both set `container_name: db` | Removes the fixed name for this run, so Compose uses `<project>-db-1` |
| C4 | **Fixed network or volume names** | Both declare a volume with `name: pgdata`, or use the same `external: true` network | Shows it and asks: share on purpose, or keep separate. Never decides alone, because sharing is sometimes the point |
| C5 | **Memory** | Together the projects need more than the machine has | Warns before start with the numbers; offers to resize when the engine is Colima |
| C6 | **`network_mode: host`** | A service binds its ports straight on the machine | Warns: these ports cannot be moved by the app |
| C7 | **Same image name** | Both have `build:` and the same `image: app:dev` | Warns: each build replaces the other's image. With no `image:`, Compose names it after the project and there is no clash |

Ports come in more shapes than `5432:5432`, and the check must read all of them from the resolved config: a bind address (`127.0.0.1:5432:5432` collides with `0.0.0.0:5432`, and not with another address), a range (`8000-8010:8000-8010`, moved as a block), and the long form (`published:`, `target:`, `host_ip:`).

C1 is the one people hit every day. C4 is the only one that needs a question.

## 4. Data

One file, `projects.json`, in the app's data folder. No database (the `sqlx` dependency and `migrations/` go away with task 0.2).

```ts
type Project = {
  id: string;            // random, stable
  name: string;          // shown to the user; default = folder name
  composeName: string;   // passed to `-p`; unique; see below
  dir: string;           // absolute path of the folder
  files: string[];       // Compose files, relative to dir, in order
  envFile?: string;      // relative to dir
  profiles: string[];    // Compose profiles to enable
  engineId: string;      // the engine it was last started on
  ports: PortChoice[];   // remaps the user accepted
  shared: string[];      // names of networks and volumes the user chose to share (C4)
  separate: string[];    // names of networks and volumes the user chose to keep separate (C4); not asked again
  renamed: string[];     // services whose container_name is reset on every start (C2)
  addedAt: string;
};
type PortChoice = {
  service: string;
  container: number | [number, number];  // one port or a range
  protocol: "tcp" | "udp";
  hostIp: string;                         // "" means every address
  mac: number | [number, number];         // same shape as container
};
```

`composeName`, in this order. The order matters: a wrong name makes Compose create new, empty volumes, and to the user their data looks gone.

1. If the Compose file sets a top-level `name:`, use it.
2. Else, if a project with the label `com.docker.compose.project.working_dir` equal to `dir` already exists on the engine, use its name. `Add` from Found running always keeps the running name.
3. Else use Compose's own default for the folder, with the existing `default_project_name` function in `main.rs`.
4. Only when that name is already used by a project with a different `dir` (in `projects.json` or on the engine): append `-` and the first 4 lower-case hex characters of the SHA-256 of `dir`.

It never changes after the project is added. The Add sheet shows it when it differs from the folder name.

`ports` and `shared` apply on every engine. The Start check runs again on each engine, and a remembered port that is taken there is a new finding. `engineId` only records where the project last ran.

Rules:

1. Writes go through one Rust command that validates the whole file and writes it atomically (write a temp file, rename).
2. `dir` and every file must pass the same path checks as `compose_real_path` (`main.rs:1470`).
3. A project whose folder no longer exists stays in the list, marked "Folder not found", with `Locate…` and `Remove from OpenPier`.

## 5. The override file

For each project OpenPier writes `<app data>/projects/<id>/override.yaml` and runs Compose with both files:

```
docker --context <engine> compose -p <composeName> --project-directory <dir> \
  -f <dir>/<file 1> [-f <dir>/<file 2> …] -f <app data>/projects/<id>/override.yaml \
  [--env-file <dir>/<envFile>] [--profile <p> …] up -d
```

The override holds only what OpenPier changed:

```yaml
# Written by OpenPier. Safe to delete: OpenPier writes it again.
services:
  db:
    container_name: !reset null
    ports: !override
      - "5433:5432"
```

1. `!override` and `!reset` are Compose merge tags, described with these same two uses in Docker's Compose merge reference (read on 2026-11-12). Without `!override`, Compose appends the ports of the override to the ports of the original and the collision stays. **Not verified: the lowest Compose version that supports both tags (the page does not say), and the merge has not been run here.** Task 7.2 must find it in the Compose release notes, put it in a Doctor check ("Compose is too old for Projects"), and prove the merge with a test in the `eval-*` sandbox.
2. When a service has several ports, the override lists all of them, changed or not, because `!override` replaces the whole list.
3. An empty override (nothing changed) is still written, as `services: {}`, so the command is always the same shape.
5. `--env-file` replaces Compose's automatic loading of `<dir>/.env`. So when the user picks an env file and `<dir>/.env` exists, pass both, `.env` first: `--env-file <dir>/.env --env-file <dir>/<envFile>`. With no env file picked, pass none.
6. Relative paths in the user's files still resolve from `<dir>`, because `--project-directory` is set and the override holds no paths.
4. The Activity sheet and "Show command" show the full command, including the override path. The override's content can be opened from Project settings.

## 6. Start check

Runs before every Start, and is the heart of the feature. Pure function in TypeScript, unit tested: `check(project, composeConfig, engineState) → Finding[]`.

Inputs:

1. `composeConfig`: the output of `compose_config` (resolved, JSON) for the user's files, profiles and env file, **without the override**. This is what the project wants. The override is then built from the findings and `ports`, and checked once with all files (`docker compose … config --quiet`) before `up`.
2. `engineState`: ports published by running containers (`docker ps`), ports listening on the Mac (new command `ports_in_use`, section 9), container names, network and volume names, image names, and the machine's memory when known.

Findings and what Start does:

| Finding | Default action | Shown as |
|---|---|---|
| Port free | Nothing | Not shown |
| Port taken (C1) | Remap to the next free port at or above the wanted one; remember it in `ports` | "5432 is used by `shop` · db. This project will use 5433." with `Use another…` |
| Port taken by something that is not a container | Same remap | "5432 is used by another app on this Mac (postgres)." |
| Fixed container name taken (C3) | Reset the name in the override | "`db` is taken. This project's container will be `billing-db-1`." |
| Shared network or volume name (C4), not external | **Stop and ask** | "Both `shop` and this project use the volume `pgdata`." `Share it` / `Keep separate` |
| Shared network or volume marked `external: true` (C4) | Nothing; it is shared by design | "Shares the network `proxy` with `shop`." Information only |
| `network_mode: host` (C6) | Warn, allow | "`metrics` uses the machine's network. OpenPier cannot move its ports." |
| Same image name with `build:` (C7) | Warn, allow | "`shop` also builds `app:dev`. Each build replaces the other's image." |
| Not enough memory (C5) | Warn, allow | "These projects ask for 9 GB. The machine has 8 GB." `Start anyway` on every engine; `Resize…` is shown as well on Colima. A memory finding always opens the sheet; a host-network or same-image warning alone never does |
| Compose file invalid | Block | The Compose error, in plain words first, raw text under "Details" |
| Image needs a build | Nothing | "2 services will be built first. This can take a few minutes." |

Behaviour:

1. **No findings, or only findings with a default action that the user already accepted before**: Start runs at once. No dialog.
2. **A new remap or rename**: the Start check sheet opens (mockup `project-start-check`) with the findings and one primary button, `Start`. The user can change a port there.
3. **A C4 finding**: the sheet opens and `Start` is disabled until each one is answered.
4. A remembered port that is now taken is treated as a new finding.
5. "Keep separate" for C4 writes a `name:` in the override with the project's `composeName` as a prefix. "Share it" adds the name to `shared` and is not asked again.

## 7. Screens

### 7.1 Projects (list)

Route `#/projects`. First item in the sidebar. Mockup `projects`.

1. Header: `Projects`, summary "{n} · {m} running", search, primary `Add project`.
2. One row per project: state dot, name, folder (muted, with `~`), the Mac ports as links, "{x} of {y} running", one action (`Start` or `Stop`), and the more menu.
3. A project with a problem shows the problem line under it, as on Containers.
4. **Found running**: Compose projects that are running on the engine and are not in `projects.json` (read from `docker compose ls --format json`). Shown under a `Found on this engine` caption with one action, `Add`. They work without being added; adding only remembers them.
5. More menu: `Open folder`, `Open Compose file` (existing `compose_editor`), `Restart`, `Rebuild and start`, `Pull newer images`, separator, `Stop and remove containers` (keeps data), `Delete data…` (danger, confirm lists the volumes and their sizes), `Remove from OpenPier` (does not touch containers or files).
6. Empty state: "No projects yet. A project is a folder with a Compose file. Add one and it runs next to your others." `Add project`. Under it, when `find_compose_files` found some: "Found on this Mac" with up to five, each with `Add`.
7. `Add project`: the system folder picker (existing `PICK_COMPOSE_SCRIPT`), then a sheet with the detected Compose files (ticked), name, and profiles if the file has any. `Add` or `Add and start`.

### 7.2 Project detail

Route `#/projects/<id>/<services|logs|ports|settings>`. Mockup `project-detail`.

1. Header: back, name, facts (folder · engine · "{x} of {y} running"), `Stop`/`Start`, `Restart`, more menu.
2. **Services** (default): one row per service, same row as Containers (dot, name, image, ports, CPU and memory, state, action). Problem lines as on Containers. A row opens the container detail. A service that is not created yet shows "Not started".
3. **Logs**: all services merged by time, each line prefixed by the service name, muted (one muted tone for all, never a colour per service); chips to show one service; search; `Follow`; `Since` (10 min, 1 h, start). Built on `compose_logs`.
4. **Ports**: table of service, port in the container, port on this Mac (a link), and a note when remapped ("wanted 5432"). `Change…` on each row. This is the page to answer "what is on 5433?".
5. **Settings**: name; folder; Compose files (reorder, add, remove); env file; profiles (tick boxes); `Show what OpenPier changed` (opens the override, read only); `Reset changes` (clears `ports` and `shared`).

### 7.3 Start check (sheet)

Mockup `project-start-check`. Title "Start billing". A list of findings, each with a severity icon, one sentence and its control. Foot: `Cancel`, `Start`. `Show command` chip as in the Run sheet.

### 7.4 Elsewhere

1. Containers: a project group's name is a link to the project detail. The group's more menu has `Open project`.
2. Command palette: projects are results; "Start {name}", "Stop {name}", "Add project".
3. Doctor: "Two projects want the same port" is no longer a finding once Projects handle it; keep the finding only for containers that are not in a project.
4. Shortcuts: as in design spec section 10 (Cmd+1 is Projects).

## 8. Words

| Use | Not |
|---|---|
| Project | Stack, environment, workspace |
| Service | Container (inside a project) |
| Port on this Mac | Host port, published port |
| Delete data | Remove volumes, down -v |
| Stop and remove containers | Down |

## 9. Backend commands

All take `context` and are checked by `context_ok`. New or changed in `src-tauri/src/compose.rs` (after task 5.2; in `main.rs` before it):

| Command | Does |
|---|---|
| `projects_read` / `projects_write` | Read and atomically write `projects.json` |
| `project_override_write(id, yaml)` | Writes the override. The YAML is built in Rust from typed input (ports, resets, names), never passed as text from the page |
| `compose_action` (changed) | Accepts a `project_id`; the backend reads the saved project and takes from it the project name, the list of `files` (today it takes one `file`), the env file and the `profiles`, and adds `-p` and `--project-directory`. The frontend never sends paths for a saved project. Arguments are built as argv, never a shell string. The single global `COMPOSE_LOCK` becomes one lock per `composeName`, so two different projects can start at the same time; a second action on the same project is still refused |
| `compose_ls(context)` | `docker compose ls --all --format json` |
| `compose_down(context, …, volumes: bool)` | `down`, with `-v` only when `volumes` is true |
| `ports_in_use(context)` | Ports published by containers (`docker ps`), plus TCP ports listening on the Mac (`lsof -nP -iTCP -sTCP:LISTEN`, with the process name). New: no such probe exists today |

Tests (Rust): argv for each action with a project name, two files, an env file and a profile; a path outside the allowed roots is refused; the override YAML for one port, several ports, a reset name and a kept-separate volume; `projects_write` refuses two projects with the same `composeName`.

## 10. Acceptance: the two-project test

This is the definition of done for Projects. It runs in the `eval-*` sandbox (`scripts/eval-setup.sh`) on a real engine, and as a browser check on the mocked backend.

Fixtures, in `scripts/fixtures/projects/`: two folders, `a/app` and `b/app` (same folder name on purpose). Each has a Compose file with a service `db` (`postgres:16`, `container_name: db`, `environment: POSTGRES_PASSWORD: test`, `ports: ["5432:5432"]`, `volumes: [pgdata:/var/lib/postgresql/data]`), a service `web` (`nginx:alpine`, `ports: ["8080:80"]`), and a top-level `volumes: { pgdata: {} }`.

1. Add `a/app`. Start. It runs on 5432 and 8080 with no dialog.
2. Add `b/app`. The Add sheet shows the name `app-xxxx`. Start. The Start check lists three findings: `db` is renamed, 5432 becomes 5433, and 8080 becomes 8081. Press Start.
3. Both run. `docker ps` shows four containers. `curl localhost:8080` and `curl localhost:8081` both answer. Neither Compose file changed (`git status` clean in the fixtures).
4. Stop `a`. `b` keeps running.
5. Start `a` again: no dialog, same ports as before.
6. Stop both, start `b` and then `a` without waiting: both start at the same time, each keeps the ports it had (remembered), no dialog.
7. `Delete data…` on `b` removes `b`'s volume and not `a`'s.
8. Switch the engine to another reachable one: both projects show "Not started" there and can be started with the same result.

## 11. Not in the first release

Each of these is real and is in `ROADMAP.md` under Later. None blocks the promise in section 1.

1. A terminal inside the app (today "Open a shell" opens Terminal, and that stays).
2. Passing GitHub or SSH credentials into containers.
3. One virtual machine per project (stronger isolation, possible with Colima profiles).
4. Local domain names per project (`web.billing.localhost`) in place of port numbers.
5. Editing Compose files in the app.
6. Git branch and status on the project row.
7. Dev Container (`devcontainer.json`) support.

## 12. Tasks

Added to `05-implementation-plan.md` as phase 7 (after phase 4, because Projects need engines).

| Task | What | Done when |
|---|---|---|
| 7.1 | `projects.json`, `Project` type, `composeName` rule, read and write commands | Rust and TypeScript unit tests for the rule and the file |
| 7.2 | Override file, and the Compose version check in Doctor | Sandbox test proves a remapped port and a reset name on a real engine |
| 7.3 | `compose_action` changes, `compose_ls`, `compose_down`, `ports_in_use` | The Rust tests in section 9 |
| 7.4 | Start check function and its sheet | Unit test per row of the table in section 6; mockup comparison for the sheet |
| 7.5 | Projects list, Add project, Found running | Mockup comparison; browser check adds a project and starts it on the mock |
| 7.6 | Project detail: Services, Logs, Ports, Settings | Mockup comparison; browser check per tab |
| 7.7 | Links from Containers, palette, shortcuts | Browser check |
| 7.8 | The two-project test (section 10) | Passes in the sandbox on Colima, and by hand on one other engine |
