// Setup check: what usually breaks after moving from Docker Desktop to Colima, read from the machine,
// plus a few narrow fixes. Every fix that edits a file writes a timestamped backup next to it first.
use serde::Serialize;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};

const DESKTOP_APP: &str = "/Applications/Docker.app/";
const BREW_PLUGIN_DIRS: [&str; 2] = ["/opt/homebrew/lib/docker/cli-plugins", "/usr/local/lib/docker/cli-plugins"];

#[derive(Serialize, Debug, PartialEq)]
pub struct Plugin {
    pub name: String,
    pub target: String,
    pub broken: bool,
}

#[derive(Serialize)]
pub struct Context {
    name: String,
    current: bool,
}

#[derive(Serialize)]
pub struct SetupReport {
    plugins: Vec<Plugin>,
    brew_plugin_dir: Option<String>,
    brew_plugins: Vec<String>,
    extra_dirs: Vec<String>,
    creds_store: Option<String>,
    creds_helper_found: bool,
    contexts: Vec<Context>,
    autostart: Option<String>,
    testcontainers_host: Option<String>,
    docker_desktop_installed: bool,
}

fn home() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_default())
}

fn docker_config_path() -> PathBuf {
    home().join(".docker/config.json")
}

fn read_json(path: &Path) -> Value {
    std::fs::read_to_string(path).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or(Value::Null)
}

fn plugins_in(dir: &Path) -> Vec<Plugin> {
    let Ok(entries) = std::fs::read_dir(dir) else { return vec![] };
    let mut out: Vec<Plugin> = entries
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            let link = std::fs::read_link(e.path()).ok();
            let target = link.as_ref().map(|t| t.to_string_lossy().into_owned()).unwrap_or_default();
            // `exists` follows the link, so a dangling one reports false.
            Some(Plugin { broken: link.is_some() && !e.path().exists(), name, target })
        })
        .collect();
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

fn names_in(dir: &str) -> Vec<String> {
    let mut v: Vec<String> = std::fs::read_dir(dir)
        .map(|r| r.flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect())
        .unwrap_or_default();
    v.sort();
    v
}

// brew can sit on a lock for minutes; past this the check gives up instead of freezing the Setup screen.
const SETUP_DEADLINE: std::time::Duration = std::time::Duration::from_secs(30);

// Ok(stdout), or Err with what the command said, so a failed fix tells the user why.
fn run(bin: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new(crate::find_bin(bin));
    cmd.args(args).env("PATH", crate::path_env());
    let (ok, out, err) = crate::output_with_deadline(cmd, SETUP_DEADLINE).map_err(|e| format!("Could not run {bin}: {e}"))?;
    let err = String::from_utf8_lossy(&err).trim().to_string();
    if ok { Ok(String::from_utf8_lossy(&out).into_owned()) } else { Err(format!("{bin} {} failed{}", args.join(" "), if err.is_empty() { ".".into() } else { format!(": {err}") })) }
}

fn output(bin: &str, args: &[&str]) -> Option<String> {
    run(bin, args).ok()
}

// `docker context ls --format json` prints one object per line.
pub fn parse_contexts(out: &str) -> Vec<Context> {
    out.lines()
        .filter_map(|l| serde_json::from_str::<Value>(l).ok())
        .filter_map(|v| Some(Context { name: v["Name"].as_str()?.to_string(), current: v["Current"].as_bool().unwrap_or(false) }))
        .collect()
}

// `brew services list --json` -> the status of colima ("started", "none", "error", ...).
pub fn parse_autostart(out: &str) -> Option<String> {
    let v: Value = serde_json::from_str(out).ok()?;
    v.as_array()?.iter().find(|s| s["name"] == "colima").and_then(|s| s["status"].as_str()).map(String::from)
}

pub fn parse_testcontainers_host(props: &str) -> Option<String> {
    props.lines().find_map(|l| l.trim().strip_prefix("docker.host=").map(|v| v.trim().to_string()))
}

