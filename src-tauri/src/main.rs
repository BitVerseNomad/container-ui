#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::io::{BufReader, Read};
use std::process::{Command, Stdio};
use tauri::Emitter;

#[derive(Serialize, Deserialize)]
struct Profile {
    name: String,
    status: String,
    arch: String,
    cpus: u32,
    memory: u64,
    disk: u64,
    runtime: String,
    #[serde(default)]
    address: String,
}

// Every field except `name` is optional: only the values that are set become flags,
// so Colima keeps its saved settings for everything else.
#[derive(Deserialize)]
struct StartOpts {
    name: String,
    cpus: Option<u32>,
    memory: Option<u32>,
    disk: Option<u32>,
    runtime: Option<String>,
    kubernetes: Option<bool>,
}

fn start_args(o: &StartOpts) -> Vec<String> {
    let mut a = vec!["start".to_string(), o.name.clone()];
    if let Some(v) = o.cpus {
        a.extend(["--cpu".into(), v.to_string()]);
    }
    if let Some(v) = o.memory {
        a.extend(["--memory".into(), v.to_string()]);
    }
    if let Some(v) = o.disk {
        a.extend(["--disk".into(), v.to_string()]);
    }
    if let Some(v) = &o.runtime {
        a.extend(["--runtime".into(), v.clone()]);
    }
    if o.kubernetes == Some(true) {
        a.push("--kubernetes".into());
    }
    a
}

// Names and image refs go straight onto a command line, so never let them look like flags.
fn safe(s: &str) -> Result<(), String> {
    if s.trim().is_empty() || s.starts_with('-') {
        Err(format!("Invalid name: \"{s}\""))
    } else {
        Ok(())
    }
}

// The page can only ask for the docker commands the app itself uses. Anything else (exec, cp, build,
// login, prune of volumes...) is refused here, so a compromised page cannot do more than the UI can.
const DOCKER_SUBCOMMANDS: &[&str] =
    &["ps", "images", "search", "logs", "inspect", "stats", "start", "stop", "restart", "pause", "unpause", "rm", "rmi", "run"];

fn docker_args_allowed(args: &[String]) -> Result<(), String> {
    let first = args.first().map(String::as_str).unwrap_or("");
    let second = args.get(1).map(String::as_str).unwrap_or("");
    let ok = match first {
        "volume" => matches!(second, "ls" | "rm"),
        "image" => matches!(second, "inspect" | "prune"),
        "system" => second == "df",
        "network" => matches!(second, "ls" | "create" | "inspect" | "connect" | "disconnect" | "rm"),
        "events" => events_args_ok(args),
        other => DOCKER_SUBCOMMANDS.contains(&other),
    };
    if !ok {
        return Err(format!("\"docker {}\" is not available from the app", args.join(" ")));
    }
    if first == "run" {
        for (i, a) in args.iter().enumerate() {
            let flag = a.split('=').next().unwrap_or("");
            let risky = matches!(flag, "--privileged" | "--cap-add" | "--pid" | "--ipc" | "--uts" | "--userns" | "--security-opt" | "--device");
            let host_net = (flag == "--network" || flag == "--net") && (a.ends_with("=host") || args.get(i + 1).map(String::as_str) == Some("host"));
            if risky || host_net || a.contains("docker.sock") {
                return Err(format!("\"{a}\" is not allowed when running a container from the app"));
            }
        }
    }
    Ok(())
}

// ---- Connection doctor: probe from inside the client container's network namespace ----
// A throwaway helper container shares the client's network, so no tools are needed in the user's own image.
// The target and port are positional parameters ($1, $2), never part of the script text.
const PROBE_SCRIPT: &str = r#"nslookup "$1" 2>&1; echo "::dns-exit=$?"; nc -zv -w 3 "$1" "$2" 2>&1; echo "::tcp-exit=$?""#;

