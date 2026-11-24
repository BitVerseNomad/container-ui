# Iteration 5: Projects on Compose

Work orders WO-7.1 to WO-7.8 (plan tasks 7.1 to 7.8, `../07-projects-spec.md` section 12). Read `../HANDOFF.md` and `README.md` first.

## What this iteration delivers

1. A **project** is a folder with a Compose file, run as its own Compose project on the selected engine. Several can run side by side: OpenPier moves ports, resets fixed container names and asks about shared volumes, in a file it owns. It never edits the user's Compose files.
2. Screens: Projects list (Add project, Found on this engine), Project detail (Services, Logs, Ports, Settings), the Start check sheet, links from Containers and the palette, and `Cmd+1` for Projects.
3. The proof is the two-project test of spec section 10: two folders both named `app`, both wanting 5432 and 8080, run together. The owner runs it in the `eval-*` sandbox with `sh scripts/eval-projects.sh`. The implementer never does.

Needs: iterations 1 to 4 merged. That means: the gate is green; `src/ui/` holds the new components (WO-5.1 moved them up from `src/ui/op/`, so import `from "./ui"` or `from "../ui"`, never `ui/op`); `src-tauri/src/` holds `exec.rs`, `allow.rs`, `engine.rs`, `colima.rs`, `compose.rs`, `kube.rs` (WO-5.2); engines (`src/lib/engines.ts`, `useEngine()`, `engine.id` is a Docker context name); TanStack Query everywhere; the Lima code and the AI chat are deleted (no `lima.rs`, no `projects.rs` from before, no `src/_parked/`). Every work order below checks the parts it needs in its "Starting state".

## The order

WO-7.1, WO-7.2, WO-7.3, WO-7.4a, WO-7.4b, WO-7.5a, WO-7.5b, WO-7.6a, WO-7.6b, WO-7.7, WO-7.8.

Plan tasks 7.4, 7.5 and 7.6 are each split in two so every work order is one reviewable branch (7.4a the pure check, 7.4b its sheet; 7.5a the list screen, 7.5b Add project and Found running; 7.6a the Services and Ports tabs, 7.6b the Logs and Settings tabs).

## Decisions made on the page (so nobody guesses)

