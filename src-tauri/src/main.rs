#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::io::{BufReader, Read};
use std::os::unix::process::CommandExt;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, TryLockError};
use std::time::{Duration, Instant};
use tauri::Emitter;

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
    &["ps", "images", "search", "logs", "inspect", "stats", "start", "stop", "restart", "pause", "unpause", "rm", "rmi", "run"];

fn docker_args_allowed(args: &[String]) -> Result<(), String> {
    let first = args.first().map(String::as_str).unwrap_or("");
    let second = args.get(1).map(String::as_str).unwrap_or("");
    let ok = match first {
        "volume" => matches!(second, "ls" | "rm"),
        "image" => matches!(second, "inspect" | "prune"),
        "system" => second == "df",
        "builder" => second == "prune",
        "network" => matches!(second, "ls" | "create" | "inspect" | "connect" | "disconnect" | "rm"),
        "events" => events_args_ok(args),
        other => DOCKER_SUBCOMMANDS.contains(&other),
    };
    if !ok || (first != "run" && first != "events" && !flags_ok(args)) {
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
        "images" | "inspect" | "volume ls" | "image inspect" | "network ls" | "network inspect" => (&[], FMT),
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
    let plain = !command.is_empty() && command.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | '/' | '.' | '_' | '-'));
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

fn terminal_command(kind: &str, context: &str, target: Option<&str>) -> Result<String, String> {
    if !context_ok(context) {
        return Err(format!("Unknown context \"{context}\""));
    }
    match (kind, target) {
        ("k9s", None) => Ok(format!("{} --context {}", find_bin("k9s"), context)),
        ("shell", Some(name)) if run_name_ok(name) => Ok(format!("{} --context {} exec -it {} sh", find_bin("docker"), context, name)),
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

pub(crate) fn output_with_deadline(mut cmd: Command, deadline: std::time::Duration) -> std::io::Result<(bool, Vec<u8>, Vec<u8>)> {
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
    let (o, mut e) = (out.join().unwrap_or_default(), err.join().unwrap_or_default());
    if status.is_none() {
        e.extend_from_slice(format!("\nStopped after {}s with no answer. Docker or Colima may be stuck; try restarting the VM.", deadline.as_secs()).as_bytes());
    }
    Ok((status.map_or(false, |s| s.success()), o, e))
}

async fn exec(bin: &'static str, args: Vec<String>, merge_stderr: bool) -> Result<String, String> {
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

fn stream(app: &tauri::AppHandle, event: &str, bin: &str, args: &[String]) -> Result<(), String> {
    stream_with(app, event, bin, args, STREAM_SILENCE, |_| {})
}

fn stream_with(app: &tauri::AppHandle, event: &str, bin: &str, args: &[String], silence: Duration, on_spawn: impl Fn(Option<u32>)) -> Result<(), String> {
    let mut child = Command::new("sh")
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
async fn pick_folder() -> Result<Option<String>, String> {
    if !cfg!(target_os = "macos") {
        return Err("Choosing a folder is only supported on macOS".into());
    }
    tauri::async_runtime::spawn_blocking(|| {
        let mut cmd = Command::new("/usr/bin/osascript");
        cmd.args(["-e", PICK_FOLDER_SCRIPT]);
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

// Shows one Compose file in Finder. Only a file the scan would list is accepted.
#[tauri::command]
fn reveal_compose(path: String) -> Result<(), String> {
    let home = std::env::var("HOME").unwrap_or_default();
    if compose_paths(&path, &home) != [path.as_str()] {
        return Err("Only a Compose file in your home folder can be shown".into());
    }
    Command::new("/usr/bin/open").args(["-R", &path]).spawn().map(|_| ()).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_profiles, docker, docker_pull, env_check, install_tools, network_probe, kubectl, open_terminal, start_profile, apply_resources,
            stop_profile, force_stop_profile, restart_profile, force_restart_profile, delete_profile, cancel_vm_op, host_resources, vm_log_tail, open_url, pick_folder, setup_report, setup_fix, find_compose_files, reveal_compose
        ])
        .run(tauri::generate_context!())
        .expect("error while running Colima UI");
}

#[cfg(test)]
mod tests {

    #[test]
    fn given_spotlight_output_when_filtered_then_only_compose_files_in_ordinary_home_folders_stay() {
        let out = "/Users/me/code/shop/compose.yaml\0/Users/me/code/shop/compose.yaml\0/Users/me/.config/x/docker-compose.yml\0/Users/me/Library/App/compose.yml\0/Users/me/library/App/compose.yml\0/Users/me/code/app/node_modules/pkg/docker-compose.yml\0/Users/me/go/pkg/mod/github.com/x/compose.yml\0/Users/me/code/blog/docker-compose.yml\0/Users/me/code/blog/compose.override.yml\0/Users/other/code/compose.yml\0/Users/me/compose.yml\0";
        assert_eq!(super::compose_paths(out, "/Users/me"), vec!["/Users/me/code/blog/docker-compose.yml", "/Users/me/code/shop/compose.yaml"]);
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
            vec!["inspect", "--type", "container", "x"],
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
        assert!(super::terminal_command("bash", "colima", Some("x")).is_err());
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
}