fn container_name_ok(n: &str) -> bool {
    let mut chars = n.chars();
    matches!(chars.next(), Some(c) if c.is_ascii_alphanumeric())
        && n.len() <= 128
        && n.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-'))
}

fn probe_inputs_ok(context: &str, from: &str, target: &str, port: u16) -> Result<(), String> {
    if !context_ok(context) {
        return Err(format!("Unknown Docker context \"{context}\""));
    }
    if !container_name_ok(from) || !container_name_ok(target) || port == 0 {
        return Err("That isn't a valid container name or port".into());
    }
    Ok(())
}

fn probe_args(context: &str, from: &str, target: &str, port: u16) -> Vec<String> {
    ["--context", context, "run", "--rm", "--network", &format!("container:{from}"), "nicolaka/netshoot", "sh", "-c", PROBE_SCRIPT, "sh", target, &port.to_string()]
        .iter()
        .map(|s| s.to_string())
        .collect()
}

#[tauri::command]
async fn network_probe(context: String, from: String, target: String, port: u16) -> Result<String, String> {
    probe_inputs_ok(&context, &from, &target, port)?;
    exec("docker", probe_args(&context, &from, &target, port), true).await
}

// `docker events` streams forever unless it has an end time, so it only runs with a --since and --until window
// plus the filter and format flags the app uses.
fn events_args_ok(args: &[String]) -> bool {
    let mut i = 1;
    let (mut since, mut until) = (false, false);
    while i < args.len() {
        if args.get(i + 1).is_none() {
            return false;
        }
        match args[i].as_str() {
            "--since" => since = true,
            "--until" => until = true,
            "--filter" | "--format" => {}
            _ => return false,
        }
        i += 2;
    }
    since && until
}

// ---- Kubernetes: read-only kubectl, JSON only, Colima contexts only ----
fn k8s_name_ok(n: &str) -> bool {
    let edge = |c: Option<char>| c.map_or(false, |c| c.is_ascii_lowercase() || c.is_ascii_digit());
    !n.is_empty() && n.len() <= 253 && edge(n.chars().next()) && edge(n.chars().last()) && n.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '.')
}

fn kubectl_args_allowed(args: &[String]) -> Result<(), String> {
    let w: Vec<&str> = args.iter().map(String::as_str).collect();
    let bad = || -> Result<(), String> { Err(format!("\"kubectl {}\" is not available from the app", args.join(" "))) };
    match w.as_slice() {
        ["config", "get-contexts", "-o", "name"] => Ok(()),
        ["get", res, rest @ ..] if matches!(*res, "nodes" | "namespaces" | "pods" | "deployments" | "services" | "events") => {
            let (mut i, mut json) = (0, false);
            while i < rest.len() {
                match rest[i] {
                    "-o" if rest.get(i + 1) == Some(&"json") => { json = true; i += 2; }
                    "-A" if !matches!(*res, "nodes" | "namespaces") => i += 1,
                    "-n" if rest.get(i + 1).map_or(false, |v| k8s_name_ok(v)) => i += 2,
                    _ => return bad(),
                }
            }
            if json { Ok(()) } else { bad() }
        }
        ["logs", pod, rest @ ..] if k8s_name_ok(pod) => {
            let (mut i, mut ns) = (0, false);
            while i < rest.len() {
                match rest[i] {
                    "-n" if rest.get(i + 1).map_or(false, |v| k8s_name_ok(v)) => { ns = true; i += 2; }
                    "-c" if rest.get(i + 1).map_or(false, |v| k8s_name_ok(v)) => i += 2,
                    "--tail" if rest.get(i + 1).and_then(|v| v.parse::<u32>().ok()).map_or(false, |n| (1..=2000).contains(&n)) => i += 2,
                    "--previous" => i += 1,
                    _ => return bad(),
                }
            }
            if ns { Ok(()) } else { bad() }
        }
        _ => bad(),
    }
}

