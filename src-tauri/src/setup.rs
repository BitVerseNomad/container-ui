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
    // Whether TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE reaches new terminals: set here, or in the shell's profile.
    testcontainers_override: bool,
    // The shell profile the fix edits, as ~/..., so the confirm can name it before the click.
    shell_profile: String,
    docker_desktop_installed: bool,
    // Docker Desktop's VM disk is still on the Mac, even when the app and its context are gone.
    docker_desktop_data: bool,
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

// One `key=value` entry of a .properties file, read the way java.util.Properties reads it: "=", ":" or white space
// ends the key, a line ending in an odd number of "\" goes on to the next line, and "#" or "!" starts a comment.
// `lines` is how many lines of the file the entry takes, so an edit can replace all of them.
struct Entry {
    key: String,
    value: String,
    lines: usize,
}

fn entries(props: &str) -> Vec<Option<Entry>> {
    let raw: Vec<&str> = props.lines().collect();
    let mut out = Vec::new();
    let mut i = 0;
    while i < raw.len() {
        let mut text = raw[i].trim_start().to_string();
        let mut lines = 1;
        let comment = text.is_empty() || text.starts_with('#') || text.starts_with('!');
        while !comment && (text.len() - text.trim_end_matches('\\').len()) % 2 == 1 && i + lines < raw.len() {
            text.pop();
            text.push_str(raw[i + lines].trim_start());
            lines += 1;
        }
        if comment {
            out.push(None);
        } else {
            let mut key = String::new();
            let mut rest = "";
            let mut chars = text.char_indices();
            while let Some((at, ch)) = chars.next() {
                if ch == '\\' {
                    if let Some((_, next)) = chars.next() {
                        key.push(next);
                    }
                } else if ch == '=' || ch == ':' || ch.is_whitespace() {
                    let after = text[at..].trim_start();
                    rest = after.strip_prefix(['=', ':']).unwrap_or(after).trim_start();
                    break;
                } else {
                    key.push(ch);
                }
            }
            out.push(Some(Entry { key, value: rest.replace("\\:", ":").replace("\\=", "=").trim_end().to_string(), lines }));
            for _ in 1..lines {
                out.push(None);
            }
        }
        i += lines;
    }
    out
}

// Java keeps the last value when a key is set twice, so the report shows that one.
fn property(props: &str, key: &str) -> Option<String> {
    entries(props).into_iter().flatten().filter(|e| e.key == key).last().map(|e| e.value)
}

pub fn parse_testcontainers_host(props: &str) -> Option<String> {
    property(props, "docker.host")
}

// Testcontainers reads the socket override only from the environment, so the fix puts it in the login shell's
// profile. fish has its own syntax; zsh is the macOS default.
const TC_OVERRIDE: &str = "TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE";
const TC_MARK: &str = "# Added by Colima UI (Testcontainers)";

// The file the login shell really reads. A login bash reads only the first of these that exists, so a new
// .bash_profile would hide a ~/.profile. zsh reads .zshrc from ZDOTDIR when .zshenv sets it.
pub fn shell_profile() -> (PathBuf, bool) {
    let shell = std::env::var("SHELL").unwrap_or_default();
    match shell.rsplit('/').next().unwrap_or("") {
        "fish" => (home().join(".config/fish/config.fish"), true),
        "bash" => ([".bash_profile", ".bash_login", ".profile"].iter().map(|f| home().join(f)).find(|p| p.exists()).unwrap_or_else(|| home().join(".bash_profile")), false),
        _ => (zdotdir().join(".zshrc"), false),
    }
}

// ~/.zshenv may print (nvm, direnv), so only the last line counts, and only when it is a folder that exists.
// Asked once per app start: the setup check polls every minute and a slow .zshenv would slow every poll.
fn zdotdir() -> PathBuf {
    static DIR: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();
    DIR.get_or_init(|| output("zsh", &["-c", "print -r -- ${ZDOTDIR:-$HOME}"]).as_deref().and_then(last_dir).unwrap_or_else(home)).clone()
}

pub fn last_dir(out: &str) -> Option<PathBuf> {
    out.lines().map(str::trim).filter(|l| !l.is_empty()).last().map(PathBuf::from).filter(|p| p.is_absolute() && p.is_dir())
}

