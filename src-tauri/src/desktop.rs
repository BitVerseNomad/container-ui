// Bring Docker Desktop's volumes and images into Colima. Docker Desktop's data is only read: a volume is mounted
// read-only and streamed out as tar, an image is `docker save`d. On its side the app only runs throwaway busybox
// containers (removed after) and, when the user agrees, stops a container that is writing to a volume being copied.
// Nothing there is deleted, so Docker Desktop keeps its copy.
use serde::Serialize;
use std::io::{Read, Write};
use std::os::unix::fs::MetadataExt;
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::Emitter;

use crate::{context_ok, find_bin, kill_group, output_with_deadline, path_env, read_capped, run_name_ok, wait_bounded, BUSYBOX_IMAGE};

const DESKTOP_CTX: &str = "desktop-linux";
const DESKTOP_APP: &str = "/Applications/Docker.app";
// Where Docker Desktop keeps its VM disk; it stays behind when the app is dragged to the Trash.
pub(crate) const DESKTOP_DISK: &str = "Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw";
const QUICK: Duration = Duration::from_secs(60);
// A copy can take minutes, but the bytes never stop that long; past this it is stuck (a sleeping Mac, a dead VM).
const COPY_SILENCE: Duration = Duration::from_secs(600);
// `docker load` unpacks after the stream ends; a big image can take many minutes with nothing to show.
const AFTER_LAST_BYTE: Duration = Duration::from_secs(3600);

#[derive(Serialize)]
pub struct DesktopState {
    installed: bool,
    running: bool,
    // What the leftover VM disk really takes (it is a sparse file, so its length says nothing). 0 when absent.
    disk_bytes: u64,
}

fn disk_bytes(home: &Path) -> u64 {
    std::fs::metadata(home.join(DESKTOP_DISK)).map_or(0, |m| m.blocks() * 512)
}

fn docker_cmd(args: &[&str]) -> Command {
    let mut c = Command::new(find_bin("docker"));
    c.args(args).env("PATH", path_env());
    c
}

#[tauri::command]
pub async fn desktop_state() -> Result<DesktopState, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let home = std::path::PathBuf::from(std::env::var("HOME").unwrap_or_default());
        // A short wait: when Docker Desktop is closed the socket is gone and this fails at once.
        let running = output_with_deadline(docker_cmd(&["--context", DESKTOP_CTX, "info", "--format", "{{.ServerVersion}}"]), Duration::from_secs(8)).map_or(false, |(ok, _, _)| ok);
        DesktopState { installed: Path::new(DESKTOP_APP).exists(), running, disk_bytes: disk_bytes(&home) }
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_docker_desktop() -> Result<(), String> {
    if !Path::new(DESKTOP_APP).exists() {
        return Err("Docker Desktop isn't installed".into());
    }
    Command::new("open").args(["-a", DESKTOP_APP]).spawn().map(|_| ()).map_err(|e| e.to_string())
}

// The lists the panel reads from Docker Desktop, and nothing else.
fn desktop_args_ok(args: &[String]) -> bool {
    let w: Vec<&str> = args.iter().map(String::as_str).collect();
    matches!(
        w.as_slice(),
        ["volume", "ls", "--format", "json"] | ["system", "df", "-v", "--format", "json"] | ["images", "--format", "json"] | ["ps", "--filter", "status=running", "--format", "json"]
    )
}

#[tauri::command]
pub async fn desktop_docker(args: Vec<String>) -> Result<String, String> {
    if !desktop_args_ok(&args) {
        return Err(format!("\"docker {}\" is not available for Docker Desktop", args.join(" ")));
    }
    let mut a = vec!["--context".to_string(), DESKTOP_CTX.to_string()];
    a.extend(args);
    crate::exec("docker", a, false).await
}

// repo[:tag] or repo@sha256:..., as `docker images` prints them. Never a flag, never a space.
fn image_ref_ok(r: &str) -> bool {
    r.chars().next().map_or(false, |c| c.is_ascii_alphanumeric())
        && r.len() <= 255
        && !r.contains("<none>")
        && r.chars().all(|c| c.is_ascii_alphanumeric() || "/:._-@".contains(c))
}

fn label_ok(k: &str, v: &str) -> bool {
    !k.is_empty() && !k.contains('=') && !format!("{k}{v}").chars().any(char::is_control)
}

// The helpers are named, so a stop or a failure can remove them: killing the docker CLI leaves the container running.
fn volume_out(name: &str, helper: &str) -> Vec<String> {
    strs(&["--context", DESKTOP_CTX, "run", "--rm", "--name", helper, "-v", &format!("{name}:/from:ro"), BUSYBOX_IMAGE, "tar", "-cf", "-", "-C", "/from", "."])
}

fn volume_in(context: &str, name: &str, helper: &str) -> Vec<String> {
    strs(&["--context", context, "run", "--rm", "-i", "--name", helper, "-v", &format!("{name}:/to"), BUSYBOX_IMAGE, "tar", "-xpf", "-", "-C", "/to"])
}

// Files and folders in the volume, then the bytes in its files, to check the copy has all of them. Read-only on
// both sides. -e and pipefail (busybox ash has both) make a find or stat that fails partway fail the count instead
// of printing a short number. Sizes come from stat, so no file is read; busybox du has no apparent-size flag.
// printf "%.0f": awk sums in floating point, and a plain print would write a big total as 1.2e+10.
fn volume_count(context: &str, name: &str) -> Vec<String> {
    strs(&["--context", context, "run", "--rm", "-v", &format!("{name}:/v:ro"), BUSYBOX_IMAGE, "sh", "-c", "set -eo pipefail; find /v -type f -o -type d | wc -l; find /v -type f -exec stat -c %s {} + | awk '{s+=$1} END {printf \"%.0f\\n\", s}'"])
}

// Counting walks every file: ten minutes, and one more per 5 GB of the volume (Docker Desktop's size, an estimate).
fn count_deadline(bytes: u64) -> Duration {
    Duration::from_secs(600 + 60 * (bytes / 5_000_000_000))
}

// The panel's size is a guess from `system df`; the bytes the copy streamed are real. The bigger one sets the wait.
fn count_wait(panel: u64, streamed: u64) -> Duration {
    count_deadline(panel.max(streamed))
}

// (files and folders, bytes), from the two lines volume_count prints.
fn parse_count(out: &str) -> Option<(u64, u64)> {
    let mut n = out.split_whitespace().map(|w| w.parse::<u64>().ok());
    match (n.next(), n.next(), n.next()) {
        (Some(Some(f)), Some(Some(b)), None) => Some((f, b)),
        _ => None,
    }
}

// `what` must match `of`. A count that couldn't be read fails: this is the check before data is emptied.
fn compare_counts(what: &str, of: &str, a: Option<(u64, u64)>, b: Option<(u64, u64)>) -> Result<(), String> {
    match (a, b) {
        (Some(x), Some(y)) if x == y => Ok(()),
        (Some((f, _)), Some((g, _))) if f != g => Err(format!("{what} has {g} files and folders, {of} has {f}.")),
        (Some((_, x)), Some((_, y))) => Err(format!("{what} has {y} bytes, {of} has {x}.")),
        _ => Err(format!("{what} couldn't be checked.")),
    }
}

