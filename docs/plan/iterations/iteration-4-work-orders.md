# Iteration 4: any engine, one data layer, dead code removed

## What this iteration delivers

1. OpenPier talks to any Docker on the Mac (Colima, Docker Desktop, OrbStack, Rancher Desktop, Podman, other), through one new Rust file (`engine.rs`) and one new TypeScript file (`src/lib/engines.ts`). Only Colima can be started and stopped from the app.
2. Every list reads its data through TanStack Query. `usePoll`, the `setInterval` in `src/App.tsx` and the `runtime-changed` event are gone.
3. The old UI is deleted, `src/ui/op/*` moves up to `src/ui/`, `src-tauri/src/main.rs` is split into one file per job, and the docs match the app.

## Order

4.1, 4.2a, 4.2b, 4.3a, 4.3b, 4.3c, 5.1a, 5.1b, 5.2, 5.3. The plan says 4.1, 4.2, 4.3, 5.1, 5.2, 5.3. Three tasks are too big for one pull request, so 4.2 is split in 4.2a and 4.2b, 4.3 in 4.3a, 4.3b and 4.3c, and 5.1 in 5.1a and 5.1b. Each work order is one branch `wo-<id>`, merged into local `main` with `git merge --no-ff wo-<id>` when its "Done when" and the gate pass (`../HANDOFF.md` sections 4 and 5).

## Words used in this iteration

1. **Engine**: any Docker the app can talk to. One engine is one Docker context. Type `Engine`.
2. **Machine**: a Colima VM, the only thing the app can start and stop in 1.0.
3. **Managed**: an engine of kind `colima` whose `machineName` is set. Only a managed engine gets Start, Stop and a Machines section.
4. **The known set**: the context names Rust remembers from the last `list_engines`. `context_ok` accepts nothing else.

## Facts that hold for the whole iteration (read once)

1. **One new noun in code.** Iteration 2 made `src/lib/engineModel.ts` with a type `ColimaEngine`. This iteration replaces that type by the single type `Engine` (the backend shape, in `src/lib/engineModel.ts`, re-exported by `src/lib/engines.ts`) and a display type `EngineView` built from an `Engine` plus the Colima machine behind it. `ColimaEngine`, `engineOfProfile` and `EngineOptions` are deleted in WO-4.2a. The importers to change are found by grep in WO-4.2a step 7.
2. **The query key is `[engineId, name, ...parts]`** for everything that belongs to one engine, and `["mac", name, ...parts]` for what belongs to the Mac (machines, the engine list, installed tools, kubectl contexts, the setup report). `engineId` is the Docker context name (`engine.id`).
3. **Intervals are kept per call.** The plan says `refetchInterval: 3000` for every call. Today each `usePoll` has its own interval (2 s for logs, 30 s for disk). A single 3 s would be 10 times more docker processes for the disk read. Each call keeps its interval, written in the table of WO-4.3a. This is a plan contradiction and is reported.
4. **The preview mock ignores the context** (`preview/mock.ts` returns the same data for any `context`). The scenarios of WO-4.2a differ only in what `list_engines`, `list_profiles` and `env_check` return.
5. Imports of the new components are `from "./ui/op"` until WO-5.1b, which moves them to `./ui`.
6. Test counts in "Done when" are "at least". After iteration 1: `cargo test` at least 135 passed; node tests 586 or more; vitest 8 files or more.

---

## WO-4.1 The backend knows every Docker on the Mac

**Needs:** iteration 3 merged (the plan says phase 3 first, so screen churn and backend churn do not collide).

**Why:** E8 (the app only understands Colima; `context_ok` accepts only `colima` and `colima-<name>`), E7 (the runtime choice is stored nowhere stable). After this work order a Mac with only Docker Desktop or OrbStack has a working engine list in Rust. Nothing on screen changes yet.

**Read first:**
1. `docs/plan/05-implementation-plan.md` task 4.1; `docs/plan/04-design-spec.md` section 5.3.
2. `src-tauri/src/main.rs`: find `fn context_ok`, `fn find_bin`, `fn path_env`, `fn output_with_deadline`, `fn profile_name_ok`, `fn kubectl`, `fn terminal_command`, and the test `only_colima_contexts_are_accepted`. Read the `invoke_handler(tauri::generate_handler![` list at the bottom.
3. `src-tauri/src/desktop.rs`: the `use crate::{context_ok, ...}` line and its three calls to `context_ok`.

**Starting state:**
1. `git status --short` prints nothing and `git rev-parse --abbrev-ref HEAD` prints `main`.
2. `ls src-tauri/src` lists `desktop.rs`, `main.rs`, `setup.rs` and no `engine.rs`.
3. `grep -c "^fn context_ok" src-tauri/src/main.rs` prints `1`.
4. `grep -c "context_ok" src-tauri/src/desktop.rs` prints `4` (one `use` line and three calls).
5. `grep -c "only_colima_contexts_are_accepted" src-tauri/src/main.rs` prints `1`.
6. `(cd src-tauri && cargo test 2>&1 | grep "test result")` prints `test result: ok.` with at least 135 passed and `0 failed`. Write the passed number down as **B**.

If any of these differ, stop and report.

**Do not touch:** the frontend (`src/`), `preview/`, any existing test except the rename in step 5, `src-tauri/src/setup.rs`.

**The engine classification table** (one table, in code order: the first row that matches wins). Input is the context name `n` and its Docker endpoint `e`, for example `unix:///Users/me/.colima/work/docker.sock`.

| # | Rule | Kind | Label | Machine |
|---|---|---|---|---|
| 1 | `e` contains `/.colima/` | `colima` | `Colima · {machine}` | the folder after `/.colima/` when it passes `profile_name_ok`, else none (label then uses `n`) |
| 2 | `e` contains `/.orbstack/` | `orbstack` | `OrbStack` | none |
| 3 | `e` contains `/.rd/` | `rancher-desktop` | `Rancher Desktop` | none |
| 4 | `e` (lower case) contains `podman` | `podman` | `Podman` | none |
| 5 | `n` is `desktop-linux`, or `e` contains `/.docker/run/docker.sock` | `docker-desktop` | `Docker Desktop` | none |
| 6 | anything else (the built-in `default`, a remote `ssh://` context) | `other` | `n` | none |

A name alone never makes a context Colima: a context called `colima` that points at a foreign socket is `other`.

**The types** (Rust, in `engine.rs`, below in full):

```rust
pub enum EngineKind { Colima, DockerDesktop, Orbstack, RancherDesktop, Podman, Other } // serde kebab-case
pub struct KubeRef { pub context: String }
pub struct Engine {
    pub id: String,                       // the Docker context name; every docker call passes it as --context
    pub label: String,
    pub kind: EngineKind,
    pub endpoint: String,
    pub reachable: bool,
    pub server_version: Option<String>,
    pub current: bool,                    // the context `docker` itself would use
    pub machine_name: Option<String>,     // Some only for a Colima engine
    pub kubernetes: Option<KubeRef>,      // Some only for Colima in 1.0
}
```

**The exact JSON of `list_engines`** (camelCase keys, `kind` in kebab-case, every key always present, `null` when empty). One element, a running default Colima machine:

```json
{"id":"colima","label":"Colima · default","kind":"colima","endpoint":"unix:///Users/me/.colima/default/docker.sock","reachable":true,"serverVersion":"29.2.1","current":true,"machineName":"default","kubernetes":{"context":"colima"}}
```

A Docker Desktop element: `{"id":"desktop-linux","label":"Docker Desktop","kind":"docker-desktop","endpoint":"unix:///Users/me/.docker/run/docker.sock","reachable":false,"serverVersion":null,"current":false,"machineName":null,"kubernetes":null}`.

**The `context_ok` rule.** `context_ok(c)` is true only when both hold: `c` matches `^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$` (checked by `name_shape_ok`, no regex crate), and `c` is in the known set that the last `list_engines` stored. Before the first `list_engines` the set is empty, so every call is refused: the page must call `list_engines` first (WO-4.2a does). In `cargo test` the set holds `colima`, `colima-work`, `colima-dev` (seeded once by `seed_known_for_tests`), so the existing tests keep working without a change.

**The Colima-only gate.** The old rule (`colima` or `colima-<profile>`) is not deleted. It is renamed `colima_context_ok` and still guards what only Colima has: `kubectl` with a context, `k9s`, and the Docker Desktop bring-over in `desktop.rs`. Other engines show no Kubernetes item (plan 4.1 item 4).

**Steps:**

1. Write the tests of the new file first (they are inside `engine.rs`, below). Create `src-tauri/src/engine.rs` with the full content in step 2 and run `cd src-tauri && cargo test engine:: 2>&1 | tail -5`. It must show `26 passed`.

2. Create `src-tauri/src/engine.rs`. Full content (this file was compiled, formatted with `cargo fmt`, run through `cargo clippy --all-targets -- -D warnings` and its 26 tests passed in a scratch crate; type it exactly):

```rust
// Engines: every Docker context the Mac knows, which tool provides it, and whether it answers.
// An engine is any Docker the app can talk to. The page never invents one: the names it may use come from
// `docker context ls`, are kept here, and `context_ok` accepts nothing else.
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::Mutex;
use std::time::Duration;

use crate::{find_bin, output_with_deadline, path_env, profile_name_ok};

// How long one engine gets to answer before it counts as not reachable.
const PROBE_DEADLINE: Duration = Duration::from_secs(3);
// `docker context ls` reads files on disk; it answers at once.
const LIST_DEADLINE: Duration = Duration::from_secs(10);

#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "kebab-case")]
pub enum EngineKind {
    Colima,
    DockerDesktop,
    Orbstack,
    RancherDesktop,
    Podman,
    Other,
}

// One line of `docker context ls --format '{{json .}}'`. Only these fields are read.
#[derive(Deserialize, Debug, PartialEq)]
#[serde(rename_all = "PascalCase")]
struct ContextRow {
    name: String,
    #[serde(default)]
    docker_endpoint: String,
    #[serde(default)]
    current: bool,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KubeRef {
    pub context: String,
}

// What `list_engines` returns, one per Docker context.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Engine {
    // The Docker context name. Every docker call passes it back as `--context`.
    pub id: String,
    pub label: String,
    pub kind: EngineKind,
    pub endpoint: String,
    pub reachable: bool,
    pub server_version: Option<String>,
    // The context `docker` itself would use now.
    pub current: bool,
    // The Colima machine behind this engine; None when the app cannot manage the VM.
    pub machine_name: Option<String>,
    // The Kubernetes context of this engine; Some only for Colima in 1.0.
    pub kubernetes: Option<KubeRef>,
}

// The one table. The endpoint path decides first; a name alone never makes a context Colima.
//   endpoint has "/.colima/"            -> colima
//   endpoint has "/.orbstack/"          -> orbstack
//   endpoint has "/.rd/"                -> rancher-desktop
//   endpoint has "podman"               -> podman
//   name "desktop-linux", or endpoint has "/.docker/run/docker.sock" -> docker-desktop
//   anything else                       -> other
fn classify(name: &str, endpoint: &str) -> EngineKind {
    if endpoint.contains("/.colima/") {
        EngineKind::Colima
    } else if endpoint.contains("/.orbstack/") {
        EngineKind::Orbstack
    } else if endpoint.contains("/.rd/") {
        EngineKind::RancherDesktop
    } else if endpoint.to_ascii_lowercase().contains("podman") {
        EngineKind::Podman
    } else if name == "desktop-linux" || endpoint.contains("/.docker/run/docker.sock") {
        EngineKind::DockerDesktop
    } else {
        EngineKind::Other
    }
}

// Colima keeps its socket at ~/.colima/<machine>/docker.sock; the folder is the machine's name.
fn machine_of(kind: EngineKind, endpoint: &str) -> Option<String> {
    if kind != EngineKind::Colima {
        return None;
    }
    let after = endpoint.split("/.colima/").nth(1)?;
    let folder = after.split('/').next()?;
    profile_name_ok(folder).then(|| folder.to_string())
}

fn label_of(kind: EngineKind, name: &str, machine: Option<&str>) -> String {
    match kind {
        EngineKind::Colima => format!("Colima · {}", machine.unwrap_or(name)),
        EngineKind::DockerDesktop => "Docker Desktop".into(),
        EngineKind::Orbstack => "OrbStack".into(),
        EngineKind::RancherDesktop => "Rancher Desktop".into(),
        EngineKind::Podman => "Podman".into(),
        EngineKind::Other => name.into(),
    }
}

// A context name goes onto a command line, so it starts with a letter or digit and holds only plain characters.
// The same shape Docker itself requires: ^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$
fn name_shape_ok(c: &str) -> bool {
    let mut chars = c.chars();
    let first_ok = chars.next().is_some_and(|f| f.is_ascii_alphanumeric());
    first_ok
        && c.len() <= 63
        && chars.all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '.' | '-'))
}

fn parse_contexts(stdout: &str) -> Vec<ContextRow> {
    stdout
        .lines()
        .filter_map(|l| serde_json::from_str::<ContextRow>(l.trim()).ok())
        .collect()
}

// Not yet probed: `reachable` is false until `list_engines` asks. A name that is not safe to pass on is left out.
fn engines_from(rows: Vec<ContextRow>) -> Vec<Engine> {
    rows.into_iter()
        .filter(|r| name_shape_ok(&r.name))
        .map(|r| {
            let kind = classify(&r.name, &r.docker_endpoint);
            let machine = machine_of(kind, &r.docker_endpoint);
            Engine {
                label: label_of(kind, &r.name, machine.as_deref()),
                kubernetes: (kind == EngineKind::Colima).then(|| KubeRef {
                    context: r.name.clone(),
                }),
                id: r.name,
                kind,
                endpoint: r.docker_endpoint,
                reachable: false,
                server_version: None,
                current: r.current,
                machine_name: machine,
            }
        })
        .collect()
}

// `docker version --format '{{.Server.Version}}'` exits 0 and prints the version only when the engine answers.
fn probe_verdict(ok: bool, stdout: &str) -> Option<String> {
    let v = stdout.trim();
    (ok && !v.is_empty()).then(|| v.to_string())
}

fn probe(name: &str) -> Option<String> {
    let mut cmd = Command::new(find_bin("docker"));
    cmd.args([
        "--context",
        name,
        "version",
        "--format",
        "{{.Server.Version}}",
    ])
    .env("PATH", path_env());
    let (ok, out, _) = output_with_deadline(cmd, PROBE_DEADLINE).ok()?;
    probe_verdict(ok, &String::from_utf8_lossy(&out))
}

// The context names the page may use. Set by `list_engines`, read by `context_ok`.
static KNOWN: Mutex<Vec<String>> = Mutex::new(Vec::new());

fn known_names(list: &[Engine]) -> Vec<String> {
    list.iter().map(|e| e.id.clone()).collect()
}

fn set_known(names: Vec<String>) {
    *KNOWN.lock().unwrap_or_else(|p| p.into_inner()) = names;
}

// The rule: the name is one Docker listed, and it has the plain shape.
fn context_ok_in(c: &str, known: &[String]) -> bool {
    name_shape_ok(c) && known.iter().any(|k| k == c)
}

// In tests the set holds the Colima names the other tests use; no test changes it afterwards.
#[cfg(test)]
fn seed_known_for_tests() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        set_known(
            ["colima", "colima-work", "colima-dev"]
                .map(String::from)
                .to_vec(),
        )
    });
}

pub(crate) fn context_ok(c: &str) -> bool {
    #[cfg(test)]
    seed_known_for_tests();
    context_ok_in(c, &KNOWN.lock().unwrap_or_else(|p| p.into_inner()))
}

#[tauri::command]
pub async fn list_engines() -> Result<Vec<Engine>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut cmd = Command::new(find_bin("docker"));
        cmd.args(["context", "ls", "--format", "{{json .}}"])
            .env("PATH", path_env());
        let (ok, out, err) = output_with_deadline(cmd, LIST_DEADLINE)
            .map_err(|e| format!("Could not run docker: {e}. Is it installed?"))?;
        if !ok {
            return Err(String::from_utf8_lossy(&err).trim().to_string());
        }
        let mut list = engines_from(parse_contexts(&String::from_utf8_lossy(&out)));
        // All engines are asked at once, so one that hangs costs 3 seconds, not 3 seconds each.
        let answers: Vec<Option<String>> = std::thread::scope(|s| {
            let handles: Vec<_> = list
                .iter()
                .map(|e| {
                    let id = e.id.clone();
                    s.spawn(move || probe(&id))
                })
                .collect();
            handles
                .into_iter()
                .map(|h| h.join().unwrap_or(None))
                .collect()
        });
        for (e, version) in list.iter_mut().zip(answers) {
            e.reachable = version.is_some();
            e.server_version = version;
        }
        set_known(known_names(&list));
        Ok(list)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOME: &str = "unix:///Users/me";

    #[test]
    fn given_the_default_colima_context_when_classified_then_it_is_colima() {
        assert_eq!(
            classify("colima", &format!("{HOME}/.colima/default/docker.sock")),
            EngineKind::Colima
        );
    }

    #[test]
    fn given_a_named_colima_profile_when_classified_then_it_is_colima() {
        assert_eq!(
            classify("colima-work", &format!("{HOME}/.colima/work/docker.sock")),
            EngineKind::Colima
        );
    }

    #[test]
    fn given_the_docker_desktop_context_when_classified_then_it_is_docker_desktop() {
        assert_eq!(
            classify("desktop-linux", &format!("{HOME}/.docker/run/docker.sock")),
            EngineKind::DockerDesktop
        );
    }

    #[test]
    fn given_the_docker_desktop_name_with_a_foreign_endpoint_when_classified_then_it_is_docker_desktop(
    ) {
        assert_eq!(
            classify("desktop-linux", "unix:///tmp/x.sock"),
            EngineKind::DockerDesktop
        );
    }

    #[test]
    fn given_an_orbstack_endpoint_when_classified_then_it_is_orbstack() {
        assert_eq!(
            classify("orbstack", &format!("{HOME}/.orbstack/run/docker.sock")),
            EngineKind::Orbstack
        );
    }

    #[test]
    fn given_a_rancher_desktop_endpoint_when_classified_then_it_is_rancher_desktop() {
        assert_eq!(
            classify("rancher-desktop", &format!("{HOME}/.rd/docker.sock")),
            EngineKind::RancherDesktop
        );
    }

    #[test]
    fn given_a_podman_machine_endpoint_when_classified_then_it_is_podman() {
        assert_eq!(
            classify(
                "podman-machine-default",
                &format!("{HOME}/.local/share/containers/podman/machine/podman.sock")
            ),
            EngineKind::Podman
        );
    }

    #[test]
    fn given_the_plain_default_context_when_classified_then_it_is_other() {
        assert_eq!(
            classify("default", "unix:///var/run/docker.sock"),
            EngineKind::Other
        );
    }

    #[test]
    fn given_a_remote_ssh_context_when_classified_then_it_is_other() {
        assert_eq!(
            classify("build-box", "ssh://me@build.example.com"),
            EngineKind::Other
        );
    }

    #[test]
    fn given_a_context_named_colima_with_a_foreign_endpoint_when_classified_then_the_name_alone_does_not_make_it_colima(
    ) {
        assert_eq!(
            classify("colima", "unix:///tmp/other.sock"),
            EngineKind::Other
        );
    }

    #[test]
    fn given_colima_endpoints_when_the_machine_is_read_then_it_is_the_folder_after_dot_colima() {
        assert_eq!(
            machine_of(
                EngineKind::Colima,
                &format!("{HOME}/.colima/default/docker.sock")
            ),
            Some("default".into())
        );
        assert_eq!(
            machine_of(
                EngineKind::Colima,
                &format!("{HOME}/.colima/work/docker.sock")
            ),
            Some("work".into())
        );
        assert_eq!(
            machine_of(
                EngineKind::Orbstack,
                &format!("{HOME}/.orbstack/run/docker.sock")
            ),
            None
        );
    }

    #[test]
    fn given_a_colima_endpoint_with_a_path_like_folder_when_read_then_there_is_no_machine() {
        assert_eq!(
            machine_of(
                EngineKind::Colima,
                &format!("{HOME}/.colima/../x/docker.sock")
            ),
            None
        );
        assert_eq!(
            machine_of(EngineKind::Colima, &format!("{HOME}/.colima//docker.sock")),
            None
        );
    }

    #[test]
    fn given_each_kind_when_labelled_then_colima_names_its_machine_and_others_use_the_runtime_name()
    {
        assert_eq!(
            label_of(EngineKind::Colima, "colima-work", Some("work")),
            "Colima · work"
        );
        assert_eq!(
            label_of(EngineKind::DockerDesktop, "desktop-linux", None),
            "Docker Desktop"
        );
        assert_eq!(label_of(EngineKind::Orbstack, "orbstack", None), "OrbStack");
        assert_eq!(
            label_of(EngineKind::RancherDesktop, "rancher-desktop", None),
            "Rancher Desktop"
        );
        assert_eq!(
            label_of(EngineKind::Podman, "podman-machine-default", None),
            "Podman"
        );
        assert_eq!(label_of(EngineKind::Other, "build-box", None), "build-box");
    }

    const LISTING: &str = concat!(
        r#"{"Current":true,"Description":"colima","DockerEndpoint":"unix:///Users/me/.colima/default/docker.sock","Error":"","Name":"colima"}"#,
        "\n",
        r#"{"Current":false,"Description":"Current DOCKER_HOST based configuration","DockerEndpoint":"unix:///var/run/docker.sock","Error":"","Name":"default"}"#,
        "\n",
        r#"{"Current":false,"Description":"Docker Desktop","DockerEndpoint":"unix:///Users/me/.docker/run/docker.sock","Error":"","Name":"desktop-linux"}"#,
        "\n"
    );

    #[test]
    fn given_docker_context_ls_json_lines_when_parsed_then_name_endpoint_and_current_are_read() {
        let rows = parse_contexts(LISTING);
        assert_eq!(rows.len(), 3);
        assert_eq!(
            rows[0],
            ContextRow {
                name: "colima".into(),
                docker_endpoint: "unix:///Users/me/.colima/default/docker.sock".into(),
                current: true
            }
        );
        assert!(!rows[1].current);
    }

    #[test]
    fn given_a_blank_line_and_a_broken_line_when_parsed_then_they_are_skipped() {
        let text = format!("\n{{not json\n{}", LISTING);
        assert_eq!(parse_contexts(&text).len(), 3);
    }

    #[test]
    fn given_a_context_name_with_a_space_or_a_leading_dash_when_listed_then_it_is_left_out() {
        let rows = vec![
            ContextRow {
                name: "my ctx".into(),
                docker_endpoint: "unix:///a".into(),
                current: false,
            },
            ContextRow {
                name: "-H".into(),
                docker_endpoint: "unix:///b".into(),
                current: false,
            },
            ContextRow {
                name: "fine".into(),
                docker_endpoint: "unix:///c".into(),
                current: false,
            },
        ];
        let ids: Vec<String> = engines_from(rows).into_iter().map(|e| e.id).collect();
        assert_eq!(ids, vec!["fine"]);
    }

    #[test]
    fn given_a_listing_when_built_then_colima_has_a_machine_and_a_kube_context_and_others_have_none(
    ) {
        let list = engines_from(parse_contexts(LISTING));
        assert_eq!(list[0].machine_name.as_deref(), Some("default"));
        assert_eq!(
            list[0].kubernetes,
            Some(KubeRef {
                context: "colima".into()
            })
        );
        assert_eq!(list[0].label, "Colima · default");
        assert!(list[0].current);
        assert_eq!(list[1].kind, EngineKind::Other);
        assert_eq!(list[2].kind, EngineKind::DockerDesktop);
        assert!(list[1..]
            .iter()
            .all(|e| e.machine_name.is_none() && e.kubernetes.is_none() && !e.reachable));
    }

    #[test]
    fn given_the_json_shape_when_an_engine_is_serialized_then_the_keys_are_camel_case_and_the_kind_is_kebab_case(
    ) {
        let list = engines_from(parse_contexts(LISTING));
        let v = serde_json::to_value(&list[2]).unwrap();
        assert_eq!(v["id"], "desktop-linux");
        assert_eq!(v["kind"], "docker-desktop");
        assert_eq!(v["serverVersion"], serde_json::Value::Null);
        assert_eq!(v["machineName"], serde_json::Value::Null);
        assert_eq!(v["kubernetes"], serde_json::Value::Null);
        assert_eq!(v["reachable"], false);
    }

    #[test]
    fn given_a_version_on_stdout_and_exit_zero_when_judged_then_the_engine_answers() {
        assert_eq!(probe_verdict(true, "29.2.1\n"), Some("29.2.1".into()));
    }

    #[test]
    fn given_exit_one_or_empty_stdout_when_judged_then_it_does_not_answer() {
        assert_eq!(probe_verdict(false, ""), None);
        assert_eq!(probe_verdict(false, "29.2.1"), None);
        assert_eq!(probe_verdict(true, "  \n"), None);
    }

    #[test]
    fn given_a_name_in_the_known_set_when_checked_then_it_is_accepted() {
        let known = vec!["colima".to_string(), "desktop-linux".to_string()];
        assert!(context_ok_in("desktop-linux", &known));
    }

    #[test]
    fn given_a_name_not_in_the_set_when_checked_then_it_is_refused() {
        let known = vec!["colima".to_string()];
        assert!(!context_ok_in("orbstack", &known));
        assert!(!context_ok_in("", &known));
    }

    #[test]
    fn given_a_name_with_a_space_or_a_leading_dash_when_checked_then_it_is_refused_even_if_listed()
    {
        let known = vec!["my ctx".to_string(), "-H".to_string(), "colima".to_string()];
        assert!(!context_ok_in("my ctx", &known));
        assert!(!context_ok_in("-H", &known));
        assert!(!context_ok_in("colima --readonly=false", &known));
    }

    #[test]
    fn given_a_name_longer_than_sixty_three_characters_when_checked_then_it_is_refused() {
        let long = "a".repeat(64);
        assert!(!context_ok_in(&long, std::slice::from_ref(&long)));
        let max = "a".repeat(63);
        assert!(context_ok_in(&max, std::slice::from_ref(&max)));
    }

    #[test]
    fn given_the_global_check_when_a_context_is_unknown_then_it_is_refused() {
        assert!(context_ok("colima"));
        assert!(context_ok("colima-work"));
        assert!(!context_ok("desktop-linux"));
        assert!(!context_ok("default"));
    }

    #[test]
    fn given_a_listing_when_the_known_names_are_built_then_every_valid_name_is_in_it() {
        let names = known_names(&engines_from(parse_contexts(LISTING)));
        assert_eq!(names, vec!["colima", "default", "desktop-linux"]);
    }
}
```