#[tauri::command]
async fn kubectl(context: Option<String>, args: Vec<String>) -> Result<String, String> {
    kubectl_args_allowed(&args)?;
    let listing_contexts = args.first().map(String::as_str) == Some("config");
    let mut a: Vec<String> = Vec::new();
    match context {
        None if listing_contexts => {}
        Some(c) if !listing_contexts && context_ok(&c) => {
            a.push("--context".into());
            a.push(c);
        }
        _ => return Err("A Colima Kubernetes context is required".into()),
    }
    a.extend(args);
    exec("kubectl", a, false).await
}

// ---- Open a terminal UI (k9s) in Terminal.app; the command is fixed and must be plain text ----
fn terminal_script(command: &str) -> Option<String> {
    let plain = !command.is_empty() && command.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | '/' | '.' | '_' | '-'));
    plain.then(|| format!("tell application \"Terminal\" to do script \"{command}\""))
}

#[tauri::command]
fn open_terminal(kind: String, context: String) -> Result<(), String> {
    if kind != "k9s" {
        return Err("Only k9s can be opened from the app".into());
    }
    if !context_ok(&context) {
        return Err(format!("Unknown context \"{context}\""));
    }
    if !cfg!(target_os = "macos") {
        return Err("Opening Terminal is only supported on macOS".into());
    }
    let script = terminal_script(&format!("{} --context {}", find_bin("k9s"), context)).ok_or("That command isn't safe to open")?;
    Command::new("osascript")
        .args(["-e", &script, "-e", "tell application \"Terminal\" to activate"])
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// Colima registers "colima" (default profile) and "colima-<profile>" contexts; nothing else is used.
fn context_ok(c: &str) -> bool {
    c == "colima" || c.strip_prefix("colima-").map_or(false, |rest| !rest.is_empty() && !rest.starts_with('-'))
}

// GUI apps on macOS don't inherit the shell PATH, so look in the usual Homebrew spots.
fn find_bin(name: &str) -> String {
    ["/opt/homebrew/bin", "/usr/local/bin", "/home/linuxbrew/.linuxbrew/bin"]
        .iter()
        .map(|d| format!("{d}/{name}"))
        .find(|p| std::path::Path::new(p).exists())
        .unwrap_or_else(|| name.to_string())
}

fn path_env() -> String {
    format!("/opt/homebrew/bin:/usr/local/bin:{}", std::env::var("PATH").unwrap_or_default())
}

async fn exec(bin: &'static str, args: Vec<String>, merge_stderr: bool) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let missing = |e: std::io::Error| format!("Could not run {bin}: {e}. Is it installed?");
        let out = if merge_stderr {
            // Interleave stdout and stderr in the order the program wrote them (needed for logs).
            Command::new("sh")
                .args(["-c", "exec \"$@\" 2>&1", "sh", &find_bin(bin)])
                .args(&args)
                .env("PATH", path_env())
                .output()
                .map_err(missing)?
        } else {
            Command::new(find_bin(bin)).args(&args).env("PATH", path_env()).output().map_err(missing)?
        };
        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).into_owned())
        } else if merge_stderr {
            Err(String::from_utf8_lossy(&out.stdout).into_owned())
        } else {
            Err(String::from_utf8_lossy(&out.stderr).into_owned())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

async fn run(args: Vec<String>) -> Result<String, String> {
    exec("colima", args, false).await
}

#[tauri::command]
async fn docker(context: String, args: Vec<String>, merge_stderr: bool) -> Result<String, String> {
    if !context_ok(&context) {
        return Err(format!("Unknown Docker context \"{context}\""));
    }
    docker_args_allowed(&args)?;
    let mut a = vec!["--context".to_string(), context];
    a.extend(args);
    exec("docker", a, merge_stderr).await
}

// Splits child output into frames at \n and \r. A frame that follows a \r overwrites the previous
// line (a progress redraw), which the second field marks.
#[derive(Default)]
struct FrameSplitter {
    buf: Vec<u8>,
    replace: bool,
}

impl FrameSplitter {
    fn push(&mut self, byte: u8) -> Option<(String, bool)> {
        if byte == b'\n' || byte == b'\r' {
            let frame = self.take();
            self.replace = byte == b'\r';
            frame
        } else {
            self.buf.push(byte);
            None
        }
    }

    fn finish(&mut self) -> Option<(String, bool)> {
        self.take()
    }

    fn take(&mut self) -> Option<(String, bool)> {
        if self.buf.is_empty() {
            return None;
        }
        let text = String::from_utf8_lossy(&self.buf).into_owned();
        self.buf.clear();
        Some((text, self.replace))
    }
}

fn split_frames(bytes: &[u8]) -> Vec<(String, bool)> {
    let mut splitter = FrameSplitter::default();
    let mut out: Vec<(String, bool)> = bytes.iter().filter_map(|b| splitter.push(*b)).collect();
    out.extend(splitter.finish());
    out
}

// Replacing frames are sent with a leading \r so the UI can overwrite its last line.
fn emit_frame(app: &tauri::AppHandle, event: &str, tail: &mut Vec<String>, frame: (String, bool)) {
    let (text, replace) = frame;
    let payload = if replace { format!("\r{text}") } else { text.clone() };
    let _ = app.emit(event, payload);
    if replace && !tail.is_empty() {
        tail.pop();
    }
    tail.push(text);
    if tail.len() > 30 {
        tail.remove(0);
    }
}

// Runs a command and emits each output line as an event, so slow work (pulls, VM starts) is visible.
// On failure the last lines are returned as the error.
fn stream(app: &tauri::AppHandle, event: &str, bin: &str, args: &[String]) -> Result<(), String> {
    let mut child = Command::new("sh")
        .args(["-c", "exec \"$@\" 2>&1", "sh", &find_bin(bin)])
        .args(args)
        .env("PATH", path_env())
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Could not run {bin}: {e}. Is it installed?"))?;
    let mut tail: Vec<String> = Vec::new();
    if let Some(out) = child.stdout.take() {
        let mut splitter = FrameSplitter::default();
        for byte in BufReader::new(out).bytes().map_while(Result::ok) {
            if let Some(frame) = splitter.push(byte) {
                emit_frame(app, event, &mut tail, frame);
            }
        }
        if let Some(frame) = splitter.finish() {
            emit_frame(app, event, &mut tail, frame);
        }
    }
    let status = child.wait().map_err(|e| e.to_string())?;
    if status.success() { Ok(()) } else { Err(tail.join("\n")) }
}

async fn colima_stream(app: tauri::AppHandle, steps: Vec<Vec<String>>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        for args in &steps {
            stream(&app, "colima-progress", "colima", args)?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn docker_pull(app: tauri::AppHandle, context: String, image: String) -> Result<(), String> {
    safe(&image)?;
    if !context_ok(&context) {
        return Err(format!("Unknown Docker context \"{context}\""));
    }
    tauri::async_runtime::spawn_blocking(move || {
        stream(&app, "pull-progress", "docker", &["--context".into(), context, "pull".into(), image])
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
struct Tool {
    path: String,
    version: String,
}

#[derive(Serialize)]
struct EnvReport {
    brew: Option<Tool>,
    colima: Option<Tool>,
    docker: Option<Tool>,
    kubectl: Option<Tool>,
    k9s: Option<Tool>,
}

fn parse_version(out: &str) -> Option<String> {
    out.split(|c: char| c.is_whitespace() || c == ',')
        .map(|t| t.trim_start_matches('v'))
        .find(|t| t.chars().next().map_or(false, |c| c.is_ascii_digit()) && t.contains('.'))
        .map(|t| t.to_string())
}

// Known Homebrew locations first, then whatever PATH offers.
fn locate(bin: &str) -> Option<String> {
    let known = find_bin(bin);
    if std::path::Path::new(&known).is_absolute() && std::path::Path::new(&known).exists() {
        return Some(known);
    }
    let out = Command::new("sh")
        .args(["-c", "command -v \"$0\"", bin])
        .env("PATH", path_env())
        .output()
        .ok()?;
    let found = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if out.status.success() && !found.is_empty() { Some(found) } else { None }
}

fn tool(bin: &str) -> Option<Tool> {
    let path = locate(bin)?;
    let out = Command::new(&path).arg("--version").env("PATH", path_env()).output().ok()?;
    let version = parse_version(&String::from_utf8_lossy(&out.stdout))
        .or_else(|| parse_version(&String::from_utf8_lossy(&out.stderr)))
        .unwrap_or_default();
    Some(Tool { path, version })
}

#[tauri::command]
async fn env_check() -> Result<EnvReport, String> {
    tauri::async_runtime::spawn_blocking(|| EnvReport { brew: tool("brew"), colima: tool("colima"), docker: tool("docker"), kubectl: tool("kubectl"), k9s: tool("k9s") })
        .await
        .map_err(|e| e.to_string())
}

fn validate_install(names: &[String]) -> Result<(), String> {
    if names.is_empty() {
        return Err("Nothing to install".into());
    }
    match names.iter().find(|n| !matches!(n.as_str(), "colima" | "docker" | "kubectl" | "k9s")) {
        Some(bad) => Err(format!("Cannot install \"{bad}\" from the app")),
        None => Ok(()),
    }
}

#[tauri::command]
async fn install_tools(app: tauri::AppHandle, names: Vec<String>) -> Result<(), String> {
    validate_install(&names)?;
    let mut args = vec!["install".to_string()];
    args.extend(names);
    tauri::async_runtime::spawn_blocking(move || stream(&app, "brew-progress", "brew", &args))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn list_profiles() -> Result<Vec<Profile>, String> {
    // `colima list --json` prints one JSON object per line.
    let out = run(vec!["list".into(), "--json".into()]).await?;
    out.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| serde_json::from_str(l).map_err(|e| format!("Unexpected colima output: {e}")))
        .collect()
}

#[tauri::command]
async fn start_profile(app: tauri::AppHandle, opts: StartOpts) -> Result<(), String> {
    safe(&opts.name)?;
    colima_stream(app, vec![start_args(&opts)]).await
}

// Colima applies CPU/memory/disk changes on the next start, so a running VM is stopped first.
// If the stop fails, nothing has changed. If the start fails, the profile is left stopped.
#[tauri::command]
async fn apply_resources(app: tauri::AppHandle, opts: StartOpts, restart: bool) -> Result<(), String> {
    safe(&opts.name)?;
    let mut steps = Vec::new();
    if restart {
        steps.push(vec!["stop".to_string(), opts.name.clone()]);
    }
    steps.push(start_args(&opts));
    colima_stream(app, steps).await
}

#[tauri::command]
async fn stop_profile(app: tauri::AppHandle, name: String) -> Result<(), String> {
    safe(&name)?;
    colima_stream(app, vec![vec!["stop".into(), name]]).await
}

#[tauri::command]
async fn restart_profile(app: tauri::AppHandle, name: String) -> Result<(), String> {
    safe(&name)?;
    colima_stream(app, vec![vec!["restart".into(), name]]).await
}

#[tauri::command]
async fn delete_profile(app: tauri::AppHandle, name: String) -> Result<(), String> {
    safe(&name)?;
    colima_stream(app, vec![vec!["delete".into(), "--force".into(), name]]).await
}

// Only plain http://localhost:<port> links may be opened, so a container can't send you elsewhere.
fn localhost_url(u: &str) -> bool {
    match u.strip_prefix("http://localhost:") {
        Some(port) => !port.is_empty() && port.len() <= 5 && port.chars().all(|c| c.is_ascii_digit()),
        None => false,
    }
}

// Documentation links come from image labels, so only plain https links to a real host may be opened.
fn https_url_ok(u: &str) -> bool {
    let rest = match u.strip_prefix("https://") {
        Some(r) => r,
        None => return false,
    };
    let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
    !authority.is_empty()
        && authority.contains('.')
        && authority != "localhost"
        && authority.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
        && u.len() <= 2048
        && !u.chars().any(|c| c.is_whitespace() || c.is_control())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !localhost_url(&url) && !https_url_ok(&url) {
        return Err("Only http://localhost and https links can be opened".into());
    }
    let opener = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
    Command::new(opener).arg(&url).spawn().map(|_| ()).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_profiles, docker, docker_pull, env_check, install_tools, network_probe, kubectl, open_terminal, start_profile, apply_resources,
            stop_profile, restart_profile, delete_profile, open_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running Colima UI");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn opts(name: &str) -> StartOpts {
        StartOpts { name: name.into(), cpus: None, memory: None, disk: None, runtime: None, kubernetes: None }
    }

    #[test]
    fn bare_start_has_no_flags() {
        assert_eq!(start_args(&opts("dev")), ["start", "dev"]);
    }

    #[test]
    fn only_set_fields_become_flags() {
        let o = StartOpts { cpus: Some(4), memory: Some(8), ..opts("dev") };
        assert_eq!(start_args(&o), ["start", "dev", "--cpu", "4", "--memory", "8"]);
    }

    #[test]
    fn kubernetes_false_adds_nothing() {
        let o = StartOpts { kubernetes: Some(false), ..opts("dev") };
        assert_eq!(start_args(&o), ["start", "dev"]);
    }

    #[test]
    fn only_plain_localhost_links_open() {
        assert!(localhost_url("http://localhost:8080"));
        assert!(!localhost_url("http://localhost:"));
        assert!(!localhost_url("http://localhost:8080/admin"));
        assert!(!localhost_url("http://localhost:80@evil.com"));
        assert!(!localhost_url("https://localhost:8080"));
        assert!(!localhost_url("http://evil.com"));
        assert!(!localhost_url("http://localhost:123456"));
    }

    #[test]
    fn frames_split_on_newline() {
        assert_eq!(split_frames(b"a\nb"), vec![("a".to_string(), false), ("b".to_string(), false)]);
    }

    #[test]
    fn carriage_returns_mark_replacing_frames() {
        assert_eq!(
            split_frames(b"10%\r20%\r30%\n"),
            vec![("10%".to_string(), false), ("20%".to_string(), true), ("30%".to_string(), true)]
        );
    }

    #[test]
    fn crlf_is_one_line_break() {
        assert_eq!(split_frames(b"a\r\nb"), vec![("a".to_string(), false), ("b".to_string(), false)]);
    }

    #[test]
    fn a_trailing_progress_frame_without_newline_is_flushed() {
        assert_eq!(split_frames(b"x\r50%"), vec![("x".to_string(), false), ("50%".to_string(), true)]);
    }

    #[test]
    fn versions_are_read_from_tool_output() {
        assert_eq!(parse_version("colima version 0.8.1"), Some("0.8.1".to_string()));
        assert_eq!(parse_version("Docker version 27.3.1, build ce12230"), Some("27.3.1".to_string()));
        assert_eq!(parse_version("Homebrew 4.4.2"), Some("4.4.2".to_string()));
        assert_eq!(parse_version(""), None);
    }

    #[test]
    fn install_accepts_only_colima_and_docker() {
        assert!(validate_install(&["colima".to_string(), "docker".to_string()]).is_ok());
        assert!(validate_install(&[]).is_err());
        assert!(validate_install(&["wget".to_string()]).is_err());
        assert!(validate_install(&["--force".to_string()]).is_err());
    }

    fn args(a: &[&str]) -> Vec<String> {
        a.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn docker_allowlist_accepts_what_the_app_uses() {
        for a in [
            &["ps", "-a"][..],
            &["run", "-d", "--name", "web", "-p", "127.0.0.1:8080:80", "nginx"],
            &["volume", "ls"],
            &["volume", "rm", "data"],
            &["image", "prune", "-a", "-f"],
            &["system", "df"],
            &["rm", "-f", "abc"],
        ] {
            assert!(docker_args_allowed(&args(a)).is_ok(), "{a:?}");
        }
    }

    #[test]
    fn docker_allowlist_rejects_everything_else() {
        for a in [
            &["exec", "c", "sh"][..],
            &["cp", "c:/etc/passwd", "."],
            &["build", "."],
            &["login"],
            &["volume", "prune"],
            &["system", "prune"],
            &["--context", "other", "ps"],
            &[],
        ] {
            assert!(docker_args_allowed(&args(a)).is_err(), "{a:?}");
        }
    }

    #[test]
    fn docker_run_cannot_escalate_privileges_or_mount_the_docker_socket() {
        assert!(docker_args_allowed(&args(&["run", "--privileged", "x"])).is_err());
        assert!(docker_args_allowed(&args(&["run", "--cap-add=ALL", "x"])).is_err());
        assert!(docker_args_allowed(&args(&["run", "-v", "/var/run/docker.sock:/s", "x"])).is_err());
    }

    #[test]
    fn docker_allowlist_has_the_network_commands_the_app_uses() {
        for a in [&["network", "ls"][..], &["network", "create", "devnet"], &["network", "inspect", "devnet"], &["network", "connect", "devnet", "c"], &["network", "disconnect", "devnet", "c"], &["network", "rm", "devnet"]] {
            assert!(docker_args_allowed(&args(a)).is_ok(), "{a:?}");
        }
        assert!(docker_args_allowed(&args(&["network", "prune"])).is_err());
    }

    #[test]
    fn the_probe_runs_in_the_clients_network_with_values_passed_as_arguments() {
        let a = probe_args("colima", "kafka-ui", "kafka", 9092);
        assert!(a.contains(&"container:kafka-ui".to_string()));
        assert!(a.contains(&"nicolaka/netshoot".to_string()));
        // the target and port are positional parameters, never part of the script text
        assert_eq!(&a[a.len() - 2..], &["kafka".to_string(), "9092".to_string()]);
        assert!(!PROBE_SCRIPT.contains("kafka"));
        assert!(PROBE_SCRIPT.contains("::dns-exit=") && PROBE_SCRIPT.contains("::tcp-exit="));
    }

    #[test]
    fn probe_inputs_are_validated() {
        assert!(probe_inputs_ok("colima", "kafka-ui", "kafka", 9092).is_ok());
        assert!(probe_inputs_ok("colima-dev", "a.b_c-1", "x", 1).is_ok());
        assert!(probe_inputs_ok("default", "a", "b", 80).is_err());
        assert!(probe_inputs_ok("colima", "--rm", "b", 80).is_err());
        assert!(probe_inputs_ok("colima", "a", "b c", 80).is_err());
        assert!(probe_inputs_ok("colima", "a", "b;c", 80).is_err());
        assert!(probe_inputs_ok("colima", "a", "", 80).is_err());
        assert!(probe_inputs_ok("colima", "a", "b", 0).is_err());
    }

    #[test]
    fn docker_events_only_runs_with_both_ends_of_a_time_window() {
        let ok = ["events", "--since", "100", "--until", "200", "--filter", "type=container", "--format", "{{json .}}"];
        assert!(docker_args_allowed(&args(&ok)).is_ok());
        assert!(docker_args_allowed(&args(&["events", "--since", "100", "--until", "200"])).is_ok());
        assert!(docker_args_allowed(&args(&["events"])).is_err());
        assert!(docker_args_allowed(&args(&["events", "--since", "100"])).is_err());
        assert!(docker_args_allowed(&args(&["events", "--until", "200"])).is_err());
        assert!(docker_args_allowed(&args(&["events", "--since", "100", "--until", "200", "--foo", "x"])).is_err());
        assert!(docker_args_allowed(&args(&["events", "--since", "100", "--until"])).is_err());
    }

    #[test]
    fn docker_run_refuses_host_networking() {
        assert!(docker_args_allowed(&args(&["run", "--network", "host", "x"])).is_err());
        assert!(docker_args_allowed(&args(&["run", "--network=host", "x"])).is_err());
        assert!(docker_args_allowed(&args(&["run", "--net=host", "x"])).is_err());
        assert!(docker_args_allowed(&args(&["run", "--network", "devnet", "x"])).is_ok());
    }

    #[test]
    fn https_links_need_a_real_host_and_no_credentials() {
        assert!(https_url_ok("https://docs.docker.com/engine/network/drivers/bridge/"));
        assert!(https_url_ok("https://github.com/acme/x"));
        assert!(!https_url_ok("http://docs.docker.com"));
        assert!(!https_url_ok("https://user:pw@example.com/"));
        assert!(!https_url_ok("https://example.com@evil.com/"));
        assert!(!https_url_ok("https://localhost/"));
        assert!(!https_url_ok("https://exa mple.com/"));
        assert!(!https_url_ok("javascript:alert(1)"));
        assert!(!https_url_ok("https:///path"));
    }

    #[test]
    fn kubectl_allowlist_is_read_only_and_json() {
        for a in [
            &["config", "get-contexts", "-o", "name"][..],
            &["get", "pods", "-A", "-o", "json"],
            &["get", "nodes", "-o", "json"],
            &["get", "pods", "-n", "shop", "-o", "json"],
            &["get", "events", "-A", "-o", "json"],
            &["logs", "web-abc12", "-n", "shop", "--tail", "200"],
            &["logs", "web-abc12", "-n", "shop", "-c", "app", "--previous", "--tail", "100"],
        ] {
            assert!(kubectl_args_allowed(&args(a)).is_ok(), "{a:?}");
        }
        for a in [
            &["delete", "pod", "x"][..],
            &["exec", "x", "--", "sh"],
            &["apply", "-f", "x.yaml"],
            &["get", "secrets", "-A", "-o", "json"],
            &["get", "pods", "-A", "-o", "yaml"],
            &["get", "pods", "-A"],
            &["get", "nodes", "-A", "-o", "json"],
            &["get", "pods", "-o", "json", "--raw", "/x"],
            &["logs", "web", "--tail", "50"],
            &["logs", "web", "-n", "shop", "--tail", "99999"],
            &["logs", "Web;rm", "-n", "shop"],
            &["logs", "web", "-n", "shop", "-f"],
            &["config", "view"],
            &[],
        ] {
            assert!(kubectl_args_allowed(&args(a)).is_err(), "{a:?}");
        }
    }

    #[test]
    fn the_terminal_command_must_be_plain_text() {
        assert!(terminal_script("/opt/homebrew/bin/k9s --context colima-dev").is_some());
        for bad in ["k9s; rm -rf ~", "k9s \"x\"", "k9s $(id)", "k9s `id`", "k9s\\", "k9s && ls", ""] {
            assert!(terminal_script(bad).is_none(), "{bad}");
        }
        assert!(terminal_script("k9s --context colima").unwrap().contains("do script"));
    }

    #[test]
    fn kubectl_and_k9s_are_installable() {
        assert!(validate_install(&["kubectl".to_string(), "k9s".to_string()]).is_ok());
        assert!(validate_install(&["kubectl".to_string(), "kubectx".to_string()]).is_err());
    }

    #[test]
    fn only_colima_contexts_are_accepted() {
        assert!(context_ok("colima"));
        assert!(context_ok("colima-dev"));
        assert!(!context_ok("default"));
        assert!(!context_ok("desktop-linux"));
        assert!(!context_ok("colima-"));
        assert!(!context_ok("--host"));
    }

    #[test]
    fn rejects_flag_like_names() {
        assert!(safe("--all").is_err());
        assert!(safe("").is_err());
        assert!(safe("nginx:1.27").is_ok());
    }
}
