#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::io::{BufReader, Read};
use std::os::unix::process::CommandExt;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, TryLockError};
use std::time::{Duration, Instant};
use tauri::Emitter;

mod desktop;
mod lima;
mod setup;

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
    &["ps", "images", "search", "logs", "inspect", "stats", "start", "stop", "restart", "pause", "unpause", "rm", "rmi", "run", "rename"];

fn docker_args_allowed(args: &[String]) -> Result<(), String> {
    let first = args.first().map(String::as_str).unwrap_or("");
    let second = args.get(1).map(String::as_str).unwrap_or("");
    let ok = match first {
        // Fix turns off the old copy's restart policy while it waits aside, and puts it back if the old one returns.
        "update" => args.len() == 4 && args[1] == "--restart" && restart_policy_ok(&args[2]) && container_name_ok(&args[3]),
        "volume" => matches!(second, "ls" | "rm"),
        "image" => matches!(second, "inspect" | "prune"),
        "system" => second == "df",
        "builder" => second == "prune",
        "network" => matches!(second, "ls" | "create" | "inspect" | "connect" | "disconnect" | "rm"),
        "events" => events_args_ok(args),
        other => DOCKER_SUBCOMMANDS.contains(&other),
    };
    if !ok || (!matches!(first, "run" | "events" | "update") && !flags_ok(args)) {
        return Err(format!("\"docker {}\" is not available from the app", args.join(" ")));
    }
    // Fix replaces a container by renaming the old one aside; only two plain container names.
    if first == "rename" && !(args.len() == 3 && container_name_ok(&args[1]) && container_name_ok(&args[2])) {
        return Err(format!("\"docker {}\" is not available from the app", args.join(" ")));
    }
    if first == "run" {
        let home = std::env::var("HOME").unwrap_or_default();
        run_args_ok(args, &home)?;
    }
    Ok(())
}

// Each subcommand gets exactly the flags the app sends: (switches, flags that take a value). So no
// `logs -f` or bare `stats` holding a process open, and no `network create -d macvlan -o parent=eth0`.
fn allowed_flags(cmd: &str) -> (&'static [&'static str], &'static [&'static str]) {
    const FMT: &[&str] = &["--format"];
    match cmd {
        "ps" => (&["-a", "-q"], &["--filter", "--format"]),
        "inspect" => (&[], &["--type", "--format"]),
        "images" | "volume ls" | "image inspect" | "network ls" | "network inspect" => (&[], FMT),
        "search" => (&[], &["--limit", "--format"]),
        "logs" => (&["--timestamps"], &["--tail", "--since", "--until"]),
        "stats" => (&["--no-stream"], FMT),
        "rm" => (&["-f"], &[]),
        "image prune" => (&["-a", "-f"], &[]),
        "builder prune" => (&["-f"], &[]),
        "system df" => (&["-v"], FMT),
        _ => (&[], &[]),
    }
}

fn flags_ok(args: &[String]) -> bool {
    let grouped = matches!(args[0].as_str(), "volume" | "image" | "system" | "network" | "builder");
    let (cmd, rest) = if grouped { (format!("{} {}", args[0], args[1]), &args[2..]) } else { (args[0].clone(), &args[1..]) };
    let (switches, valued) = allowed_flags(&cmd);
    if cmd == "stats" && !rest.iter().any(|a| a == "--no-stream") {
        return false;
    }
    let mut i = 0;
    while i < rest.len() {
        let a = rest[i].as_str();
        if a.starts_with('-') {
            let name = a.split('=').next().unwrap_or(a);
            if switches.contains(&a) {
            } else if valued.contains(&name) {
                if !a.contains('=') {
                    i += 1;
                    if i >= rest.len() {
                        return false;
                    }
                }
            } else {
                return false;
            }
        }
        i += 1;
    }
    true
}

// `docker run` is accepted only in the exact shape the Run panel builds (src/runArgs.ts). A blocklist of
// risky flags always misses one (--mount, --env-file, --cidfile, -v /:/host), so this is an allowlist.
fn run_args_ok(args: &[String], home: &str) -> Result<(), String> {
    let deny = |a: &str| Err(format!("\"{a}\" is not allowed when running a container from the app"));
    if args.len() < 3 || args[0] != "run" || args[1] != "-d" {
        return deny(args.get(1).map(String::as_str).unwrap_or("run"));
    }
    let (image, opts) = (&args[args.len() - 1], &args[2..args.len() - 1]);
    let image_ok = !image.starts_with('-') && image.chars().all(|c| c.is_ascii_alphanumeric() || "._/:@-".contains(c));
    if !image_ok {
        return deny(image);
    }
    if opts.len() % 2 != 0 {
        return deny(opts.last().map(String::as_str).unwrap_or(""));
    }
    for pair in opts.chunks(2) {
        let (flag, val) = (pair[0].as_str(), pair[1].as_str());
        let ok = match flag {
            "--name" => run_name_ok(val),
            "--network" => run_name_ok(val) && val != "host" && val != "none",
            // Docker's own policies only, so a replaced container keeps the one it had.
            "--restart" => restart_policy_ok(val),
            "-p" => run_port_ok(val),
            "-v" => run_mount_ok(val, home),
            "-e" => val.split_once('=').map_or(false, |(k, _)| {
                k.chars().next().map_or(false, |c| c.is_ascii_alphabetic() || c == '_') && k.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
            }),
            _ => false,
        };
        if !ok {
            return deny(&format!("{flag} {val}"));
        }
    }
    Ok(())
}

// SRC:DST or SRC:DST:ro. No other option suffix (:rw, :z, :Z, :delegated...) is accepted.
fn run_mount_ok(val: &str, home: &str) -> bool {
    let spec = val.strip_suffix(":ro").unwrap_or(val);
    spec.split_once(':').map_or(false, |(src, dst)| run_source_ok(src, home) && dst.starts_with('/') && !dst.contains(':'))
}

fn run_name_ok(s: &str) -> bool {
    s.chars().next().map_or(false, |c| c.is_ascii_alphanumeric()) && s.chars().all(|c| c.is_ascii_alphanumeric() || "_.-".contains(c))
}

// "C", "H:C", "127.0.0.1:H:C" or "127.0.0.1::C", ports 1-65535.
fn run_port_ok(s: &str) -> bool {
    let port = |p: &str| p.parse::<u32>().map_or(false, |n| (1..=65535).contains(&n) && !p.starts_with('0'));
    match s.strip_prefix("127.0.0.1:") {
        Some(rest) => match rest.split_once(':') {
            Some(("", c)) => port(c),
            Some((h, c)) => port(h) && port(c),
            None => false,
        },
        None => match s.split_once(':') {
            Some((h, c)) => port(h) && port(c),
            None => port(s),
        },
    }
}

// A named volume, or a folder inside the Mac home that Colima shares. Never the home itself, never a
// hidden path (~/.ssh, ~/.aws, ~/.zshrc), never ~/Library (keychains, app data), never the VM's own root or /var/run.
fn run_source_ok(src: &str, home: &str) -> bool {
    if !src.starts_with('/') {
        return run_name_ok(src);
    }
    let Some(rest) = src.strip_prefix(home).and_then(|r| r.strip_prefix('/')) else { return false };
    // macOS folders are case-insensitive by default, so ~/library is ~/Library.
    let in_library = rest.split('/').next().map_or(false, |first| first.eq_ignore_ascii_case("library"));
    !home.is_empty() && !rest.is_empty() && !in_library && rest.split('/').all(|c| !c.is_empty() && !c.starts_with('.'))
}

// ---- Connection doctor: probe from inside the client container's network namespace ----
// A throwaway helper container shares the client's network, so no tools are needed in the user's own image.
// The target and port are positional parameters ($1, $2), never part of the script text.
// Pinned to a tag so the helper cannot change under the app (src/Doctor.tsx HELPER must match).
const NETSHOOT_IMAGE: &str = "nicolaka/netshoot:v0.16";
const BUSYBOX_IMAGE: &str = "busybox:1.36";
const PROBE_SCRIPT: &str = r#"nslookup "$1" 2>&1; echo "::dns-exit=$?"; nc -zv -w 3 "$1" "$2" 2>&1; echo "::tcp-exit=$?""#;

fn restart_policy_ok(val: &str) -> bool {
    matches!(val, "no" | "always" | "unless-stopped" | "on-failure") || val.strip_prefix("on-failure:").map_or(false, |n| n.parse::<u16>().is_ok())
}

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
    ["--context", context, "run", "--rm", "--network", &format!("container:{from}"), NETSHOOT_IMAGE, "sh", "-c", PROBE_SCRIPT, "sh", target, &port.to_string()]
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
    // ':' is for "container:NAME" and an image tag; it means nothing to AppleScript or the shell.
    let plain = !command.is_empty() && command.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | '/' | '.' | '_' | '-' | ':'));
    plain.then(|| format!("tell application \"Terminal\" to do script \"{command}\""))
}

// Opens Terminal.app on one fixed command: k9s for a cluster, or a shell inside a running container.
#[tauri::command]
fn open_terminal(kind: String, context: String, target: Option<String>) -> Result<(), String> {
    let command = terminal_command(&kind, &context, target.as_deref())?;
    if !cfg!(target_os = "macos") {
        return Err("Opening Terminal is only supported on macOS".into());
    }
    let script = terminal_script(&command).ok_or("That command isn't safe to open")?;
    Command::new("osascript")
        .args(["-e", &script, "-e", "tell application \"Terminal\" to activate"])
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// Homebrew's own installer line, fixed text. It asks for the person's password, so it runs in Terminal, not in the app.
const BREW_INSTALL_SCRIPT: &str = r#"tell application "Terminal" to do script "/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"""#;

#[tauri::command]
fn open_homebrew_install() -> Result<(), String> {
    if !cfg!(target_os = "macos") {
        return Err("Opening Terminal is only supported on macOS".into());
    }
    Command::new("osascript")
        .args(["-e", BREW_INSTALL_SCRIPT, "-e", "tell application \"Terminal\" to activate"])
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn terminal_command(kind: &str, context: &str, target: Option<&str>) -> Result<String, String> {
    if !context_ok(context) {
        return Err(format!("Unknown context \"{context}\""));
    }
    match (kind, target) {
        ("k9s", None) => Ok(format!("{} --context {}", find_bin("k9s"), context)),
        ("shell", Some(name)) if run_name_ok(name) => Ok(format!("{} --context {} exec -it {} sh", find_bin("docker"), context, name)),
        ("bash", Some(name)) if run_name_ok(name) => Ok(format!("{} --context {} exec -it {} bash", find_bin("docker"), context, name)),
        // A container with no shell: a throwaway busybox that shares its processes and network, removed on exit.
        ("debug", Some(name)) if run_name_ok(name) => Ok(format!("{} --context {} run --rm -it --pid container:{name} --network container:{name} --cap-add SYS_PTRACE {BUSYBOX_IMAGE} sh", find_bin("docker"), context)),
        _ => Err("Only k9s or a container shell can be opened from the app".into()),
    }
}

// Colima registers "colima" (default profile) and "colima-<profile>" contexts; nothing else is used.
// The suffix follows the profile-name rule, so a context can never smuggle a space or a flag into k9s.
fn context_ok(c: &str) -> bool {
    c == "colima" || c.strip_prefix("colima-").map_or(false, profile_name_ok)
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

// Reads finish in well under a second; `docker run` may pull first. Past this, the child is killed so a hung
// docker socket (common after the Mac sleeps) can't leave processes piling up.
const EXEC_DEADLINE: std::time::Duration = std::time::Duration::from_secs(60);
const OUTPUT_CAP: usize = 8 << 20;

fn read_capped(mut r: impl std::io::Read + Send + 'static) -> std::thread::JoinHandle<Vec<u8>> {
    std::thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = std::io::Read::take(&mut r, OUTPUT_CAP as u64).read_to_end(&mut buf);
        // drain the rest so the child never blocks on a full pipe
        let _ = std::io::copy(&mut r, &mut std::io::sink());
        buf
    })
}

// After a kill the child should be gone at once. If it is stuck (a process in uninterruptible I/O can ignore
// SIGKILL), give up after `limit` instead of waiting forever.
const KILL_WAIT: Duration = Duration::from_secs(5);

fn wait_bounded(child: &mut std::process::Child, limit: Duration) -> Option<std::process::ExitStatus> {
    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(s)) => return Some(s),
            Ok(None) if start.elapsed() < limit => std::thread::sleep(Duration::from_millis(20)),
            _ => return None,
        }
    }
}

pub(crate) fn output_with_deadline(cmd: Command, deadline: std::time::Duration) -> std::io::Result<(bool, Vec<u8>, Vec<u8>)> {
    let (status, o, mut e) = run_with_deadline(cmd, deadline)?;
    if status.is_none() {
        e.extend_from_slice(format!("\nStopped after {}s with no answer. Docker or Colima may be stuck; try restarting the VM.", deadline.as_secs()).as_bytes());
    }
    Ok((status.map_or(false, |s| s.success()), o, e))
}

// The same run, saying plainly whether it ended (Some, with its exit status) or was killed at the deadline (None),
// and adding no words of its own to stderr.
pub(crate) fn run_with_deadline(mut cmd: Command, deadline: std::time::Duration) -> std::io::Result<(Option<std::process::ExitStatus>, Vec<u8>, Vec<u8>)> {
    use std::process::Stdio;
    // Own process group, so the kill below also reaches limactl or a credential helper holding the pipes.
    let mut child = cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).process_group(0).spawn()?;
    let out = read_capped(child.stdout.take().expect("piped stdout"));
    let err = read_capped(child.stderr.take().expect("piped stderr"));
    let start = std::time::Instant::now();
    let status = loop {
        if let Some(s) = child.try_wait()? {
            break Some(s);
        }
        if start.elapsed() > deadline {
            kill_group(child.id());
            let _ = child.kill();
            let _ = wait_bounded(&mut child, KILL_WAIT);
            break None;
        }
        std::thread::sleep(std::time::Duration::from_millis(20));
    };
    Ok((status, out.join().unwrap_or_default(), err.join().unwrap_or_default()))
}

async fn exec(bin: &'static str, args: Vec<String>, merge_stderr: bool) -> Result<String, String> {
    exec_in(bin, args, merge_stderr, None).await
}

