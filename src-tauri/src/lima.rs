// Lima + Docker runtime for project-based dev environments
// Provides a lightweight VM (via Lima) with Docker inside for running devcontainers/compose projects

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use std::sync::Mutex;

use crate::stream;

// Lima CLI path
fn lima_cli() -> String {
    ["/opt/homebrew/bin/lima", "/usr/local/bin/lima"]
        .iter()
        .find(|p| std::path::Path::new(p).exists())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "lima".to_string())
}

// Lima home directory (currently unused, kept for future use)
#[allow(dead_code)]
fn lima_home() -> String {
    std::env::var("LIMA_HOME").unwrap_or_else(|_| {
        dirs::home_dir()
            .map(|h| h.join(".lima").to_string_lossy().to_string())
            .unwrap_or_default()
    })
}

// Check if a Lima instance is running
fn is_vm_running(instance: &str) -> bool {
    let output = Command::new(lima_cli())
        .args(["list", "-q"])
        .output();
    match output {
        Ok(out) => {
            let instances: Vec<String> = String::from_utf8_lossy(&out.stdout)
                .lines()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            instances.contains(&instance.to_string())
        }
        Err(_) => false,
    }
}

// Get Docker host from Lima instance
fn get_docker_host(instance: &str) -> Result<String, String> {
    let output = Command::new(lima_cli())
        .args(["shell", instance, "echo", "$DOCKER_HOST"])
        .output()
        .map_err(|e| format!("Failed to get docker host: {e}"))?;

    let host = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if host.is_empty() {
        let home = dirs::home_dir().ok_or("No home directory")?;
        Ok(format!("unix://{}/.lima/{}/docker.sock", home.display(), instance))
    } else {
        Ok(host)
    }
}