3. Edit `src-tauri/src/main.rs`, in this order:
   1. Find the line `mod desktop;`. On the next line add `mod engine;`. On the line after that add `use engine::context_ok;`.
   2. Find `fn context_ok(c: &str) -> bool {` (with the two comment lines above it that start `// Colima registers`). Rename the function to `colima_context_ok`. Keep the body and the comments.
   3. In `fn kubectl` find `Some(c) if !listing_contexts && context_ok(&c) => {` and replace with `Some(c) if !listing_contexts && colima_context_ok(&c) => {`.
   4. In `fn terminal_command` find `("k9s", None) => Ok(format!("{} --context {}", find_bin("k9s"), context)),` and replace with `("k9s", None) if colima_context_ok(context) => Ok(format!("{} --context {}", find_bin("k9s"), context)),`.
   5. In the test `only_colima_contexts_are_accepted` replace every `context_ok(` by `colima_context_ok(` (names stay). Nothing else in that test changes.
   6. In the `generate_handler![` list add `engine::list_engines` as the last entry (after the last existing entry, with a comma before it). The list there is written without file prefixes: add the prefix only to this entry.
   7. Every other call to `context_ok(` in `main.rs` (in `docker`, `docker_pull`, `network_probe`, `probe_inputs_ok`, `terminal_command`, `compose_*`, `container_shell`) stays as it is: it now uses the new rule through the `use` line.

4. Edit `src-tauri/src/desktop.rs`: in the first `use crate::{context_ok, find_bin, ...};` line replace `context_ok` by `colima_context_ok`, and replace its three calls `context_ok(` by `colima_context_ok(` (the bring-over only ever talks to Colima and Docker Desktop's own context, which is why line `if context != DESKTOP_CTX && !context_ok(&context)` keeps its shape).

5. Run `cd src-tauri && cargo fmt && cargo clippy --all-targets -- -D warnings && cargo test 2>&1 | grep "test result"`. The passed number must be at least **B + 26** and `0 failed`.

6. Commit the tests first if you split commits: `test: classify every engine kind` (engine.rs), then `feat: list every Docker context as an engine` (main.rs, desktop.rs).

7. Hand check. Not verified in CI: it needs a Mac with Docker Desktop or OrbStack running and Colima stopped. If you do not have that Mac, write "Hand check not done on this machine" in the pull request file and go on. If you have it, run `docker context ls --format '{{json .}}'` (read-only, allowed) and paste its output in the pull request file. The app side of this check is WO-4.2b.

**Tests to write first** (all are in `engine.rs`, all Given/When/Then, all pass in the scratch crate). One per row of the classification table, and the rest of the file:

Classification (rows 1 to 6 of the table, plus the trap):
1. `given_the_default_colima_context_when_classified_then_it_is_colima`
2. `given_a_named_colima_profile_when_classified_then_it_is_colima`
3. `given_the_docker_desktop_context_when_classified_then_it_is_docker_desktop`
4. `given_the_docker_desktop_name_with_a_foreign_endpoint_when_classified_then_it_is_docker_desktop`
5. `given_an_orbstack_endpoint_when_classified_then_it_is_orbstack`
6. `given_a_rancher_desktop_endpoint_when_classified_then_it_is_rancher_desktop`
7. `given_a_podman_machine_endpoint_when_classified_then_it_is_podman`
8. `given_the_plain_default_context_when_classified_then_it_is_other`
9. `given_a_remote_ssh_context_when_classified_then_it_is_other`
10. `given_a_context_named_colima_with_a_foreign_endpoint_when_classified_then_the_name_alone_does_not_make_it_colima`

Machine, label, parsing, shape:
11. `given_colima_endpoints_when_the_machine_is_read_then_it_is_the_folder_after_dot_colima`
12. `given_a_colima_endpoint_with_a_path_like_folder_when_read_then_there_is_no_machine`
13. `given_each_kind_when_labelled_then_colima_names_its_machine_and_others_use_the_runtime_name`
14. `given_docker_context_ls_json_lines_when_parsed_then_name_endpoint_and_current_are_read`
15. `given_a_blank_line_and_a_broken_line_when_parsed_then_they_are_skipped`
16. `given_a_context_name_with_a_space_or_a_leading_dash_when_listed_then_it_is_left_out`
17. `given_a_listing_when_built_then_colima_has_a_machine_and_a_kube_context_and_others_have_none`
18. `given_the_json_shape_when_an_engine_is_serialized_then_the_keys_are_camel_case_and_the_kind_is_kebab_case`

Reachability:
19. `given_a_version_on_stdout_and_exit_zero_when_judged_then_the_engine_answers`
20. `given_exit_one_or_empty_stdout_when_judged_then_it_does_not_answer`

`context_ok` (plan 4.1 item 3: refuses a name not in the set, a name with a space, a name starting with `-`):
21. `given_a_name_in_the_known_set_when_checked_then_it_is_accepted`
22. `given_a_name_not_in_the_set_when_checked_then_it_is_refused`
23. `given_a_name_with_a_space_or_a_leading_dash_when_checked_then_it_is_refused_even_if_listed`
24. `given_a_name_longer_than_sixty_three_characters_when_checked_then_it_is_refused`
25. `given_the_global_check_when_a_context_is_unknown_then_it_is_refused`
26. `given_a_listing_when_the_known_names_are_built_then_every_valid_name_is_in_it`

**Done when:**
1. `(cd src-tauri && cargo test engine:: 2>&1 | grep "test result")` prints `test result: ok. 26 passed; 0 failed`.
2. `(cd src-tauri && cargo test 2>&1 | grep "test result")` shows `0 failed` and at least B + 26 passed (B from Starting state 6).
3. `grep -c "fn colima_context_ok" src-tauri/src/main.rs` prints `1`; `grep -c "^use engine::context_ok;" src-tauri/src/main.rs` prints `1`; `grep -c "engine::list_engines" src-tauri/src/main.rs` prints `1`.
4. `grep -c "colima_context_ok" src-tauri/src/desktop.rs` prints `4`.
5. `(cd src-tauri && cargo clippy --all-targets -- -D warnings 2>&1 | tail -2)` has no `error`; `cargo fmt --check` prints nothing.
6. The gate (`../HANDOFF.md` section 5).
7. The pull request file says whether the hand check on a Mac with Docker Desktop or OrbStack was done, and pastes its output if it was.

**Pull request title** (first line of `docs/plan/iterations/pr/wo-4.1.md`): `wo-4.1: The backend lists every Docker on the Mac as an engine`

---

## WO-4.2a The engine switcher lists every Docker, and the app follows the engine you pick

**Needs:** WO-4.1.

**Why:** E7 (the chosen engine is not remembered and no default is picked), E8. After this work order the switcher shows Colima machines, Docker Desktop, OrbStack, Rancher Desktop, Podman and other contexts from `list_engines`, picking one is remembered (`openpier:engine`), and the app's `ctx` is the picked engine. The leftovers of the old runtime code are removed in WO-4.2b.

**Read first:**
1. `docs/plan/05-implementation-plan.md` task 4.2; `docs/plan/04-design-spec.md` sections 5.3 and 6.9 item 2; mockup `engineMenu` and the pictures `docs/plan/design/shots/engine-switcher-light.png` and `-dark.png`.
2. `src/lib/engineModel.ts`, `src/lib/engineModel.test.ts`, `src/EngineSwitcher.tsx`, `src/EngineSwitcher.test.tsx` (iteration 2, WO-2.3), `src/ui/op/Menu.tsx`.
3. `src/App.tsx` in full, and `src/api.ts` (`Profile`, `StartOpts`, `ctxFor`).
4. `src/runtime/colima-adapter.ts` (what `listMachines` and the others wrap).
5. TanStack Query v5: `useQuery` https://tanstack.com/query/v5/docs/framework/react/reference/useQuery and `focusManager` https://tanstack.com/query/v5/docs/framework/react/reference/focusManager (checked: `focusManager.setEventListener(setup)` where `setup` receives a `setFocused` function and may return a cleanup function).

**Starting state:**
1. `git status --short` prints nothing; `ls src/lib/engineModel.ts src/EngineSwitcher.tsx src/lib/engineModel.test.ts src/EngineSwitcher.test.tsx` lists all four; `ls src/lib/engines.ts src/lib/machines 2>&1` says both do not exist.
2. `grep -c "ColimaEngine" src/lib/engineModel.ts` prints at least `1`.
3. `grep -rln "ColimaEngine\|engineOfProfile\|lib/engineModel" src --include='*.ts' --include='*.tsx'` lists the importers. Expected: `src/App.tsx`, `src/EngineSwitcher.tsx`, `src/EngineSwitcher.test.tsx`, `src/lib/engineModel.ts`, `src/lib/engineModel.test.ts`, and possibly `src/lib/paletteModel.ts` or `src/Header.tsx`. Write the list down: every file on it is changed in step 8.
4. `grep -c "list_engines" src-tauri/src/engine.rs` prints at least `1` (WO-4.1 is merged).
5. `grep -rn "runtimeRegistry" src --include='*.tsx' --include='*.ts' | grep -v "^src/runtime/"` prints only lines of `src/App.tsx`. If it prints a line of `src/Shell.tsx`, stop and report (WO-2.2 should have removed the Runtime select).
6. `grep -n "QueryClientProvider" src/App.tsx src/main.tsx` prints lines of `src/App.tsx` only.
7. `grep -n "useState<string | null>(null)" src/App.tsx | grep -i active` prints the line `const [active, setActive] = useState<string | null>(null);` (the machine the app is showing; this work order removes it).

If any differs, stop and report.

**Do not touch:** the Rust code, `src/runtime/*` (deleted in WO-4.2b), the Settings pages, the screens' own files (their `ctx` prop keeps its name and meaning), `src/ui/` except `Menu.tsx` as step 6 says.

**The Engine and EngineKind types in TypeScript** (they are in the full file of step 2; they mirror the Rust ones and the JSON in WO-4.1):

```ts
export type EngineKind = "colima" | "docker-desktop" | "orbstack" | "rancher-desktop" | "podman" | "other";
export type KubeRef = { context: string };
export type Engine = {
  id: string; label: string; kind: EngineKind; endpoint: string; reachable: boolean;
  serverVersion: string | null; current: boolean; machineName: string | null; kubernetes: KubeRef | null;
};
```

**Steps:**

1. Write the tests of this work order first (below). Run them, see them fail for the right reason (missing exports), then do steps 2 to 9.

2. Replace the whole content of `src/lib/engineModel.ts` (the old content, `ColimaEngine`, `engineOfProfile` and `EngineOptions` included, is deleted). Full content:

```ts
import type { Profile } from "../api";
import { gbOf } from "../api";

export type EngineKind = "colima" | "docker-desktop" | "orbstack" | "rancher-desktop" | "podman" | "other";
export type KubeRef = { context: string };

// What the backend's list_engines returns for one Docker context (src-tauri/src/engine.rs).
export type Engine = {
  id: string; // the Docker context name; every docker call passes it back
  label: string; // "Colima · default", "Docker Desktop", "OrbStack", or the context name
  kind: EngineKind;
  endpoint: string;
  reachable: boolean;
  serverVersion: string | null;
  current: boolean;
  machineName: string | null; // the Colima machine behind it; null when the app cannot manage the VM
  kubernetes: KubeRef | null;
};

// The order of the groups in the switcher.
export const KIND_ORDER: EngineKind[] = ["colima", "docker-desktop", "orbstack", "rancher-desktop", "podman", "other"];
export const KIND_CAPTION: Record<EngineKind, string> = {
  colima: "Colima",
  "docker-desktop": "Docker Desktop",
  orbstack: "OrbStack",
  "rancher-desktop": "Rancher Desktop",
  podman: "Podman",
  other: "Other",
};

export const sortEngines = (list: Engine[]): Engine[] =>
  [...list].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.label.localeCompare(b.label));

// Which engine is selected: the stored one if it still exists, else the first one that answers, else the first.
export function chooseDefault(list: Engine[], stored: string | null): Engine | null {
  const sorted = sortEngines(list);
  return sorted.find((e) => e.id === stored) ?? sorted.find((e) => e.reachable) ?? sorted[0] ?? null;
}

export type EngineState = "running" | "stopped" | "starting" | "stopping" | "unreachable";

// What the switcher and the pages show for one engine: the backend's Engine plus the Colima machine behind it.
export type EngineView = {
  engine: Engine;
  id: string;
  kind: EngineKind;
  caption: string; // "Colima", "Docker Desktop", ...
  name: string; // "default" for a Colima machine, else the context name
  label: string;
  state: EngineState;
  managed: boolean; // the app can start and stop it: kind colima and a machine name
  cpus: number | null;
  memoryGb: number | null;
  kubernetes: boolean;
};

export type ViewOptions = { machine?: Profile | null; busy?: "starting" | "stopping" | null; kubernetes?: boolean };

export function viewOf(engine: Engine, o: ViewOptions = {}): EngineView {
  const managed = engine.kind === "colima" && engine.machineName !== null;
  const claimsRunning = o.machine?.status === "Running";
  const state: EngineState = o.busy ?? (engine.reachable ? "running" : managed && claimsRunning ? "unreachable" : "stopped");
  return {
    engine,
    id: engine.id,
    kind: engine.kind,
    caption: KIND_CAPTION[engine.kind],
    name: managed ? (engine.machineName as string) : engine.id,
    label: engine.label,
    state,
    managed,
    cpus: o.machine ? o.machine.cpus : null,
    memoryGb: o.machine ? gbOf(o.machine.memory) : null,
    kubernetes: managed && state === "running" && !!o.kubernetes && engine.kubernetes !== null,
  };
}

// The muted line under the label (spec 5.3 rule 2).
export function stateLine(e: EngineView): string {
  switch (e.state) {
    case "running": return e.managed && e.cpus !== null ? `Running · ${e.cpus} CPU · ${e.memoryGb} GB` : "Running";
    case "stopped": return e.managed ? "Stopped" : "Not running";
    case "starting": return "Starting…";
    case "stopping": return "Stopping…";
    case "unreachable": return "Not reachable";
  }
}

// The facts on a row of the popover: "4 CPU · 8 GB · Kubernetes", "Stopped", "Not running".
export function factsLine(e: EngineView): string {
  if (e.state !== "running" || !e.managed || e.cpus === null) return stateLine(e);
  return [`${e.cpus} CPU`, `${e.memoryGb} GB`, ...(e.kubernetes ? ["Kubernetes"] : [])].join(" · ");
}

export const dotOf = (e: EngineView): "ok" | "bad" | "busy" | "off" =>
  e.state === "running" ? "ok" : e.state === "unreachable" ? "bad" : e.state === "starting" || e.state === "stopping" ? "busy" : "off";

// "Engine: Colima, default. Running" (the button's accessible name, as in the mockup).
export const buttonLabel = (e: EngineView): string => `Engine: ${e.caption}, ${e.name}. ${stateLine(e).split(" · ")[0]}`;

export const canStart = (e: EngineView): boolean => e.managed && e.state === "stopped";
export const canStop = (e: EngineView): boolean => e.managed && e.state === "running";

// Spec 5.3 rule 6: an engine the app cannot start says so in the tooltip of its row.
export const hintOf = (e: EngineView): string | null => (!e.managed && e.state === "stopped" ? `Not running. Start it from ${e.kind === "other" ? "the tool that provides it" : e.caption}.` : null);

export type EngineGroup = { caption: string; engines: EngineView[] };
export function groupEngines(list: EngineView[]): EngineGroup[] {
  return KIND_ORDER.map((k) => ({ caption: KIND_CAPTION[k], engines: list.filter((e) => e.kind === k) })).filter((g) => g.engines.length > 0);
}

// Which machine an operation in progress belongs to. App.tsx passes { op: vm.op, name: opName(vm) }; "restarting" shows as "starting".
export type BusyInput = { op: "starting" | "stopping" | "restarting" | null; name?: string };
export const busyOf = (b: BusyInput, machine: string): "starting" | "stopping" | null =>
  b.op && b.name === machine ? (b.op === "stopping" ? "stopping" : "starting") : null;

// The page shown in place of a list when the selected engine is not running (spec 6.9 item 2).
export type StoppedCopy = { title: string; text: string; action: "start" | "open-desktop" | null; actionLabel: string | null };
export function stoppedCopy(e: EngineView): StoppedCopy {
  if (e.managed) return { title: `${e.name} is stopped`, text: "Your containers and data are kept. Start the machine to see them.", action: "start", actionLabel: `Start ${e.name}` };
  if (e.kind === "docker-desktop") return { title: "Docker Desktop is stopped", text: "Start it from Docker Desktop.", action: "open-desktop", actionLabel: "Open Docker Desktop" };
  if (e.kind === "other") return { title: `${e.label} is stopped`, text: "Start it from the tool that provides it.", action: null, actionLabel: null };
  return { title: `${e.caption} is stopped`, text: `Start it from ${e.caption}.`, action: null, actionLabel: null };
}
```

3. Create `src/lib/engines.ts`. Full content (the hooks and the saved choice; pure rules stay in `engineModel.ts` so node tests can import them):

```ts
import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { chooseDefault, sortEngines, type Engine } from "./engineModel";

export type { Engine, EngineKind } from "./engineModel";

export const ENGINE_KEY = "openpier:engine";
export const ENGINES_EVERY_MS = 5000;
export const enginesKey = ["mac", "engines"] as const;

const readStored = (): string | null => {
  try { return localStorage.getItem(ENGINE_KEY); } catch { return null; }
};
let stored: string | null = readStored();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

// Pick an engine. The choice is remembered; when storage is off it lasts until the page closes.
export function selectEngine(id: string): void {
  stored = id;
  try { localStorage.setItem(ENGINE_KEY, id); } catch { /* not remembered */ }
  listeners.forEach((l) => l());
}

// Tests only: forget the choice and read storage again.
export function resetEngineSelection(): void {
  stored = readStored();
  listeners.forEach((l) => l());
}

// Every Docker context on the Mac, sorted for the switcher, asked again every 5 seconds.
export function useEngines() {
  return useQuery({
    queryKey: enginesKey,
    queryFn: async () => sortEngines(await invoke<Engine[]>("list_engines")),
    refetchInterval: ENGINES_EVERY_MS,
  });
}

// The selected engine: the saved one if it still exists, else the first one that answers, else the first. Null until the list has loaded.
export function useEngine(): Engine | null {
  const { data } = useEngines();
  const id = useSyncExternalStore(subscribe, () => stored);
  return data ? chooseDefault(data, id) : null;
}
```

4. Create `src/lib/queryClient.ts` and use it. Full content:

```ts
import { QueryClient, focusManager } from "@tanstack/react-query";

// One client for the whole app. A list is fresh for 1 second, so two screens asking for the same list share one read.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000, retry: 1, refetchOnWindowFocus: true } },
});

// A poll costs a docker process. The old usePoll stopped when the window was hidden or not focused, and so does this
// (refetchIntervalInBackground stays false, which pauses polling while the client is unfocused).
focusManager.setEventListener((setFocused) => {
  const update = () => setFocused(document.visibilityState !== "hidden" && document.hasFocus());
  window.addEventListener("focus", update);
  window.addEventListener("blur", update);
  document.addEventListener("visibilitychange", update);
  return () => {
    window.removeEventListener("focus", update);
    window.removeEventListener("blur", update);
    document.removeEventListener("visibilitychange", update);
  };
});
```

   Not verified: that TanStack Query v5 pauses `refetchInterval` while `focusManager.isFocused()` is false when `refetchIntervalInBackground` is not set. The test `queryClient.test.tsx` in this step checks it; if it fails, stop and report.

   Then edit `src/main.tsx`: add `import { QueryClientProvider } from "@tanstack/react-query";` and `import { queryClient } from "./lib/queryClient";` and wrap the element that renders `<App />` (find the `<App />` in the `root.render(` call of the `else` branch) in `<QueryClientProvider client={queryClient}> ... </QueryClientProvider>`, inside any provider already there. Edit `src/App.tsx`: delete the import line of `QueryClient, QueryClientProvider`, delete the `const queryClient = new QueryClient({ ... });` statement, and in the returned JSX delete the opening `<QueryClientProvider client={queryClient}>` and its closing tag (keep what is inside). Reason: `App` itself now calls `useEngines`, so the provider must be above it.

   Create `src/test/withQuery.tsx` for the tests of this iteration:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export const testClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 0 } } });