async fn exec_in(bin: &'static str, args: Vec<String>, merge_stderr: bool, cwd: Option<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let missing = |e: std::io::Error| format!("Could not run {bin}: {e}. Is it installed?");
        let mut cmd = if merge_stderr {
            // Interleave stdout and stderr in the order the program wrote them (needed for logs).
            let mut c = Command::new("sh");
            c.args(["-c", "exec \"$@\" 2>&1", "sh", &find_bin(bin)]);
            c
        } else {
            Command::new(find_bin(bin))
        };
        cmd.args(&args).env("PATH", path_env());
        if let Some(dir) = &cwd {
            cmd.current_dir(dir);
        }
        let (ok, stdout, stderr) = output_with_deadline(cmd, EXEC_DEADLINE).map_err(missing)?;
        if ok {
            Ok(String::from_utf8_lossy(&stdout).into_owned())
        } else if merge_stderr {
            Err(format!("{}{}", String::from_utf8_lossy(&stdout), String::from_utf8_lossy(&stderr)))
        } else {
            Err(String::from_utf8_lossy(&stderr).into_owned())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

async fn run(args: Vec<String>) -> Result<String, String> {
    exec("colima", args, false).await
}

async fn orb(args: Vec<String>) -> Result<String, String> {
    exec("orb", args, false).await
}

async fn orb_json(args: Vec<String>) -> Result<String, String> {
    let mut a = args;
    a.insert(0, "--format".into());
    a.insert(1, "json".into());
    exec("orb", a, false).await
}

#[tauri::command]
async fn orb_version() -> Result<String, String> {
    orb(vec!["version".into()]).await
}

#[tauri::command]
async fn colima_version() -> Result<String, String> {
    run(vec!["version".into()]).await
}

#[tauri::command]
async fn rdctl_version() -> Result<String, String> {
    exec("rdctl", vec!["version".into()], false).await
}

#[tauri::command]
async fn podman_version() -> Result<String, String> {
    let out = exec("podman", vec!["version".into(), "--format".into(), "json".into()], false).await?;
    let parsed: serde_json::Value = serde_json::from_str(&out)
        .map_err(|e| format!("Failed to parse podman version JSON: {e}"))?;
    // Podman version JSON has a "Version" field at the root or in a Client/Server object
    parsed.get("Version")
        .or_else(|| parsed.get("Client").and_then(|c| c.get("Version")))
        .or_else(|| parsed.get("Server").and_then(|s| s.get("Version")))
        .and_then(|v| v.as_str())
        .map(|v| v.to_string())
        .ok_or_else(|| "Podman version not found in output".into())
}

#[tauri::command]
async fn docker_desktop_version() -> Result<String, String> {
    let out = exec("docker", vec!["version".into(), "--format".into(), "json".into()], false).await?;
    let parsed: serde_json::Value = serde_json::from_str(&out)
        .map_err(|e| format!("Failed to parse docker version JSON: {e}"))?;
    // Check if it's Docker Desktop by looking at the Platform field
    let is_desktop = parsed.get("Server")
        .and_then(|s| s.get("Platform"))
        .and_then(|p| p.as_str())
        .map(|p| p.to_lowercase().contains("docker desktop"))
        .unwrap_or(false);
    if is_desktop {
        parsed.get("Server")
            .and_then(|s| s.get("Version"))
            .and_then(|v| v.as_str())
            .map(|v| v.to_string())
            .ok_or_else(|| "Docker Desktop version not found in output".into())
    } else {
        Err("Not Docker Desktop".into())
    }
}

#[tauri::command]
async fn orb_list_vms() -> Result<Vec<Profile>, String> {
    // `orb list --format json` prints one JSON object per line.
    let out = orb_json(vec!["list".into()]).await?;
    out.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| serde_json::from_str(l).map_err(|e| format!("Unexpected orb output: {e}")))
        .collect()
}

#[tauri::command]
async fn orb_start_vm(name: String) -> Result<(), String> {
    safe(&name)?;
    orb(vec!["start".into(), name]).await.map(|_| ())
}

#[tauri::command]
async fn orb_stop_vm(name: String) -> Result<(), String> {
    safe(&name)?;
    orb(vec!["stop".into(), name]).await.map(|_| ())
}

#[tauri::command]
async fn orb_delete_vm(name: String) -> Result<(), String> {
    safe(&name)?;
    orb(vec!["delete".into(), name]).await.map(|_| ())
}

// Fix asks this for every step before it changes anything, so a run the backend would refuse never leaves a
// container stopped halfway. Same rules as `docker`, nothing is run.
#[tauri::command]
fn docker_check(args: Vec<String>) -> Result<(), String> {
    docker_args_allowed(&args)
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
        } else if self.buf.len() < 16 << 10 {
            // A line past 16 KB (a progress bar that never ends) is cut, not kept growing forever.
            self.buf.push(byte);
            None
        } else {
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

#[cfg(test)]
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
fn kill_group(pid: u32) {
    let _ = Command::new("/bin/kill").args(["-KILL", "--", &format!("-{pid}")]).status();
}

// A start can sit quiet while the VM boots, but never this long; past it the command is stuck (common after sleep).
const STREAM_SILENCE: Duration = Duration::from_secs(600);
// The VM operation in progress, so Cancel can stop it.
static VM_OP_PID: Mutex<Option<u32>> = Mutex::new(None);
// One VM operation at a time: a delete must never land in the middle of a start.
static VM_LOCK: Mutex<()> = Mutex::new(());
// Set by Cancel while an operation runs, so a stop-then-start does not go on to start after a cancelled stop.
static VM_CANCELLED: AtomicBool = AtomicBool::new(false);

// Runs the steps in order, stopping at the first failure or once Cancel was pressed.
fn run_steps(steps: &[Vec<String>], cancelled: &AtomicBool, mut step: impl FnMut(&[String]) -> Result<(), String>) -> Result<(), String> {
    for args in steps {
        if cancelled.load(Ordering::SeqCst) {
            return Err("Cancelled.".to_string());
        }
        step(args)?;
    }
    Ok(())
}

pub fn stream(app: &tauri::AppHandle, event: &str, bin: &str, args: &[String]) -> Result<(), String> {
    stream_with(app, event, bin, args, STREAM_SILENCE, |_| {})
}

pub fn stream_with(app: &tauri::AppHandle, event: &str, bin: &str, args: &[String], silence: Duration, on_spawn: impl Fn(Option<u32>)) -> Result<(), String> {
    stream_in(app, event, bin, args, None, silence, on_spawn)
}

// cwd: the folder to run in, for commands that find their files there (docker compose).
pub fn stream_in(app: &tauri::AppHandle, event: &str, bin: &str, args: &[String], cwd: Option<&str>, silence: Duration, on_spawn: impl Fn(Option<u32>)) -> Result<(), String> {
    let mut cmd = Command::new("sh");
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    let mut child = cmd
        .args(["-c", "exec \"$@\" 2>&1", "sh", &find_bin(bin)])
        .args(args)
        .env("PATH", path_env())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .process_group(0)
        .spawn()
        .map_err(|e| format!("Could not run {bin}: {e}. Is it installed?"))?;
    let pid = child.id();
    on_spawn(Some(pid));
    let started = Instant::now();
    let last = Arc::new(AtomicU64::new(0));
    let (done, timed_out) = (Arc::new(AtomicBool::new(false)), Arc::new(AtomicBool::new(false)));
    let watchdog = {
        let (last, done, timed_out) = (last.clone(), done.clone(), timed_out.clone());
        std::thread::spawn(move || {
            while !done.load(Ordering::Relaxed) {
                std::thread::sleep(Duration::from_millis(500));
                let quiet = started.elapsed().saturating_sub(Duration::from_millis(last.load(Ordering::Relaxed)));
                if quiet > silence {
                    timed_out.store(true, Ordering::Relaxed);
                    kill_group(pid);
                    return;
                }
            }
        })
    };
    let mut tail: Vec<String> = Vec::new();
    if let Some(out) = child.stdout.take() {
        let mut splitter = FrameSplitter::default();
        for byte in BufReader::new(out).bytes().map_while(Result::ok) {
            last.store(started.elapsed().as_millis() as u64, Ordering::Relaxed);
            if let Some(frame) = splitter.push(byte) {
                emit_frame(app, event, &mut tail, frame);
            }
        }
        if let Some(frame) = splitter.finish() {
            emit_frame(app, event, &mut tail, frame);
        }
    }
    // A killed child must not hold the VM lock for ever, so after a timeout the wait is bounded.
    let stuck = timed_out.load(Ordering::Relaxed);
    let status = if stuck { Ok(wait_bounded(&mut child, KILL_WAIT)) } else { child.wait().map(Some).map_err(|e| e.to_string()) };
    done.store(true, Ordering::Relaxed);
    let _ = watchdog.join();
    on_spawn(None);
    if stuck {
        tail.push(format!("Stopped: no output for {} minutes, so it looked stuck. Try Force stop, then start.", silence.as_secs() / 60));
        return Err(tail.join("\n"));
    }
    if status?.map_or(false, |s| s.success()) { Ok(()) } else { Err(tail.join("\n")) }
}

async fn colima_stream(app: tauri::AppHandle, steps: Vec<Vec<String>>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = match VM_LOCK.try_lock() {
            Ok(g) => g,
            Err(TryLockError::Poisoned(p)) => p.into_inner(),
            Err(TryLockError::WouldBlock) => return Err("Another VM operation is still running. Wait for it to finish, or cancel it.".to_string()),
        };
        VM_CANCELLED.store(false, Ordering::SeqCst);
        let track = |pid| *VM_OP_PID.lock().unwrap_or_else(|p| p.into_inner()) = pid;
        run_steps(&steps, &VM_CANCELLED, |args| stream_with(&app, "colima-progress", "colima", args, STREAM_SILENCE, track))
    })
    .await
    .map_err(|e| e.to_string())?
}

// Stops the start/stop/delete in progress. Colima may leave a half-started VM; Force stop cleans that up.
#[tauri::command]
fn cancel_vm_op() -> bool {
    // Between two steps there is no process to kill, but the next step must still not run.
    let busy = matches!(VM_LOCK.try_lock(), Err(TryLockError::WouldBlock));
    if busy {
        VM_CANCELLED.store(true, Ordering::SeqCst);
    }
    let pid = *VM_OP_PID.lock().unwrap_or_else(|p| p.into_inner());
    pid.map(kill_group).is_some() || busy
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

#[derive(Serialize, Deserialize, Debug, Clone)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct OllamaModel {
    name: String,
    size: String,
    modified: String,
}

/// Streams chat response from Ollama via Tauri events.
/// Emits "ollama-chat-token" events for each token, then "ollama-chat-done" with the full response.
#[tauri::command]
async fn ollama_chat(app: tauri::AppHandle, model: String, messages: Vec<ChatMessage>) -> Result<String, String> {
    use std::io::BufRead;

    // Build the JSON request body
    let request_body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": true
    });

    let mut cmd = Command::new("ollama");
    cmd.arg("run")
        .arg("--format")
        .arg("json")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("PATH", path_env());

    let mut child = cmd.spawn().map_err(|e| format!("Could not run ollama: {e}. Is it installed?"))?;

    // Write request to stdin
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        stdin.write_all(request_body.to_string().as_bytes()).map_err(|e| e.to_string())?;
    }

    let mut full_response = String::new();
    let stdout = child.stdout.take().expect("piped stdout");
    let stderr = child.stderr.take().expect("piped stderr");
    let reader = BufReader::new(stdout);
    let err_reader = BufReader::new(stderr);

    // Read stdout line by line (streaming JSON)
    for line in reader.lines().map_while(Result::ok) {
        if line.trim().is_empty() {
            continue;
        }
        // Try to parse as JSON response
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
            if let Some(token) = json.get("response").and_then(|v| v.as_str()) {
                if !token.is_empty() {
                    full_response.push_str(token);
                    // Emit token event for streaming UI
                    let _ = app.emit("ollama-chat-token", token);
                }
            }
            if json.get("done").and_then(|v| v.as_bool()) == Some(true) {
                break;
            }
        }
    }

    // Drain stderr
    let err_output: String = err_reader.lines().map_while(Result::ok).collect::<Vec<_>>().join("\n");

    let status = child.wait().map_err(|e| e.to_string())?;

    if !status.success() && !err_output.is_empty() {
        return Err(err_output);
    }

    // Emit done event with full response
    let _ = app.emit("ollama-chat-done", full_response.clone());

    Ok(full_response)
}

/// Lists available Ollama models with name, size, and modified time.
#[tauri::command]
async fn ollama_list_models() -> Result<Vec<OllamaModel>, String> {
    let output = exec("ollama", vec!["list".into()], false).await?;

    let mut models = Vec::new();
    for line in output.lines().skip(1) {
        // Skip header line
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            // Format: NAME ID SIZE MODIFIED
            // We want name, size, modified
            let name = parts[0].to_string();
            let size = if parts.len() >= 3 { parts[2].to_string() } else { "unknown".to_string() };
            // Modified time is the rest
            let modified = parts[3..].join(" ");
            models.push(OllamaModel { name, size, modified });
        }
    }

    Ok(models)
}