// Only a line that sets it to the socket inside the VM counts; `unset`, `echo $...` or another value don't.
pub fn has_override(profile_text: &str) -> bool {
    let sh = format!("{TC_OVERRIDE}=");
    profile_text.lines().map(str::trim).any(|l| {
        let l = l.strip_prefix("export ").map(str::trim_start).unwrap_or(l);
        let fish = l.strip_prefix("set ").and_then(|r| r.trim_start().strip_prefix("-gx ")).and_then(|r| r.trim_start().strip_prefix(TC_OVERRIDE)).map(str::trim_start);
        let value = l.strip_prefix(&sh).or(fish).map(|v| v.trim_matches(|c| c == '"' || c == '\''));
        value == Some("/var/run/docker.sock")
    })
}

pub fn add_override(profile_text: &str, fish: bool) -> String {
    let line = if fish { format!("set -gx {TC_OVERRIDE} /var/run/docker.sock") } else { format!("export {TC_OVERRIDE}=/var/run/docker.sock") };
    let sep = if profile_text.is_empty() || profile_text.ends_with('\n') { "" } else { "\n" };
    format!("{profile_text}{sep}\n{TC_MARK}\n{line}\n")
}

// A brand-new .bash_profile is the one bash file read at login, so it brings ~/.profile along.
fn new_bash_profile(rc: &Path) -> &'static str {
    if rc.ends_with(".bash_profile") && !rc.exists() && home().join(".profile").exists() { "[ -f ~/.profile ] && . ~/.profile\n" } else { "" }
}

const TC_STRATEGY: &str = "org.testcontainers.dockerclient.EnvironmentAndSystemPropertyClientProviderStrategy";

// Points ~/.testcontainers.properties at `socket`. Testcontainers only reads docker.host from this file under the
// environment strategy, so that key is set too. Every other line, comments included, stays where it was; an entry
// split over several lines is replaced whole.
pub fn point_testcontainers(props: &str, socket: &str) -> String {
    let wanted = [("docker.host", format!("unix\\://{socket}")), ("docker.client.strategy", TC_STRATEGY.to_string())];
    let raw: Vec<&str> = props.lines().collect();
    let mut seen = [false; 2];
    let mut out: Vec<String> = Vec::new();
    let mut skip = 0;
    for (line, entry) in raw.iter().zip(entries(props)) {
        if skip > 0 {
            skip -= 1;
            continue;
        }
        match entry.and_then(|e| wanted.iter().position(|(k, _)| *k == e.key).map(|i| (i, e.lines))) {
            Some((i, lines)) => {
                skip = lines - 1;
                // Set once, where the first copy was; later copies would win in Java, so they go.
                if !seen[i] {
                    out.push(format!("{}={}", wanted[i].0, wanted[i].1));
                }
                seen[i] = true;
            }
            None => out.push(line.to_string()),
        }
    }
    for (i, (key, value)) in wanted.iter().enumerate() {
        if !seen[i] {
            out.push(format!("{key}={value}"));
        }
    }
    out.join("\n") + "\n"
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
        shell_profile: shell_profile().0.display().to_string().replacen(&home().display().to_string(), "~", 1),
        testcontainers_override: std::env::var(TC_OVERRIDE).map_or(false, |v| v == "/var/run/docker.sock") || std::fs::read_to_string(shell_profile().0).map_or(false, |t| has_override(&t)),
        docker_desktop_installed: Path::new(DESKTOP_APP).exists(),
        docker_desktop_data: home().join(crate::desktop::DESKTOP_DISK).exists(),
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
        let mut name = path.file_name().unwrap_or_default().to_os_string();
        name.push(format!(".{kind}-{stamp}-{n}"));
        let candidate = path.with_file_name(name);
        if !candidate.exists() {
            return candidate;
        }
    }
}

// Backs the old file up (when there is one), then replaces it in one step: the new text goes to a temp file in
// the same folder and is renamed over the original, so a crash never leaves a half-written config.
// Returns where the backup went, or None when there was nothing to back up.
fn backup_and_write(path: &Path, config: &Value) -> Result<Option<String>, String> {
    // Docker writes this file with tabs; keep it that way so diffs stay small.
    let mut buf = Vec::new();
    let fmt = serde_json::ser::PrettyFormatter::with_indent(b"\t");
    let mut ser = serde_json::Serializer::with_formatter(&mut buf, fmt);
    serde::Serialize::serialize(config, &mut ser).map_err(|e| e.to_string())?;
    backup_and_write_bytes(path, &buf)
}