// Wrap a component under test: render(withQuery(<Images ctx="colima" />)).
export const withQuery = (ui: React.ReactElement, client: QueryClient = testClient()) => <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
```

5. Create `src/lib/machines/colima.ts`. Full content (the machine driver for Colima only; it wraps what `src/runtime/colima-adapter.ts` did, with the same command names and arguments):

```ts
import { invoke } from "@tauri-apps/api/core";
import type { Profile, StartOpts } from "../../api";

export type ResourceOpts = { cpus?: number; memory?: number; disk?: number };

// The Docker context Colima registers for a machine: "colima" for default, "colima-<name>" otherwise. Same rule as ctxFor in src/api.ts, which WO-4.2b removes.
export const engineIdOf = (machine: string): string => (machine === "default" ? "colima" : `colima-${machine}`);

export const listMachines = () => invoke<Profile[]>("list_profiles");
export const startMachine = (opts: StartOpts) => invoke<void>("start_profile", { opts });
export const stopMachine = (name: string) => invoke<void>("stop_profile", { name });
export const applyResources = (name: string, opts: ResourceOpts) => invoke<void>("apply_resources", { name, opts, restart: true });
export const deleteMachine = (name: string) => invoke<void>("delete_profile", { name });
```

6. **Extend `Menu`: a title on a radio row.** In `src/ui/op/Menu.tsx` give `MenuRadioItem` an optional prop `title?: string`, passed to the Radix `DropdownMenu.RadioItem` element as `title`. Test, added to `src/ui/op/Menu.test.tsx`: `Given a MenuRadioItem with title "Not running", When rendered open, Then its element has the title attribute "Not running"`.

7. Rewrite `src/EngineSwitcher.tsx` for `EngineView`. Props (the old ones plus `machines`, with `engines` now `EngineView[]`):

```ts
export type EngineSwitcherProps = {
  engines: EngineView[];
  selectedId: string | null;
  machines: boolean; // true when Colima is installed: only then "Machines…" is offered
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onMachines: () => void;
};
```

   Everything of WO-2.3 step 4 stays (the trigger, the `MenuRadioGroup`, the check mark, the separator), with these changes, imports from `./lib/engineModel`:
   1. The groups come from `groupEngines(engines)`; the caption of each is `<MenuCaption>{caption}</MenuCaption>`.
   2. A row is `<MenuRadioItem value={e.id} title={hintOf(e) ?? undefined}>` holding `<Dot state={dotOf(e)} /><span className="name">{e.name}</span><span className="meta grow truncate">{factsLine(e)}</span>` and then the check mark for the selected one, or `<Button size="xs" onClick={...}>Start</Button>` only when `canStart(e)`. No button for any other engine (spec 5.3 rule 6).
   3. `Stop {name}` only when `canStop(selected)`. `Machines…` only when `machines` is true.
   4. With no engine at all the trigger is `<EngineButton dot="off" name="No engine" state="Not set up" aria-label="Engine: none" />` and the menu holds `Machines…` only when `machines` is true.
   5. The trigger's `name` is `selected.label` ("Colima · default", "Docker Desktop") and its `state` is `stateLine(selected)`.

8. Change every importer of step "Starting state 3" to the new names. Each file on the list: replace `ColimaEngine` by `EngineView`, `engineOfProfile(p, opts)` by `viewOf(engineOfMachine, { machine: p, busy, kubernetes })`, and the import path stays `./lib/engineModel`. Then edit `src/App.tsx` (find each name quoted; where a name is not found, stop and report):
   1. Imports: remove `import { runtimeRegistry } from "./runtime";` and `ctxFor` from the `./api` import. Add `import { useEngine, useEngines, selectEngine } from "./lib/engines";`, `import { viewOf, busyOf } from "./lib/engineModel";` (it may already import `busyOf`), `import { listMachines, engineIdOf } from "./lib/machines/colima";`.
   2. Delete the state `const [activeRuntimeId, setActiveRuntimeId] = useState<string | null>(null);` and the whole `useEffect` that reads `runtimeRegistry.getActive()` and listens to `runtime-changed` (the block ending with `window.removeEventListener("runtime-changed", ...)`). The event `runtime-changed` has no sender any more.
   3. In `reloadProfiles` replace the body by: `try { setProfiles(await listMachines()); setProfilesError(null); } catch (e) { setProfilesError(String(e)); setProfiles([]); }`. In the effect that calls it, keep the `setInterval` (WO-4.3a removes it) and remove `activeRuntimeId` from its dependency array.
   4. The selected machine and engine. Add after `profiles` is defined: `const enginesQuery = useEngines(); const engine = useEngine();`. Delete `const [active, setActive] = useState<string | null>(null);`, the `useState` that reads `openpier:engine` from storage (`const [stored] = useState(...)`), and the `useEffect` that sets `active` when no profile matches (the one with `setActive((profiles.find((p) => p.status === "Running") ?? profiles[0])?.name ?? null)`). Define instead:

```ts
  // The selected engine, and the Colima machine behind it (null for Docker Desktop and the others).
  const current = engine?.machineName ? profiles.find((p) => p.name === engine.machineName) ?? null : null;
  const ctx = engine?.reachable ? engine.id : null;
```

      Delete the old `const current = ...` and `const ctx = ...` lines (the ones using `active` and `ctxFor`).
   5. Every other use of `active`: run `grep -n "\bactive\b" src/App.tsx`. Each hit that means "the machine's name" becomes `current?.name ?? null`. Each `setActive(name)` becomes `selectEngine(engineIdOf(name))` (it is a machine that was just started or picked). `switchTo(name)` stays as a function but its body is `selectEngine(engineIdOf(name)); setDetailId(null);` plus what it did besides storing the key (the old `localStorage.setItem("openpier:engine", ...)` line is deleted: `selectEngine` stores it). The engine switcher's `onSelect` gets an engine id, not a machine name: `onSelect={(id) => { selectEngine(id); setDetailId(null); }}`.
   6. The list for the switcher: replace the `engines` memo by:

```ts
  const views = useMemo(
    () => (enginesQuery.data ?? []).map((e) => viewOf(e, { machine: profiles.find((p) => p.name === e.machineName) ?? null, busy: e.machineName ? busyOf({ op: vm.op, name: opName(vm) }, e.machineName) : null, kubernetes: e.machineName !== null && e.machineName === current?.name && kubeOn })),
    [enginesQuery.data, profiles, vm, current?.name, kubeOn],
  );
  const selectedView = views.find((v) => v.id === engine?.id) ?? null;
```

      Pass `engines={views}`, `selectedId={engine?.id ?? null}`, `machines={!!env?.colima}`. `onStart={(id) => { const m = views.find((v) => v.id === id)?.engine.machineName; if (!m) return; selectEngine(id); setTab("Containers"); void vmFromAnywhere(m, "starting"); }}`, `onStop={(id) => { const m = views.find((v) => v.id === id)?.engine.machineName; if (m) void vmFromAnywhere(m, "stopping"); }}`. `kubeOn` is defined after `current` in the file; if the order is wrong, move the `views` memo below it.
   7. The old `kubeOn` line uses `ctxFor(current.name)`: replace `ctxFor(current.name)` by `engine?.kubernetes?.context ?? ""`. In the `kubeOn={(name) => ...}` prop replace `ctxFor(name)` by `engineIdOf(name)`.
   8. `const toolsMissing = !!env && (!env.colima || !env.docker);` becomes `const toolsMissing = !!env && (!env.docker || (!env.colima && enginesQuery.data !== undefined && !enginesQuery.data.some((e) => e.reachable)));` so a Mac with only Docker Desktop is not sent to the install card.
   9. Run `npx tsc --noEmit`. Fix only the errors that come from these renames. Any other error: stop and report.

9. Mock: preview `list_engines` and the three scenarios. In `preview/mock.ts`:
   1. After the `db` object and `scenario` are defined (find `const scenario =`), add:

```ts
// Docker contexts, as `list_engines` returns them (src-tauri/src/engine.rs). The mock never looks at the context a call names.
type EngineJson = { id: string; label: string; kind: string; endpoint: string; reachable: boolean; serverVersion: string | null; current: boolean; machineName: string | null; kubernetes: { context: string } | null };
const sockOf = (rest: string) => `unix:///Users/me/${rest}`;
const colimaEngine = (m: string, reachable: boolean): EngineJson => {
  const id = m === "default" ? "colima" : `colima-${m}`;
  return { id, label: `Colima · ${m}`, kind: "colima", endpoint: sockOf(`.colima/${m}/docker.sock`), reachable, serverVersion: reachable ? "27.3.1" : null, current: id === "colima", machineName: m, kubernetes: { context: id } };
};
const desktopEngine = (reachable: boolean): EngineJson => ({ id: "desktop-linux", label: "Docker Desktop", kind: "docker-desktop", endpoint: sockOf(".docker/run/docker.sock"), reachable, serverVersion: reachable ? "27.3.1" : null, current: false, machineName: null, kubernetes: null });
const orbstackEngine = (reachable: boolean): EngineJson => ({ id: "orbstack", label: "OrbStack", kind: "orbstack", endpoint: sockOf(".orbstack/run/docker.sock"), reachable, serverVersion: reachable ? "27.3.1" : null, current: false, machineName: null, kubernetes: null });
// Three scenarios for Macs without Colima, or with every engine:
//   desktop-only: only Docker Desktop, running. No Colima machine, Colima is not installed.
//   orbstack-only: only OrbStack, running.
//   colima-and-desktop: Colima default (running) and work (stopped), Docker Desktop (running), OrbStack (not running): the engine switcher picture.
if (scenario === "desktop-only" || scenario === "orbstack-only") { db.profiles = []; env.colima = null; }
if (scenario === "colima-and-desktop" && !db.profiles.some((p) => p.name === "work")) db.profiles.push({ name: "work", status: "Stopped", arch: "aarch64", cpus: 2, memory: 4 * GB, disk: 40 * GB, runtime: "docker", address: "" });
const enginesNow = (): EngineJson[] =>
  scenario === "desktop-only" ? [desktopEngine(true)]
  : scenario === "orbstack-only" ? [orbstackEngine(true)]
  : [...db.profiles.map((p) => colimaEngine(p.name, p.status === "Running")), ...(scenario === "colima-and-desktop" ? [desktopEngine(true), orbstackEngine(false)] : [])];
```

      If `env` is declared after the line where `db.profiles = []` would run, place the `if (scenario === "desktop-only" ...)` line after the `const env` declaration.
   2. In the `switch (cmd)` of `invoke`, next to `case "list_profiles":` add `case "list_engines": return enginesNow().map((e) => ({ ...e })) as T;` (a fresh object per call, like the real IPC). The `start_profile` and `stop_profile` handlers already change `db.profiles[...].status`, so the Colima rows follow.
   3. `src/lib/mockCoverage.test.ts` must still pass (it now finds `list_engines` called by `src/lib/engines.ts` and handled).

10. Browser check `scripts/check-engines.mjs` (new). Full lines, messages in words, at 1180x760, scenario `colima-and-desktop` unless said (use `open`, `check`, `done` from `scripts/lib/check.mjs`; click `.engine` to open the popover):
    1. `engines: the popover has three captions, Colima, Docker Desktop and OrbStack, in that order` (texts of `.pop.engines .menu-cap`).
    2. `engines: the Colima group has default and work; Docker Desktop has desktop-linux; OrbStack has orbstack` (texts of `.row .name`).
    3. `engines: only the stopped Colima row has a Start button` (count of `.pop.engines button` whose text is `Start` is 1, inside the row named work).
    4. `engines: the OrbStack row says Not running and its tooltip says Not running. Start it from OrbStack.` (`meta` text and the `title` attribute).
    5. `engines: the Docker Desktop row says Running`.
    6. `engines: with default selected the menu offers Stop default and Machines…`.
    7. `engines: picking Docker Desktop closes the menu; the button says Docker Desktop and Running; the menu now has no Stop item`.
    8. `engines: after a reload the button still says Docker Desktop` (`localStorage["openpier:engine"] === "desktop-linux"`).
    9. `engines: the words profile, context and runtime do not appear in the open menu` (case-insensitive).
    10. `engines: scenario desktop-only: the button says Docker Desktop and the menu has no Machines…` (the scenario sets `env.colima` to null, so `machines` is false).
    Add the file to `scripts/check-all.sh` the same way the other checks are listed (find how `check-layout.mjs` is listed there and copy that line). In WebKit, a mouse click on a row must reach it (the lesson of `check-menus.mjs`).

11. Update `scripts/check-layout.mjs`: its engine switcher lines (WO-2.3 step 11) run on scenarios `design` and `two`, where `list_engines` returns only the Colima machines, so they keep passing. Run it and fix only a selector if one broke. Do not change a condition.

12. Remove from `scripts/not-migrated.json` nothing; add nothing. `src/lib/engineModel.ts` and `src/EngineSwitcher.tsx` are already off the list.

**Tests to write first:**

`src/lib/engineModel.test.ts` (node:test; replace the file; relative imports end in `.ts`). The old 11 tests are kept, adapted to the new names (the rule is the same; the old test number is in brackets). A helper `eng(over)` builds an `Engine` and `prof(over)` a `Profile` (`memory: 8 * 1024 ** 3`).
1. `Given a reachable Colima engine "default" and a machine with 4 CPU and 8 GiB, When viewOf runs, Then label is "Colima · default" and stateLine is "Running · 4 CPU · 8 GB"` [1].
2. `Given an unreachable Colima engine whose machine status is Stopped, When stateLine runs, Then it is "Stopped"` [2].
3. `Given busy "starting", When viewOf runs on a stopped machine, Then state is "starting" and stateLine is "Starting…"` [3].
4. `Given an unreachable Colima engine whose machine status is Running, When viewOf runs, Then stateLine is "Not reachable" and dotOf is "bad"` [4].
5. `Given a running engine with kubernetes true, When factsLine runs, Then it is "4 CPU · 8 GB · Kubernetes"` [5].
6. `Given the engine colima-dev with machineName "dev", When viewOf runs, Then id is "colima-dev" and name is "dev"` [6].
7. `Given engines default and dev and stored "colima-dev", When chooseDefault runs, Then dev is chosen` [7].
8. `Given a stored id that no longer exists, When chooseDefault runs, Then the first reachable engine is chosen` [8].
9. `Given no engines, When chooseDefault runs, Then it returns null` [9].
10. `Given a running default, When buttonLabel runs, Then it is "Engine: Colima, default. Running"` [10].
11. `Given op "restarting" for "dev", When busyOf runs for "dev", Then "starting"; for "default", null; op null, null; op "stopping" for "dev", "stopping"` [11].
12. `Given a reachable Docker Desktop engine, When viewOf runs, Then managed is false, stateLine and factsLine are "Running", canStart and canStop are false`.
13. `Given an unreachable Docker Desktop engine, When viewOf runs, Then stateLine is "Not running", canStart is false and hintOf is "Not running. Start it from Docker Desktop."`.
14. `Given engines other, orbstack, docker-desktop and colima in that order, When sortEngines runs, Then the order is colima, docker-desktop, orbstack, other`.
15. `Given Colima unreachable and Docker Desktop reachable and nothing stored, When chooseDefault runs, Then Docker Desktop is chosen`.
16. `Given no engine answers and nothing stored, When chooseDefault runs, Then the first of the sorted list is chosen`.
17. `Given colima, docker-desktop and orbstack views, When groupEngines runs, Then the captions are Colima, Docker Desktop, OrbStack; Given no podman engine, Then there is no Podman group`.
18. `Given a managed stopped machine "default", When stoppedCopy runs, Then title "default is stopped", text "Your containers and data are kept. Start the machine to see them.", action "start", label "Start default"`.
19. `Given an unreachable Docker Desktop engine, When stoppedCopy runs, Then title "Docker Desktop is stopped", text "Start it from Docker Desktop.", action "open-desktop", label "Open Docker Desktop"`.
20. `Given an unreachable OrbStack engine, When stoppedCopy runs, Then title "OrbStack is stopped", text "Start it from OrbStack.", action null, label null`.
21. `Given an unreachable engine of kind other labelled "work-box", When stoppedCopy runs, Then title "work-box is stopped" and text "Start it from the tool that provides it."`.

`src/EngineSwitcher.test.tsx` (vitest; the 6 tests of WO-2.3 kept with `EngineView` data and `machines` true, plus):
7. `Given Colima and Docker Desktop views and the menu open, When rendered, Then the captions "Colima" and "Docker Desktop" show and the Docker Desktop row has no Start button`.
8. `Given an unreachable OrbStack view, When open, Then its row has the title "Not running. Start it from OrbStack." and no button`.
9. `Given machines is false, When open, Then "Machines…" is not offered`.
10. `Given Docker Desktop selected and running, When open, Then no "Stop" item is offered`.

`src/lib/engines.test.tsx` (vitest, jsdom; `invoke` is mocked as in `src/test/setup.ts`; wrap with `withQuery`; call `resetEngineSelection()` and `localStorage.clear()` in `beforeEach`):
1. `Given list_engines answers Docker Desktop then Colima, When useEngines runs, Then the data is sorted Colima first`.
2. `Given nothing stored and only Docker Desktop answers, When useEngine runs, Then it is Docker Desktop`.
3. `Given localStorage openpier:engine is "desktop-linux" and it is listed, When useEngine runs, Then it is chosen even if Colima answers`.
4. `Given the stored id is not listed, When useEngine runs, Then the first reachable engine is chosen and localStorage is unchanged`.
5. `Given selectEngine("desktop-linux"), When useEngine renders, Then it returns that engine at once and localStorage holds it`.
6. `Given localStorage throws on write, When selectEngine runs, Then it does not throw and useEngine returns the choice`.
7. `Given list_engines rejects, When useEngine runs, Then it returns null and nothing throws`.

`src/lib/queryClient.test.tsx` (vitest):
1. `Given a query with refetchInterval 100 ms and the window unfocused (focusManager.setFocused(false)), When 350 ms pass, Then the query function ran once`.
2. `Given the same query and the window focused again, When 350 ms pass, Then the query function ran at least 3 times`.

**Done when:**
1. `node --experimental-strip-types --no-warnings --test src/lib/engineModel.test.ts 2>&1 | grep -E "^# (pass|fail)"` prints `# pass 21` (at least) and `# fail 0`.
2. `npx vitest run src/lib/engines.test.tsx src/lib/queryClient.test.tsx src/EngineSwitcher.test.tsx src/ui/op/Menu.test.tsx 2>&1 | grep "Tests "` shows no failure.
3. `grep -rn "ColimaEngine\|engineOfProfile\|EngineOptions" src | wc -l` prints `0`.
4. `grep -n "runtime-changed\|runtimeRegistry\|activeRuntimeId" src/App.tsx | wc -l` prints `0`.
5. `grep -c "QueryClientProvider" src/main.tsx` prints at least `1`; `grep -c "QueryClientProvider" src/App.tsx` prints `0`.
6. `node scripts/check-engines.mjs | grep -c FAIL` prints `0` in Chromium and in WebKit (`PW_ENGINE=webkit node scripts/check-engines.mjs`); `check-layout.mjs` prints no `FAIL` in both.
7. By eye: open `http://localhost:4173/?scenario=colima-and-desktop#/containers`, click the engine button, compare with `engine-switcher-light.png` and `-dark.png`: caption `Colima` with `default` ticked and `work` with a small Start button; caption `Docker Desktop` with `desktop-linux` and `Running`; caption `OrbStack` with `orbstack` and `Not running`; a separator; `Stop default` and `Machines…` with their grey hints. Mockup pair: none (the popover needs a click).
8. The gate (`../HANDOFF.md` section 5).

**Pull request title** (first line of `docs/plan/iterations/pr/wo-4.2a.md`): `wo-4.2a: The engine switcher lists every Docker and remembers the one you pick`

---

## WO-4.2b Every screen works with any engine, and the old runtime code is gone

**Needs:** WO-4.2a.

**Why:** E7, E8. After this work order a Mac with only Docker Desktop (or OrbStack) works end to end: the four resource pages list data, the switcher offers no Start or Stop for it, Settings has no Machines section, and the Doctor shows only the checks that apply. `src/runtime/*`, the adapters and the `orb_*`, `rdctl_version`, `podman_version`, `docker_desktop_version` and `colima_version` commands are deleted.

**Read first:**
1. `docs/plan/05-implementation-plan.md` task 4.2 items 3, 5, 6, 7, 8; `docs/plan/04-design-spec.md` sections 5.3 rule 6, 6.9 item 2, 7.8 item 2.3.
2. `src/lib/engineModel.ts` (WO-4.2a): `viewOf`, `stoppedCopy`, `EngineView`.
3. `src/lib/doctor.ts`: the `Check` type, the `CHECKS` list, `doctor()`, and the type `Facts`.
4. `src/App.tsx` (find `toolsMissing`, `reloadProfiles`, the `Empty` that says `is stopped`, `useDoctor(`, `useSetup(`, `bringOffered`, `hasDesktopData`), `src/Doctor.tsx` (the `useDoctor` function, its `usePoll` of `facts`), `src/settings/Engines.tsx`, `src/Setup.tsx` and `src/BringOver.tsx` (their `ctxFor` uses).
5. `src-tauri/src/main.rs`: the commands named in step 2.
6. `src/lib/mockCoverage.test.ts`.