/// Pulls an Ollama model with progress streaming.
/// Emits "ollama-pull-progress" events with progress updates.
#[tauri::command]
async fn ollama_pull(app: tauri::AppHandle, model: String) -> Result<(), String> {
    safe(&model)?;

    tauri::async_runtime::spawn_blocking(move || {
        stream(&app, "ollama-pull-progress", "ollama", &["pull".into(), model])
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
    let mut cmd = Command::new("sh");
    cmd.args(["-c", "command -v \"$0\"", bin]).env("PATH", path_env());
    let (ok, out, _) = output_with_deadline(cmd, Duration::from_secs(10)).ok()?;
    let found = String::from_utf8_lossy(&out).trim().to_string();
    if ok && !found.is_empty() { Some(found) } else { None }
}

fn tool(bin: &str) -> Option<Tool> {
    let path = locate(bin)?;
    // A hung `brew --version` (it auto-updates) must not hold the first screen; the tool still counts as found.
    let mut cmd = Command::new(&path);
    cmd.arg("--version").env("PATH", path_env());
    let (_, out, err) = output_with_deadline(cmd, Duration::from_secs(10)).unwrap_or_default();
    let version = parse_version(&String::from_utf8_lossy(&out)).or_else(|| parse_version(&String::from_utf8_lossy(&err))).unwrap_or_default();
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
    match names.iter().find(|n| !matches!(n.as_str(), "colima" | "docker" | "kubectl" | "k9s" | "docker-compose" | "docker-buildx")) {
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
    profile(&opts.name)?;
    colima_stream(app, vec![start_args(&opts)]).await
}

// Colima applies CPU/memory/disk changes on the next start, so a running VM is stopped first.
// If the stop fails, nothing has changed. If the start fails, the profile is left stopped.
#[tauri::command]
async fn apply_resources(app: tauri::AppHandle, opts: StartOpts, restart: bool) -> Result<(), String> {
    profile(&opts.name)?;
    let mut steps = Vec::new();
    if restart {
        steps.push(vec!["stop".to_string(), opts.name.clone()]);
    }
    steps.push(start_args(&opts));
    colima_stream(app, steps).await
}

// ---- Folders shared with the VM, the Mac's network, and the VM's name lookup ----
// The page reads the profile's saved settings (colima.yaml) as text and works out what is shared. Only reading here:
// the file is never written by the app, `colima start` saves it. The profile name passes the same rule as every
// other command, so the path can't leave ~/.colima.
#[derive(Serialize)]
struct ColimaConfig {
    home: String,
    yaml: String,
}

fn config_path(home: &str, name: &str) -> std::path::PathBuf {
    std::path::PathBuf::from(home).join(".colima").join(name).join("colima.yaml")
}

#[tauri::command]
fn colima_config(name: String) -> Result<ColimaConfig, String> {
    profile(&name)?;
    let home = std::env::var("HOME").unwrap_or_default();
    // A profile file is a few KB; the first 64 KB is plenty and a huge or odd file is never read whole.
    let mut yaml = String::new();
    if let Ok(f) = std::fs::File::open(config_path(&home, &name)) {
        let mut buf = Vec::new();
        let _ = f.take(64 << 10).read_to_end(&mut buf);
        yaml = String::from_utf8_lossy(&buf).into_owned();
    }
    Ok(ColimaConfig { home, yaml })
}

#[derive(Serialize)]
struct NetworkFacts {
    proxy: String,
    interfaces: String,
}

fn read_only_text(bin: &str, args: &[&str]) -> String {
    let mut cmd = Command::new(bin);
    cmd.args(args);
    match output_with_deadline(cmd, Duration::from_secs(5)) {
        Ok((true, out, _)) => String::from_utf8_lossy(&out[..out.len().min(64 << 10)]).into_owned(),
        _ => String::new(),
    }
}

// `scutil --proxy` prints the system proxy settings and `ifconfig` the interfaces. Both only read.
#[tauri::command]
async fn network_facts() -> Result<NetworkFacts, String> {
    tauri::async_runtime::spawn_blocking(|| NetworkFacts { proxy: read_only_text("/usr/sbin/scutil", &["--proxy"]), interfaces: read_only_text("/sbin/ifconfig", &[]) })
        .await
        .map_err(|e| e.to_string())
}

// The one name the check looks up: the host Docker pulls images from.
const DNS_PROBE_HOST: &str = "registry-1.docker.io";
const DNS_PROBE_DEADLINE: Duration = Duration::from_secs(25);

fn dns_probe_args(name: &str) -> Vec<String> {
    ["ssh", "--profile", name, "--", "getent", "hosts", DNS_PROBE_HOST].iter().map(|s| s.to_string()).collect()
}

// getent exits 0 with the address when the name resolves and 2 when it doesn't. Anything else (ssh couldn't connect,
// colima failed, the deadline hit) says nothing about names, so it is "unknown", never "failed".
fn dns_verdict(code: Option<i32>, stdout: &str) -> &'static str {
    match code {
        Some(0) if !stdout.trim().is_empty() => "resolved",
        Some(2) => "failed",
        _ => "unknown",
    }
}

// Asks the VM to look up one fixed name with `colima ssh -- getent hosts <name>`: read-only, nothing is created
// or changed in the VM. Skipped (unknown) while a VM operation runs, since the VM is down or busy then.
#[tauri::command]
async fn vm_dns_probe(name: String) -> Result<String, String> {
    profile(&name)?;
    tauri::async_runtime::spawn_blocking(move || {
        if matches!(VM_LOCK.try_lock(), Err(TryLockError::WouldBlock)) {
            return "unknown".to_string();
        }
        let mut cmd = Command::new(find_bin("colima"));
        cmd.args(dns_probe_args(&name)).env("PATH", path_env());
        match run_with_deadline(cmd, DNS_PROBE_DEADLINE) {
            Ok((Some(status), out, _)) => dns_verdict(status.code(), &String::from_utf8_lossy(&out)).to_string(),
            _ => "unknown".to_string(),
        }
    })
    .await
    .map_err(|e| e.to_string())
}

#[derive(Deserialize, Clone)]
struct MountSpec {
    path: String,
    writable: bool,
}

// A folder the VM may share: absolute and plain (no dots, doubled slashes, commas or quotes; Colima reads the flag as
// CSV), not the Mac's root or system folders, and never another user's. Under the home folder it is never hidden
// (~/.ssh) or ~/Library. Same rule as src/lib/mounts.ts.
fn mount_ok(path: &str, home: &str) -> bool {
    const SYSTEM: &[&str] = &["System", "usr", "bin", "sbin", "etc", "var", "Library", "Applications", "cores", "dev", "private/etc", "private/var"];
    if home.is_empty() || !path.starts_with('/') || path == "/" || path.chars().any(|c| c.is_control() || matches!(c, ',' | '"' | ':')) {
        return false;
    }
    if path.split('/').skip(1).any(|c| c.is_empty() || c == "." || c == "..") {
        return false;
    }
    let rest = &path[1..];
    if SYSTEM.iter().any(|s| rest == *s || rest.starts_with(&format!("{s}/"))) {
        return false;
    }
    if path == home {
        return true;
    }
    if let Some(inner) = path.strip_prefix(&format!("{home}/")) {
        let first = inner.split('/').next().unwrap_or("");
        return !first.to_lowercase().starts_with("library") && inner.split('/').all(|c| !c.starts_with('.'));
    }
    !path.starts_with("/Users/") && path.split('/').count() >= 3
}

// Colima refuses two folders when one path starts with the other; refused here first, before anything stops.
fn mounts_overlap(paths: &[&str]) -> bool {
    paths.iter().enumerate().any(|(i, a)| paths[i + 1..].iter().any(|b| a.starts_with(b) || b.starts_with(a)))
}

// `colima start NAME --mount PATH[:w] ...` replaces the whole list, so the page sends the full one. Every check runs
// before the VM is stopped, so a refusal changes nothing; the messages start with "Nothing changed" for that reason.
// stop: false when the VM is already stopped (Try again after a failed start).
fn mounts_steps(name: &str, mounts: &[MountSpec], home: &str, is_dir: impl Fn(&str) -> bool, stop: bool) -> Result<Vec<Vec<String>>, String> {
    if mounts.is_empty() || mounts.len() > 32 {
        return Err("Nothing changed: the list of folders to share is empty or too long.".into());
    }
    for m in mounts {
        if !mount_ok(&m.path, home) {
            return Err(format!("Nothing changed: {} can't be shared from the app.", m.path));
        }
        if !is_dir(&m.path) {
            return Err(format!("Nothing changed: {} is not a folder on this Mac, so it can't be shared.", m.path));
        }
    }
    if mounts_overlap(&mounts.iter().map(|m| m.path.as_str()).collect::<Vec<_>>()) {
        return Err("Nothing changed: Colima can't share two folders when one name starts like the other.".into());
    }
    let mut start = vec!["start".to_string(), name.to_string()];
    for m in mounts {
        start.extend(["--mount".to_string(), if m.writable { format!("{}:w", m.path) } else { m.path.clone() }]);
    }
    Ok(if stop { vec![vec!["stop".to_string(), name.to_string()], start] } else { vec![start] })
}

#[tauri::command]
async fn apply_mounts(app: tauri::AppHandle, name: String, mounts: Vec<MountSpec>, restart: Option<bool>, force: Option<bool>) -> Result<(), String> {
    profile(&name)?;
    let home = std::env::var("HOME").unwrap_or_default();
    let steps = mounts_steps(&name, &mounts, &home, |p| std::path::Path::new(p).is_dir(), restart.unwrap_or(true))?;
    colima_stream(app, if force.unwrap_or(false) { forced(steps, &name) } else { steps }).await
}

// The way back after a failed start: stop by force first (a half-up Lima instance can swallow a plain start), as
// force_restart_profile does, then the same start.
fn forced(steps: Vec<Vec<String>>, name: &str) -> Vec<Vec<String>> {
    let mut out = vec![vec!["stop".to_string(), "--force".to_string(), name.to_string()]];
    out.extend(steps.into_iter().filter(|s| s.first().map(String::as_str) != Some("stop")));
    out
}

// The VM's own environment (the Mac's proxy): `--env` replaces the saved map, so the page sends it whole. Names are
// plain variable names, values have no comma, quote or control character, and the ones that change how programs load
// code are refused.
fn env_steps(name: &str, env: &[(String, String)], stop: bool) -> Result<Vec<Vec<String>>, String> {
    if env.is_empty() || env.len() > 32 {
        return Err("Nothing changed: the list of settings is empty or too long.".into());
    }
    let mut start = vec!["start".to_string(), name.to_string()];
    for (k, v) in env {
        let key_ok = k.chars().next().map_or(false, |c| c.is_ascii_alphabetic() || c == '_') && k.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
        let risky = k.starts_with("LD_") || k.starts_with("DYLD_") || matches!(k.as_str(), "PATH" | "BASH_ENV" | "ENV" | "IFS" | "SHELL");
        if !key_ok || risky || v.len() > 512 || v.chars().any(|c| c.is_control() || matches!(c, ',' | '"')) {
            return Err(format!("Nothing changed: the setting {k} can't be passed from the app."));
        }
        start.extend(["--env".to_string(), format!("{k}={v}")]);
    }
    Ok(if stop { vec![vec!["stop".to_string(), name.to_string()], start] } else { vec![start] })
}

#[tauri::command]
async fn apply_env(app: tauri::AppHandle, name: String, env: Vec<(String, String)>, restart: Option<bool>, force: Option<bool>) -> Result<(), String> {
    profile(&name)?;
    let steps = env_steps(&name, &env, restart.unwrap_or(true))?;
    colima_stream(app, if force.unwrap_or(false) { forced(steps, &name) } else { steps }).await
}

#[tauri::command]
async fn stop_profile(app: tauri::AppHandle, name: String) -> Result<(), String> {
    profile(&name)?;
    colima_stream(app, vec![vec!["stop".into(), name]]).await
}

// For a stop that timed out: shuts the VM down without waiting for it to answer.
#[tauri::command]
async fn force_stop_profile(app: tauri::AppHandle, name: String) -> Result<(), String> {
    profile(&name)?;
    colima_stream(app, vec![vec!["stop".into(), "--force".into(), name]]).await
}

#[tauri::command]
async fn restart_profile(app: tauri::AppHandle, name: String) -> Result<(), String> {
    profile(&name)?;
    colima_stream(app, vec![vec!["restart".into(), name]]).await
}

// A VM left half-running after sleep keeps lock files that block `start`; a forced stop clears them.
#[tauri::command]
async fn force_restart_profile(app: tauri::AppHandle, name: String) -> Result<(), String> {
    profile(&name)?;
    colima_stream(app, vec![vec!["stop".into(), "--force".into(), name.clone()], vec!["start".into(), name]]).await
}

// The Mac's cores and memory, so the first VM can be sized from the machine instead of Colima's 2 CPU, 2 GiB.
#[derive(serde::Serialize)]
struct Host {
    cpus: u32,
    memory: u64,
}

fn sysctl(key: &str) -> Option<u64> {
    let out = std::process::Command::new("/usr/sbin/sysctl").args(["-n", key]).output().ok()?;
    String::from_utf8_lossy(&out.stdout).trim().parse().ok()
}

#[tauri::command]
fn host_resources() -> Host {
    Host { cpus: sysctl("hw.ncpu").unwrap_or(4) as u32, memory: sysctl("hw.memsize").unwrap_or(8 << 30) }
}

// Colima profile names are plain words; anything with a slash or dots could walk out of ~/.colima.
pub(crate) fn profile_name_ok(name: &str) -> bool {
    !name.is_empty() && !name.starts_with(['-', '.']) && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn profile(name: &str) -> Result<(), String> {
    profile_name_ok(name).then_some(()).ok_or_else(|| format!("Invalid profile name: \"{name}\""))
}

// Lima names the instance "colima" for the default profile and "colima-<name>" for others.
fn lima_dir(profile: &str) -> std::path::PathBuf {
    let inst = if profile == "default" { "colima".to_string() } else { format!("colima-{profile}") };
    std::path::PathBuf::from(std::env::var("HOME").unwrap_or_default()).join(".colima/_lima").join(inst)
}

// The last lines of the VM's own log: `colima start` often only says "exit status 1" and the reason is here.
fn tail_bytes(path: &std::path::Path, max: u64) -> String {
    use std::io::{Seek, SeekFrom};
    let Ok(mut f) = std::fs::File::open(path) else { return String::new() };
    let len = f.metadata().map(|m| m.len()).unwrap_or(0);
    let _ = f.seek(SeekFrom::Start(len.saturating_sub(max)));
    let mut buf = Vec::new();
    let _ = f.read_to_end(&mut buf);
    String::from_utf8_lossy(&buf).into_owned()
}

#[tauri::command]
fn vm_log_tail(name: String) -> Result<String, String> {
    if !profile_name_ok(&name) {
        return Err(format!("Invalid profile name: \"{name}\""));
    }
    // The log only grows; read its last 64 KB, never the whole file.
    let text = tail_bytes(&lima_dir(&name).join("ha.stderr.log"), 64 << 10);
    let lines: Vec<&str> = text.lines().collect();
    Ok(lines[lines.len().saturating_sub(60)..].join("\n"))
}

// The VM's own log, where Colima's one-line error doesn't say why: shown in Finder (it is a file in ~/.colima, read by
// the user in their own editor). Only reveals; nothing is opened, written or sent. None of this runs a command that
// changes anything.
fn vm_log_path(name: &str) -> Result<std::path::PathBuf, String> {
    if !profile_name_ok(name) {
        return Err(format!("Invalid profile name: \"{name}\""));
    }
    let path = lima_dir(name).join("ha.stderr.log");
    if path.is_file() { Ok(path) } else { Err("The VM has no log yet.".into()) }
}

#[tauri::command]
fn reveal_vm_log(name: String) -> Result<(), String> {
    let path = vm_log_path(&name)?;
    Command::new("/usr/bin/open").args(["-R"]).arg(path).spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_profile(app: tauri::AppHandle, name: String) -> Result<(), String> {
    profile(&name)?;
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

// The native macOS folder chooser, so the Run panel never asks for a typed path. Ok(None) means the user cancelled.
const PICK_FOLDER_SCRIPT: &str = r#"POSIX path of (choose folder with prompt "Choose a folder to share with the container")"#;
const PICK_COMPOSE_SCRIPT: &str = r#"POSIX path of (choose folder with prompt "Choose the folder with your compose.yaml")"#;
const PICK_FOLDER_DEADLINE: Duration = Duration::from_secs(300);

fn parse_pick_folder(ok: bool, stdout: &[u8], stderr: &[u8]) -> Result<Option<String>, String> {
    let err = String::from_utf8_lossy(stderr);
    if ok {
        let path = String::from_utf8_lossy(stdout);
        let path = path.trim().trim_end_matches('/');
        return Ok(Some(if path.is_empty() { "/".to_string() } else { path.to_string() }));
    }
    // AppleScript error -128 is the Cancel button.
    if err.contains("User canceled") || err.contains("(-128)") {
        return Ok(None);
    }
    Err(err.trim().to_string())
}

#[tauri::command]
async fn pick_folder(purpose: Option<String>) -> Result<Option<String>, String> {
    if !cfg!(target_os = "macos") {
        return Err("Choosing a folder is only supported on macOS".into());
    }
    let script = if purpose.as_deref() == Some("compose") { PICK_COMPOSE_SCRIPT } else { PICK_FOLDER_SCRIPT };
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new("/usr/bin/osascript");
        cmd.args(["-e", script]);
        let (ok, out, err) = output_with_deadline(cmd, PICK_FOLDER_DEADLINE).map_err(|e| format!("Could not open the folder chooser: {e}"))?;
        parse_pick_folder(ok, &out, &err)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn setup_report() -> Result<setup::SetupReport, String> {
    tauri::async_runtime::spawn_blocking(setup::report).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn setup_fix(id: String, profile: Option<String>) -> Result<String, String> {
    let profile = profile.unwrap_or_else(|| "default".into());
    tauri::async_runtime::spawn_blocking(move || setup::fix(&id, &profile)).await.map_err(|e| e.to_string())?
}

// ---- Compose projects on the Mac: ask Spotlight, never crawl the disk ----
// Spotlight already indexes the home folder, so this costs well under a second and reads no file contents.
const COMPOSE_NAMES: [&str; 4] = ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"];
const COMPOSE_SCAN_DEADLINE: std::time::Duration = std::time::Duration::from_secs(10);
const COMPOSE_MAX: usize = 300;

fn compose_query() -> String {
    COMPOSE_NAMES.iter().map(|n| format!("kMDItemFSName == \"{n}\"")).collect::<Vec<_>>().join(" || ")
}

// Dependency and package-cache folders ship sample Compose files nobody wants listed as their projects.
// Go keeps its module cache in .../pkg/mod, matched as a pair so a project folder called "mod" still shows.
const COMPOSE_SKIP_DIRS: [&str; 6] = ["node_modules", "vendor", "bower_components", "Pods", "site-packages", "venv"];

// Keeps Compose files in ordinary folders under the home: absolute, not hidden, not ~/Library, not a dependency folder.
// `mdfind -0` ends each path with NUL, because a folder name may itself contain a newline.
// One more than COMPOSE_MAX is kept, so the screen can say the list was cut.
fn compose_paths(out: &str, home: &str) -> Vec<String> {
    let mut v: Vec<String> = out
        .split('\0')
        .filter(|p| {
            let Some((dir, file)) = p.rsplit_once('/') else { return false };
            dir.starts_with('/') && COMPOSE_NAMES.contains(&file) && run_source_ok(dir, home) && !dir.split('/').any(|c| COMPOSE_SKIP_DIRS.contains(&c)) && !format!("{dir}/").contains("/pkg/mod/")
        })
        .map(String::from)
        .collect();
    v.sort();
    v.dedup();
    v.truncate(COMPOSE_MAX + 1);
    v
}

#[tauri::command]
async fn find_compose_files() -> Result<Vec<String>, String> {
    if !cfg!(target_os = "macos") {
        return Err("Finding Compose projects needs Spotlight, which is only on macOS".into());
    }
    let home = std::env::var("HOME").unwrap_or_default();
    if home.is_empty() {
        return Err("Could not find your home folder".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new("/usr/bin/mdfind");
        cmd.args(["-0", "-onlyin", &home, &compose_query()]);
        let (ok, out, err) = output_with_deadline(cmd, COMPOSE_SCAN_DEADLINE).map_err(|e| format!("Spotlight search failed: {e}"))?;
        if !ok {
            let err = String::from_utf8_lossy(&err);
            // The shared deadline message blames Docker; here the slow party is Spotlight.
            if err.contains("Stopped after") {
                return Err(format!("Spotlight did not answer within {}s. It may still be indexing your Mac; try Scan again in a minute.", COMPOSE_SCAN_DEADLINE.as_secs()));
            }
            return Err(format!("Spotlight search failed: {}", err.trim()));
        }
        Ok(compose_paths(&String::from_utf8_lossy(&out), &home))
    })
    .await
    .map_err(|e| e.to_string())?
}

// Which file Open and Show may reach: one the scan would list, and so must the real file behind it (symlinks
// resolved): a regular file, still in an ordinary home folder, still named like a Compose file. Returns the real path,
// so `open` gets the file that was checked, not a name that could be swapped for something else.
fn compose_real_path(path: &str, home: &str) -> Result<String, String> {
    let refuse = || "Only a Compose file in your home folder can be opened".to_string();
    if compose_paths(path, home) != [path] {
        return Err(refuse());
    }
    let real = std::fs::canonicalize(path).map_err(|_| refuse())?;
    if !std::fs::metadata(&real).map_err(|_| refuse())?.is_file() {
        return Err(refuse());
    }
    let real_home = std::fs::canonicalize(home).map_err(|_| refuse())?;
    let (real, real_home) = (real.to_str().ok_or_else(refuse)?.to_string(), real_home.to_str().ok_or_else(refuse)?);
    if !real.starts_with(&format!("{real_home}/")) {
        // The name passed the check, so a folder above it is a link that leads out of home.
        let name = path.rsplit('/').next().unwrap_or("compose.yaml");
        return Err(format!("{name} is in a linked folder outside your home, so it can't be opened from here"));
    }
    if compose_paths(&real, real_home) != [real.as_str()] {
        return Err(refuse());
    }
    Ok(real)
}

// Apps never handed a Compose file, even when the Mac's default for YAML says so: they run what they open (terminals,
// script runners) or are not editors at all. A short list on purpose: anything else that is set as the default for
// YAML is what the user chose to edit it with.
const EDITOR_DENY: [&str; 12] = [
    "com.apple.terminal", "com.googlecode.iterm2", "com.apple.scripteditor2", "com.apple.automator", "com.apple.installer",
    "com.apple.archiveutility", "dev.warp.warp-stable", "net.kovidgoyal.kitty", "com.github.wez.wezterm", "org.alacritty",
    "com.mitchellh.ghostty", "com.apple.shortcuts",
];

// Which app opens a Compose file. yaml_editor: the app registered to EDIT YAML (public.yaml, editor role); plain_editor:
// the one registered to edit plain text. The first one that looks like an app and isn't refused above is used, as
// `-b <bundle id>` (so the file opens as a document in it even if it were a script); with neither, TextEdit by its
// bundle id. Never bare `open -t`: that is whatever the plain-text default is (it can be iTerm), past the deny list.
fn looks_like_editor(id: &str) -> bool {
    let bundle = id.split('.').count() >= 2 && id.starts_with(|c: char| c.is_ascii_alphanumeric()) && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-');
    bundle && !EDITOR_DENY.contains(&id.to_ascii_lowercase().as_str())
}
fn pick_editor(yaml_editor: Option<&str>, plain_editor: Option<&str>) -> Option<String> {
    [yaml_editor, plain_editor].into_iter().flatten().find(|id| looks_like_editor(id)).map(String::from)
}
const TEXTEDIT: &str = "com.apple.TextEdit";
fn editor_args(real: &str, pick: Option<&str>) -> Vec<String> {
    vec!["-b".into(), pick.unwrap_or(TEXTEDIT).into(), real.into()]
}

// "textedit" when the app that opens it is TextEdit (whose smart quotes break YAML, so the page says how to turn them
// off first), by its bundle id. "editor" otherwise.
fn opens_in(args: &[String]) -> &'static str {
    if args.get(1).map_or(false, |id| id.eq_ignore_ascii_case(TEXTEDIT)) { "textedit" } else { "editor" }
}

// LaunchServices: the default app a content type opens with in a role (editor 0x4).
const ROLE_EDITOR: u32 = 0x4;
#[cfg(target_os = "macos")]
mod launch_services {
    use std::ffi::{c_char, c_void, CStr, CString};
    #[link(name = "CoreServices", kind = "framework")]
    extern "C" {
        fn LSCopyDefaultRoleHandlerForContentType(content_type: *const c_void, role: u32) -> *const c_void;
        fn LSCopyApplicationURLsForBundleIdentifier(bundle_id: *const c_void, error: *mut *const c_void) -> *const c_void;
    }
    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFStringCreateWithCString(alloc: *const c_void, s: *const c_char, encoding: u32) -> *const c_void;
        fn CFStringGetCString(s: *const c_void, buf: *mut c_char, size: isize, encoding: u32) -> u8;
        fn CFRelease(cf: *const c_void);
        fn CFArrayGetCount(array: *const c_void) -> isize;
        fn CFArrayGetValueAtIndex(array: *const c_void, index: isize) -> *const c_void;
        fn CFURLCopyLastPathComponent(url: *const c_void) -> *const c_void;
    }
    const UTF8: u32 = 0x0800_0100;
    // SAFETY: reads a CFString into a String; the caller still owns it.
    unsafe fn read(s: *const c_void) -> Option<String> {
        let mut buf = [0 as c_char; 512];
        (CFStringGetCString(s, buf.as_mut_ptr(), buf.len() as isize, UTF8) != 0).then(|| CStr::from_ptr(buf.as_ptr()).to_string_lossy().into_owned())
    }
    // The app's name as Finder shows it ("Cursor" for Cursor.app), from the first app LaunchServices has for the id.
    pub fn app_name(bundle_id: &str) -> Option<String> {
        let id = CString::new(bundle_id).ok()?;
        // SAFETY: the id string, the URL array and the copied name are each released once; the URL is borrowed from
        // the array and read before the array is released. The error out-parameter is not requested (null).
        unsafe {
            let cf_id = CFStringCreateWithCString(std::ptr::null(), id.as_ptr(), UTF8);
            if cf_id.is_null() {
                return None;
            }
            let urls = LSCopyApplicationURLsForBundleIdentifier(cf_id, std::ptr::null_mut());
            CFRelease(cf_id);
            if urls.is_null() {
                return None;
            }
            let name = if CFArrayGetCount(urls) > 0 {
                let last = CFURLCopyLastPathComponent(CFArrayGetValueAtIndex(urls, 0));
                let n = if last.is_null() { None } else { let n = read(last); CFRelease(last); n };
                n
            } else {
                None
            };
            CFRelease(urls);
            name.map(|n| n.strip_suffix(".app").unwrap_or(&n).to_string()).filter(|n| !n.is_empty())
        }
    }
    pub fn handler(content_type: &str, role: u32) -> Option<String> {
        let uti = CString::new(content_type).ok()?;
        // SAFETY: plain CoreFoundation calls; the type string and the copied handler are each released once.
        unsafe {
            let ty = CFStringCreateWithCString(std::ptr::null(), uti.as_ptr(), UTF8);
            if ty.is_null() {
                return None;
            }
            let id = LSCopyDefaultRoleHandlerForContentType(ty, role);
            CFRelease(ty);
            if id.is_null() {
                return None;
            }
            let mut buf = [0 as c_char; 256];
            let got = CFStringGetCString(id, buf.as_mut_ptr(), buf.len() as isize, UTF8) != 0;
            CFRelease(id);
            got.then(|| CStr::from_ptr(buf.as_ptr()).to_string_lossy().into_owned())
        }
    }
}
// The name people see for the app `open` was given (its .app's name), TextEdit for TextEdit's bundle id, or
// "an editor" when it can't be told.
fn app_name_of(args: &[String], lookup: impl Fn(&str) -> Option<String>) -> String {
    match args.get(1) {
        Some(id) if id.eq_ignore_ascii_case(TEXTEDIT) => lookup(id).unwrap_or_else(|| "TextEdit".into()),
        Some(id) => lookup(id).unwrap_or_else(|| "an editor".into()),
        None => "an editor".into(),
    }
}
#[cfg(target_os = "macos")]
fn app_display_name(bundle_id: &str) -> Option<String> {
    launch_services::app_name(bundle_id)
}
#[cfg(not(target_os = "macos"))]
fn app_display_name(_bundle_id: &str) -> Option<String> {
    None
}
#[cfg(target_os = "macos")]
fn type_editor(content_type: &str) -> Option<String> {
    launch_services::handler(content_type, ROLE_EDITOR)
}
#[cfg(not(target_os = "macos"))]
fn type_editor(_content_type: &str) -> Option<String> {
    None
}

// The `open` arguments for one checked file, and whether that will be TextEdit. A lookup only: nothing opens.
fn compose_open_plan(real: &str) -> (Vec<String>, &'static str) {
    let plain = type_editor("public.plain-text");
    let args = editor_args(real, pick_editor(type_editor("public.yaml").as_deref(), plain.as_deref()).as_deref());
    let how = opens_in(&args);
    (args, how)
}

// How one `open` run ended. Failed holds what macOS said on stderr.
#[derive(Debug, PartialEq)]
enum OpenRun { Done, TimedOut, Failed(String) }
const OPEN_DEADLINE: Duration = Duration::from_secs(30);
// The page reads these two prefixes: still opening (not an error), or couldn't open with macOS's reason after the colon.
const STILL_OPENING: &str = "STILL_OPENING";
const OPEN_FAILED: &str = "OPEN_FAILED:";

// How one `open` ended: killed at the deadline (None) is still opening, never a failure; a failure keeps only what
// macOS said.
fn open_run(status: Option<bool>, stderr: &str) -> OpenRun {
    match status {
        None => OpenRun::TimedOut,
        Some(true) => OpenRun::Done,
        Some(false) => OpenRun::Failed(stderr.to_string()),
    }
}

// Only an app that is gone (a stale LaunchServices record) is worth a second try with TextEdit; a
// cancelled "downloaded from the internet" dialog, say, must not land the file in TextEdit.
fn app_missing(stderr: &str) -> bool {
    stderr.contains("Unable to find application") || stderr.contains("LSCopyApplicationURLsForBundleIdentifier")
}

// One `open` run, then (only when the chosen app can't be found, and it wasn't TextEdit already) one more with TextEdit. A run that
// is still going at the deadline is left alone and not retried. run: one `open` with those arguments (tests fake it).
// A failure is OPEN_FAILED:<the app it tried>\n<macOS's first line>. app_name: a bundle id's display name (tests fake it).
fn open_with_fallback(first: Vec<String>, run: impl Fn(&[String]) -> Result<OpenRun, String>, app_name: impl Fn(&[String]) -> String) -> Result<Vec<String>, String> {
    let fail = |args: &[String], e: &str| format!("{OPEN_FAILED}{}\n{}", app_name(args), e.lines().map(str::trim).find(|l| !l.is_empty()).unwrap_or("").trim_end_matches('.'));
    match run(&first)? {
        OpenRun::Done => Ok(first),
        OpenRun::TimedOut => Err(STILL_OPENING.into()),
        OpenRun::Failed(e) if app_missing(&e) && opens_in(&first) != "textedit" => {
            let plain = editor_args(&first[2], None);
            match run(&plain)? {
                OpenRun::Done => Ok(plain),
                OpenRun::TimedOut => Err(STILL_OPENING.into()),
                OpenRun::Failed(e) => Err(fail(&plain, &e)),
            }
        }
        OpenRun::Failed(e) => Err(fail(&first, &e)),
    }
}

// Shows one Compose file in Finder.
#[tauri::command]
fn reveal_compose(path: String) -> Result<(), String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let real = compose_real_path(&path, &home)?;
    Command::new("/usr/bin/open").args(["-R", &real]).spawn().map(|_| ()).map_err(|e| e.to_string())
}

// Which app Open would use for this file ("textedit" or "editor"), so the page can say the smart quotes hint before
// it opens. Checks the path like Open does; opens nothing.
// how: "textedit" or "editor"; app: the name Open's button shows ("Open in Cursor"), none when it can't be told.
#[derive(Serialize, Debug, PartialEq)]
struct EditorPlan {
    how: &'static str,
    app: Option<String>,
}
fn editor_plan(args: &[String], how: &'static str, lookup: impl Fn(&str) -> Option<String>) -> EditorPlan {
    let app = app_name_of(args, lookup);
    EditorPlan { how, app: (app != "an editor").then_some(app) }
}

#[tauri::command]
async fn compose_editor(path: String) -> Result<EditorPlan, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let home = std::env::var("HOME").unwrap_or_default();
        let real = compose_real_path(&path, &home)?;
        let (args, how) = compose_open_plan(&real);
        Ok(editor_plan(&args, how, app_display_name))
    })
    .await
    .map_err(|e| e.to_string())?
}

// Opens one Compose file in the editor the Mac uses for YAML (never `open <file>` alone, which would run a script or
// app that took the file's place), so its memory limit can be raised. Returns where it opened ("textedit" or
// "editor"), which differs from compose_editor only after the retry.
#[tauri::command]
async fn open_compose(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let home = std::env::var("HOME").unwrap_or_default();
        let real = compose_real_path(&path, &home)?;
        let (first, _) = compose_open_plan(&real);
        let run = |args: &[String]| {
            let mut cmd = Command::new("/usr/bin/open");
            cmd.args(args);
            let (status, _, err) = run_with_deadline(cmd, OPEN_DEADLINE).map_err(|e| e.to_string())?;
            Ok(open_run(status.map(|s| s.success()), &String::from_utf8_lossy(&err)))
        };
        let used = open_with_fallback(first, run, |args| app_name_of(args, app_display_name))?;
        Ok(opens_in(&used).to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---- Running a Compose project, as `cd <folder> && docker compose <action>` would ----
// Only a Compose file the scan would list, and only these actions. `down` keeps volumes (no -v), so data stays.
// It runs in the project's folder with no -f, so an override file there is merged just as it is in Terminal.
const COMPOSE_TIMEOUT: Duration = Duration::from_secs(600);
static COMPOSE_LOCK: Mutex<()> = Mutex::new(());
static COMPOSE_PID: Mutex<Option<u32>> = Mutex::new(None);

fn compose_args(context: &str, file: &str, action: &str, home: &str) -> Result<(String, Vec<String>), String> {
    if !context_ok(context) {
        return Err(format!("Unknown Docker context \"{context}\""));
    }
    if compose_paths(file, home) != [file] {
        return Err("Only a Compose file the app found in your home folder can be run".into());
    }
    let tail: &[&str] = match action {
        "up" => &["up", "-d"],
        // Rebuild what has a build: section; get newer images for the rest. Both then start the project.
        "build" => &["up", "-d", "--build"],
        "pull" => &["up", "-d", "--pull", "always"],
        "logs" => &["logs", "--tail", "300", "--no-color", "--timestamps"],
        "stop" => &["stop"],
        "restart" => &["restart"],
        "down" => &["down"],
        _ => return Err(format!("\"docker compose {action}\" is not available from the app")),
    };
    let dir = file.rsplit_once('/').map(|(d, _)| d.to_string()).unwrap_or_default();
    let mut args: Vec<String> = vec!["--context".into(), context.into(), "compose".into()];
    args.extend(tail.iter().map(|s| s.to_string()));
    Ok((dir, args))
}

// One service started again with `docker compose up -d --no-deps <service>`, so Compose recreates it with the
// file's current settings (a new memory limit applies only to a recreated container) and leaves the services it
// depends on as they are (no rerun of a finished job, no start of a db the user stopped). The name must be one of
// the project's own services: no free text reaches argv.
fn compose_service_args(context: &str, file: &str, service: &str, services: &[String], home: &str) -> Result<(String, Vec<String>), String> {
    let (dir, mut args) = compose_args(context, file, "up", home)?;
    let shaped = !service.is_empty() && !service.starts_with('-') && service.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c));
    if !shaped || !services.iter().any(|s| s == service) {
        return Err(format!("{NOT_STARTED}\"{service}\" is not a service of this project"));
    }
    args.extend(["--no-deps".to_string(), service.to_string()]);
    Ok((dir, args))
}

// Said before an error when nothing ran (a check before Compose refused), so the page doesn't say part of the
// project may have been created.
const NOT_STARTED: &str = "Not started: ";

// The project's services: `config --services` with every profile (`--profile '*'`, so a service behind a profile
// counts), or without it when that Compose is too old for '*'; plus any service a container of this project already
// carries in its label (it exists, so it is the project's).
// The name Compose gives a project with no `name:` of its own: the folder's name, lowercased, keeping only a-z, 0-9,
// _ and -, with no leading _ or -. With `name:` set, the labeled fallback finds nothing, which is safe: it is only a fallback.
fn default_project_name(dir: &str) -> String {
    let name: String = dir.rsplit('/').next().unwrap_or("").to_lowercase().chars().filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-').collect();
    // compose-go also drops leading _ and - (a project name must start with a letter or digit).
    name.trim_start_matches(['_', '-']).to_string()
}

fn project_services(all_profiles: Option<&str>, active: Option<&str>, labeled: &str) -> Vec<String> {
    let mut v: Vec<String> = all_profiles.or(active).unwrap_or("").lines().chain(labeled.lines()).map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect();
    v.sort();
    v.dedup();
    v
}

#[tauri::command]
async fn compose_action(app: tauri::AppHandle, context: String, file: String, action: String, service: Option<String>) -> Result<(), String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let (dir, args) = match service.as_deref() {
        None => compose_args(&context, &file, &action, &home)?,
        Some(svc) => {
            if action != "up" {
                return Err(format!("\"docker compose {action}\" of one service is not available from the app"));
            }
            let (dir, list) = compose_args(&context, &file, "up", &home).map_err(|e| format!("{NOT_STARTED}{e}"))?;
            let ctx_args = || vec![list[0].clone(), list[1].clone()];
            let with = |tail: &[&str]| { let mut a = ctx_args(); a.extend(tail.iter().map(|s| s.to_string())); a };
            let all = exec_in("docker", with(&["compose", "--profile", "*", "config", "--services"]), false, Some(dir.clone())).await.ok();
            let active = if all.is_none() { exec_in("docker", with(&["compose", "config", "--services"]), false, Some(dir.clone())).await.ok() } else { None };
            let labeled = exec_in("docker", with(&["ps", "-a", "--filter", &format!("label=com.docker.compose.project.working_dir={dir}"), "--filter", &format!("label=com.docker.compose.project={}", default_project_name(&dir)), "--format", "{{.Label \"com.docker.compose.service\"}}"]), false, None).await.unwrap_or_default();
            if all.is_none() && active.is_none() && labeled.trim().is_empty() {
                return Err(format!("{NOT_STARTED}docker compose couldn't read this project's file"));
            }
            compose_service_args(&context, &file, svc, &project_services(all.as_deref(), active.as_deref(), &labeled), &home)?
        }
    };
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = match COMPOSE_LOCK.try_lock() {
            Ok(g) => g,
            Err(TryLockError::Poisoned(p)) => p.into_inner(),
            Err(TryLockError::WouldBlock) => return Err("Another Compose project is still starting or stopping. Wait for it, or cancel it.".to_string()),
        };
        let track = |pid| *COMPOSE_PID.lock().unwrap_or_else(|p| p.into_inner()) = pid;
        stream_in(&app, "compose-progress", "docker", &args, Some(&dir), COMPOSE_TIMEOUT, track)
    })
    .await
    .map_err(|e| e.to_string())?
}