// Compose finds its volumes by these labels; without them it warns that the volume "was not created by Compose".
fn volume_create(context: &str, name: &str, labels: &serde_json::Map<String, serde_json::Value>) -> Vec<String> {
    let mut a: Vec<String> = ["--context", context, "volume", "create"].iter().map(|s| s.to_string()).collect();
    for (k, v) in labels {
        if let Some(v) = v.as_str().filter(|v| label_ok(k, v)) {
            a.push("--label".into());
            a.push(format!("{k}={v}"));
        }
    }
    a.push(name.to_string());
    a
}

// The copy in progress, so Stop can end both sides.
static COPY_PIDS: Mutex<Vec<u32>> = Mutex::new(Vec::new());
static COPY_STOPPED: AtomicBool = AtomicBool::new(false);
static COPY_LOCK: Mutex<()> = Mutex::new(());

// Streams `from`'s stdout into `to`'s stdin and counts the bytes on the way, which is the progress.
// Both run in their own process group, so Stop and the silence watchdog also reach what docker started.
fn pipe(from: (&str, &[String]), to: (&str, &[String]), silence: Duration, mut on_bytes: impl FnMut(u64)) -> Result<u64, String> {
    let spawn = |bin: &str, args: &[String], stdin: Stdio| {
        Command::new(bin).args(args).env("PATH", path_env()).stdin(stdin).stdout(Stdio::piped()).stderr(Stdio::piped()).process_group(0).spawn()
    };
    let mut src = spawn(from.0, from.1, Stdio::null()).map_err(|e| format!("Could not run {}: {e}", from.0))?;
    let mut dst = match spawn(to.0, to.1, Stdio::piped()) {
        Ok(c) => c,
        Err(e) => {
            kill_group(src.id());
            let _ = src.kill();
            let _ = src.wait();
            return Err(format!("Could not run {}: {e}", to.0));
        }
    };
    let pids = [src.id(), dst.id()];
    *COPY_PIDS.lock().unwrap_or_else(|p| p.into_inner()) = pids.to_vec();
    // Stop pressed before the pids were known: end now instead of copying it all.
    if COPY_STOPPED.load(Ordering::SeqCst) {
        pids.iter().for_each(|p| kill_group(*p));
    }
    let (src_err, dst_err) = (read_capped(src.stderr.take().expect("piped")), read_capped(dst.stderr.take().expect("piped")));
    let dst_out = read_capped(dst.stdout.take().expect("piped"));
    let started = Instant::now();
    let last = Arc::new(AtomicU64::new(0));
    let (done, stuck, eof) = (Arc::new(AtomicBool::new(false)), Arc::new(AtomicBool::new(false)), Arc::new(AtomicBool::new(false)));
    let watchdog = {
        let (last, done, stuck, eof) = (last.clone(), done.clone(), stuck.clone(), eof.clone());
        std::thread::spawn(move || {
            while !done.load(Ordering::Relaxed) {
                std::thread::sleep(Duration::from_millis(200));
                // Once every byte is across, the receiver may still be unpacking (`load`), so it gets far longer.
                let limit = if eof.load(Ordering::Relaxed) { AFTER_LAST_BYTE.max(silence) } else { silence };
                if started.elapsed().saturating_sub(Duration::from_millis(last.load(Ordering::Relaxed))) > limit {
                    stuck.store(true, Ordering::Relaxed);
                    pids.iter().for_each(|p| kill_group(*p));
                    return;
                }
            }
        })
    };
    let (mut reader, mut writer) = (src.stdout.take().expect("piped"), dst.stdin.take());
    let mut buf = vec![0u8; 256 << 10];
    let mut total = 0u64;
    loop {
        let n = match reader.read(&mut buf) {
            Ok(0) | Err(_) => break,
            Ok(n) => n,
        };
        last.store(started.elapsed().as_millis() as u64, Ordering::Relaxed);
        // The receiving side stopped (its error is in its stderr): stop reading, so the sender ends too.
        if writer.as_mut().map_or(true, |w| w.write_all(&buf[..n]).is_err()) {
            kill_group(pids[0]);
            break;
        }
        total += n as u64;
        on_bytes(total);
    }
    drop(writer);
    eof.store(true, Ordering::Relaxed);
    // The sender is done once its stream ends; a CLI that hangs here gets the short limit, not the receiver's hour.
    let src_ok = match wait_bounded(&mut src, silence) {
        Some(s) => s.success(),
        None => {
            kill_group(src.id());
            let _ = src.kill();
            let _ = src.wait();
            false
        }
    };
    let dst_ok = match wait_bounded(&mut dst, AFTER_LAST_BYTE + Duration::from_secs(60)) {
        Some(s) => s.success(),
        None => {
            kill_group(dst.id());
            let _ = dst.kill();
            let _ = dst.wait();
            false
        }
    };
    done.store(true, Ordering::Relaxed);
    let _ = watchdog.join();
    COPY_PIDS.lock().unwrap_or_else(|p| p.into_inner()).clear();
    let err = |h: std::thread::JoinHandle<Vec<u8>>| String::from_utf8_lossy(&h.join().unwrap_or_default()).trim().to_string();
    let (se, de) = (err(src_err), err(dst_err));
    let _ = dst_out.join();
    // A Stop that came after both sides finished keeps the finished copy.
    if src_ok && dst_ok {
        return Ok(total);
    }
    if COPY_STOPPED.load(Ordering::SeqCst) {
        return Err("Stopped.".into());
    }
    if stuck.load(Ordering::Relaxed) {
        let limit = if eof.load(Ordering::Relaxed) { AFTER_LAST_BYTE.max(silence) } else { silence };
        return Err(format!("Stopped: nothing happened for {} minutes, so it looked stuck.", (limit.as_secs() / 60).max(1)));
    }
    let msg = [se, de].into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>().join("\n");
    Err(if msg.is_empty() { "The copy failed with no message.".into() } else { msg.chars().take(2000).collect() })
}

fn quick(args: &[String]) -> Result<String, String> {
    let mut c = Command::new(find_bin("docker"));
    c.args(args).env("PATH", path_env());
    let (ok, out, err) = output_with_deadline(c, QUICK).map_err(|e| e.to_string())?;
    if ok { Ok(String::from_utf8_lossy(&out).into_owned()) } else { Err(String::from_utf8_lossy(&err).trim().to_string()) }
}

fn strs(a: &[&str]) -> Vec<String> {
    a.iter().map(|s| s.to_string()).collect()
}

fn colima_users_args(context: &str, name: &str) -> Vec<String> {
    strs(&["--context", context, "ps", "-a", "--filter", &format!("volume={name}"), "--format", "{{.Names}}\t{{.State}}"])
}

// "Docker Desktop" or "Colima", for messages.
fn place(context: &str) -> &'static str {
    if context == DESKTOP_CTX { "Docker Desktop" } else { "Colima" }
}

// Containers that may be writing to the volume: anything not exited, created or dead (a paused or restarting
// database has its files open too). An error is not "nobody": the copy must not run blind.
fn live_users(context: &str, name: &str) -> Result<Vec<(String, String)>, String> {
    let out = quick(&colima_users_args(context, name)).map_err(|e| format!("Couldn't check what uses {name} in {}, so it was not copied. {e}", place(context)))?;
    Ok(parse_users(&out))
}

