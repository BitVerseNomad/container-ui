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

// Files and folders in the volume, to check the copy has all of them. Read-only on both sides.
fn volume_count(context: &str, name: &str) -> Vec<String> {
    strs(&["--context", context, "run", "--rm", "-v", &format!("{name}:/v:ro"), BUSYBOX_IMAGE, "sh", "-c", "find /v -type f -o -type d | wc -l"])
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

// Containers on Docker Desktop that may be writing to the volume: anything not exited, created or dead (a paused or
// restarting database has its files open too). An error is not "nobody": the copy must not run blind.
fn live_users(name: &str) -> Result<Vec<(String, String)>, String> {
    let out = quick(&strs(&["--context", DESKTOP_CTX, "ps", "-a", "--filter", &format!("volume={name}"), "--format", "{{.Names}}\t{{.State}}"]))
        .map_err(|e| format!("Couldn't check what uses {name} in Docker Desktop, so it was not copied. {e}"))?;
    Ok(parse_users(&out))
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
// Containers the copy stopped on Docker Desktop. "Start again" may start only these.
static HALTED: Mutex<Vec<String>> = Mutex::new(Vec::new());
// A database can take a while to shut down cleanly.
const STOP_WAIT: Duration = Duration::from_secs(180);

fn quick_for(args: &[String], deadline: Duration) -> Result<String, String> {
    let mut c = Command::new(find_bin("docker"));
    c.args(args).env("PATH", path_env());
    let (ok, out, err) = output_with_deadline(c, deadline).map_err(|e| e.to_string())?;
    if ok { Ok(String::from_utf8_lossy(&out).into_owned()) } else { Err(String::from_utf8_lossy(&err).trim().to_string()) }
}

fn copy_volume(context: &str, name: &str, stop_users: bool, on_bytes: impl FnMut(u64)) -> Result<u64, String> {
    // An existing volume may hold newer data; it is never merged into or replaced.
    if quick(&strs(&["--context", context, "volume", "inspect", name])).is_ok() {
        return Err(format!("Colima already has a volume called {name}, so it was left alone."));
    }
    // A failed inspect means the volume is gone from Docker Desktop; `run -v` would make an empty one there.
    let labels = quick(&strs(&["--context", DESKTOP_CTX, "volume", "inspect", "--format", "{{json .Labels}}", name]))
        .map_err(|_| format!("Docker Desktop no longer has a volume called {name}."))?;
    let labels = serde_json::from_str::<serde_json::Value>(labels.trim()).ok().and_then(|v| v.as_object().cloned()).unwrap_or_default();
    let users = live_users(name)?;
    if !users.is_empty() {
        let names: Vec<String> = users.iter().map(|(n, _)| n.clone()).collect();
        if !stop_users {
            return Err(format!("{} is using {name} in Docker Desktop. Stop it first for a clean copy.", names.join(" and ")));
        }
        // A paused container can't be stopped until it runs again.
        let paused: Vec<String> = users.iter().filter(|(_, st)| st == "paused").map(|(n, _)| n.clone()).collect();
        if !paused.is_empty() {
            let mut a = strs(&["--context", DESKTOP_CTX, "unpause"]);
            a.extend(paused);
            quick(&a)?;
        }
        let mut a = strs(&["--context", DESKTOP_CTX, "stop"]);
        a.extend(names.iter().cloned());
        let stopped = quick_for(&a, STOP_WAIT);
        HALTED.lock().unwrap_or_else(|p| p.into_inner()).extend(names);
        stopped?;
        if !live_users(name)?.is_empty() {
            return Err(format!("{name} is still in use in Docker Desktop, so it was not copied."));
        }
    }
    quick(&volume_create(context, name, &labels))?;
    let n = HELPER_N.fetch_add(1, Ordering::SeqCst);
    let (out, into) = (format!("colima-ui-copy-out-{}-{n}", std::process::id()), format!("colima-ui-copy-in-{}-{n}", std::process::id()));
    let docker = find_bin("docker");
    let copied = pipe((&docker, &volume_out(name, &out)), (&docker, &volume_in(context, name, &into)), COPY_SILENCE, on_bytes).and_then(|bytes| {
        // Millions of files take a while to count, so this gets the copy's own patience, not the 60-second one.
        let count = |ctx: &str| quick_for(&volume_count(ctx, name), COPY_SILENCE).ok().map(|o| o.trim().to_string());
        match (count(DESKTOP_CTX), count(context)) {
            (Some(a), Some(b)) if a != b => Err(format!("The copy has {b} files and folders, Docker Desktop has {a}, so it was not kept.")),
            // Equal, or a count that couldn't finish: the stream itself ended cleanly on both sides, so the copy stays.
            _ => Ok(bytes),
        }
    });
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
struct Progress {
    name: String,
    bytes: u64,
}

// One volume or image per call; the panel calls it for each one it brings over, so one failure never stops the rest.
#[tauri::command]
pub async fn desktop_copy(app: tauri::AppHandle, kind: String, name: String, context: String, stop_users: Option<bool>) -> Result<u64, String> {
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
        if kind == "volume" { copy_volume(&context, &name, stop_users == Some(true), report) } else { copy_image(&context, &name, report) }
    })
    .await
    .map_err(|e| e.to_string())?
}

// Starts again the Docker Desktop containers the copy stopped, and only those.
#[tauri::command]
pub async fn desktop_start(names: Vec<String>) -> Result<(), String> {
    let halted = HALTED.lock().unwrap_or_else(|p| p.into_inner()).clone();
    if names.is_empty() || !names.iter().all(|n| crate::container_name_ok(n) && halted.contains(n)) {
        return Err("The app only starts containers it stopped itself".into());
    }
    let mut a = strs(&["--context", DESKTOP_CTX, "start"]);
    a.extend(names.iter().cloned());
    tauri::async_runtime::spawn_blocking(move || {
        quick(&a)?;
        HALTED.lock().unwrap_or_else(|p| p.into_inner()).retain(|n| !names.contains(n));
        Ok(())
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
        let r = pipe(("sh", &s(&["-c", "printf x"])), ("sh", &s(&["-c", "cat >/dev/null; sleep 1"])), Duration::from_millis(400), |_| {});
        assert_eq!(r, Ok(1));
    }

    #[test]
    fn given_a_container_the_app_did_not_stop_when_started_then_it_is_refused() {
        let r = tauri::async_runtime::block_on(desktop_start(s(&["someone-elses-db"])));
        assert!(r.unwrap_err().contains("only starts containers it stopped"));
    }

    #[test]
    fn given_a_sender_that_goes_quiet_when_piped_then_the_watchdog_stops_it() {
        let r = pipe(("sh", &s(&["-c", "sleep 30"])), ("sh", &s(&["-c", "cat >/dev/null"])), Duration::from_millis(400), |_| {});
        assert!(r.unwrap_err().contains("looked stuck"));
    }
}