pub fn report() -> SetupReport {
    let config = read_json(&docker_config_path());
    let creds_store = config["credsStore"].as_str().map(String::from);
    let creds_helper_found = creds_store.as_ref().map_or(true, |s| crate::locate(&format!("docker-credential-{s}")).is_some());
    let brew_plugin_dir = BREW_PLUGIN_DIRS.iter().find(|d| Path::new(d).is_dir()).map(|d| d.to_string());
    SetupReport {
        plugins: plugins_in(&home().join(".docker/cli-plugins")),
        brew_plugins: brew_plugin_dir.as_deref().map(names_in).unwrap_or_default(),
        brew_plugin_dir,
        extra_dirs: config["cliPluginsExtraDirs"].as_array().map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect()).unwrap_or_default(),
        creds_store,
        creds_helper_found,
        contexts: output("docker", &["context", "ls", "--format", "json"]).map(|o| parse_contexts(&o)).unwrap_or_default(),
        autostart: output("brew", &["services", "list", "--json"]).and_then(|o| parse_autostart(&o)),
        testcontainers_host: std::fs::read_to_string(home().join(".testcontainers.properties")).ok().and_then(|p| parse_testcontainers_host(&p)),
        docker_desktop_installed: Path::new(DESKTOP_APP).exists(),
    }
}

// Only links that point into a Docker Desktop that is no longer there are removed.
pub fn dangling_desktop_links(plugins: &[Plugin]) -> Vec<&str> {
    plugins.iter().filter(|p| p.broken && p.target.starts_with(DESKTOP_APP)).map(|p| p.name.as_str()).collect()
}

pub fn add_extra_dir(config: &mut Value, dir: &str) -> bool {
    if !config.is_object() {
        *config = Value::Object(Default::default());
    }
    let dirs = config.as_object_mut().unwrap().entry("cliPluginsExtraDirs").or_insert_with(|| Value::Array(vec![]));
    let Some(list) = dirs.as_array_mut() else { return false };
    if list.iter().any(|v| v == dir) {
        return false;
    }
    list.push(Value::String(dir.into()));
    true
}

pub fn drop_missing_creds_store(config: &mut Value) -> bool {
    config.as_object_mut().map_or(false, |o| o.remove("credsStore").is_some())
}

// A missing file is an empty config. A file that exists but is not a JSON object is never overwritten:
// writing a fresh object over it would silently drop everything the user had in there.
fn read_config(path: &Path) -> Result<Value, String> {
    let text = match std::fs::read_to_string(path) {
        Ok(t) => t,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Value::Null),
        Err(e) => return Err(format!("Could not read {}: {e}", path.display())),
    };
    match serde_json::from_str::<Value>(&text) {
        Ok(v) if v.is_object() => Ok(v),
        _ => Err("~/.docker/config.json isn't valid JSON, so it was left as it is. Fix it by hand or move it aside.".into()),
    }
}

// Which `brew services` verb each login-service fix runs, and what to tell the user when it worked.
fn service_action(id: &str) -> Option<(&'static str, &'static str)> {
    match id {
        "autostart_on" => Some(("start", "Colima will start when you log in.")),
        "autostart_restart" => Some(("restart", "Colima's login service was restarted.")),
        "autostart_off" => Some(("stop", "Colima will no longer start at login.")),
        _ => None,
    }
}

static WRITE_SEQ: AtomicU64 = AtomicU64::new(0);

// A name next to `path` that nothing uses yet, even when two fixes run in the same second.
fn unique_sibling(path: &Path, kind: &str) -> PathBuf {
    let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    loop {
        let n = WRITE_SEQ.fetch_add(1, Ordering::Relaxed);
        let candidate = path.with_extension(format!("json.{kind}-{stamp}-{n}"));
        if !candidate.exists() {
            return candidate;
        }
    }
}

// Backs the old file up (when there is one), then replaces it in one step: the new text goes to a temp file in
// the same folder and is renamed over the original, so a crash never leaves a half-written config.
// Returns where the backup went, or None when there was nothing to back up.
fn backup_and_write(path: &Path, config: &Value) -> Result<Option<String>, String> {
    let backup = path.exists().then(|| unique_sibling(path, "bak"));
    if let Some(b) = &backup {
        std::fs::copy(path, b).map_err(|e| format!("Could not back up {}: {e}", path.display()))?;
    }
    // Docker writes this file with tabs; keep it that way so diffs stay small.
    let mut buf = Vec::new();
    let fmt = serde_json::ser::PrettyFormatter::with_indent(b"\t");
    let mut ser = serde_json::Serializer::with_formatter(&mut buf, fmt);
    serde::Serialize::serialize(config, &mut ser).map_err(|e| e.to_string())?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    }
    let tmp = unique_sibling(path, "tmp");
    let write = || -> std::io::Result<()> {
        std::fs::write(&tmp, &buf)?;
        // The config can hold credentials, so keep the original file's permissions.
        if let Ok(meta) = std::fs::metadata(path) {
            std::fs::set_permissions(&tmp, meta.permissions())?;
        }
        std::fs::rename(&tmp, path)
    };
    write().map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("Could not write {}: {e}", path.display())
    })?;
    Ok(backup.map(|b| b.display().to_string()))
}