// Stops what writes to the volume, when the user agreed (`stop_users`), and remembers it so it can be started
// again. Returns the names it stopped. Used for Docker Desktop's side of every copy and Colima's side of a replace.
fn halt(context: &str, name: &str, stop_users: bool) -> Result<Vec<String>, String> {
    let users = live_users(context, name)?;
    if users.is_empty() {
        return Ok(vec![]);
    }
    let names: Vec<String> = users.iter().map(|(n, _)| n.clone()).collect();
    if !stop_users {
        return Err(format!("{} is using {name} in {}. Stop it first for a clean copy.", names.join(" and "), place(context)));
    }
    // A paused container can't be stopped until it runs again.
    let paused: Vec<String> = users.iter().filter(|(_, st)| st == "paused").map(|(n, _)| n.clone()).collect();
    if !paused.is_empty() {
        let mut a = strs(&["--context", context, "unpause"]);
        a.extend(paused);
        quick(&a)?;
    }
    let mut a = strs(&["--context", context, "stop"]);
    a.extend(names.iter().cloned());
    let stopped = quick_for(&a, STOP_WAIT);
    HALTED.lock().unwrap_or_else(|p| p.into_inner()).extend(names.iter().map(|n| (context.to_string(), n.clone())));
    stopped?;
    if !live_users(context, name)?.is_empty() {
        return Err(format!("{name} is still in use in {}, so it was not copied.", place(context)));
    }
    Ok(names)
}

fn parse_users(out: &str) -> Vec<(String, String)> {
    out.lines()
        .filter_map(|l| l.split_once('\t'))
        .map(|(n, st)| (n.trim().to_string(), st.trim().to_string()))
        .filter(|(n, st)| !n.is_empty() && !matches!(st.as_str(), "exited" | "created" | "dead"))
        .collect()
}

// After a failed or stopped copy: remove both helpers, then the half-made volume. The helper must be gone first,
// or the volume is still in use and can't be removed.
fn discard(context: &str, name: &str, helpers: [&str; 2]) -> Result<(), String> {
    let _ = quick(&strs(&["--context", DESKTOP_CTX, "rm", "-f", helpers[0]]));
    let _ = quick(&strs(&["--context", context, "rm", "-f", helpers[1]]));
    for _ in 0..5 {
        if quick(&strs(&["--context", context, "volume", "rm", name])).is_ok() || quick(&strs(&["--context", context, "volume", "inspect", name])).is_err() {
            return Ok(());
        }
        std::thread::sleep(Duration::from_secs(1));
    }
    Err(format!("A partial copy of {name} is left in Colima. Remove it in Volumes before trying again."))
}

static HELPER_N: AtomicU64 = AtomicU64::new(0);
// Containers the copy stopped, with their context. "Start again" may start only these.
static HALTED: Mutex<Vec<(String, String)>> = Mutex::new(Vec::new());
// A database can take a while to shut down cleanly.
const STOP_WAIT: Duration = Duration::from_secs(180);

fn quick_for(args: &[String], deadline: Duration) -> Result<String, String> {
    let mut c = Command::new(find_bin("docker"));
    c.args(args).env("PATH", path_env());
    let (ok, out, err) = output_with_deadline(c, deadline).map_err(|e| e.to_string())?;
    if ok { Ok(String::from_utf8_lossy(&out).into_owned()) } else { Err(String::from_utf8_lossy(&err).trim().to_string()) }
}

// Millions of files take a while to count, so this gets the copy's own patience, not the 60-second one.
fn count(context: &str, name: &str, wait: Duration) -> Option<(u64, u64)> {
    quick_for(&volume_count(context, name), wait).ok().and_then(|o| parse_count(&o))
}

// Docker Desktop's volume streamed into Colima's volume of the same name, then the file counts compared.
// before_count: told when the stream is done and the counting starts, so the panel can say "Checking…".
// size: the panel's size of the volume, for how long the counts may take.
fn stream_in(context: &str, name: &str, helpers: [&str; 2], size: u64, on_bytes: impl FnMut(u64), before_count: impl FnOnce()) -> Result<u64, String> {
    let docker = find_bin("docker");
    pipe((&docker, &volume_out(name, helpers[0])), (&docker, &volume_in(context, name, helpers[1])), COPY_SILENCE, on_bytes).and_then(|bytes| {
        before_count();
        let wait = count_wait(size, bytes);
        match (count(DESKTOP_CTX, name, wait), count(context, name, wait)) {
            (a @ Some(_), b @ Some(_)) if a != b => Err(format!("{} So it was not kept.", compare_counts("The copy", "Docker Desktop", a, b).unwrap_err())),
            // Equal, or a count that couldn't finish: the stream itself ended cleanly on both sides, so the copy stays.
            _ => Ok(bytes),
        }
    })
}

fn copy_volume(context: &str, name: &str, bytes: u64, stop_users: bool, on_bytes: impl FnMut(u64)) -> Result<u64, String> {
    // An existing volume may hold newer data; it is never merged into or replaced.
    if quick(&strs(&["--context", context, "volume", "inspect", name])).is_ok() {
        return Err(format!("Colima already has a volume called {name}, so it was left alone."));
    }
    // A failed inspect means the volume is gone from Docker Desktop; `run -v` would make an empty one there.
    let labels = quick(&strs(&["--context", DESKTOP_CTX, "volume", "inspect", "--format", "{{json .Labels}}", name]))
        .map_err(|_| format!("Docker Desktop no longer has a volume called {name}."))?;
    let labels = serde_json::from_str::<serde_json::Value>(labels.trim()).ok().and_then(|v| v.as_object().cloned()).unwrap_or_default();
    halt(DESKTOP_CTX, name, stop_users)?;
    quick(&volume_create(context, name, &labels))?;
    let n = HELPER_N.fetch_add(1, Ordering::SeqCst);
    let (out, into) = (format!("colima-ui-copy-out-{}-{n}", std::process::id()), format!("colima-ui-copy-in-{}-{n}", std::process::id()));
    let copied = stream_in(context, name, [&out, &into], bytes, on_bytes, || {});
    // Half a database is worse than none, and a leftover would block the next try.
    copied.map_err(|e| match discard(context, name, [&out, &into]) {
        Ok(()) => e,
        Err(left) => format!("{e}\n{left}"),
    })
}

fn copy_image(context: &str, reference: &str, on_bytes: impl FnMut(u64)) -> Result<u64, String> {
    if quick(&strs(&["--context", context, "image", "inspect", reference])).is_ok() {
        return Err(format!("Colima already has {reference}."));
    }
    let docker = find_bin("docker");
    pipe((&docker, &strs(&["--context", DESKTOP_CTX, "save", reference])), (&docker, &strs(&["--context", context, "load", "-q"])), COPY_SILENCE, on_bytes)
}

#[derive(Serialize, Clone)]
struct Step {
    name: String,
    step: String,
}

#[derive(Serialize, Clone)]
struct Progress {
    name: String,
    bytes: u64,
}