**Starting state:**
1. `git status --short` prints nothing. `ls src/lib/engines.ts src/lib/machines/colima.ts src/lib/engineModel.ts` lists all three.
2. `ls src/runtime` lists exactly seven files: `colima-adapter.ts docker-desktop-adapter.ts index.ts orbstack-adapter.ts podman-adapter.ts rancher-adapter.ts types.ts`.
3. `grep -rn "from \"\./runtime\|from \"\.\./runtime\|from \"\./runtime/" src --include='*.ts' --include='*.tsx' | grep -v "^src/runtime/" | wc -l` prints `0` (WO-4.2a removed the last importer).
4. `grep -c "fn orb_version\|fn orb_list_vms\|fn orb_start_vm\|fn orb_stop_vm\|fn orb_delete_vm\|fn colima_version\|fn rdctl_version\|fn podman_version\|fn docker_desktop_version\|fn orb_json\|^async fn orb(" src-tauri/src/main.rs` prints `11`.
5. `grep -rn "ctxFor" src --include='*.ts' --include='*.tsx' | grep -v "test\." | wc -l` prints a number between `6` and `12`. Write it down: every hit is changed in step 4.
6. `grep -n "NOT_IN_PREVIEW" src/lib/mockCoverage.test.ts | wc -l` prints at least `3`.
7. `grep -c "export const checks\|const CHECKS" src/lib/doctor.ts` prints at least `1`.

If any differs, stop and report.

**Do not touch:** `src-tauri/src/engine.rs`, the Machines section (`src/settings/Machines.tsx`) other than what step 6 says, the Resize flow (`src/Resize.tsx`) other than the `ctxFor` renames.

**The `Doctor` checks and where they apply** (the table the code in step 7 follows). `appliesTo` is `"all"` or a list of `EngineKind`:

| Check id | Applies to | Why |
|---|---|---|
| `localhost-target`, `no-shared-network`, `fix-leftover`, `port-taken`, `arch`, `db-password`, `db-volume`, `disk` | `"all"` | They read containers, images and `docker system df`, which every engine has |
| `vm-memory`, `mount-unshared`, `mount-unreadable`, `mount-readonly`, `mount-slow`, `dns-vm`, `proxy-not-passed` | `["colima"]` | They read the Colima VM: its memory, its shared folders (`colima.yaml`), its name lookup, its proxy |

The crash and health findings (`containerProblems`) apply to all.

**Steps:**

1. Write the tests below first. They fail until step 7 and step 8.

2. Rust: delete what only the old adapters called. In `src-tauri/src/main.rs` delete these items whole, each with its `#[tauri::command]` line above it: `async fn orb_json`, `async fn orb` (the helper, `exec("orb", ...)`), `orb_version`, `colima_version`, `rdctl_version`, `podman_version`, `docker_desktop_version`, `orb_list_vms`, `orb_start_vm`, `orb_stop_vm`, `orb_delete_vm`. In the `generate_handler![` list delete the entries `orb_version`, `orb_list_vms`, `orb_start_vm`, `orb_stop_vm`, `orb_delete_vm`, `colima_version`, `rdctl_version`, `podman_version`, `docker_desktop_version`. Then run `cd src-tauri && cargo fmt && cargo clippy --all-targets -- -D warnings`. If clippy says an import or a function became unused, delete exactly that item and nothing else. `cargo test` must show the same number of passed tests as before this step (none of the deleted code had a test; check with `cargo test 2>&1 | grep "test result"` before and after).

3. Frontend: `git rm -r src/runtime`. Edit `src/lib/mockCoverage.test.ts`: delete the constant `NOT_IN_PREVIEW` with its two comment lines, delete `&& !NOT_IN_PREVIEW.includes(c)` from the first test, and delete the whole second test (`given the list of commands the preview does not fake...`). The file keeps one test. This is the deletion the file's own comment announced; it is the only test removed in this iteration, and the pull request file says so.

4. Remove `ctxFor`. In `src/api.ts` delete `export const ctxFor = ...` and its comment. For every file of Starting state 5 (the tests too): remove `ctxFor` from the import of `./api` (or `../api`) and add `import { engineIdOf } from "./lib/machines/colima";` (path relative to the file), then replace `ctxFor(` by `engineIdOf(`. Every `ctxFor` takes a Colima machine name, so this is exact. Then run `grep -rn "ctxFor" src | wc -l`: it prints `0`.

5. Machines are read only when Colima is installed. In `src/App.tsx` the effect that calls `reloadProfiles` (and the `setInterval` of it, which WO-4.3a removes) runs only when `env?.colima` is set: add `if (!env?.colima) { setProfiles([]); return; }` as the first line of `reloadProfiles` and add `env?.colima` to the dependency array of the effect. Reason: on a Mac with no Colima, `list_profiles` would fail every 3 seconds.

6. Colima-only code is gated on the engine kind. All of these use `engine` from `useEngine()` in `src/App.tsx`; `engine?.kind === "colima"` is written once as `const onColima = engine?.kind === "colima";`.
   1. Bring-over offers (`bringOffered(...)`, `hasDesktopData`, the Bring over banner and the `BringOver` mount): shown only when `onColima`.
   2. `useSetup(current)` stays: `current` is null for any other engine, which the hook already handles for a Mac with no machine. Run `grep -n "current" src/Setup.tsx | head` and confirm every use is guarded (`vm`, `profile` are read as nullable). If one is not, stop and report.
   3. The Kubernetes nav item and page: `kubeOn` already needs `current`, which is null for any other engine. Add `&& engine?.kubernetes != null` to the definition of `kubeOn` so the rule is written once.
   4. `src/settings/Machines.tsx` and the Settings nav item `Machines`: shown only when `env?.colima` is set (iteration 3 already does this; check, do not change).
   5. `src/lib/mounts.ts` and the folder checks of the Doctor: not called when `current` is null (the Doctor facts read the Colima config only `if (profile)`, found in `useDoctor`). Check with the browser check lines 11 to 13 below.

7. Doctor `appliesTo`. In `src/lib/doctor.ts`:
   1. Add `import type { EngineKind } from "./engineModel";`.
   2. Change `type Check = { id: string; area: Area; passed: string; needs?: ...; run: ... }` to add `appliesTo: EngineKind[] | "all";` as a required field. tsc then names every check that lacks it.
   3. Add `appliesTo` to every check as the table above says (`"all"` or `["colima"]`).
   4. In `type Facts` add `kind?: EngineKind; // the engine's kind; missing means colima, as before engines existed`.
   5. In `doctor()` in the loop `for (const c of CHECKS) {` add as the first line: `if (c.appliesTo !== "all" && !c.appliesTo.includes(facts.kind ?? "colima")) continue;`. A check that does not apply is skipped like a check whose `needs` failed: it is not in `findings` and not in `passed`.
   6. In `src/Doctor.tsx`, in `useDoctor(ctx, profile)`: add a third parameter `kind: EngineKind | null` and put `kind: kind ?? undefined` into the `Facts` it builds; the call in `src/App.tsx` becomes `useDoctor(ctx, current, engine?.kind ?? null)`. Add `kind` to the dependency array of the poll's key (WO-4.3c turns it into a query key; until then add it to the deps array).

8. The stopped variant (spec 6.9 item 2). Create `src/EngineStopped.tsx`. Full content:

```tsx
import { Button, Empty } from "./ui/op";
import { stoppedCopy, type EngineView } from "./lib/engineModel";

// The page shown in place of a list when the selected engine is not running.
// A machine the app manages: "{name} is stopped" and Start. Docker Desktop: "Start it from Docker Desktop." and Open Docker Desktop.
export default function EngineStopped({ view, busy, onStart, onOpenDesktop }: { view: EngineView; busy: boolean; onStart: () => void; onOpenDesktop: () => void }) {
  const copy = stoppedCopy(view);
  const action =
    copy.action === "start" ? <Button variant="primary" size="md" disabled={busy} onClick={onStart}>{copy.actionLabel}</Button>
    : copy.action === "open-desktop" ? <Button variant="primary" size="md" onClick={onOpenDesktop}>{copy.actionLabel}</Button>
    : undefined;
  return <Empty icon="box" title={copy.title} actions={action}>{copy.text}</Empty>;
}
```

   In `src/App.tsx`:
   1. Find the `Empty` whose title is `` `${current.name} is stopped` `` (the branch `) : current ? (` inside the `!ctx` branch, after `toolsMissing`). Replace that whole `) : current ? ( <Empty ...>...</Empty> )` branch by `) : selectedView ? ( <EngineStopped view={selectedView} busy={vm.op !== null} onStart={startFromAnywhere} onOpenDesktop={() => void invoke("open_docker_desktop").catch((e) => setAppError(String(e)))} /> )`. `selectedView` is defined in WO-4.2a step 8.6. The words "No VM yet" branch stays after it.
   2. The Containers page has its own stopped state (WO-3.1c, `Engine stopped`). For a managed machine it is unchanged. For any other engine App does not render Containers' list: find where `<Containers` is mounted and render `<EngineStopped ...>` instead when `!ctx && selectedView && !selectedView.managed`, with the Containers header (title only, no search, no New).
   3. Add `import EngineStopped from "./EngineStopped";`.

9. Settings, Engines section (spec 7.8 item 2.3). Replace the whole content of `src/settings/Engines.tsx` (it listed the contexts of `setup_report`):

```tsx
import { Banner, Chip, Col, Dot, Empty, List, Row, SkeletonRows } from "../ui/op";
import { KIND_CAPTION } from "../lib/engineModel";
import { useEngines } from "../lib/engines";

// Every Docker context the Mac has: which tool provides it, where it listens, and whether it answers. Read only.
export default function Engines() {
  const { data, error } = useEngines();
  if (!data) return error ? <Banner tone="bad" title="Could not list the engines">{String(error)}</Banner> : <SkeletonRows />;
  return (
    <div className="stack">
      {data.length === 0 ? (
        <Empty icon="box" title="No engines found">Docker did not list any context.</Empty>
      ) : (
        <List aria-label="Engines">
          {data.map((e) => (
            <Row
              key={e.id}
              lead={<Dot state={e.reachable ? "ok" : "off"} />}
              name={e.id}
              meta={`${KIND_CAPTION[e.kind]} · ${e.endpoint}`}
              metaSelectable
            >
              <Col kind="state">{e.reachable ? "Running" : "Not running"}</Col>
              {e.current ? <Chip>Current</Chip> : null}
            </Row>
          ))}
        </List>
      )}
      <div className="muted">To add an engine, run <code className="mono">docker context create</code>.</div>
    </div>
  );
}
```

   The `Banner` is used only on a failed list. If `Banner`, `Col`, `List` or `Row` do not accept these props (tsc says), stop and report: the props are those of `docs/plan/iterations/iteration-1-work-orders.md` WO-1.3b.

10. Mock additions in `preview/mock.ts`:
    1. Scenario `desktop-stopped`: only Docker Desktop, not running, until the app opens it. Next to `enginesNow` add `let desktopUp = scenario !== "desktop-stopped";`, make `desktopEngine(...)` calls in `enginesNow` use `desktopUp` for the `desktop-only` and `desktop-stopped` cases, and add `scenario === "desktop-stopped" ? [desktopEngine(desktopUp)]` as a branch. For `desktop-stopped` also set `db.profiles = []; env.colima = null;` (extend the existing `desktop-only` line).
    2. In `case "open_docker_desktop":` change `setTimeout(() => { desktop.running = true; }, 2500)` to `setTimeout(() => { desktop.running = true; desktopUp = true; }, 2500)`.
    3. At the top of `invoke` in the mock (find `export async function invoke` or the function holding `switch (cmd)`), add as its first statement `((window as unknown as { __calls?: string[] }).__calls ??= []).push(cmd);` so a check can read which backend commands the page called.

11. Browser checks. Append to `scripts/check-engines.mjs` (messages in words; `__calls` is `await p.evaluate(() => window.__calls)`):
    1. `desktop-only: Containers lists containers` (`#/containers`, at least one `.row` in the list).
    2. `desktop-only: Images, Volumes and Networks each list at least one row` (three routes).
    3. `desktop-only: the engine button says Docker Desktop and its popover has no Start button and no Stop item`.
    4. `desktop-only: Settings has General, Engines, Updates and About and no Machines item` (`#/settings/general`, texts of the nav).
    5. `desktop-only: the Settings Engines section lists desktop-linux with Docker Desktop, its address and Running` (`#/settings/engines`).
    6. `desktop-only: the Doctor Passed list has no line about the VM, shared folders or name lookup` (open `#/doctor`; none of the nine `passed` texts of the Colima-only checks is on the page: `The VM has enough memory`, `Every Mac folder a container uses is shared`, `No running container needs a Mac folder`, `No container reports writing to a folder the VM shares`, `Folders are shared the fast way`, `The VM can look up names`, `No image pull has failed on the network while the Mac uses a proxy`).
    7. `desktop-only: the page never asked for the Colima commands` (`__calls` has none of `colima_config`, `vm_dns_probe`, `vm_log_tail`, `apply_resources`, `start_profile`, `stop_profile`, `desktop_state`, `list_profiles`).
    8. `desktop-only: there is no Kubernetes item in the sidebar`.
    9. `desktop-only: there is no install card` (the page does not show `No container runtime yet`).
    10. `orbstack-only: the button says OrbStack, Containers lists containers, and the Settings Engines section says OrbStack`.
    11. `desktop-stopped: Images says Docker Desktop is stopped, Start it from Docker Desktop. and has an Open Docker Desktop button` (route `#/images`; the words are exact).
    12. `desktop-stopped: Open Docker Desktop makes Images list its rows within 8 seconds` (the mock brings the engine up after 2.5 s and the engine list refreshes every 5 s).
    13. `colima-and-desktop: picking Docker Desktop shows its lists, and picking OrbStack (not running) says OrbStack is stopped, Start it from OrbStack. with no button`.
    14. `colima-and-desktop: with the stopped Colima machine work picked, Images says work is stopped and has a Start work button` (the old behaviour, kept).

**Tests to write first:**

`src/lib/doctor.test.ts` (node; add to the existing file):
1. `Given a Docker Desktop engine kind and facts that make mount-unshared fire on Colima, When doctor runs, Then no finding has id mount-unshared and passed has no folder line`.
2. `Given kind "orbstack", When doctor runs, Then vm-memory, dns-vm and proxy-not-passed are in neither findings nor passed`.
3. `Given kind "orbstack" and a container that looks for localhost, When doctor runs, Then the localhost-target finding is still there`.
4. `Given no kind (an old caller), When doctor runs, Then the Colima checks run as before`.
5. `Given every check of CHECKS, When read, Then each has appliesTo "all" or a non-empty list of known kinds, and exactly the seven ids of the table have ["colima"]`.

`src/EngineStopped.test.tsx` (vitest):
1. `Given a stopped managed machine "default", When rendered, Then "default is stopped", the line "Your containers and data are kept. Start the machine to see them." and the button "Start default" show; the button calls onStart`.
2. `Given busy is true, When rendered, Then the Start button is disabled`.
3. `Given a stopped Docker Desktop view, When rendered, Then "Docker Desktop is stopped", "Start it from Docker Desktop." and "Open Docker Desktop" show; pressing it calls onOpenDesktop`.
4. `Given a stopped OrbStack view, When rendered, Then "OrbStack is stopped" and "Start it from OrbStack." show and there is no button`.

`src/settings/Engines.test.tsx` (vitest, `withQuery`):
1. `Given list_engines answers Docker Desktop (running) and OrbStack (not running), When rendered, Then two rows show with "Running" and "Not running" and each row's meta holds its kind and address`.
2. `Given the engine whose current is true, When rendered, Then its row has a "Current" chip`.
3. `Given list_engines answers an empty list, When rendered, Then "No engines found" shows`.
4. `Given list_engines rejects, When rendered, Then a banner "Could not list the engines" shows`.
5. `Given any list, When rendered, Then the hint "To add an engine, run docker context create." shows`.

**Done when:**
1. `ls src/runtime 2>&1` says no such directory; `grep -rn "runtimeRegistry\|RuntimeAdapter" src | wc -l` prints `0`.
2. `grep -c "orb_\|rdctl\|podman_version\|docker_desktop_version\|colima_version" src-tauri/src/main.rs` prints `0` (the file `desktop.rs` keeps its own `open_docker_desktop`, which is not in that list).
3. `grep -rn "ctxFor" src | wc -l` prints `0`.
4. `node --experimental-strip-types --no-warnings --test src/lib/doctor.test.ts src/lib/mockCoverage.test.ts 2>&1 | grep -E "^# (pass|fail)"` shows `# fail 0`; `npx vitest run src/EngineStopped.test.tsx src/settings/Engines.test.tsx 2>&1 | grep "Tests "` shows no failure.
5. `grep -c "appliesTo" src/lib/doctor.ts` prints at least `17` (one in the type, one in `doctor()`, fifteen checks).
6. `for e in chromium webkit; do PW_ENGINE=$e node scripts/check-engines.mjs | grep -c FAIL; done` prints `0` twice (24 lines now).
7. By eye, `http://localhost:4173/?scenario=desktop-only#/images`: the sidebar button reads `Docker Desktop` with `Running`; Settings has no Machines item. `?scenario=desktop-stopped#/images`: the centred empty state with a box icon, title `Docker Desktop is stopped`, line `Start it from Docker Desktop.`, one blue button `Open Docker Desktop` (compare the layout with `machine-stopped-light.png`; the words differ as the spec says).
8. The gate (`../HANDOFF.md` section 5). `cargo test` shows the same number of passed tests as before step 2 of this work order.

**Pull request title** (first line of `docs/plan/iterations/pr/wo-4.2b.md`): `wo-4.2b: Docker Desktop and OrbStack work end to end, and the old runtime code is gone`

---

## WO-4.3a One data layer, part 1: the Mac, the machines and the containers screens

**Needs:** WO-4.2b.

**Why:** E9 (two ways to load data: `usePoll` with its own timers, and a `setInterval` in `App.tsx`; a `runtime-changed` event). This work order builds the data layer once (a query client, key helpers, the refresh event) and converts the first ten loads: what `App.tsx` reads, and the Containers, container detail, logs, stats, Compose logs and live stats screens. WO-4.3b and WO-4.3c convert the rest and delete `usePoll`.

This work order is split in three (4.3a, 4.3b, 4.3c) so each is one pull request. All three use the one table below. Each work order converts the rows marked with its id and no others.

**Read first:**
1. `docs/plan/05-implementation-plan.md` task 4.3; `src/hooks.ts` (`usePoll`, in full: its `reload`, the `openpier:refresh` listener, what `error`, `data`, `dataFrom` are); `src/lib/pollPace.ts`.
2. TanStack Query v5: `useQuery` https://tanstack.com/query/v5/docs/framework/react/reference/useQuery (`queryKey`, `queryFn`, `refetchInterval`, `enabled`, `refetch`), `QueryClient.invalidateQueries` https://tanstack.com/query/v5/docs/reference/QueryClient#queryclientinvalidatequeries (checked: it matches every query whose key starts with the given key).
3. The files of the rows below (find each by the quoted load text).
4. `src/lib/queryClient.ts`, `src/lib/engines.ts`, `src/lib/machines/colima.ts`, `src/test/withQuery.tsx` (WO-4.2a).

**The table: every `usePoll` call, one row per call site** (the file name is the one on commit `0bdafcf`; a screen rebuilt in iterations 2 and 3 may have moved to `src/containers/`, `src/settings/` or another name, and keeps the load text. Find each row by the quoted text). `ctx` is the selected engine's id (`engine.id`, which is `null` while the engine is not running). A key written `[ctx, "x"]` is `[ctx, "x"]` in code; `"mac"` keys do not depend on the engine.