// " Backup: <path>" when a backup was made, so the message always says where the old file went.
fn backup_note(backup: Option<String>) -> String {
    backup.map_or(String::new(), |b| format!(" Backup: {b}"))
}

pub fn fix(id: &str, profile: &str) -> Result<String, String> {
    let path = docker_config_path();
    if let Some((verb, done)) = service_action(id) {
        return run("brew", &["services", verb, "colima"]).map(|_| done.into());
    }
    match id {
        "plugins" => {
            let dir = home().join(".docker/cli-plugins");
            // Refuse before touching anything when the config cannot be edited safely.
            if BREW_PLUGIN_DIRS.iter().any(|d| Path::new(d).is_dir()) {
                read_config(&path)?;
            }
            let plugins = plugins_in(&dir);
            let dead = dangling_desktop_links(&plugins);
            for name in &dead {
                std::fs::remove_file(dir.join(name)).map_err(|e| format!("Could not remove {name}: {e}"))?;
            }
            let mut done = vec![format!("Removed {} broken Docker Desktop link(s).", dead.len())];
            if let Some(brew) = BREW_PLUGIN_DIRS.iter().find(|d| Path::new(d).is_dir()) {
                let mut config = read_config(&path)?;
                if add_extra_dir(&mut config, brew) {
                    let backup = backup_and_write(&path, &config)?;
                    done.push(format!("Added {brew} to {}.{}", path.display(), backup_note(backup)));
                }
            }
            Ok(done.join(" "))
        }
        "creds_store" => {
            let mut config = read_config(&path)?;
            let store = config["credsStore"].as_str().map(String::from).ok_or("There is no credsStore to remove.")?;
            if crate::locate(&format!("docker-credential-{store}")).is_some() {
                return Err(format!("docker-credential-{store} is installed, so the setting works; leaving it."));
            }
            drop_missing_creds_store(&mut config);
            let backup = backup_and_write(&path, &config)?;
            Ok(format!("Removed \"credsStore\": \"{store}\" from {}.{}", path.display(), backup_note(backup)))
        }
        "use_colima_context" => {
            if !crate::profile_name_ok(profile) {
                return Err(format!("Invalid profile name: \"{profile}\""));
            }
            let ctx = context_for(profile);
            run("docker", &["context", "use", &ctx]).map(|_| format!("The docker CLI now talks to Colima ({ctx})."))
        }
        _ => Err(format!("Unknown fix \"{id}\"")),
    }
}