// The last lines of every service in the project, as Compose prints them (services interleaved). A read, so it doesn't wait for a run in progress.
// The project's settings as Compose resolves them (every profile, overrides merged), as JSON: the page reads one
// service's current memory limit and what it depends on. A read, for a listed file only.
#[tauri::command]
async fn compose_config(context: String, file: String) -> Result<String, String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let (dir, list) = compose_args(&context, &file, "up", &home)?;
    let args = vec![list[0].clone(), list[1].clone(), "compose".into(), "--profile".into(), "*".into(), "config".into(), "--format".into(), "json".into()];
    match exec_in("docker", args, false, Some(dir.clone())).await {
        Ok(out) => Ok(out),
        Err(e) if config_retry_plain(&e) => exec_in("docker", vec![list[0].clone(), list[1].clone(), "compose".into(), "config".into(), "--format".into(), "json".into()], false, Some(dir)).await,
        Err(e) => Err(e),
    }
}

// An older Compose without `--profile *` says so; only then is plain `config` worth a second try. Any other error
// (a broken compose.yaml, a missing variable) is the real answer and is returned as it is.
fn config_retry_plain(err: &str) -> bool {
    let e = err.to_ascii_lowercase();
    e.contains("unknown flag") || e.contains("profile")
}

#[tauri::command]
async fn compose_logs(context: String, file: String, since: Option<String>) -> Result<String, String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let (dir, args) = compose_logs_args(&context, &file, since.as_deref(), &home)?;
    exec_in("docker", args, true, Some(dir)).await
}