// One volume or image per call; the panel calls it for each one it brings over, so one failure never stops the rest.
#[tauri::command]
// bytes: Docker Desktop's size of it, so counting a big volume gets the time it needs.
pub async fn desktop_copy(app: tauri::AppHandle, kind: String, name: String, context: String, stop_users: Option<bool>, bytes: Option<u64>) -> Result<u64, String> {
    if !context_ok(&context) {
        return Err(format!("Unknown Docker context \"{context}\""));
    }
    let valid = match kind.as_str() {
        "volume" => run_name_ok(&name),
        "image" => image_ref_ok(&name),
        _ => false,
    };
    if !valid {
        return Err(format!("\"{name}\" isn't a {kind} name the app can copy"));
    }
    tauri::async_runtime::spawn_blocking(move || {
        let Ok(_guard) = COPY_LOCK.try_lock() else { return Err("Another copy is still running.".to_string()) };
        if COPY_STOPPED.load(Ordering::SeqCst) {
            return Err("Stopped.".to_string());
        }
        let mut sent = Instant::now() - Duration::from_secs(1);
        let report = |bytes: u64| {
            if sent.elapsed() >= Duration::from_millis(200) {
                sent = Instant::now();
                let _ = app.emit("desktop-progress", Progress { name: name.clone(), bytes });
            }
        };
        if kind == "volume" { copy_volume(&context, &name, bytes.unwrap_or(0), stop_users == Some(true), report) } else { copy_image(&context, &name, report) }
    })
    .await
    .map_err(|e| e.to_string())?
}

// Starts again the containers the copy stopped, and only those: Docker Desktop's by default, Colima's with `context`.
#[tauri::command]
pub async fn desktop_start(names: Vec<String>, context: Option<String>) -> Result<(), String> {
    let context = context.unwrap_or_else(|| DESKTOP_CTX.to_string());
    if context != DESKTOP_CTX && !context_ok(&context) {
        return Err(format!("Unknown Docker context \"{context}\""));
    }
    let halted = HALTED.lock().unwrap_or_else(|p| p.into_inner()).clone();
    if names.is_empty() || !names.iter().all(|n| crate::container_name_ok(n) && halted.contains(&(context.clone(), n.clone()))) {
        return Err("The app only starts containers it stopped itself".into());
    }
    tauri::async_runtime::spawn_blocking(move || start_halted(&context, &names))
    .await
    .map_err(|e| e.to_string())?
}

fn start_halted(context: &str, names: &[String]) -> Result<(), String> {
    let mut a = strs(&["--context", context, "start"]);
    a.extend(names.iter().cloned());
    quick(&a)?;
    HALTED.lock().unwrap_or_else(|p| p.into_inner()).retain(|(c, n)| !(c == context && names.contains(n)));
    Ok(())
}

// ---- Replace a nearly empty Colima volume with Docker Desktop's ----
// The usual case: `docker compose up` ran in Colima before the data came over, so Compose made an empty volume.
// Colima's copy goes into a backup volume first (inside Colima, labels kept), then the original is emptied and
// filled from Docker Desktop. The original is never removed, so containers that reference it keep working.

// NAME-colima-backup-YYYYMMDD-HHMM, exactly; the panel names it in local time.
fn backup_name_ok(name: &str, backup: &str) -> bool {
    let Some(stamp) = backup.strip_prefix(name).and_then(|r| r.strip_prefix("-colima-backup-")) else { return false };
    run_name_ok(name) && run_name_ok(backup) && backup.len() <= 255 && stamp.len() == 13 && stamp.char_indices().all(|(i, c)| if i == 8 { c == '-' } else { c.is_ascii_digit() })
}

// Copies one Colima volume into another inside the VM: nothing crosses to the Mac. The source is read-only.
fn volume_fill(context: &str, from: &str, to: &str, helper: &str) -> Vec<String> {
    strs(&["--context", context, "run", "--rm", "--name", helper, "-v", &format!("{from}:/from:ro"), "-v", &format!("{to}:/to"), BUSYBOX_IMAGE, "sh", "-c", "set -o pipefail; tar -cf - -C /from . | tar -xpf - -C /to"])
}

// Only a plain volume Docker keeps inside the VM may be emptied. A local volume with options (device=/Users/...,
// o=bind) is a folder on the Mac: emptying it would delete the user's own files. inspect: `volume inspect
// --format '{{json .}}'`. Anything that can't be read, or names no driver, is refused.
fn plain_volume(name: &str, inspect: &str) -> Result<(), String> {
    let v: serde_json::Value = serde_json::from_str(inspect.trim()).map_err(|_| format!("Colima's `{name}` couldn't be read, so it was left alone."))?;
    let driver = v.get("Driver").and_then(|d| d.as_str()).unwrap_or("");
    if driver != "local" {
        return Err(if driver.is_empty() { format!("Colima's `{name}` couldn't be read, so it was left alone.") } else { format!("Colima's `{name}` uses the {driver} driver, so it was left alone.") });
    }
    let options = v.get("Options").and_then(|o| o.as_object()).map_or(0, |o| o.len());
    if options > 0 {
        return Err(format!("Colima's `{name}` is a folder on your Mac, so it was left alone."));
    }
    Ok(())
}

fn inspect_volume(context: &str, name: &str) -> Result<String, String> {
    quick(&strs(&["--context", context, "volume", "inspect", "--format", "{{json .}}", name])).map_err(|_| format!("Colima no longer has a volume called {name}."))
}

// 1.2 GiB or 300.4 MiB, as the panel writes sizes.
fn size_words(b: u64) -> String {
    let mib = b as f64 / (1024.0 * 1024.0);
    if mib >= 1024.0 { format!("{:.1} GiB", mib / 1024.0) } else { format!("{mib:.1} MiB") }
}

// The panel picked Colima's copy as nearly empty from a size it read a moment ago (`shown`). The backup's real
// count is the truth: if Colima's copy is bigger than a fresh one and more than twice what was shown, something
// wrote to it since, and it is left alone. A size that can't be measured is not a pass.
const FRESH_BYTES: u64 = 64 * 1024 * 1024;
fn size_guard(name: &str, real: Option<u64>, shown: Option<u64>) -> Result<(), String> {
    let Some(real) = real else { return Err(format!("Colima's `{name}` couldn't be measured, so it was left alone.")) };
    if real > FRESH_BYTES.max(shown.unwrap_or(0).saturating_mul(2)) {
        return Err(format!("Colima's `{name}` has {} now, so it was left alone.", size_words(real)));
    }
    Ok(())
}

// Before the backup is made: the same guard on a count of Colima's volume, so an 8 GB volume is refused before it is
// copied. A count that can't be read is no answer here; the guard on the backup's own count stays the real gate.
fn pre_guard(name: &str, counted: Option<u64>, shown: Option<u64>) -> Result<(), String> {
    match counted {
        Some(_) => size_guard(name, counted, shown),
        None => Ok(()),
    }
}

// Everything in the volume, dot files too; a glob that matches nothing stays literal and rm -f ignores it.
// Callers check plain_volume first: on a bind volume this would delete files on the Mac.
fn volume_empty(context: &str, name: &str, helper: &str) -> Vec<String> {
    strs(&["--context", context, "run", "--rm", "--name", helper, "-v", &format!("{name}:/to"), BUSYBOX_IMAGE, "sh", "-c", "rm -rf /to/..?* /to/.[!.]* /to/*"])
}