| # | Loads (quoted text to find) | File on `0bdafcf` | Query key | Interval kept | Enabled | WO |
|---|---|---|---|---|---|---|
| 1 | `"kubectl", { context: null, args: ["config", "get-contexts", "-o", "name"] }` | `src/App.tsx` | `["mac", "kube-contexts", !!env?.kubectl]` | 10 000 ms | `!!env` | 4.3a |
| 2 | `list_profiles` through `reloadProfiles` and its `setInterval(reloadProfiles, 3000)` | `src/App.tsx` | `["mac", "machines"]` (hook `useMachines`) | 3 000 ms | `!!env?.colima` | 4.3a |
| 3 | `dockerJson<C>(ctx, ["ps", "-a"])` | `src/Containers.tsx` | `[ctx, "containers"]` | 3 000 ms | `!!ctx` | 4.3a |
| 4 | `JSON.parse(await docker(ctx, ["inspect", id]))[0]` | `src/ContainerDetail.tsx` | `[ctx, "inspect", id]` | 3 000 ms | always | 4.3a |
| 5 | `docker(ctx, ["logs", "--tail", "80", name], true)` | `src/ContainerDetail.tsx` | `[ctx, "logs-tail", name]` | 10 000 ms | `crashing` | 4.3a |
| 6 | `"events", ...eventWindow(Date.now(), 86_400_000)` | `src/ContainerDetail.tsx` | `[ctx, "activity", name]` | 10 000 ms | `!!c && tab === "Activity"` | 4.3a |
| 7 | `["logs", "--timestamps", "--since", since, id]` | `src/Logs.tsx` | `[ctx, "logs", id]` | 2 000 ms | always | 4.3a |
| 8 | `["stats", "--no-stream", id]` | `src/StatsTab.tsx` | `[ctx, "stats", id, running]` | 2 500 ms | always | 4.3a |
| 9 | `invoke<string>("compose_logs", { context: ctx, file, since` | `src/ComposeLogs.tsx` | `[ctx, "compose-logs", file]` | 2 000 ms | always | 4.3a |
| 10 | `dockerJson<StatsRow>(ctx, ["stats", "--no-stream"])` and `dockerJson<DfRow>(ctx, ["system", "df"])` in `useLiveStats` (WO-2.2) | `src/hooks/useLiveStats.ts` | `[ctx, "live-stats"]` | `STATS_EVERY_MS` | `running && !!ctx` | 4.3a |
| 11 | `parseDiskUsage(await docker(ctx, ["system", "df", "--format", "{{json .}}"]))` | `src/DiskCard.tsx` (rebuilt into `src/Images.tsx` by WO-3.4) | `[ctx, "disk-usage"]` | 30 000 ms | always | 4.3b |
| 12 | `dockerJson<I>(ctx, ["images"])` in Images | `src/Images.tsx` | `[ctx, "images"]` | 5 000 ms | always | 4.3b |
| 13 | `dockerJson<I>(ctx, ["images"])` in the Run picker | `src/RunPicker.tsx` | `[ctx, "images"]` (same entry as row 12) | 8 000 ms | always | 4.3b |
| 14 | `dockerJson<V>(ctx, ["volume", "ls"])` | `src/Volumes.tsx` | `[ctx, "volumes"]` | 5 000 ms | always | 4.3b |
| 15 | `volumeUsage(JSON.parse(await docker(ctx, ["inspect", ...ids])))` | `src/Volumes.tsx` | `[ctx, "volume-usage"]` | 5 000 ms | always | 4.3b |
| 16 | `parseVolumeSizes(await docker(ctx, ["system", "df", "-v", "--format", "json"])` | `src/Volumes.tsx` | `[ctx, "volume-sizes"]` | 30 000 ms | always | 4.3b |
| 17 | `parseNetworks(await docker(ctx, ["network", "inspect", ...names]))` | `src/Networks.tsx` | `[ctx, "networks"]` | 4 000 ms | always | 4.3b |
| 18 | `dockerJson<{ Names: string; State: string }>(ctx, ["ps", "-a"])` in Networks | `src/Networks.tsx` | `[ctx, "containers"]` (same entry as row 3) | 5 000 ms | always | 4.3b |
| 19 | `parseNodes(await get("nodes", []))` | `src/Kubernetes.tsx` | `[ctx, "k8s-nodes", kctx]` | 8 000 ms | `!!kctx` | 4.3b |
| 20 | `parseNamespaces(await get("namespaces", []))` | `src/Kubernetes.tsx` | `[ctx, "k8s-namespaces", kctx]` | 15 000 ms | `!!kctx` | 4.3b |
| 21 | `parsePods(await get("pods"), Date.now())` | `src/Kubernetes.tsx` | `[ctx, "k8s-pods", kctx]` | 5 000 ms | `!!kctx` | 4.3b |
| 22 | `parseDeployments(await get("deployments"))` | `src/Kubernetes.tsx` | `[ctx, "k8s-deployments", kctx]` | 8 000 ms | `!!kctx` | 4.3b |
| 23 | `parseServices(await get("services"))` | `src/Kubernetes.tsx` | `[ctx, "k8s-services", kctx]` | 15 000 ms | `!!kctx` | 4.3b |
| 24 | `parseK8sEvents(await get("events"))` | `src/Kubernetes.tsx` | `[ctx, "k8s-events", kctx]` | 8 000 ms | `!!kctx` | 4.3b |
| 25 | `invoke<string>("kubectl", { context: kctx, args: logArgs })` | `src/PodDrawer.tsx` (rebuilt by WO-3.7, may be `src/PodSheet.tsx`) | `[ctx, "pod-logs", kctx, pod.namespace, pod.name, previous]` | 3 000 ms | always | 4.3b |
| 26 | `const ids = (await docker(ctx, ["ps", "-a", "-q"])).split("\n")` followed by `rofsLogs` (Doctor facts) | `src/Doctor.tsx` | `[ctx, "doctor-facts", kind]` | 30 000 ms | always | 4.3c |
| 27 | `invoke<string>("vm_dns_probe", { name: profile.name })` | `src/Doctor.tsx` | `[ctx, "dns", profile?.name]` | 60 000 ms | `!!ctx` | 4.3c |
| 28 | `invoke<SetupReport>("setup_report")` | `src/Setup.tsx` | `["mac", "setup-report"]` | 60 000 ms | always | 4.3c |

Row 3 and row 18 share one cache entry (the same read); rows 12 and 13 too. Where two screens read the same entry with different intervals, TanStack runs the faster one.

**The conversion rule** (every row follows it; nothing else about a load changes). The load function is moved unchanged:

1. `const x = usePoll(load, [deps], ms, enabled)` becomes `const x = useQuery({ queryKey: <the key>, queryFn: load, refetchInterval: ms, enabled })`. Keep the local name `x`.
2. `x.data` was `T | null` (null until the first answer, and after the inputs changed). It is now `T | undefined`. A test `x.data === null` becomes `x.data === undefined`; `!x.data`, `x.data ?? y` and `x.data?.z` stay.
3. `x.error` was a string or null. It is now `unknown`. Where the screen shows it, use `errorText(x.error)` (from `src/lib/queries.ts`, below).
4. `x.reload()` becomes `x.refetch()`. It returns a promise; `void x.refetch()` where the result was ignored.
5. `x.dataFrom` (only the Doctor reads it) is replaced as WO-4.3c says.
6. A load that returned a default when its input was missing (`kctx ? ... : []`) keeps doing that; the `enabled` column is for the loads that were switched off by the fourth `usePoll` argument.
7. The last good data stays on screen when a later read fails (spec 6.9 item 4). TanStack keeps `data` when a refetch fails; the screen reads `x.error` for the banner, as today.
8. A poll stops while the window is hidden or not focused and runs again at once on focus (`src/lib/queryClient.ts`). The old code also ran one read every 30 seconds in an unfocused, visible window; that is dropped. Say so in the pull request file.

**Starting state:**
1. `git status --short` prints nothing. `ls src/lib/queryClient.ts src/lib/machines/colima.ts src/test/withQuery.tsx src/lib/engines.ts` lists all four.
2. `grep -rn "usePoll(" src --include='*.ts' --include='*.tsx' | grep -v "src/hooks.ts" | wc -l` prints a number between `24` and `30`. Each hit must match one row of the table by its quoted text. A hit that matches no row: stop and report it. A row with no hit: it was removed by an earlier work order; note it in the pull request file and skip it.
3. `grep -c "setInterval" src/App.tsx` prints `1`.
4. `grep -c "openpier:refresh" src/hooks.ts` prints `1` (the Cmd+R refresh of WO-2.4).
5. `ls src/lib/queries.ts 2>&1` says it does not exist.

**Do not touch:** `src/hooks.ts` (deleted in WO-4.3c), the rows not marked 4.3a, the load functions themselves.

**Steps:**

1. Write the tests below first and see them fail (missing `src/lib/queries.ts`).

2. Create `src/lib/queries.ts`. Full content:

```ts
import { useQueryClient } from "@tanstack/react-query";

// Query keys. A read that belongs to one engine starts with the engine id, so switching engines never shows another engine's rows.
// A read that belongs to the Mac starts with "mac".
export const engineKey = (engineId: string | null, name: string, ...parts: unknown[]) => [engineId, name, ...parts] as const;
export const macKey = (name: string, ...parts: unknown[]) => ["mac", name, ...parts] as const;

// The names of the lists an action can change. One place, so a typo cannot leave a list stale.
export const LIST = {
  containers: "containers",
  images: "images",
  volumes: "volumes",
  volumeUsage: "volume-usage",
  volumeSizes: "volume-sizes",
  networks: "networks",
  diskUsage: "disk-usage",
  inspect: "inspect",
  doctorFacts: "doctor-facts",
  liveStats: "live-stats",
} as const;

// docker and the backend reject with a string; a thrown Error has a message. Null when there is no error.
export function errorText(e: unknown): string | null {
  if (e === null || e === undefined) return null;
  return e instanceof Error ? e.message : String(e);
}

// After an action: ask again for the lists it changed. `refresh("containers", "volumes")`.
export function useRefresh(engineId: string | null) {
  const client = useQueryClient();
  return (...names: string[]) => Promise.all(names.map((n) => client.invalidateQueries({ queryKey: [engineId, n] })));
}
```

3. Edit `src/lib/queryClient.ts` (WO-4.2a): at the end add the Cmd+R refresh that `usePoll` listened to:

```ts
// Cmd+R (WO-2.4) sends this event; every list that is on screen reads again.
window.addEventListener("openpier:refresh", () => {
  void queryClient.invalidateQueries();
});
```

4. Edit `src/lib/machines/colima.ts`: add `import { useQuery } from "@tanstack/react-query";` and at the end:

```ts
export const MACHINES_EVERY_MS = 3000;
// The Colima machines on this Mac. Off when Colima is not installed.
export function useMachines(enabled: boolean) {
  return useQuery({ queryKey: ["mac", "machines"], queryFn: listMachines, refetchInterval: MACHINES_EVERY_MS, enabled });
}
```

5. Edit `src/App.tsx` (rows 1 and 2):
   1. Add `import { useQuery, useQueryClient } from "@tanstack/react-query";`, `import { errorText } from "./lib/queries";` and `useMachines` to the import from `./lib/machines/colima`. Remove `import { usePoll } from "./hooks";`.
   2. Row 1: the `const kube = usePoll<string[]>(...)` becomes `const kube = useQuery({ queryKey: ["mac", "kube-contexts", !!env?.kubectl], queryFn: async () => (env?.kubectl ? contextNames(await invoke<string>("kubectl", { context: null, args: ["config", "get-contexts", "-o", "name"] })) : []), refetchInterval: 10_000, enabled: !!env });` Then fix its uses by the conversion rule: `kube.data` is `string[] | undefined`; where the code tests `kube.data !== null` it becomes `kube.data !== undefined`; each call `kubernetesOn(..., kube.data)` passes `kube.data ?? null` (the function takes `string[] | null`). `kube.reload()` becomes `void kube.refetch()`.
   3. Row 2: delete `const [profiles, setProfiles] = useState<Profile[]>([])`, `const [profilesError, setProfilesError] = ...`, the whole `reloadProfiles` callback and the effect with `setInterval(reloadProfiles, 3000)`. Add instead:

```ts
  const client = useQueryClient();
  const machinesQuery = useMachines(!!env?.colima);
  const profiles = machinesQuery.data ?? NO_MACHINES;
  const profilesError = errorText(machinesQuery.error);
  // After a start, stop, resize or delete: read the machines again at once.
  const reloadProfiles = useCallback(() => client.invalidateQueries({ queryKey: ["mac", "machines"] }), [client]);
```

      and above `export default function App()` add `const NO_MACHINES: Profile[] = []; // one array, so effects that depend on the list do not run on every render`. Remove `setProfiles` uses: `grep -n "setProfiles" src/App.tsx` must print nothing.
   4. `grep -n "setInterval\|runtime-changed" src/App.tsx | wc -l` prints `0`.

6. Convert rows 3 to 10 by the conversion rule, one file at a time, running `npx tsc --noEmit` after each. For each file: remove `import { usePoll } from "./hooks";`, add `import { useQuery } from "@tanstack/react-query";` and `import { errorText } from "./lib/queries";` (where an error is shown). The caveats:
   1. Row 3, `Containers.tsx`: the call is `usePoll<C[]>(async () => (ctx ? dockerJson<C>(ctx, ["ps", "-a"]) : []), [ctx], 3000)`. It becomes `useQuery<C[]>({ queryKey: [ctx, "containers"], queryFn: async () => (ctx ? dockerJson<C>(ctx, ["ps", "-a"]) : []), refetchInterval: 3000, enabled: !!ctx })`. With `enabled` false the data is `undefined` where it was `[]`: wherever the screen uses `containers.data`, use `containers.data ?? NO_CONTAINERS` with `const NO_CONTAINERS: C[] = [];` at file level if it needs an array. The many `containers.reload()` calls become `containers.refetch()` (the line that does `void containers.reload().finally(...)` becomes `void containers.refetch().finally(...)`, which works on a promise).
   2. Rows 4 to 6, `ContainerDetail.tsx`: row 5's third argument was the enabled flag `crashing`, row 6's `!!c && tab === "Activity"`. The `reload` used after an action (`reload();` in a handler) becomes `void refetch();` when destructured as `const { data: c, error, refetch } = useQuery(...)`.
   3. Row 7, `Logs.tsx`: the load reads `have.current` (the merged lines) to ask only for lines since the last one. TanStack calls the latest `queryFn` on each read, so this keeps working; the effect `if (data === null) return;` becomes `if (data === undefined) return;`. The key has no `since` in it: the lines already held are not part of the key.
   4. Row 8, `StatsTab.tsx`: key `[ctx, "stats", id, running]`; the load returns `null` when `!running`; keep.
   5. Row 9, `ComposeLogs.tsx`: the load reads `have.current`, as in Logs; same rule.
   6. Row 10, `useLiveStats.ts` (WO-2.2): `useQuery({ queryKey: [ctx, "live-stats"], queryFn: <the existing load, which returns the two row sets>, refetchInterval: STATS_EVERY_MS, enabled: running && !!ctx })`. The hook still returns `{ live, history, usage }` and still keeps the last values on an error and clears them when `running` is false: only the source of `data` changed.
   7. Every vitest file that renders a converted component now needs a client: wrap the rendered element in `withQuery(...)` from `src/test/withQuery.tsx`. Run `npx vitest run 2>&1 | grep -c "No QueryClient set"`: it must print `0` when done. Do not change an assertion; only the wrapper.

7. Run `npm run check`. The browser checks that watch polling (the ones for Containers, container detail, logs and stats) must pass unchanged, in both engines.

**Tests to write first:**

`src/lib/queries.test.ts` (node:test):
1. `Given an engine id and a name, When engineKey runs, Then it is [id, name, ...parts]`.
2. `Given a name, When macKey runs, Then it starts with "mac"`.
3. `Given an Error, a string and null, When errorText runs, Then it returns the message, the string and null`.
4. `Given the LIST names, When read, Then each value is unique and kebab-case`.

`src/lib/queries.test.tsx` (vitest, jsdom, `withQuery`, a loader that counts calls and a real `focusManager`):
1. `Given a query on [ctx, "containers"] with an interval of 100 ms, When 350 ms pass in a focused window, Then the loader ran at least 3 times`.
2. `Given the window is not focused (focusManager.setFocused(false)), When 350 ms pass, Then the loader ran once; When it is focused again, Then it runs again at once`.
3. `Given the key changes from engine A to engine B and A's loader is still running, When A answers late, Then the data shown is B's and never A's`.
4. `Given enabled is false, When mounted, Then the loader is never called`.
5. `Given a loader that answers once and then rejects, When the second read fails, Then data is still the first answer and errorText(error) is the message`.
6. `Given two components with the same key, When both mount, Then the loader runs once`.
7. `Given a mounted query, When the event openpier:refresh is dispatched on window, Then the loader runs again`.
8. `Given useRefresh("colima") and a mounted query on ["colima", "containers"], When refresh("containers") runs, Then the loader runs again; and a query on ["colima-work", "containers"] does not`.

`src/lib/machines/colima.test.tsx` (vitest):
1. `Given enabled is false, When useMachines mounts, Then list_profiles is not invoked`.
2. `Given enabled is true, When useMachines mounts, Then list_profiles is invoked and its rows are the data`.
3. `Given engineIdOf, When called with "default", "work", Then "colima" and "colima-work"`.

**Done when:**
1. `grep -rn "usePoll" src --include='*.ts' --include='*.tsx' | grep -E "src/App.tsx|src/Containers.tsx|src/ContainerDetail.tsx|src/Logs.tsx|src/StatsTab.tsx|src/ComposeLogs.tsx|useLiveStats" | wc -l` prints `0`.
2. `grep -c "setInterval" src/App.tsx` prints `0`; `grep -rn "runtime-changed" src | wc -l` prints `0`.
3. `node --experimental-strip-types --no-warnings --test src/lib/queries.test.ts 2>&1 | grep -E "^# (pass|fail)"` shows `# fail 0`; `npx vitest run src/lib/queries.test.tsx src/lib/machines/colima.test.tsx 2>&1 | grep "Tests "` shows no failure; `npx vitest run 2>&1 | grep -c "No QueryClient set"` prints `0`.
4. `npm run check` passes in Chromium and WebKit.
5. The gate (`../HANDOFF.md` section 5).

**Pull request title** (first line of `docs/plan/iterations/pr/wo-4.3a.md`): `wo-4.3a: The Mac, the machines and the container screens read through one data layer`

---

## WO-4.3b One data layer, part 2: images, volumes, networks and Kubernetes

**Needs:** WO-4.3a.

**Why:** E9. Converts rows 11 to 25 of the table in WO-4.3a, and makes every action on these screens refresh its list by invalidating the query, not by calling `reload()`.

**Read first:** the conversion rule and the table of WO-4.3a (read them again, they are the recipe); `src/Images.tsx`, `src/RunPicker.tsx`, `src/Volumes.tsx`, `src/Networks.tsx`, `src/Kubernetes.tsx`, `src/PodDrawer.tsx` (or the file that holds row 25), and the file that holds row 11.

**Starting state:**
1. `git status --short` prints nothing; `ls src/lib/queries.ts` lists it.
2. `grep -rn "usePoll(" src --include='*.ts' --include='*.tsx' | grep -v "src/hooks.ts" | wc -l` prints a number between `13` and `16`, and every hit is a row of the table marked 4.3b or 4.3c.
3. `grep -rn "\.reload()\|reload()" src/Images.tsx src/Volumes.tsx src/Networks.tsx src/Kubernetes.tsx 2>/dev/null | wc -l` prints at least `3`. Write the number down: step 3 converts each.

**Do not touch:** rows of 4.3c, the load functions.

**Steps:**

1. Tests first (below).
2. Convert rows 11 to 25 by the conversion rule of WO-4.3a. Caveats:
   1. Rows 12 and 13 share the key `[ctx, "images"]`. Both read `dockerJson<I>(ctx, ["images"])`. If the two `I` types differ, give each file `useQuery<I>` with its own type; the cached value is the raw rows.
   2. Rows 19 to 24 (Kubernetes): `kctx` comes from the props (`profile`, `wanted`) as today. The `get` helper that builds the kubectl call stays. `enabled: !!kctx` replaces the `kctx ? ... : []` guard for the data, but the `: []` stays in the load so a caller that reads `.data` before enabling sees `[]`.
   3. Row 25: the key holds `previous` (the previous-log toggle): switching it reads again at once, as `deps` did.
   4. Row 17 (`Networks.tsx`): the `nets` load asks twice (`network ls`, then `network inspect`); both stay inside one `queryFn`.
3. Actions refresh their list. For each `reload();`, `nets.reload();`, `usage.reload();` found in Starting state 3, the action becomes a mutation. The pattern, written once (here for the volume remove of `Volumes.tsx`; the others differ only in the call and the lists named):

```ts
const refresh = useRefresh(ctx);
const remove = useMutation({
  mutationFn: (name: string) => docker(ctx, ["volume", "rm", name]),
  onSettled: () => refresh(LIST.volumes, LIST.volumeUsage, LIST.volumeSizes, LIST.diskUsage),
});
// call site: remove.mutate(name)  (the old code was: await docker(ctx, ["volume", "rm", name]); reload();)
```

   `mutationFn` is the old call unchanged; `onSettled` runs on success and on failure, so a failed action still refreshes the list (as `reload()` after a `finally` did). The error the old `try/catch` showed (a toast, a problem line, `Try again`) is shown from `remove.error` or from the `catch` around `await remove.mutateAsync(name)`, whichever is the smaller edit; the words do not change. The lists each action refreshes (a table so the choice is made once):

| Action | Refreshes (`LIST.` names) |
|---|---|
| remove a volume, prune volumes | `volumes`, `volumeUsage`, `volumeSizes`, `diskUsage` |
| remove an image, prune images, clear build cache, pull an image | `images`, `diskUsage` |
| create, remove or connect a network | `networks`, `containers` |
| any action on a container (start, stop, restart, remove, rename) | `containers`, `inspect`, `diskUsage` |
| a Kubernetes action (delete a pod, scale, restart) | the `k8s-*` entry that holds the thing, by name: `client.invalidateQueries({ queryKey: [ctx, "k8s-pods"] })` |

   Container actions are in WO-4.3c; this work order converts the volume, image, network and Kubernetes ones.
4. Run `npm run check`.

**Tests to write first:**

`src/lib/queries.test.tsx` (add to the WO-4.3a file):
1. `Given a volume remove mutation that fails, When it settles, Then the volumes list was asked again and the error is available`.
2. `Given a mutation that succeeds, When it settles, Then the lists in its table row were asked again and the ones of another engine were not`.

Per screen, add one vitest test next to the screen's existing test file (create `src/Volumes.test.tsx` etc. only where the file does not exist; wrap with `withQuery`):
3. `Given the volumes list has a volume, When Remove is confirmed, Then docker volume rm is called with its name and the list is read again` (assert the `invoke` mock saw `volume rm`, then a second `volume ls`).
4. `Given the images list, When Remove is confirmed on an image, Then docker rmi is called and images is read again`.
5. `Given the networks list, When a network is created, Then network create is called and networks is read again`.
6. `Given Kubernetes pods, When a pod's Delete is confirmed, Then kubectl delete is called and the pods are read again`.

**Done when:**
1. `grep -rn "usePoll" src --include='*.ts' --include='*.tsx' | grep -E "Images|RunPicker|Volumes|Networks|Kubernetes|PodDrawer|PodSheet|DiskCard" | wc -l` prints `0`.
2. `grep -rn "\.reload()" src/Images.tsx src/Volumes.tsx src/Networks.tsx src/Kubernetes.tsx 2>/dev/null | wc -l` prints `0`.
3. `npx vitest run 2>&1 | grep "Tests "` shows no failure; `npm run check` passes in both engines.
4. The gate.

**Pull request title** (first line of `docs/plan/iterations/pr/wo-4.3b.md`): `wo-4.3b: Images, volumes, networks and Kubernetes read through the data layer and refresh after actions`

---

## WO-4.3c One data layer, part 3: the Doctor, Setup, container actions, and the end of usePoll

**Needs:** WO-4.3b.

**Why:** E9. Converts rows 26 to 28, turns the container actions into mutations, and deletes `usePoll` and everything only it used.

**Read first:** `src/Doctor.tsx` (`useDoctor`, the whole function, and the part that uses `facts.dataFrom` with `holdAfterResize`), `src/lib/vmSize.ts` (`holdAfterResize`), `src/Setup.tsx` (`useSetup`), `src/Containers.tsx` (every `containers.refetch()` and action handler), `src/ContainerDetail.tsx`.

**Starting state:**
1. `git status --short` prints nothing.
2. `grep -rn "usePoll" src --include='*.ts' --include='*.tsx' | grep -v "src/hooks.ts" | wc -l` prints `3` (rows 26, 27, 28) plus at most the `import` lines of those files; no other file matches.
3. `grep -rn "dataFrom" src --include='*.ts' --include='*.tsx' | grep -v "src/hooks.ts" | wc -l` prints at least `3` (`Doctor.tsx` and `vmSize.ts`).
4. `grep -rn "\.refetch()" src --include='*.tsx' | grep -E "containers\.refetch|refetch\(\)" | wc -l` prints at least `4`.

**Do not touch:** `src/lib/vmSize.ts` function bodies (only how `dataFrom` is produced changes).

**Steps:**