// First the last 300 lines of each service; then, polled, only what came after the newest timestamp seen.
fn compose_logs_args(context: &str, file: &str, since: Option<&str>, home: &str) -> Result<(String, Vec<String>), String> {
    let (dir, mut args) = compose_args(context, file, "logs", home)?;
    if let Some(t) = since {
        // An RFC 3339 time as Docker prints it, nothing else: it lands in argv, so no flag or word can ride along.
        let stamp = t.len() <= 40 && t.starts_with(|c: char| c.is_ascii_digit()) && t.chars().all(|c| c.is_ascii_digit() || "-:.TZ+".contains(c));
        if !stamp {
            return Err("Bad log time".into());
        }
        args.truncate(4);
        args.extend(["--since", t, "--no-color", "--timestamps"].map(String::from));
    }
    Ok((dir, args))
}

// A folder Spotlight missed (not indexed, or just created). Same rules as the scan: in your home, not hidden.
fn compose_files_in(dir: &str, exists: impl Fn(&str) -> bool, home: &str) -> Result<Vec<String>, String> {
    let dir = dir.trim_end_matches('/');
    if !run_source_ok(dir, home) {
        return Err("Choose a folder inside your home folder. Hidden folders and ~/Library can't be added.".into());
    }
    if dir.split('/').any(|c| COMPOSE_SKIP_DIRS.contains(&c)) || format!("{dir}/").contains("/pkg/mod/") {
        return Err("That folder is inside a dependency folder (like node_modules or vendor), which the app leaves alone.".into());
    }
    let found: String = COMPOSE_NAMES.iter().map(|n| format!("{dir}/{n}")).filter(|p| exists(p)).map(|p| p + "\0").collect();
    let v = compose_paths(&found, home);
    if v.is_empty() {
        return Err(format!("No compose.yaml or docker-compose.yml in {}", dir.rsplit('/').next().unwrap_or(dir)));
    }
    Ok(v)
}

#[tauri::command]
fn compose_in_folder(dir: String) -> Result<Vec<String>, String> {
    let home = std::env::var("HOME").unwrap_or_default();
    compose_files_in(&dir, |p| std::path::Path::new(p).is_file(), &home)
}

// Which shell a running container has: bash if it has one, else sh, else none (a minimal image). Only "not
// found" means no shell; a stopped container, a paused one or a stuck Docker is an error, said as it is.
const SHELL_PROBE_DEADLINE: Duration = Duration::from_secs(5);

fn shell_probe_verdict(ok: bool, output: &str) -> Result<bool, String> {
    let missing = ["executable file not found", "no such file or directory"];
    match ok {
        true => Ok(true),
        false if missing.iter().any(|m| output.to_lowercase().contains(m)) => Ok(false),
        false if output.trim().is_empty() => Err("Docker didn't answer in 5 seconds. Try again, or restart the VM.".into()),
        false => Err(output.trim().to_string()),
    }
}

