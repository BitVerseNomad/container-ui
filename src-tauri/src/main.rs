#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
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
    let mut a = vec!["--context".to_string(), context];
    a.extend(args);
    exec("docker", a, merge_stderr).await
}

// Streams `docker pull` output to the frontend as "pull-progress" events, one line each.
#[tauri::command]
async fn docker_pull(app: tauri::AppHandle, context: String, image: String) -> Result<(), String> {
    safe(&image)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut child = Command::new("sh")
            .args(["-c", "exec \"$@\" 2>&1", "sh", &find_bin("docker"), "--context", &context, "pull", &image])
            .env("PATH", path_env())
            .stdout(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Could not run docker: {e}. Is it installed?"))?;
        let mut last = String::new();
        if let Some(out) = child.stdout.take() {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                let _ = app.emit("pull-progress", line.clone());
                last = line;
            }
        }
        let status = child.wait().map_err(|e| e.to_string())?;
        if status.success() {
            Ok(())
        } else {
            Err(last)
        }
    })
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
async fn start_profile(opts: StartOpts) -> Result<(), String> {
    safe(&opts.name)?;
    run(start_args(&opts)).await.map(|_| ())
}

// Colima applies CPU/memory/disk changes on the next start, so a running VM is stopped first.
// If the stop fails, nothing has changed. If the start fails, the profile is left stopped.
#[tauri::command]
async fn apply_resources(opts: StartOpts, restart: bool) -> Result<(), String> {
    safe(&opts.name)?;
    if restart {
        run(vec!["stop".into(), opts.name.clone()]).await?;
    }
    run(start_args(&opts)).await.map(|_| ())
}

#[tauri::command]
async fn stop_profile(name: String) -> Result<(), String> {
    safe(&name)?;
    run(vec!["stop".into(), name]).await.map(|_| ())
}

#[tauri::command]
async fn restart_profile(name: String) -> Result<(), String> {
    safe(&name)?;
    run(vec!["restart".into(), name]).await.map(|_| ())
}

#[tauri::command]
async fn delete_profile(name: String) -> Result<(), String> {
    safe(&name)?;
    run(vec!["delete".into(), "--force".into(), name]).await.map(|_| ())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_profiles, docker, docker_pull, start_profile, apply_resources,
            stop_profile, restart_profile, delete_profile
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
    fn rejects_flag_like_names() {
        assert!(safe("--all").is_err());
        assert!(safe("").is_err());
        assert!(safe("nginx:1.27").is_ok());
    }
}