// Execute a command inside the Lima VM
fn lima_shell(instance: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new(lima_cli());
    cmd.args(["shell", instance]);
    cmd.args(args);
    cmd.env("PATH", format!("/opt/homebrew/bin:/usr/local/bin:{}", std::env::var("PATH").unwrap_or_default()));
    
    let output = cmd.output().map_err(|e| format!("Failed to run lima shell: {e}"))?;
    
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

// --- Types ---

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LimaStatus {
    pub available: bool,
    pub version: Option<String>,
    pub vm_running: bool,
    pub docker_socket: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProjectEnvironment {
    pub id: String,
    pub project_id: String,
    pub project_path: String,
    pub config_type: String, // "devcontainer" | "compose" | "auto"
    pub config_json: String,
    pub runtime: String,
    pub state: String, // "stopped" | "starting" | "running" | "error"
    pub container_id: Option<String>,
    pub ports_json: String,
    pub mounts_json: String,
    pub env_vars_json: String,
    pub error: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PortMapping {
    pub container_port: u16,
    pub host_port: Option<u16>,
    pub protocol: String,
    pub is_forwarded: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MountSpec {
    pub source: String,
    pub target: String,
    pub writable: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EnvVar {
    pub key: String,
    pub value: String,
    pub source: String, // "config" | "dotenv" | "system" | "injected"
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum ProjectEnvConfig {
    DevContainer { devcontainer: DevContainerSpec },
    Compose { compose: ComposeSpec },
    Auto,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct DevContainerSpec {
    pub image: Option<String>,
    pub dockerfile: Option<String>,
    pub build: Option<BuildSpec>,
    pub run_args: Option<Vec<String>>,
    pub container_env: Option<HashMap<String, String>>,
    pub remote_env: Option<HashMap<String, String>>,
    pub mounts: Option<Vec<MountSpec>>,
    pub ports: Option<Vec<u16>>,
    pub forward_ports: Option<Vec<u16>>,
    pub post_create_command: Option<String>,
    pub post_start_command: Option<String>,
    pub customizations: Option<serde_json::Value>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct BuildSpec {
    pub context: String,
    pub dockerfile: String,
    pub args: Option<HashMap<String, String>>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct ComposeSpec {
    pub file: String,
    pub service: String,
    pub env_file: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct CreateProjectEnvInput {
    pub project_id: String,
    pub project_path: String,
    pub config: ProjectEnvConfig,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ExecResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LogLine {
    pub timestamp: String,
    pub stream: String, // "stdout" | "stderr" | "system"
    pub content: String,
}

// --- In-memory storage for project environments (in production, use SQLite) ---
// For now, we'll use a simple in-memory store with the project ID as key
lazy_static::lazy_static! {
    static ref PROJECT_ENVS: Mutex<HashMap<String, ProjectEnvironment>> = Mutex::new(HashMap::new());
    static ref ENV_LOGS: Mutex<HashMap<String, Vec<LogLine>>> = Mutex::new(HashMap::new());
}

// --- Tauri Commands ---

#[tauri::command]
pub async fn lima_status() -> Result<LimaStatus, String> {
    // Check if lima CLI exists
    let version_output = Command::new(lima_cli()).arg("version").output();
    
    let (available, version) = match version_output {
        Ok(out) if out.status.success() => {
            let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
            (true, Some(v))
        }
        _ => (false, None),
    };

    let vm_running = is_vm_running("default");
    let docker_socket = if vm_running {
        get_docker_host("default").ok()
    } else {
        None
    };

    Ok(LimaStatus {
        available,
        version,
        vm_running,
        docker_socket,
        error: if available { None } else { Some("Lima not installed".to_string()) },
    })
}

#[tauri::command]
pub async fn lima_ensure_vm(app: tauri::AppHandle) -> Result<LimaStatus, String> {
    // Ensure default Lima VM exists and is running
    let instances_output = Command::new(lima_cli())
        .args(["list", "-q"])
        .output()
        .map_err(|e| format!("Failed to list Lima instances: {e}"))?;

    let instances: Vec<String> = String::from_utf8_lossy(&instances_output.stdout)
        .lines()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if !instances.contains(&"default".to_string()) {
        // Create default instance
        stream(&app, "lima-progress", &lima_cli(), &["start".into(), "--name=default".into(), "default".into()])?;
    } else if !is_vm_running("default") {
        // Start existing instance
        stream(&app, "lima-progress", &lima_cli(), &["start".into(), "default".into()])?;
    }

    // Return updated status
    lima_status().await
}

// Helper: Run docker command via Lima VM
fn docker_via_lima(instance: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd_args = vec!["shell", instance, "docker"];
    cmd_args.extend(args);
    lima_shell(instance, &cmd_args)
}

// Helper: Run docker compose via Lima VM
fn compose_via_lima(instance: &str, project_path: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd_args = vec!["shell", instance, "sh", "-c"];
    let compose_cmd = format!("cd {} && docker compose {}", project_path, args.join(" "));
    cmd_args.push(&compose_cmd);
    lima_shell(instance, &cmd_args)
}

// Create project environment
#[tauri::command]
pub async fn project_env_create(app: tauri::AppHandle, input: CreateProjectEnvInput) -> Result<ProjectEnvironment, String> {
    // Ensure Lima VM is running
    lima_ensure_vm(app.clone()).await?;

    let instance = "default";
    let env_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Build docker run command or compose up based on config
    let container_id = match &input.config {
        ProjectEnvConfig::DevContainer { devcontainer } => {
            create_devcontainer_env(instance, &input.project_path, devcontainer, &env_id).await?
        }
        ProjectEnvConfig::Compose { compose } => {
            create_compose_env(instance, &input.project_path, compose, &env_id).await?
        }
        ProjectEnvConfig::Auto => {
            // Try to auto-detect - for now default to a basic container
            create_auto_env(instance, &input.project_path, &env_id).await?
        }
    };

    let config_json = serde_json::to_string(&input.config).map_err(|e| e.to_string())?;
    
    let env = ProjectEnvironment {
        id: env_id.clone(),
        project_id: input.project_id,
        project_path: input.project_path,
        config_type: match &input.config {
            ProjectEnvConfig::DevContainer { .. } => "devcontainer",
            ProjectEnvConfig::Compose { .. } => "compose",
            ProjectEnvConfig::Auto => "auto",
        }.to_string(),
        config_json,
        runtime: "lima-docker".to_string(),
        state: "running".to_string(),
        container_id: Some(container_id.clone()),
        ports_json: "[]".to_string(),
        mounts_json: "[]".to_string(),
        env_vars_json: "[]".to_string(),
        error: None,
        created_at: now.clone(),
        updated_at: now,
    };

    // Store in memory
    PROJECT_ENVS.lock().unwrap().insert(env_id.clone(), env.clone());

    Ok(env)
}

async fn create_devcontainer_env(
    instance: &str,
    project_path: &str,
    spec: &DevContainerSpec,
    env_id: &str,
) -> Result<String, String> {
    let image = spec.image.as_deref().unwrap_or("ubuntu:22.04");
    
    // Build image if dockerfile specified
    if let Some(build) = &spec.build {
        let build_args = build.args.as_ref().map(|a| {
            a.iter().flat_map(|(k, v)| vec!["--build-arg".to_string(), format!("{}={}", k, v)]).collect::<Vec<_>>()
        }).unwrap_or_default();
        
        let build_tag = format!("container-ui-{}-build", env_id);
        let mut args: Vec<String> = vec!["build".into(), "-t".into(), build_tag, "-f".into(), build.dockerfile.clone()];
        args.extend(build_args);
        args.push(build.context.clone());
        
        docker_via_lima(instance, &args.iter().map(|s| s.as_str()).collect::<Vec<_>>())?;
    }

    // Prepare docker run arguments
    let name = format!("container-ui-{}", env_id);
    let mut run_args: Vec<String> = vec!["run".into(), "-d".into(), "--name".into(), name];
    
    // Add environment variables
    if let Some(env) = &spec.container_env {
        for (k, v) in env {
            run_args.push("-e".into());
            run_args.push(format!("{}={}", k, v));
        }
    }
    
    // Add mounts
    if let Some(mounts) = &spec.mounts {
        for mount in mounts {
            let mount_str = if mount.writable {
                format!("{}:{}", mount.source, mount.target)
            } else {
                format!("{}:{}:ro", mount.source, mount.target)
            };
            run_args.push("-v".into());
            run_args.push(mount_str);
        }
    }
    
    // Always mount project path
    run_args.push("-v".into());
    run_args.push(format!("{}:/workspace", project_path));
    
    // Add port forwards
    if let Some(ports) = &spec.forward_ports {
        for port in ports {
            run_args.push("-p".into());
            run_args.push(format!("127.0.0.1:{}:{}", port, port));
        }
    }
    
    // Add custom run args
    if let Some(args) = &spec.run_args {
        run_args.extend(args.iter().cloned());
    }
    
    // Set working directory
    run_args.push("-w".into());
    run_args.push("/workspace".into());
    
    // Run post-start command if specified
    let cmd = spec.post_start_command.as_deref().unwrap_or("sleep infinity");
    run_args.push(image.into());
    run_args.push("sh".into());
    run_args.push("-c".into());
    run_args.push(cmd.into());
    
    let output = docker_via_lima(instance, &run_args.iter().map(|s| s.as_str()).collect::<Vec<_>>())?;
    let container_id = output.trim().to_string();
    
    Ok(container_id)
}

async fn create_compose_env(
    instance: &str,
    project_path: &str,
    spec: &ComposeSpec,
    env_id: &str,
) -> Result<String, String> {
    let compose_file = &spec.file;
    let service = &spec.service;
    
    // Run docker compose up -d for the service
    let args = vec!["-f", compose_file, "up", "-d", "--no-deps", service];
    compose_via_lima(instance, project_path, &args)?;
    
    // Get the container ID
    let ps_args = vec!["-f", compose_file, "ps", "-q", service];
    let output = compose_via_lima(instance, project_path, &ps_args)?;
    let container_id = output.trim().to_string();
    
    Ok(container_id)
}

async fn create_auto_env(instance: &str, project_path: &str, env_id: &str) -> Result<String, String> {
    // Default: run a basic container with project mounted
    let name = format!("container-ui-{}", env_id);
    let run_args: Vec<String> = vec![
        "run".into(), "-d".into(), "--name".into(), name,
        "-v".into(), format!("{}:/workspace", project_path),
        "-w".into(), "/workspace".into(),
        "ubuntu:22.04".into(),
        "sleep".into(), "infinity".into(),
    ];
    
    let output = docker_via_lima(instance, &run_args.iter().map(|s| s.as_str()).collect::<Vec<_>>())?;
    Ok(output.trim().to_string())
}

// Start project environment
#[tauri::command]
pub async fn project_env_start(_app: tauri::AppHandle, env_id: String) -> Result<(), String> {
    let container_id = {
        let mut envs = PROJECT_ENVS.lock().unwrap();
        let env = envs.get_mut(&env_id).ok_or("Environment not found")?;
        
        if env.state == "running" {
            return Ok(());
        }
        
        env.state = "starting".to_string();
        env.updated_at = chrono::Utc::now().to_rfc3339();
        env.container_id.clone()
    };
    
    let instance = "default";
    if let Some(container_id) = container_id {
        docker_via_lima(instance, &["start", &container_id])?;
    }
    
    let mut envs = PROJECT_ENVS.lock().unwrap();
    if let Some(env) = envs.get_mut(&env_id) {
        env.state = "running".to_string();
        env.updated_at = chrono::Utc::now().to_rfc3339();
        env.error = None;
    }
    
    Ok(())
}

// Stop project environment
#[tauri::command]
pub async fn project_env_stop(_app: tauri::AppHandle, env_id: String) -> Result<(), String> {
    let container_id = {
        let mut envs = PROJECT_ENVS.lock().unwrap();
        let env = envs.get_mut(&env_id).ok_or("Environment not found")?;
        
        if env.state == "stopped" {
            return Ok(());
        }
        
        env.state = "stopping".to_string();
        env.updated_at = chrono::Utc::now().to_rfc3339();
        env.container_id.clone()
    };
    
    let instance = "default";
    if let Some(container_id) = container_id {
        docker_via_lima(instance, &["stop", &container_id])?;
    }
    
    let mut envs = PROJECT_ENVS.lock().unwrap();
    if let Some(env) = envs.get_mut(&env_id) {
        env.state = "stopped".to_string();
        env.updated_at = chrono::Utc::now().to_rfc3339();
    }
    
    Ok(())
}

// Delete project environment
#[tauri::command]
pub async fn project_env_delete(_app: tauri::AppHandle, env_id: String) -> Result<(), String> {
    let mut envs = PROJECT_ENVS.lock().unwrap();
    let env = envs.get(&env_id).ok_or("Environment not found")?;
    
    let instance = "default";
    if let Some(container_id) = &env.container_id {
        // Stop and remove container
        let _ = docker_via_lima(instance, &["stop", container_id]);
        let _ = docker_via_lima(instance, &["rm", "-f", container_id]);
    }
    
    envs.remove(&env_id);
    ENV_LOGS.lock().unwrap().remove(&env_id);
    
    Ok(())
}

// List project environments
#[tauri::command]
pub async fn project_env_list() -> Result<Vec<ProjectEnvironment>, String> {
    let envs = PROJECT_ENVS.lock().unwrap();
    Ok(envs.values().cloned().collect())
}

// Get project environment
#[tauri::command]
pub async fn project_env_get(env_id: String) -> Result<Option<ProjectEnvironment>, String> {
    let envs = PROJECT_ENVS.lock().unwrap();
    Ok(envs.get(&env_id).cloned())
}

// Stream logs from project environment
#[tauri::command]
pub async fn project_env_logs(app: tauri::AppHandle, env_id: String, follow: bool) -> Result<(), String> {
    let container_id = {
        let envs = PROJECT_ENVS.lock().unwrap();
        let env = envs.get(&env_id).ok_or("Environment not found")?;
        env.container_id.clone().ok_or("No container ID")?
    };
    
    let instance = "default";
    let event_name = format!("project-env-logs-{}", env_id);
    
    tauri::async_runtime::spawn_blocking(move || {
        let mut args = vec!["logs".to_string()];
        if follow {
            args.push("-f".to_string());
        }
        args.push("--timestamps".to_string());
        args.push(container_id);
        
        let lima_bin = lima_cli();
        let mut shell_args: Vec<String> = vec!["shell".into(), instance.into(), "docker".into()];
        shell_args.extend(args);
        
        let _ = stream(&app, &event_name, &lima_bin, &shell_args);
    })
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

// Execute command in project environment
#[tauri::command]
pub async fn project_env_exec(_app: tauri::AppHandle, env_id: String, cmd: Vec<String>) -> Result<ExecResult, String> {
    let envs = PROJECT_ENVS.lock().unwrap();
    let env = envs.get(&env_id).ok_or("Environment not found")?;
    let container_id = env.container_id.clone().ok_or("No container ID")?;
    drop(envs);
    
    let instance = "default";
    let mut args = vec!["exec", "-i", &container_id];
    args.extend(cmd.iter().map(|s| s.as_str()));
    
    let output = docker_via_lima(instance, &args)?;
    
    // For simplicity, return the output as stdout (in real implementation, capture exit code)
    Ok(ExecResult {
        exit_code: 0,
        stdout: output,
        stderr: String::new(),
    })
}

// Forward port from project environment
#[tauri::command]
pub async fn project_env_forward_port(_app: tauri::AppHandle, env_id: String, container_port: u16) -> Result<PortMapping, String> {
    let mut envs = PROJECT_ENVS.lock().unwrap();
    let env = envs.get_mut(&env_id).ok_or("Environment not found")?;
    
    // Check if already forwarded
    let mut ports: Vec<PortMapping> = serde_json::from_str(&env.ports_json).unwrap_or_default();
    let existing_index = ports.iter().position(|p| p.container_port == container_port);
    
    if let Some(idx) = existing_index {
        ports[idx].is_forwarded = true;
        ports[idx].host_port = Some(container_port);
        env.ports_json = serde_json::to_string(&ports).unwrap();
        env.updated_at = chrono::Utc::now().to_rfc3339();
        return Ok(ports[idx].clone());
    }
    
    // Add new port mapping
    let mapping = PortMapping {
        container_port,
        host_port: Some(container_port),
        protocol: "tcp".to_string(),
        is_forwarded: true,
    };
    
    ports.push(mapping.clone());
    env.ports_json = serde_json::to_string(&ports).unwrap();
    env.updated_at = chrono::Utc::now().to_rfc3339();
    
    Ok(mapping)
}

// Unforward port from project environment
#[tauri::command]
pub async fn project_env_unforward_port(app: tauri::AppHandle, env_id: String, container_port: u16) -> Result<(), String> {
    let mut envs = PROJECT_ENVS.lock().unwrap();
    let env = envs.get_mut(&env_id).ok_or("Environment not found")?;
    
    let mut ports: Vec<PortMapping> = serde_json::from_str(&env.ports_json).unwrap_or_default();
    ports.retain(|p| p.container_port != container_port);
    env.ports_json = serde_json::to_string(&ports).unwrap();
    env.updated_at = chrono::Utc::now().to_rfc3339();
    
    Ok(())
}

// Set project environment (called from frontend when environment is created)
#[tauri::command]
pub async fn project_set_environment(_project_id: String, _environment_id: String) -> Result<(), String> {
    // In a real implementation, this would update the SQLite database
    // For now, just acknowledge
    Ok(())
}

// Get SSH auth sock
#[tauri::command]
pub fn get_ssh_auth_sock() -> Result<String, String> {
    std::env::var("SSH_AUTH_SOCK").map_err(|_| "SSH_AUTH_SOCK not set".into())
}

// Get git config
#[tauri::command]
pub fn git_config_get(key: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["config", "--global", "--get", &key])
        .output()
        .map_err(|e| e.to_string())?;
    
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("Not set".into())
    }
}

// Get GH token
#[tauri::command]
pub fn get_gh_token() -> Result<String, String> {
    let output = Command::new("gh")
        .args(["auth", "token"])
        .output()
        .map_err(|e| e.to_string())?;
    
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("Not authenticated".into())
    }
}

// Get home directory
#[tauri::command]
pub fn get_home_dir() -> String {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

// Dialog open (folder picker)
#[tauri::command]
pub async fn dialog_open(options: DialogOpenOptions) -> Result<String, String> {
    if !cfg!(target_os = "macos") {
        return Err("Folder picker only supported on macOS".into());
    }
    
    let script = if options.directory.unwrap_or(true) {
        r#"POSIX path of (choose folder with prompt "Select Project Directory")"#
    } else {
        r#"POSIX path of (choose file with prompt "Select File")"#
    };
    
    let output = Command::new("/usr/bin/osascript")
        .args(["-e", script])
        .output()
        .map_err(|e| format!("Could not open folder chooser: {e}"))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    if output.status.success() && !stdout.is_empty() {
        Ok(stdout.trim_end_matches('/').to_string())
    } else if stderr.contains("User canceled") || stderr.contains("(-128)") {
        Err("cancelled".into())
    } else {
        Err(stderr.trim().to_string())
    }
}

// Read directory entries
#[tauri::command]
pub fn fs_read_dir(path: String) -> Result<Vec<String>, String> {
    let entries = std::fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory: {e}"))?
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect();
    Ok(entries)
}

// Read text file
#[tauri::command]
pub fn fs_read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {e}"))
}

#[derive(Deserialize)]
pub struct DialogOpenOptions {
    title: Option<String>,
    directory: Option<bool>,
    multiple: Option<bool>,
}

// Re-export the stream and stream_with functions from main.rs
// These are defined in main.rs so we'll use them via the existing pattern
// use crate::{stream, stream_with};

#[cfg(test)]
mod tests {
    #[test]
    fn test_lima_cli_path() {
        let cli = lima_cli();
        assert!(!cli.is_empty());
    }
}