1. Tests first (below).
2. **Row 26, Doctor facts.** `holdAfterResize(resizing, endedAt, dataFrom)` needs the time the read that gave the data STARTED (a read that started before the resize ended is stale even if it finished after). TanStack's `dataUpdatedAt` is the time it finished, so do not use it. Make the load return its own start time:

```ts
const facts = useQuery({
  queryKey: [ctx, LIST.doctorFacts, kind],
  queryFn: async () => {
    const from = Date.now(); // when this read started (the Mac's clock, compared only with itself)
    const value = await <the existing load, unchanged, which returns { containers, images, disk, colima, net, rofsLogs }>;
    return { from, value };
  },
  refetchInterval: 30_000,
  enabled: !!ctx,
});
```

   Then `facts.data?.value` is what `facts.data` was and `facts.data?.from` is what `facts.dataFrom` was (use `facts.data?.from ?? 0`). `facts.reload` becomes `facts.refetch`; `facts.error` becomes `errorText(facts.error)`. The load keeps its `if (!ctx) return null;` first line, now returning `{ from, value: null }` is not needed: with `enabled: !!ctx` the query does not run without `ctx`; keep the guard anyway and return `{ from: Date.now(), value: null }` from it.
3. **Row 27, name lookup:** `useQuery({ queryKey: [ctx, "dns", profile?.name], queryFn: <unchanged>, refetchInterval: 60_000, enabled: !!ctx })`; its `.reload()` becomes `.refetch()`.
4. **Row 28, setup report:** `useQuery({ queryKey: ["mac", "setup-report"], queryFn: () => invoke<SetupReport>("setup_report"), refetchInterval: 60_000 })`. `useSetup` returns `reload: () => setupQuery.refetch()` and `error: errorText(setupQuery.error)`.
5. **Container actions become mutations.** In `src/Containers.tsx` and `src/ContainerDetail.tsx` every action that runs `docker(ctx, [...])` and then refetches (start, stop, restart, remove, rename, pause) uses the pattern of WO-4.3b step 3 with the refresh list of the table (`containers`, `inspect`, `diskUsage`). The `containers.refetch()` calls that follow an action are deleted; the ones that follow something that is not a docker action (the end of a resize, a copy ending, `settling` after a VM change) stay as `refetch()` because no mutation ran. Words and focus handling stay as they are.
6. **Delete.** `git rm src/hooks.ts src/lib/pollPace.ts src/lib/pollPace.test.ts src/lib/latest.ts src/lib/latest.test.ts`. Run `grep -rn "pollPace\|lib/latest\|from \"./hooks\"\|from \"../hooks\"" src | wc -l`: it prints `0`. (`src/hooks/` the folder holds other hooks and stays.) The `openpier:refresh` listener of the old `usePoll` is replaced by `src/lib/queryClient.ts` (WO-4.3a step 3).
7. Timers that are not data loading. `grep -rn "setInterval" src --include='*.ts' --include='*.tsx' | grep -v "\.test\."` lists what is left. Each must have a comment above it that says what it is for (a clock that counts seconds, a toast timeout, an animation). If one loads data, convert it as a query and give it a row in the table in the pull request file. Add the missing comments.
8. The plan's Done when: `grep -rn "usePoll\|setInterval" src --include=*.ts --include=*.tsx` shows only timers that are not data loading, each with a comment (see 7).

**Tests to write first:**

`src/lib/doctorFacts.test.tsx` (vitest, `withQuery`; mocks `invoke`):
1. `Given a facts read that started at t=100 and ended at t=900, When the resize ended at t=500, Then holdAfterResize(false, 500, data.from) is true (the read started before the end)`.
2. `Given a read that started at t=600, When the resize ended at t=500, Then holdAfterResize is false`.
3. `Given ctx is null, When useDoctor mounts, Then no docker command is invoked`.
4. `Given the engine kind is "orbstack", When the facts are read, Then colima_config is not invoked`.

`src/Setup.test.tsx` (add, vitest):
5. `Given setup_report answers, When useSetup mounts, Then the report is the data and a refetch asks again`.

`src/Containers.test.tsx` (add):
6. `Given a running container, When Stop is confirmed, Then docker stop is called and containers is read again, also when stop fails`.

**Done when:**
1. `grep -rn "usePoll" src preview scripts --include='*.ts' --include='*.tsx' --include='*.mjs' | wc -l` prints `0`.
2. `ls src/hooks.ts src/lib/pollPace.ts src/lib/latest.ts 2>&1 | grep -c "No such file"` prints `3`.
3. `grep -rn "setInterval" src --include='*.ts' --include='*.tsx' | grep -v "\.test\." | wc -l` prints `0`, or each remaining line has a comment on the line above that starts `// A timer, not a data read:`.
4. `grep -rn "dataFrom" src | wc -l` prints `0`.
5. `npx vitest run 2>&1 | grep "Tests "` shows no failure; node tests pass (the count dropped by the two deleted test files; say how many in the pull request file); `npm run check` passes in both engines.
6. The gate.

**Pull request title** (first line of `docs/plan/iterations/pr/wo-4.3c.md`): `wo-4.3c: usePoll is gone; every list reads through TanStack Query`

---

## WO-5.1a The old UI is deleted

**Needs:** WO-4.3c.

**Why:** E6 (two component sets and a dead stylesheet language). Every screen uses `src/ui/op` since iteration 3. The old set (`src/ui/*.tsx`, `src/ui/components/`, `src/ui.tsx`, `src/ui/icons.tsx` and its barrel `src/ui/index.ts`) has no user left. Deleting it leaves one component set, and `knip` keeps it that way.

**Read first:**
1. `docs/plan/05-implementation-plan.md` task 5.1; `docs/plan/iterations/README.md` item 7 (the new components); `docs/plan/iterations/iteration-1-work-orders.md` WO-1.3c (the list `scripts/not-migrated.json`, the ESLint block, `scripts/check-classes.mjs`).
2. `package.json`, `eslint.config.js`, `scripts/not-migrated.json`, `tsconfig.json`, `vitest.config.ts`.
3. knip: https://knip.dev/reference/configuration (keys: `entry`, `project`, `ignore`, `ignoreDependencies`, `ignoreExportsUsedInFile`).

**Starting state:**
1. `git status --short` prints nothing; `ls src/ui/op/index.ts src/ui/index.ts src/ui.tsx src/ui/icons.tsx` lists all four, and `ls -d src/ui/components` lists the folder.
2. `node -e 'console.log(JSON.stringify(require("./scripts/not-migrated.json").filter(f=>!f.startsWith("src/ui/")&&f!=="src/ui.tsx")))'` prints `[]`. Every screen is migrated. If it prints file names, stop and report them: this work order cannot delete the old set while a screen imports it. (Iteration 3 should have emptied this part of the list.)
3. `grep -rnE "from \"(\./|\.\./)+ui\"|from \"(\./|\.\./)+ui/(index|icons|components)" src --include='*.ts' --include='*.tsx' | grep -v "^src/ui/" | wc -l` prints `0` (nothing outside `src/ui/` imports the old barrel, the old icons or the old components).
4. `grep -rnE "from \"(\./|\.\./)+ui\.tsx?\"|from \"(\./|\.\./)+ui\"" src --include='*.ts' --include='*.tsx' | grep -v "ui/op" | wc -l` prints `0`.
5. `npm ls tailwind-merge class-variance-authority clsx 2>&1 | grep -c "tailwind-merge\|class-variance-authority\|clsx"` prints at least `3` (the three are still installed, as the addendum says).
6. `grep -c '"knip"' package.json` prints `0`.

If any differs, stop and report.

**Do not touch:** `src/ui/op/` (WO-5.1b moves it), `src/ui/openpier.css`, `src/dev/`.

**Steps:**

1. List what will be deleted, before deleting. Write the output into the pull request file:

```sh
git ls-files src/ui src/ui.tsx | grep -v "^src/ui/op/" | grep -v "^src/ui/openpier.css$"
```

   The expected list is: `src/ui.tsx`, `src/ui/index.ts`, `src/ui/icons.tsx`, everything under `src/ui/components/`, and the old `src/ui/*.tsx` and `src/ui/*.ts` files (for example `Button`, `Card`, `Dialog`, `Drawer`, `Menu`, `PageHeader`, `Ticks`, `OutputLog`, `tokens.css`). It must not hold `openpier.css`.

2. Keep what is still imported. For each file of that list, run `grep -rn "<name>" src --include='*.ts' --include='*.tsx' | grep -v "^src/ui/" | grep -v "\.test\."` with the file's base name in the import path. A file imported from outside `src/ui/` (for example `src/ui/Ticks.tsx` or `src/ui/OutputLog.tsx` if a screen still uses it) stays: write its name in the pull request file. Starting state 3 already says the barrel and the old components have no importer; this step finds any other.

3. Install knip and its config.

```sh
npm install --save-dev knip@5
```

   Not verified: the exact flag names of the installed knip. Run `npx knip --help` and use the flag it prints for "include only these issue types" (`--include`) in the commands below; if the help text names it differently, use that name.

   Create `knip.json`:

```json
{
  "entry": ["src/main.tsx", "src/**/*.test.{ts,tsx}", "scripts/*.mjs", "preview/*.ts", "vite.config.ts", "vite.preview.config.ts", "vitest.config.ts"],
  "project": ["src/**/*.{ts,tsx}", "preview/**/*.ts"],
  "ignoreExportsUsedInFile": true,
  "vitest": true,
  "eslint": true
}
```

   Add to `package.json` scripts: `"knip": "knip --include files,exports"`.

4. Delete the files: `git rm -r src/ui/components src/ui.tsx src/ui/index.ts src/ui/icons.tsx`, and `git rm` each other old file of step 1's list that step 2 did not keep (the CSS `src/ui/tokens.css` goes with them if nothing imports it: `grep -rn "tokens.css" src index.html` must print nothing first; `src/main.tsx` imported it in the old setup, WO-1.1 removed that line).

5. Fix the list `scripts/not-migrated.json`: remove every path that no longer exists (they were old UI files). Run `node scripts/check-not-migrated.mjs`: it must print only `ok` lines. The list is now `[]`; keep the file (the ESLint block and `check-classes.mjs` still read it).

6. Remove the three helper packages, only if nothing imports them:

```sh
grep -rn "tailwind-merge\|class-variance-authority\|from \"clsx\"" src --include='*.ts' --include='*.tsx' | wc -l
```

   When it prints `0`: `npm uninstall tailwind-merge class-variance-authority clsx`. When it prints more than `0`: list the hits in the pull request file and keep the packages; knip will report them.

7. Run `npx knip --include files,exports 2>&1 | tail -40`. Fix what it reports, in this order and with these rules only:
   1. An unused file in `src/` (not a test, not under `src/dev/`): delete it with `git rm`.
   2. An unused export: remove the word `export` (the thing is used in its file), or delete it when nothing uses it at all.
   3. Never add an `ignore` entry and never add a file to `entry` to make it quiet. Never delete a test.
   4. Run it again after each batch. Three rounds at most; if it is not clean after three, stop and report the output.

8. Run `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run check`.

**Tests to write first:** none new. The proof is `tsc`, `knip` and the existing tests: this work order only deletes unused code. Before step 4, run `npm test 2>&1 | grep -E "^# (pass|fail)"` and `npx vitest run 2>&1 | grep "Tests "` and write both in the pull request file; after step 7 they must be the same, except for tests that lived in a deleted file (list each deleted test file by name; each must belong to the old UI).

**Done when:**
1. `ls src/ui.tsx src/ui/index.ts src/ui/icons.tsx src/ui/components 2>&1 | grep -c "No such file"` prints `4`.
2. `node -e 'console.log(require("./scripts/not-migrated.json").length)'` prints `0`.
3. `npx knip --include files,exports 2>&1 | grep -c "Unused"` prints `0` (the knip output has no "Unused files" or "Unused exports" heading).
4. `npm ls tailwind-merge class-variance-authority clsx 2>&1 | grep -c "tailwind-merge\|class-variance-authority\|clsx"` prints `0`, or the pull request file says why a package stays.
5. `grep -rn "tailwind" package.json src | wc -l` prints `0`.
6. The gate (`../HANDOFF.md` section 5), and `npx tsc --noEmit` prints nothing.

**Pull request title** (first line of `docs/plan/iterations/pr/wo-5.1a.md`): `wo-5.1a: One component set: the old UI and its helper packages are deleted`

---

## WO-5.1b The new components live in src/ui, and the old tab type is gone

**Needs:** WO-5.1a.

**Why:** E6. The new components were built in `src/ui/op/` only because the old barrel `src/ui/index.ts` had the same names. With the old set gone they move up to `src/ui/`, every import is rewritten from `ui/op` to `ui`, and the last bridge to the old design, the `Tab` type and `src/lib/tabRoutes.ts` (made in WO-2.1, "deleted in iteration 4"), is removed.

**Read first:** `src/ui/op/index.ts`, `eslint.config.js` (the block with `ignores: ["src/ui/op/**", ...`), `scripts/check-classes.mjs`, `scripts/check-not-migrated.mjs`, `src/lib/tabRoutes.ts`, `src/Shell.tsx` (`export type Tab`), `src/App.tsx` (every `tab`, `setTab`, `Tab`, `NOUN`), `src/lib/routes.ts` (`Route`, the page names).

**Starting state:**
1. `git status --short` prints nothing; `ls src/ui/index.ts 2>&1` says no such file (WO-5.1a deleted it); `ls src/ui/op/index.ts` lists it.
2. `ls src/ui | grep -v "^op$" | grep -v "^openpier.css$"` prints only files that WO-5.1a step 2 said to keep (possibly nothing). If a file there has the same base name as a file of `src/ui/op/`, stop and report (the move would overwrite it).
3. `grep -rln "ui/op" src scripts eslint.config.js vitest.config.ts tsconfig.json knip.json AGENTS.md package.json 2>/dev/null | wc -l` prints a number; write it down (it is the number of files the codemod touches, plus config files).
4. `grep -c "tabOfRoute\|pathOfTab" src/App.tsx` prints at least `2`.

**Do not touch:** `docs/plan/` (the plan and the work orders keep naming `src/ui/op` for the time they were written; step 6 makes the doc check skip that folder), `src/ui/openpier.css`.

**The map from the old `Tab` to the page of the route** (used by step 4; the left column is a value of `Tab` in `src/Shell.tsx`, the middle is `route.page` in `src/lib/routes.ts`, the right is the address that `src/lib/tabRoutes.ts` gave it):

| `Tab` | `route.page` | Address for `go(...)` |
|---|---|---|
| `Containers` | `containers` | `#/containers` |
| `Images` | `images` | `#/images` |
| `Volumes` | `volumes` | `#/volumes` |
| `Networks` | `networks` | `#/networks` |
| `Kubernetes` | `kubernetes` | `#/kubernetes/pods` |
| `Doctor` | `doctor` | `#/doctor` |
| `Profiles` | `settings` | `#/settings/machines` |

**Steps:**

1. Move the files. Nothing is renamed:

```sh
git mv src/ui/op/* src/ui/
rmdir src/ui/op
ls src/ui | head -80
```

   `git mv` of a folder's contents with a glob moves tests too. `src/ui/index.ts` is the old `src/ui/op/index.ts`.

2. Rewrite the imports with this script. Create `scripts/ui-up.mjs` (it is a one-off; it is deleted in step 8):