fn replace_inputs_ok(name: &str, context: &str, backup: &str) -> Result<(), String> {
    if !context_ok(context) {
        return Err(format!("Unknown Docker context \"{context}\""));
    }
    if !run_name_ok(name) {
        return Err(format!("\"{name}\" isn't a volume name the app can copy"));
    }
    if !backup_name_ok(name, backup) {
        return Err(format!("\"{backup}\" isn't a backup name for {name}"));
    }
    Ok(())
}

// A helper run inside Colima that Stop can end: its own process group, its pid with the copy's, its container
// removed by name after a kill (killing the CLI leaves the container running).
fn run_stoppable(context: &str, args: &[String], helper: &str) -> Result<(), String> {
    let mut child = Command::new(find_bin("docker")).args(args).env("PATH", path_env()).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::piped()).process_group(0).spawn().map_err(|e| e.to_string())?;
    *COPY_PIDS.lock().unwrap_or_else(|p| p.into_inner()) = vec![child.id()];
    if COPY_STOPPED.load(Ordering::SeqCst) {
        kill_group(child.id());
    }
    let err = read_capped(child.stderr.take().expect("piped"));
    let ok = match wait_bounded(&mut child, AFTER_LAST_BYTE) {
        Some(s) => s.success(),
        None => {
            kill_group(child.id());
            let _ = child.kill();
            let _ = child.wait();
            false
        }
    };
    COPY_PIDS.lock().unwrap_or_else(|p| p.into_inner()).clear();
    let msg = String::from_utf8_lossy(&err.join().unwrap_or_default()).trim().to_string();
    if ok {
        return Ok(());
    }
    let _ = quick(&strs(&["--context", context, "rm", "-f", helper]));
    if COPY_STOPPED.load(Ordering::SeqCst) {
        return Err("Stopped.".into());
    }
    Err(if msg.is_empty() { "The copy failed with no message.".into() } else { msg.chars().take(2000).collect() })
}

// The steps of a replace, so the order and the restore can be tested without Docker.
trait ReplaceOps {
    // Make the backup and check it has every file; on error the original was not touched.
    fn backup(&mut self) -> Result<(), String>;
    // After the backup: Colima's copy is still as small as the panel showed (size_guard on the backup's real count).
    fn size_check(&self) -> Result<(), String>;
    fn drop_backup(&mut self);
    fn empty(&mut self) -> Result<(), String>;
    fn copy_in(&mut self) -> Result<u64, String>;
    // Put the backup's files back into the original and check them. Never stoppable: it is the way back.
    fn restore(&mut self) -> Result<(), String>;
    // Starts Colima's containers that were stopped; returns the ones that didn't start.
    fn start_users(&mut self) -> Vec<String>;
    fn users(&self) -> Vec<String>;
}

#[derive(Serialize, Debug)]
pub struct Replaced {
    ok: bool,
    bytes: u64,
    // replaced, unchanged (failed before anything changed), restored (put back from the backup), in-backup (only there).
    colima: &'static str,
    backup: String,
    why: String,
    // Colima containers left stopped: a start that failed, or on purpose when Colima's copy is only in the backup.
    not_started: Vec<String>,
}

fn replace_flow(ops: &mut impl ReplaceOps, backup: &str) -> Replaced {
    let done = |ok, bytes, colima, why: String, not_started| Replaced { ok, bytes, colima, backup: backup.to_string(), why, not_started };
    if let Err(e) = ops.backup().and_then(|_| ops.size_check()) {
        ops.drop_backup();
        let left = ops.start_users();
        return done(false, 0, "unchanged", e, left);
    }
    match ops.empty().and_then(|_| ops.copy_in()) {
        Ok(bytes) => {
            let left = ops.start_users();
            done(true, bytes, "replaced", String::new(), left)
        }
        Err(e) => match ops.restore() {
            Ok(()) => {
                let left = ops.start_users();
                done(false, 0, "restored", e, left)
            }
            // A database started on a half-restored folder could make it worse; it waits for the user.
            Err(r) => done(false, 0, "in-backup", format!("{e}\n{r}"), ops.users()),
        },
    }
}

// on_step: the step now running (backup, empty, copy, check, restore, start), for the panel's size column.
struct RealReplace<'a, F: FnMut(u64), S: FnMut(&str)> {
    context: &'a str,
    name: &'a str,
    backup: &'a str,
    labels: serde_json::Map<String, serde_json::Value>,
    users: Vec<String>,
    n: u64,
    // Colima's size as the panel showed it, and the backup's real byte count once made.
    shown: Option<u64>,
    backed: Option<u64>,
    // The volume's size as far as known: the panel's guess, raised to what the copy streamed. Sets the counts' wait.
    size: u64,
    on_bytes: F,
    on_step: S,
}

impl<F: FnMut(u64), S: FnMut(&str)> RealReplace<'_, F, S> {
    fn helper(&self, what: &str) -> String {
        format!("colima-ui-{what}-{}-{}", std::process::id(), self.n)
    }
    // Both volumes must count the same, files and bytes; a count that can't be read is not a pass here.
    fn same(&self, a: &str, b: &str, what: &str) -> Result<(), String> {
        let wait = count_deadline(self.size);
        compare_counts(what, a, count(self.context, a, wait), count(self.context, b, wait))
    }
    // Something may have started a container on the volume since it was stopped (a restart policy, compose, the
    // user in a terminal). Nothing is emptied or written under a running database.
    fn quiet(&self, desktop_too: bool) -> Result<(), String> {
        let sides: &[&str] = if desktop_too { &[DESKTOP_CTX, self.context] } else { &[self.context] };
        for ctx in sides {
            let up = live_users(ctx, self.name)?;
            if !up.is_empty() {
                let names: Vec<String> = up.into_iter().map(|(n, _)| n).collect();
                return Err(format!("{} started again in {} while {} was being replaced, so it was stopped there.", names.join(" and "), place(ctx), self.name));
            }
        }
        Ok(())
    }
}