// Colima registers a docker context per profile: "colima" for default, "colima-<name>" otherwise.
pub fn context_for(profile: &str) -> String {
    if profile == "default" { "colima".into() } else { format!("colima-{profile}") }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn given_a_profile_when_naming_its_docker_context_then_it_matches_colima() {
        assert_eq!(context_for("default"), "colima");
        assert_eq!(context_for("work"), "colima-work");
    }

    fn p(name: &str, target: &str, broken: bool) -> Plugin {
        Plugin { name: name.into(), target: target.into(), broken }
    }

    #[test]
    fn only_dangling_links_into_docker_desktop_are_removed() {
        let plugins = vec![
            p("docker-compose", "/Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose", true),
            p("docker-mcp", "/Users/me/.docker/modules/cli-plugins/docker-mcp", true),
            p("docker-buildx", "/Applications/Docker.app/Contents/Resources/cli-plugins/docker-buildx", false),
            p("docker-own", "", false),
        ];
        assert_eq!(dangling_desktop_links(&plugins), ["docker-compose"]);
    }

    #[test]
    fn extra_dir_is_added_once_and_other_keys_stay() {
        let mut c = json!({ "auths": {}, "currentContext": "colima" });
        assert!(add_extra_dir(&mut c, "/opt/homebrew/lib/docker/cli-plugins"));
        assert!(!add_extra_dir(&mut c, "/opt/homebrew/lib/docker/cli-plugins"));
        assert_eq!(c["cliPluginsExtraDirs"], json!(["/opt/homebrew/lib/docker/cli-plugins"]));
        assert_eq!(c["currentContext"], "colima");
    }

    #[test]
    fn extra_dir_on_a_missing_config_creates_one() {
        let mut c = Value::Null;
        assert!(add_extra_dir(&mut c, "/x"));
        assert_eq!(c, json!({ "cliPluginsExtraDirs": ["/x"] }));
    }

    #[test]
    fn creds_store_is_dropped_but_cred_helpers_stay() {
        let mut c = json!({ "credsStore": "desktop", "credHelpers": { "1.dkr.ecr.us-east-1.amazonaws.com": "ecr-login" } });
        assert!(drop_missing_creds_store(&mut c));
        assert_eq!(c, json!({ "credHelpers": { "1.dkr.ecr.us-east-1.amazonaws.com": "ecr-login" } }));
    }

    #[test]
    fn contexts_parse_from_docker_json_lines() {
        let out = "{\"Current\":true,\"Name\":\"colima\"}\n{\"Current\":false,\"Name\":\"desktop-linux\"}\n";
        let c = parse_contexts(out);
        assert_eq!(c.iter().map(|c| (c.name.as_str(), c.current)).collect::<Vec<_>>(), [("colima", true), ("desktop-linux", false)]);
    }

    #[test]
    fn autostart_reads_colima_from_brew_services() {
        let out = r#"[{"name":"postgresql@16","status":"started"},{"name":"colima","status":"none","user":null}]"#;
        assert_eq!(parse_autostart(out).as_deref(), Some("none"));
        assert_eq!(parse_autostart("[]"), None);
    }


    fn scratch(name: &str) -> PathBuf {
        let n = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let d = std::env::temp_dir().join(format!("colima-ui-{name}-{}-{n}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn given_a_config_that_is_not_json_when_read_then_the_fix_is_refused_and_the_file_is_untouched() {
        let d = scratch("badjson");
        let f = d.join("config.json");
        std::fs::write(&f, "{ \"auths\": {, }").unwrap();
        let e = read_config(&f).unwrap_err();
        assert_eq!(e, "~/.docker/config.json isn't valid JSON, so it was left as it is. Fix it by hand or move it aside.");
        assert_eq!(std::fs::read_to_string(&f).unwrap(), "{ \"auths\": {, }");
        std::fs::write(&f, "[1, 2]").unwrap();
        assert!(read_config(&f).is_err());
    }

    #[test]
    fn given_a_missing_or_valid_config_when_read_then_it_is_accepted() {
        let d = scratch("okjson");
        assert_eq!(read_config(&d.join("none.json")), Ok(Value::Null));
        let f = d.join("config.json");
        std::fs::write(&f, "{\"auths\":{}}").unwrap();
        assert_eq!(read_config(&f), Ok(json!({ "auths": {} })));
    }

    #[test]
    fn given_two_writes_in_the_same_second_when_backed_up_then_both_backups_exist_and_differ() {
        let d = scratch("backup");
        let f = d.join("config.json");
        std::fs::write(&f, "{\"v\":1}").unwrap();
        let b1 = backup_and_write(&f, &json!({ "v": 2 })).unwrap().unwrap();
        let b2 = backup_and_write(&f, &json!({ "v": 3 })).unwrap().unwrap();
        assert_ne!(b1, b2);
        assert_eq!(std::fs::read_to_string(&b1).unwrap(), "{\"v\":1}");
        assert!(std::fs::read_to_string(&b2).unwrap().contains("\"v\": 2"));
        assert!(std::fs::read_to_string(&f).unwrap().contains("3"));
    }

    #[test]
    fn given_a_write_when_it_finishes_then_no_temp_file_is_left_and_the_file_is_tab_indented() {
        let d = scratch("atomic");
        let f = d.join("config.json");
        assert_eq!(backup_and_write(&f, &json!({ "a": 1 })), Ok(None));
        assert_eq!(std::fs::read_to_string(&f).unwrap(), "{\n\t\"a\": 1\n}");
        let names: Vec<String> = std::fs::read_dir(&d).unwrap().flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect();
        assert_eq!(names, ["config.json"]);
    }

    #[test]
    fn given_the_autostart_fix_ids_when_looked_up_then_each_runs_its_own_brew_service_verb() {
        assert_eq!(service_action("autostart_on").map(|a| a.0), Some("start"));
        assert_eq!(service_action("autostart_restart").map(|a| a.0), Some("restart"));
        assert_eq!(service_action("autostart_off").map(|a| a.0), Some("stop"));
        assert_eq!(service_action("autostart_nope"), None);
        assert_eq!(service_action("plugins"), None);
    }

    #[test]
    fn testcontainers_host_is_read_from_properties() {
        assert_eq!(parse_testcontainers_host("#c\ndocker.host=unix:///x.sock\n").as_deref(), Some("unix:///x.sock"));
        assert_eq!(parse_testcontainers_host("docker.client.strategy=Unix\n"), None);
    }
}

#[cfg(test)]
mod live {
    // `cargo test live_report -- --ignored --nocapture` prints this machine's report.
    #[test]
    #[ignore]
    fn live_report() {
        println!("{}", serde_json::to_string_pretty(&super::report()).unwrap());
    }
}