```js
// One-off: src/ui/op moved to src/ui. Imports of "…/ui/op" become "…/ui". Moved files that reached out of op with "../../" now use "../".
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === "node_modules" ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]));
const files = ["src", "scripts", "preview"].flatMap((d) => walk(path.join(root, d))).filter((f) => /\.(tsx?|mjs|json)$/.test(f) && !f.endsWith("ui-up.mjs"));
let changed = 0;
for (const f of files) {
  const before = fs.readFileSync(f, "utf8");
  let after = before.replace(/(["'`])((?:\.\.?\/)*(?:src\/)?ui)\/op(\/[^"'`]*)?\1/g, (m, q, base, rest) => `${q}${base}${rest ?? ""}${q}`);
  const rel = path.relative(root, f);
  if (rel.startsWith(`src${path.sep}ui${path.sep}`) && !rel.slice("src/ui/".length).includes(path.sep)) {
    // a file that sat in src/ui/op and now sits in src/ui: its way out of the folder is one level shorter
    after = after.replace(/from "\.\.\/\.\.\//g, 'from "../');
  }
  if (after !== before) { fs.writeFileSync(f, after); changed++; console.log("changed", rel); }
}
console.log(`${changed} files changed`);
```

   Run `node scripts/ui-up.mjs`. Then `grep -rn "ui/op" src scripts preview eslint.config.js vitest.config.ts tsconfig.json knip.json AGENTS.md package.json | wc -l` must print `0`. Any hit left (a path inside a comment, a string that is not an import) is changed by hand to say `src/ui`.

   Not verified: that every moved file used `"../../"` only for paths outside `src/ui/`. Run `npx tsc --noEmit`. A file under `src/ui/` that fails to resolve an import is fixed by hand with the shortest correct relative path; any other error: stop and report.

3. Config that named the old folder:
   1. `eslint.config.js`: in the block with `files: ["src/**/*.tsx"]` change `ignores: ["src/ui/op/**", ...]` to `ignores: ["src/ui/**", "src/**/*.test.tsx", ...notMigrated]`. In its `no-restricted-imports` `patterns`, delete the entry that named the old components (the one with `regex: "(^|/)ui(/(index|ui|icons|components...` and the message `Use the components in src/ui/op.`) and put in its place one group: `{ group: ["**/ui/*"], message: "Import from src/ui, not from a file inside it." }`. Keep the `lucide-react` group, but change its message to `Use <Icon> from src/ui.`. In every other `message` that says `src/ui/op` write `src/ui`. In the block that turns the rules off for `src/ui/op/Meters.tsx` write `src/ui/Meters.tsx`; do the same for `LogView.tsx` and `VirtualRows.tsx` if the file has such blocks.
   2. `scripts/check-classes.mjs`: it walks all of `src` and skips only the files of `not-migrated.json`, so its logic needs no change. Change the comment that says `src/ui/op` to `src/ui`.
   3. `scripts/check-not-migrated.mjs` and `scripts/not-migrated.json`: no path in them starts with `src/ui/op`; confirm with `grep -c "ui/op" scripts/not-migrated.json scripts/check-not-migrated.mjs` (prints `0` twice). The list is `[]` since WO-5.1a.
   4. `knip.json`, `vitest.config.ts`, `tsconfig.json`: the codemod changed any `ui/op` in them; check `git diff --stat` lists only files you expect.
   5. `src/dev/Gallery.tsx` imports from `../ui`; the gallery still opens at `#/dev/gallery`.

4. Remove the old `Tab`. This is the bridge made by WO-2.1 step 5.
   1. In `src/App.tsx`: delete `import { tabOfRoute, pathOfTab } from "./lib/tabRoutes";` and the import of `Tab` from `./Shell`. Replace `const tab: Tab = tabOfRoute(route);` and `const setTab = useCallback((t: Tab) => go(pathOfTab(t)), []);` by `const page = route.page;`.
   2. Run `grep -n "\btab\b\|setTab\|\bTab\b" src/App.tsx`. Each hit is rewritten by the map above: `tab === "Images"` becomes `page === "images"`, `setTab("Doctor")` becomes `go("#/doctor")`, `setTab("Containers")` becomes `go("#/containers")`, `setTab("Profiles")` becomes `go("#/settings/machines")`, `NOUN[tab]` becomes `NOUN[page]` with the keys of `NOUN` written as the page names (`images`, `volumes`, `networks`, `kubernetes`). A place that passes `setTab` or a `Tab` value into a component prop (for example `onNav`, `nav`, `hidden`, `badges`): open that component and apply the same rule; if the component only exists to take a `Tab` (a leftover of the old shell), delete the prop on both sides.
   3. `src/Shell.tsx`: delete `export type Tab = ...` and every use of it. `grep -rn "\bTab\b" src --include='*.ts' --include='*.tsx' | grep -v "Tabs\|TabsProps" | wc -l` must print `0` (the word `Tab` as a type; the `Tabs` component and the container detail's own tab names are not this type).
   4. `git rm src/lib/tabRoutes.ts` (and `src/lib/tabRoutes.test.ts` if it exists).
   5. `npx tsc --noEmit` must print nothing. Any error that is not a missing `Tab` or `tabRoutes`: stop and report.
   Not verified: the exact list of places that use `Tab` after iterations 2 and 3; step 4.2 finds them by grep.

5. Replace the plan's check of the folder: `scripts/check-classes.mjs`, the ESLint block and the gallery now read `src/ui`. Run `node scripts/check-classes.mjs` (prints only `ok`), `npm run lint` (no error), and prove ESLint still guards a screen: in `src/Images.tsx` temporarily add `<button>x</button>`, run `npx eslint src/Images.tsx`, expect the error `Use <Button> from src/ui.`, then undo.

6. Run `npx knip --include files,exports`. It must print nothing under "Unused". Fix as in WO-5.1a step 7.

7. Run the gate. `npm run check` must pass in both engines: this proves every screen still renders after the move.

8. `git rm scripts/ui-up.mjs` (the one-off). Commit the move and the import rewrite as their own commit before the `Tab` removal, so the move reads as a pure rename in the history: `refactor: move the components from src/ui/op to src/ui`, then `refactor: remove the old Tab type`.

**Tests to write first:**
1. `src/lib/uiImports.test.ts` (node:test; add; reads files with `node:fs`): `Given the files under src, When scanned, Then no import path contains "ui/op"`; `Given src/ui, When listed, Then there is no folder named op`; `Given src/lib, When listed, Then there is no file tabRoutes.ts`. Write them first; they fail until the steps are done.

**Done when:**
1. `ls -d src/ui/op 2>&1 | grep -c "No such file"` prints `1`; `ls src/ui/index.ts src/ui/Button.tsx src/ui/Menu.tsx src/ui/EngineButton.tsx` lists all four.
2. `grep -rn "ui/op" src scripts preview eslint.config.js vitest.config.ts tsconfig.json knip.json AGENTS.md package.json | wc -l` prints `0`.
3. `grep -rn "tabRoutes\|tabOfRoute\|pathOfTab" src | wc -l` prints `0`; `grep -rn "export type Tab\b" src | wc -l` prints `0`.
4. `node --experimental-strip-types --no-warnings --test src/lib/uiImports.test.ts 2>&1 | grep -E "^# (pass|fail)"` shows `# fail 0`.
5. `npx knip --include files,exports 2>&1 | grep -c "Unused"` prints `0`.
6. `npm run check` passes in Chromium and WebKit, and `node scripts/check-classes.mjs` and `node scripts/check-not-migrated.mjs` print no `FAIL`.
7. The gate.

**Pull request title** (first line of `docs/plan/iterations/pr/wo-5.1b.md`): `wo-5.1b: The components live in src/ui and the old Tab type is gone`

---

## WO-5.2 main.rs is split into one file per job

**Needs:** WO-5.1b (so no frontend work is in flight) and WO-4.2b (the old runtime commands are already gone from `main.rs`).

**Why:** E11 (`main.rs` is one file of about 2,000 lines with 89 tests in it). Code moves; nothing is rewritten. After this work order each file has one job and `main.rs` is the app's entry only.

**This work order moves code with a script, not by hand.** Moving 160 items and 89 tests by hand loses a test or a `use` line. The script `scripts/split-main-rs.mjs` below was written and run on a scratch copy of `main.rs` shaped like the one after iteration 1: it produced files that compiled, kept all 89 tests with the same names and the same count, passed `cargo clippy` without a new warning, and left `main.rs` at 68 lines. It makes only four kinds of change: it puts `pub(crate)` (or `pub` for a `#[tauri::command]`) in front of a moved item, writes each new file's `use` lines, points `crate::name` in `engine.rs`, `desktop.rs` and `setup.rs` at the new file, and puts `file::` in front of each command in `main.rs`'s handler list. If it finds an item or a test with no home, it stops and writes nothing.

**Read first:** `docs/plan/05-implementation-plan.md` task 5.2; `src-tauri/src/main.rs` (skim the order of its items); the table below.

**Starting state:**
1. `git status --short` prints nothing; `ls src-tauri/src` lists `desktop.rs engine.rs main.rs setup.rs` and no `exec.rs`.
2. `wc -l < src-tauri/src/main.rs` prints a number of at least `1500`.
3. `grep -c "^mod tests" src-tauri/src/main.rs` prints `1`.
4. `cd src-tauri && cargo fmt --check` prints nothing (the script reads rustfmt-formatted code: it finds items by their indentation).
5. `cd src-tauri && cargo test 2>&1 | grep "test result"`: write the numbers down as **P passed** and **I ignored** (the scratch copy: 161 passed, 2 ignored; your numbers may be higher).
6. Save the test names before the move: `cd src-tauri && cargo test -- --list 2>/dev/null | grep ": test" | sed 's/.*:://; s/: test//' | sort > target/names.before && wc -l < target/names.before`. Write the number down as **N** (the scratch copy: 163, which is 161 passed plus 2 ignored).
7. Save the item names before the move: 

```sh
items() { grep -ohE "^ *(pub(\([a-z]+\))? )?(async )?(fn|const|static|struct|enum|type) [A-Za-z_0-9]+" "$@" | sed -E 's/^ *(pub(\([a-z]+\))? )?(async )?//' | sort; }
items src-tauri/src/main.rs > src-tauri/target/items.before; wc -l < src-tauri/target/items.before
```

   (the scratch copy: 277 lines).

If 1 to 4 differ, stop and report.

**Do not touch:** `src-tauri/src/engine.rs`, `desktop.rs`, `setup.rs` except what the script does to their `use crate::...` lines; no test; no function body.

**Which function moves to which file.** Seven new files (the plan names six: `exec.rs`, `allow.rs`, `engine.rs`, `colima.rs`, `compose.rs`, `kube.rs`; `engine.rs` already exists since WO-4.1, and `system.rs` and `tools.rs` are two more files, because the code that is left over, about 600 lines of Terminal, folder choosers, network facts and tool installs, belongs to none of the six, and putting it in `main.rs` would keep it over 200 lines):

| File | Job | Items (every name that moves there; each with the tests that use only it) |
|---|---|---|
| `exec.rs` | Running programs: find a tool, run it with a deadline and a size cap, stream its output as events. | `find_bin`, `path_env`, `EXEC_DEADLINE`, `OUTPUT_CAP`, `read_capped`, `KILL_WAIT`, `wait_bounded`, `output_with_deadline`, `run_with_deadline`, `exec`, `exec_in`, `FrameSplitter`, `split_frames`, `emit_frame`, `kill_group`, `STREAM_SILENCE`, `stream`, `stream_with`, `stream_in`, `locate`, `impl FrameSplitter` |
| `allow.rs` | What the page may ask docker to do: the allowlist, its checks, and the commands that run docker. | `safe`, `DOCKER_SUBCOMMANDS`, `docker_args_allowed`, `allowed_flags`, `flags_ok`, `run_args_ok`, `run_mount_ok`, `run_name_ok`, `run_port_ok`, `run_source_ok`, `NETSHOOT_IMAGE`, `BUSYBOX_IMAGE`, `PROBE_SCRIPT`, `restart_policy_ok`, `container_name_ok`, `probe_inputs_ok`, `probe_args`, `network_probe`, `events_args_ok`, `docker_check`, `docker`, `docker_pull`, `SHELL_PROBE_DEADLINE`, `shell_probe_verdict`, `container_shell` |
| `kube.rs` | Kubernetes: read-only kubectl with JSON output, for a Colima context only. | `k8s_name_ok`, `kubectl_args_allowed`, `kubectl` |
| `colima.rs` | The Colima machine: list, start, stop, resize, delete, shared folders, name lookup, its log. | `Profile`, `StartOpts`, `start_args`, `run`, `VM_OP_PID`, `VM_LOCK`, `VM_CANCELLED`, `run_steps`, `colima_stream`, `cancel_vm_op`, `list_profiles`, `start_profile`, `apply_resources`, `ColimaConfig`, `config_path`, `colima_config`, `DNS_PROBE_HOST`, `DNS_PROBE_DEADLINE`, `dns_probe_args`, `dns_verdict`, `vm_dns_probe`, `MountSpec`, `mount_ok`, `mounts_overlap`, `mounts_steps`, `apply_mounts`, `forced`, `env_steps`, `apply_env`, `stop_profile`, `force_stop_profile`, `restart_profile`, `force_restart_profile`, `profile_name_ok`, `profile`, `lima_dir`, `tail_bytes`, `vm_log_tail`, `vm_log_path`, `reveal_vm_log`, `delete_profile`, `colima_context_ok` |
| `system.rs` | The Mac itself: open links, the folder chooser, Terminal, the Mac's size and network. | `NetworkFacts`, `read_only_text`, `network_facts`, `Host`, `sysctl`, `host_resources`, `localhost_url`, `https_url_ok`, `open_url`, `PICK_FOLDER_SCRIPT`, `PICK_COMPOSE_SCRIPT`, `PICK_FOLDER_DEADLINE`, `parse_pick_folder`, `pick_folder`, `terminal_script`, `open_terminal`, `BREW_INSTALL_SCRIPT`, `open_homebrew_install`, `terminal_command` |
| `tools.rs` | The tools the app needs (brew, colima, docker, kubectl, k9s): which are installed, how to install them, and the setup report. | `Tool`, `EnvReport`, `parse_version`, `tool`, `env_check`, `validate_install`, `install_tools`, `setup_report`, `setup_fix` |
| `compose.rs` | Compose projects: find them on the Mac, open their files, run them, read their logs. | `COMPOSE_NAMES`, `COMPOSE_SCAN_DEADLINE`, `COMPOSE_MAX`, `compose_query`, `COMPOSE_SKIP_DIRS`, `compose_paths`, `find_compose_files`, `compose_real_path`, `EDITOR_DENY`, `looks_like_editor`, `pick_editor`, `TEXTEDIT`, `editor_args`, `opens_in`, `ROLE_EDITOR`, `launch_services`, `app_name_of`, `app_display_name`, `type_editor`, `compose_open_plan`, `OpenRun`, `OPEN_DEADLINE`, `STILL_OPENING`, `OPEN_FAILED`, `open_run`, `app_missing`, `open_with_fallback`, `reveal_compose`, `EditorPlan`, `editor_plan`, `compose_editor`, `open_compose`, `COMPOSE_TIMEOUT`, `COMPOSE_LOCK`, `COMPOSE_PID`, `compose_args`, `compose_service_args`, `NOT_STARTED`, `default_project_name`, `project_services`, `compose_action`, `compose_config`, `config_retry_plain`, `compose_logs`, `compose_logs_args`, `compose_files_in`, `compose_in_folder`, `cancel_compose` |

Tests move with the code they test: a test goes to the file of the one file whose items it uses. Two tests use several files, and the homes file says where they go: `given_the_app_open_tried_when_named_then_it_is_the_app_name_or_textedit_for_the_fallback` goes to `compose.rs` and `given_a_ro_suffix_when_a_mount_is_checked_then_only_ro_is_accepted` goes to `colima.rs`. Test helpers (`args`, `opts`, `mount`, `compose_home`) are copied into each file whose tests call them.

**What `main.rs` holds after the move** (the scratch copy, whole file; yours has your app's name in the last line and your handler list):

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod allow;
mod colima;
mod compose;
mod desktop;
mod engine;
mod exec;
mod kube;
mod setup;
mod system;
mod tools;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            colima::list_profiles,
            allow::docker,
            allow::docker_check,
            allow::docker_pull,
            tools::env_check,
            tools::install_tools,
            allow::network_probe,
            kube::kubectl,
            system::open_terminal,
            system::open_homebrew_install,
            colima::start_profile,
            colima::apply_resources,
            colima::stop_profile,
            colima::force_stop_profile,
            colima::restart_profile,
            colima::colima_config,
            system::network_facts,
            colima::vm_dns_probe,
            colima::apply_mounts,
            colima::apply_env,
            colima::force_restart_profile,
            colima::delete_profile,
            colima::cancel_vm_op,
            system::host_resources,
            colima::vm_log_tail,
            colima::reveal_vm_log,
            system::open_url,
            system::pick_folder,
            tools::setup_report,
            tools::setup_fix,
            compose::find_compose_files,
            compose::reveal_compose,
            compose::compose_editor,
            compose::open_compose,
            compose::compose_config,
            compose::compose_action,
            compose::cancel_compose,
            compose::compose_logs,
            compose::compose_in_folder,
            allow::container_shell,
            desktop::desktop_state,
            desktop::desktop_docker,
            desktop::desktop_copy,
            desktop::desktop_copy_stop,
            desktop::desktop_start,
            desktop::desktop_replace,
            desktop::open_docker_desktop,
            engine::list_engines
        ])
        .run(tauri::generate_context!())
        .expect("error while running Wharf");
}
```

**Steps:**

1. Create `scripts/split-main-rs.homes.json` with exactly this content:

```json
{
  "docs": {
    "exec.rs": "Running programs: find a tool, run it with a deadline and a size cap, stream its output as events.",
    "allow.rs": "What the page may ask docker to do: the allowlist, its checks, and the commands that run docker.",
    "kube.rs": "Kubernetes: read-only kubectl with JSON output, for a Colima context only.",
    "colima.rs": "The Colima machine: list, start, stop, resize, delete, shared folders, name lookup, its log.",
    "system.rs": "The Mac itself: open links, the folder chooser, Terminal, the Mac's size and network.",
    "tools.rs": "The tools the app needs (brew, colima, docker, kubectl, k9s): which are installed, how to install them, and the setup report.",
    "compose.rs": "Compose projects: find them on the Mac, open their files, run them, read their logs."
  },
  "items": {
    "find_bin": "exec.rs",
    "path_env": "exec.rs",
    "EXEC_DEADLINE": "exec.rs",
    "OUTPUT_CAP": "exec.rs",
    "read_capped": "exec.rs",
    "KILL_WAIT": "exec.rs",
    "wait_bounded": "exec.rs",
    "output_with_deadline": "exec.rs",
    "run_with_deadline": "exec.rs",
    "exec": "exec.rs",
    "exec_in": "exec.rs",
    "FrameSplitter": "exec.rs",
    "split_frames": "exec.rs",
    "emit_frame": "exec.rs",
    "kill_group": "exec.rs",
    "STREAM_SILENCE": "exec.rs",
    "stream": "exec.rs",
    "stream_with": "exec.rs",
    "stream_in": "exec.rs",
    "locate": "exec.rs",
    "impl FrameSplitter": "exec.rs",
    "safe": "allow.rs",
    "DOCKER_SUBCOMMANDS": "allow.rs",
    "docker_args_allowed": "allow.rs",
    "allowed_flags": "allow.rs",
    "flags_ok": "allow.rs",
    "run_args_ok": "allow.rs",
    "run_mount_ok": "allow.rs",
    "run_name_ok": "allow.rs",
    "run_port_ok": "allow.rs",
    "run_source_ok": "allow.rs",
    "NETSHOOT_IMAGE": "allow.rs",
    "BUSYBOX_IMAGE": "allow.rs",
    "PROBE_SCRIPT": "allow.rs",
    "restart_policy_ok": "allow.rs",
    "container_name_ok": "allow.rs",
    "probe_inputs_ok": "allow.rs",
    "probe_args": "allow.rs",
    "network_probe": "allow.rs",
    "events_args_ok": "allow.rs",
    "docker_check": "allow.rs",
    "docker": "allow.rs",
    "docker_pull": "allow.rs",
    "SHELL_PROBE_DEADLINE": "allow.rs",
    "shell_probe_verdict": "allow.rs",
    "container_shell": "allow.rs",
    "k8s_name_ok": "kube.rs",
    "kubectl_args_allowed": "kube.rs",
    "kubectl": "kube.rs",
    "Profile": "colima.rs",
    "StartOpts": "colima.rs",
    "start_args": "colima.rs",
    "run": "colima.rs",
    "VM_OP_PID": "colima.rs",
    "VM_LOCK": "colima.rs",
    "VM_CANCELLED": "colima.rs",
    "run_steps": "colima.rs",
    "colima_stream": "colima.rs",
    "cancel_vm_op": "colima.rs",
    "list_profiles": "colima.rs",
    "start_profile": "colima.rs",
    "apply_resources": "colima.rs",
    "ColimaConfig": "colima.rs",
    "config_path": "colima.rs",
    "colima_config": "colima.rs",
    "DNS_PROBE_HOST": "colima.rs",
    "DNS_PROBE_DEADLINE": "colima.rs",
    "dns_probe_args": "colima.rs",
    "dns_verdict": "colima.rs",
    "vm_dns_probe": "colima.rs",
    "MountSpec": "colima.rs",
    "mount_ok": "colima.rs",
    "mounts_overlap": "colima.rs",
    "mounts_steps": "colima.rs",
    "apply_mounts": "colima.rs",
    "forced": "colima.rs",
    "env_steps": "colima.rs",
    "apply_env": "colima.rs",
    "stop_profile": "colima.rs",
    "force_stop_profile": "colima.rs",
    "restart_profile": "colima.rs",
    "force_restart_profile": "colima.rs",
    "profile_name_ok": "colima.rs",
    "profile": "colima.rs",
    "lima_dir": "colima.rs",
    "tail_bytes": "colima.rs",
    "vm_log_tail": "colima.rs",
    "vm_log_path": "colima.rs",
    "reveal_vm_log": "colima.rs",
    "delete_profile": "colima.rs",
    "colima_context_ok": "colima.rs",
    "NetworkFacts": "system.rs",
    "read_only_text": "system.rs",
    "network_facts": "system.rs",
    "Host": "system.rs",
    "sysctl": "system.rs",
    "host_resources": "system.rs",
    "localhost_url": "system.rs",
    "https_url_ok": "system.rs",
    "open_url": "system.rs",
    "PICK_FOLDER_SCRIPT": "system.rs",
    "PICK_COMPOSE_SCRIPT": "system.rs",
    "PICK_FOLDER_DEADLINE": "system.rs",
    "parse_pick_folder": "system.rs",
    "pick_folder": "system.rs",
    "terminal_script": "system.rs",
    "open_terminal": "system.rs",
    "BREW_INSTALL_SCRIPT": "system.rs",
    "open_homebrew_install": "system.rs",
    "terminal_command": "system.rs",
    "Tool": "tools.rs",
    "EnvReport": "tools.rs",
    "parse_version": "tools.rs",
    "tool": "tools.rs",
    "env_check": "tools.rs",
    "validate_install": "tools.rs",
    "install_tools": "tools.rs",
    "setup_report": "tools.rs",
    "setup_fix": "tools.rs",
    "COMPOSE_NAMES": "compose.rs",
    "COMPOSE_SCAN_DEADLINE": "compose.rs",
    "COMPOSE_MAX": "compose.rs",
    "compose_query": "compose.rs",
    "COMPOSE_SKIP_DIRS": "compose.rs",
    "compose_paths": "compose.rs",
    "find_compose_files": "compose.rs",
    "compose_real_path": "compose.rs",
    "EDITOR_DENY": "compose.rs",
    "looks_like_editor": "compose.rs",
    "pick_editor": "compose.rs",
    "TEXTEDIT": "compose.rs",
    "editor_args": "compose.rs",
    "opens_in": "compose.rs",
    "ROLE_EDITOR": "compose.rs",
    "launch_services": "compose.rs",
    "app_name_of": "compose.rs",
    "app_display_name": "compose.rs",
    "type_editor": "compose.rs",
    "compose_open_plan": "compose.rs",
    "OpenRun": "compose.rs",
    "OPEN_DEADLINE": "compose.rs",
    "STILL_OPENING": "compose.rs",
    "OPEN_FAILED": "compose.rs",
    "open_run": "compose.rs",
    "app_missing": "compose.rs",
    "open_with_fallback": "compose.rs",
    "reveal_compose": "compose.rs",
    "EditorPlan": "compose.rs",
    "editor_plan": "compose.rs",
    "compose_editor": "compose.rs",
    "open_compose": "compose.rs",
    "COMPOSE_TIMEOUT": "compose.rs",
    "COMPOSE_LOCK": "compose.rs",
    "COMPOSE_PID": "compose.rs",
    "compose_args": "compose.rs",
    "compose_service_args": "compose.rs",
    "NOT_STARTED": "compose.rs",
    "default_project_name": "compose.rs",
    "project_services": "compose.rs",
    "compose_action": "compose.rs",
    "compose_config": "compose.rs",
    "config_retry_plain": "compose.rs",
    "compose_logs": "compose.rs",
    "compose_logs_args": "compose.rs",
    "compose_files_in": "compose.rs",
    "compose_in_folder": "compose.rs",
    "cancel_compose": "compose.rs"
  },
  "tests": {
    "given_the_app_open_tried_when_named_then_it_is_the_app_name_or_textedit_for_the_fallback": "compose.rs",
    "given_a_ro_suffix_when_a_mount_is_checked_then_only_ro_is_accepted": "colima.rs"
  },
  "keep": []
}
```

2. Create `scripts/split-main-rs.mjs` with exactly this content:

```js
// Moves the code of src-tauri/src/main.rs into exec.rs, allow.rs, colima.rs, compose.rs, kube.rs, system.rs and
// tools.rs. It moves code; it does not rewrite it. The only changes it makes are these four:
//   1. `pub(crate)` (`pub` for a #[tauri::command]) in front of a moved item, so other files can use it;
//   2. each new file gets the `use` lines its code needs;
//   3. `crate::name` and `use crate::{...}` in engine.rs, desktop.rs and setup.rs point at the file that now holds name;
//   4. the handler list in main.rs gets a `file::` in front of each moved command.
// Run from the repo root:  node scripts/split-main-rs.mjs          (writes the files, then runs cargo fmt)
//                          node scripts/split-main-rs.mjs --plan   (prints where every item goes, writes nothing)
// It stops, writing nothing, when an item or a test has no home.
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const SRC = "src-tauri/src";
const PLAN = process.argv.includes("--plan");
const HOMES = JSON.parse(fs.readFileSync(new URL("./split-main-rs.homes.json", import.meta.url), "utf8"));

const read = (f) => fs.readFileSync(`${SRC}/${f}`, "utf8");
const main = read("main.rs").split("\n");

// ---------- parse a file into blocks: leading comments and attributes, then one item ----------
const ITEM = /^(?:pub(?:\([a-z]+\))?\s+)?(?:async\s+)?(?:unsafe\s+)?(fn|const|static|struct|enum|impl|mod|type|use|trait)\b\s*([A-Za-z_][A-Za-z0-9_]*)?/;
const endsWith = (l, chars) => chars.some((c) => l.trimEnd().endsWith(c));

function blocksOf(lines, indent) {
  const pad = " ".repeat(indent);
  const blocks = [];
  const inner = [];
  let pending = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const atLevel = line.startsWith(pad) && !/^\s/.test(line.slice(indent));
    const body = line.slice(indent);
    if (line.trim() === "") { pending.push(line); i++; continue; }
    if (atLevel && body.startsWith("#![")) { inner.push(line); i++; continue; }
    if (atLevel && (body.startsWith("//") || body.startsWith("#["))) { pending.push(line); i++; continue; }
    if (atLevel && ITEM.test(body)) {
      let k = i;
      while (k < lines.length && !endsWith(lines[k], ["{", ";", "}"])) k++;
      let end = k;
      if (lines[k].trimEnd().endsWith("{")) {
        end = k + 1;
        while (!lines[end].startsWith(pad + "}")) end++;
      }
      const m = ITEM.exec(body);
      const kind = m[1];
      let name = m[2] ?? "";
      if (kind === "impl") name = `impl ${body.replace(/^impl(<[^>]*>)?\s*/, "").replace(/\s*\{$/, "")}`;
      if (kind === "use") name = `use ${body}`;
      const lead = pending.slice();
      while (lead.length && lead[0].trim() === "") lead.shift();
      const attrs = lead.filter((l) => l.trim().startsWith("#["));
      blocks.push({
        kind, name, headerAt: lead.length,
        lines: [...lead, ...lines.slice(i, end + 1)],
        isTest: attrs.some((a) => a.includes("#[test]")),
        isCommand: attrs.some((a) => a.includes("tauri::command")),
        declOnly: !lines[k].trimEnd().endsWith("{") && lines[k].trimEnd().endsWith(";") && kind === "mod",
      });
      pending = [];
      i = end + 1;
      continue;
    }
    throw new Error(`cannot place line ${i + 1} (indent ${indent}): ${line}`);
  }
  return { blocks, inner };
}

// ---------- reading the code without its comments and strings, to find which names it uses ----------
function bare(text) {
  return text
    .replace(/(?<![\w])r(#*)"[\s\S]*?"\1/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/\/\/[^\n]*/g, "")
    .replace(/'(?:\\.|[^'\\])'/g, "''");
}
const inlineArgs = (text) => [...text.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)(?::[^}]*)?\}/g)].map((m) => m[1]);
const words = (text) => new Set([...(bare(text).match(/(?<![\w:])[A-Za-z_][A-Za-z0-9_]*/g) ?? []), ...inlineArgs(text)]);
const wordsAny = (text) => new Set(bare(text).match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []);

const { blocks: top, inner: mainInner } = blocksOf(main, 0);
const testsMod = top.find((b) => b.kind === "mod" && b.name === "tests");
const testLines = testsMod.lines.slice(testsMod.headerAt + 1, -1);
const { blocks: tests } = blocksOf(testLines, 4);

// ---------- homes ----------
const items = top.filter((b) => b !== testsMod && b.kind !== "use" && !b.declOnly && !(b.kind === "fn" && b.name === "main"));
const home = new Map(); // item name -> file
const problems = [];
for (const b of items) {
  const h = HOMES.items[b.name];
  if (!h) problems.push(`no home for item: ${b.kind} ${b.name}`);
  else home.set(b.name, h);
}
for (const n of Object.keys(HOMES.items)) if (!items.some((b) => b.name === n)) problems.push(`HOMES names an item main.rs does not have: ${n}`);

const itemNames = new Set(items.filter((b) => !["impl", "mod"].includes(b.kind)).map((b) => b.name));
const helpers = tests.filter((t) => !t.isTest && t.kind === "fn");
const testHome = new Map(); // test block -> [files]
for (const t of tests) {
  if (t.kind === "use") continue;
  if (t.isTest) {
    const forced = HOMES.tests[t.name];
    if (forced) { testHome.set(t, [forced]); continue; }
    const used = [...words(t.lines.join("\n"))].filter((w) => itemNames.has(w) || helpers.some((h) => h.name === w && false));
    // `super::name` and bare `name` both count
    const sup = [...(bare(t.lines.join("\n")).matchAll(/super::([A-Za-z_]\w*)/g))].map((m) => m[1]);
    const files = new Set([...used, ...sup].filter((w) => home.has(w)).map((w) => home.get(w)));
    if (files.size === 1) testHome.set(t, [...files]);
    else problems.push(`test needs a home (uses ${[...files].join(", ") || "nothing known"}): ${t.name}`);
  }
}
for (const n of Object.keys(HOMES.tests)) if (!tests.some((t) => t.name === n)) problems.push(`HOMES.tests names a test main.rs does not have: ${n}`);
// helpers and constants inside the tests module go to every file whose tests use them
for (const h of tests.filter((t) => !t.isTest && t.kind !== "use")) {
  const files = new Set();
  const uses_ = (txt) => (h.kind === "fn" ? new RegExp(`(?<![\\w.:])${h.name}\\s*\\(`).test(bare(txt)) : wordsAny(txt).has(h.name));
  for (const [t, fs_] of testHome) if (t.isTest && uses_(t.lines.join("\n"))) fs_.forEach((f) => files.add(f));
  for (const o of tests.filter((x) => !x.isTest && x.kind !== "use" && x !== h)) if (testHome.get(o) && uses_(o.lines.join("\n"))) testHome.get(o).forEach((f) => files.add(f));
  if (!files.size) problems.push(`test helper used by no test: ${h.name}`);
  testHome.set(h, [...files]);
}

if (PLAN) {
  const byFile = {};
  for (const [n, f] of home) (byFile[f] ??= { items: [], tests: [] }).items.push(n);
  for (const [t, fl] of testHome) for (const f of fl) (byFile[f] ??= { items: [], tests: [] }).tests.push(t.name);
  for (const f of Object.keys(byFile).sort()) console.log(`${f}: ${byFile[f].items.length} items, ${byFile[f].tests.length} tests\n  items: ${byFile[f].items.join(", ")}\n  tests: ${byFile[f].tests.join(", ")}`);
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
if (PLAN) process.exit(0);

// ---------- imports ----------
const EXTERNAL = {
  context_ok: "use crate::engine::context_ok;", Serialize: "use serde::Serialize;", Deserialize: "use serde::Deserialize;",
  BufReader: "use std::io::BufReader;", Command: "use std::process::Command;", Stdio: "use std::process::Stdio;",
  Duration: "use std::time::Duration;", Instant: "use std::time::Instant;",
  Arc: "use std::sync::Arc;", Mutex: "use std::sync::Mutex;", TryLockError: "use std::sync::TryLockError;",
  AtomicBool: "use std::sync::atomic::AtomicBool;", AtomicU64: "use std::sync::atomic::AtomicU64;", Ordering: "use std::sync::atomic::Ordering;",
};
const BY_METHOD = [
  [/\.process_group\(/, "use std::os::unix::process::CommandExt;"],
  [/\.read_to_end\(|\.bytes\(\)/, "use std::io::Read;"],
  [/\.emit\(/, "use tauri::Emitter;"],
];
function useLines(file, text) {
  const w = words(text);
  const out = new Set();
  for (const [name, line] of Object.entries(EXTERNAL)) if (w.has(name)) out.add(line);
  const b = bare(text);
  if (/(?<![\w:])setup::/.test(b)) out.add("use crate::setup;");
  for (const [re, line] of BY_METHOD) if (re.test(b)) out.add(line);
  const crate = {};
  for (const [n, f] of home) if (f !== file && w.has(n) && itemNames.has(n)) (crate[f] ??= []).push(n);
  for (const f of Object.keys(crate).sort()) out.add(`use crate::${f.replace(".rs", "")}::{${crate[f].sort().join(", ")}};`);
  return [...out].sort();
}

// ---------- visibility ----------
function exported(b) {
  const lines = b.lines.slice();
  const at = b.headerAt;
  if (/^pub\b/.test(lines[at]) || !["fn", "const", "static", "struct", "enum", "type"].includes(b.kind)) return lines;
  lines[at] = (b.isCommand ? "pub " : "pub(crate) ") + lines[at];
  return lines;
}
const rename = (text, file) => text.replace(/super::([A-Za-z_]\w*)/g, (m, n) => (home.has(n) && home.get(n) !== file ? `crate::${home.get(n).replace(".rs", "")}::${n}` : m));

// ---------- write the new files ----------
const files = new Map();
for (const b of items) {
  const f = home.get(b.name);
  if (!files.has(f)) files.set(f, { items: [], tests: [] });
  files.get(f).items.push(b);
}
for (const [t, fl] of testHome) for (const f of fl) {
  if (!files.has(f)) files.set(f, { items: [], tests: [] });
  files.get(f).tests.push(t);
}
const out = {};
for (const [f, { items: its, tests: tsts }] of files) {
  const body = its.map((b) => exported(b).join("\n")).join("\n\n");
  const uses = useLines(f, body);
  let text = `// ${HOMES.docs[f]}\n${uses.join("\n")}${uses.length ? "\n\n" : "\n"}${body}\n`;
  if (tsts.length) {
    const tbody = tsts.map((t) => rename(t.lines.join("\n"), f)).join("\n\n");
    const tuses = useLines(f, tbody).filter((l) => !uses.includes(l) || true);
    text += `\n#[cfg(test)]\nmod tests {\n    use super::*;\n${tuses.map((l) => `    ${l}`).join("\n")}\n\n${tbody}\n}\n`;
  }
  out[f] = text;
}

// ---------- the files that stay: point `crate::name` at its new file ----------
function repoint(file) {
  let t = read(file);
  t = t.replace(/use crate::\{([^}]*)\};/g, (m, list) => {
    const names = list.split(",").map((s) => s.trim()).filter(Boolean);
    const by = {};
    for (const n of names) (by[home.get(n) ?? "crate-root"] ??= []).push(n);
    return Object.keys(by).sort().map((f) => (f === "crate-root" ? `use crate::{${by[f].join(", ")}};` : `use crate::${f.replace(".rs", "")}::{${by[f].join(", ")}};`)).join("\n");
  });
  t = t.replace(/crate::([A-Za-z_]\w*)(?!::)/g, (m, n) => (home.has(n) ? `crate::${home.get(n).replace(".rs", "")}::${n}` : m));
  return t;
}
for (const f of ["engine.rs", "desktop.rs", "setup.rs"]) out[f] = repoint(f);