1. **The Compose sheet of WO-3.3c stays.** Projects reuses it, it does not replace it. Reason: it also starts folders the user has not added (the scan finds them, "Start a Compose project" in the New menu and the palette). A row whose folder is a saved project shows `Open project` in place of `Start`. Every other row keeps `Start` and gets one more item in its menu, `Add as a project` (WO-7.7).
2. **Two fields of the `Project` type** (spec section 4 lists them since the author's pass): `renamed: string[]` (services whose `container_name` is reset on every start) and `separate: string[]` (volume and network names the user chose to keep separate). Without them the spec's own acceptance step 6 ("start `b` and then `a` without waiting, no dialog") cannot hold, and "Keep separate" would be asked again at every start.
3. **`compose_action` takes a `project_id`, not the project's paths.** The backend reads the saved record itself, so the page can never hand it a path or a name the file does not hold. The argv is the one spec section 5 shows.
4. **The Rust side builds the override file and the command line; the page never writes YAML or a shell string.** The command line shown in "Show command" comes from the same Rust function that runs it (`project_command_line`).
5. **Sandbox proof.** The Start check is TypeScript and the app window cannot be scripted, so the sandbox proof has two parts: ignored Rust tests (`sandbox_*`) that use the real Rust code on a real engine, started by `scripts/eval-projects.sh`; and a TypeScript test with a recorded `docker compose config` of the same fixtures that proves the Start check produces the same plan the Rust test applies (5433, 8081 and a reset `db`). The step by hand on a second engine and the look of the sheets are in `iteration-5-acceptance.md`.

## Common rules (they apply to every work order below)

Iteration 3's common rules C1 to C7 (`iteration-3-work-orders.md`, section "Common rules") apply to every screen work order here, with these changes:

1. **Imports.** Components come from `src/ui` (`import { Button, Row } from "./ui"`; from a file in a folder, `"../ui"`). Never `src/ui/op`. The old `src/ui/op` folder does not exist any more.
2. **Eight states.** Use C4 of iteration 3 (the table and the words). `checkStates` of `scripts/lib/states.mjs` is not used here: a project list has its own states, listed in each work order.
3. **No inline `style`** outside `Meters.tsx`, `LogView.tsx` and `VirtualRows.tsx`. No class that is not in `src/ui/container-ui.css`. `npm run lint` and `node scripts/check-classes.mjs` enforce it.
4. **The mockup is the design** (C1 step 1): the screens are the JavaScript functions `prow`, `projectsHead`, `projectsList`, `portRow`, `projectDetail`, `startFinding`, `startCheck`, `projectsEmpty` in `docs/plan/design/mockup.html`. Quoted words in a work order are the design. Where a work order adds a sentence the mockup does not hold, it says "words added here" and lists them in the pull request file.
5. **Mockup rows.** `scripts/mockup-pairs.json` rows use `"threshold": 0.005`. A row over `0.02` needs a `"why"`. The pair tool only navigates, so a sheet or an open menu is compared by eye.
6. **Merging and the PR text** are C7: branch `wo-<id>`, `git merge --no-ff wo-<id>` into local `main`, the text in `docs/plan/iterations/pr/wo-<id>.md` (screenshots under `docs/plan/iterations/pr/wo-<id>/`). The "Pull request title" part of each work order is the first line of that file.
7. **Words for names.** Use the example names `shop`, `billing`, `web`, `db`, `api`, `worker` in tests and mocks. Never a real person, company or customer.
8. **The Rust rules.** One `#[test]` per row of every table below, named `given_<situation>_when_<action>_then_<result>`. `cargo fmt` and `cargo clippy --all-targets -- -D warnings` stay green. Argument lists are built as `Vec<String>`, never as one shell string.
9. **Never run** `docker`, `colima`, `docker compose up`, `down`, `stop` or any command that changes the machine. The implementer may run `docker compose ... config` on the fixture files (a read that starts nothing) where a step says so, and `sh scripts/eval-projects.sh --dry` (which touches nothing). The owner runs everything else.

---

## WO-7.1 `projects.json`: the file, the types, and the Compose name rule

**Needs:** iterations 1 to 4 merged.

**Why:** the base of Projects (spec sections 4 and 5; task 7.1). Finding U-none, closes the "wrong name makes Compose create empty volumes" risk of spec section 4 by making the name rule one tested function.

**Read first:**
1. `docs/plan/07-projects-spec.md` sections 2 to 4.
2. `src-tauri/src/compose.rs`: find `fn default_project_name`, `fn compose_paths`, `fn compose_real_path` and the test module at the bottom (how its tests are written).
3. `src-tauri/src/main.rs`: find `tauri::generate_handler![` and `mod `.
4. `src-tauri/Cargo.toml`.

**Starting state** (run all, from the repo root; stop if any output differs):
1. `git status --short | wc -l` prints `0`.
2. `ls src-tauri/src` lists `compose.rs`, `exec.rs`, `allow.rs`, `engine.rs`, `colima.rs`, `kube.rs`, `main.rs` and does NOT list `lima.rs` or `projects.rs`.
3. `grep -n "fn default_project_name\|fn compose_paths" src-tauri/src/compose.rs` prints two lines.
4. `grep -rn "sqlx\|lazy_static\|uuid" src-tauri/Cargo.toml` prints nothing (iteration 1 removed them).
5. `ls src/lib/projects.ts src/lib/projectsIo.ts 2>&1` says both do not exist.
6. `rustc --version` prints 1.80 or newer (the work order after this one uses `std::sync::LazyLock`).
7. `printf '%s' /Users/me/b/app | shasum -a 256 | cut -c1-8` prints `24020db2`. `printf '%s' /Users/me/a/app | shasum -a 256 | cut -c1-4` prints `568d`. (These are the test vectors below. If your `shasum` prints something else, stop.)

**Do not touch:** every file under `src/` except the two new ones named below, `src-tauri/src/compose.rs` except step 2, any screen.

**Steps:**

1. **Check `sha2` first.** Not verified: the current major version of the `sha2` crate and its API. Open `https://docs.rs/sha2/latest/sha2/` and confirm that `use sha2::{Digest, Sha256}; let d = Sha256::digest(bytes);` returns the 32-byte digest. If the page shows a different way, stop and report. Then run `cd src-tauri && cargo add sha2`. This edits `Cargo.toml` and `Cargo.lock`. Hex text is built by hand in step 3 (`format!("{b:02x}")` per byte), so no other crate is needed.
2. In `src-tauri/src/compose.rs` make `default_project_name` and `compose_paths` visible to the new module: change `fn default_project_name` to `pub(crate) fn default_project_name` and `fn compose_paths` to `pub(crate) fn compose_paths`. Nothing else in that file changes.
3. Create `src-tauri/src/projects.rs`. Types first, as given here in full:

```rust
// Projects: the Compose folders the user added, kept in one file in the app's data folder.
// The file is `<app data>/projects.json` (app data is `app.path().app_data_dir()`; the bundle id is
// dev.openpier.desktop, so on a Mac it is ~/Library/Application Support/dev.openpier.desktop/).
// Docs: https://docs.rs/tauri/latest/tauri/path/struct.PathResolver.html#method.app_data_dir
use crate::compose::{compose_paths, default_project_name};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use tauri::Manager;

// One port, or a range as [first, last]. JSON: 5432 or [8000, 8010].
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(untagged)]
pub enum PortOrRange {
    One(u16),
    Range([u16; 2]),
}

impl PortOrRange {
    pub fn bounds(&self) -> (u16, u16) {
        match self {
            PortOrRange::One(p) => (*p, *p),
            PortOrRange::Range([a, b]) => (*a, *b),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PortChoice {
    pub service: String,
    pub container: PortOrRange,
    pub protocol: String, // "tcp" or "udp"
    pub host_ip: String,  // "" means every address
    pub mac: PortOrRange, // same shape and length as `container`
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub compose_name: String,
    pub dir: String,
    pub files: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub env_file: Option<String>,
    pub profiles: Vec<String>,
    pub engine_id: String,
    pub ports: Vec<PortChoice>,
    pub shared: Vec<String>,
    pub renamed: Vec<String>,  // services whose container_name is reset on every start
    pub separate: Vec<String>, // volume and network names the user chose to keep separate
    pub added_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ProjectsFile {
    pub version: u32, // 1
    pub projects: Vec<Project>,
}
```

4. In the same file add the name rule. This is the table of spec section 4, as code. `running` and `known` are lists of `(composeName, dir)` pairs: `running` from the engine (the labels `com.docker.compose.project` and `com.docker.compose.project.working_dir` of its containers), `known` from `projects.json`.

```rust
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NameDecision {
    pub name: String,
    pub base_rule: &'static str, // "file", "running" or "folder": which rule gave the name before any suffix
    pub suffixed: bool,          // rule 4 added a hash
}

pub fn dir_hash(dir: &str, chars: usize) -> String {
    let digest = Sha256::digest(dir.as_bytes());
    digest.iter().map(|b| format!("{b:02x}")).collect::<String>().chars().take(chars).collect()
}

// config_name: the `name` that `docker compose config --format json` printed (Compose fills it with the folder's
// default when the file has no `name:`; verified on Compose 5.1.1). None when the config could not be read.
pub fn decide_compose_name(dir: &str, config_name: Option<&str>, running: &[(String, String)], known: &[(String, String)]) -> Result<NameDecision, String> {
    let folder = default_project_name(dir);
    let in_file = config_name.filter(|n| !n.is_empty() && *n != folder);
    let on_engine = running.iter().find(|(_, d)| d == dir).map(|(n, _)| n.as_str());
    let (base, base_rule) = match (in_file, on_engine) {
        (Some(n), _) => (n.to_string(), "file"),                 // rule 1
        (None, Some(n)) => (n.to_string(), "running"),           // rule 2
        (None, None) => (folder, "folder"),                      // rule 3
    };
    if base.is_empty() {
        return Err("This folder's name can't be used as a project name. Set `name:` in the Compose file.".to_string());
    }
    let taken = |n: &str| running.iter().chain(known.iter()).any(|(name, d)| name == n && d != dir);
    if !taken(&base) {
        return Ok(NameDecision { name: base, base_rule, suffixed: false });
    }
    for chars in [4, 8] {                                        // rule 4 (8 only if the 4-character name is taken too)
        let name = format!("{base}-{}", dir_hash(dir, chars));
        if !taken(&name) {
            return Ok(NameDecision { name, base_rule, suffixed: true });
        }
    }
    Err("Could not make a unique Compose name for this folder".to_string())
}
```

5. In the same file add validation. Every rule has one error text; the tests of "Tests to write first" call `validate_projects` and check that the error contains the text.

```rust
fn word_ok(s: &str) -> bool {
    // letters, digits, dot, underscore, hyphen; starts with a letter or digit; at most 80 characters
    !s.is_empty() && s.len() <= 80 && s.starts_with(|c: char| c.is_ascii_alphanumeric()) && s.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c))
}
fn compose_name_ok(s: &str) -> bool {
    !s.is_empty() && s.len() <= 80 && s.starts_with(|c: char| c.is_ascii_lowercase() || c.is_ascii_digit()) && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || "_-".contains(c))
}
fn id_ok(s: &str) -> bool {
    (8..=64).contains(&s.len()) && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}
fn relative_ok(s: &str) -> bool {
    !s.is_empty() && s.len() <= 200 && !s.starts_with('/') && !s.starts_with('-') && !s.contains(['\n', '\0']) && s.split('/').all(|p| !p.is_empty() && p != "." && p != "..")
}
fn range_ok(p: &PortOrRange) -> bool {
    let (a, b) = p.bounds();
    a >= 1 && a <= b
}
fn width(p: &PortOrRange) -> u32 {
    let (a, b) = p.bounds();
    u32::from(b) - u32::from(a)
}

pub fn validate_projects(file: &ProjectsFile, home: &str) -> Result<(), String> {
    if file.version != 1 {
        return Err(format!("projects.json has version {}; this app reads version 1", file.version));
    }
    let (mut ids, mut names) = (HashSet::new(), HashSet::new());
    for p in &file.projects {
        if !id_ok(&p.id) || !ids.insert(p.id.as_str()) {
            return Err(format!("Bad or repeated project id \"{}\"", p.id));
        }
        if p.name.trim().is_empty() || p.name.chars().count() > 80 || p.name.chars().any(|c| c.is_control()) {
            return Err("A project needs a name of 1 to 80 characters".to_string());
        }
        if !compose_name_ok(&p.compose_name) {
            return Err(format!("\"{}\" is not a Compose project name", p.compose_name));
        }
        if !names.insert(p.compose_name.as_str()) {
            return Err(format!("Two projects use the Compose name \"{}\"", p.compose_name));
        }
        let paths_ok = !p.files.is_empty() && p.files.iter().all(|f| relative_ok(f) && { let full = format!("{}/{f}", p.dir); compose_paths(&full, home) == [full.as_str()] });
        if !p.dir.starts_with('/') || !paths_ok {
            return Err(format!("The folder or a Compose file of \"{}\" is outside what the app may run", p.name));
        }
        if p.env_file.as_deref().map_or(false, |e| !relative_ok(e)) {
            return Err(format!("The env file of \"{}\" is not a path inside the folder", p.name));
        }
        if !p.profiles.iter().all(|x| word_ok(x)) {
            return Err(format!("A profile name of \"{}\" is not valid", p.name));
        }
        if !word_ok(&p.engine_id) {
            return Err(format!("The engine of \"{}\" is not a valid name", p.name));
        }
        let ports_ok = p.ports.iter().all(|c| {
            word_ok(&c.service) && (c.protocol == "tcp" || c.protocol == "udp") && range_ok(&c.container) && range_ok(&c.mac) && width(&c.container) == width(&c.mac)
                && c.host_ip.chars().all(|ch| ch.is_ascii_hexdigit() || ch == '.' || ch == ':')
        });
        if !ports_ok {
            return Err(format!("A port choice of \"{}\" is not valid", p.name));
        }
        if !p.shared.iter().chain(&p.renamed).chain(&p.separate).all(|x| word_ok(x)) {
            return Err(format!("A name saved for \"{}\" is not valid", p.name));
        }
        if p.added_at.is_empty() || p.added_at.len() > 40 {
            return Err(format!("\"{}\" has no date it was added", p.name));
        }
    }
    Ok(())
}
```

6. In the same file add reading and writing. The write is atomic: a temp file in the same folder, then `rename`.

```rust
pub fn projects_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path().app_data_dir().map(|d| d.join("projects.json")).map_err(|e| e.to_string())
}

pub fn parse_projects(text: &str) -> Result<ProjectsFile, String> {
    serde_json::from_str(text).map_err(|e| format!("projects.json can't be read: {e}"))
}

pub fn write_atomic(path: &std::path::Path, text: &str) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, text)?;
    std::fs::rename(&tmp, path)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectsRead {
    pub version: u32,
    pub projects: Vec<Project>,
    pub missing: Vec<String>, // ids of projects whose folder no longer exists
    pub home: String,
}

#[tauri::command]
pub fn projects_read(app: tauri::AppHandle) -> Result<ProjectsRead, String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let path = projects_path(&app)?;
    let file = match std::fs::read_to_string(&path) {
        Ok(text) => parse_projects(&text).map_err(|e| format!("{e}. The file is {}.", path.display()))?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => ProjectsFile { version: 1, projects: vec![] },
        Err(e) => return Err(format!("projects.json can't be read: {e}")),
    };
    let missing = file.projects.iter().filter(|p| !std::path::Path::new(&p.dir).is_dir()).map(|p| p.id.clone()).collect();
    Ok(ProjectsRead { version: file.version, projects: file.projects, missing, home })
}

#[tauri::command]
pub fn projects_write(app: tauri::AppHandle, file: ProjectsFile) -> Result<(), String> {
    let home = std::env::var("HOME").unwrap_or_default();
    validate_projects(&file, &home)?;
    let text = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
    write_atomic(&projects_path(&app)?, &format!("{text}\n")).map_err(|e| format!("projects.json can't be written: {e}"))
}

#[derive(Deserialize)]
pub struct RunningUse {
    pub name: String,
    pub dir: String,
}

#[tauri::command]
pub fn project_name_decide(app: tauri::AppHandle, dir: String, config_name: Option<String>, running: Vec<RunningUse>) -> Result<NameDecision, String> {
    let known: Vec<(String, String)> = match std::fs::read_to_string(projects_path(&app)?) {
        Ok(text) => parse_projects(&text)?.projects.into_iter().map(|p| (p.compose_name, p.dir)).collect(),
        Err(_) => vec![],
    };
    let running: Vec<(String, String)> = running.into_iter().map(|r| (r.name, r.dir)).collect();
    decide_compose_name(&dir, config_name.as_deref(), &running, &known)
}
```

7. In `src-tauri/src/main.rs`: add `mod projects;` next to the other `mod` lines, and add `projects::projects_read, projects::projects_write, projects::project_name_decide,` inside `tauri::generate_handler![ ... ]`.
8. Create `src/lib/projects.ts` (pure, no `invoke`: the Node test runner imports it). Full content:

```ts
// The types of projects.json (src-tauri/src/projects.rs is the other half) and the small pure functions the screens use.
export type PortOrRange = number | [number, number];
export type PortChoice = { service: string; container: PortOrRange; protocol: "tcp" | "udp"; hostIp: string; mac: PortOrRange };
export type Project = {
  id: string;
  name: string;
  composeName: string;
  dir: string;
  files: string[];
  envFile?: string;
  profiles: string[];
  engineId: string;
  ports: PortChoice[];
  shared: string[];
  renamed: string[];
  separate: string[];
  addedAt: string;
};
export type ProjectsFile = { version: 1; projects: Project[] };
export type ProjectsRead = ProjectsFile & { missing: string[]; home: string };
export type NameDecision = { name: string; baseRule: "file" | "running" | "folder"; suffixed: boolean };

export const PROJECTS_KEY = ["projects"] as const;

export const emptyProjects = (): ProjectsFile => ({ version: 1, projects: [] });
export const portText = (p: PortOrRange): string => (typeof p === "number" ? String(p) : `${p[0]}-${p[1]}`);
export const portCount = (p: PortOrRange): number => (typeof p === "number" ? 1 : p[1] - p[0] + 1);
export const findProject = (f: ProjectsFile, id: string): Project | undefined => f.projects.find((p) => p.id === id);

// A random id of lower-case letters, digits and hyphens (Rust accepts 8 to 64 of them).
export const newProjectId = (uuid: () => string = () => crypto.randomUUID()): string => uuid().toLowerCase();

export function addProject(f: ProjectsFile, p: Project): ProjectsFile {
  if (f.projects.some((x) => x.composeName === p.composeName)) throw new Error(`Two projects use the Compose name "${p.composeName}"`);
  return { ...f, projects: [...f.projects, p] };
}
export const replaceProject = (f: ProjectsFile, p: Project): ProjectsFile => ({ ...f, projects: f.projects.map((x) => (x.id === p.id ? p : x)) });
export const removeProject = (f: ProjectsFile, id: string): ProjectsFile => ({ ...f, projects: f.projects.filter((x) => x.id !== id) });
```

9. Create `src/lib/projectsIo.ts` (the only place that calls the three commands). Full content:

```ts
import { invoke } from "@tauri-apps/api/core";
import type { NameDecision, ProjectsFile, ProjectsRead } from "./projects.ts";

export const readProjects = () => invoke<ProjectsRead>("projects_read");
export const writeProjects = (file: ProjectsFile) => invoke<void>("projects_write", { file });
export const decideName = (a: { dir: string; configName: string | null; running: { name: string; dir: string }[] }) =>
  invoke<NameDecision>("project_name_decide", a);

// Reads, changes and writes projects.json one change at a time, so two quick changes cannot overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
export function updateProjects(change: (f: ProjectsFile) => ProjectsFile): Promise<ProjectsFile> {
  const next = queue.then(async () => {
    const { missing: _m, home: _h, ...file } = await readProjects();
    const changed = change(file);
    await writeProjects(changed);
    return changed;
  });
  queue = next.catch(() => undefined);
  return next;
}
```

**Tests to write first** (write them before steps 3 to 9; run them; see them fail):

`src-tauri/src/projects.rs`, `#[cfg(test)] mod tests`. Use `/Users/me` as home, and a helper `project(name: &str, compose_name: &str, dir: &str) -> Project` that fills the other fields with valid values (`files: ["compose.yaml"]`, `profiles: []`, `engine_id: "colima"`, `added_at: "2026-11-12T10:00:00Z"`, empty lists). `compose_paths` needs the folder to look like a Compose location: use `dir` values under `/Users/me/code/`.

The composeName rule, **one test per row**:

| Row | Given | Then |
|---|---|---|
| N1 | `config_name` `Some("shop")`, dir `/Users/me/code/shop-app`, nothing known or running | name `shop`, `base_rule` "file", not suffixed |
| N2 | `config_name` `Some("shop")` equal to the folder default, dir `/Users/me/code/shop` | name `shop`, `base_rule` "folder" |
| N3 | `config_name` `None`, dir `/Users/me/code/My App`, nothing else | name `myapp`, "folder" (spaces and capitals go, as Compose does) |
| N4 | file has no `name:`, running `[("billing-old", dir)]` for the same dir | name `billing-old`, "running" |
| N5 | file sets `name: shop`, and running has `("billing-old", dir)` for the same dir | name `shop`, "file" (rule 1 beats rule 2) |
| N6 | dir `/Users/me/b/app`, known `[("app", "/Users/me/a/app")]` | name `app-2402`, suffixed |
| N7 | same dir, but the other project is only on the engine: running `[("app", "/Users/me/a/app")]`, known empty | name `app-2402`, suffixed |
| N8 | dir `/Users/me/a/app`, known `[("app", "/Users/me/a/app")]` (the same folder) | name `app`, not suffixed |
| N9 | dir `/Users/me/a/app`, nothing known or running | name `app`, not suffixed |
| N10 | dir `/Users/me/a/app`, known `[("app", "/Users/me/b/app")]` | name `app-568d` |
| N11 | dir `/Users/me/b/app`, known `[("app", "/Users/me/a/app"), ("app-2402", "/Users/me/x/app")]` | name `app-24020db2` (the 8-character hash) |
| N12 | dir `/Users/me/code/___`, `config_name` `None` (the folder default is empty) | `Err` that contains "can't be used as a project name" |
| N13 | `config_name` `Some("")` (config unreadable), dir `/Users/me/code/shop` | name `shop`, "folder" |
| N14 | the 4-character and the 8-character names are both taken by other folders | `Err` that contains "Could not make a unique Compose name" |

The file, one test each:
1. `given_a_valid_file_when_validated_then_ok`.
2. `given_version_2_when_validated_then_the_error_names_version_1`: contains "this app reads version 1".
3. `given_two_projects_with_one_compose_name_when_validated_then_refused`: contains "Two projects use the Compose name".
4. `given_a_compose_name_with_a_capital_when_validated_then_refused`: contains "is not a Compose project name".
5. `given_a_dir_outside_home_when_validated_then_refused`: dir `/etc/app`, contains "outside what the app may run".
6. `given_a_file_with_dotdot_when_validated_then_refused`: file `../x/compose.yaml`.
7. `given_a_hidden_folder_when_validated_then_refused`: dir `/Users/me/.secret/app` (hidden folders and `~/Library` are refused by `compose_paths`).
8. `given_an_env_file_that_starts_with_a_dash_when_validated_then_refused`: contains "env file".
9. `given_a_profile_with_a_space_when_validated_then_refused`.
10. `given_a_port_choice_with_a_container_range_and_a_single_mac_port_when_validated_then_refused`: container `[8000, 8010]`, mac `8000`.
11. `given_a_port_choice_with_protocol_icmp_when_validated_then_refused`.
12. `given_a_range_that_runs_backwards_when_validated_then_refused`: `[8010, 8000]`.
13. `given_a_project_without_files_when_validated_then_refused`.
14. `given_a_file_when_serialized_then_keys_are_camel_case_and_a_range_is_an_array`: the JSON has `composeName`, `hostIp`, and `"mac":[8000,8010]`; a project with no env file has no `envFile` key.
15. `given_json_with_an_unknown_key_when_parsed_then_refused`.
16. `given_a_file_written_when_read_back_then_equal`: use `write_atomic` into `std::env::temp_dir().join(format!("openpier-test-{}", std::process::id()))`, parse, compare, then remove the folder.
17. `given_a_write_when_it_finishes_then_no_tmp_file_is_left`.

`src/lib/projects.test.ts` (node:test, import with the `.ts` extension):
1. `given_an_empty_file_when_a_project_is_added_then_it_is_there`.
2. `given_a_repeated_compose_name_when_added_then_it_throws`: message contains `Two projects use the Compose name`.
3. `given_a_project_when_replaced_then_only_that_one_changes`.
4. `given_a_project_when_removed_then_the_others_stay_in_order`.
5. `given_a_range_when_shown_then_it_reads_8000-8010`; `given_one_port_when_shown_then_it_reads_5432`; `portCount` is 11 for `[8000, 8010]` and 1 for `5432`.
6. `given_a_uuid_in_capitals_when_made_an_id_then_it_is_lower_case`: `newProjectId(() => "ABC-123")` is `abc-123`.

**Done when:**
1. `cd src-tauri && cargo test projects:: 2>&1 | tail -5` shows at least 31 tests passed and 0 failed (14 name rows, 17 file tests).
2. `node --experimental-strip-types --no-warnings --test src/lib/projects.test.ts 2>&1 | tail -8` shows 6 or more passing and 0 failing.
3. `grep -c "fn given_" src-tauri/src/projects.rs` prints at least 31.
4. `grep -rn "projects_read\|projects_write\|project_name_decide" src-tauri/src/main.rs | wc -l` prints at least 3.
5. `grep -n "sha2" src-tauri/Cargo.toml` prints one line.
6. `git diff --stat main -- src-tauri/src/compose.rs` shows only the two `pub(crate)` edits (2 lines changed).
7. The gate in `../HANDOFF.md` section 5.

**Pull request title:** the first line of `docs/plan/iterations/pr/wo-7.1.md` is: `wo-7.1: The list of projects is saved in one checked file, with a safe Compose name for each`

---

## WO-7.2 The override file, the Compose version check, and the first sandbox proof

**Needs:** WO-7.1.

**Why:** OpenPier never edits the user's Compose file; what it changes goes in a file it owns (spec section 5). Closes the two "Not verified" points of spec section 5 item 1: the lowest Compose version for `!override` and `!reset`, and the merge itself on a real engine.

**Read first:**
1. `docs/plan/07-projects-spec.md` sections 3 and 5.
2. `src-tauri/src/projects.rs` (WO-7.1: `PortOrRange`, `Project`, `projects_path`, `write_atomic`).
3. `src-tauri/src/compose.rs`: find `fn compose_args` and how its tests are written; `src-tauri/src/exec.rs`: find `exec_in`.
4. `src/lib/doctor.ts`: find `const CHECKS`, `type Facts`, and the check with `id: "arch"` (an example of a check that needs a fact).
5. `scripts/eval-setup.sh` (the sandbox: everything it makes is named `eval-*`).

**Starting state** (run all; stop if any output differs):
1. `git status --short | wc -l` prints `0`.
2. `ls src-tauri/src/projects.rs` prints the path; `ls src-tauri/src/override_yaml.rs 2>&1` says it does not exist.
3. `grep -n "pub async fn exec_in\|pub(crate) async fn exec_in\|async fn exec_in" src-tauri/src/exec.rs` prints one line.
4. `docker compose version --short` prints a version (the fixtures in this work order use `docker compose ... config`, a read that starts nothing). If `docker` is not installed on your machine, skip the two `config` commands in step 9 and say so in the pull request file.
5. `grep -n "composeVersion" src/lib/doctor.ts` prints nothing.
6. `ls scripts/fixtures 2>&1` says it does not exist.

**Do not touch:** `src/lib/doctor.ts` except step 7; the Doctor screen except step 8; every other `src/` screen.

**Steps:**

1. **Find the minimum Compose version. Not verified: the lowest Docker Compose release that supports both `!override` and `!reset` (Docker's merge page does not say).** Open `https://github.com/docker/compose/releases` and search the release notes for `!reset` and `!override`. Write down the lowest release that supports both tags, with its URL. (A candidate from memory, not checked: 2.24.0. Do not use it unless the release notes you read say so.) If you cannot find a release note that names both tags, **stop and report**: do not guess the number. The version goes in step 6.
2. Create `src-tauri/src/override_yaml.rs`. It builds the override file from typed input. The page never sends YAML text. Full content:

```rust
// The override file OpenPier writes for a project: only what it changed, merged over the user's own files.
// `!reset null` removes a key, `!override` replaces a whole list instead of adding to it.
// Docs: https://docs.docker.com/reference/compose-file/merge/
use crate::projects::{projects_path, write_atomic, PortOrRange};
use serde::Deserialize;

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PortLine {
    pub host_ip: String,
    pub mac: Option<PortOrRange>, // None: the port is only published inside, no port on the Mac was asked for
    pub container: PortOrRange,
    pub protocol: String,
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ServiceChange {
    pub service: String,
    pub reset_name: bool,
    pub ports: Option<Vec<PortLine>>, // the service's WHOLE list, changed or not
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Rename {
    pub key: String, // the key under `volumes:` or `networks:` in the user's file
    pub name: String, // the new explicit name
}

#[derive(Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OverrideInput {
    #[serde(default)]
    pub services: Vec<ServiceChange>,
    #[serde(default)]
    pub volumes: Vec<Rename>,
    #[serde(default)]
    pub networks: Vec<Rename>,
}

fn word_ok(s: &str) -> bool {
    !s.is_empty() && s.len() <= 120 && s.starts_with(|c: char| c.is_ascii_alphanumeric()) && s.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c))
}

fn range_text(r: &PortOrRange) -> String {
    match r {
        PortOrRange::One(p) => p.to_string(),
        PortOrRange::Range([a, b]) => format!("{a}-{b}"),
    }
}

// "5433:5432", "127.0.0.1:5433:5432", "[::1]:5433:5432/udp", "8000-8010:8000-8010", "5432", "127.0.0.1::5432"
pub fn port_line_text(l: &PortLine) -> String {
    let ip = if l.host_ip.is_empty() { String::new() } else if l.host_ip.contains(':') { format!("[{}]", l.host_ip) } else { l.host_ip.clone() };
    let proto = if l.protocol == "udp" { "/udp" } else { "" };
    let inside = range_text(&l.container);
    match (&l.mac, ip.is_empty()) {
        (Some(m), true) => format!("{}:{inside}{proto}", range_text(m)),
        (Some(m), false) => format!("{ip}:{}:{inside}{proto}", range_text(m)),
        (None, true) => format!("{inside}{proto}"),
        (None, false) => format!("{ip}::{inside}{proto}"),
    }
}

pub fn override_yaml(input: &OverrideInput) -> Result<String, String> {
    let mut out = String::from("# Written by OpenPier. Safe to delete: OpenPier writes it again.\n");
    let mut services: Vec<&ServiceChange> = input.services.iter().filter(|s| s.reset_name || s.ports.is_some()).collect();
    services.sort_by(|a, b| a.service.cmp(&b.service));
    if services.is_empty() {
        out.push_str("services: {}\n");
    } else {
        out.push_str("services:\n");
        for s in services {
            if !word_ok(&s.service) {
                return Err(format!("\"{}\" is not a service name", s.service));
            }
            out.push_str(&format!("  {}:\n", s.service));
            if s.reset_name {
                out.push_str("    container_name: !reset null\n");
            }
            if let Some(ports) = &s.ports {
                if ports.is_empty() {
                    return Err(format!("{} has an empty port list", s.service));
                }
                out.push_str("    ports: !override\n");
                for l in ports {
                    let ip_ok = l.host_ip.chars().all(|c| c.is_ascii_hexdigit() || c == '.' || c == ':');
                    let ranges_ok = [Some(&l.container), l.mac.as_ref()].into_iter().flatten().all(|r| { let (a, b) = r.bounds(); a >= 1 && a <= b });
                    if !ip_ok || !ranges_ok || (l.protocol != "tcp" && l.protocol != "udp") {
                        return Err(format!("A port of {} is not valid", s.service));
                    }
                    out.push_str(&format!("      - \"{}\"\n", port_line_text(l)));
                }
            }
        }
    }
    for (title, list) in [("volumes", &input.volumes), ("networks", &input.networks)] {
        if list.is_empty() {
            continue;
        }
        let mut sorted: Vec<&Rename> = list.iter().collect();
        sorted.sort_by(|a, b| a.key.cmp(&b.key));
        out.push_str(&format!("{title}:\n"));
        for r in sorted {
            if !word_ok(&r.key) || !word_ok(&r.name) {
                return Err(format!("\"{}\" is not a valid {title} name", r.key));
            }
            out.push_str(&format!("  {}:\n    name: \"{}\"\n", r.key, r.name));
        }
    }
    Ok(out)
}

fn id_ok(id: &str) -> bool {
    (8..=64).contains(&id.len()) && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

// `<app data>/projects/<id>/override.yaml`
pub fn override_path(app: &tauri::AppHandle, id: &str) -> Result<std::path::PathBuf, String> {
    if !id_ok(id) {
        return Err("Bad project id".to_string());
    }
    let root = projects_path(app)?.parent().map(|p| p.to_path_buf()).ok_or("No app data folder")?;
    Ok(root.join("projects").join(id).join("override.yaml"))
}

#[tauri::command]
pub fn project_override_write(app: tauri::AppHandle, id: String, input: OverrideInput) -> Result<String, String> {
    let known = std::fs::read_to_string(projects_path(&app)?).ok().and_then(|t| crate::projects::parse_projects(&t).ok()).map_or(false, |f| f.projects.iter().any(|p| p.id == id));
    if !known {
        return Err("That project is not in projects.json".to_string());
    }
    let path = override_path(&app, &id)?;
    write_atomic(&path, &override_yaml(&input)?).map_err(|e| format!("The override file can't be written: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

// The file as it is now, for "Show what OpenPier changed". Empty text when it was never written.
#[tauri::command]
pub fn project_override_read(app: tauri::AppHandle, id: String) -> Result<String, String> {
    Ok(std::fs::read_to_string(override_path(&app, &id)?).unwrap_or_default())
}
```

3. In `src-tauri/src/main.rs`: add `mod override_yaml;`, add `override_yaml::project_override_write, override_yaml::project_override_read,` to `generate_handler![`, and add `#[cfg(test)] mod eval_support;`.
4. Create `src-tauri/src/eval_support.rs` (used by the ignored sandbox tests of this and a later work order; it does nothing in a normal `cargo test`). Full content:

```rust
// Helpers for the sandbox tests (`#[ignore]`, started by scripts/eval-projects.sh). They run `docker` on a REAL engine,
// so they refuse to start unless the sandbox is set up and the script gave them a folder of its own.
use std::process::Command;

pub const CONTEXT: &str = "colima";

pub fn guard() -> String {
    assert!(std::path::Path::new("/tmp/eval-anon-volume").exists(), "run scripts/eval-setup.sh first");
    assert_eq!(std::env::var("OPENPIER_EVAL_CONTEXT").as_deref(), Ok(CONTEXT), "run this through scripts/eval-projects.sh");
    std::env::var("OPENPIER_EVAL_ROOT").expect("run this through scripts/eval-projects.sh")
}

// Runs `docker --context colima <args>`; Ok(stdout) or Err(stderr).
pub fn docker(args: &[&str]) -> Result<String, String> {
    let out = Command::new("docker").arg("--context").arg(CONTEXT).args(args).output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok(String::from_utf8_lossy(&out.stdout).into_owned()) } else { Err(String::from_utf8_lossy(&out.stderr).into_owned()) }
}
```

5. Add the unit tests of "Tests to write first" at the bottom of `override_yaml.rs`, then the sandbox test given there.
6. Create `src/lib/composeVersion.ts`. Full content (put the version and URL from step 1 where marked; the test below reads the constant, so it needs no change):

```ts
// Projects need Compose's `!override` and `!reset` merge tags. MIN_COMPOSE is the lowest release that has both.
// Source: <paste the release-notes URL you read in step 1>
export const MIN_COMPOSE = "<the version from step 1, as x.y.z>";

// "5.1.1", "v2.29.7", "2.24.0-desktop.1" -> the numbers; anything else -> null.
export function parseComposeVersion(out: string): [number, number, number] | null {
  const m = /v?(\d+)\.(\d+)\.(\d+)/.exec(out.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// null (unknown) is not "too old": Doctor says nothing when it could not read the version.
export function composeTooOld(out: string | null | undefined, min: string = MIN_COMPOSE): boolean {
  const have = out ? parseComposeVersion(out) : null;
  const need = parseComposeVersion(min);
  if (!have || !need) return false;
  for (let i = 0; i < 3; i++) if (have[i] !== need[i]) return have[i] < need[i];
  return false;
}
```

7. In `src/lib/doctor.ts`: add `composeVersion?: string; // output of "docker compose version --short"` to `type Facts`; add `import { MIN_COMPOSE, composeTooOld } from "./composeVersion.ts";`; add this check to `CHECKS` (put it right after the `arch` check):

```ts
  {
    id: "compose-old",
    area: "Setup",
    passed: "Docker Compose is new enough for Projects",
    needs: (f) => f.composeVersion !== undefined,
    run: (f) =>
      composeTooOld(f.composeVersion)
        ? [{ id: "compose-old", key: "compose-old", area: "Setup", severity: "action", level: "warn", title: "Compose is too old for Projects", short: "Compose too old", detail: `Projects need Docker Compose ${MIN_COMPOSE} or newer. This engine has ${f.composeVersion}. Update Docker Compose, then start the project again.` }]
        : [],
  },
```
8. Backend command and Doctor wiring. In `src-tauri/src/compose.rs` add:

```rust
// `docker --context <c> compose version --short`: the Compose the engine's CLI would run. A read.
pub(crate) fn compose_version_args(context: &str) -> Vec<String> {
    ["--context", context, "compose", "version", "--short"].map(String::from).to_vec()
}

#[tauri::command]
pub async fn compose_version(context: String) -> Result<String, String> {
    if !context_ok(&context) {
        return Err(format!("Unknown Docker context \"{context}\""));
    }
    crate::exec::exec_in("docker", compose_version_args(&context), false, None).await.map(|s| s.trim().to_string())
}
```
(Check the context with `crate::engine::context_ok`, the function of WO-4.1. Add the command to `generate_handler![`.) Then find where the Doctor screen builds the `Facts` object (`grep -rn "hostArch" src --include=*.tsx --include=*.ts` prints the place) and add `composeVersion` from `invoke<string>("compose_version", { context: engine.id })`, caught to `undefined` when it throws, the same way the neighbouring facts are read. Add `compose_version` to `preview/mock.ts` (it answers `"2.29.7"`; with `&composeold=1` it answers `"2.20.0"`).
9. Fixtures. Create the folders and these two identical files, `scripts/fixtures/projects/a/app/compose.yaml` and `scripts/fixtures/projects/b/app/compose.yaml` (the same folder name `app` on purpose; spec section 10; `nginx:alpine` replaces the spec's `nginx` because the sandbox already pulls it):

```yaml
services:
  db:
    image: postgres:16
    container_name: db
    environment:
      POSTGRES_PASSWORD: test
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
volumes:
  pgdata: {}
```

Then record what Compose resolves, for the TypeScript test of WO-7.4a (a read; nothing starts): `docker compose -p app -f scripts/fixtures/projects/b/app/compose.yaml --project-directory scripts/fixtures/projects/b/app config --format json > scripts/fixtures/projects/config-b.json`. Open the file and check it holds `"name": "app"`, `"container_name": "db"` and `"published": "5432"`. Commit it.
10. Create `scripts/eval-projects.sh` (the owner runs it; the implementer runs only `sh scripts/eval-projects.sh --dry`). Full content:

```sh
#!/bin/sh
# Runs the Projects sandbox tests on a real engine. THE OWNER RUNS THIS. The implementer runs only --dry.
# Needs Colima running and `sh scripts/eval-setup.sh` run once (it makes /tmp/eval-anon-volume).
# Usage: sh scripts/eval-projects.sh --dry | merge | two
# It starts containers named app-* and project "app" and "app-2402": it refuses to run if those exist already,
# and removes only what it made (found by the folder label) when it ends.
set -u
cd "$(dirname "$0")/.." || exit 1
mode=${1:---dry}
fixtures=scripts/fixtures/projects
ctx=colima

say() { printf '%s\n' "$*"; }
die() { say "FAIL $*"; exit 1; }

case "$mode" in
  --dry)
    for f in a/app b/app; do [ -f "$fixtures/$f/compose.yaml" ] || die "fixture $f is missing"; say "ok fixture $f"; done
    say "ok dry run: nothing was started. 'merge' proves the override merge; 'two' runs the two-project test."
    exit 0 ;;
  merge) test=sandbox_override_merge ;;
  two) test=sandbox_two_projects ;;
  *) say "usage: sh scripts/eval-projects.sh --dry | merge | two"; exit 2 ;;
esac

[ -f /tmp/eval-anon-volume ] || die "run scripts/eval-setup.sh first"
docker --context "$ctx" info >/dev/null 2>&1 || die "the engine '$ctx' is not answering"
for p in 5432 5433 8080 8081; do
  lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 && die "port $p is in use on this Mac"
done
for n in app app-2402; do
  [ -n "$(docker --context "$ctx" ps -a -q --filter "label=com.docker.compose.project=$n")" ] && die "a project named $n already runs on $ctx"
done

work=$(mktemp -d /tmp/eval-projects.XXXXXX) || die "no temp folder"
cp -R "$fixtures/a" "$fixtures/b" "$work/"
cleanup() {
  for d in a b; do
    ids=$(docker --context "$ctx" ps -a -q --filter "label=com.docker.compose.project.working_dir=$work/$d/app")
    [ -n "$ids" ] && docker --context "$ctx" rm -f $ids >/dev/null 2>&1
  done
  for n in app app-2402; do
    vols=$(docker --context "$ctx" volume ls -q --filter "label=com.docker.compose.project=$n")
    [ -n "$vols" ] && docker --context "$ctx" volume rm $vols >/dev/null 2>&1
    docker --context "$ctx" network rm "${n}_default" >/dev/null 2>&1
  done
  rm -rf "$work"
}
trap cleanup EXIT INT TERM

OPENPIER_EVAL_CONTEXT=$ctx OPENPIER_EVAL_ROOT=$work \
  cargo test --manifest-path src-tauri/Cargo.toml "$test" -- --ignored --nocapture --test-threads=1
```

11. The sandbox test. Add this inside the `tests` module of `override_yaml.rs` (after the unit tests). It is `#[ignore]`: a normal `cargo test` skips it. The implementer writes it and checks it compiles (`cargo test --no-run`); the owner runs it with `sh scripts/eval-projects.sh merge`.

```rust
    #[test]
    #[ignore = "needs a real engine: run scripts/eval-projects.sh merge"]
    fn sandbox_override_merge() {
        use crate::eval_support::{docker, guard};
        let root = guard();
        let dir = format!("{root}/a/app");
        let line = |mac: u16, inside: u16| PortLine { host_ip: String::new(), mac: Some(PortOrRange::One(mac)), container: PortOrRange::One(inside), protocol: "tcp".into() };
        let input = OverrideInput {
            services: vec![
                ServiceChange { service: "db".into(), reset_name: true, ports: Some(vec![line(5433, 5432)]) },
                ServiceChange { service: "web".into(), reset_name: false, ports: Some(vec![line(8081, 80)]) },
            ],
            ..Default::default()
        };
        let override_file = format!("{root}/override.yaml");
        std::fs::write(&override_file, override_yaml(&input).unwrap()).unwrap();
        let compose = |tail: &[&str]| -> Vec<String> {
            let mut a: Vec<String> = ["compose", "-p", "app", "--project-directory", &dir, "-f", &format!("{dir}/compose.yaml"), "-f", &override_file].map(String::from).to_vec();
            a.extend(tail.iter().map(|s| s.to_string()));
            a
        };
        let run = |tail: &[&str]| { let a = compose(tail); let refs: Vec<&str> = a.iter().map(String::as_str).collect(); docker(&refs) };

        // 1. The merge, before anything starts: one port each (`!override` replaced the list), no fixed name on db.
        let json: serde_json::Value = serde_json::from_str(&run(&["config", "--format", "json"]).unwrap()).unwrap();
        let db_ports = json["services"]["db"]["ports"].as_array().unwrap();
        assert_eq!(db_ports.len(), 1, "!override must replace the list, not add to it");
        assert_eq!(db_ports[0]["published"], "5433");
        assert!(json["services"]["db"].get("container_name").is_none(), "!reset must remove container_name");
        assert_eq!(json["services"]["web"]["ports"][0]["published"], "8081");

        // 2. A real start: the port is on 5433 and the container has Compose's name.
        let result = std::panic::catch_unwind(|| {
            run(&["up", "-d"]).unwrap();
            let names = docker(&["ps", "--filter", "label=com.docker.compose.project=app", "--format", "{{.Names}}"]).unwrap();
            assert!(names.contains("app-db-1"), "the db container is named app-db-1, got: {names}");
            let port = docker(&["port", "app-db-1", "5432/tcp"]).unwrap();
            assert!(port.contains(":5433"), "5432 inside must be on 5433 on the Mac, got: {port}");
        });
        let _ = run(&["down", "-v"]);
        result.unwrap();
    }
```

**Tests to write first** (`src-tauri/src/override_yaml.rs`, `#[cfg(test)] mod tests`; each asserts the whole text with `assert_eq!`):
1. `given_nothing_changed_when_written_then_it_is_services_empty_braces`: the text is `# Written by OpenPier. Safe to delete: OpenPier writes it again.\nservices: {}\n`.
2. `given_one_remapped_port_and_a_reset_name_when_written_then_it_is_the_spec_example`: service `db`, reset, one port `5433:5432`. Expected text:

```
# Written by OpenPier. Safe to delete: OpenPier writes it again.
services:
  db:
    container_name: !reset null
    ports: !override
      - "5433:5432"
```
3. `given_a_service_with_three_ports_when_one_changed_then_all_three_are_listed`: `5433:5432`, `9187:9187`, container-only `80`; the list shows `"5433:5432"`, `"9187:9187"`, `"80"` in that order.
4. `given_a_host_ip_when_written_then_it_leads_the_line`: `127.0.0.1:5433:5432`; with `mac: None` it is `127.0.0.1::5432`.
5. `given_an_ipv6_host_ip_when_written_then_it_is_in_brackets`: `[::1]:5433:5432`.
6. `given_a_udp_port_when_written_then_it_ends_with_slash_udp`: `"5353:5353/udp"`.
7. `given_a_range_when_written_then_it_is_one_line`: `"8100-8110:8000-8010"`.
8. `given_a_service_with_no_change_when_written_then_it_is_left_out`: `reset_name: false` and `ports: None` produces `services: {}`.
9. `given_services_in_any_order_when_written_then_they_are_sorted_by_name`.
10. `given_a_volume_kept_separate_when_written_then_a_volumes_block_has_the_new_name`: `Rename { key: "pgdata", name: "billing_pgdata" }` gives `volumes:\n  pgdata:\n    name: "billing_pgdata"\n` after `services: {}`.
11. `given_a_network_kept_separate_when_written_then_a_networks_block_follows_volumes`.
12. `given_a_service_name_with_a_colon_when_written_then_refused`: `Err` contains "is not a service name".
13. `given_a_volume_name_with_a_newline_when_written_then_refused`.
14. `given_an_empty_port_list_when_written_then_refused`.
15. `given_protocol_sctp_when_written_then_refused`.
16. `given_a_host_ip_with_a_space_when_written_then_refused`.
17. `given_json_with_an_unknown_key_when_parsed_as_input_then_refused` (`serde_json::from_str::<OverrideInput>` on `{"services":[],"shell":"x"}` fails).
18. `given_the_spec_example_when_the_command_text_is_built_then_it_matches` is NOT here: the command line is WO-7.3.

`src/lib/composeVersion.test.ts` (node:test):
1. `given_compose_version_5_1_1_when_parsed_then_5_1_1`; `given_v2_29_7_then_2_29_7`; `given_2_24_0-desktop_1_then_2_24_0`; `given_text_with_no_version_then_null`.
2. `given_the_minimum_when_checked_then_not_too_old`: `composeTooOld(MIN_COMPOSE) === false`.
3. `given_one_patch_below_the_minimum_when_checked_then_too_old`: build the version from `MIN_COMPOSE` with the last number minus 1 (if that number is 0, lower the middle number and use 99; write the case in the test).
4. `given_null_when_checked_then_not_too_old`.
5. `given_a_higher_major_when_checked_then_not_too_old`: `"99.0.0"`.

`src/lib/doctor.test.ts` (add; it exists): `given_compose_2_20_0_when_the_doctor_runs_then_it_says_compose_is_too_old_for_projects` (title equals `Compose is too old for Projects`, `area` is `Setup`); `given_no_compose_version_when_the_doctor_runs_then_the_check_is_left_out_not_passed`; `given_compose_5_1_1_then_the_check_passes` (`passed` holds `Docker Compose is new enough for Projects`).

**Done when:**
1. `cd src-tauri && cargo test override_yaml:: 2>&1 | tail -4` shows at least 17 passed, 0 failed, and `cargo test --no-run 2>&1 | tail -2` builds. `cargo test override_yaml -- --ignored --list 2>&1 | grep -c sandbox_override_merge` prints `1` (listed, not run).
2. `node --experimental-strip-types --no-warnings --test src/lib/composeVersion.test.ts` passes (at least 9 tests); `npx vitest run src/lib/doctor.test.ts` or the node run of `src/lib/doctor.test.ts` (whichever runs it today) passes with the three new tests.
3. `grep -n "MIN_COMPOSE = \"[0-9]" src/lib/composeVersion.ts` prints one line (the placeholder is replaced), and the URL you read is in the comment above it.
4. `sh scripts/eval-projects.sh --dry` prints `ok fixture a/app`, `ok fixture b/app` and `ok dry run`, and exits 0. `sh -n scripts/eval-projects.sh` prints nothing.
5. `node -e 'const j=require("./scripts/fixtures/projects/config-b.json");console.log(j.name, j.services.db.container_name, j.services.db.ports[0].published)'` prints `app db 5432`.
6. `grep -c "docker" scripts/eval-projects.sh` is greater than 0 and `grep -n "compose up\|compose down" scripts/eval-projects.sh` prints nothing (the script only starts the Rust tests; the tests start containers).
7. **The owner's step, not yours:** `sh scripts/eval-projects.sh merge` on Colima prints `test override_yaml::tests::sandbox_override_merge ... ok`. The implementer writes in the pull request file: "sandbox merge test: not run, owner runs it".
8. The gate in `../HANDOFF.md` section 5.

**Pull request title:** the first line of `docs/plan/iterations/pr/wo-7.2.md` is: `wo-7.2: Port and name changes live in a file OpenPier owns, and Doctor says when Compose is too old`

---

## WO-7.3 The Compose commands learn about projects: names, several files, one lock per project, ports in use

**Needs:** WO-7.1 and WO-7.2.

**Why:** two projects must be able to start at the same time (spec section 9), and the check needs to know which ports are taken. Today one global lock refuses a second Compose action while any project works, and no command lists the ports on the Mac.

**Read first:**
1. `docs/plan/07-projects-spec.md` sections 5 and 9.
2. `src-tauri/src/compose.rs` in full: `compose_args`, `compose_service_args`, `compose_action`, `compose_config`, `config_retry_plain`, `compose_logs`, `compose_logs_args`, `cancel_compose`, `COMPOSE_LOCK`, `COMPOSE_PID`, `COMPOSE_TIMEOUT`, and its tests.
3. `src-tauri/src/exec.rs`: `exec_in`, `stream_in`, `kill_group`.
4. `src-tauri/src/projects.rs` and `override_yaml.rs` (WO-7.1, WO-7.2).
5. `src/lib/composeScan.ts`: `shellQuote`.

**Starting state** (run all; stop if any output differs):
1. `git status --short | wc -l` prints `0`.
2. `grep -n "static COMPOSE_LOCK\|static COMPOSE_PID\|fn compose_action\|fn cancel_compose" src-tauri/src/compose.rs` prints four lines.
3. `grep -n "pub async fn stream_in\|pub(crate) async fn stream_in\|fn stream_in" src-tauri/src/exec.rs` prints one line.
4. `grep -n "compose_action" src/ComposeProjects.tsx | head -3` prints at least one line (the only caller today; it passes `file`, `action`, `context` and maybe `service`).
5. `cd src-tauri && cargo test compose 2>&1 | tail -3` shows 0 failed.
6. `lsof -nP -iTCP -sTCP:LISTEN -Fpcn | head -6` prints lines that start with `p`, `c`, `f` and `n` (this is the format the parser below reads; it is a read).

**Do not touch:** the other commands of `compose.rs`, `src/ComposeProjects.tsx` (its calls keep working: `file` still works), any screen.

**Steps:**

1. **The lock.** In `compose.rs` replace the `COMPOSE_LOCK` and `COMPOSE_PID` statics by these (find the two `static` lines; delete them and every use):

```rust
use std::collections::{HashMap, HashSet};
use std::sync::{LazyLock, Mutex};

// One lock per Compose project name, so two different projects can start at the same time and a second action on
// the same project is refused. The name is the key: `-p <composeName>` for a project, the folder's default name for a file.
static COMPOSE_LOCKS: LazyLock<Mutex<HashSet<String>>> = LazyLock::new(|| Mutex::new(HashSet::new()));
static COMPOSE_PIDS: LazyLock<Mutex<HashMap<String, u32>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

pub(crate) struct NameLock(String);

impl NameLock {
    pub(crate) fn take(name: &str) -> Result<NameLock, String> {
        let mut held = COMPOSE_LOCKS.lock().unwrap_or_else(|p| p.into_inner());
        if !held.insert(name.to_string()) {
            return Err(format!("{name} is still starting or stopping. Wait for it, or cancel it."));
        }
        Ok(NameLock(name.to_string()))
    }
}

impl Drop for NameLock {
    fn drop(&mut self) {
        COMPOSE_LOCKS.lock().unwrap_or_else(|p| p.into_inner()).remove(&self.0);
        COMPOSE_PIDS.lock().unwrap_or_else(|p| p.into_inner()).remove(&self.0);
    }
}
```
2. **The argv.** Add to `compose.rs`. These functions are pure; the commands call them.

```rust
use crate::projects::Project;

// Exactly the command of spec section 5:
// docker --context <c> compose -p <name> --project-directory <dir> -f <dir>/<file>... [-f <override>]
//   [--env-file <dir>/.env] [--env-file <dir>/<envFile>] [--profile <p>...] <tail...>
// `--env-file` replaces Compose's automatic .env, so .env goes first when an env file is picked and .env exists.
pub(crate) fn project_args(context: &str, p: &Project, override_path: Option<&str>, dotenv_exists: bool, tail: &[&str]) -> Vec<String> {
    let mut a: Vec<String> = ["--context", context, "compose", "-p", p.compose_name.as_str(), "--project-directory", p.dir.as_str()].map(String::from).to_vec();
    for f in &p.files {
        a.push("-f".into());
        a.push(format!("{}/{}", p.dir, f));
    }
    if let Some(o) = override_path {
        a.push("-f".into());
        a.push(o.to_string());
    }
    if let Some(e) = &p.env_file {
        if dotenv_exists {
            a.push("--env-file".into());
            a.push(format!("{}/.env", p.dir));
        }
        a.push("--env-file".into());
        a.push(format!("{}/{}", p.dir, e));
    }
    for profile in &p.profiles {
        a.push("--profile".into());
        a.push(profile.clone());
    }
    a.extend(tail.iter().map(|s| s.to_string()));
    a
}

// The action words the page may send, and what each runs after the project flags.
pub(crate) fn action_tail(action: &str, volumes: bool) -> Result<Vec<&'static str>, String> {
    Ok(match action {
        "up" => vec!["up", "-d"],
        "build" => vec!["up", "-d", "--build"],
        "pull" => vec!["up", "-d", "--pull", "always"],
        "stop" => vec!["stop"],
        "restart" => vec!["restart"],
        "down" if volumes => vec!["down", "-v"],
        "down" => vec!["down"],
        _ => return Err(format!("\"docker compose {action}\" is not available from the app")),
    })
}

// `compose logs`: the last 300 lines, or only what came after `since` (an RFC 3339 time, nothing else).
pub(crate) fn project_logs_tail(since: Option<&str>) -> Result<Vec<String>, String> {
    let Some(t) = since else { return Ok(["logs", "--tail", "300", "--no-color", "--timestamps"].map(String::from).to_vec()) };
    let stamp = t.len() <= 40 && t.starts_with(|c: char| c.is_ascii_digit()) && t.chars().all(|c| c.is_ascii_digit() || "-:.TZ+".contains(c));
    if !stamp {
        return Err("Bad log time".into());
    }
    Ok(["logs", "--since", t, "--no-color", "--timestamps"].map(String::from).to_vec())
}

// A shell-safe line to show and copy. Letters, digits and `_ . / : = @ % + , -` stay bare; anything else is single-quoted.
pub(crate) fn quote_arg(s: &str) -> String {
    if !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || "_./:=@%+,-".contains(c)) {
        s.to_string()
    } else {
        format!("'{}'", s.replace('\'', "'\\''"))
    }
}
```
3. **Load a saved project.** Add (it re-checks the record, so a hand-edited file cannot reach `docker`):

```rust
use crate::override_yaml::override_path;
use crate::projects::{parse_projects, projects_path, validate_projects};

pub(crate) fn load_project(app: &tauri::AppHandle, id: &str) -> Result<Project, String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let text = std::fs::read_to_string(projects_path(app)?).map_err(|_| "No projects are saved yet".to_string())?;
    let file = parse_projects(&text)?;
    validate_projects(&file, &home)?;
    file.projects.into_iter().find(|p| p.id == id).ok_or_else(|| "That project is not in projects.json".to_string())
}

// The override file the command line names. A project that never started has none: write the empty one first.
fn ensure_override(app: &tauri::AppHandle, id: &str) -> Result<String, String> {
    let path = override_path(app, id)?;
    if !path.is_file() {
        crate::projects::write_atomic(&path, &crate::override_yaml::override_yaml(&Default::default())?).map_err(|e| e.to_string())?;
    }
    Ok(path.to_string_lossy().into_owned())
}

fn dotenv_exists(p: &Project) -> bool {
    std::path::Path::new(&format!("{}/.env", p.dir)).is_file()
}

fn engine_ok(context: &str) -> Result<(), String> {
    if context_ok(context) { Ok(()) } else { Err(format!("Unknown Docker context \"{context}\"")) }
}
```
(Use the real name of the context check, as in WO-7.2 step 8.)
4. **Change `compose_action`.** Find `async fn compose_action`. New signature and behaviour:

```rust
#[tauri::command]
pub async fn compose_action(app: tauri::AppHandle, context: String, file: Option<String>, project_id: Option<String>, action: String, service: Option<String>) -> Result<(), String>
```
   1. Exactly one of `file` and `project_id` is set. Both: `Err("Give a Compose file or a project, not both")`. Neither: `Err("Give a Compose file or a project")`.
   2. With `file`: the code that exists today, unchanged, except it takes `NameLock::take(&default_project_name(&dir))` (the folder's default name) in place of the global lock, and `track` stores the pid in `COMPOSE_PIDS` under that name.
   3. With `project_id`: `engine_ok(&context)?`; `let p = load_project(&app, &id)?`; `let o = ensure_override(&app, &id)?`; the tail is `action_tail(&action, false)?`. With `service: Some(s)`: only `action == "up"` is allowed; `s` must satisfy the same shape test as `compose_service_args` (letters, digits, `._-`, no leading `-`); the tail becomes `["up", "-d", "--no-deps", s]`. Then `args = project_args(&context, &p, Some(&o), dotenv_exists(&p), &tail)`, working folder `p.dir`, lock key `p.compose_name`, same `stream_in(&app, "compose-progress", "docker", &args, Some(&dir), COMPOSE_TIMEOUT, track)`.
5. **New and changed commands** in `compose.rs` (add each to `generate_handler![`):

```rust
// `down`, with `-v` only when `volumes` is true (this is the only way the app removes a project's data).
#[tauri::command]
pub async fn compose_down(app: tauri::AppHandle, context: String, project_id: String, volumes: bool) -> Result<(), String>
// same body as compose_action's project branch, with action_tail("down", volumes)

// Settings as Compose resolves them, WITHOUT the override: what the project wants (spec section 6, inputs).
// `all_profiles` true: `--profile *` in place of the project's own profiles (Settings lists every profile).
#[tauri::command]
pub async fn compose_config(context: String, file: Option<String>, project_id: Option<String>, all_profiles: Option<bool>, app: tauri::AppHandle) -> Result<String, String>
// file: the code of today. project_id: project_args(&context, &p', None, dotenv_exists, &["config", "--format", "json"]) where p' is p
// with profiles replaced by ["*"] when all_profiles is true. The `config_retry_plain` fallback stays for the file branch only.

// The same files WITH the override, checked once before `up`: `config --quiet`. Ok(()) or Err(Compose's own text).
#[tauri::command]
pub async fn compose_validate(app: tauri::AppHandle, context: String, project_id: String) -> Result<(), String>

// Logs of a saved project, all services: project_args(.., Some(&o), .., &project_logs_tail(since)?). A read: no lock.
#[tauri::command]
pub async fn compose_logs(app: tauri::AppHandle, context: String, file: Option<String>, project_id: Option<String>, since: Option<String>) -> Result<String, String>

// The exact command the app would run, for "Show command" and the Activity sheet: "docker " plus the quoted argv.
#[tauri::command]
pub fn project_command_line(app: tauri::AppHandle, context: String, project_id: String, action: String) -> Result<String, String>
// uses override_path(...) as it is (not created), action_tail(&action, false)

// `docker compose ls --all --format json`: the Compose projects the engine knows, running or not.
#[tauri::command]
pub async fn compose_ls(context: String) -> Result<String, String>
// argv: ["--context", c, "compose", "ls", "--all", "--format", "json"]

// The machine's memory in bytes: `docker --context <c> info --format {{.MemTotal}}`. None when it does not print a number.
#[tauri::command]
pub async fn engine_memory(context: String) -> Result<Option<u64>, String>

// Stops the Compose run in progress for one project (Some(name)) or for every project (None, the old behaviour).
#[tauri::command]
pub fn cancel_compose(project: Option<String>) -> bool
```
   `compose_logs` with `file` keeps today's body (`compose_logs_args`).
6. **Ports in use.** Create `src-tauri/src/ports.rs` with the types and parsers below, and the command. Full content:

```rust
// Which ports are taken, on the engine (published by running containers) and on the Mac (anything listening).
use serde::Serialize;

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PortHolder {
    #[serde(rename_all = "camelCase")]
    Container { container: String, project: Option<String>, service: Option<String> },
    #[serde(rename_all = "camelCase")]
    Process { name: String, pid: u32 },
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PortUse {
    pub port: u16,
    pub protocol: String, // "tcp" or "udp"
    pub host_ip: String,  // "" means every address
    pub holder: PortHolder,
}

// "0.0.0.0" and "[::]" both mean every address; "[::1]" is "::1".
fn host_ip(raw: &str) -> String {
    match raw.trim_matches(|c| c == '[' || c == ']') {
        "0.0.0.0" | "::" | "*" => String::new(),
        other => other.to_string(),
    }
}

// The Ports column of `docker ps`: "0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp, 8000-8002->8000-8002/tcp, 80/tcp".
// Items without "->" are not published. A range gives one entry per port (at most 2000). Repeats are dropped.
pub fn parse_ps_ports(text: &str) -> Vec<(String, u16, String)> {
    let mut out: Vec<(String, u16, String)> = vec![];
    for item in text.split(',').map(str::trim) {
        let Some((left, right)) = item.split_once("->") else { continue };
        let Some((ip, ports)) = left.rsplit_once(':') else { continue };
        let proto = right.rsplit_once('/').map_or("tcp", |(_, p)| p).to_string();
        let (lo, hi) = match ports.split_once('-') {
            Some((a, b)) => (a.parse::<u16>(), b.parse::<u16>()),
            None => (ports.parse::<u16>(), ports.parse::<u16>()),
        };
        let (Ok(lo), Ok(hi)) = (lo, hi) else { continue };
        for port in lo..=hi.min(lo.saturating_add(1999)) {
            let entry = (host_ip(ip), port, proto.clone());
            if !out.contains(&entry) {
                out.push(entry);
            }
        }
    }
    out
}

// `lsof -nP -iTCP -sTCP:LISTEN -Fpcn`: lines start with p<pid>, c<command>, f<fd> or n<host:port>. An n line belongs
// to the last p and c above it. Host is "*", an address, or "[v6]".
pub fn parse_lsof(out: &str) -> Vec<PortUse> {
    let (mut pid, mut command, mut found) = (0u32, String::new(), vec![]);
    for line in out.lines() {
        let (tag, rest) = line.split_at(line.chars().next().map_or(0, |c| c.len_utf8()));
        match tag {
            "p" => pid = rest.parse().unwrap_or(0),
            "c" => command = rest.to_string(),
            "n" => {
                let Some((host, port)) = rest.rsplit_once(':') else { continue };
                let Ok(port) = port.parse::<u16>() else { continue };
                let entry = PortUse { port, protocol: "tcp".into(), host_ip: host_ip(host), holder: PortHolder::Process { name: command.clone(), pid } };
                if !found.contains(&entry) {
                    found.push(entry);
                }
            }
            _ => {}
        }
    }
    found
}

// Rows of `docker ps --format '{{.Names}}\t{{.Label "com.docker.compose.project"}}\t{{.Label "com.docker.compose.service"}}\t{{.Ports}}'`.
pub fn parse_ps_rows(text: &str) -> Vec<PortUse> {
    let mut out = vec![];
    for line in text.lines() {
        let f: Vec<&str> = line.split('\t').collect();
        if f.len() < 4 {
            continue;
        }
        let some = |s: &str| if s.is_empty() { None } else { Some(s.to_string()) };
        for (ip, port, protocol) in parse_ps_ports(f[3]) {
            out.push(PortUse { port, protocol, host_ip: ip, holder: PortHolder::Container { container: f[0].to_string(), project: some(f[1]), service: some(f[2]) } });
        }
    }
    out
}

// Containers first. A Mac listener on a port a container publishes is the engine's own forwarder (Colima, Docker Desktop),
// not another app, so it is dropped. The rest are other apps. Sorted by port.
pub fn merge_uses(containers: Vec<PortUse>, listeners: Vec<PortUse>) -> Vec<PortUse> {
    let mut all = containers.clone();
    all.extend(listeners.into_iter().filter(|l| !containers.iter().any(|c| c.port == l.port && c.protocol == l.protocol)));
    all.sort_by(|a, b| a.port.cmp(&b.port).then(a.host_ip.cmp(&b.host_ip)));
    all
}

#[tauri::command]
pub async fn ports_in_use(context: String) -> Result<Vec<PortUse>, String> {
    if !crate::engine::context_ok(&context) {
        return Err(format!("Unknown Docker context \"{context}\""));
    }
    let fmt = "{{.Names}}\t{{.Label \"com.docker.compose.project\"}}\t{{.Label \"com.docker.compose.service\"}}\t{{.Ports}}";
    let ps = crate::exec::exec_in("docker", ["--context", context.as_str(), "ps", "--format", fmt].map(String::from).to_vec(), false, None).await?;
    // lsof exits 1 when nothing listens: that is an empty answer, not an error.
    let lsof = crate::exec::exec_in("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpcn"].map(String::from).to_vec(), false, None).await.unwrap_or_default();
    Ok(merge_uses(parse_ps_rows(&ps), parse_lsof(&lsof)))
}
```
   `context_ok` is the `pub(crate) fn` of `src-tauri/src/engine.rs` (WO-4.1). Add `mod ports;` and `ports::ports_in_use,` to `main.rs`. Check that `lsof` is on the app's PATH search the way `exec_in` finds programs (`find_bin`): if `exec_in` only finds Homebrew programs, call `/usr/sbin/lsof` by full path. Look at `exec_in` and use what it does for system tools; if it cannot run a system tool, stop and report.
7. **TypeScript side.** Add to `src/lib/projects.ts` (pure):

```ts
export type PortHolder = { kind: "container"; container: string; project: string | null; service: string | null } | { kind: "process"; name: string; pid: number };
export type PortUse = { port: number; protocol: string; hostIp: string; holder: PortHolder };
export type ComposeLsRow = { name: string; running: number; files: string[] };

// `docker compose ls --all --format json`: [{"Name":"shop","Status":"running(2), exited(1)","ConfigFiles":"/a/compose.yaml,/a/o.yaml"}].
// Not verified: the exact Status text. The parser reads only "running(n)" and ignores the rest.
export function parseComposeLs(json: string): ComposeLsRow[] {
  let rows: unknown;
  try { rows = JSON.parse(json); } catch { return []; }
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) => {
    if (!r || typeof r !== "object" || typeof (r as { Name?: unknown }).Name !== "string") return [];
    const o = r as { Name: string; Status?: unknown; ConfigFiles?: unknown };
    const running = [...String(o.Status ?? "").matchAll(/running\((\d+)\)/g)].reduce((n, m) => n + Number(m[1]), 0);
    const files = String(o.ConfigFiles ?? "").split(",").map((f) => f.trim()).filter(Boolean);
    return [{ name: o.Name, running, files }];
  });
}
```
   And add to `src/lib/projectsIo.ts` (all `invoke`, one line each, camelCase argument names):

```ts
export const composeProject = (a: { context: string; projectId: string; action: string; service?: string }) =>
  invoke<void>("compose_action", { context: a.context, file: null, projectId: a.projectId, action: a.action, service: a.service ?? null });
export const composeDown = (a: { context: string; projectId: string; volumes: boolean }) => invoke<void>("compose_down", a);
export const projectConfig = (a: { context: string; projectId: string; allProfiles?: boolean }) =>
  invoke<string>("compose_config", { context: a.context, file: null, projectId: a.projectId, allProfiles: a.allProfiles ?? false });
export const projectValidate = (a: { context: string; projectId: string }) => invoke<void>("compose_validate", a);
export const projectLogs = (a: { context: string; projectId: string; since?: string }) =>
  invoke<string>("compose_logs", { context: a.context, file: null, projectId: a.projectId, since: a.since ?? null });
export const projectCommand = (a: { context: string; projectId: string; action: string }) => invoke<string>("project_command_line", a);
export const composeLs = (context: string) => invoke<string>("compose_ls", { context });
export const portsInUse = (context: string) => invoke<PortUse[]>("ports_in_use", { context });
export const engineMemory = (context: string) => invoke<number | null>("engine_memory", { context });
export const writeOverride = (a: { id: string; input: unknown }) => invoke<string>("project_override_write", a);
export const readOverride = (id: string) => invoke<string>("project_override_read", { id });
```
   (Import `PortUse` as a type from `./projects.ts`. Change the `any`-free `input: unknown` to the `OverrideInput` type in WO-7.4a, when it exists.)

**Tests to write first** (`src-tauri/src/compose.rs` tests module and `src-tauri/src/ports.rs`; `Project` built with the helper of WO-7.1 made `pub(crate)` for tests; home `/Users/me`):

Argv (exact `Vec<String>` equality, one test each):
1. `given_one_file_and_no_extras_when_args_are_built_then_flags_follow_the_spec`: `["--context","colima","compose","-p","shop","--project-directory","/Users/me/code/shop","-f","/Users/me/code/shop/compose.yaml","up","-d"]`.
2. `given_two_files_an_override_an_env_file_and_a_profile_when_args_are_built_then_the_order_is_files_override_env_profile`: the full expected list, with `--env-file /Users/me/code/shop/.env --env-file /Users/me/code/shop/prod.env` (the `.env` exists) and `--profile debug`.
3. `given_an_env_file_and_no_dotenv_when_args_are_built_then_only_the_picked_one_is_passed`.
4. `given_no_env_file_and_a_dotenv_when_args_are_built_then_no_env_file_flag`.
5. `given_two_profiles_when_args_are_built_then_each_has_its_own_flag`.
6. `given_each_action_when_its_tail_is_built_then_it_is_the_table`: up `up -d`, build `up -d --build`, pull `up -d --pull always`, stop `stop`, restart `restart`, down `down`; and `down` with volumes `down -v`.
7. `given_the_action_rm_when_its_tail_is_built_then_refused`: the text contains "is not available from the app".
8. `given_down_without_volumes_when_built_then_there_is_no_dash_v`.
9. `given_a_service_when_up_is_built_then_it_is_up_dash_d_no_deps_service`; `given_a_service_with_a_leading_dash_when_built_then_refused`; `given_a_service_and_the_action_stop_when_built_then_refused`.
10. `given_all_profiles_when_config_args_are_built_then_profile_star_replaces_the_project_profiles` and the tail is `config --format json`.
11. `given_a_validate_when_built_then_the_override_is_in_and_the_tail_is_config_quiet`.
12. `given_no_since_when_logs_are_built_then_tail_300`; `given_a_since_when_built_then_since_replaces_tail`; `given_a_since_with_a_flag_when_built_then_bad_log_time`.
13. `given_a_ls_when_built_then_the_args_are_exact`: `["--context","colima","compose","ls","--all","--format","json"]`.
14. `given_a_path_with_a_space_when_quoted_then_it_is_single_quoted` (`/Users/me/My Apps/shop` becomes `'/Users/me/My Apps/shop'`); `given_a_quote_in_the_text_when_quoted_then_it_is_escaped`; `given_plain_text_when_quoted_then_unchanged`.
15. `given_file_and_project_when_compose_action_checks_then_not_both`; `given_neither_then_give_a_file_or_a_project`.
16. `given_a_project_outside_the_allowed_roots_when_checked_then_refused`: a one-project file with `dir` `/etc/app`: `validate_projects` fails (the check `load_project` runs). `given_a_project_in_a_hidden_folder_then_refused`.
17. `given_an_unknown_context_when_checked_then_refused`.
Locks:
18. `given_a_name_is_locked_when_taken_again_then_it_is_refused_with_its_name`: the text contains `shop is still starting or stopping`.
19. `given_two_names_when_both_are_taken_then_both_succeed`.
20. `given_a_lock_is_dropped_when_taken_again_then_it_succeeds`.
Ports (`ports.rs`):
21. `given_a_ps_ports_text_when_parsed_then_ipv4_and_ipv6_of_one_port_are_one_entry`: `"0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp"` gives `[("", 5432, "tcp")]`.
22. `given_a_range_when_parsed_then_one_entry_per_port`: `"0.0.0.0:8000-8002->8000-8002/tcp"` gives 3 entries.
23. `given_a_bound_address_when_parsed_then_it_is_kept`: `"127.0.0.1:5432->5432/tcp"` gives host ip `127.0.0.1`.
24. `given_an_unpublished_port_when_parsed_then_it_is_skipped`: `"80/tcp"` gives nothing.
25. `given_a_udp_port_when_parsed_then_the_protocol_is_udp`.
26. `given_a_ps_row_when_parsed_then_the_container_project_and_service_are_kept`; `given_a_row_with_no_labels_then_project_and_service_are_none`.
27. `given_lsof_output_when_parsed_then_pid_command_host_and_port_are_read`: use the text `p970\ncrapportd\nf10\nn*:65143\nf11\nn*:65143\np1027\ncpostgres\nf5\nn127.0.0.1:5432\nf6\nn[::1]:5432\n`: three entries (the repeated `*:65143` is one).
28. `given_a_listener_on_a_port_a_container_publishes_when_merged_then_the_listener_is_dropped`.
29. `given_a_listener_on_another_port_when_merged_then_it_stays_as_a_process`.
30. `given_a_memory_number_when_parsed_then_u64`: the engine-memory parser (`parse_mem_total("4094603264\n")` is `Some(4094603264)`; `"Error"` is `None`). Write `fn parse_mem_total(s: &str) -> Option<u64>` next to `engine_memory`.

TypeScript (`src/lib/projects.test.ts`, add):
31. `given_compose_ls_json_when_parsed_then_name_running_count_and_files`: `[{"Name":"shop","Status":"running(2), exited(1)","ConfigFiles":"/a/compose.yaml,/a/o.yaml"}]` gives `{ name: "shop", running: 2, files: ["/a/compose.yaml", "/a/o.yaml"] }`.
32. `given_text_that_is_not_json_when_parsed_then_an_empty_list`; `given_an_empty_array_then_empty`.

**Done when:**
1. `cd src-tauri && cargo test 2>&1 | tail -4` shows 0 failed, and `cargo test compose:: ports:: 2>&1 | grep -c "\.\.\. ok"` prints at least 40.
2. `grep -n "static COMPOSE_LOCK:\|static COMPOSE_PID:" src-tauri/src/compose.rs` prints nothing; `grep -n "COMPOSE_LOCKS" src-tauri/src/compose.rs | wc -l` prints at least 3.
3. `grep -n "compose_down\|compose_validate\|compose_ls\|engine_memory\|ports_in_use\|project_command_line" src-tauri/src/main.rs | wc -l` prints at least 6.
4. `grep -n "\"down\".*\"-v\"" src-tauri/src/compose.rs | wc -l` prints exactly 1 (`-v` appears in one place only, in `action_tail`).
5. `grep -rn "sh -c\|\"-c\"" src-tauri/src/compose.rs src-tauri/src/ports.rs` prints nothing (no shell string).
6. `node --experimental-strip-types --no-warnings --test src/lib/projects.test.ts` passes (at least 9 tests); `npx tsc --noEmit` prints nothing.
7. The old caller still works: `npx vitest run src/ComposeProjects.test.tsx` passes and `node scripts/check-compose.mjs` prints no `FAIL` (it passes `file`).
8. The gate in `../HANDOFF.md` section 5.

**Pull request title:** the first line of `docs/plan/iterations/pr/wo-7.3.md` is: `wo-7.3: Two Compose projects can start at the same time, and the app can see which ports are taken`

---

## WO-7.4a The Start check: one pure function, one test per row of the table

**Needs:** WO-7.3.

**Why:** the Start check is the heart of Projects (spec section 6): it finds the five collisions before Start and decides what the override file holds. It is a pure function so each row is tested without an engine.

**Read first:**
1. `docs/plan/07-projects-spec.md` sections 3 and 6.
2. `src/lib/composeLimit.ts`: `parseMem` (turns `"512m"` and `536870912` into bytes).
3. `src/lib/projects.ts` and `src/lib/projectsIo.ts` (WO-7.1, 7.3).
4. `scripts/fixtures/projects/config-b.json` (WO-7.2).

**Starting state** (run all; stop if any output differs):
1. `git status --short | wc -l` prints `0`.
2. `ls src/lib/projects.ts scripts/fixtures/projects/config-b.json` prints both paths.
3. `ls src/lib/projectCheck.ts 2>&1` says it does not exist.
4. `grep -n "export function parseMem" src/lib/composeLimit.ts` prints one line.
5. `grep -n "PortUse" src/lib/projects.ts | head -2` prints at least one line.

**Do not touch:** every file except the two new ones below and `src/lib/projectsIo.ts` (step 5).

**Steps:**

Facts used (verified on Docker Compose 5.1.1 with `docker compose config --format json`, and read again in `config-b.json`):
1. `name` is always present. A port range in a Compose file is expanded to one entry per port. `published` is a string. A port with no Mac port has no `published`. `host_ip` is present only when the file sets it. A volume's `name` is already resolved: `<project>_<key>` unless the file gives an explicit `name:` or the volume is `external: true`.

1. Create `src/lib/projectCheck.ts`. These are its exports; all are pure (no `invoke`, no React, no `window`).

```ts
import { parseMem } from "./composeLimit.ts";
import type { PortChoice, PortOrRange, PortUse, Project } from "./projects.ts";

// ---- what Compose resolved (the part of `docker compose config --format json` the check reads) ----
export type ConfigPort = { host_ip?: string; target: number; published?: string; protocol: string };
export type ConfigService = {
  image?: string; build?: unknown; container_name?: string; network_mode?: string; ports?: ConfigPort[];
  mem_limit?: string | number; deploy?: { resources?: { limits?: { memory?: string | number } } };
};
export type ConfigResource = { name: string; external?: boolean };
export type ComposeConfig = { name: string; services: Record<string, ConfigService>; volumes?: Record<string, ConfigResource>; networks?: Record<string, ConfigResource> };
export function parseConfig(json: string): ComposeConfig | { error: string };   // { error: json } when it is not an object with `services`

// ---- what the engine and the Mac hold now ----
export type OtherProject = {
  name: string; composeName: string; running: boolean;
  builds: string[];                                  // image names of its services that have `build:` and `image:`
  volumes: { key: string; name: string; external: boolean }[];
  networks: { key: string; name: string; external: boolean }[];
  memory: number;                                    // bytes, the sum of its services' declared memory limits
};
export type EngineState = {
  ports: PortUse[];                                  // ports_in_use
  containers: { name: string; project: string | null }[];   // every container, running or not
  volumes: { name: string; project: string | null }[];
  networks: { name: string; project: string | null }[];
  others: OtherProject[];                            // the saved projects other than this one
  memory: number | null;                             // the machine's memory in bytes
  colima: boolean;                                   // true: `Resize…` can be offered
};

// ---- the findings (spec section 6) ----
export type PortFinding = {
  kind: "port"; key: string; service: string; protocol: "tcp" | "udp"; hostIp: string;
  container: PortOrRange; wanted: PortOrRange; use: PortOrRange;
  by: string;                    // "shop · db", "another app on this Mac (postgres)", or a container name
  byProcess: boolean;
  remembered: boolean;           // the project already had this choice
  accepted: boolean;             // remembered and still free: no question
};
export type Finding =
  | { kind: "invalid"; key: "invalid"; error: string }
  | PortFinding
  | { kind: "name"; key: string; service: string; fixed: string; becomes: string; by: string }
  | { kind: "shared"; key: string; type: "volume" | "network"; name: string; resourceKey: string; with: string; answer: "share" | "separate" | null }
  | { kind: "external"; key: string; type: "volume" | "network"; name: string; with: string }
  | { kind: "host"; key: string; service: string }
  | { kind: "image"; key: string; service: string; image: string; with: string }
  | { kind: "memory"; key: "memory"; asks: number; has: number; canResize: boolean }
  | { kind: "build"; key: "build"; services: string[] };

export function check(project: Project, config: ComposeConfig | { error: string }, state: EngineState): Finding[];
export const blocks = (f: Finding): boolean;                 // invalid, or a shared finding with answer null
export const needsSheet = (findings: Finding[]): boolean;
export const gbText = (bytes: number): string;               // 9663676416 -> "9 GB" (bytes / 2^30, rounded)
```

2. **Behaviour of `check`**, in this order (the findings come out in this order too, which is the order of the mockup `project-start-check`):
   1. `config` is `{ error }`: return only `{ kind: "invalid", key: "invalid", error }`.
   2. **Ports (C1).** Walk the services in the order of `config.services`. For each service, take its ports that have `published`. Join a run of entries into one block when they have the same `protocol` and `host_ip` and each next entry is one more than the last in both `published` and `target` (this is how a range arrives; two separate neighbours join too, which is harmless). A block has a `wanted` (a number, or `[first, last]`), and a `container` the same way.
      1. Own ports: a port held by a container whose `project` equals `project.composeName` is this project's own and never a collision.
      2. Two ports collide when the protocol is equal and the host addresses overlap: equal, or either one is `""` (every address). `127.0.0.1` and `0.0.0.0` collide; `127.0.0.1` and `127.0.0.2` do not.
      3. A remembered choice (`project.ports`, same service, container, protocol and host ip) names a Mac port `mac`. If `mac` is free (rule 2, and not claimed in this run), use it: emit the finding with `remembered: true, accepted: true`, even when the wanted port is also free. If `mac` is taken, ignore it and go on to rule 4 as a new finding (`remembered: true, accepted: false`).
      4. Else if the wanted port is free: no finding.
      5. Else the finding's `use` is the first number `p` at or above the wanted first port such that every port of the block, `p` to `p + length - 1`, is free and not claimed, and `p + length - 1 <= 65535`. `by`: for a container holder `"<project> · <service>"` when it has both, else the container's name; for a process `"another app on this Mac (<name>)"` and `byProcess: true`.
      6. A port a finding takes is "claimed", so two services never get the same new port. A port a service keeps (no finding) is claimed too.
      7. `key` is `port:<service>:<protocol>:<hostIp>:<container text>` (`5432` or `8000-8010`).
   3. **Fixed names (C3).** For each service with `container_name`: if it is in `state.containers` with `project !== project.composeName`, and `project.renamed` does not hold the service: `{ kind: "name", key: "name:<service>", service, fixed, becomes: "<composeName>-<service>-1", by: <that container's project or name> }`.
   4. **Shared names (C4).** For each key of `config.volumes` and `config.networks` where `external` is not true, and the resolved `name` is not one of the two defaults (`<composeName>_<key>`, which cannot collide): it collides when `state.volumes` (or `networks`) holds the name with `project !== project.composeName`, or an `others[].volumes` (or `networks`) holds the same name. Emit `{ kind: "shared", key: "shared:<type>:<name>", type, name, resourceKey, with: <the other project's name, or "another project">, answer }`. `answer` is `"share"` when `project.shared` holds the name, `"separate"` when `project.separate` holds it, else `null`.
   5. **External (C4, information).** For each `external: true` volume or network that an `others[]` entry also lists (by name): `{ kind: "external", ..., with: <other name> }`.
   6. **Memory (C5).** `asks` is the sum of the declared limits (`mem_limit` or `deploy.resources.limits.memory`, read with `parseMem`; a service with none counts 0) of this project plus the `memory` of every `others[]` entry with `running: true`. `has` is `state.memory`. Emit when `has !== null`, `asks > 0` and `asks > has`.
   7. **Host network (C6).** Every service with `network_mode: "host"`.
   8. **Same image (C7).** A service with `build` and `image` set, where some `others[].builds` holds the same image text.
   9. **Build (information).** One finding listing the services that have `build`, when there is at least one.
3. `blocks(f)`: `f.kind === "invalid"` or (`f.kind === "shared"` and `f.answer === null`). `needsSheet(findings)`: some finding blocks, or some finding is `memory`, or some `port` finding has `accepted: false`, or some `name` finding exists. A host, image, external or build finding never opens the sheet alone (decision of this work order: they are warnings about the file, not about this moment, and would nag at every start. They appear in the sheet when it opens for another reason).
4. **The answers and the override.** Also in `projectCheck.ts`:

```ts
export type PortLine = { hostIp: string; mac: PortOrRange | null; container: PortOrRange; protocol: "tcp" | "udp" };
export type OverrideInput = {
  services: { service: string; resetName: boolean; ports: PortLine[] | null }[];
  volumes: { key: string; name: string }[];
  networks: { key: string; name: string }[];
};
export type Answers = { ports: Record<string, PortOrRange>; shared: Record<string, "share" | "separate"> };   // keyed by finding key
export type Resolution = { blocked: boolean; project: Project; override: OverrideInput };

// Applies the answers: the port the user typed (else the finding's `use`) for each port finding, share or separate for each
// shared finding. Returns the project with `ports`, `renamed`, `shared` and `separate` updated, and the override to write.
export function resolve(project: Project, config: ComposeConfig, findings: Finding[], answers: Answers): Resolution;

// Whether `mac` (the first port of the block) is a good choice for this finding, or why not (words for the sheet).
export function checkChoice(f: PortFinding, mac: number, state: EngineState, project: Project): string | null;
```
   1. `resolve`, ports: `project.ports` keeps every choice that no finding replaced, and gets one `PortChoice` per port finding (`mac` is `answers.ports[f.key] ?? f.use`; the same shape as `container`). A choice for a block whose wanted port is now free and had no finding is kept as it was.
   2. `resolve`, renamed: `project.renamed` plus every service of a `name` finding.
   3. `resolve`, shared: for each `shared` finding, its answer (from `answers.shared[f.key]`, else the finding's own) puts `name` in `project.shared` or `project.separate`. `blocked` is true when an answer is missing for one of them, or an `invalid` finding exists.
   4. `resolve`, override. A service is in the override when it has a port finding (new or remembered, `use` differs from `wanted`) or its name is reset (in `project.renamed` after step 2 and the config has a `container_name` for it, or a `name` finding). For such a service: `resetName` is true when `container_name` is set and the service is in `renamed`; `ports` is the service's WHOLE list from the config, in order, each entry (or block) with its chosen Mac port when it has a choice, else its wanted port; an entry with no `published` has `mac: null`. A service with only a reset name has `ports: null`. `volumes` and `networks` hold `{ key: resourceKey, name: "<composeName>_<name>" }` for each `separate` answer (`name` is the resolved explicit name, for example `pgdata` gives `billing_pgdata`). The services are listed in the order of the config.
   5. `checkChoice`: `null` when the whole block (`mac` to `mac + length - 1`) is between 1024 and 65535 and free by the rules of step 2 (with the claims of the other findings not counted), else one of: `Use a port from 1024 to 65535.` or `Port <n> is used by <by>.` (words added here).
5. `src/lib/projectsIo.ts`: change `writeOverride`'s `input: unknown` to `OverrideInput` (import the type).

**Tests to write first** (`src/lib/projectCheck.test.ts`, node:test, import with `.ts`; a helper `project()` makes a `Project` with `composeName: "billing"`, `dir: "/Users/me/code/billing"`, and empty lists; helpers `cfg(services)` and `state(over)` fill the rest; holders use `shop`, `db`, `web`):

One test per row of the table in spec section 6:
1. R1 `given_a_port_that_is_free_when_checked_then_there_is_no_finding`.
2. R2 `given_5432_published_by_shop_db_when_checked_then_a_port_finding_uses_5433_and_names_shop_dot_db`: `by` is `shop · db`, `use` is 5433, `accepted` is false.
3. R3 `given_5432_listened_on_by_postgres_when_checked_then_the_holder_is_another_app_on_this_mac`: `by` is `another app on this Mac (postgres)`, `byProcess` true.
4. R4 `given_the_container_name_db_is_taken_when_checked_then_the_name_finding_says_billing-db-1`.
5. R5 `given_a_named_volume_pgdata_used_by_shop_when_checked_then_a_shared_finding_has_no_answer_and_blocks`.
6. R6 `given_an_external_network_proxy_used_by_shop_when_checked_then_the_external_finding_does_not_block`.
7. R7 `given_network_mode_host_when_checked_then_a_host_finding_names_the_service`.
8. R8 `given_the_same_built_image_in_shop_when_checked_then_an_image_finding_names_shop`.
9. R9 `given_9_gb_asked_and_8_gb_present_when_checked_then_a_memory_finding_has_both_numbers`: `gbText` gives `9 GB` and `8 GB`; `canResize` follows `state.colima`.
10. R10 `given_a_config_error_when_checked_then_only_an_invalid_finding_is_returned`.
11. R11 `given_two_services_with_build_when_checked_then_a_build_finding_lists_both`.

Behaviour:
12. `given_no_findings_when_asked_then_the_sheet_is_not_needed`.
13. `given_a_new_port_remap_when_asked_then_the_sheet_is_needed`.
14. `given_only_a_host_warning_when_asked_then_the_sheet_is_not_needed`.
15. `given_a_memory_warning_when_asked_then_the_sheet_is_needed`.
16. `given_a_remembered_free_port_when_checked_then_it_is_used_and_accepted_so_no_sheet`: wanted 5432 is also free; the finding says `use` 5433, `remembered` true, `accepted` true.
17. `given_a_remembered_port_that_is_now_taken_when_checked_then_it_is_a_new_finding`: `accepted` false.
18. `given_127_0_0_1_wanted_and_0_0_0_0_taken_when_checked_then_they_collide`; `given_127_0_0_1_wanted_and_127_0_0_2_taken_then_no_finding`.
19. `given_udp_wanted_and_tcp_taken_when_checked_then_no_finding`.
20. `given_a_range_8000_to_8002_and_8001_taken_when_checked_then_the_block_moves_to_8002_to_8004`.
21. `given_the_port_is_held_by_the_projects_own_container_when_checked_then_no_finding`.
22. `given_two_services_wanting_the_same_taken_port_when_checked_then_they_get_different_new_ports`.
23. `given_the_name_service_is_in_renamed_when_checked_then_no_name_finding_and_the_override_still_resets_it`.
24. `given_a_share_answer_when_resolved_then_the_name_is_in_shared_and_not_blocked`; `given_a_separate_answer_then_the_name_is_in_separate_and_the_override_renames_pgdata_to_billing_pgdata`; `given_no_answer_then_blocked_is_true`.
25. `given_a_remap_when_resolved_then_the_override_lists_all_ports_of_that_service`: a service with `5432`, `9187` and a container-only `80`: the list is three lines, only the first changed, the last with `mac: null`.
26. `given_only_a_reset_name_when_resolved_then_ports_is_null`.
27. `given_no_findings_when_resolved_then_the_override_is_empty`: `{ services: [], volumes: [], networks: [] }`.
28. `given_a_port_the_user_typed_when_resolved_then_the_choice_holds_that_port`.
29. `given_a_choice_below_1024_when_checked_then_the_words_are_use_a_port_from_1024_to_65535`; `given_a_choice_that_is_taken_then_the_words_name_the_holder`; `given_a_free_choice_then_null`.
30. `given_a_block_of_three_when_the_choice_leaves_room_for_only_two_before_65535_then_refused`.
31. `given_no_machine_memory_when_checked_then_there_is_no_memory_finding`.
32. `given_other_projects_that_are_stopped_when_memory_is_summed_then_only_running_ones_count`.
33. `given_a_service_with_no_limit_when_memory_is_summed_then_it_counts_zero`.

**The two-project plan test** (ties the TypeScript to the sandbox test of WO-7.8). `src/lib/projectCheck.fixture.test.ts`: read `scripts/fixtures/projects/config-b.json` with `parseConfig`. Project `b`: `composeName: "app-2402"`, `dir` `/Users/me/b/app`. State: `a` is running as project `app` and holds 5432 (`db`) and 8080 (`web`) as containers named `db` and `app-web-1`; no others; memory `null`.
34. `given_the_fixture_with_a_running_when_checked_then_exactly_three_changes`: findings are, in order, port `db` 5432 to 5433, port `web` 8080 to 8081, name `db` becomes `app-2402-db-1`, plus the build finding is absent (no `build:`). `needsSheet` is true.
35. `given_those_findings_when_resolved_then_the_override_equals_the_sandbox_plan`: `override` deep-equals `{ services: [{ service: "db", resetName: true, ports: [{ hostIp: "", mac: 5433, container: 5432, protocol: "tcp" }] }, { service: "web", resetName: false, ports: [{ hostIp: "", mac: 8081, container: 80, protocol: "tcp" }] }], volumes: [], networks: [] }`. The same JSON, as a Rust value, is what `sandbox_two_projects` (WO-7.8) applies.
36. `given_a_after_b_started_when_a_is_checked_then_no_findings`: project `a` (`composeName: "app"`), `b`'s containers running with 5433 and 8081, `db` named `app-2402-db-1`: no finding (a keeps 5432, 8080 and `db`).

**Done when:**
1. `node --experimental-strip-types --no-warnings --test src/lib/projectCheck.test.ts src/lib/projectCheck.fixture.test.ts 2>&1 | tail -8` shows at least 36 passing and 0 failing.
2. `grep -c "^test(" src/lib/projectCheck.test.ts src/lib/projectCheck.fixture.test.ts` prints counts that add up to at least 36.
3. `grep -n "invoke\|window\|document\|react" src/lib/projectCheck.ts` prints nothing (pure).
4. `npx tsc --noEmit` and `npm run lint` print nothing.
5. The gate in `../HANDOFF.md` section 5.

**Pull request title:** the first line of `docs/plan/iterations/pr/wo-7.4a.md` is: `wo-7.4a: The Start check finds port, name, volume, memory and image clashes before a project starts`

---

## WO-7.4b The Start check sheet, and the one function that starts a project

**Needs:** WO-7.4a.

**Why:** the user sees the findings, answers the C4 question, and presses Start (spec sections 6 and 7.3). The sheet is reached from the Projects list in WO-7.5a, so its browser check and mockup comparison are in that work order; this one is proved by component tests.

**Read first:**
1. `docs/plan/07-projects-spec.md` sections 6 and 7.3; `docs/plan/04-design-spec.md` section 7.11.
2. Mockup: `startFinding` and `startCheck` in `docs/plan/design/mockup.html`; the picture `docs/plan/design/shots/project-start-check-light.png`.
3. `src/ui/Banner.tsx`, `src/ui/Sheet.tsx`, `src/ui/Command.tsx` (props are in `iteration-1-work-orders.md`, WO-1.3a and 1.3b).
4. The Run sheet (`src/RunPanel.tsx` or the file WO-3.3a made) for how a sheet with a `Show command` chip is built.
5. `src/ComposeProjects.tsx`: find `runCompose` and how it calls `activity.ran` (the Activity record).
6. `src/lib/compose.ts`: `parseLabels`.

**Starting state** (run all; stop if any output differs):
1. `git status --short | wc -l` prints `0`.
2. `grep -n "tone" src/ui/Banner.tsx | head -3` prints a line with `"bad" | "warn" | "info"`.
3. `ls src/projects 2>&1` says it does not exist.
4. `grep -n "@testing-library/react" package.json` prints one line.
5. `grep -n "ran(" src/ComposeProjects.tsx | head -3` prints at least one line (the call to copy).
6. `ls src/lib/projectCheck.ts preview/projectsMock.ts 2>&1` prints the first path and says the second does not exist.

**Do not touch:** the Containers screen, `src/ComposeProjects.tsx`.

**Steps:**

1. **Banner gets a neutral tone** (the mockup draws an information line as `banner line` with a green check, no tone colour). In `src/ui/Banner.tsx`: change the type to `tone: "bad" | "warn" | "info" | "ok"`. With `tone="ok"` the root is `<div class="banner [line]" role="status">` (no `ok` class: `.banner` alone is the neutral tile) and the `Sev` is `level="ok"`. Every other tone keeps its markup. This is the only change to `src/ui/`; it uses classes that exist (`.banner`, `.banner.line`, `.sev.ok`). Add the test of step 9 to `src/ui/Banner.test.tsx`.
2. Create `src/projects/findingText.ts` (pure; the words). Every word is quoted here:

```ts
import { gbText, type Finding } from "../lib/projectCheck.ts";
import { portText } from "../lib/projects.ts";

export type Part = { t: string; mono?: boolean; bold?: boolean };
export type Tone = "ok" | "warn" | "bad";

export function findingTone(f: Finding): Tone;   // invalid: bad. shared with no answer, host, image, memory: warn. everything else (port, name, answered shared, external, build): ok
export function findingParts(f: Finding): Part[];
export function ledeText(running: string[]): string;
```
   The sentences (a `[x]` is a part: `{t: x, mono: true}` for names, ports are `bold` when it is the port the project will use):
   1. Port, one port, a container holds it: `Port ` `[wanted]` ` is used by ` `[by, mono]` `. This project will use ` `[use, bold]` `.` Example text: `Port 8080 is used by shop · web. This project will use 8081.`
   2. Port, a process holds it (`byProcess`): `Port 5432 is used by another app on this Mac (postgres). This project will use 5433.` (`by` is plain text, not mono).
   3. Port, a range: `Ports 8000 to 8010 are used by shop · web. This project will use 8100 to 8110.` (for a range, `portText` with `-` replaced by ` to `).
   4. Name: `The name ` `[fixed, mono]` ` is taken. This project's container will be ` `[becomes, mono]` `.`
   5. Shared volume: `Both projects use the volume ` `[name, mono]` `. They would share the same database files.` Shared network: `Both projects use the network ` `[name, mono]` `. They would share the same network.`
   6. External: `Shares the volume ` or `network ` `[name, mono]` ` with ` `[with, mono]` `.`
   7. Host: `[service, mono]` ` uses the machine's network. OpenPier cannot move its ports.`
   8. Image: `[with, mono]` ` also builds ` `[image, mono]` `. Each build replaces the other's image.`
   9. Memory: `These projects ask for 9 GB. The machine has 8 GB.` (numbers from `gbText`).
   10. Build: `2 services will be built first. This can take a few minutes.` One service: `1 service will be built first. This can take a few minutes.`
   11. Invalid: `Compose can't read this project's files.`
   12. `ledeText(running)`: with names, `shop is running and uses some of the same things. This project will start next to it. Your Compose file is not changed.`; with two names, `shop and api are running and use some of the same things. This project will start next to them. Your Compose file is not changed.`; with none, `Some of what this project wants is already in use. It will start with changes. Your Compose file is not changed.` (sentences 1 to 3 are the mockup's; the last is added here). Three or more names: `shop, api and web`.
3. Create `src/projects/engineState.ts`: reads what the check needs, and has the pure parsers the node tests cover.

```ts
import type { EngineState, OtherProject, ComposeConfig } from "../lib/projectCheck.ts";
import type { Project, ProjectsFile } from "../lib/projects.ts";

// `docker ps -a --format '{{json .}}'` -> every container with the Compose project from its Labels.
export function containersOf(out: string): { name: string; project: string | null }[];
// `docker volume ls` and `docker network ls`, same format: Name and the Compose project from Labels.
export function resourcesOf(out: string): { name: string; project: string | null }[];
// One other saved project: its resolved config, whether it runs, its builds, volumes, networks and declared memory.
export function otherOf(p: Project, config: ComposeConfig | null, running: boolean): OtherProject;
// Everything above plus ports_in_use and the machine's memory, for the selected engine. `colima` is engine.kind === "colima".
export async function loadEngineState(args: { context: string; project: Project; file: ProjectsFile; colima: boolean }): Promise<EngineState>;
```
   `loadEngineState` runs these in parallel: `portsInUse(context)`, `docker(context, ["ps", "-a", "--format", "{{json .}}"])`, the same for `["volume", "ls", "--format", "{{json .}}"]` and `["network", "ls", "--format", "{{json .}}"]` (use `docker` from `src/api.ts`, whose signature you read first), `engineMemory(context)`, and for each other saved project `projectConfig({ context, projectId })` (an error becomes `null`: that project adds nothing). `running` for an other project: a container with `project === other.composeName` and the state running (from the `ps` rows' `State`). One failed read of `ports_in_use` stops the check: let the error go up (the caller shows it).
4. Create `src/projects/useStartProject.ts`. One function starts a project, and nothing else does (the list row, the detail header, the palette and the Compose sheet all call it):

```ts
export type StartRequest = { project: Project; config: ComposeConfig | { error: string }; findings: Finding[]; state: EngineState };
export function useStartProject(): {
  start: (project: Project) => Promise<void>;     // resolves when the project has started, or the user cancelled
  pending: StartRequest | null;                   // not null while the sheet is open
  confirm: (answers: Answers) => Promise<void>;   // the sheet's Start
  cancel: () => void;
  busy: Set<string>;                              // project ids that are starting
};
```
   `engine` is `useEngine()` from `src/lib/engines.ts` (WO-4.2a) and `context` is `engine.id`. When `engine` is `null` the hook's `start`, `confirm` and `apply` do nothing, and the page that uses it draws the no-engine state the other pages draw.
   Behaviour of `start(project)`:
   1. Add the id to `busy`. Read `projects_read` for the whole file. `projectConfig({ context: engine.id, projectId })`, then `parseConfig`. `loadEngineState`. `check`.
   2. If `needsSheet(findings)`: set `pending`; return (the id stays in `busy` until `confirm` or `cancel`).
   3. Else call the shared `apply` with empty answers.
   `apply(request, answers)`: `resolve(project, config, findings, answers)`; when `blocked`, stop. `updateProjects((f) => replaceProject(f, { ...res.project, engineId: engine.id }))`. `writeOverride({ id, input: res.override })`. `projectValidate`. Then `composeProject({ context, projectId, action: "up" })` and record it with `activity.ran` the way `runCompose` does, with the command text from `projectCommand({ context, projectId, action: "up" })`. Then `queryClient.invalidateQueries({ queryKey: [engine.id] })` and `queryClient.invalidateQueries({ queryKey: PROJECTS_KEY })`.
   Errors: any failure shows `toast({ text: "<first line of the error>" })` and leaves the project as it was. A `projectValidate` failure never reaches `up`.
   A second `start` for an id already in `busy` does nothing.
5. Create `src/projects/StartCheck.tsx`. Default export `StartCheck`. Props:

```ts
type Props = {
  request: StartRequest | null;       // null: closed
  running: string[];                  // names of the other projects that run now, for the lede
  commandText: string;                // from projectCommand(...), fetched by the parent when the sheet opens
  busy: boolean;
  onStart: (answers: Answers) => void;
  onCancel: () => void;
};
```
   The tree (the mockup's, as components; every class is in `container-ui.css`):

```
<Sheet open={!!request} onClose={onCancel} title={`Start ${project.name}`} stack busy={busy}
       footer={<><Button size="md" variant="ghost" onClick={onCancel}>Cancel</Button>
                 <Button size="md" variant="primary" disabled={blocked} busy={busy} onClick={...}>{memory ? "Start anyway" : "Start"}</Button></>}>
  <p className="lede">{ledeText(running)}</p>
  {findings.filter(shown).map(f => <Banner key={f.key} tone={findingTone(f)} actions={controlsOf(f)}>{parts}</Banner>)}
  <div className="form-row"><ChipButton icon="chev-right" aria-expanded={showCommand} onClick={...}>Show command</ChipButton></div>
  {showCommand && <Command text={commandText} />}
</Sheet>
```
   1. `parts` is drawn as text with `<span className="mono">` for `mono` parts and `<b>` for `bold`.
   2. Controls: a port finding on a container: `<Button size="xs">Use another…</Button>`. A click replaces the sentence's number by a `<Field width="port" size="sm" aria-label="Port on this Mac for {service}" inputMode="numeric">` filled with the proposed first port and a `<Button size="xs" variant="primary">Use</Button>`; `Use` runs `checkChoice`; on `null` it stores the number (the sentence now shows it) and closes the field; on an error text it shows that text in place of the sentence and keeps the field. Enter submits, Escape closes the field (and not the sheet: stop the event).
   3. A `shared` finding: `<Button size="xs" aria-pressed>Share it</Button>` and `<Button size="xs" variant="primary" aria-pressed>Keep separate</Button>` (the second is the primary one, as in the mockup). A click sets the answer; the tone becomes `ok` once answered. `Start` stays disabled until every shared finding has an answer (and there is no `invalid` finding).
   4. A memory finding on Colima: `<Button size="xs">Resize…</Button>` which calls `go("#/settings/machines")` and `onCancel()`. On another engine: no button.
   5. An `invalid` finding: a `<ChipButton icon="chev-right" aria-expanded>Details</ChipButton>` under it; open, it shows the raw text in `<Canvas aria-label="Compose error" lines={...} />` (one line per line of the error).
   6. Which findings are shown: all of them. `accepted` port findings are shown too when the sheet is open (they are part of what will happen).
   7. `onStart` passes `{ ports: <the numbers typed, by finding key>, shared: <answers, by finding key> }`.
   8. The project's name in the title is `project.name`. `Escape` and the overlay close the sheet (the `Sheet` does it). Focus returns to the button that opened it (the `Sheet` does it).
6. In `src/projects/useStartProject.ts` also export `StartCheckHost`: a component that calls the hook's `pending`, fetches `commandText` and `running`, and renders `<StartCheck />`. Pages place one `<StartCheckHost />` and call `start` from a shared context (`StartProjectProvider`, `useStartProjectContext`), so every caller shares one sheet. WO-7.5a mounts the provider inside the page outlet of the shell.
7. **The mock** (`preview/projectsMock.ts`, new). The mock backend answers the commands of WO-7.1 to 7.3 so the screens work in the browser. Its shape, used by every later work order:

```ts
export const NOT_HANDLED: unique symbol;
// Called first by `invoke` in preview/mock.ts. Returns NOT_HANDLED for any command it does not own.
export function projectsInvoke(cmd: string, a: Record<string, any>): Promise<unknown> | typeof NOT_HANDLED;
// Called once after the mock's data is built, when the address has &projects=1 or &projects=2.
export function seedProjects(db: { ctrs: any[] }): void;
```
   In `preview/mock.ts`: import both; at the top of `export async function invoke<T>` add `const pm = projectsInvoke(cmd, a); if (pm !== NOT_HANDLED) return (await pm) as T;`; after `const db = {...}` is built add `seedProjects(db);`. The mock holds (in module variables, shown by `window.__mock.projects()`):
   1. `file`: the projects.json content. With neither flag it starts empty (`projects_read` gives `{version:1, projects:[], missing:[], home:"/Users/me"}`). `&projects=1` seeds the three saved projects of the mockup `projects`: `shop` (id `11111111-shop`, folder `/Users/me/code/shop`, 7 services), `billing` (`22222222-billing`, `/Users/me/code/billing`, 3 services, running, with `ports` remembered 8081 and 5433, `renamed: ["db"]`, `separate: ["pgdata"]`), `search` (`33333333-search`, `/Users/me/work/search-service`, 4 services, not started). `&projects=2` is the same, but `billing` is not running and has no remembered choices, so Start shows the sheet of the mockup `project-start-check`.
   2. The Compose config of each project (the shape of `config-b.json`): `shop`: `web` 8080:80, `db` 5432:5432 with `container_name: db` and the volume `pgdata` with the explicit `name: pgdata`, and five more services (`api`, `worker`, `cache`, `mail` 8025:8025, `proxy`). `billing`: `web` 8080:80, `db` 5432:5432 with `container_name: db` and the explicit volume `pgdata`, `mail` 8025:8025. `search`: four services without ports. `compose_config` for a project answers this JSON (a `name` field, `ports` as one entry per port, `published` a string).
   3. Which services run: `shop`: `web`, `db`, `api`, `worker`, `cache` (5 of 7); `billing` with `projects=1`: all three; `search` and `billing` with `projects=2`: none.
   4. `ports_in_use` answers the ports of the running services as container holders (`shop · web` on 8080, `shop · db` on 5432; with `projects=1` also `billing · web` on 8081 and `billing · db` on 5433), plus one process holder, port 9000, `another app`, pid 4242.
   5. `engine_memory` answers 8 GB (8589934592). `compose_version` answers `2.29.7` (`&composeold=1` answers `2.20.0`).
   6. `compose_action` with a `projectId`: waits 600 ms, sets all that project's services running, creates or updates the matching containers in `db.ctrs` (names `<composeName>-<service>-1`, or the fixed name when `container_name` is set and not reset, labelled `com.docker.compose.project=<composeName>,com.docker.compose.project.working_dir=<dir>,com.docker.compose.service=<service>`; when a container of that name exists, leave it), and pushes `{ projectId, action, context }` onto `window.__composed` (the array the old Compose check reads). `stop` and `down` mark them stopped or remove them. `compose_down` with `volumes: true` also records `window.__removedVolumes`. The first start of a project with `window.__mock.failStart("<composeName>")` set throws the text `Error response from daemon: Ports are not available: exposing port TCP 0.0.0.0:8080 -> 0.0.0.0:0: listen tcp4 0.0.0.0:8080: bind: address already in use`.
   7. `project_override_write` stores the YAML text built by the same code as WO-7.2 would build; the mock keeps a small TypeScript twin `overrideText(input)` only for display, and says so in a comment (the Rust function is the real one). `project_override_read` returns it. `project_command_line` answers `docker --context colima compose -p <composeName> --project-directory <dir> -f <dir>/compose.yaml -f /Users/me/Library/Application Support/dev.openpier.desktop/projects/<id>/override.yaml up -d` with the path parts shell-quoted by `quoteArg` of the same shape as the Rust one.
   8. `projects_write` replaces `file`. `project_name_decide` follows the table of WO-7.1 (a TypeScript twin, comment says so). `compose_ls` answers one row for `kafka-local` (`/Users/me/scratch/kafka/compose.yaml`, `running(2)`) plus the saved running projects. `compose_logs` with a `projectId` answers 40 lines `<container>  | <time> <text>` over the project's running services, `web` printing `GET /health 200`.
   9. Later work orders add to this file; none changes what is listed here.

**Tests to write first:**

`src/ui/Banner.test.tsx` (add): `given_tone_ok_when_rendered_then_the_root_is_a_banner_with_no_tone_class_and_a_green_check`: root has class `banner`, not `ok`, not `info`; contains an element with classes `sev ok`; `role` is `status`. `given_tone_ok_and_no_title_then_the_root_has_class_line`.

`src/projects/findingText.test.ts` (node:test): one test per sentence 1 to 12 above, comparing the joined text; plus `given_a_range_when_worded_then_to_replaces_the_dash`, `given_one_service_to_build_then_the_words_are_singular`, `given_three_running_projects_then_the_lede_lists_them_with_and`, `findingTone` for each kind (ok, warn, bad; an answered `shared` is `ok`).

`src/projects/engineState.test.ts` (node:test): `given_ps_json_lines_when_read_then_names_and_projects` (a container with no Compose label has `project: null`); `given_volume_ls_json_when_read_then_names_and_projects`; `given_an_other_project_with_two_builds_when_read_then_builds_lists_their_images`; `given_an_other_project_that_is_stopped_then_running_is_false_and_memory_is_still_counted`; `given_a_config_that_could_not_be_read_then_the_other_project_adds_nothing`.

`src/projects/StartCheck.test.tsx` (vitest and testing-library; render with the providers the Run sheet's test uses):
1. `given_the_four_findings_of_the_mockup_when_rendered_then_the_four_sentences_show`: the texts of `startFinding` in the mockup (ports 8080 to 8081 and 5432 to 5433, `The name db is taken. This project's container will be billing-db-1.`, `Both projects use the volume pgdata. They would share the same database files.`).
2. `given_an_unanswered_shared_finding_when_rendered_then_Start_is_disabled`; `when_Keep_separate_is_clicked_then_Start_is_enabled_and_onStart_gets_shared_separate`; `Share_it_gets_share`; the clicked button has `aria-pressed="true"`.
3. `given_Use_another_when_a_taken_port_is_typed_then_the_error_names_the_holder_and_the_field_stays`: words `Port 8080 is used by shop · web.`; `when_a_free_port_is_typed_then_the_sentence_shows_it_and_onStart_gets_it`.
4. `given_a_port_below_1024_when_typed_then_the_words_are_use_a_port_from_1024_to_65535`.
5. `given_a_memory_finding_on_colima_when_rendered_then_Resize_shows_and_the_button_reads_Start_anyway`; `given_another_engine_then_no_Resize`.
6. `given_an_invalid_finding_when_rendered_then_Start_is_disabled_and_Details_shows_the_raw_text`.
7. `given_Show_command_when_clicked_then_the_command_text_and_a_copy_button_show`.
8. `given_Cancel_or_Escape_then_onCancel_runs_once`.
9. `given_the_sheet_when_rendered_then_its_title_is_Start_billing_and_the_lede_names_the_running_projects`.
10. `given_a_host_warning_and_a_port_finding_then_both_show_and_the_host_one_is_a_warn_banner`.

`src/projects/useStartProject.test.tsx` (vitest; `invoke` mocked with a table of answers):
11. `given_no_findings_when_start_is_called_then_the_override_is_written_validated_and_up_runs_in_that_order_with_no_sheet`: the calls arrive as `project_override_write`, `compose_validate`, `compose_action`.
12. `given_a_new_remap_when_start_is_called_then_the_sheet_is_pending_and_nothing_runs`; `when_confirm_runs_then_projects_write_holds_the_choice_and_engine_id_and_up_runs`; `when_cancel_runs_then_nothing_runs_and_busy_is_empty`.
13. `given_validate_fails_when_start_runs_then_up_is_not_called_and_a_toast_shows_the_first_line`.
14. `given_a_start_in_progress_when_start_is_called_again_then_nothing_happens`.
15. `given_a_blocked_shared_finding_when_confirm_has_no_answer_then_nothing_is_written`.

**Done when:**
1. `npx vitest run src/projects src/ui/Banner.test.tsx 2>&1 | tail -6` shows 0 failed; `node --experimental-strip-types --no-warnings --test src/projects/*.test.ts` passes (at least 12 tests); `grep -c "it(\|test(" src/projects/StartCheck.test.tsx src/projects/useStartProject.test.tsx` adds up to at least 15.
2. `grep -rn "style=" src/projects` prints nothing; `grep -rn "<button\|<select\|<table" src/projects` prints nothing; `grep -rn "ui/op" src/projects` prints nothing.
3. `grep -n "projectsInvoke" preview/mock.ts | wc -l` prints at least 2 and `npm run preview` still starts (the preview builds: `node scripts/build-preview.mjs` exits 0).
4. `sh scripts/check-all.sh` prints no `FAIL` (the Containers checks still pass with the mock change).
5. By eye, after WO-7.5a: the sheet looks like `project-start-check-light.png` (checked there).
6. The gate in `../HANDOFF.md` section 5.

**Pull request title:** the first line of `docs/plan/iterations/pr/wo-7.4b.md` is: `wo-7.4b: Starting a project shows what will change first, and one function starts it`

---

## WO-7.5a Projects: the list, its actions, Add project, and Projects in the sidebar

**Needs:** WO-7.4b.

**Why:** the first screen of the feature (spec 7.1 items 1 to 3, 5 and 7; task 7.5). The promise of spec section 1 starts here: add a folder, press Start. Also turns on `Cmd+1` and the sidebar item that iteration 2 held back.

**Read first:**
1. `docs/plan/07-projects-spec.md` section 7.1; `docs/plan/04-design-spec.md` sections 5.2, 7.11 and 8.
2. Mockup functions `prow`, `projectsHead`, `projectsList` in `docs/plan/design/mockup.html`; pictures `shots/projects-light.png` and `projects-dark.png`.
3. `src/Containers.tsx` and `src/containers/*` as WO-3.1b and WO-3.1c left them (the pattern to copy: header, search, group rows, row menu, the eight states, the Remove confirm).
4. `src/lib/containerRows.ts`: `stateView`, `blockOf`, `hostPorts`, `portCell`, `runningText`, `sortEntries`, `summary`.
5. `src/Shell.tsx` (the sidebar), `src/lib/shortcuts.ts` (find `go-projects`), `src/App.tsx` (find where `route.page` picks the page).
6. `src/lib/composeScan.ts`: `whyFailed`, `portHolder`.
7. The Compose sheet, `src/ComposeProjects.tsx`: how it opens a Compose file (`compose_editor`), reveals one (`reveal_compose`), and picks a folder (`pick_folder` with purpose `"compose"`).

**Starting state** (run all; stop if any output differs):
1. `git status --short | wc -l` prints `0`.
2. `ls src/Projects.tsx 2>&1` says it does not exist; `ls src/projects/StartCheck.tsx src/projects/useStartProject.ts` prints both.
3. `grep -n "go-projects" src/lib/shortcuts.ts` prints one line that holds `pending: true`.
4. `grep -n "projects" src/App.tsx | head -5` shows where the `projects` route lands today (Containers, or nothing). Note the place.
5. `grep -rn "See why" src --include=*.tsx -l | head -3` prints at least one file (the handler to reuse).
6. `grep -rn "useContainers\b" src --include=*.ts --include=*.tsx -l | head -3` prints at least one file. Note the hook's real name and what it returns; use it wherever this work order says "the containers query".
7. `grep -n "pick_folder\|pickFolder" src/api.ts src/ComposeProjects.tsx | head -3` prints the call to copy.
8. `grep -n "scenario === \"design\"\|\"design\"" preview/mock.ts | head -2` prints at least one line (the `design` scenario exists).
9. `grep -c "check(" scripts/check-palette.mjs scripts/check-shortcuts.mjs 2>&1 | head -3` prints counts (the checks that assert `Cmd+1` does nothing; step 11 changes them).

**Do not touch:** `src/Containers.tsx` (WO-7.7 does), `src/ComposeProjects.tsx`, the detail page (WO-7.6).

**Steps:**

1. **Row model** (pure). Create `src/lib/projectRows.ts`:

```ts
import type { Project } from "./projects.ts";
import type { DotState } from "../ui";

export type ServiceBlock = { name: string; state: "ok" | "warn" | "bad" | "busy" | "off"; label: string };   // use the real BlockState of src/ui/Blocks.tsx
export type ProjectRow = {
  project: Project;
  dot: DotState;
  running: number;
  total: number;                       // services in the Compose file; the containers found when the file can't be read
  stateText: string;                   // "5 of 7 running", "3 of 3 running", "Not started", "Folder not found"
  folder: string;                      // dir with ~
  ports: number[];                     // the ports on this Mac of its running containers, ascending
  blocks: ServiceBlock[];
  problem: { level: "bad" | "warn"; text: string; container: string } | null;
};

type Box = { name: string; project: string | null; service: string | null; state: string; ports: number[]; problem?: { level: "bad" | "warn"; short: string } };
export function projectRows(a: { projects: Project[]; boxes: Box[]; services: Record<string, string[]>; missing: string[]; home: string }): ProjectRow[];
export function projectSummary(rows: ProjectRow[]): string;           // "3 · 2 running"; "" when there are no rows
export function matchesProject(row: ProjectRow, term: string): boolean;  // the Containers search rule (fuzzy on name, folder, service names)
```
   1. `boxes` come from the containers query (one per container: its Compose project and service from the labels, its state, its Mac ports from `hostPorts`, and its worst problem from the same function Containers uses for its problem line). `services[id]` is the service names of the project's resolved config (step 3), in file order.
   2. `running` counts the project's boxes whose state is running. `total` is `services[id].length`, or the number of boxes when no config is known.
   3. `stateText`: a missing folder: `Folder not found`; `running === 0`: `Not started`; else `{running} of {total} running`.
   4. `dot`: missing folder `warn`; no running: `off`; any problem `bad` makes `bad`; any `warn` problem makes `warn`; `running < total` with no problem is `warn`; else `ok`.
   5. `problem`: the worst problem among the project's boxes (`bad` before `warn`; the first by service order on a tie), text `<service>: <short>` (for example `api: its health check is failing`), `container` is the box name.
   6. `blocks`: one per service of `services[id]` in order. A service with a box takes `blockOf` of that container; a service with no box is `off`. `label` is `<service>: <state words>` as Containers words its blocks.
   7. `ports`: the unique Mac ports of the running boxes, ascending.
   8. Sorting: projects with a problem first, then by `name`, case-insensitive (the mockup order: shop with its problem, billing, search is by name after the problem group).
2. **Queries and the page data.** Create `src/projects/useProjects.ts`:

```ts
export function useProjects(): { file: ProjectsRead | undefined; error: unknown; refetch: () => void; isLoading: boolean }
// useQuery({ queryKey: PROJECTS_KEY, queryFn: readProjects, refetchInterval: false })
export function useProjectServices(projects: Project[]): Record<string, string[]>
// one useQuery per project: key [engine.id, "project-config", project.id], queryFn: parseConfig(await projectConfig(...)); keep only the service names; staleTime 30000; an error gives []
```
3. **The page.** Create `src/Projects.tsx`, default export `Projects`. It renders its own `Header` like `src/Containers.tsx` (title `Projects`, `summary={projectSummary(rows)}`, then the children in this order: the search `Field` and the primary `Add project` button with the `plus` icon). Look at `header` in the mockup before choosing which header props to pass: pass `meters` exactly when `projectsHead` shows them (copy how Containers passes them).
   1. Search: `<Field icon="search" placeholder="Search projects" aria-label="Search projects" onClear={...} />`. The rule is `matchesProject`.
   2. The list: `<List aria-label="Projects">`, first the `RowHead menuGap` with the cells of `projectsList` in the mockup (copy how `src/containers/` writes its head): Project, Folder, Services, CPU, 10 min, Ports, State.
   3. One `Row` per project (the tree of `prow`):

```
<Row lead={<Dot state={dot} label={stateText} />}
     name={project.name} nameClass="plain"
     title={`${project.name}\n${project.dir}`}
     meta={folder}
     action={<Button size="sm">Start | Stop</Button>}     // default button; busy words below
     menu={<ProjectMenu .../>}
     onOpen={() => go(buildPath({ page: "projects", id: project.id }))}>
  <Blocks services={blocks} />
  <Sparkline points={cpuHistory} label="CPU, 10 min" />
  <Col kind="ports">{ports.map(p => <a className="port" href="#" aria-label={`Open port ${p} in the browser`} onClick={...}>:{p}</a>)}</Col>
  <Col kind="state-wide">{stateText}</Col>
</Row>
{problem && <Problem level={problem.level} text={problem.text} action={<Button size="xs">See why</Button>} />}
```
      The port links are built by the cell Containers already uses for its ports column (copy it, with `openUrl` from `src/api.ts`); do not write a second one. A project that is not running shows no `Blocks` colour: `Blocks` draws its `off` cells and no `Sparkline` (`points={null}`). `cpuHistory` is the element-wise sum of the CPU histories of its running containers, from the source Containers' sparkline reads (`grep -rn "Sparkline" src` shows it); `null` when there is none.
   4. The action word: `Start` when `running === 0`, else `Stop`. While the action runs the button shows `Starting…` or `Stopping…` (`busy`, `aria-disabled`) and the row's dot is `busy`. The row does not move. `Start` calls `useStartProject().start(project)`; `Stop` calls `composeProject({ context, projectId, action: "stop" })` and records it in Activity the way `runCompose` does.
   5. A failed action keeps the old state and shows under the row `<Problem level="bad" text={plain reason} action={<Button size="xs">Try again</Button>} />`. The plain reason is `whyFailed(error, containers)` (it names who holds a port, "Port 8080 is used by web (in shop)."), else the first line of the error. The raw text is the `title` of the line. `Try again` runs the same action again and clears the line.
   6. The sheet: mount `<StartProjectProvider>` around the page outlet in `src/Shell.tsx` or `src/App.tsx` (where the page element is drawn), and one `<StartCheckHost />` inside it. Change `useStartProject` so a failure no longer toasts: it records `errors: Record<string, string>` (by project id) and exposes `clearError(id)`; the page shows them as in item 5. The failure of `start` that happens before `up` (a `validate` error) is recorded the same way.
4. **The row menu.** `ProjectMenu` is `<Menu wide label={`More actions for ${name}`} trigger={<MoreButton name={name} />}>` with these items, in this order (words in quotes; the hints are the `why` of `MenuItem`):
   1. `Open folder`: reveals the folder (`reveal_compose` with the first Compose file).
   2. `Open Compose file`: the same call the Compose sheet makes for `compose_editor`.
   3. `Restart`: `composeProject({ action: "restart" })`. Disabled when not running.
   4. `Rebuild and start`, hint `After you change a Dockerfile or the code it copies in`: action `build` (through `start`, so the check runs).
   5. `Pull newer images`, hint `When a newer version of an image is out`: action `pull` (through `start`).
   6. `MenuSeparator`.
   7. `Stop and remove containers`, hint `Volumes and data are kept`: first `confirm({ title: "Remove the containers of {name}?", body: "Volumes, and the data in them, stay.", confirm: "Remove containers", danger: true })`, then `composeDown({ volumes: false })`. Cancel runs nothing.
   8. `Delete data…` (`danger`), hint `Removes the containers and their volumes`: see step 5.
   9. `Remove from OpenPier`, hint `Containers and files are not touched`: `confirm({ title: "Remove {name} from OpenPier?", body: "Its containers and files are not touched. OpenPier forgets the ports it moved.", confirm: "Remove from list" })`, then `updateProjects(removeProject)`. (Words in items 8 and 9 are added here.)
   When a project's folder is missing, the menu holds only `Remove from OpenPier`.
5. **Delete data.** Create `src/lib/projectData.ts` (pure):

```ts
// The volumes `down -v` would remove: the project's own volumes from its resolved config (not external), that exist on the engine.
export function projectVolumes(config: ComposeConfig, existing: string[]): string[];
// `docker system df -v --format json` -> a map from volume name to the size text Docker prints ("1.2GB").
// Not verified: the key names of the Volumes entries. This reads `Name` and `Size`, and returns an empty map for anything else.
export function volumeSizes(dfJson: string): Map<string, string>;
```
   `Delete data…` reads the config (`projectConfig`), `docker volume ls --format '{{json .}}'` for `existing`, and `docker system df -v --format json` for sizes (both through `docker` of `src/api.ts`; if the size read fails, show the names with no size). Then `confirm({ title: "Delete the data of {name}?", body: <the volume list, one line each: "pgdata, 1.2GB", or only the name when the size is unknown>, command: <the `down -v` line from projectCommand with action down>, confirm: "Delete data", danger: true })`. With no volume the body says `This project has no volumes. Only its containers are removed.` Only after Confirm: `composeDown({ volumes: true })`. Cancel runs nothing.
6. **Add project.** Create `src/projects/AddProject.tsx`, default export `AddProject` with props `{ open: boolean; onClose: () => void; onAdded: (p: Project, start: boolean) => void }`, and the hook `useAddProject()` that returns `{ begin(): Promise<void>; sheet: JSX.Element }`.
   1. `begin()` opens the system folder picker with the same call the Compose sheet uses (purpose `"compose"`). A cancel does nothing. A folder that is hidden or in `~/Library` is refused with the Compose sheet's words `Hidden folders and ~/Library can't be added`. Then `compose_in_folder(dir)` lists the Compose files in it; none: the sheet is not opened, a toast says `No Compose file in that folder`. Then the sheet opens.
   2. The sheet (`Sheet` titled `Add project`, `stack`): a `Facts` line with the folder (`~` form). A `FormRow label="Compose files"` with one `Checkbox` per detected file. Ticked by default: the primary file (the first found of `compose.yaml`, `compose.yml`, `docker-compose.yaml`, `docker-compose.yml`) and a `*.override.*` file of the same base; the rest unticked. At least one must stay ticked (the `Add` buttons are disabled otherwise). A `FormRow label="Name"` with a `Field` that holds the folder name (at most 80 characters). When the Compose name differs from the folder's name, a `Facts` line `Compose name` with `app-2402` and a `FormRow` hint: `Docker uses this name for its containers. It never changes.` (hint words added here). When any service of the file has `profiles`, a `FormRow label="Profiles"` with one `Checkbox` per profile, all unticked.
   3. Reading what the sheet needs: `compose_config` for the first ticked file with `file` (the legacy branch) and `allProfiles: true` gives `name` and the profiles. `decideName({ dir, configName: config.name, running })` gives the Compose name; `running` is built from the containers query (`com.docker.compose.project` and `com.docker.compose.project.working_dir` labels). While it reads, the buttons are disabled and the sheet shows `SkeletonRows rows={2}`. An error shows a `Banner tone="bad" title="Couldn't read this project"` with the first line.
   4. Foot: `Cancel` (ghost, md), `Add` (md), `Add and start` (md, primary). Both `Add` buttons write: `updateProjects(addProject(file, project))` with `project = { id: newProjectId(), name, composeName: decision.name, dir, files: ticked in order, profiles: ticked, engineId: engine.id, ports: [], shared: [], renamed: [], separate: [], addedAt: new Date().toISOString() }`; `envFile` is left out. The sheet closes, a toast says `Added {name}`. `Add and start` then calls `start(project)`. The new row is the one in the list (the page sorts it in).
   5. A project whose folder is already saved (same `dir`) is not added twice: the sheet shows a `Banner tone="warn"` line `{name} is already in the list.` and disables both buttons.
7. **Page states** (C4 of iteration 3; scenario names in the table):

| State | How to open it | What shows |
|---|---|---|
| First load | `/?scenario=design&projects=1&slow=1500#/projects` | the header (title and search) and `SkeletonRows` |
| Loaded | `/?scenario=design&projects=1#/projects` | the list |
| Search with no match | type `zzzz-no-match` | `Empty icon="search" title='Nothing matches "zzzz-no-match".'` and a `Clear search` button |
| Engine stopped | `/?scenario=stopped&projects=1#/projects` | the header shows only the title; `Empty icon="box" title="{name} is stopped"` with `Your containers and data are kept. Start the machine to see them.` and a primary `Start {name}` (copy Containers) |
| Engine not reachable | open Loaded, then `__mock.unreach(true)` | `Banner tone="bad" title="Couldn't list projects"` with the first line of the error and a default `Try again`; the rows stay |
| Action running on a row | `__mock.holdNext("compose", 3000)`, click Start on search | `Starting…`, busy dot, row stays |
| Action failed on a row | `window.__mock.failStart("search")`, click Start on search | the bad `Problem` with `Port 8080 is used by web.` or the first line, and `Try again` |
| Projects file unreadable | `/?scenario=design&projects=broken#/projects` | `Banner tone="bad" title="Couldn't read your projects"` with the text and the file path, `Try again`, no rows |
| Empty | no flag | built in WO-7.5b |

   Add to `projectsMock.ts`: `&projects=broken` makes `projects_read` throw `projects.json can't be read: expected value at line 1 column 1. The file is /Users/me/Library/Application Support/dev.openpier.desktop/projects.json.`
8. **Route and sidebar.** In `src/App.tsx` (the place noted in Starting state 4), render `<Projects />` for `route.page === "projects"`; the detail route (`route.id` set) renders `<ProjectDetail />` from WO-7.6a (until then, render `<Projects />` for it too, and WO-7.6a replaces that line). In `src/Shell.tsx` add, as the FIRST item of the main nav, `<NavItem href="#/projects" icon="folder" label="Projects" current={route.page === "projects"} count={projectsCount} />` where `projectsCount` is the number of saved projects (from `useProjects`, hidden while loading). Remove the line in `src/App.tsx` that makes `Projects` show Containers.
9. **Shortcut.** In `src/lib/shortcuts.ts` remove `pending: true` from the `go-projects` entry and its comment. The palette gets its `Projects` item from the same table (WO-2.4). Update the tests WO-2.4 wrote: `src/lib/shortcuts.test.ts` test 4 now says `Given go-projects, When activeShortcuts runs, Then it is in the list`; the Help test 2 now expects `Projects` in "Go to"; `scripts/check-palette.mjs` and `scripts/check-shortcuts.mjs`: the lines that assert `Cmd+1` does nothing now assert that `Cmd+1` changes the hash to `#/projects` (keep their message words, change the condition and the word `nothing`).
10. **Mock data** (extends `preview/projectsMock.ts`, `&projects=1`): the `design` scenario holds these three projects and exactly as the mockup `projects` shows them (without the found project, which WO-7.5b adds) (names `shop`, `billing`, `search`, folders `~/code/shop`, `~/code/billing`, `~/work/search-service`; `shop` 5 of 7 running with `api: its health check is failing`; `billing` 3 of 3 running with ports 8081 and 5433; `search` not started). Print what `window.__mock.state().ctrs` holds for these names first; the seed adds only the containers that are missing, never edits an existing one. Not verified: that the existing `design` containers give "5 of 7" for shop. If the count differs, add or change only the seeded project containers (never the existing ones), and say so in the pull request file.
11. **Browser check.** Create `scripts/check-projects.mjs` on `scripts/lib/check.mjs` (`import { open, check, done } from "./lib/check.mjs"`). Each line below is one `check(condition, message)`; use the messages as written:
    1. `open("/?scenario=design&projects=1#/projects")`: `the page title is Projects`; `the header summary reads 3 · 2 running`; `the sidebar shows Projects first with the count 3`.
    2. `the list has 3 project rows` (`.list .row:not(.th)` that are not found rows); `shop reads 5 of 7 running`; `billing reads 3 of 3 running`; `search reads Not started`; `the folder of shop reads ~/code/shop`.
    3. `shop has a problem line that says api: its health check is failing`; `the line is the .subrow right after the row`.
    4. `billing shows the ports :8081 and :5433 as links`; `the links name their port (Open port 8081 in the browser)`.
    5. `the row button of shop reads Stop and the one of search reads Start`; `the Start button is not the primary one`.
    6. `each ⋯ names its project (More actions for billing)`; `the menu has the nine items in order` (read the menu's item names); `Delete data is marked as danger`; `the hints of Rebuild and start and Pull newer images show`.
    7. `Cmd+1 goes to Projects` (from `#/containers`).
    8. Search: `searching "bill" leaves billing only`; `searching "zzzz-no-match" says Nothing matches "zzzz-no-match".`; `Clear search brings the list back`.
    9. Start without a sheet: open `&projects=1`, click `Start` on search: `Start shows Starting… while it works`; `then search reads 4 of 4 running`; `window.__composed has projectId 33333333-search, action up and context colima`; `the override was written before up` (`window.__mock.calls()` lists `project_override_write` before `compose_action`).
    10. Start with the sheet: open `&projects=2`, click `Start` on billing: `the sheet Start billing opens`; `it shows 4 findings` (2 ports, 1 name, 1 shared); `Start is disabled until the volume question is answered`; `Keep separate enables Start`; `Use another… takes 8090 and the sentence then says This project will use 8090`; `Start closes the sheet and billing reads 3 of 3 running`; `the override shown by the project's Settings holds "billing_pgdata"` is checked in WO-7.6b, not here.
    11. Cancel: `Cancel closes the sheet and __composed did not grow`.
    12. Stop: click `Stop` on billing: `billing reads Not started`; `__composed has action stop`.
    13. Down asks first: choose `Stop and remove containers` on billing: `a dialog asks and says Volumes, and the data in them, stay.`; `Cancel runs nothing` (`__composed` length unchanged); confirm runs `down` without volumes.
    14. Delete data: `the dialog lists pgdata`; `Cancel runs nothing`; confirm: `__removedVolumes` has the project's id.
    15. Remove from OpenPier: confirm; `the row is gone and the sidebar count drops to 2`.
    16. Add project: click `Add project`: with `window.__mock.pickFolder("/Users/me/code/blog")` set before, `the sheet Add project opens with the folder ~/code/blog`; `compose.yaml is ticked`; `the name field holds blog`; `Add disables when no file is ticked`; `Add and start adds blog, closes the sheet, toasts Added blog and blog reads Starting…`. A picked folder `/Users/me/.secret/app` gives the toast `Hidden folders and ~/Library can't be added`.
    17. Already added: picking `/Users/me/code/shop` shows `shop is already in the list.` and both buttons disabled.
    18. Failed start: `__mock.failStart("search")`, click Start: `a problem line appears under search`; `Try again is offered`; `the row still reads Not started`.
    19. States: stopped scenario shows `is stopped`; `unreach(true)` shows `Couldn't list projects`; `&projects=broken` shows `Couldn't read your projects`; the slow open shows the skeleton.
    20. A 980 px wide window has no horizontal scroll: `const small = await open("/?scenario=design&projects=1#/projects", { width: 980, height: 640 })`.
    Add `pickFolder(path)` and `calls()` to the mock (`pick_folder` answers the stored path once; `calls()` returns the list of command names the mock handled, in order).
12. **Mockup rows.** None in this work order: the mockup `projects` shows the `Found on this engine` caption and `kafka-local`, which WO-7.5b builds, so the pair is added there. Here the list is compared by eye (Done when 6).
13. `scripts/not-migrated.json` does not change (new files only). `npm run lint` and `node scripts/check-classes.mjs` pass.

**Tests to write first:**

`src/lib/projectRows.test.ts` (node:test):
1. `given_five_of_seven_running_when_rows_are_built_then_the_state_reads_5_of_7_running`; `given_none_running_then_Not_started_and_the_dot_is_off`; `given_all_running_then_the_dot_is_ok`; `given_a_missing_folder_then_Folder_not_found_and_the_dot_is_warn`.
2. `given_a_bad_problem_on_api_when_rows_are_built_then_the_problem_text_is_api_colon_its_health_check_is_failing_and_the_dot_is_bad`.
3. `given_a_stopped_service_and_no_problem_when_rows_are_built_then_the_dot_is_warn`.
4. `given_a_service_with_no_container_then_its_block_is_off`.
5. `given_two_running_containers_when_rows_are_built_then_ports_are_unique_and_ascending`.
6. `given_a_project_with_a_problem_and_others_then_the_one_with_the_problem_is_first_and_the_rest_are_by_name`.
7. `given_three_projects_two_running_when_summarised_then_3_dot_2_running`; `given_none_then_empty_text`.
8. `given_a_term_when_matched_then_name_folder_and_service_names_count`; `given_initials_then_the_fuzzy_rule_matches` (same cases as Containers' search test).
9. `given_a_config_that_could_not_be_read_then_total_is_the_number_of_containers_found`.

`src/lib/projectData.test.ts` (node:test): `given_a_config_with_pgdata_and_an_external_volume_when_listed_then_only_pgdata_and_only_if_it_exists`; `given_df_json_with_a_volumes_array_when_sized_then_name_to_size`; `given_json_without_volumes_then_an_empty_map`; `given_text_that_is_not_json_then_an_empty_map`.

`src/Projects.test.tsx` (vitest, the way `src/Containers.test.tsx` mocks its data): one test for each of: the three rows and their texts; the problem line under shop; the action word per row; the menu items in order; Stop runs `compose_action` with `stop` for the right id; Start on a project without findings calls the commands in the order of WO-7.4b; Cancel on the remove confirm runs nothing; Delete data lists the volume; Remove from OpenPier removes it; search narrows; no match words; the Add sheet disables `Add` with no file ticked; the Add sheet refuses a repeated folder; Add writes a project with the Compose name from `project_name_decide`.

`src/lib/shortcuts.test.ts` and the Help test (changed, see step 9).

**Done when:**
1. `npx vitest run src/Projects.test.tsx src/projects 2>&1 | tail -5` shows 0 failed; the node tests `src/lib/projectRows.test.ts` and `src/lib/projectData.test.ts` pass (at least 13 tests).
2. `PW_ENGINE=chromium node scripts/check-projects.mjs` and `PW_ENGINE=webkit node scripts/check-projects.mjs` print no `FAIL`; `grep -c "check(" scripts/check-projects.mjs` is at least 45.
3. `node scripts/check-palette.mjs` and `node scripts/check-shortcuts.mjs` print no `FAIL`.
4. `grep -rn "style=\|<button\|<select\|<table\|ui/op" src/Projects.tsx src/projects src/lib/projectRows.ts` prints nothing.
5. `grep -n "pending: true" src/lib/shortcuts.ts | grep go-projects` prints nothing.
6. By eye against `shots/projects-light.png` and `projects-dark.png` (the acceptance file lists what): column order and widths (Project, Folder, Services, CPU 10 min, Ports, State); the red problem line under `shop`; `Found on this engine` caption comes in WO-7.5b; the action buttons are plain, not filled; the header has the search and a filled `Add project`; the sidebar has Projects first with a count. And against `project-start-check-light.png` for the sheet (open `&projects=2`, click Start on billing).
7. The gate in `../HANDOFF.md` section 5.

**Pull request title:** the first line of `docs/plan/iterations/pr/wo-7.5a.md` is: `wo-7.5a: Projects page: see your projects, start and stop them, and add a folder`

---

## WO-7.5b Projects: Found on this engine, Found on this Mac, the empty state, and a missing folder

**Needs:** WO-7.5a.

**Why:** spec 7.1 items 4 and 6, and section 4 rule 3. A Compose project that already runs on the engine works without being added; adding only remembers it. A new user sees what is on the Mac and adds it in one click.

**Read first:**
1. `docs/plan/07-projects-spec.md` sections 4 (rule 3) and 7.1 items 4 and 6.
2. Mockup `projectsEmpty` and the `Found on this engine` row in `projectsList`; pictures `shots/projects-light.png`, `projects-dark.png`, `projects-empty-light.png`, `projects-empty-dark.png`.
3. `src/useComposeScan.ts` and `src/lib/composeScan.ts` (`projectsFrom`): the scan of the Mac.
4. `src/Projects.tsx`, `src/projects/AddProject.tsx` (WO-7.5a).

**Starting state** (run all; stop if any output differs):
1. `git status --short | wc -l` prints `0`.
2. `grep -n "Found on" src/Projects.tsx` prints nothing.
3. `grep -n "export" src/useComposeScan.ts | head -3` prints the hook's name (`useComposeScan`) and what it returns; note the fields.
4. `grep -n "find_compose_files" preview/mock.ts | head -2` prints one line.
5. `grep -n "compose_ls" preview/projectsMock.ts` prints at least one line.

**Do not touch:** the detail page, `src/ComposeProjects.tsx`.

**Steps:**

1. **Found on this engine.** In `src/Projects.tsx`, under the saved rows, when `compose_ls` lists projects whose name is not the `composeName` of a saved project: `<GroupCaption>Found on this engine</GroupCaption>` and one row each, the tree of `prow` in the mockup (dot, name, folder, blocks, ports, `state-wide` text, one default button `Add`, no ⋯ menu). Build the model in `src/lib/projectRows.ts`:

```ts
export type FoundRow = { name: string; dir: string; files: string[]; running: number; total: number; ports: number[]; blocks: ServiceBlock[]; stateText: string; dot: DotState };
// ls: parseComposeLs rows. boxes: the containers query. A project's dir is the `com.docker.compose.project.working_dir` label of its containers, else the folder of its first config file. Saved composeNames are left out.
export function foundOnEngine(a: { ls: ComposeLsRow[]; boxes: Box[]; saved: Project[]; home: string }): FoundRow[];
```
   `total` is the number of containers of that project (a found project has no config read). `stateText` is `{running} of {total} running`; the dot follows the same rule as `projectRows` (`ok` when all run). The query is `[engine.id, "compose-ls"]`, with the same refetch interval as the containers query.
   1. `Add` on a found row: builds the project from the found data: `name` = `composeName` = the running name (rule 2 of the name table: `decideName` is called with the project in `running`, and its answer must equal that name; if it does not, show the toast `Could not keep the running name for {name}` and stop), `dir`, and `files` = the config files relative to `dir` (a file outside `dir` is dropped; none left: the toast says `{name}'s Compose files are not in one folder`). `profiles: []`, `engineId: engine.id`, the other lists empty, `addedAt` now. Then `updateProjects(addProject)` and a toast `Added {name}`. If `projects_write` refuses it (`validate_projects`), the toast carries its first line.
   2. A found row is not clickable and has no menu. The search covers found rows by name and folder. With a search term that matches none, the `Found on this engine` caption is hidden.
2. **Empty state.** When there are no saved projects (and the file read fine), the list area shows, in this order:
   1. `<Empty icon="folder" title="No projects yet" actions={<Button variant="primary" size="md" icon="plus">Add project</Button>}>A project is a folder with a Compose file. Add one and it runs next to your others, without the ports colliding.</Empty>` (the mockup's words).
   2. `Found on this engine` rows, when there are any (as above).
   3. `<GroupCaption>Found on this Mac</GroupCaption>` and up to five rows of the scan (`useComposeScan`, `projectsFrom`), those whose folder is not saved and not already shown as found on the engine. A row: no dot colour (`off`), name = the project's folder name, meta = the Compose file path with `~` (for example `~/code/shop/compose.yaml`), no state text, the default button `Add`. `Add` calls `useAddProject().begin(dir)`: the Add sheet opens for that folder (the picker is skipped). Extend `begin(dir?: string)` for this.
   4. The header shows the title and the `Add project` button, no summary and no search while empty (the mockup `projectsEmpty` header holds the title and the button only).
   When the scan finds nothing, the third block is not drawn.
3. **A folder that is gone.** In `projectRows` (WO-7.5a) a project in `missing` is already `Folder not found` with a `warn` dot. In `Projects.tsx` its action button reads `Locate…` and its menu holds only `Remove from OpenPier`. `Locate…` opens the folder picker (same call as Add); the chosen folder must hold every saved file name (`compose_in_folder(dir)` lists them): then `updateProjects` replaces `dir` (the `composeName` and everything else stay) and a toast says `Found {name}`; otherwise the toast says `That folder has no {file}` with the first missing file. The new `dir` goes through the same checks as Add (hidden folders refused).
4. **Mock.** In `preview/projectsMock.ts`: `&projects=1` also seeds the found project `kafka-local`: two containers `kafka-local-broker-1` and `kafka-local-ui-1` (labels with project `kafka-local` and working dir `/Users/me/scratch/kafka`; the `ui` one publishes 8082), and `compose_ls` lists it with `running(2)`. `&projects=0` is the empty state: an empty projects file, and `find_compose_files` answers `["/Users/me/code/shop/compose.yaml", "/Users/me/code/billing/docker-compose.yml"]`. `&projects=missing` seeds `shop` with a folder that does not exist (`projects_read` lists its id in `missing`) and a folder `/Users/me/code/shop-new` that holds `compose.yaml` for `compose_in_folder`.
5. **Browser check.** Add these lines to `scripts/check-projects.mjs`:
   1. `&projects=1`: `Found on this engine shows after the saved projects`; `kafka-local reads 2 of 2 running with :8082`; `its button reads Add and it has no ⋯`; `Add keeps the name kafka-local, the toast says Added kafka-local, the caption goes away and the sidebar count is 4`; `the found row is not a project row before Add` (the saved list had 3).
   2. `&projects=0`: `the empty state says No projects yet`; `the text is the mockup's`; `Add project is the primary button`; `Found on this Mac lists shop and billing with Add`; `the header has no search`.
   3. `&projects=0`, click `Add` on the shop row: `the Add project sheet opens with ~/code/shop without the picker` (`window.__mock.calls()` has no `pick_folder`).
   4. `&projects=missing`: `shop reads Folder not found`; `its button reads Locate…`; `its menu has only Remove from OpenPier`; with `__mock.pickFolder("/Users/me/code/shop-new")` and a click on `Locate…`: `shop reads Not started` and the toast says `Found shop`.
   5. A folder without the saved file: `__mock.pickFolder("/Users/me/code/empty")`: `the toast says That folder has no compose.yaml` and shop is still `Folder not found`.
   6. `&projects=0` has no horizontal scroll at 980 px.
6. **Mockup rows.** In `scripts/mockup-pairs.json` add two rows (threshold `0.005`): `{ "mockup": "projects", "path": "/?scenario=design&projects=1#/projects", "themes": ["light","dark"], "threshold": 0.005, "mask": [], "why": "" }` and `{ "mockup": "projects-empty", "path": "/?scenario=design&projects=0#/projects", "themes": ["light","dark"], "threshold": 0.005, "mask": [], "why": "" }`. Masks only for live text (sparkline cells), narrowest selectors, each explained in `why`. Over `0.005`: stop and report with the diff image path.

**Tests to write first:**

`src/lib/projectRows.test.ts` (add):
1. `given_a_running_project_that_is_not_saved_when_found_then_it_is_listed_with_its_running_count`.
2. `given_a_saved_project_with_the_same_name_when_found_then_it_is_left_out`.
3. `given_containers_with_a_working_dir_label_when_found_then_the_dir_is_that_label`; `given_no_label_then_the_dir_of_the_first_config_file`.
4. `given_two_ports_when_found_then_they_are_ascending`.

`src/Projects.test.tsx` (add), each as its own test:
5. `given_a_found_project_when_Add_is_pressed_then_a_project_with_the_running_name_is_saved`: `projects_write` holds `name` and `composeName` equal to `kafka-local`, `dir` `/Users/me/scratch/kafka`, `files` `["compose.yaml"]`.
6. `given_a_found_project_with_a_file_outside_its_dir_when_added_then_that_file_is_dropped`; `given_no_file_left_then_the_toast_says_the_files_are_not_in_one_folder`.
7. `given_the_name_decision_differs_from_the_running_name_when_added_then_nothing_is_written_and_the_toast_says_so`.
8. `given_no_saved_projects_when_rendered_then_the_empty_state_shows_the_mockup_words_and_no_search`.
9. `given_a_scan_result_when_rendered_empty_then_found_on_this_mac_lists_at_most_five_and_leaves_out_saved_folders`.
10. `given_Add_on_a_scan_row_then_begin_is_called_with_that_folder_and_the_picker_is_not_opened`.
11. `given_a_missing_folder_then_the_button_reads_Locate_and_the_menu_has_one_item`.
12. `given_Locate_and_a_folder_with_the_files_then_dir_is_replaced_and_the_compose_name_is_unchanged`; `given_a_folder_without_a_file_then_the_toast_names_the_file_and_nothing_is_written`; `given_a_hidden_folder_then_it_is_refused`.

**Done when:**
1. `npx vitest run src/Projects.test.tsx 2>&1 | tail -4` shows 0 failed; the node test `src/lib/projectRows.test.ts` passes with at least 4 more tests than after WO-7.5a (print both counts).
2. `PW_ENGINE=chromium node scripts/check-projects.mjs` and `PW_ENGINE=webkit node scripts/check-projects.mjs` print no `FAIL`; `grep -c "check(" scripts/check-projects.mjs` is at least 62.
3. `node scripts/check-mockup.mjs` prints `ok` for `projects light`, `projects dark`, `projects-empty light` and `projects-empty dark`.
4. `grep -rn "style=\|<button\|ui/op" src/Projects.tsx src/projects` prints nothing.
5. By eye against `projects-light.png`, `projects-dark.png`, `projects-empty-light.png`, `projects-empty-dark.png`: the `Found on this engine` caption and the `kafka-local` row (plain `Add`, no ⋯); the empty state's folder icon, title, text and the one filled button; the two rows of `Found on this Mac` with no state text.
6. The gate in `../HANDOFF.md` section 5.

**Pull request title:** the first line of `docs/plan/iterations/pr/wo-7.5b.md` is: `wo-7.5b: Projects already running are found and can be added; a new user sees what is on the Mac`

---

## WO-7.6a Project detail: the page, the Services tab and the Ports tab

**Needs:** WO-7.5b.

**Why:** spec 7.2 items 1, 2 and 4. The Ports tab answers "what is on 5433?". Task 7.6 is split: this work order builds the page, Services and Ports; WO-7.6b builds Logs and Settings.

**Read first:**
1. `docs/plan/07-projects-spec.md` section 7.2; `docs/plan/04-design-spec.md` sections 6 and 7.11.
2. Mockup `projectDetail` and `portRow`; pictures `shots/project-detail-light.png` and `project-detail-dark.png` (it shows the Ports tab).
3. `src/ContainerDetail.tsx` (or the file WO-3.2 made) for the pattern of a detail page: back button, `Tabs`, `Facts`, tab panels, the route tab.
4. `src/containers/*`: the row of a container (dot, name, image, ports, stats, state, action) to reuse for Services.
5. `src/lib/projectCheck.ts`, `src/lib/projectRows.ts`, `src/projects/useStartProject.ts`.

**Starting state** (run all; stop if any output differs):
1. `git status --short | wc -l` prints `0`.
2. `ls src/ProjectDetail.tsx 2>&1` says it does not exist.
3. `grep -n "projects:" src/lib/routes.ts` prints the line with `services`, `logs`, `ports`, `settings`.
4. `grep -n "ProjectDetail\|route.id" src/App.tsx | head -4` shows the line WO-7.5a left (it renders `<Projects />` for the detail route). Note it.
5. `grep -rn "<Tabs" src/ContainerDetail.tsx | head -2` prints the pattern (use the real file name WO-3.2 gave).

**Do not touch:** `src/Projects.tsx` except to export `ProjectMenu`; the Containers screen.

**Steps:**

1. Export `ProjectMenu` and the action helpers of WO-7.5a from `src/projects/projectActions.ts` (move them; behaviour unchanged) so the list and the detail share them. WO-7.5a's tests must still pass.
2. Create `src/ProjectDetail.tsx`, default export `ProjectDetail`. It reads `route.id` and `route.tab` (`services` default). An unknown id shows `Empty icon="folder" title="That project is not in your list"` with a default button `Back to Projects`.
3. Header (the mockup `projectDetail`): `<Header back="Projects" title={name} stateDot stateText={"{x} of {y} running"}>` with, at the right, `Restart` (default, disabled when nothing runs), `Stop` or `Start` (default), and the `ProjectMenu`. The back button is `Back to Projects` (`aria-label`) and goes to `#/projects`. Use the `Header` props as WO-2.2 defined them (`back`, `stateDot`, `stateText`).
4. Under the header, `<div className="content stack">`: a `Facts` line `{folder} · {engine name} · {files, comma separated} · {Started 12 min ago | Not started}` (items with labels `Folder`, `Engine`, `Compose files`, `State`; the started time from the oldest running container, in the words Containers uses for ages).
5. A `Banner tone="info" title="Ports were moved so this project can run next to {other names}"` with body `Your Compose file was not changed.` and a default button `Show what changed` shown when the project has any remembered port choice or any `renamed`/`separate`/`shared` entry. The title uses the projects that run now and hold the wanted ports; with none running it reads `Some ports were moved so this project can run next to your others`. (Words: the first is the mockup's, the second is added here.) `Show what changed` goes to the Settings tab (`#/projects/<id>/settings`).
6. `Tabs` (`value=route.tab`, `onChange` goes to the tab's path, items Services, Logs, Ports, Settings, `aria-label="Project sections"`), with `TabPanel`s. Logs and Settings render `Empty icon="folder" title="Coming in the next change"` only until WO-7.6b replaces them (this temporary piece is removed by WO-7.6b).
7. **Services tab.** One `Row` per service of the resolved config (query `[engine.id, "project-config", id]`, `parseConfig`), in file order. A service with containers shows each container as the Containers row does (dot, name, image, ports, CPU and memory, state, action), with the service name as the name; problem lines under it as on Containers (`Problem`), and a click opens the container detail (`go(buildPath({ page: "containers", id: containerName }))`). A service with no container shows: dot `off`, name, image from the config, state `Not started`, no action. Use the row component of `src/containers/` by importing it; do not write a second one. When the config cannot be read, a `Banner tone="bad" title="Couldn't read this project's files"` with the first line, and the rows of the containers found by label.
8. **Ports tab** (mockup `portRow`). `List aria-label="Ports of {name}"`, `RowHead` with `Service`, `In the container`, `On this Mac`. One `Row` per published port block of the config, in service order: `lead` empty, `name={service} nameClass="fixed"`, `Col kind="inside" mono` the container port (`80` or `8000-8010`), `Col kind="mac"` the port on this Mac as a link `:8081` when the project runs (plain mono text when not), the note as the meta, and `action={<Button>Change…</Button>}`. This needs the `Row` extension of step 9.
   1. The Mac port is: a remembered choice for that block, else the wanted one. A container-only port (no `published`) shows `-` on this Mac and no `Change…` button.
   2. The note: when the Mac port differs from the wanted one, `Wanted {wanted}`, and when `ports_in_use` says a container holds the wanted port now, `, used by {project} · {service}` (the mockup: `Wanted 8080, used by shop · web`). Otherwise no note.
   3. `Change…` opens a `Sheet` titled `Change port for {service}` with one `FormRow label="Port on this Mac"` and a `Field width="port"` holding the current number, a hint `Takes effect the next time the project starts.` (words added), and the foot `Cancel` and `Save` (primary, md). `Save` runs `checkChoice` (WO-7.4a) against a fresh `loadEngineState`; an error shows under the field as a `Banner tone="warn"` line; success updates `project.ports` with `updateProjects` (the block's `PortChoice`; choosing the wanted port again removes the choice) and closes the sheet with a toast `Saved. It applies at the next start.`
   4. A project with no published ports shows `Empty icon="network" title="No ports are published"` with `Nothing in this project is reachable from this Mac.`
9. **`Row` extension** (the mockup puts the note after the columns). In `src/ui/Row.tsx` add `metaLast?: boolean`: when true the `meta` cell is drawn after `{children}` and before the action (so the order is name, columns, meta, action, as in `portRow`). Without it nothing changes. Test: `given_metaLast_when_rendered_then_the_meta_cell_comes_after_the_columns`. It uses classes that exist.
10. In `src/App.tsx` render `<ProjectDetail />` for a project route with an id (replace the line noted in Starting state 4).
11. **Mock**: nothing new is needed beyond WO-7.4b to 7.5b. The config the mock answers is read without the override, so `billing` keeps 8080 and 5432 there; the Ports tab puts the remembered choice (8081, 5433) over it.
12. **Browser check.** Create `scripts/check-project-detail.mjs`:
    1. `#/projects/22222222-billing/ports` in `&projects=1`: `the title is billing and the dot is ok`; `the state reads 3 of 3 running`; `the back button is named Back to Projects and goes to the list`; `the facts show ~/code/billing, Colima and compose.yaml`; `the info banner says Ports were moved so this project can run next to shop`? (with shop running: the words name `shop`); `Show what changed goes to the Settings tab`.
    2. Tabs: `four tabs in the order Services, Logs, Ports, Settings`; `Ports is selected`; `a click on Services changes the address to .../services`.
    3. Ports: `three rows (web, db, mail)`; `web shows 80 inside and :8081 on this Mac`; `the note of web reads Wanted 8080, used by shop · web`; `db shows 5432, :5433 and Wanted 5432, used by shop · db`; `mail shows 8025 and :8025 and no note`; `the order of the cells is service, inside, mac, note, button` (read the cells' left edges ascending).
    4. `Change…` on web: `a sheet Change port for web opens with 8081`; typing `8080` and Save shows the warn line `Port 8080 is used by shop · web.` and keeps the sheet; typing `8090` and Save closes it, the toast says `Saved. It applies at the next start.`, and the row now reads `:8090`; `projects.json holds the choice` (`window.__mock.projects().projects[...].ports`).
    5. Services (`#/projects/11111111-shop/services`): `seven rows`; `five running and two read Not started`; `the problem line of api shows under it`; a click on `web` goes to `#/containers/shop-web-1`.
    6. `Stop` in the header: `the state becomes Not started` and the button reads `Start`; `Restart` is disabled then.
    7. An unknown id: `#/projects/nope/ports` says `That project is not in your list` and `Back to Projects` works.
    8. `no horizontal scroll at 980 px`.
13. **Mockup row.** Add to `scripts/mockup-pairs.json`: `{ "mockup": "project-detail", "path": "/?scenario=design&projects=1#/projects/22222222-billing/ports", "themes": ["light","dark"], "threshold": 0.005, "mask": [], "why": "" }`. The mockup's banner names `shop` and `Started 12 min ago`: mask only the facts item of the start time (narrowest selector) and say why. Over the threshold: stop and report with the diff path.

**Tests to write first:**
1. `src/ProjectDetail.test.tsx` (vitest): `given_billing_when_rendered_then_the_header_has_the_name_the_state_and_the_three_actions`; `given_the_ports_tab_then_three_rows_with_inside_and_mac_cells`; `given_a_remapped_port_then_the_note_says_wanted_and_the_holder`; `given_a_container_only_port_then_no_Change_button`; `given_Change_and_a_taken_port_then_the_warn_line_and_nothing_is_written`; `given_Change_and_a_free_port_then_project_ports_holds_it`; `given_the_wanted_port_again_then_the_choice_is_removed`; `given_a_service_with_no_container_then_Not_started_and_no_action`; `given_an_unknown_id_then_the_empty_state_with_a_way_back`; `given_a_config_error_then_the_bad_banner_and_the_containers_found_by_label`; `given_any_remembered_choice_then_the_info_banner_shows_and_Show_what_changed_goes_to_settings`.
2. `src/ui/Row.test.tsx` (add): the `metaLast` test above.
3. `src/lib/projectPorts.test.ts` (node:test) for a new pure file `src/lib/projectPorts.ts` with `portRows(config, project, uses): PortRow[]` (`service`, `container`, `wanted`, `mac`, `note`, `published: boolean`): `given_no_choice_then_mac_is_wanted_and_no_note`; `given_a_choice_then_mac_is_the_choice_and_the_note_says_wanted`; `given_a_choice_and_a_holder_then_the_note_names_it`; `given_a_range_then_one_row_for_the_block`; `given_a_container_only_port_then_published_is_false`; `given_the_choice_equals_the_wanted_port_then_no_note`.

**Done when:**
1. `npx vitest run src/ProjectDetail.test.tsx src/ui/Row.test.tsx` shows 0 failed; `node --experimental-strip-types --no-warnings --test src/lib/projectPorts.test.ts` passes (6 tests).
2. `PW_ENGINE=chromium node scripts/check-project-detail.mjs` and `PW_ENGINE=webkit ...` print no `FAIL`; `grep -c "check(" scripts/check-project-detail.mjs` is at least 30.
3. `node scripts/check-mockup.mjs` prints `ok` for `project-detail light` and `dark`.
4. `grep -rn "style=\|<button\|ui/op" src/ProjectDetail.tsx src/projects src/lib/projectPorts.ts` prints nothing; `npx vitest run src/Projects.test.tsx` still passes.
5. By eye against `project-detail-light.png`: the back arrow, name, green dot and `3 of 3 running` on the left; `Restart`, `Stop` and ⋯ at the right; the facts line; the info banner with `Show what changed`; the tab chips with `Ports` selected; the Ports table column order (service, in the container, on this Mac, note, `Change…`).
6. The gate in `../HANDOFF.md` section 5.

**Pull request title:** the first line of `docs/plan/iterations/pr/wo-7.6a.md` is: `wo-7.6a: A project has its own page: its services and the ports it uses on this Mac`

---

## WO-7.6b Project detail: Logs and Settings

**Needs:** WO-7.6a.

**Why:** spec 7.2 items 3 and 5. Logs of all services merged by time; Settings that edit the saved project and show what OpenPier changed.

**Read first:**
1. `docs/plan/07-projects-spec.md` section 7.2 items 3 and 5.
2. `src/ComposeLogs.tsx` and `src/lib/composeLogs.ts` (`mergeProjectLogs`, `projectSince`, `serviceName`): the live-logs logic of the Compose sheet. Reuse them; do not write a second merger.
3. The logs tab of the container detail (WO-3.2): its three controls in `<Tabs aside>` and the 10,000-line cap; `Canvas` props in `iteration-1-work-orders.md` WO-1.3a (`lines`, `fill`, `service` in a line).
4. `src/ProjectDetail.tsx` (WO-7.6a).

**Starting state** (run all; stop if any output differs):
1. `git status --short | wc -l` prints `0`.
2. `grep -n "Coming in the next change" src/ProjectDetail.tsx | wc -l` prints `2`.
3. `grep -n "export function mergeProjectLogs\|export function projectSince" src/lib/composeLogs.ts` prints two lines.
4. `grep -rn "aside=" src/*.tsx | head -2` prints the container detail's use of `<Tabs aside>`.

**Do not touch:** `src/ComposeLogs.tsx` (it stays for the Compose sheet), `src/lib/composeLogs.ts` (use as is).

**Steps:**

1. **Logs tab.** Create `src/projects/ProjectLogs.tsx`, default export `ProjectLogs({ project })`. Controls sit in the tabs row at the right (`<Tabs aside>`, as the container detail does), in this order: a search `Field` (`aria-label="Search the logs"`), a `ChipButton` `Follow` (pressed by default; unpressed stops the auto-scroll to the end), and a `Select` `Since` (`aria-label="Since"`, options `10 min`, `1 h`, `Start`; default `1 h`). A row of `ChipButton`s above the canvas: `All` and one per service (pressed = shown); choosing one shows only that service (`aria-label="Show only {service}"`).
   1. Data: `projectLogs({ context, projectId, since })` first with the `Since` time (computed as an RFC 3339 time for 10 min and 1 h; `Start` passes none), then polled every 2 seconds with `since = projectSince(lines)`; lines are merged with `mergeProjectLogs(prev, chunk, 10000)`. The poll stops when the tab is not shown.
   2. Drawing: `<Canvas fill aria-label="Logs of {name}" lines={...} />`; each line `{ time, service: serviceName(container, composeName), text }`. The service name is drawn by `Canvas` (`.svc`, muted; the design never gives a service a colour of its own). A restart marker line is drawn as the Compose sheet does it.
   3. Search highlights matches in the lines (the canvas `hit` classes are in `Canvas` already: pass the term as WO-3.2 does for the container logs) and shows `Nothing matches "{term}".` in place of the canvas when no line matches.
   4. A project that never ran: `Empty icon="activity" title="No logs yet"` with `Start the project to see its logs.`
   5. An error from `compose_logs`: a `Banner tone="bad" title="Couldn't read the logs"` with the first line and `Try again`; the lines already shown stay.
2. **Settings tab.** Create `src/projects/ProjectSettings.tsx`, default export `ProjectSettings({ project })`, a `div.stack` of `FormRow`s. Each change is saved by `updateProjects(replaceProject)` and invalidates `PROJECTS_KEY`; a failed write shows `Banner tone="bad"` with the first line.
   1. `Name`: `Field` with `Save` (default, sm), disabled while unchanged or empty. Only the display name changes; the Compose name never does (shown below as `Compose name` in a `Facts` line with the hint `Docker uses this name for its containers. It never changes.`).
   2. `Folder`: the folder with `~`, and a default button `Locate…` (same behaviour as WO-7.5b step 3).
   3. `Compose files`: a numbered `List` of the project's files in order; each row has `Button iconOnly aria-label="Move {file} up"` and `"Move {file} down"` (disabled at the ends) and `aria-label="Remove {file}"` (disabled when it is the only one). Below, `Select aria-label="Add a Compose file"` of the files `compose_in_folder(dir)` finds that are not in the list, and a default `Add` button. The order is the merge order. A change applies at the next start (a muted line says `Takes effect the next time the project starts.`).
   4. `Env file`: a `Field` (`aria-label="Env file"`, placeholder `.env.local`) and `Save`; empty removes it. It must be a path inside the folder (`relative_ok` of WO-7.1); a refused value shows the backend's first line under the field. A muted line: `.env in the folder is still read first.` (words added, spec section 5 item 5).
   5. `Profiles`: the profiles of `projectConfig({ allProfiles: true })` (the union of every service's `profiles`) as one `Checkbox` each; none: the row says `This project has no profiles.`
   6. `Show what OpenPier changed`: a default button that opens a `Sheet` titled `What OpenPier changed` with a `Canvas aria-label="Override file"` holding `readOverride(id)` (read only), a `Command` with the path is not needed; when the file is empty or never written: `OpenPier has not changed anything for this project.` A muted line: `OpenPier writes this file again at every start. Your Compose files are not edited.`
   7. `Reset changes`: a default button; `confirm({ title: "Reset the changes OpenPier made?", body: "Ports, names and shared choices go back to what your Compose file says. You may be asked again at the next start.", confirm: "Reset changes" })` (words added); on confirm it clears `ports`, `shared`, `renamed` and `separate`.
   8. A final row: `Remove from OpenPier` (the confirm of WO-7.5a) in a `FormRow label="Remove"`.
3. Replace both `Coming in the next change` panels in `src/ProjectDetail.tsx` by `<ProjectLogs />` and `<ProjectSettings />` (delete the temporary `Empty`).
4. **Mock**: `compose_logs` with `projectId` already answers (WO-7.4b). `project_override_read` returns the YAML of the last `project_override_write`; with `&projects=1` and `billing` it holds the text `# Written by OpenPier. Safe to delete: OpenPier writes it again.\nservices:\n  db:\n    container_name: !reset null\n    ports: !override\n      - "5433:5432"\n  web:\n    ports: !override\n      - "8081:80"\nvolumes:\n  pgdata:\n    name: "billing_pgdata"\n`. `compose_in_folder` for `/Users/me/code/billing` answers `compose.yaml` and `compose.override.yaml`. `&projects=1` `shop` config has services with `profiles: ["debug"]` on `proxy`.
5. **Browser check.** Create `scripts/check-project-settings.mjs` (Logs and Settings; `scripts/check-project-detail.mjs` gets the Logs lines):
   1. Logs (`#/projects/11111111-shop/logs`): `lines show the service name and time`; `the service name is muted text, not a colour of its own` (computed colours of two different `.svc` are equal); `new lines arrive after 2 s (GET /health 200)`; `All and seven service chips`; `choosing web shows only web lines`; `Follow is pressed by default`; `Since offers 10 min, 1 h and Start with 1 h chosen`; `searching "health" highlights and "zzzz" says Nothing matches "zzzz".`; `a stopped project says No logs yet`.
   2. Settings (`#/projects/22222222-billing/settings`): `Name holds billing`; `Save is disabled until the name changes`; changing it and Save changes the header title; `Compose name reads billing and the hint is shown`; `two Compose files are listed in order`; `Move compose.override.yaml up swaps them and projects.json holds the new order`; `Remove is disabled with one file`; `Env file Save with "../x" shows an error`; `Env file ".env.local" is saved`; `Profiles lists debug on shop and says This project has no profiles on billing`; `Show what OpenPier changed opens the sheet with "billing_pgdata" and "!override"`; `Reset changes asks first, Cancel changes nothing, confirm empties ports, shared, renamed and separate`; `Remove from OpenPier asks first`.
   3. `no horizontal scroll at 980 px` for both tabs.

**Tests to write first:**
1. `src/projects/ProjectLogs.test.tsx` (vitest): `given_log_chunks_when_polled_then_lines_merge_by_time_with_service_names`; `given_a_service_chip_then_only_its_lines_show`; `given_unpressed_Follow_then_the_canvas_does_not_scroll_to_the_end`; `given_a_term_then_matching_lines_are_marked_and_no_match_says_Nothing_matches`; `given_an_error_then_the_banner_keeps_the_lines`; `given_Since_10_min_then_the_first_call_has_a_since_time_10_minutes_back`; `given_Since_Start_then_the_first_call_has_no_since`; `given_more_than_10000_lines_then_the_oldest_are_dropped`.
2. `src/projects/ProjectSettings.test.tsx` (vitest): one test each for: rename saves the name only; files reorder writes the new order; the last file cannot be removed; adding a file from the folder list; env file refused text; env file saved; profiles listed from the config and none; override sheet shows the text and the empty words; reset clears the four lists after the confirm and nothing on Cancel; remove asks first; a failed write shows the bad banner.
3. `src/lib/projectSettings.test.ts` (node:test) for the pure helpers in a new `src/lib/projectSettings.ts`: `moveFile(files, i, dir)`, `addableFiles(found, files)`, `profilesOf(config)`, `resetChanges(project)`: `given_index_0_up_then_unchanged`, `given_the_last_down_then_unchanged`, `given_a_swap_then_the_order_changes`, `given_found_files_that_are_listed_then_they_are_not_addable`, `given_services_with_profiles_then_the_union_sorted`, `given_no_profiles_then_empty`, `given_reset_then_ports_shared_renamed_separate_are_empty_and_the_rest_is_kept`.

**Done when:**
1. `npx vitest run src/projects src/ProjectDetail.test.tsx 2>&1 | tail -4` shows 0 failed; the node test passes (7 tests).
2. `PW_ENGINE=chromium` and `webkit` runs of `scripts/check-project-detail.mjs` and `scripts/check-project-settings.mjs` print no `FAIL`; `grep -c "check(" scripts/check-project-settings.mjs` is at least 25 and the count in `check-project-detail.mjs` grew by at least 9.
3. `grep -n "Coming in the next change" src/ProjectDetail.tsx` prints nothing.
4. `grep -rn "style=\|<button\|<select\|ui/op" src/projects` prints nothing.
5. By eye: no mockup picture exists for Logs and Settings; compare their look with the container detail's logs tab (`container-detail-light.png`) and with Settings Machines (`settings-machines-light.png`): same tab row with the controls at the right, same form rows.
6. The gate in `../HANDOFF.md` section 5.

**Pull request title:** the first line of `docs/plan/iterations/pr/wo-7.6b.md` is: `wo-7.6b: A project's logs from all services together, and its settings`

---

## WO-7.7 Projects are linked from Containers, the Compose sheet, the palette and Doctor

**Needs:** WO-7.6b.

**Why:** spec 7.4. A project must be reachable from where users already look, and the old Compose sheet must not offer to start twice what Projects already owns. (Decision of this iteration, stated at the top: the Compose sheet of WO-3.3c is kept.)

**Read first:**
1. `docs/plan/07-projects-spec.md` section 7.4.
2. `src/Containers.tsx` and `src/containers/*`: the group row of a Compose project and its menu (WO-3.1b).
3. `src/ComposeProjects.tsx` (the sheet of WO-3.3c): its rows and row menu.
4. `src/lib/paletteModel.ts` (`PaletteGroup`, how items are built) and the place in `src/App.tsx` that builds them (WO-2.4 step 9).
5. `src/lib/doctor.ts`: the check `port-taken`.

**Starting state** (run all; stop if any output differs):
1. `git status --short | wc -l` prints `0`.
2. `grep -n "PaletteGroup" src/lib/paletteModel.ts | head -2` prints the closed union; note its members.
3. `grep -n "id: \"port-taken\"" src/lib/doctor.ts` prints one line.
4. `grep -rn "Open project" src --include=*.tsx | head -2` prints nothing.
5. `grep -rn "Start a Compose project" src/lib/paletteModel.ts src/App.tsx | head -2` prints the palette action to sit next to.

**Do not touch:** the Run and Pull sheets; the Compose sheet's start logic (it stays for folders that are not saved).

**Steps:**

1. **Containers.** The name of a Compose group row whose project name equals the `composeName` of a saved project is a link (`<a href="#/projects/<id>">`, a real anchor inside the row; its click does not toggle the group). The group's ⋯ menu gets `Open project` as its first item (`go("#/projects/<id>")`). A group that is not a saved project is unchanged. Use `useProjects()`; while it loads, nothing changes.
2. **The Compose sheet.** In `src/ComposeProjects.tsx`: a row whose folder equals the `dir` of a saved project shows `Open project` (default button; `go` to the detail) in place of `Start`/`Stop`, and its ⋯ menu keeps only `Show in Finder`, `Copy command` and what is not about running. Every other row gets one more menu item, first: `Add as a project`, which closes the sheet and calls `useAddProject().begin(dir)`. The legacy `Start` of these rows is unchanged. Update `src/ComposeProjects.test.tsx` with the tests below; no old test is removed or weakened.
3. **Palette.** In `src/lib/paletteModel.ts` add `"Projects"` to `PaletteGroup`, placed after `"Actions"` in the group order. Items, built where WO-2.4 builds the others:
   1. One result per saved project, group `Projects`, label `{name}`, hint `{x} of {y} running` or `Not started`, run: `go("#/projects/<id>")`. Matching uses the existing fuzzy rule on the name.
   2. In `Actions`, per saved project: `Start {name}` (when it is not running) and `Stop {name}` (when it runs): run: the same functions as the list buttons (`useStartProject().start`, `composeProject` stop). They appear only when the query is not empty (so the empty palette stays short), as WO-2.4 does for per-container actions.
   3. In `Actions` general, next to `Start a Compose project`: `Add project` (run: `useAddProject().begin()`, which opens the picker).
   Update the palette tests WO-2.4 wrote, one new test per item kind (below).
4. **Doctor.** `type Facts` gets `projectNames?: string[]` (the `composeName` of every saved project). The `port-taken` check skips a container whose Compose project is in that list (spec 7.4 item 3: Projects handle it). Where the Doctor screen builds `Facts`, pass `projectNames` from `useProjects()`. Tests below.
5. **Shortcuts and Help.** Nothing to change: `go-projects` was turned on by WO-7.5a. Check only that `Help` lists `Projects` with `⌘1`.
6. **Browser checks.** Add to `scripts/check-projects.mjs` (and the named old checks):
   1. Containers (`&projects=1`): `the group shop links to #/projects/11111111-shop`; `clicking the link goes to the project and the group does not fold`; `the group menu starts with Open project`; `a group that is not a project has no link`.
   2. Compose sheet (`check-compose.mjs`, `&projects=1`): `shop's row reads Open project`; `Open project goes to the detail`; `billing-like rows that are not saved keep Start`; `a not-saved row's menu starts with Add as a project`; `Add as a project opens the Add sheet with that folder`. The old lines of that check stay as they were.
   3. Palette (`check-palette.mjs`, `&projects=1`): `typing "bill" lists Projects: billing with 3 of 3 running`; `Enter goes to #/projects/22222222-billing`; `typing "start sea" offers Start search`; `typing "stop bill" offers Stop billing and no Start billing`; `Add project is in the Actions list`; `the empty palette has no Start or Stop project items`.
   4. Doctor (`check-doctor.mjs`): in a scenario where a project's container failed on a taken port (add `&projects=1&portclash=1`: a `shop-web-1` container exited with `Bind for 0.0.0.0:8080 failed: port is already allocated`), `Doctor does not list a port-taken finding for shop-web-1`; and in `scenario=doctor` without projects the finding is still listed.
   5. Help: `Projects shows with the key ⌘1`.

**Tests to write first:**
1. `src/containers/*.test.tsx` (or `src/Containers.test.tsx`): `given_a_group_of_a_saved_project_when_rendered_then_its_name_is_a_link_to_the_project`; `given_a_group_that_is_not_a_project_then_no_link`; `given_the_group_menu_then_Open_project_is_first_for_a_project_and_absent_otherwise`; `given_a_click_on_the_link_then_the_group_does_not_toggle`.
2. `src/ComposeProjects.test.tsx`: `given_a_folder_that_is_a_saved_project_when_rendered_then_the_row_reads_Open_project_and_has_no_Start`; `given_a_folder_that_is_not_saved_then_Start_stays_and_Add_as_a_project_is_the_first_menu_item`; `given_Add_as_a_project_then_begin_is_called_with_the_folder_and_the_sheet_closes`.
3. `src/lib/paletteModel.test.ts`: `given_saved_projects_when_the_model_is_built_then_each_is_a_result_in_the_group_Projects`; `given_a_stopped_project_and_a_query_then_Start_name_is_offered_and_Stop_is_not`; `given_a_running_project_then_the_reverse`; `given_an_empty_query_then_no_project_actions`; `given_the_group_order_then_Projects_comes_after_Actions`; `given_the_actions_then_Add_project_is_among_them`.
4. `src/lib/doctor.test.ts`: `given_a_failed_container_of_a_saved_project_when_the_doctor_runs_then_there_is_no_port_taken_finding`; `given_the_same_container_with_no_project_names_then_the_finding_stays`; `given_a_container_that_is_not_in_a_project_then_the_finding_stays`.

**Done when:**
1. `npm test 2>&1 | tail -6` shows 0 failures, and `npx vitest run src/ComposeProjects.test.tsx` passes with `grep -c "it(\|test(" src/ComposeProjects.test.tsx` not lower than before plus 3 (print both numbers).
2. `PW_ENGINE=chromium` and `webkit` runs of `check-projects.mjs`, `check-compose.mjs`, `check-palette.mjs`, `check-doctor.mjs` print no `FAIL`; `grep -c "check(" scripts/check-compose.mjs` is not lower than before plus 5.
3. `grep -n "\"Projects\"" src/lib/paletteModel.ts | head -3` prints at least one line.
4. `grep -rn "style=\|<button\|ui/op" src/containers src/ComposeProjects.tsx` prints nothing new (compare with `git diff`).
5. By eye: the group name looks like a link (same style as the port links), the Compose sheet row with `Open project` has the same button size as `Start`.
6. The gate in `../HANDOFF.md` section 5.

**Pull request title:** the first line of `docs/plan/iterations/pr/wo-7.7.md` is: `wo-7.7: Projects are one click from Containers, the palette and the Compose sheet`

---

## WO-7.8 The two-project test (the definition of done for Projects)

**Needs:** WO-7.7.

**Why:** spec section 10. Two projects with the same folder name, the same container name and the same ports run together on a real engine. This work order writes the test; **the owner runs it**.

**Read first:**
1. `docs/plan/07-projects-spec.md` section 10 (the eight steps).
2. `scripts/eval-projects.sh`, `src-tauri/src/eval_support.rs`, `src-tauri/src/override_yaml.rs` (`sandbox_override_merge`) from WO-7.2.
3. `src/lib/projectCheck.fixture.test.ts` (WO-7.4a): the plan the test applies.
4. `src-tauri/src/compose.rs`: `project_args`, `action_tail`, `NameLock`.

**Starting state** (run all; stop if any output differs):
1. `git status --short | wc -l` prints `0`.
2. `sh scripts/eval-projects.sh --dry` prints `ok dry run` and exits 0.
3. `ls scripts/fixtures/projects/a/app/compose.yaml scripts/fixtures/projects/b/app/compose.yaml` prints both.
4. `grep -c "sandbox_" src-tauri/src/override_yaml.rs` prints at least 1; `grep -rn "sandbox_two_projects" src-tauri/src | wc -l` prints `0`.

**Do not touch:** every file outside `src-tauri/src/eval_two.rs`, `src-tauri/src/eval_support.rs`, `src-tauri/src/main.rs` (one `mod` line), `scripts/eval-projects.sh`.

**Rules for this work order:** the implementer writes and compiles the test and runs `sh scripts/eval-projects.sh --dry`. The implementer **never** runs `sh scripts/eval-projects.sh two`, `merge`, or `cargo test -- --ignored`. The pull request file says `sandbox two-project test: not run, owner runs it`.

**Steps:**

1. In `eval_support.rs` add two helpers (the first runs `docker` with the arguments exactly as given, because `project_args` already starts with `--context colima`; the second answers whether HTTP port `p` on this Mac says 200, trying for 10 seconds):

```rust
pub fn docker_raw(args: &[String]) -> Result<String, String> {
    let out = Command::new("docker").args(args).output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok(String::from_utf8_lossy(&out.stdout).into_owned()) } else { Err(String::from_utf8_lossy(&out.stderr).into_owned()) }
}

pub fn http_200(port: u16) -> bool {
    use std::io::{Read, Write};
    for _ in 0..20 {
        if let Ok(mut s) = std::net::TcpStream::connect(("127.0.0.1", port)) {
            let _ = s.set_read_timeout(Some(std::time::Duration::from_secs(2)));
            let _ = s.write_all(b"GET / HTTP/1.0\r\n\r\n");
            let mut body = String::new();
            let _ = s.read_to_string(&mut body);
            if body.starts_with("HTTP/1.0 200") || body.starts_with("HTTP/1.1 200") { return true; }
        }
        std::thread::sleep(std::time::Duration::from_millis(500));
    }
    false
}
```
2. Create `src-tauri/src/eval_two.rs` and add `#[cfg(test)] mod eval_two;` to `main.rs`. The test follows spec section 10 step by step and uses the real Rust code: `decide_compose_name`, `override_yaml`, `project_args`, `action_tail` and `NameLock`. The plan it applies for `b` is the one the TypeScript test `given_those_findings_when_resolved_then_the_override_equals_the_sandbox_plan` (WO-7.4a) proves the Start check produces. Full content:

```rust
// The two-project test of spec section 10, on a real engine. `#[ignore]`: started only by scripts/eval-projects.sh two.
use crate::compose::{action_tail, project_args, NameLock};
use crate::eval_support::{docker, docker_raw, guard, http_200, CONTEXT};
use crate::override_yaml::{override_yaml, OverrideInput, PortLine, ServiceChange};
use crate::projects::{decide_compose_name, PortOrRange, Project};

fn project(root: &str, side: &str, compose_name: &str) -> Project {
    Project {
        id: format!("eval-{side}-0000"), name: "app".into(), compose_name: compose_name.into(), dir: format!("{root}/{side}/app"),
        files: vec!["compose.yaml".into()], env_file: None, profiles: vec![], engine_id: CONTEXT.into(), ports: vec![], shared: vec![],
        renamed: vec![], separate: vec![], added_at: "2026-11-12T10:00:00Z".into(),
    }
}

fn line(mac: u16, inside: u16) -> PortLine { PortLine { host_ip: String::new(), mac: Some(PortOrRange::One(mac)), container: PortOrRange::One(inside), protocol: "tcp".into() } }

// b's plan: db renamed and on 5433, web on 8081 (the plan of the TypeScript fixture test).
fn plan_b() -> OverrideInput {
    OverrideInput {
        services: vec![
            ServiceChange { service: "db".into(), reset_name: true, ports: Some(vec![line(5433, 5432)]) },
            ServiceChange { service: "web".into(), reset_name: false, ports: Some(vec![line(8081, 80)]) },
        ],
        ..Default::default()
    }
}

fn run(root: &str, p: &Project, input: &OverrideInput, action: &str, volumes: bool) -> Result<String, String> {
    let file = format!("{root}/{}-override.yaml", p.compose_name);
    std::fs::write(&file, override_yaml(input).unwrap()).unwrap();
    let args = project_args(CONTEXT, p, Some(&file), false, &action_tail(action, volumes).unwrap());
    docker_raw(&args)
}

fn names(project: &str) -> Vec<String> {
    let f = format!("label=com.docker.compose.project={project}");
    docker(&["ps", "--filter", &f, "--format", "{{.Names}}"]).unwrap().lines().map(String::from).collect()
}

#[test]
#[ignore = "needs a real engine: run scripts/eval-projects.sh two"]
fn sandbox_two_projects() {
    let root = guard();
    let (dir_a, dir_b) = (format!("{root}/a/app"), format!("{root}/b/app"));
    let before = std::fs::read(format!("{dir_a}/compose.yaml")).unwrap();
    let (empty, plan) = (OverrideInput::default(), plan_b());

    // Step 1: add a, start it. Same ports as its file, no dialog (no findings), the fixed name db.
    let name_a = decide_compose_name(&dir_a, Some("app"), &[], &[]).unwrap();
    assert_eq!((name_a.name.as_str(), name_a.suffixed), ("app", false));
    let a = project(&root, "a", &name_a.name);
    run(&root, &a, &empty, "up", false).unwrap();
    assert!(names("app").contains(&"db".to_string()));
    assert!(docker(&["port", "db", "5432/tcp"]).unwrap().contains(":5432"));
    assert!(http_200(8080), "a answers on 8080");

    // Step 2: add b. The same folder name gives a hashed name. Start with the three changes.
    let running = vec![("app".to_string(), dir_a.clone())];
    let name_b = decide_compose_name(&dir_b, Some("app"), &running, &running).unwrap();
    assert!(name_b.suffixed && name_b.name.starts_with("app-") && name_b.name.len() == 8, "got {}", name_b.name);
    let mut b = project(&root, "b", &name_b.name);
    b.renamed = vec!["db".into()];
    run(&root, &b, &plan, "up", false).unwrap();

    // Step 3: both run, four containers, both web ports answer, the Compose files are untouched.
    assert_eq!(names("app").len() + names(&b.compose_name).len(), 4);
    assert!(names(&b.compose_name).contains(&format!("{}-db-1", b.compose_name)));
    assert!(http_200(8080) && http_200(8081));
    assert_eq!(before, std::fs::read(format!("{dir_a}/compose.yaml")).unwrap());
    assert_eq!(std::fs::read(format!("{dir_a}/compose.yaml")).unwrap(), std::fs::read(format!("{dir_b}/compose.yaml")).unwrap());

    // Step 4: stop a. b keeps running.
    run(&root, &a, &empty, "stop", false).unwrap();
    assert_eq!(names("app").len(), 0);
    assert_eq!(names(&b.compose_name).len(), 2);
    assert!(http_200(8081));

    // Step 5: start a again: same ports as before, no change.
    run(&root, &a, &empty, "up", false).unwrap();
    assert!(docker(&["port", "db", "5432/tcp"]).unwrap().contains(":5432"));

    // Step 6: stop both, then start b and a at the same time. Two names lock at once; the same name twice does not.
    run(&root, &a, &empty, "stop", false).unwrap();
    run(&root, &b, &plan, "stop", false).unwrap();
    let (lock_a, lock_b) = (NameLock::take(&a.compose_name).unwrap(), NameLock::take(&b.compose_name).unwrap());
    assert!(NameLock::take(&a.compose_name).is_err(), "a second action on one project is refused");
    let (root2, root3) = (root.clone(), root.clone());
    let (a2, b2, p2) = (a.clone(), b.clone(), plan.clone());
    let t1 = std::thread::spawn(move || run(&root2, &b2, &p2, "up", false));
    let t2 = std::thread::spawn(move || run(&root3, &a2, &OverrideInput::default(), "up", false));
    t1.join().unwrap().unwrap();
    t2.join().unwrap().unwrap();
    drop((lock_a, lock_b));
    assert!(http_200(8080) && http_200(8081));
    assert!(docker(&["port", &format!("{}-db-1", b.compose_name), "5432/tcp"]).unwrap().contains(":5433"));
    assert!(docker(&["port", "db", "5432/tcp"]).unwrap().contains(":5432"));

    // Step 7: Delete data on b removes b's volume and not a's.
    run(&root, &b, &plan, "down", true).unwrap();
    let vols = |p: &str| docker(&["volume", "ls", "-q", "--filter", &format!("label=com.docker.compose.project={p}")]).unwrap();
    assert_eq!(vols(&b.compose_name).trim(), "");
    assert!(vols("app").contains("app_pgdata"));
    run(&root, &a, &empty, "down", true).unwrap();
}
```
   `Project` must derive `Clone` and `OverrideInput` must derive `Clone` (both already do); `NameLock` and `action_tail`/`project_args` are `pub(crate)` from WO-7.3. If the file does not compile for a visibility reason, change only the visibility and say so in the pull request file.
3. In `scripts/eval-projects.sh` (WO-7.2) add, after the last `cargo test` line, a check that the fixtures in the repository did not change and that nothing was left behind:

```sh
code=$?
[ -z "$(git status --short scripts/fixtures)" ] && say "ok fixtures unchanged" || { say "FAIL fixtures changed"; code=1; }
exit $code
```
   (`cleanup` runs from the `trap` on exit. Place these lines after the `cargo test` command; the command's own exit status is read first as `code=$?`.)
4. Step 8 of the spec (another engine) is by hand: the owner follows `iteration-5-acceptance.md`, section "WO-7.8, by hand".

**Tests to write first:** this work order is the test. The implementer first runs `cd src-tauri && cargo test --no-run` and sees it fail to compile (`sandbox_two_projects` missing) when step 2's test is written before `eval_support` is extended; then makes it compile.

**Done when:**
1. `cd src-tauri && cargo test --no-run 2>&1 | tail -2` builds; `cargo test eval_two -- --ignored --list 2>&1 | grep -c sandbox_two_projects` prints `1`; `cargo test 2>&1 | tail -3` shows 0 failed and the ignored tests listed as ignored.
2. `sh scripts/eval-projects.sh --dry` prints `ok dry run`, exit 0; `sh -n scripts/eval-projects.sh` prints nothing.
3. `grep -n "compose up\|compose down\|docker rm\|docker run" scripts/eval-projects.sh | grep -v "^.*cleanup\|rm -f\|volume rm\|network rm"` prints nothing new (the script starts nothing itself; the test does).
4. `grep -rn "eval_two\|sandbox_two_projects" src-tauri/src/main.rs src-tauri/src/eval_two.rs | wc -l` is at least 2.
5. **The owner's step, not yours:** `sh scripts/eval-projects.sh two` on Colima prints `test eval_two::sandbox_two_projects ... ok` and `ok fixtures unchanged`, and `docker ps -a` afterwards holds none of the test's containers. The pull request file says the owner's result is pending.
6. The gate in `../HANDOFF.md` section 5.

**Pull request title:** the first line of `docs/plan/iterations/pr/wo-7.8.md` is: `wo-7.8: The two-project test is written and ready for the owner to run on a real engine`