impl<F: FnMut(u64), S: FnMut(&str)> ReplaceOps for RealReplace<'_, F, S> {
    fn backup(&mut self) -> Result<(), String> {
        (self.on_step)("backup");
        let wait = count_deadline(self.size);
        pre_guard(self.name, count(self.context, self.name, wait).map(|(_, bytes)| bytes), self.shown)?;
        quick(&volume_create(self.context, self.backup, &self.labels))?;
        let h = self.helper("backup");
        run_stoppable(self.context, &volume_fill(self.context, self.name, self.backup, &h), &h)?;
        let (a, b) = (count(self.context, self.name, wait), count(self.context, self.backup, wait));
        self.backed = b.map(|(_, bytes)| bytes);
        compare_counts("The backup", self.name, a, b).map_err(|e| format!("{e} Nothing was changed."))?;
        // Stop pressed after the backup: end here, before anything is emptied.
        if COPY_STOPPED.load(Ordering::SeqCst) {
            return Err("Stopped.".into());
        }
        Ok(())
    }
    fn size_check(&self) -> Result<(), String> {
        size_guard(self.name, self.backed, self.shown)
    }
    fn drop_backup(&mut self) {
        let _ = quick(&strs(&["--context", self.context, "rm", "-f", &self.helper("backup")]));
        let _ = quick(&strs(&["--context", self.context, "volume", "rm", self.backup]));
    }
    fn empty(&mut self) -> Result<(), String> {
        self.quiet(false)?;
        plain_volume(self.name, &inspect_volume(self.context, self.name)?)?;
        (self.on_step)("empty");
        let h = self.helper("empty");
        quick_for(&volume_empty(self.context, self.name, &h), COPY_SILENCE).map(|_| ())
    }
    fn copy_in(&mut self) -> Result<u64, String> {
        self.quiet(true)?;
        (self.on_step)("copy");
        let (out, into) = (self.helper("copy-out"), self.helper("copy-in"));
        let step = &mut self.on_step;
        let size = self.size;
        let streamed = std::cell::Cell::new(0u64);
        let on_bytes = &mut self.on_bytes;
        let r = stream_in(self.context, self.name, [&out, &into], size, |b| { streamed.set(b); on_bytes(b) }, || step("check"));
        // A restore after this counts the same data again; it gets the real size too.
        self.size = size.max(streamed.get());
        if r.is_err() {
            // The receiving helper must be gone before the restore writes to the same volume.
            let _ = quick(&strs(&["--context", DESKTOP_CTX, "rm", "-f", &out]));
            let _ = quick(&strs(&["--context", self.context, "rm", "-f", &into]));
        }
        r
    }
    fn restore(&mut self) -> Result<(), String> {
        self.quiet(false)?;
        (self.on_step)("restore");
        let (e, f) = (self.helper("restore-empty"), self.helper("restore"));
        plain_volume(self.name, &inspect_volume(self.context, self.name)?)?;
        quick_for(&volume_empty(self.context, self.name, &e), COPY_SILENCE)?;
        quick_for(&volume_fill(self.context, self.backup, self.name, &f), AFTER_LAST_BYTE)?;
        self.same(self.backup, self.name, "The restored copy")
    }
    fn start_users(&mut self) -> Vec<String> {
        if self.users.is_empty() {
            return vec![];
        }
        (self.on_step)("start");
        if start_halted(self.context, &self.users).is_ok() {
            return vec![];
        }
        self.users.clone()
    }
    fn users(&self) -> Vec<String> {
        self.users.clone()
    }
}

// shown: Colima's size as the panel showed it, for the size guard after the backup.
#[allow(clippy::too_many_arguments)]
fn replace_volume(context: &str, name: &str, backup: &str, bytes: u64, shown: Option<u64>, stop_users: bool, on_bytes: impl FnMut(u64), on_step: impl FnMut(&str)) -> Result<Replaced, String> {
    let inspect = inspect_volume(context, name)?;
    // A folder on the Mac, or another driver, is never emptied; refused before anything stops.
    plain_volume(name, &inspect)?;
    let labels = serde_json::from_str::<serde_json::Value>(inspect.trim()).ok().and_then(|v| v.get("Labels").and_then(|l| l.as_object()).cloned()).unwrap_or_default();
    if quick(&strs(&["--context", DESKTOP_CTX, "volume", "inspect", name])).is_err() {
        return Err(format!("Docker Desktop no longer has a volume called {name}."));
    }
    if quick(&strs(&["--context", context, "volume", "inspect", backup])).is_ok() {
        return Err(format!("Colima already has a volume called {backup}. Try again in a minute."));
    }
    halt(DESKTOP_CTX, name, stop_users)?;
    let users = halt(context, name, stop_users)?;
    let n = HELPER_N.fetch_add(1, Ordering::SeqCst);
    let mut ops = RealReplace { context, name, backup, labels, users, n, shown, backed: None, size: bytes, on_bytes, on_step };
    // What didn't start stays in HALTED (start_halted only removes what it started), so Start again can reach it.
    Ok(replace_flow(&mut ops, backup))
}

// Replaces Colima's nearly empty volume `name` with Docker Desktop's, keeping Colima's in `backup`.
#[tauri::command]
// colima_bytes: Colima's size of `name` as the panel showed it; checked against the backup before anything is emptied.
pub async fn desktop_replace(app: tauri::AppHandle, name: String, context: String, backup: String, stop_users: Option<bool>, bytes: Option<u64>, colima_bytes: Option<u64>) -> Result<Replaced, String> {
    replace_inputs_ok(&name, &context, &backup)?;
    tauri::async_runtime::spawn_blocking(move || {
        let Ok(_guard) = COPY_LOCK.try_lock() else { return Err("Another copy is still running.".to_string()) };
        if COPY_STOPPED.load(Ordering::SeqCst) {
            return Err("Stopped.".to_string());
        }
        let mut sent = Instant::now() - Duration::from_secs(1);
        let report = |bytes: u64| {
            if sent.elapsed() >= Duration::from_millis(200) {
                sent = Instant::now();
                let _ = app.emit("desktop-progress", Progress { name: name.clone(), bytes });
            }
        };
        let step = |step: &str| {
            let _ = app.emit("desktop-step", Step { name: name.clone(), step: step.to_string() });
        };
        replace_volume(&context, &name, &backup, bytes.unwrap_or(0), colima_bytes, stop_users == Some(true), report, step)
    })
    .await
    .map_err(|e| e.to_string())?
}