// ---------- main.rs ----------
const mainFn = top.find((b) => b.kind === "fn" && b.name === "main");
const handlers = mainFn.lines.join("\n").replace(/generate_handler!\[([\s\S]*?)\]/, (m, list) => `generate_handler![${list.replace(/(?<![\w:])([a-z_][a-z0-9_]*)(?![\w:])/g, (x) => (home.has(x) ? `${home.get(x).replace(".rs", "")}::${x}` : x))}]`);
const declared = top.filter((b) => b.declOnly).map((b) => b.name);
const newMods = [...new Set([...files.keys()].map((f) => f.replace(".rs", "")))];
const mods = [...new Set([...declared, ...newMods])].sort();
out["main.rs"] = `${mainInner.join("\n")}\n\n${mods.map((m) => `mod ${m};`).join("\n")}\n\n${handlers}\n`;

for (const [f, text] of Object.entries(out)) fs.writeFileSync(`${SRC}/${f}`, text);
execFileSync("cargo", ["fix", "--offline", "--allow-dirty", "--allow-no-vcs", "--all-targets"], { cwd: "src-tauri", stdio: "inherit" });
execFileSync("cargo", ["fmt"], { cwd: "src-tauri", stdio: "inherit" });
console.log(`wrote ${Object.keys(out).length} files`);
```

3. Plan the move, writing nothing: `node scripts/split-main-rs.mjs --plan`. It must exit with status 0 and print seven blocks, one per file (`allow.rs`, `colima.rs`, `compose.rs`, `exec.rs`, `kube.rs`, `system.rs`, `tools.rs`), each with `N items, M tests`. The scratch copy printed: `allow.rs: 25 items`, `colima.rs: 42`, `compose.rs: 48`, `exec.rs: 21`, `kube.rs: 3`, `system.rs: 19`, `tools.rs: 9`. Yours must be the same or higher (a higher number means a later work order added code). If it prints a line `no home for item: <name>` or `test needs a home (uses ...): <name>`, stop and report the line. Do not edit the homes file to make it pass.

4. Do the move: `node scripts/split-main-rs.mjs`. It writes the seven files, rewrites `main.rs`, `engine.rs`, `desktop.rs` and `setup.rs`, runs `cargo fix` (it removes only `use` lines that turned out unused) and `cargo fmt`. It prints `wrote 11 files`.

5. Check that code moved and did not change.
   1. `cd src-tauri && cargo test 2>&1 | grep "test result"` shows exactly **P passed**, `0 failed`, **I ignored**.
   2. `cargo test -- --list 2>/dev/null | grep ": test" | sed 's/.*:://; s/: test//' | sort > target/names.after && diff target/names.before target/names.after`: prints nothing (every test has the name it had).
   3. `items() { grep -ohE "^ *(pub(\([a-z]+\))? )?(async )?(fn|const|static|struct|enum|type) [A-Za-z_0-9]+" "$@" | sed -E 's/^ *(pub(\([a-z]+\))? )?(async )?//' | sort; }; items src/exec.rs src/allow.rs src/kube.rs src/colima.rs src/system.rs src/tools.rs src/compose.rs src/main.rs > target/items.after; diff target/items.before target/items.after | grep -c '^<'` prints `0`: no item of the old file is missing. The lines that start with `>` are test helpers copied into each file that uses them (the scratch copy: two lines `> fn args`). Any `>` line that is not a test helper: stop and report.
   4. `cargo clippy --all-targets -- -D warnings` shows no error. `cargo fmt --check` prints nothing.
   5. `wc -l < src/main.rs` prints a number under `200` (the scratch copy: 68). `wc -l src/*.rs | sort -n | tail -3` shows the biggest file; write the three biggest in the pull request file.
6. Delete the one-off tools: `git rm -f scripts/split-main-rs.mjs scripts/split-main-rs.homes.json` (they were never committed: just `rm` them if `git rm` says they are untracked). The history keeps the result.
7. Run `npm run build` once (the app still builds with the same commands), then the gate.

**Tests to write first:** none new: this work order moves tests, it adds none. The proof is step 5: the same names, the same count, the same pass.

**Not verified** (the scratch copy was a faithful copy of the plan's baseline, but it was not the real post-iteration-3 file): that `generate_handler!` accepts `pub` commands from sibling modules for every command. It does for `desktop::` today. Step 5.1 (`cargo test` compiles `main.rs`) proves it. If the compiler says a command is private, stop and report the name.

**Done when:**
1. `ls src-tauri/src` lists `allow.rs colima.rs compose.rs desktop.rs engine.rs exec.rs kube.rs main.rs setup.rs system.rs tools.rs`.
2. `wc -l < src-tauri/src/main.rs` prints a number under `200`.
3. `cd src-tauri && cargo test 2>&1 | grep "test result"` shows the same numbers as before (P passed, I ignored, `0 failed`); `diff target/names.before target/names.after` prints nothing.
4. `ls scripts/split-main-rs.mjs scripts/split-main-rs.homes.json 2>&1 | grep -c "No such file"` prints `2`.
5. `grep -c "^mod " src-tauri/src/main.rs` prints `11`.
6. The gate (`cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`, and the frontend commands).

**Pull request title** (first line of `docs/plan/iterations/pr/wo-5.2.md`): `wo-5.2: main.rs is split into one file per job, with the same tests`

---

## WO-5.3 The docs match the app

**Needs:** WO-5.2.

**Why:** the plan's task 5.3. The docs a new contributor reads first must not name a file that does not exist, and `AGENTS.md` must say where the design is.

**Read first:** `AGENTS.md`, `CHANGELOG.md` (the `## Unreleased` section made by WO-0.4), `CONTRIBUTING.md`, `README.md`, `package.json`, `.github/workflows/ci.yml`.

**Starting state:**
1. `git status --short` prints nothing.
2. `grep -n "readme-shots" AGENTS.md` prints a line that has `node scripts/readme-shots.mjs` and not `npm run preview &&` (WO-0.4 step 15 did this). If it still has `npm run preview &&`, replace it in this work order.
3. `grep -n "^## Unreleased" CHANGELOG.md` prints one line.
4. `ls scripts/check-doc-links.mjs 2>&1` says no such file.
5. `git ls-files '*.md' | grep -v "^docs/plan/" | wc -l` prints a number (the plan's baseline: 88). Most of them are notes written for the old app (`docs/*.md`, `docs/research`, `docs/superpowers`, `docs/temporary`, `CONTEXT.md`, `RESUME.md`, `TODO.md`).

**Do not touch:** `docs/plan/` (the plan and the work orders are the recipe; they name files as they were while each work order ran), the old notes of Starting state 5 (this work order does not delete or edit them; step 4 lists them for the owner).

**Steps:**

1. `AGENTS.md`. The eight UX rules stay word for word. Make exactly these changes:
   1. After the section `## UX rules (every screen, every change)` add a section:

```md
## The design

The design is `docs/plan/design/`: `openpier.css` (every colour, size and class), `mockup.html` (every screen) and the pictures in `docs/plan/design/shots/`. The rules for each screen are in `docs/plan/04-design-spec.md`. `src/ui/openpier.css` is a copy of the stylesheet, kept equal by `scripts/check-design-sync.mjs`. Change the design there first, never in a component.

Components come from `src/ui`, one file each, exported from `src/ui/index.ts`. Screens do not write `<button`, `<select`, `<table`, inline styles or colours: ESLint and `scripts/check-classes.mjs` refuse them. Lists are read with TanStack Query (`src/lib/queries.ts`): a key starts with the engine id, and an action refreshes the lists it changed.
```

   2. In `## Keep the README in step`, item 1 reads `Retake the screenshots: \`node scripts/readme-shots.mjs\``. If it still has `npm run preview &&`, change it so.
   3. In `## Test in the engine that ships`, add (if WO-0.4 did not) the line `npm run preview         # the app in a browser with a fake backend, http://localhost:4173`.
   4. Add one more command to the same code block: `npm run check:docs      # every file a doc names exists` (step 3 defines it).
2. `CHANGELOG.md`: under `## Unreleased`, after the two lines WO-0.4 wrote, add these lines (numbered, in this order; the heading becomes `## 1.0.0` in iteration 7):

```md
3. **One design.** One stylesheet, light and dark, and Settings lets you choose; the app follows your Mac by default.
4. **Every Docker, one switcher.** Colima machines, Docker Desktop, OrbStack, Rancher Desktop and Podman show up under one engine button, and the choice is remembered. OpenPier starts and stops Colima machines only. For the others it says where to start them.
5. **Settings.** General, Machines, Engines, Updates and About. Machines is called Machines everywhere (it was Profiles) and shows only when Colima is installed. Engines lists every Docker on the Mac.
6. **The Doctor checks what applies.** On Docker Desktop or OrbStack it does not check VM memory, shared folders or name lookup, which only exist in a Colima machine.
7. **Every page has an address.** Back and forward work, and the window opens on the page you left.
8. **Lists keep what they know.** A list refreshes in the background, never goes blank to refresh, and keeps the last good rows when a refresh fails.
9. **Removed.** The dev environments (Lima), the AI chat panel and the onboarding tour are gone.
```

   Not verified: that items 3 to 9 are all true at the end of iteration 4 (items 3 and 7 come from iterations 1 to 3). Read the acceptance files of those iterations; delete any line whose feature is not in the app. Do not add a line for something that is not built.
3. Create `scripts/check-doc-links.mjs` and `scripts/doc-links.json`.

   `scripts/doc-links.json` (what is checked and what is history):

```json
{
  "check": ["README.md", "AGENTS.md", "CONTRIBUTING.md", ".github/**/*.md", "scripts/*.md"],
  "changelogSection": "## Unreleased",
  "history": ["CONTEXT.md", "RESUME.md", "TODO.md", "docs/*.md", "docs/research/**", "docs/superpowers/**", "docs/temporary/**", "docs/plan/**"],
  "skipPathStarts": ["~", "/", "$", "<", "{", "http", "dist/", "node_modules/", "target/", ".git/"],
  "pathExtensions": ["md", "ts", "tsx", "rs", "json", "mjs", "js", "sh", "css", "yml", "yaml", "html", "toml", "png", "svg", "plist", "icns", "lock"]
}
```

   `scripts/check-doc-links.mjs`:

```js
// Every file path a doc names in backticks must exist. Checks the docs a reader sees first (scripts/doc-links.json "check"
// and the Unreleased part of CHANGELOG.md). Notes written for the old app are listed under "history" and not checked.
// node scripts/check-doc-links.mjs            checks the repo
// node scripts/check-doc-links.mjs --self-test proves the check catches a missing path
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "scripts/doc-links.json"), "utf8"));

const globToRe = (g) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*") + "$");
const wanted = cfg.check.map(globToRe);
const history = cfg.history.map(globToRe);

// The paths a text names in backticks: each word inside a backtick span that looks like a file in this repo.
export function pathsIn(text) {
  const out = new Set();
  for (const span of text.matchAll(/`([^`\n]+)`/g)) {
    for (let word of span[1].split(/\s+/)) {
      word = word.replace(/[,.;:)]+$/, "").replace(/#.*$/, "").replace(/:\d+(-\d+)?$/, "");
      if (!word || cfg.skipPathStarts.some((s) => word.startsWith(s))) continue;
      if (/[*<>{}$=]/.test(word) || word.includes("://") || word.startsWith("--")) continue;
      const ext = word.includes(".") ? word.split(".").pop() : "";
      if (word.includes("/") || cfg.pathExtensions.includes(ext)) {
        if (word.includes("/") || /^[\w-]+\.[a-z]+$/.test(word)) out.add(word);
      }
    }
  }
  return [...out];
}

export const missingIn = (text, exists) => pathsIn(text).filter((p) => !exists(p));

const section = (md, heading) => {
  const start = md.indexOf(`\n${heading}`);
  if (start < 0) return "";
  const rest = md.slice(start + heading.length + 1);
  const next = rest.search(/\n## /);
  return next < 0 ? rest : rest.slice(0, next);
};

if (process.argv.includes("--self-test")) {
  const bad = missingIn("See `src/does-not-exist.ts` and `package.json` and `npm run check`.", (p) => p === "package.json");
  const ok = bad.length === 1 && bad[0] === "src/does-not-exist.ts";
  console.log(ok ? "ok" : "FAIL", "doc-links: a path that does not exist is caught, an existing one and a command are not");
  process.exit(ok ? 0 : 1);
}

const tracked = execFileSync("git", ["ls-files", "*.md"], { cwd: root }).toString().trim().split("\n").filter(Boolean);
let failed = 0, checked = 0;
for (const file of tracked) {
  if (history.some((re) => re.test(file))) continue;
  const isChangelog = file === "CHANGELOG.md";
  if (!isChangelog && !wanted.some((re) => re.test(file))) continue;
  const md = fs.readFileSync(path.join(root, file), "utf8");
  const text = isChangelog ? section(md, cfg.changelogSection) : md;
  checked++;
  const exists = (p) => fs.existsSync(path.join(root, p)) || fs.existsSync(path.join(root, path.dirname(file), p));
  for (const p of missingIn(text, exists)) { console.log("FAIL", `doc-links: ${file} names ${p} and it does not exist`); failed++; }
}
console.log(failed ? "FAIL" : "ok", `doc-links: ${checked} docs checked, ${failed} missing paths`);
process.exit(failed ? 1 : 0);
```

   Add to `package.json` scripts: `"check:docs": "node scripts/check-doc-links.mjs"`. In `.github/workflows/ci.yml`, find the step that runs `npm run lint` and add after it a step with the same indentation and keys: `name: Docs name only files that exist` and `run: npm run check:docs`.
4. Run `node scripts/check-doc-links.mjs --self-test` (prints `ok`), then `node scripts/check-doc-links.mjs`. Fix each `FAIL` line by editing the doc: point the mention at the file that exists now, or delete the sentence when the thing is gone. Do not add a path to `history` or to `skipPathStarts` to make it pass. Write in the pull request file the list of `history` files (Starting state 5): "written for the old app, not checked, for the owner to archive or delete". Do not delete any of them.
5. Run `npm run check:docs`, then the gate.

**Tests to write first:** `node scripts/check-doc-links.mjs --self-test` is the test of the checker; write `scripts/check-doc-links.mjs` and run it before step 1 and step 2, so it fails on the unfixed docs and passes after (paste both outputs in the pull request file).

**Done when:**
1. `node scripts/check-doc-links.mjs --self-test` prints `ok doc-links: ...`; `node scripts/check-doc-links.mjs | tail -1` starts with `ok`.
2. `grep -c "docs/plan/design/" AGENTS.md` prints at least `2`; `grep -c "node scripts/readme-shots.mjs" AGENTS.md` prints at least `1`; `grep -c "npm run preview &&" AGENTS.md` prints `0`.
3. `sed -n '/^## Unreleased/,/^## [^U]/p' CHANGELOG.md | grep -c "^[0-9]"` prints at least `7`.
4. The eight UX rules of `AGENTS.md` are unchanged: `git diff main -- AGENTS.md | grep "^-" | grep -c "^-[0-9]\."` prints `0`.
5. `grep -c "check:docs" package.json .github/workflows/ci.yml` prints at least `1` for each file.
6. The gate.

**Pull request title** (first line of `docs/plan/iterations/pr/wo-5.3.md`): `wo-5.3: The docs name only files that exist, and say where the design is`