fn backup_and_write_bytes(path: &Path, buf: &[u8]) -> Result<Option<String>, String> {
    // A dotfiles setup links the file into a repo; writing through the link keeps the link and updates the repo copy.
    let real = std::fs::symlink_metadata(path).ok().filter(|m| m.file_type().is_symlink()).and_then(|_| std::fs::canonicalize(path).ok());
    let path = real.as_deref().unwrap_or(path);
    let backup = path.exists().then(|| unique_sibling(path, "bak"));
    if let Some(b) = &backup {
        std::fs::copy(path, b).map_err(|e| format!("Could not back up {}: {e}", path.display()))?;
    }
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    }
    let tmp = unique_sibling(path, "tmp");
    let write = || -> std::io::Result<()> {
        std::fs::write(&tmp, buf)?;
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
    backup.map_or(String::new(), |b| format!(" Backup: {b}."))
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
            let mut done = vec![format!("Removed {} broken Docker Desktop link{}.", dead.len(), if dead.len() == 1 { "" } else { "s" })];
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
            run("docker", &["context", "use", &ctx]).map(|_| if ctx == "colima" { "docker now uses Colima.".into() } else { format!("docker now uses Colima ({ctx}).") })
        }
        "testcontainers" => {
            if !crate::profile_name_ok(profile) {
                return Err(format!("Invalid profile name: \"{profile}\""));
            }
            let socket = home().join(format!(".colima/{profile}/docker.sock"));
            if !socket.exists() {
                return Err(format!("Colima's socket isn't at {}. Start the {profile} VM, then try again.", socket.display()));
            }
            let file = home().join(".testcontainers.properties");
            let old = match std::fs::read_to_string(&file) {
                Ok(t) => t,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
                Err(e) => return Err(format!("Could not read {}: {e}", file.display())),
            };
            let replaced = property(&old, "docker.client.strategy").filter(|v| v != TC_STRATEGY);
            let backup = backup_and_write_bytes(&file, point_testcontainers(&old, &socket.display().to_string()).as_bytes())?;
            let strategy = replaced.map_or(String::new(), |v| format!(" docker.client.strategy was {v}."));
            let named = if profile == "default" { String::new() } else { format!(" ({profile})") };
            let mut done = format!("Testcontainers now uses Colima{named}.{strategy}{}", backup_note(backup));
            let (rc, fish) = shell_profile();
            let text = match std::fs::read_to_string(&rc) {
                Ok(t) => t,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => new_bash_profile(&rc).to_string(),
                // The properties file is already done, so this is a partial success, not a failure.
                Err(e) => return Ok(format!("{done} {TC_OVERRIDE} was not added: {} could not be read ({e}).", rc.display())),
            };
            if !has_override(&text) {
                match backup_and_write_bytes(&rc, add_override(&text, fish).as_bytes()) {
                    Ok(backup) => done.push_str(&format!(" Added {TC_OVERRIDE} to {}.{}", rc.display(), backup_note(backup))),
                    Err(e) => done.push_str(&format!(" {TC_OVERRIDE} was not added: {e}")),
                }
            }
            Ok(done)
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
        assert_eq!(parse_testcontainers_host("docker.host=unix\\:///x.sock\n").as_deref(), Some("unix:///x.sock"));
    }

    #[test]
    fn given_the_ways_java_spells_a_key_when_read_then_each_gives_the_value_and_the_last_one_wins() {
        assert_eq!(parse_testcontainers_host("docker.host = tcp://a:1\n").as_deref(), Some("tcp://a:1"));
        assert_eq!(parse_testcontainers_host("docker.host:tcp://b\n").as_deref(), Some("tcp://b"));
        assert_eq!(parse_testcontainers_host("docker.host tcp://c\r\n").as_deref(), Some("tcp://c"));
        assert_eq!(parse_testcontainers_host("docker.host=one\ndocker.host=two\n").as_deref(), Some("two"));
        assert_eq!(parse_testcontainers_host("# docker.host=no\n! docker.host=no\n"), None);
        assert_eq!(parse_testcontainers_host("docker.host=unix\\\n   :///x.sock\n").as_deref(), Some("unix:///x.sock"));
    }

    #[test]
    fn given_a_value_split_over_lines_and_a_second_copy_when_pointed_at_colima_then_both_go_and_nothing_is_left_behind() {
        let props = "docker.host=tcp\\://x\\\n  \\:1\na=1\ndocker.host : old\n";
        let out = point_testcontainers(props, "/s.sock");
        assert_eq!(out, format!("docker.host=unix\\:///s.sock\na=1\ndocker.client.strategy={TC_STRATEGY}\n"));
    }

    #[test]
    fn given_a_shell_profile_when_the_override_is_added_then_it_is_one_marked_line_and_is_seen_next_time() {
        let out = add_override("export PATH=x", false);
        assert_eq!(out, "export PATH=x\n\n# Added by Colima UI (Testcontainers)\nexport TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock\n");
        assert!(has_override(&out));
        assert!(add_override("", true).ends_with("set -gx TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE /var/run/docker.sock\n"));
        assert!(!has_override("# export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock\n"));
        assert!(!has_override("unset TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE\n"));
        assert!(!has_override("echo $TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE\n"));
        assert!(!has_override("export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/Users/me/.colima/default/docker.sock\n"));
        assert!(has_override("TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=\"/var/run/docker.sock\"\n"));
        assert!(has_override("set -gx TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE /var/run/docker.sock\n"));
    }

    #[test]
    fn given_zshenv_prints_something_when_finding_zdotdir_then_only_a_real_folder_on_the_last_line_counts() {
        let tmp = std::env::temp_dir();
        assert_eq!(last_dir(&format!("Now using node v20\n{}\n", tmp.display())), Some(tmp.clone()));
        assert_eq!(last_dir("hi\nnot/absolute\n"), None);
        assert_eq!(last_dir("/no/such/folder/anywhere\n"), None);
        assert_eq!(last_dir(""), None);
    }

    #[cfg(unix)]
    #[test]
    fn given_the_file_is_a_symlink_when_written_then_the_link_stays_and_its_target_changes() {
        let d = scratch("link");
        let target = d.join("dotfiles.properties");
        let link = d.join(".testcontainers.properties");
        std::fs::write(&target, "docker.host=x\n").unwrap();
        std::os::unix::fs::symlink(&target, &link).unwrap();
        backup_and_write_bytes(&link, b"docker.host=y\n").unwrap();
        assert!(std::fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "docker.host=y\n");
    }

    #[test]
    fn given_properties_pointing_elsewhere_when_pointed_at_colima_then_only_the_two_keys_change() {
        let props = "# mine\ndocker.host=unix\\:///Users/me/.docker/run/docker.sock\nryuk.disabled=false\n";
        let out = point_testcontainers(props, "/Users/me/.colima/default/docker.sock");
        assert_eq!(out, format!("# mine\ndocker.host=unix\\:///Users/me/.colima/default/docker.sock\nryuk.disabled=false\ndocker.client.strategy={TC_STRATEGY}\n"));
        assert_eq!(parse_testcontainers_host(&out).as_deref(), Some("unix:///Users/me/.colima/default/docker.sock"));
    }

    #[test]
    fn given_no_properties_file_when_pointed_at_colima_then_both_keys_are_written() {
        let out = point_testcontainers("", "/s.sock");
        assert_eq!(out, format!("docker.host=unix\\:///s.sock\ndocker.client.strategy={TC_STRATEGY}\n"));
    }

    #[test]
    fn given_a_properties_file_when_backed_up_then_the_backup_sits_next_to_it_with_its_own_name() {
        let d = scratch("props");
        let f = d.join(".testcontainers.properties");
        std::fs::write(&f, "docker.host=x\n").unwrap();
        let b = backup_and_write_bytes(&f, b"docker.host=y\n").unwrap().unwrap();
        assert!(b.contains(".testcontainers.properties.bak-"));
        assert_eq!(std::fs::read_to_string(&b).unwrap(), "docker.host=x\n");
        assert_eq!(std::fs::read_to_string(&f).unwrap(), "docker.host=y\n");
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