#[tauri::command]
async fn container_shell(context: String, name: String) -> Result<String, String> {
    if !context_ok(&context) || !container_name_ok(&name) {
        return Err("Unknown container".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        for sh in ["bash", "sh"] {
            let mut cmd = Command::new(find_bin("docker"));
            cmd.args(["--context", &context, "exec", &name, sh, "-c", "exit 0"]).env("PATH", path_env());
            let (ok, out, err) = output_with_deadline(cmd, SHELL_PROBE_DEADLINE).map_err(|e| format!("Could not run docker: {e}"))?;
            let text = format!("{}{}", String::from_utf8_lossy(&out), String::from_utf8_lossy(&err));
            if shell_probe_verdict(ok, &text)? {
                return Ok(sh.to_string());
            }
        }
        Ok("none".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// Stops the Compose run in progress. What it already started keeps running; Stop or Down clears it.
#[tauri::command]
fn cancel_compose() -> bool {
    let pid = *COMPOSE_PID.lock().unwrap_or_else(|p| p.into_inner());
    pid.map(kill_group).is_some()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_profiles, docker, docker_check, docker_pull, env_check, install_tools, network_probe, kubectl, open_terminal, open_homebrew_install, start_profile, apply_resources,
            stop_profile, force_stop_profile, restart_profile, colima_config, network_facts, vm_dns_probe, apply_mounts, apply_env, force_restart_profile, delete_profile, cancel_vm_op, host_resources, vm_log_tail, reveal_vm_log, open_url, pick_folder, setup_report, setup_fix, find_compose_files, reveal_compose, compose_editor, open_compose, compose_config, compose_action, cancel_compose, compose_logs, compose_in_folder, container_shell,
            orb_version, orb_list_vms, orb_start_vm, orb_stop_vm, orb_delete_vm,
            colima_version, rdctl_version, podman_version, docker_desktop_version,
            ollama_chat, ollama_list_models, ollama_pull,
            desktop::desktop_state, desktop::desktop_docker, desktop::desktop_copy, desktop::desktop_copy_stop, desktop::desktop_start, desktop::desktop_replace, desktop::open_docker_desktop,
            lima::lima_status, lima::lima_ensure_vm, lima::project_env_create, lima::project_env_start, lima::project_env_stop, lima::project_env_delete, lima::project_env_list, lima::project_env_get, lima::project_env_logs, lima::project_env_exec, lima::project_env_forward_port, lima::project_env_unforward_port, lima::project_set_environment, lima::get_ssh_auth_sock, lima::git_config_get, lima::get_gh_token, lima::get_home_dir, lima::dialog_open
        ])
        .run(tauri::generate_context!())
        .expect("error while running Container UI");
}

#[cfg(test)]
mod tests {

    #[test]
    fn given_spotlight_output_when_filtered_then_only_compose_files_in_ordinary_home_folders_stay() {
        let out = "/Users/me/code/shop/compose.yaml\0/Users/me/code/shop/compose.yaml\0/Users/me/.config/x/docker-compose.yml\0/Users/me/Library/App/compose.yml\0/Users/me/library/App/compose.yml\0/Users/me/code/app/node_modules/pkg/docker-compose.yml\0/Users/me/go/pkg/mod/github.com/x/compose.yml\0/Users/me/code/blog/docker-compose.yml\0/Users/me/code/blog/compose.override.yml\0/Users/other/code/compose.yml\0/Users/me/compose.yml\0";
        assert_eq!(super::compose_paths(out, "/Users/me"), vec!["/Users/me/code/blog/docker-compose.yml", "/Users/me/code/shop/compose.yaml"]);
    }

    #[test]
    fn given_a_compose_file_when_run_then_only_listed_files_and_known_actions_are_accepted() {
        let (dir, args) = super::compose_args("colima", "/Users/me/code/shop/compose.yaml", "up", "/Users/me").unwrap();
        assert_eq!(dir, "/Users/me/code/shop");
        assert_eq!(args, vec!["--context", "colima", "compose", "up", "-d"]);
        assert_eq!(super::compose_args("colima-work", "/Users/me/code/shop/compose.yaml", "down", "/Users/me").unwrap().1, vec!["--context", "colima-work", "compose", "down"]);
        let tail = |a: &str| super::compose_args("colima", "/Users/me/code/shop/compose.yaml", a, "/Users/me").unwrap().1[3..].join(" ");
        assert_eq!(tail("build"), "up -d --build");
        assert_eq!(tail("pull"), "up -d --pull always");
        assert_eq!(tail("logs"), "logs --tail 300 --no-color --timestamps");
        let since = |t: &str| super::compose_logs_args("colima", "/Users/me/code/shop/compose.yaml", Some(t), "/Users/me").map(|(_, a)| a[3..].join(" "));
        assert_eq!(since("2026-10-28T15:04:05.123456789Z").unwrap(), "logs --since 2026-10-28T15:04:05.123456789Z --no-color --timestamps");
        for bad in ["--tail=9999", "2026 -f", "x", "2026-10-28T15:04:05Z;ls", ""] {
            assert!(since(bad).is_err(), "{bad}");
        }
        for (ctx, file, action) in [
            ("colima", "/Users/me/code/shop/compose.yaml", "rm"),
            ("colima", "/Users/me/code/shop/compose.yaml", "down -v"),
            ("colima", "/Users/me/code/shop/secrets.txt", "up"),
            ("colima", "/Users/me/.hidden/compose.yaml", "up"),
            ("colima", "/Users/other/code/compose.yaml", "up"),
            ("colima", "code/shop/compose.yaml", "up"),
            ("desktop-linux", "/Users/me/code/shop/compose.yaml", "up"),
        ] {
            assert!(super::compose_args(ctx, file, action, "/Users/me").is_err(), "{ctx} {file} {action}");
        }
    }

    #[test]
    fn given_one_service_when_started_again_then_only_a_service_the_project_lists_is_added_to_up() {
        let services = vec!["api".to_string(), "report-job".to_string()];
        let (dir, args) = super::compose_service_args("colima", "/Users/me/code/shop/compose.yaml", "report-job", &services, "/Users/me").unwrap();
        assert_eq!(dir, "/Users/me/code/shop");
        assert_eq!(args, vec!["--context", "colima", "compose", "up", "-d", "--no-deps", "report-job"]);
        for bad in ["web", "-d", "--build", "report-job extra", "report-job;rm", "", "../x"] {
            assert!(super::compose_service_args("colima", "/Users/me/code/shop/compose.yaml", bad, &services, "/Users/me").is_err(), "{bad}");
        }
        let odd = vec!["--build".to_string()];
        assert!(super::compose_service_args("colima", "/Users/me/code/shop/compose.yaml", "--build", &odd, "/Users/me").is_err(), "a listed name still can't be a flag");
        assert!(super::compose_service_args("colima", "/Users/me/code/shop/secrets.txt", "api", &services, "/Users/me").is_err());
        assert!(super::compose_service_args("colima", "/Users/me/code/shop/compose.yaml", "web", &services, "/Users/me").unwrap_err().starts_with(super::NOT_STARTED), "a refused name says nothing ran");
    }

    #[test]
    fn given_profiles_when_the_services_are_listed_then_every_profile_counts_and_a_labeled_container_is_enough() {
        // `--profile '*'` worked: a service behind a profile is the project's.
        assert_eq!(super::project_services(Some("api\nreport-job\n"), None, ""), vec!["api", "report-job"]);
        // An older Compose: only the active profiles, plus what a container of this project already carries.
        assert_eq!(super::project_services(None, Some("api\n"), "report-job\napi\n"), vec!["api", "report-job"]);
        assert!(super::project_services(None, None, "").is_empty());
    }

    #[test]
    fn given_a_compose_file_when_opened_then_only_a_listed_file_reaches_open() {
        for bad in ["/Users/me/code/shop/secrets.txt", "/Users/me/.ssh/compose.yaml", "/Users/other/compose.yaml", "-a", "/Applications/Terminal.app", "code/compose.yaml"] {
            assert!(super::compose_real_path(bad, "/Users/me").is_err(), "{bad}");
        }
    }

    // A fake home folder on disk, so symlinks and folders are real.
    fn compose_home(name: &str) -> (std::path::PathBuf, String) {
        let home = std::env::temp_dir().join(format!("colima-ui-open-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        std::fs::create_dir_all(home.join("code/shop")).unwrap();
        let home = std::fs::canonicalize(&home).unwrap();
        let s = home.to_str().unwrap().to_string();
        (home, s)
    }

    #[test]
    fn given_a_regular_compose_file_when_checked_then_its_real_path_is_what_open_gets() {
        let (home, h) = compose_home("file");
        let file = home.join("code/shop/compose.yaml");
        std::fs::write(&file, "services: {}\n").unwrap();
        let f = file.to_str().unwrap();
        assert_eq!(super::compose_real_path(f, &h).unwrap(), f);
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn given_a_compose_yaml_that_links_to_a_script_when_opened_then_it_is_refused() {
        let (home, h) = compose_home("link");
        let script = home.join("code/shop/run.command");
        std::fs::write(&script, "#!/bin/sh\necho hi\n").unwrap();
        let link = home.join("code/shop/compose.yaml");
        std::os::unix::fs::symlink(&script, &link).unwrap();
        assert!(super::compose_real_path(link.to_str().unwrap(), &h).is_err());
        assert!(super::compose_real_path(link.to_str().unwrap(), &h).is_err());
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn given_a_compose_yaml_that_links_outside_home_when_opened_then_it_is_refused() {
        let (home, h) = compose_home("out");
        let outside = std::env::temp_dir().join(format!("colima-ui-open-outside-{}.yaml", std::process::id()));
        std::fs::write(&outside, "services: {}\n").unwrap();
        let link = home.join("code/shop/compose.yaml");
        std::os::unix::fs::symlink(&outside, &link).unwrap();
        assert!(super::compose_real_path(link.to_str().unwrap(), &h).is_err());
        let _ = std::fs::remove_file(&outside);
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn given_compose_config_fails_when_deciding_to_retry_then_only_a_profile_or_unknown_flag_error_retries() {
        assert!(super::config_retry_plain("unknown flag: --profile"));
        assert!(super::config_retry_plain("invalid profile name \"*\""));
        assert!(!super::config_retry_plain("yaml: line 3: mapping values are not allowed in this context"));
        assert!(!super::config_retry_plain("required variable DB_PASSWORD is missing a value"));
    }

    #[test]
    fn given_a_project_folder_when_its_default_name_is_taken_then_it_matches_what_compose_labels() {
        assert_eq!(super::default_project_name("/Users/me/code/shop"), "shop");
        assert_eq!(super::default_project_name("/Users/me/code/My Shop.v2"), "myshopv2");
        assert_eq!(super::default_project_name("/Users/me/code/report_job-2"), "report_job-2");
        assert_eq!(super::default_project_name("/Users/me/code/_-shop"), "shop");
        assert_eq!(super::default_project_name("/Users/me/code/.shop"), "shop");
    }

    #[test]
    fn given_an_app_registered_to_edit_yaml_when_a_compose_file_is_opened_then_it_opens_in_that_app_as_a_document() {
        let f = "/Users/me/code/shop/compose.yaml";
        assert_eq!(super::editor_args(f, super::pick_editor(Some("com.microsoft.VSCode"), Some("com.apple.TextEdit")).as_deref()), vec!["-b", "com.microsoft.VSCode", f]);
        assert_eq!(super::pick_editor(Some("dev.zed.Zed"), None).as_deref(), Some("dev.zed.Zed"));
        assert_eq!(super::pick_editor(Some("com.sublimetext.4"), Some("com.apple.TextEdit")).as_deref(), Some("com.sublimetext.4"));
    }

    #[test]
    fn given_no_yaml_editor_when_opened_then_the_plain_text_editor_is_used_and_only_then_the_default_text_editor() {
        let f = "/Users/me/code/shop/compose.yaml";
        assert_eq!(super::pick_editor(None, Some("com.barebones.BBEdit")).as_deref(), Some("com.barebones.BBEdit"));
        assert_eq!(super::pick_editor(Some("com.apple.Terminal"), Some("com.apple.TextEdit")).as_deref(), Some("com.apple.TextEdit"), "a refused YAML app falls to the plain-text editor");
        assert_eq!(super::editor_args(f, super::pick_editor(None, None).as_deref()), vec!["-b", "com.apple.TextEdit", f], "never bare -t");
        // The plain-text default is iTerm and nothing edits YAML: iTerm is refused, TextEdit by bundle id, named TextEdit.
        let args = super::editor_args(f, super::pick_editor(None, Some("com.googlecode.iterm2")).as_deref());
        assert_eq!(args, vec!["-b", "com.apple.TextEdit", f]);
        assert_eq!(super::opens_in(&args), "textedit");
        assert_eq!(super::editor_plan(&args, super::opens_in(&args), |_| None).app.as_deref(), Some("TextEdit"));
    }

    #[test]
    fn given_a_terminal_or_script_runner_registered_when_opened_then_it_is_refused() {
        for bad in ["com.apple.Terminal", "com.googlecode.iterm2", "com.apple.ScriptEditor2", "com.mitchellh.ghostty", "", "notabundle", "com.x/../y", "-a", "-x.y"] {
            assert_eq!(super::pick_editor(Some(bad), Some(bad)), None, "{bad}");
        }
    }

    #[test]
    fn given_the_app_that_opens_it_when_it_is_textedit_by_bundle_id_or_the_fallback_then_the_page_is_told_textedit() {
        let f = "/Users/me/code/shop/compose.yaml";
        assert_eq!(super::opens_in(&super::editor_args(f, Some("com.apple.TextEdit"))), "textedit");
        assert_eq!(super::opens_in(&super::editor_args(f, Some("com.apple.textedit"))), "textedit", "any case");
        assert_eq!(super::opens_in(&super::editor_args(f, Some("com.microsoft.VSCode"))), "editor");
        assert_eq!(super::opens_in(&super::editor_args(f, None)), "textedit");
    }

    // Reads this Mac's real setting (a LaunchServices lookup, nothing opened): cargo test -- --ignored given_this_mac
    #[test]
    #[ignore]
    fn given_this_mac_when_the_yaml_editor_is_read_then_a_registered_editor_is_used() {
        let (yaml, plain) = (super::type_editor("public.yaml"), super::type_editor("public.plain-text"));
        let args = super::editor_args("/Users/me/x/compose.yaml", super::pick_editor(yaml.as_deref(), plain.as_deref()).as_deref());
        println!("public.yaml editor: {yaml:?}; plain-text editor: {plain:?}; open would get: {args:?}; opens in: {}", super::opens_in(&args));
        assert_eq!(args[0], "-b", "this Mac has an editor registered (Cursor for YAML)");
        println!("its name: {:?}", super::app_display_name(&args[1]));
        assert!(super::app_display_name(&args[1]).is_some());
    }

    #[test]
    fn given_open_b_cant_find_the_app_when_opening_then_it_retries_once_with_the_text_editor() {
        let f = "/Users/me/code/shop/compose.yaml";
        let first = || vec!["-b".to_string(), "com.gone.Editor".to_string(), f.to_string()];
        let tried = std::cell::RefCell::new(Vec::new());
        let missing = super::OpenRun::Failed("Unable to find application with bundle identifier com.gone.Editor".into());
        let used = super::open_with_fallback(first(), |a| { tried.borrow_mut().push(a[1].clone()); Ok(if a[1] == "com.apple.TextEdit" { super::OpenRun::Done } else { super::OpenRun::Failed("Unable to find application with bundle identifier com.gone.Editor".into()) }) }, |a: &[String]| super::app_name_of(a, |id| (id == "com.microsoft.VSCode").then(|| "Visual Studio Code".to_string()))).unwrap();
        assert_eq!(used, vec!["-b", "com.apple.TextEdit", f], "the retry is TextEdit by bundle id, never -t");
        assert_eq!(tried.borrow().len(), 2);
        let te = || vec!["-b".to_string(), "com.apple.TextEdit".to_string(), f.to_string()];
        let once = std::cell::RefCell::new(0);
        let gone = super::open_with_fallback(te(), |_| { *once.borrow_mut() += 1; Ok(super::OpenRun::Failed("Unable to find application named TextEdit".into())) }, |a: &[String]| super::app_name_of(a, |_| None)).unwrap_err();
        assert_eq!((*once.borrow(), gone.as_str()), (1, "OPEN_FAILED:TextEdit\nUnable to find application named TextEdit"), "TextEdit itself gone: no second try");
        assert_eq!(missing, super::OpenRun::Failed("Unable to find application with bundle identifier com.gone.Editor".into()));
        assert!(super::app_missing("_LSCopyApplicationURLsForBundleIdentifier failed"));
        assert_eq!(super::open_with_fallback(first(), |_| Ok(super::OpenRun::Done), |a: &[String]| super::app_name_of(a, |id| (id == "com.microsoft.VSCode").then(|| "Visual Studio Code".to_string()))).unwrap(), first(), "worked first time: no retry");
    }

    #[test]
    fn given_open_fails_for_another_reason_when_opening_then_there_is_no_retry_and_macos_reason_is_returned() {
        let f = "/Users/me/code/shop/compose.yaml";
        let first = || vec!["-b".to_string(), "com.microsoft.VSCode".to_string(), f.to_string()];
        let tried = std::cell::RefCell::new(0);
        let err = super::open_with_fallback(first(), |_| { *tried.borrow_mut() += 1; Ok(super::OpenRun::Failed("The application can't be opened.\n-128".into())) }, |a: &[String]| super::app_name_of(a, |id| (id == "com.microsoft.VSCode").then(|| "Visual Studio Code".to_string()))).unwrap_err();
        assert_eq!(err, "OPEN_FAILED:Visual Studio Code\nThe application can't be opened", "names the app it tried");
        assert_eq!(*tried.borrow(), 1, "a cancelled dialog is not retried in TextEdit");
        assert_eq!(super::open_with_fallback(vec!["-b".into(), "com.apple.TextEdit".into(), f.into()], |_| Ok(super::OpenRun::Failed(String::new())), |a: &[String]| super::app_name_of(a, |id| (id == "com.microsoft.VSCode").then(|| "Visual Studio Code".to_string()))).unwrap_err(), "OPEN_FAILED:TextEdit\n");
    }

    #[test]
    fn given_open_ended_or_was_killed_when_read_then_only_a_kill_is_still_opening() {
        assert_eq!(super::open_run(None, "anything"), super::OpenRun::TimedOut);
        assert_eq!(super::open_run(Some(true), ""), super::OpenRun::Done);
        assert_eq!(super::open_run(Some(false), "The application can't be opened."), super::OpenRun::Failed("The application can't be opened.".into()), "a slow failure is still a failure");
    }

    #[test]
    fn given_a_run_with_a_deadline_when_it_ends_or_is_killed_then_it_says_which_and_adds_no_words() {
        let mut sleep = std::process::Command::new("/bin/sleep");
        sleep.arg("5");
        let (killed, _, err) = super::run_with_deadline(sleep, std::time::Duration::from_millis(200)).unwrap();
        assert!(killed.is_none(), "killed at the deadline");
        assert!(!String::from_utf8_lossy(&err).contains("Docker or Colima"), "no stuck-Docker sentence for open");
        let (ended, _, _) = super::run_with_deadline(std::process::Command::new("/usr/bin/false"), std::time::Duration::from_secs(5)).unwrap();
        assert_eq!(ended.map(|s| s.success()), Some(false), "ended, with its own exit status");
    }

    #[test]
    fn given_the_app_open_tried_when_named_then_it_is_the_app_name_or_textedit_for_the_fallback() {
        let lookup = |id: &str| (id == "com.todesktop.230313mzl4w4u92").then(|| "Cursor".to_string());
        assert_eq!(super::app_name_of(&["-b".into(), "com.todesktop.230313mzl4w4u92".into(), "/x".into()], lookup), "Cursor");
        assert_eq!(super::app_name_of(&["-b".into(), "com.gone.Editor".into(), "/x".into()], lookup), "an editor");
        assert_eq!(super::app_name_of(&["-b".into(), "com.apple.TextEdit".into(), "/x".into()], lookup), "TextEdit");
    }

    #[test]
    fn given_the_app_open_will_use_when_planned_then_the_page_gets_its_name_or_none() {
        let lookup = |id: &str| (id == "com.todesktop.230313mzl4w4u92").then(|| "Cursor".to_string());
        let cursor = ["-b".to_string(), "com.todesktop.230313mzl4w4u92".into(), "/x".into()];
        assert_eq!(super::editor_plan(&cursor, "editor", lookup), super::EditorPlan { how: "editor", app: Some("Cursor".into()) });
        assert_eq!(super::editor_plan(&["-b".into(), "com.gone.Editor".into(), "/x".into()], "editor", lookup).app, None);
        assert_eq!(super::editor_plan(&["-b".into(), "com.apple.TextEdit".into(), "/x".into()], "textedit", lookup), super::EditorPlan { how: "textedit", app: Some("TextEdit".into()) });
        assert_eq!(serde_json::to_string(&super::editor_plan(&cursor, "editor", lookup)).unwrap(), r#"{"how":"editor","app":"Cursor"}"#);
    }

    #[test]
    fn given_open_is_still_going_at_the_deadline_when_opening_then_it_says_still_opening_and_does_not_retry() {
        let f = "/Users/me/code/shop/compose.yaml";
        let tried = std::cell::RefCell::new(0);
        let err = super::open_with_fallback(vec!["-b".into(), "com.microsoft.VSCode".into(), f.into()], |_| { *tried.borrow_mut() += 1; Ok(super::OpenRun::TimedOut) }, |a: &[String]| super::app_name_of(a, |id| (id == "com.microsoft.VSCode").then(|| "Visual Studio Code".to_string()))).unwrap_err();
        assert_eq!(err, "STILL_OPENING");
        assert_eq!(*tried.borrow(), 1);
    }

    #[test]
    fn given_a_compose_file_under_a_linked_folder_outside_home_when_opened_then_it_says_so_and_refuses() {
        let (home, h) = compose_home("linkdir");
        let outside = std::env::temp_dir().join(format!("colima-ui-open-outdir-{}", std::process::id()));
        std::fs::create_dir_all(&outside).unwrap();
        std::fs::write(outside.join("compose.yaml"), "services: {}\n").unwrap();
        std::os::unix::fs::symlink(&outside, home.join("code/linked")).unwrap();
        let err = super::compose_real_path(home.join("code/linked/compose.yaml").to_str().unwrap(), &h).unwrap_err();
        assert_eq!(err, "compose.yaml is in a linked folder outside your home, so it can't be opened from here");
        let _ = std::fs::remove_dir_all(&outside);
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn given_a_folder_named_compose_yaml_when_opened_then_it_is_refused() {
        let (home, h) = compose_home("dir");
        let dir = home.join("code/shop/compose.yaml");
        std::fs::create_dir_all(dir.join("Contents/MacOS")).unwrap();
        assert!(super::compose_real_path(dir.to_str().unwrap(), &h).is_err());
        assert!(super::compose_real_path(dir.to_str().unwrap(), &h).is_err());
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn given_a_chosen_folder_when_added_then_only_its_compose_files_in_an_ordinary_home_folder_count() {
        let has = |names: &'static [&'static str]| move |p: &str| names.iter().any(|n| p.ends_with(&format!("/{n}")));
        assert_eq!(super::compose_files_in("/Users/me/code/shop/", has(&["compose.yaml", "docker-compose.yml"]), "/Users/me").unwrap(), vec!["/Users/me/code/shop/compose.yaml", "/Users/me/code/shop/docker-compose.yml"]);
        assert!(super::compose_files_in("/Users/me/code/shop", has(&[]), "/Users/me").unwrap_err().contains("No compose.yaml"));
        assert!(super::compose_files_in("/Users/me/code/app/node_modules/x", has(&["compose.yaml"]), "/Users/me").unwrap_err().contains("dependency folder"));
        for dir in ["/Users/me/.config/x", "/Users/me/Library/x", "/Users/other/x", "/tmp/x", "/Users/me", "/Users/me/code/node_modules/x"] {
            assert!(super::compose_files_in(dir, has(&["compose.yaml"]), "/Users/me").is_err(), "{dir}");
        }
    }

    #[test]
    fn given_a_shell_probe_when_it_fails_then_only_a_missing_shell_counts_as_no_shell() {
        assert_eq!(super::shell_probe_verdict(true, ""), Ok(true));
        assert_eq!(super::shell_probe_verdict(false, "OCI runtime exec failed: exec: \"bash\": executable file not found in $PATH: unknown"), Ok(false));
        assert!(super::shell_probe_verdict(false, "Error response from daemon: container abc is not running").unwrap_err().contains("not running"));
        assert!(super::shell_probe_verdict(false, "Error response from daemon: Container abc is paused, unpause the container before exec").is_err());
        assert!(super::shell_probe_verdict(false, "  ").unwrap_err().contains("5 seconds"));
    }

    #[test]
    fn given_one_path_when_revealed_then_it_must_be_a_listed_compose_file() {
        assert_eq!(super::compose_paths("/Users/me/code/shop/compose.yaml", "/Users/me").len(), 1);
        assert!(super::compose_paths("/Users/me/code/shop/secrets.txt", "/Users/me").is_empty());
        // Relative paths would resolve against the app's working folder, which is / when opened from Finder.
        assert!(super::compose_paths("tmp/compose.yml", "/Users/me").is_empty());
        assert!(super::compose_paths("Users/me/x/compose.yml", "/Users/me").is_empty());
    }

    #[test]
    fn given_a_folder_name_with_a_newline_when_spotlight_lists_it_then_it_stays_one_path() {
        let odd = "/Users/me/code/we\nird/compose.yml";
        assert_eq!(super::compose_paths(&format!("{odd}\0"), "/Users/me"), vec![odd]);
    }

    #[test]
    fn given_more_files_than_the_cap_when_filtered_then_one_extra_is_kept_to_signal_the_cut() {
        let out: String = (0..400).map(|i| format!("/Users/me/p{i:03}/compose.yml\0")).collect();
        assert_eq!(super::compose_paths(&out, "/Users/me").len(), super::COMPOSE_MAX + 1);
    }

    #[test]
    fn given_the_compose_names_when_queried_then_each_is_an_exact_name_match() {
        assert_eq!(super::compose_query().matches("kMDItemFSName ==").count(), 4);
    }
    #[test]
    fn given_the_run_panel_shape_when_checked_then_it_is_accepted() {
        let a = |v: &[&str]| v.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        let h = "/Users/me";
        assert!(super::run_args_ok(&a(&["run", "-d", "nginx"]), h).is_ok());
        assert!(super::run_args_ok(&a(&["run", "-d", "--name", "web-1", "--network", "devnet", "-p", "127.0.0.1:8080:80", "-p", "127.0.0.1::5432", "-p", "9000:9000", "-v", "pgdata:/var/lib/postgresql/data", "-v", "/Users/me/code/app:/app", "-e", "POSTGRES_PASSWORD=a=b c", "postgres:16"]), h).is_ok());
    }

    #[test]
    fn given_a_host_escape_when_run_is_checked_then_it_is_refused() {
        let a = |v: &[&str]| v.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        let h = "/Users/me";
        for bad in [
            vec!["run", "-d", "-v", "/:/host", "alpine"],
            vec!["run", "-d", "-v", "/var/run:/r", "alpine"],
            vec!["run", "-d", "-v", "/Users/me:/h", "alpine"],
            vec!["run", "-d", "-v", "/Users/me/.ssh:/k", "alpine"],
            vec!["run", "-d", "-v", "/Users/me/code/../.zshrc:/z", "alpine"],
            vec!["run", "-d", "-v", "/Users/meother/x:/x", "alpine"],
            vec!["run", "-d", "--mount", "type=bind,src=/,dst=/h", "alpine"],
            vec!["run", "-d", "--env-file", "/Users/me/.aws/credentials", "alpine"],
            vec!["run", "-d", "--cidfile", "/Users/me/x", "alpine"],
            vec!["run", "-d", "--volumes-from", "db", "alpine"],
            vec!["run", "-d", "--privileged", "alpine"],
            vec!["run", "-d", "--network", "host", "alpine"],
            vec!["run", "-d", "-p", "0.0.0.0:80:80", "alpine"],
            vec!["run", "-d", "alpine", "sh"],
            vec!["run", "-d", "--rm"],
            vec!["run", "--privileged", "alpine"],
        ] {
            assert!(super::run_args_ok(&a(&bad), h).is_err(), "{bad:?} should be refused");
        }
    }

    #[test]
    fn given_a_command_that_hangs_when_run_with_a_deadline_then_it_is_killed_and_says_so() {
        let mut c = std::process::Command::new("/bin/sleep");
        c.arg("5");
        let t = std::time::Instant::now();
        let (ok, _, err) = super::output_with_deadline(c, std::time::Duration::from_millis(300)).unwrap();
        assert!(!ok);
        assert!(t.elapsed() < std::time::Duration::from_secs(2));
        assert!(String::from_utf8_lossy(&err).contains("Stopped after"));
    }

    #[test]
    fn given_a_child_that_forks_when_the_deadline_hits_then_the_whole_group_dies() {
        // The grandchild holds stdout open; killing only sh would leave the readers waiting forever.
        let mut c = std::process::Command::new("/bin/sh");
        c.args(["-c", "sleep 30 & wait"]);
        let t = std::time::Instant::now();
        let (ok, _, _) = super::output_with_deadline(c, std::time::Duration::from_millis(300)).unwrap();
        assert!(!ok);
        assert!(t.elapsed() < std::time::Duration::from_secs(3), "took {:?}", t.elapsed());
    }

    #[test]
    fn given_a_quick_command_when_run_with_a_deadline_then_its_output_comes_back() {
        let mut c = std::process::Command::new("/bin/echo");
        c.arg("hi");
        let (ok, out, _) = super::output_with_deadline(c, std::time::Duration::from_secs(5)).unwrap();
        assert!(ok);
        assert_eq!(String::from_utf8_lossy(&out).trim(), "hi");
    }

    #[test]
    fn given_a_path_like_profile_name_when_checked_then_it_is_refused() {
        assert!(super::profile_name_ok("default"));
        assert!(super::profile_name_ok("work_2"));
        assert!(!super::profile_name_ok("../etc"));
        assert!(!super::profile_name_ok("a/b"));
        assert!(!super::profile_name_ok(".hidden"));
        assert!(!super::profile_name_ok(""));
    }

    #[test]
    fn given_the_default_profile_when_locating_its_lima_dir_then_it_is_named_colima() {
        assert!(super::lima_dir("default").ends_with(".colima/_lima/colima"));
        assert!(super::lima_dir("dev").ends_with(".colima/_lima/colima-dev"));
    }

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
    fn rename_and_restart_are_allowed_only_in_the_shape_fix_uses() {
        assert!(docker_args_allowed(&args(&["rename", "kafka", "kafka-old"])).is_ok());
        for a in [&["rename", "kafka"][..], &["rename", "kafka", "-x"], &["rename", "kafka", "a b"], &["rename", "a", "b", "c"]] {
            assert!(docker_args_allowed(&args(a)).is_err(), "{a:?}");
        }
        for v in ["no", "always", "unless-stopped", "on-failure", "on-failure:3"] {
            assert!(docker_args_allowed(&args(&["run", "-d", "--restart", v, "x"])).is_ok(), "{v}");
        }
        for v in ["sometimes", "on-failure:x", "always;rm"] {
            assert!(docker_args_allowed(&args(&["run", "-d", "--restart", v, "x"])).is_err(), "{v}");
        }
    }

    #[test]
    fn update_is_allowed_only_to_set_a_restart_policy_on_one_container() {
        assert!(docker_args_allowed(&args(&["update", "--restart", "no", "kafka-old"])).is_ok());
        assert!(docker_args_allowed(&args(&["update", "--restart", "on-failure:3", "kafka"])).is_ok());
        for a in [
            &["update", "--memory", "1g", "kafka"][..],
            &["update", "--restart", "sometimes", "kafka"],
            &["update", "--restart", "no", "-x"],
            &["update", "--restart", "no", "a", "b"],
            &["update", "--restart=no", "kafka"],
        ] {
            assert!(docker_args_allowed(&args(a)).is_err(), "{a:?}");
        }
    }

    #[test]
    fn fix_reads_a_container_by_type_and_checks_a_run_before_it() {
        assert!(docker_args_allowed(&args(&["inspect", "--type", "container", "--format", "{{.Name}}", "kafka-old"])).is_ok());
        assert!(super::docker_check(args(&["run", "-d", "--name", "kafka", "-p", "127.0.0.1:9092:9092", "apache/kafka:latest"])).is_ok());
        // The env keys Spring-style apps use are refused, and Fix must hear that before it stops anything.
        assert!(super::docker_check(args(&["run", "-d", "-e", "spring.config.x=1", "x"])).is_err());
        assert!(super::docker_check(args(&["exec", "kafka", "sh"])).is_err());
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
        assert!(a.contains(&NETSHOOT_IMAGE.to_string()));
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
    fn given_the_app_s_own_docker_calls_when_checked_then_they_pass() {
        for ok in [
            vec!["ps", "-a", "--format", "{{json .}}"],
            vec!["ps", "--filter", "network=devnet", "--format", "{{json .}}"],
            vec!["ps", "-a", "-q"],
            vec!["stats", "--no-stream", "--format", "{{json .}}"],
            vec!["stats", "--no-stream", "abc", "--format", "{{json .}}"],
            vec!["logs", "--tail", "1000", "abc"],
            vec!["logs", "--timestamps", "--since", "1700000000.5", "abc"],
            vec!["logs", "--since", "100", "--until", "220", "web"],
            vec!["search", "--limit", "25", "redis", "--format", "{{json .}}"],
            vec!["system", "df", "-v", "--format", "json"],
            vec!["image", "prune", "-a", "-f"],
            vec!["network", "create", "devnet"],
            vec!["network", "connect", "devnet", "web"],
            vec!["rm", "-f", "web"],
            vec!["rmi", "redis:7"],
            vec!["volume", "rm", "a", "b"],
            vec!["inspect", "a", "b"],
        ] {
            assert!(docker_args_allowed(&args(&ok)).is_ok(), "{ok:?} should pass");
        }
    }

    #[test]
    fn given_a_flag_the_app_never_sends_when_checked_then_it_is_refused() {
        for bad in [
            vec!["logs", "-f", "abc"],
            vec!["logs", "--follow", "abc"],
            vec!["stats"],
            vec!["stats", "abc"],
            vec!["network", "create", "-d", "macvlan", "-o", "parent=eth0", "lan"],
            vec!["rmi", "-f", "x"],
            vec!["volume", "rm", "-f", "x"],
            vec!["image", "prune", "--filter", "until=1h"],
            vec!["ps", "--size"],
            vec!["logs", "--tail"],
            vec!["inspect", "--size", "x"],
        ] {
            assert!(docker_args_allowed(&args(&bad)).is_err(), "{bad:?} should be refused");
        }
    }

    #[test]
    fn given_a_container_name_when_a_shell_is_asked_then_only_a_plain_exec_is_built() {
        let ok = super::terminal_command("shell", "colima", Some("shop-api-1")).unwrap();
        assert!(ok.ends_with("--context colima exec -it shop-api-1 sh"));
        assert!(super::terminal_command("shell", "colima", Some("x --privileged")).is_err());
        assert!(super::terminal_command("shell", "colima", Some("-u root")).is_err());
        assert!(super::terminal_command("shell", "colima", None).is_err());
        assert!(super::terminal_command("k9s", "colima", Some("x")).is_err());
        assert!(super::terminal_command("bash", "colima", Some("x")).unwrap().ends_with(" exec -it x bash"));
        assert!(super::terminal_command("zsh", "colima", Some("x")).is_err());
        let debug = super::terminal_command("debug", "colima", Some("worker")).unwrap();
        assert!(debug.ends_with(" --context colima run --rm -it --pid container:worker --network container:worker --cap-add SYS_PTRACE busybox:1.36 sh"), "{debug}");
        assert!(super::terminal_script(&debug).is_some());
        assert!(super::terminal_command("debug", "colima", Some("x;rm")).is_err());
        assert!(super::terminal_script("docker exec x sh; open /").is_none());
        assert!(super::terminal_command("shell", "default", Some("x")).is_err());
    }

    #[test]
    fn docker_run_refuses_host_networking() {
        assert!(docker_args_allowed(&args(&["run", "--network", "host", "x"])).is_err());
        assert!(docker_args_allowed(&args(&["run", "--network=host", "x"])).is_err());
        assert!(docker_args_allowed(&args(&["run", "--net=host", "x"])).is_err());
        assert!(docker_args_allowed(&args(&["run", "-d", "--network", "devnet", "x"])).is_ok());
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
        // Homebrew's installer line is fixed text, with its quotes escaped for AppleScript; nothing is taken from outside.
        assert!(BREW_INSTALL_SCRIPT.contains("Homebrew/install/HEAD/install.sh"));
        assert!(BREW_INSTALL_SCRIPT.contains("-c \\\""));
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
        assert!(!context_ok("colima-x --readonly=false"));
        assert!(!context_ok("colima-a/b"));
        assert!(!context_ok("colima-.."));
    }


    #[test]
    fn given_a_folder_in_the_mac_library_when_run_is_checked_then_it_is_refused() {
        let h = "/Users/me";
        assert!(!run_source_ok("/Users/me/Library", h));
        assert!(!run_source_ok("/Users/me/Library/Application Support/x", h));
        assert!(!run_source_ok("/Users/me/Library/Keychains", h));
        assert!(!run_source_ok("/Users/me/library/LaunchAgents", h));
        assert!(!run_source_ok("/Users/me/LIBRARY", h));
        assert!(run_source_ok("/Users/me/Libraryx/a", h));
        assert!(run_source_ok("/Users/me/code/Library", h));
        assert!(run_args_ok(&args(&["run", "-d", "-v", "/Users/me/Library/x:/x", "alpine"]), h).is_err());
    }

    #[test]
    fn given_a_ro_suffix_when_a_mount_is_checked_then_only_ro_is_accepted() {
        let h = "/Users/me";
        let run = |v: &str| run_args_ok(&args(&["run", "-d", "-v", v, "alpine"]), h);
        assert!(run("/Users/me/code:/app:ro").is_ok());
        assert!(run("pgdata:/data:ro").is_ok());
        assert!(run("/Users/me/code:/app").is_ok());
        for bad in ["/Users/me/code:/app:rw", "/Users/me/code:/app:z", "/Users/me/code:/app:ro:z", "/Users/me/code:/app:ro:ro", "/Users/me/code:ro", "/Users/me/.ssh:/k:ro", "/Users/me/Library/x:/k:ro", "/:/h:ro"] {
            assert!(run(bad).is_err(), "{bad} should be refused");
        }
    }

    #[test]
    fn given_a_chosen_folder_when_osascript_answers_then_the_slash_and_newline_are_trimmed() {
        assert_eq!(parse_pick_folder(true, b"/Users/me/code/app/\n", b""), Ok(Some("/Users/me/code/app".to_string())));
        assert_eq!(parse_pick_folder(true, b"/Users/me/code\n", b""), Ok(Some("/Users/me/code".to_string())));
    }

    #[test]
    fn given_the_user_cancels_the_folder_chooser_then_the_answer_is_none() {
        let err = b"0:62: execution error: User canceled. (-128)\n";
        assert_eq!(parse_pick_folder(false, b"", err), Ok(None));
    }

    #[test]
    fn given_osascript_fails_for_another_reason_then_the_message_is_returned() {
        let r = parse_pick_folder(false, b"", b"Stopped after 300s with no answer.");
        assert!(r.unwrap_err().contains("Stopped after"));
    }

    #[test]
    fn the_doctor_helper_image_is_pinned_to_a_tag() {
        assert_eq!(NETSHOOT_IMAGE, "nicolaka/netshoot:v0.16");
        let a = probe_args("colima", "kafka-ui", "kafka", 9092);
        assert!(a.contains(&NETSHOOT_IMAGE.to_string()));
        assert!(!a.contains(&"nicolaka/netshoot".to_string()));
    }

    #[test]
    fn given_builder_prune_when_checked_then_only_the_forced_form_is_allowed() {
        assert!(docker_args_allowed(&args(&["builder", "prune", "-f"])).is_ok());
        assert!(docker_args_allowed(&args(&["builder", "prune"])).is_ok());
        for bad in [&["builder", "prune", "-a"][..], &["builder", "prune", "--all"], &["builder", "build", "."], &["builder", "prune", "--filter", "until=1h"], &["builder"]] {
            assert!(docker_args_allowed(&args(bad)).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn given_system_df_with_a_format_when_checked_then_it_is_allowed() {
        assert!(docker_args_allowed(&args(&["system", "df", "--format", "{{json .}}"])).is_ok());
        assert!(docker_args_allowed(&args(&["system", "df", "--format", "json"])).is_ok());
        assert!(docker_args_allowed(&args(&["system", "df", "-v", "--format", "json"])).is_ok());
        assert!(docker_args_allowed(&args(&["system", "df", "--bogus"])).is_err());
    }

    #[test]
    fn given_a_child_that_ignores_the_wait_when_bounded_then_it_gives_up() {
        let mut child = Command::new("/bin/sleep").arg("30").spawn().unwrap();
        let t = Instant::now();
        assert!(wait_bounded(&mut child, Duration::from_millis(300)).is_none());
        assert!(t.elapsed() < Duration::from_secs(2));
        let _ = child.kill();
        let _ = child.wait();
    }

    #[test]
    fn given_a_child_that_exits_when_bounded_then_its_status_comes_back() {
        let mut child = Command::new("/usr/bin/true").spawn().unwrap();
        assert!(wait_bounded(&mut child, Duration::from_secs(5)).unwrap().success());
    }

    #[test]
    fn given_cancel_during_the_stop_when_the_steps_run_then_the_start_never_runs() {
        let cancelled = AtomicBool::new(false);
        let mut ran: Vec<String> = Vec::new();
        let steps = vec![args(&["stop", "dev"]), args(&["start", "dev"])];
        let r = run_steps(&steps, &cancelled, |a| {
            ran.push(a[0].clone());
            cancelled.store(true, Ordering::SeqCst);
            Ok(())
        });
        assert!(r.is_err());
        assert_eq!(ran, ["stop"]);
    }

    #[test]
    fn given_no_cancel_when_the_steps_run_then_all_run_in_order() {
        let cancelled = AtomicBool::new(false);
        let mut ran: Vec<String> = Vec::new();
        let steps = vec![args(&["stop", "dev"]), args(&["start", "dev"])];
        assert!(run_steps(&steps, &cancelled, |a| { ran.push(a[0].clone()); Ok(()) }).is_ok());
        assert_eq!(ran, ["stop", "start"]);
    }

    #[test]
    fn given_a_step_that_fails_when_the_steps_run_then_the_next_one_is_skipped() {
        let cancelled = AtomicBool::new(false);
        let mut ran = 0;
        let steps = vec![args(&["stop", "dev"]), args(&["start", "dev"])];
        let r = run_steps(&steps, &cancelled, |_| { ran += 1; Err("boom".to_string()) });
        assert_eq!(r, Err("boom".to_string()));
        assert_eq!(ran, 1);
    }

    #[test]
    fn rejects_flag_like_names() {
        assert!(safe("--all").is_err());
        assert!(safe("").is_err());
        assert!(safe("nginx:1.27").is_ok());
    }

    // ---- round 35: folders shared with the VM, the Mac's network, the VM's name lookup ----
    fn mount(path: &str, writable: bool) -> MountSpec {
        MountSpec { path: path.to_string(), writable }
    }

    #[test]
    fn given_a_profile_name_when_its_config_path_is_built_then_it_is_inside_colima_and_bad_names_are_refused() {
        assert_eq!(config_path("/Users/me", "work"), std::path::PathBuf::from("/Users/me/.colima/work/colima.yaml"));
        assert!(colima_config("../x".into()).is_err());
        assert!(colima_config("-h".into()).is_err());
    }

    #[test]
    fn given_the_dns_probe_when_its_arguments_are_built_then_it_is_one_fixed_read_only_lookup_in_that_profile() {
        assert_eq!(dns_probe_args("work"), ["ssh", "--profile", "work", "--", "getent", "hosts", "registry-1.docker.io"]);
    }

    #[test]
    fn given_getent_results_when_judged_then_only_a_clear_not_found_is_a_failure() {
        assert_eq!(dns_verdict(Some(0), "2600:1f18::1 registry-1.docker.io\n"), "resolved");
        assert_eq!(dns_verdict(Some(0), ""), "unknown");
        assert_eq!(dns_verdict(Some(2), ""), "failed");
        assert_eq!(dns_verdict(Some(255), ""), "unknown", "ssh could not connect");
        assert_eq!(dns_verdict(Some(1), ""), "unknown", "colima itself failed");
        assert_eq!(dns_verdict(None, ""), "unknown", "killed at the deadline");
    }

    #[test]
    fn given_folders_when_checked_for_sharing_then_system_folders_other_users_hidden_and_odd_paths_are_refused() {
        let home = "/Users/me";
        for ok in ["/Users/me", "/Users/me/code/api", "/Users/me/My Apps/x", "/Volumes/data/in", "/opt/data/x"] {
            assert!(mount_ok(ok, home), "{ok}");
        }
        for bad in ["/", "/Users", "/Users/other/x", "/Users/me/Library/x", "/Users/me/library", "/Users/me/.ssh", "/etc/x", "/System/x", "/private/etc/x", "/Volumes", "/a,b/c", "/a\"b/c", "rel/x", "/Users/me/../x", "/Users//me", "/Users/me/a:b", "/Users/me/a\nb"] {
            assert!(!mount_ok(bad, home), "{bad}");
        }
        assert!(!mount_ok("/Users/me", ""), "no home known");
    }

    #[test]
    fn given_the_full_list_when_the_steps_are_built_then_the_vm_stops_then_starts_with_every_folder_and_writable_ones_end_in_w() {
        let steps = mounts_steps("work", &[mount("/Users/me", true), mount("/Volumes/data/in", false)], "/Users/me", |_| true, true).unwrap();
        assert_eq!(steps[0], ["stop", "work"]);
        assert_eq!(steps[1], ["start", "work", "--mount", "/Users/me:w", "--mount", "/Volumes/data/in"]);
        assert_eq!(steps.len(), 2);
        let stopped = mounts_steps("work", &[mount("/Users/me", true)], "/Users/me", |_| true, false).unwrap();
        assert_eq!(stopped, vec![["start", "work", "--mount", "/Users/me:w"]], "a VM that is already stopped is only started");
    }

    #[test]
    fn given_a_refused_list_when_the_steps_are_built_then_nothing_would_stop_and_the_message_says_so() {
        let home = "/Users/me";
        let err = |m: &[MountSpec], dir: bool| mounts_steps("work", m, home, move |_| dir, true).unwrap_err();
        assert!(err(&[], true).starts_with("Nothing changed"));
        assert!(err(&[mount("/etc", true)], true).starts_with("Nothing changed"));
        assert!(err(&[mount("/Volumes/a", true), mount("/Volumes/ab", true)], true).contains("starts like"));
        assert!(err(&[mount("/Volumes/file.txt", true)], false).contains("not a folder"));
        assert!(err(&[mount("/Volumes/a,b", true)], true).starts_with("Nothing changed"));
    }

    #[test]
    fn given_the_saved_settings_when_the_env_steps_are_built_then_each_is_its_own_flag_and_odd_ones_are_refused() {
        let env = vec![("TZ".to_string(), "UTC".to_string()), ("HTTP_PROXY".to_string(), "http://proxy.corp:8080".to_string())];
        let steps = env_steps("default", &env, true).unwrap();
        assert_eq!(steps[0], ["stop", "default"]);
        assert_eq!(steps[1], ["start", "default", "--env", "TZ=UTC", "--env", "HTTP_PROXY=http://proxy.corp:8080"]);
        for (k, v) in [("LD_PRELOAD", "x"), ("PATH", "/x"), ("1BAD", "x"), ("A-B", "x"), ("OK", "a,b"), ("OK", "a\"b"), ("OK", "a\nb")] {
            assert!(env_steps("default", &[(k.to_string(), v.to_string())], true).unwrap_err().starts_with("Nothing changed"), "{k}={v}");
        }
        assert!(env_steps("default", &[], true).is_err());
        assert_eq!(env_steps("default", &env, false).unwrap(), vec![steps[1].clone()], "a stopped VM is only started");
    }

    #[test]
    fn given_a_profile_name_when_the_vm_log_is_asked_for_then_only_a_real_profile_with_a_log_resolves() {
        for bad in ["", "-a", ".hidden", "../x", "a/b", "a b"] {
            assert!(super::vm_log_path(bad).unwrap_err().starts_with("Invalid profile name"), "{bad:?}");
        }
        assert!(super::lima_dir("default").ends_with(".colima/_lima/colima"));
        assert!(super::lima_dir("work").join("ha.stderr.log").ends_with("_lima/colima-work/ha.stderr.log"));
        assert_eq!(super::vm_log_path("no-such-profile-zz9").unwrap_err(), "The VM has no log yet.");
    }

    #[test]
    fn given_the_way_back_when_forced_then_it_stops_by_force_once_and_starts_with_the_old_list() {
        let plain = super::mounts_steps("work", &[mount("/Users/me", true)], "/Users/me", |_| true, true).unwrap();
        let f = super::forced(plain, "work");
        assert_eq!(f, vec![vec!["stop", "--force", "work"], vec!["start", "work", "--mount", "/Users/me:w"]]);
        let already_stopped = super::mounts_steps("work", &[mount("/Users/me", true)], "/Users/me", |_| true, false).unwrap();
        assert_eq!(super::forced(already_stopped, "work"), f);
    }
}