// Stop: the panel's next copy must not start, and the one running ends now.
#[tauri::command]
pub fn desktop_copy_stop(stop: bool) {
    COPY_STOPPED.store(stop, Ordering::SeqCst);
    if stop {
        COPY_PIDS.lock().unwrap_or_else(|p| p.into_inner()).iter().for_each(|p| kill_group(*p));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(a: &[&str]) -> Vec<String> {
        strs(a)
    }

    #[test]
    fn given_the_three_lists_when_checked_then_only_they_are_allowed_against_docker_desktop() {
        assert!(desktop_args_ok(&s(&["volume", "ls", "--format", "json"])));
        assert!(desktop_args_ok(&s(&["images", "--format", "json"])));
        assert!(!desktop_args_ok(&s(&["volume", "rm", "pgdata"])));
        assert!(!desktop_args_ok(&s(&["system", "prune", "-f"])));
        assert!(!desktop_args_ok(&s(&["images", "--format", "json", "-a"])));
        assert!(desktop_args_ok(&s(&["ps", "--filter", "status=running", "--format", "json"])));
        assert!(!desktop_args_ok(&s(&["stop", "shop-db-1"])));
    }

    #[test]
    fn given_image_refs_when_validated_then_flags_spaces_and_none_are_refused() {
        assert!(image_ref_ok("postgres:16"));
        assert!(image_ref_ok("ghcr.io/acme/api:1.2.3"));
        assert!(image_ref_ok("alpine@sha256:abc123"));
        assert!(!image_ref_ok("-q"));
        assert!(!image_ref_ok("a b"));
        assert!(!image_ref_ok("<none>:<none>"));
    }

    #[test]
    fn given_a_volume_when_copied_then_docker_desktop_mounts_it_read_only() {
        let out = volume_out("pgdata", "h1").join(" ");
        assert!(out.starts_with("--context desktop-linux run --rm --name h1 -v pgdata:/from:ro busybox:1.36 tar -cf -"));
        let into = volume_in("colima-work", "pgdata", "h2").join(" ");
        assert!(into.starts_with("--context colima-work run --rm -i --name h2 -v pgdata:/to "));
        assert!(volume_count("desktop-linux", "pgdata").join(" ").contains("pgdata:/v:ro"));
        assert!(into.ends_with("tar -xpf - -C /to"));
    }

    #[test]
    fn given_compose_labels_when_the_volume_is_created_then_they_carry_over_and_odd_ones_drop() {
        let labels: serde_json::Map<String, serde_json::Value> = serde_json::from_str(r#"{"com.docker.compose.project":"shop","bad\nkey":"x","n":1}"#).unwrap();
        assert_eq!(volume_create("colima", "shop_db", &labels), s(&["--context", "colima", "volume", "create", "--label", "com.docker.compose.project=shop", "shop_db"]));
    }

    #[test]
    fn given_two_processes_when_piped_then_every_byte_arrives_and_is_counted() {
        let dir = std::env::temp_dir().join(format!("colima-ui-pipe-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("out");
        let mut seen = 0;
        let n = pipe(("sh", &s(&["-c", "head -c 700000 /dev/zero"])), ("sh", &s(&["-c", &format!("cat > {}", file.display())])), Duration::from_secs(10), |b| seen = b).unwrap();
        assert_eq!((n, seen, std::fs::metadata(&file).unwrap().len()), (700000, 700000, 700000));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn given_a_receiver_that_fails_when_piped_then_its_error_comes_back() {
        let r = pipe(("sh", &s(&["-c", "head -c 10 /dev/zero"])), ("sh", &s(&["-c", "echo 'no space left' >&2; exit 1"])), Duration::from_secs(10), |_| {});
        assert!(r.unwrap_err().contains("no space left"));
    }

    #[test]
    fn given_ps_output_when_read_then_only_containers_that_may_write_count() {
        let out = "db\trunning\nold\texited\nfrozen\tpaused\nnew\tcreated\nloop\trestarting\n";
        assert_eq!(parse_users(out).into_iter().map(|(n, _)| n).collect::<Vec<_>>(), ["db", "frozen", "loop"]);
    }

    #[test]
    fn given_a_receiver_still_working_after_the_last_byte_when_piped_then_it_is_not_called_stuck() {
        // Wide margins (2 s of silence, a 3 s receiver), so a loaded machine running tests in parallel can't trip it.
        let r = pipe(("sh", &s(&["-c", "printf x"])), ("sh", &s(&["-c", "cat >/dev/null; sleep 3"])), Duration::from_secs(2), |_| {});
        assert_eq!(r, Ok(1));
    }

    #[test]
    fn given_a_container_the_app_did_not_stop_when_started_then_it_is_refused() {
        let r = tauri::async_runtime::block_on(desktop_start(s(&["someone-elses-db"]), None));
        assert!(r.unwrap_err().contains("only starts containers it stopped"));
    }

    #[test]
    fn given_a_sender_that_goes_quiet_when_piped_then_the_watchdog_stops_it() {
        let r = pipe(("sh", &s(&["-c", "sleep 30"])), ("sh", &s(&["-c", "cat >/dev/null"])), Duration::from_millis(400), |_| {});
        assert!(r.unwrap_err().contains("looked stuck"));
    }

    #[test]
    fn given_backup_names_when_checked_then_only_name_colima_backup_date_time_is_allowed() {
        assert!(backup_name_ok("shop_db", "shop_db-colima-backup-20261029-1912"));
        assert!(!backup_name_ok("shop_db", "shop_db"));
        assert!(!backup_name_ok("shop_db", "other-colima-backup-20261029-1912"));
        assert!(!backup_name_ok("shop_db", "shop_db-colima-backup-2026102-1912"));
        assert!(!backup_name_ok("shop_db", "shop_db-colima-backup-20261029-19120"));
        assert!(!backup_name_ok("shop_db", "shop_db-colima-backup-2026x029-1912"));
        assert!(!backup_name_ok("-q", "-q-colima-backup-20261029-1912"));
    }

    #[test]
    fn given_a_replace_when_its_commands_are_built_then_they_stay_inside_colima_and_the_source_is_read_only() {
        assert_eq!(
            volume_fill("colima", "shop_db", "shop_db-colima-backup-20261029-1912", "h").join(" "),
            "--context colima run --rm --name h -v shop_db:/from:ro -v shop_db-colima-backup-20261029-1912:/to busybox:1.36 sh -c set -o pipefail; tar -cf - -C /from . | tar -xpf - -C /to"
        );
        assert_eq!(volume_empty("colima", "shop_db", "h").join(" "), "--context colima run --rm --name h -v shop_db:/to busybox:1.36 sh -c rm -rf /to/..?* /to/.[!.]* /to/*");
        assert_eq!(colima_users_args("colima", "shop_db"), s(&["--context", "colima", "ps", "-a", "--filter", "volume=shop_db", "--format", "{{.Names}}\t{{.State}}"]));
    }

    #[test]
    fn given_a_volume_when_counted_then_files_folders_and_bytes_are_read_with_a_failing_pipe_failing_the_count() {
        let script = volume_count("colima", "shop_db").pop().unwrap();
        assert!(script.starts_with("set -eo pipefail; "), "a failing find or stat fails the count");
        assert_eq!(script, "set -eo pipefail; find /v -type f -o -type d | wc -l; find /v -type f -exec stat -c %s {} + | awk '{s+=$1} END {printf \"%.0f\\n\", s}'");
        assert_eq!(parse_count("  412\n 1048576\n"), Some((412, 1048576)));
        assert_eq!(parse_count("412\n"), None);
        assert_eq!(parse_count("x\ny"), None);
    }

    #[test]
    fn given_a_volume_size_when_counted_then_the_wait_is_ten_minutes_and_one_more_per_5_gb() {
        assert_eq!(count_deadline(0), Duration::from_secs(600));
        assert_eq!(count_deadline(5_000_000_000), Duration::from_secs(660));
        assert_eq!(count_deadline(57_000_000_000), Duration::from_secs(600 + 11 * 60));
    }

    #[test]
    fn given_the_panel_guessed_low_when_the_copy_streamed_more_then_the_count_gets_the_bigger_size() {
        assert_eq!(count_wait(1_000_000, 26_000_000_000), Duration::from_secs(600 + 5 * 60));
        assert_eq!(count_wait(26_000_000_000, 1_000), Duration::from_secs(600 + 5 * 60));
        assert_eq!(count_wait(0, 0), Duration::from_secs(600));
    }

    #[test]
    fn given_two_counts_when_compared_then_files_are_named_before_bytes() {
        assert_eq!(compare_counts("The copy", "Docker Desktop", Some((3, 10)), Some((3, 10))), Ok(()));
        assert_eq!(compare_counts("The copy", "Docker Desktop", Some((3, 10)), Some((2, 10))).unwrap_err(), "The copy has 2 files and folders, Docker Desktop has 3.");
        assert_eq!(compare_counts("The copy", "Docker Desktop", Some((3, 10)), Some((3, 9))).unwrap_err(), "The copy has 9 bytes, Docker Desktop has 10.");
        assert!(compare_counts("The backup", "shop_db", None, Some((3, 9))).unwrap_err().contains("couldn't be checked"));
    }

    // Records each step, and fails the ones named in `fail`.
    struct Fake {
        fail: Vec<&'static str>,
        calls: Vec<&'static str>,
    }
    impl Fake {
        fn step(&mut self, n: &'static str) -> Result<(), String> {
            self.calls.push(n);
            if self.fail.contains(&n) { Err(format!("{n} failed")) } else { Ok(()) }
        }
    }
    impl ReplaceOps for Fake {
        fn backup(&mut self) -> Result<(), String> { self.step("backup") }
        fn size_check(&self) -> Result<(), String> { if self.fail.contains(&"size") { Err("too big".into()) } else { Ok(()) } }
        fn drop_backup(&mut self) { self.calls.push("drop_backup") }
        fn empty(&mut self) -> Result<(), String> { self.step("empty") }
        fn copy_in(&mut self) -> Result<u64, String> { self.step("copy_in").map(|_| 7) }
        fn restore(&mut self) -> Result<(), String> { self.step("restore") }
        fn start_users(&mut self) -> Vec<String> { self.calls.push("start_users"); vec![] }
        fn users(&self) -> Vec<String> { vec!["shop-db-1".into()] }
    }
    fn fake(fail: &[&'static str]) -> Fake {
        Fake { fail: fail.to_vec(), calls: vec![] }
    }

    #[test]
    fn given_every_step_works_when_replaced_then_backup_comes_before_emptying_and_users_start_again() {
        let mut f = fake(&[]);
        let r = replace_flow(&mut f, "B");
        assert_eq!(f.calls, ["backup", "empty", "copy_in", "start_users"]);
        assert!(r.ok && r.bytes == 7 && r.colima == "replaced" && r.backup == "B");
    }

    #[test]
    fn given_the_backup_fails_when_replaced_then_nothing_is_emptied_and_the_half_backup_goes() {
        let mut f = fake(&["backup"]);
        let r = replace_flow(&mut f, "B");
        assert_eq!(f.calls, ["backup", "drop_backup", "start_users"]);
        assert!(!r.ok && r.colima == "unchanged" && r.why == "backup failed");
    }

    #[test]
    fn given_the_copy_fails_midway_when_replaced_then_colima_s_copy_is_restored_from_the_backup() {
        let mut f = fake(&["copy_in"]);
        let r = replace_flow(&mut f, "B");
        assert_eq!(f.calls, ["backup", "empty", "copy_in", "restore", "start_users"]);
        assert!(!r.ok && r.colima == "restored" && r.why == "copy_in failed" && r.not_started.is_empty());
    }

    #[test]
    fn given_the_restore_fails_too_when_replaced_then_the_backup_is_kept_and_users_stay_stopped() {
        let mut f = fake(&["empty", "restore"]);
        let r = replace_flow(&mut f, "B");
        assert_eq!(f.calls, ["backup", "empty", "restore"]);
        assert!(!r.ok && r.colima == "in-backup" && r.backup == "B" && r.not_started == ["shop-db-1"]);
        assert!(r.why.contains("empty failed") && r.why.contains("restore failed"));
    }

    #[test]
    fn given_colima_s_copy_grew_since_the_panel_looked_when_replaced_then_the_backup_goes_nothing_is_emptied_and_users_start() {
        let mut f = fake(&["size"]);
        let r = replace_flow(&mut f, "B");
        assert_eq!(f.calls, ["backup", "drop_backup", "start_users"]);
        assert!(!r.ok && r.colima == "unchanged" && r.why == "too big");
    }

    #[test]
    fn given_a_count_of_colima_s_volume_before_the_backup_when_guarded_then_a_big_one_is_refused_before_any_copy() {
        let gib8 = 8 * 1024 * 1024 * 1024;
        assert_eq!(pre_guard("shop_db", Some(gib8), Some(12_000_000)), Err("Colima's `shop_db` has 8.0 GiB now, so it was left alone.".into()));
        assert_eq!(pre_guard("shop_db", Some(12_000_000), Some(12_000_000)), Ok(()));
        // No count: no answer yet; the guard after the backup decides.
        assert_eq!(pre_guard("shop_db", None, Some(12_000_000)), Ok(()));
    }

    #[test]
    fn given_the_backup_s_real_size_when_guarded_then_only_a_still_small_copy_passes() {
        const MIB: u64 = 1024 * 1024;
        assert!(size_guard("shop_db", Some(12 * MIB), Some(12 * MIB)).is_ok());
        assert!(size_guard("shop_db", Some(60 * MIB), Some(1 * MIB)).is_ok(), "under 64 MiB is still a fresh copy");
        assert!(size_guard("shop_db", Some(100 * MIB), Some(60 * MIB)).is_ok(), "within twice what was shown");
        assert_eq!(size_guard("shop_db", Some(315_000_000), Some(12 * MIB)).unwrap_err(), "Colima's `shop_db` has 300.4 MiB now, so it was left alone.");
        assert!(size_guard("shop_db", None, Some(12 * MIB)).unwrap_err().contains("couldn't be measured"));
        assert!(size_guard("shop_db", Some(70 * MIB), None).is_err(), "nothing shown counts as 0, so the limit is 64 MiB");
    }

    #[test]
    fn given_a_colima_volume_s_inspect_when_checked_then_only_a_plain_local_volume_may_be_replaced() {
        assert!(plain_volume("shop_db", r#"{"Driver":"local","Options":null,"Labels":{}}"#).is_ok());
        assert!(plain_volume("shop_db", r#"{"Driver":"local","Options":{},"Labels":null}"#).is_ok());
        let bind = r#"{"Driver":"local","Options":{"device":"/Users/me/pg","o":"bind","type":"none"}}"#;
        assert_eq!(plain_volume("shop_db", bind).unwrap_err(), "Colima's `shop_db` is a folder on your Mac, so it was left alone.");
        assert!(plain_volume("shop_db", r#"{"Driver":"nfs","Options":null}"#).unwrap_err().contains("nfs"));
        assert!(plain_volume("shop_db", "not json").is_err(), "a volume that can't be read is not replaced");
        assert!(plain_volume("shop_db", r#"{"Options":null}"#).is_err(), "no driver named is not a pass");
    }

    #[test]
    fn given_bad_input_when_a_replace_is_asked_then_it_is_refused_before_anything_runs() {
        let go = |name: &str, ctx: &str, backup: &str| replace_inputs_ok(name, ctx, backup);
        assert!(go("shop_db", "desktop-linux", "shop_db-colima-backup-20261029-1912").unwrap_err().contains("Unknown Docker context"));
        assert!(go("-v", "colima", "-v-colima-backup-20261029-1912").unwrap_err().contains("isn't a volume name"));
        assert!(go("shop_db", "colima", "shop_db-backup").unwrap_err().contains("isn't a backup name"));
        assert!(go("shop_db", "colima", "shop_db-colima-backup-20261029-1912").is_ok());
    }

    #[test]
    fn given_a_colima_container_the_app_did_not_stop_when_started_then_it_is_refused() {
        let r = tauri::async_runtime::block_on(desktop_start(s(&["web"]), Some("colima".into())));
        assert!(r.unwrap_err().contains("only starts containers it stopped"));
        let r = tauri::async_runtime::block_on(desktop_start(s(&["web"]), Some("elsewhere".into())));
        assert!(r.unwrap_err().contains("Unknown Docker context"));
    }
}
