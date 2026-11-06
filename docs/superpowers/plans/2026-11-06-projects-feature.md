# Projects Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Projects" tab as the default landing page for project-based dev environments (devcontainer + compose), using Lima (macOS) / Docker (Linux/Windows) runtime, with auto-detection, terminal, port forwarding, and IDE launch. Keep existing VM management as "Advanced" tab.

**Architecture:** Progressive disclosure. New `Projects` tab (simple) + existing tabs under "Advanced" menu. New `LimaDockerAdapter` runtime for project environments. Reuse existing Tauri commands where possible; add new commands for project CRUD, environment lifecycle, terminal streaming.

**Tech Stack:** Existing Tauri v2, React, TypeScript. New: `@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-webgl` for terminal. `zod` for config validation.

**Spec:** docs/superpowers/specs/2026-11-06-container-ui-design.md (referenced for project-based workflow, runtime abstraction, auto-detection)

## Global Constraints

- Must not break existing Colima/OrbStack/Rancher/Podman/Docker Desktop management
- New runtime adapter: `LimaDockerAdapter` (Lima on macOS, Docker on Linux/Windows)
- Auto-detection priority: `.devcontainer/devcontainer.json` → `docker-compose.yml`/`compose.yml` → `Dockerfile` → language defaults
- Inject: SSH agent, git config, GitHub CLI auth, dotfiles
- Terminal: xterm.js with webgl addon
- Port forwarding: automatic for `forwardPorts` / `ports` in devcontainer.json
- IDE launch: VS Code / Cursor via `vscode-remote://dev-container+<containerId>/workspace`

## Review Focus

1. **Runtime detection** — App must gracefully handle missing Lima/Docker, guide install, not crash when runtime disappears mid-operation.
2. **Project path security** — Path traversal, symlink resolution, permission checks when opening arbitrary folders.
3. **Container lifecycle races** — Concurrent start/stop on same project environment must be serialized or rejected with clear error.
4. **Port forwarding cleanup** — Forwarded ports released on environment stop, crash, app quit; no orphans.
5. **Auto-detection false positives** — Config detection must not misidentify unrelated files; user must confirm before creating environment.

---

### Task 1: New Runtime Adapter (Lima + Docker)

**Files:**
- Create: `src/runtime/lima-docker-adapter.ts`
- Modify: `src/runtime/index.ts` (register new adapter)
- Create: `src-tauri/src/lima.rs` (Rust side: Lima detection, VM management, Docker socket)
- Modify: `src-tauri/src/main.rs` (register new Tauri commands)

**Interfaces:**
- Consumes: Existing `RuntimeAdapter` interface, Tauri invoke
- Produces: `LimaDockerAdapter` implementing `RuntimeAdapter` + project-specific methods

- [ ] **Step 1: Define Rust-side Lima/Docker commands**

```rust
// src-tauri/src/lima.rs (new file)
use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::Emitter;

#[derive(Serialize, Deserialize)]
pub struct LimaStatus {
    pub available: bool,
    pub version: Option<String>,
    pub vm_running: bool,
    pub docker_socket: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ProjectEnvironment {
    pub id: String,
    pub project_path: String,
    pub container_id: Option<String>,
    pub state: String, // "stopped" | "starting" | "running" | "error"
    pub ports: Vec<PortMapping>,
    pub mounts: Vec<MountSpec>,
    pub env_vars: Vec<EnvVar>,
}

#[derive(Serialize, Deserialize)]
pub struct PortMapping {
    pub container_port: u16,
    pub host_port: Option<u16>,
    pub protocol: String,
}

#[derive(Serialize, Deserialize)]
pub struct MountSpec {
    pub source: String,
    pub target: String,
    pub writable: bool,
}

#[derive(Serialize, Deserialize)]
pub struct EnvVar {
    pub key: String,
    pub value: String,
    pub source: String, // "config" | "dotenv" | "system" | "injected"
}

#[derive(Deserialize)]
pub struct CreateProjectEnvInput {
    pub project_id: String,
    pub project_path: String,
    pub config: ProjectEnvConfig,
}

#[derive(Deserialize)]
#[serde(tag = "type")]
pub enum ProjectEnvConfig {
    DevContainer { devcontainer: DevContainerSpec },
    Compose { compose: ComposeSpec },
    Auto,
}

#[derive(Deserialize)]
pub struct DevContainerSpec {
    pub image: Option<String>,
    pub dockerfile: Option<String>,
    pub build: Option<BuildSpec>,
    pub run_args: Option<Vec<String>>,
    pub container_env: Option<std::collections::HashMap<String, String>>,
    pub remote_env: Option<std::collections::HashMap<String, String>>,
    pub mounts: Option<Vec<MountSpec>>,
    pub ports: Option<Vec<u16>>,
    pub forward_ports: Option<Vec<u16>>,
    pub post_create_command: Option<String>,
    pub post_start_command: Option<String>,
    pub customizations: Option<serde_json::Value>,
}

#[derive(Deserialize)]
pub struct BuildSpec {
    pub context: String,
    pub dockerfile: String,
    pub args: Option<std::collections::HashMap<String, String>>,
}

#[derive(Deserialize)]
pub struct ComposeSpec {
    pub file: String,
    pub service: String,
    pub env_file: Option<String>,
}

// Tauri commands
#[tauri::command]
async fn lima_status() -> Result<LimaStatus, String> { ... }

#[tauri::command]
async fn lima_ensure_vm(app: tauri::AppHandle) -> Result<LimaStatus, String> { ... }

#[tauri::command]
async fn project_env_create(app: tauri::AppHandle, input: CreateProjectEnvInput) -> Result<ProjectEnvironment, String> { ... }

#[tauri::command]
async fn project_env_start(app: tauri::AppHandle, env_id: String) -> Result<(), String> { ... }

#[tauri::command]
async fn project_env_stop(app: tauri::AppHandle, env_id: String) -> Result<(), String> { ... }

#[tauri::command]
async fn project_env_delete(app: tauri::AppHandle, env_id: String) -> Result<(), String> { ... }

#[tauri::command]
async fn project_env_logs(app: tauri::AppHandle, env_id: String, follow: bool) -> Result<(), String> { ... }

#[tauri::command]
async fn project_env_exec(app: tauri::AppHandle, env_id: String, cmd: Vec<String>) -> Result<ExecResult, String> { ... }

#[tauri::command]
async fn project_env_forward_port(app: tauri::AppHandle, env_id: String, container_port: u16) -> Result<PortMapping, String> { ... }

#[tauri::command]
async fn project_env_unforward_port(app: tauri::AppHandle, env_id: String, container_port: u16) -> Result<(), String> { ... }
```

- [ ] **Step 2: Implement Lima detection & VM management**

```rust
// In lima.rs
fn lima_cli() -> String {
    ["/opt/homebrew/bin/lima", "/usr/local/bin/lima"]
        .iter()
        .find(|p| std::path::Path::new(p).exists())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "lima".to_string())
}

fn lima_home() -> String {
    std::env::var("LIMA_HOME").unwrap_or_else(|_| {
        dirs::home_dir().map(|h| h.join(".lima").to_string_lossy().to_string()).unwrap_or_default()
    })
}

async fn ensure_default_lima_vm(app: &tauri::AppHandle) -> Result<String, String> {
    // Check if "default" instance exists
    let output = Command::new(lima_cli())
        .args(["list", "-q"])
        .output()
        .map_err(|e| format!("Failed to run lima list: {e}"))?;
    
    let instances: Vec<String> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    
    if !instances.contains(&"default".to_string()) {
        // Create default instance with reasonable defaults
        stream(app, "lima-progress", lima_cli(), &["start".into(), "--name=default".into(), "default".into()])?;
    } else if !is_vm_running("default") {
        stream(app, "lima-progress", lima_cli(), &["start".into(), "default".into()])?;
    }
    Ok("default".to_string())
}

fn get_docker_host(instance: &str) -> Result<String, String> {
    // Try to get DOCKER_HOST from lima
    let output = Command::new(lima_cli())
        .args(["shell", instance, "echo", "$DOCKER_HOST"])
        .output()
        .map_err(|e| format!("Failed to get docker host: {e}"))?;
    
    let host = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if host.is_empty() {
        // Fallback to default socket path
        let home = dirs::home_dir().ok_or("No home directory")?;
        Ok(format!("unix://{}/.lima/{}/docker.sock", home.display(), instance))
    } else {
        Ok(host)
    }
}
```

- [ ] **Step 3: Implement project environment lifecycle (docker commands via Lima VM)**

```rust
// In lima.rs - use bollard or docker CLI via lima shell
async fn create_project_environment(app: tauri::AppHandle, input: CreateProjectEnvInput) -> Result<ProjectEnvironment, String> {
    let instance = ensure_default_lima_vm(&app).await?;
    let docker_host = get_docker_host(&instance)?;
    
    // Parse config, build docker run command or compose up
    // For devcontainer: build docker run args from spec
    // For compose: run `docker compose -f <file> up -d <service>`
    
    // Return environment with container_id
}

async fn start_project_environment(app: tauri::AppHandle, env_id: String) -> Result<(), String> {
    // docker start <container_id> via lima shell
}

async fn stop_project_environment(app: tauri::AppHandle, env_id: String) -> Result<(), String> {
    // docker stop <container_id> via lima shell
    // Clean up port forwards
}
```

- [ ] **Step 4: Implement log streaming & exec via Tauri events**

```rust
// Stream logs: `docker logs -f <container_id>` via lima shell
// Emit "project-env-logs-{env_id}" events

// Exec: `docker exec -it <container_id> <cmd>` via lima shell
// Return ExecResult { exit_code, stdout, stderr }
```

- [ ] **Step 5: Create TypeScript adapter**

```typescript
// src/runtime/lima-docker-adapter.ts
import { RuntimeAdapter, RuntimeInfo, RuntimeId, Profile, StartOpts, ResourceOpts, Diagnostics } from "./types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export class LimaDockerAdapter implements RuntimeAdapter {
  readonly id = 'lima-docker' as const;
  readonly name = 'Lima + Docker';
  readonly icon = 'lima';

  async isAvailable(): Promise<boolean> {
    try {
      const status = await invoke<LimaStatus>('lima_status');
      return status.available;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    const status = await invoke<LimaStatus>('lima_status');
    return status.version ?? 'unknown';
  }

  async listProfiles(): Promise<Profile[]> {
    // Project environments, not VM profiles
    const envs = await invoke<ProjectEnvironment[]>('project_env_list');
    return envs.map(e => ({
      name: e.id,
      status: e.state,
      arch: 'arm64', // Lima default
      cpus: 4,
      memory: 8 * 1024 * 1024 * 1024,
      disk: 100 * 1024 * 1024 * 1024,
      runtime: 'lima-docker',
      address: e.container_id ? `container://${e.container_id}` : undefined,
    }));
  }

  // Project-specific methods (not in RuntimeAdapter interface)
  async createProjectEnvironment(input: CreateProjectEnvInput): Promise<ProjectEnvironment> {
    return invoke('project_env_create', { input });
  }

  async startProjectEnvironment(envId: string): Promise<void> {
    return invoke('project_env_start', { env_id: envId });
  }

  async stopProjectEnvironment(envId: string): Promise<void> {
    return invoke('project_env_stop', { env_id: envId });
  }

  async deleteProjectEnvironment(envId: string): Promise<void> {
    return invoke('project_env_delete', { env_id: envId });
  }

  async getProjectEnvironmentLogs(envId: string, follow: boolean, onLog: (log: LogLine) => void): Promise<() => void> {
    const unlisten = await listen<LogLine>(`project-env-logs-${envId}`, (e) => onLog(e.payload));
    await invoke('project_env_logs', { env_id: envId, follow });
    return unlisten;
  }

  async execInProjectEnvironment(envId: string, cmd: string[]): Promise<ExecResult> {
    return invoke('project_env_exec', { env_id: envId, cmd });
  }

  async forwardPort(envId: string, containerPort: number): Promise<PortMapping> {
    return invoke('project_env_forward_port', { env_id: envId, container_port: containerPort });
  }

  async unforwardPort(envId: string, containerPort: number): Promise<void> {
    return invoke('project_env_unforward_port', { env_id: envId, container_port: containerPort });
  }

  getDockerContext(profileName: string): string {
    return `lima-docker-${profileName}`; // Not used for project envs
  }

  hasKubernetes(): boolean { return false; }
  getKubeContext(profileName: string): string { return ''; }
  async getDiagnostics(): Promise<Diagnostics> { ... }
}

// Types
interface LimaStatus { ... }
interface ProjectEnvironment { ... }
interface PortMapping { ... }
interface MountSpec { ... }
interface EnvVar { ... }
interface CreateProjectEnvInput { ... }
interface DevContainerSpec { ... }
interface ComposeSpec { ... }
interface ExecResult { exit_code: number; stdout: string; stderr: string; }
interface LogLine { timestamp: string; stream: 'stdout' | 'stderr' | 'system'; content: string; }
```

- [ ] **Step 6: Register adapter in runtime registry**

```typescript
// src/runtime/index.ts (modify)
import { LimaDockerAdapter } from "./lima-docker-adapter";

// ... existing code ...
runtimeRegistry.register(new LimaDockerAdapter());
```

- [ ] **Step 7: Verify Rust compiles & TypeScript types work**

Run: `cargo check` (in src-tauri)
Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit runtime adapter**

```bash
git add src/runtime/lima-docker-adapter.ts src/runtime/index.ts src-tauri/src/lima.rs src-tauri/src/main.rs
git commit -m "feat: add Lima+Docker runtime adapter for project environments"
```

---

### Task 2: Project Auto-Detection Library

**Files:**
- Create: `src/lib/projectDetection.ts`
- Create: `src/lib/projectDetection.test.ts`

**Interfaces:**
- Consumes: File system access (Tauri FS plugin)
- Produces: `detectProjectConfig(projectPath)` → `{ configType, devcontainer?, compose?, dockerfile? }`

- [ ] **Step 1: Implement detection logic**

```typescript
// src/lib/projectDetection.ts
import { invoke } from "@tauri-apps/api/core";

export type ConfigType = 'devcontainer' | 'compose' | 'dockerfile' | 'auto';

export interface DevContainerSpec {
  image?: string;
  dockerfile?: string;
  build?: { context: string; dockerfile: string; args?: Record<string, string> };
  runArgs?: string[];
  containerEnv?: Record<string, string>;
  remoteEnv?: Record<string, string>;
  mounts?: MountSpec[];
  ports?: number[];
  forwardPorts?: number[];
  postCreateCommand?: string;
  postStartCommand?: string;
  customizations?: Record<string, unknown>;
}

export interface MountSpec {
  source: string;
  target: string;
  type: 'bind' | 'volume' | 'tmpfs';
  readonly: boolean;
}

export interface ComposeSpec {
  file: string;
  service: string;
  envFile?: string;
}

export interface DetectResult {
  configType: ConfigType;
  devcontainer?: DevContainerSpec;
  compose?: ComposeSpec;
  dockerfile?: string;
  language?: string;
}

export async function detectProjectConfig(projectPath: string): Promise<DetectResult> {
  // Use Tauri FS to read directory
  const entries = await invoke<string[]>('fs_read_dir', { path: projectPath });
  
  // 1. Check .devcontainer/devcontainer.json
  if (entries.includes('.devcontainer')) {
    const devcontainerEntries = await invoke<string[]>('fs_read_dir', { path: `${projectPath}/.devcontainer` });
    if (devcontainerEntries.includes('devcontainer.json')) {
      const content = await invoke<string>('fs_read_text_file', { path: `${projectPath}/.devcontainer/devcontainer.json` });
      const spec = parseDevContainerJson(content, projectPath);
      
      // Check for referenced docker-compose
      if (devcontainerEntries.some(e => e.endsWith('.yml') || e.endsWith('.yaml'))) {
        return { configType: 'devcontainer', devcontainer: spec };
      }
      return { configType: 'devcontainer', devcontainer: spec };
    }
  }
  
  // 2. Check for compose files
  for (const file of ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']) {
    if (entries.includes(file)) {
      const services = await parseComposeServices(`${projectPath}/${file}`);
      return {
        configType: 'compose',
        compose: { file, service: services[0] || 'app', envFile: entries.includes('.env') ? '.env' : undefined }
      };
    }
  }
  
  // 3. Check for Dockerfile
  for (const file of ['Dockerfile', 'Dockerfile.dev', 'Dockerfile.development']) {
    if (entries.includes(file)) {
      return {
        configType: 'dockerfile',
        dockerfile: file,
        devcontainer: {
          dockerfile: file,
          build: { context: '.', dockerfile: file },
          forwardPorts: [3000, 8080, 5173],
        }
      };
    }
  }
  
  // 4. Language defaults
  const language = detectLanguage(entries);
  return {
    configType: 'auto',
    devcontainer: getLanguageDefaults(language),
    language,
  };
}

function parseDevContainerJson(content: string, projectPath: string): DevContainerSpec {
  // Strip JSON comments (devcontainer.json supports // and /* */)
  const stripped = stripJsonComments(content);
  const parsed = JSON.parse(stripped);
  
  // Expand ~ in mounts
  if (parsed.mounts) {
    parsed.mounts = parsed.mounts.map((m: any) => ({
      ...m,
      source: m.source.replace('~', (await invoke<string>('get_home_dir')).trim())
    }));
  }
  
  return parsed;
}

function stripJsonComments(json: string): string {
  // ... implementation ...
}

async function parseComposeServices(filePath: string): Promise<string[]> {
  const content = await invoke<string>('fs_read_text_file', { path: filePath });
  const yaml = parseYaml(content); // Use a simple YAML parser or regex
  return Object.keys(yaml.services || {});
}

function detectLanguage(entries: string[]): string {
  if (entries.includes('package.json')) return 'node';
  if (entries.includes('pyproject.toml') || entries.includes('requirements.txt')) return 'python';
  if (entries.includes('Cargo.toml')) return 'rust';
  if (entries.includes('go.mod')) return 'go';
  if (entries.includes('pom.xml') || entries.includes('build.gradle')) return 'java';
  return 'generic';
}

function getLanguageDefaults(language: string): DevContainerSpec {
  const defaults: Record<string, DevContainerSpec> = {
    node: { image: 'node:20-bookworm', forwardPorts: [3000, 8080, 5173], postCreateCommand: 'npm install' },
    python: { image: 'python:3.12-bookworm', forwardPorts: [8000, 8080], postCreateCommand: 'pip install -e .' },
    rust: { image: 'rust:1.78-bookworm', postCreateCommand: 'cargo build' },
    go: { image: 'golang:1.22-bookworm', postCreateCommand: 'go mod download' },
    generic: { image: 'ubuntu:22.04' },
  };
  return defaults[language] || defaults.generic;
}
```

- [ ] **Step 2: Add Tauri FS commands for detection**

```rust
// In src-tauri/src/main.rs
#[tauri::command]
async fn fs_read_dir(path: String) -> Result<Vec<String>, String> { ... }

#[tauri::command]
async fn fs_read_text_file(path: String) -> Result<String, String> { ... }

#[tauri::command]
fn get_home_dir() -> String {
    dirs::home_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_default()
}
```

- [ ] **Step 3: Write tests**

```typescript
// src/lib/projectDetection.test.ts
import { detectProjectConfig } from "./projectDetection";

describe('detectProjectConfig', () => {
  it('detects devcontainer.json', async () => { ... });
  it('detects docker-compose.yml', async () => { ... });
  it('detects Dockerfile', async () => { ... });
  it('falls back to language defaults', async () => { ... });
});
```

- [ ] **Step 4: Run tests**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 5: Commit detection library**

```bash
git add src/lib/projectDetection.ts src/lib/projectDetection.test.ts src-tauri/src/main.rs
git commit -m "feat: add project config auto-detection library"
```

---

### Task 3: Projects Data Layer (SQLite)

**Files:**
- Create: `src-tauri/src/projects.rs` (Rust: Project CRUD, SQLite)
- Create: `src/lib/projectsApi.ts` (TypeScript: invoke wrappers)
- Modify: `src-tauri/src/main.rs` (register commands)

**Interfaces:**
- Consumes: Existing SQLite setup (if any) or new `sqlx` dependency
- Produces: Project CRUD, environment association

- [ ] **Step 1: Add sqlx dependency**

```toml
# src-tauri/Cargo.toml
sqlx = { version = "0.7", features = ["runtime-tokio", "sqlite", "chrono", "uuid", "migrate"] }
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["serde", "v4", "v7"] }
```

- [ ] **Step 2: Create projects table migration**

```sql
-- migrations/001_projects.sql
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    git_remote_url TEXT,
    git_branch TEXT,
    git_commit TEXT,
    git_dirty BOOLEAN DEFAULT 0,
    dev_environment_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE project_environments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    config_type TEXT NOT NULL,
    config_json TEXT NOT NULL,
    runtime TEXT NOT NULL DEFAULT 'lima-docker',
    state TEXT NOT NULL DEFAULT 'stopped',
    container_id TEXT,
    ports_json TEXT DEFAULT '[]',
    mounts_json TEXT DEFAULT '[]',
    env_vars_json TEXT DEFAULT '[]',
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

- [ ] **Step 3: Implement Rust commands**

```rust
// src-tauri/src/projects.rs
#[tauri::command]
async fn project_create(app: tauri::AppHandle, input: CreateProjectInput) -> Result<Project, String> { ... }

#[tauri::command]
async fn project_get(id: String) -> Result<Option<Project>, String> { ... }

#[tauri::command]
async fn project_list() -> Result<Vec<Project>, String> { ... }

#[tauri::command]
async fn project_delete(id: String) -> Result<(), String> { ... }

#[tauri::command]
async fn project_detect_config(id: String) -> Result<DetectResult, String> { ... }

#[tauri::command]
async fn project_open_in_ide(id: String) -> Result<(), String> { ... }
```

- [ ] **Step 4: Implement TypeScript API**

```typescript
// src/lib/projectsApi.ts
import { invoke } from "@tauri-apps/api/core";
import type { Project, CreateProjectInput, DetectResult } from "./projectDetection";

export const projectsApi = {
  create: (input: CreateProjectInput) => invoke<Project>('project_create', { input }),
  get: (id: string) => invoke<Project | null>('project_get', { id }),
  list: () => invoke<Project[]>('project_list'),
  delete: (id: string) => invoke<void>('project_delete', { id }),
  detectConfig: (id: string) => invoke<DetectResult>('project_detect_config', { id }),
  openInIde: (id: string) => invoke<void>('project_open_in_ide', { id }),
};
```

- [ ] **Step 5: Verify & commit**

Run: `cargo check && npx tsc --noEmit`
```bash
git add src-tauri/src/projects.rs src/lib/projectsApi.ts src-tauri/Cargo.toml src-tauri/src/main.rs
git commit -m "feat: add projects data layer with SQLite persistence"
```

---

### Task 4: Projects UI - List & Create

**Files:**
- Create: `src/Projects.tsx` (main page)
- Create: `src/ProjectCard.tsx`
- Create: `src/CreateProjectDialog.tsx`
- Modify: `src/App.tsx` (add Projects tab as default)
- Modify: `src/ui/PageHeader.tsx` (if needed)

**Interfaces:**
- Consumes: `projectsApi`, `detectProjectConfig`, `LimaDockerAdapter`
- Produces: Projects landing page with list, create dialog, project cards

- [ ] **Step 1: Create ProjectCard component**

```tsx
// src/ProjectCard.tsx
import { Project } from "./lib/projectsApi";
import { invoke } from "@tauri-apps/api/core";
import Card from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { FolderGit2, Play, Terminal, ExternalLink, ChevronRight, Search } from "./ui/icons";
import { useState } from "react";
import { detectProjectConfig, DevContainerSpec, ComposeSpec } from "./lib/projectDetection";

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onSelect, onDelete }: ProjectCardProps) {
  const [detecting, setDetecting] = useState(false);
  const [configPreview, setConfigPreview] = useState<DevContainerSpec | ComposeSpec | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const result = await invoke<DetectResult>('project_detect_config', { id: project.id });
      if (result.devcontainer) setConfigPreview(result.devcontainer);
      else if (result.compose) setConfigPreview(result.compose);
      setShowPreview(true);
    } catch (e) {
      console.error(e);
    } finally {
      setDetecting(false);
    }
  };

  return (
    <Card className="group transition-shadow hover:shadow-md" onClick={() => onSelect(project)}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <FolderGit2 className="h-10 w-10 text-muted-foreground/50" />
            <div>
              <h3 className="font-semibold text-lg">{project.name}</h3>
              <p className="text-sm text-muted-foreground truncate max-w-[300px]">{project.path}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {project.git_branch && (
              <Badge variant="outline" className="gap-1">
                <Search className="h-3 w-3" />
                <span className="text-xs">{project.git_branch}</span>
              </Badge>
            )}
            {project.dev_environment_id && (
              <Badge variant="success">Ready</Badge>
            )}
          </div>
        </div>
        
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {project.git_remote_url && (
              <span className="truncate max-w-[200px]">{project.git_remote_url}</span>
            )}
            {project.git_dirty && <Badge variant="warning" className="text-xs">Uncommitted</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDetect(); }} disabled={detecting} title="Detect config">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onSelect(project); }} title="Open">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showPreview && configPreview && (
          <ConfigPreview config={configPreview} onClose={() => setShowPreview(false)} />
        )}
      </div>
    </Card>
  );
}

function ConfigPreview({ config, onClose }: { config: DevContainerSpec | ComposeSpec; onClose: () => void }) {
  return (
    <div className="mt-3 p-3 bg-muted/50 rounded-lg border text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">Detected: {'image' in config ? 'Dev Container' : 'Compose'}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
      </div>
      {('image' in config) && (
        <div className="space-y-1">
          {config.image && <div>Image: <code className="text-xs">{config.image}</code></div>}
          {config.forwardPorts?.length && <div>Ports: <code className="text-xs">{config.forwardPorts.join(', ')}</code></div>}
          {config.postCreateCommand && <div>Post-create: <code className="text-xs">{config.postCreateCommand}</code></div>}
        </div>
      )}
      {('file' in config) && (
        <div className="space-y-1">
          <div>File: <code className="text-xs">{config.file}</code></div>
          <div>Service: <code className="text-xs">{config.service}</code></div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create Projects page**

```tsx
// src/Projects.tsx
import { useState } from "react";
import { projectsApi, CreateProjectInput } from "./lib/projectsApi";
import { ProjectCard } from "./ProjectCard";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { Button } from "./ui/Button";
import { Plus, RefreshCw, FolderOpen } from "./ui/icons";
import { Spinner } from "./ui/Spinner";
import { usePoll } from "./hooks";

export function Projects() {
  const { data: projects, refetch, isLoading } = usePoll(() => projectsApi.list(), [], 5000);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailView, setDetailView] = useState(false);

  const handleCreate = async (input: CreateProjectInput) => {
    await projectsApi.create(input);
    refetch();
    setCreateOpen(false);
  };

  const handleSelect = (project: Project) => {
    setSelectedProject(project);
    setDetailView(true);
  };

  if (isLoading && !projects) {
    return <div className="flex items-center justify-center h-64"><Spinner /></div>;
  }

  return (
    <div className="flex h-full flex-col">
      {!detailView ? (
        // List view
        <div className="flex-1 overflow-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Projects</h1>
            <div className="flex items-center gap-2">
              <CreateProjectDialog onSubmit={handleCreate} onOpenChange={setCreateOpen} />
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
            </div>
          </div>

          {projects && projects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg mb-4">No projects yet</p>
              <CreateProjectDialog onSubmit={handleCreate} onOpenChange={setCreateOpen} />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects?.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onSelect={handleSelect}
                  onDelete={async (id) => { if (confirm('Delete project?')) { await projectsApi.delete(id); refetch(); } }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        // Detail view
        <ProjectDetail project={selectedProject!} onBack={() => setDetailView(false)} onRefresh={refetch} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: CreateProjectDialog**

```tsx
// src/CreateProjectDialog.tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Label } from "./ui/Label";
import { FolderOpen } from "./ui/icons";
import { invoke } from "@tauri-apps/api/core";

interface CreateProjectDialogProps {
  onSubmit: (input: { path: string; name?: string }) => void;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ onSubmit, onOpenChange }: CreateProjectDialogProps) {
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [selecting, setSelecting] = useState(false);

  const handleSelectPath = async () => {
    setSelecting(true);
    try {
      const selected = await invoke<string>('dialog_open', {
        options: { title: 'Select Project Directory', directory: true, multiple: false }
      });
      if (selected) {
        setPath(selected);
        const folderName = selected.split('/').pop() || selected.split('\\').pop() || '';
        setName(folderName);
      }
    } catch (e) {
      // User cancelled
    } finally {
      setSelecting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!path) return;
    onSubmit({ path, name: name || undefined });
    setPath(''); setName('');
  };

  return (
    <Dialog open={createOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="path">Project Path</Label>
              <div className="flex gap-2">
                <Input
                  id="path"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/path/to/project"
                  disabled={selecting}
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={handleSelectPath} disabled={selecting}>
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-detected from folder" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!path || selecting}>Create Project</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Add Projects tab to App.tsx**

```tsx
// src/App.tsx - modifications
import { Projects } from "./Projects";

// In nav tabs, add "Projects" as first tab
const tabs = ["Projects", "Containers", "Images", "Volumes", "Networks", "Kubernetes", "Doctor", "Profiles"];

// In page rendering, add:
tab === "Projects" ? <Projects key={activeRuntimeId} /> : ...
```

- [ ] **Step 5: Make Projects the default tab**

```tsx// In App.tsx initial state
const [tab, setTab] = useState<Tab>("Projects"); // Was "Containers"
```

- [ ] **Step 6: Verify & commit**

Run: `npm run build`
```bash
git add src/Projects.tsx src/ProjectCard.tsx src/CreateProjectDialog.tsx src/App.tsx
git commit -m "feat: add Projects list page with create dialog and project cards"
```

---

### Task 5: Project Detail Page (Environment Management)

**Files:**
- Create: `src/ProjectDetail.tsx`
- Create: `src/ProjectTerminal.tsx`
- Create: `src/ProjectPorts.tsx`
- Create: `src/ProjectLogs.tsx`

**Interfaces:**
- Consumes: `LimaDockerAdapter` methods, `projectsApi`
- Produces: Project detail view with environment lifecycle, terminal, ports, logs

- [ ] **Step 1: Create ProjectDetail component**

```tsx
// src/ProjectDetail.tsx
import { useState, useEffect } from "react";
import { projectsApi, Project } from "./lib/projectsApi";
import { invoke } from "@tauri-apps/api/core";
import { detectProjectConfig, DevContainerSpec, ComposeSpec } from "./lib/projectDetection";
import { LimaDockerAdapter } from "./runtime/lima-docker-adapter";
import { runtimeRegistry } from "./runtime";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Spinner } from "./ui/Spinner";
import { Play, Stop, RotateCcw, Terminal, ExternalLink, Trash2, Download, Search, ChevronLeft } from "./ui/icons";
import { ProjectTerminal } from "./ProjectTerminal";
import { ProjectLogs } from "./ProjectLogs";
import { ProjectPorts } from "./ProjectPorts";

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  onRefresh: () => void;
}

export function ProjectDetail({ project, onBack, onRefresh }: ProjectDetailProps) {
  const [config, setConfig] = useState<DevContainerSpec | ComposeSpec | null>(null);
  const [configType, setConfigType] = useState<'devcontainer' | 'compose' | 'auto' | null>(null);
  const [environment, setEnvironment] = useState<ProjectEnvironment | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const adapter = runtimeRegistry.get('lima-docker') as LimaDockerAdapter;

  useEffect(() => {
    loadEnvironment();
  }, [project.id]);

  const loadEnvironment = async () => {
    if (project.dev_environment_id) {
      const envs = await adapter.listProfiles(); // Returns project envs
      const env = envs.find(e => e.name === project.dev_environment_id);
      setEnvironment(env || null);
    }
  };

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const result = await projectsApi.detectConfig(project.id);
      if (result.devcontainer) { setConfig(result.devcontainer); setConfigType('devcontainer'); }
      else if (result.compose) { setConfig(result.compose); setConfigType('compose'); }
      else if (result.dockerfile) { setConfigType('dockerfile'); }
    } finally { setDetecting(false); }
  };

  const handleCreateEnvironment = async () => {
    if (!config || !configType) return;
    setLoading(true);
    try {
      const env = await adapter.createProjectEnvironment({
        project_id: project.id,
        project_path: project.path,
        config: configType === 'devcontainer' ? { type: 'devcontainer', devcontainer: config }
          : configType === 'compose' ? { type: 'compose', compose: config }
          : { type: 'auto' }
      });
      setEnvironment(env);
      // Update project with environment ID
      await invoke('project_set_environment', { project_id: project.id, environment_id: env.id });
      onRefresh();
    } catch (e) {
      alert(`Failed to create environment: ${e}`);
    } finally { setLoading(false); }
  };

  const handleStart = async () => {
    if (!environment) return;
    setLoading(true);
    try {
      await adapter.startProjectEnvironment(environment.id);
      loadEnvironment();
    } catch (e) { alert(e); }
    finally { setLoading(false); }
  };

  const handleStop = async () => {
    if (!environment) return;
    setLoading(true);
    try {
      await adapter.stopProjectEnvironment(environment.id);
      loadEnvironment();
    } catch (e) { alert(e); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!environment || !confirm('Delete this environment?')) return;
    setLoading(true);
    try {
      await adapter.deleteProjectEnvironment(environment.id);
      await invoke('project_set_environment', { project_id: project.id, environment_id: '' });
      setEnvironment(null);
      onRefresh();
    } catch (e) { alert(e); }
    finally { setLoading(false); }
  };

  const handleOpenInIde = async () => {
    if (!environment?.address) return;
    try {
      await invoke('open_url', { url: `vscode-remote://dev-container+${environment.address.replace('container://', '')}/workspace` });
    } catch (e) {
      alert(`Couldn't open in IDE: ${e}`);
    }
  };

  const isRunning = environment?.status === 'Running';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.path}</p>
        </div>
        <div className="w-10" /> {/* Balance */}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Config Detection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Dev Environment
              {detecting ? <Spinner size="sm" /> : (
                <Button variant="outline" size="sm" onClick={handleDetect} disabled={detecting}>
                  <Search className="h-4 w-4 mr-1" /> Detect Config
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {config ? (
              <ConfigSummary config={config} type={configType!} />
            ) : environment ? (
              <p className="text-sm text-muted-foreground">Environment created. Config detection available.</p>
            ) : (
              <p className="text-sm text-muted-foreground">No configuration detected yet. Click "Detect Config" to scan the project.</p>
            )}
          </CardContent>
        </Card>

        {/* Environment Controls */}
        {environment && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Environment
                <Badge variant={isRunning ? 'success' : environment.status === 'Error' ? 'destructive' : 'secondary'}>
                  {environment.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {isRunning ? (
                  <>
                    <Button onClick={handleStop} disabled={loading}>
                      <Stop className="h-4 w-4 mr-1" /> Stop
                    </Button>
                    <Button variant="outline" onClick={handleRestart} disabled={loading}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Restart
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleStart} disabled={loading}>
                    <Play className="h-4 w-4 mr-1" /> Start
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowTerminal(true)} disabled={!isRunning || loading}>
                  <Terminal className="h-4 w-4 mr-1" /> Terminal
                </Button>
                <Button variant="outline" onClick={() => setShowLogs(true)} disabled={!isRunning || loading}>
                  <ExternalLink className="h-4 w-4 mr-1" /> Logs
                </Button>
                <Button variant="outline" onClick={handleOpenInIde} disabled={!isRunning}>
                  <Download className="h-4 w-4 mr-1" /> Open in IDE
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>

              {isRunning && (
                <>
                  <ProjectPorts environmentId={environment.id} />
                  <div className="text-sm text-muted-foreground">
                    Container: <code>{environment.address?.replace('container://', '')}</code>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Create Environment */}
        {!environment && config && (
          <Card>
            <CardContent className="pt-0">
              <Button onClick={handleCreateEnvironment} disabled={loading} className="w-full">
                {loading ? 'Creating...' : 'Create & Start Environment'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Git Info */}
        {project.git_remote_url && (
          <Card>
            <CardHeader><CardTitle>Git</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div><strong>Branch:</strong> {project.git_branch || 'N/A'}</div>
              <div><strong>Remote:</strong> {project.git_remote_url}</div>
              <div><strong>Commit:</strong> {project.git_commit?.slice(0, 8) || 'N/A'}</div>
              {project.git_dirty && <Badge variant="warning" className="inline">Uncommitted changes</Badge>}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modals */}
      {showTerminal && environment && (
        <ProjectTerminal
          environmentId={environment.id}
          onClose={() => setShowTerminal(false)}
        />
      )}
      {showLogs && environment && (
        <ProjectLogs
          environmentId={environment.id}
          onClose={() => setShowLogs(false)}
        )}
      )}
    </div>
  );
}

function ConfigSummary({ config, type }: { config: DevContainerSpec | ComposeSpec; type: string }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{type === 'devcontainer' ? 'Dev Container' : type === 'compose' ? 'Docker Compose' : 'Dockerfile'}</Badge>
      </div>
      {('image' in config) && (
        <div className="space-y-1">
          {config.image && <div><strong>Image:</strong> <code>{config.image}</code></div>}
          {config.dockerfile && <div><strong>Dockerfile:</strong> <code>{config.dockerfile}</code></div>}
          {config.forwardPorts?.length && <div><strong>Forward Ports:</strong> <code>{config.forwardPorts.join(', ')}</code></div>}
          {config.postCreateCommand && <div><strong>Post-create:</strong> <code>{config.postCreateCommand}</code></div>}
          {config.postStartCommand && <div><strong>Post-start:</strong> <code>{config.postStartCommand}</code></div>}
          {config.mounts?.length && <div><strong>Mounts:</strong> {config.mounts.map(m => `${m.source}:${m.target}`).join(', ')}</div>}
        </div>
      )}
      {('file' in config) && (
        <div className="space-y-1">
          <div><strong>File:</strong> <code>{config.file}</code></div>
          <div><strong>Service:</strong> <code>{config.service}</code></div>
          {config.envFile && <div><strong>Env file:</strong> <code>{config.envFile}</code></div>}
        </div>
      )}
    </div>
  );
}

interface ProjectEnvironment {
  id: string;
  name: string;
  status: string;
  address?: string;
}
```

- [ ] **Step 2: Create ProjectTerminal (xterm.js)**

```tsx
// src/ProjectTerminal.tsx
import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { X, Send } from "./ui/icons";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Card, CardContent } from "./ui/Card";
import { LimaDockerAdapter } from "./runtime/lima-docker-adapter";
import { runtimeRegistry } from "./runtime";

interface ProjectTerminalProps {
  environmentId: string;
  onClose: () => void;
}

export function ProjectTerminal({ environmentId, onClose }: ProjectTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const adapter = runtimeRegistry.get('lima-docker') as LimaDockerAdapter;

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      lineHeight: 1.5,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        selection: '#264f78',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebglAddon());

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.write('Welcome to Container UI Terminal\r\n');
    terminal.write(`Connected to environment ${environmentId}\r\n\r\n`);

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, [environmentId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && command.trim()) {
      executeCommand(command);
      setHistory(prev => [...prev, command]);
      setHistoryIndex(-1);
      setCommand('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        setHistoryIndex(prev => prev + 1);
        setCommand(history[history.length - 1 - historyIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        setHistoryIndex(prev => prev - 1);
        setCommand(history[history.length - historyIndex]);
      } else {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  const executeCommand = async (cmd: string) => {
    if (!terminalRef.current) return;
    terminalRef.current.write(`\r\n$ ${cmd}\r\n`);
    try {
      const result = await adapter.execInProjectEnvironment(environmentId, ['sh', '-c', cmd]);
      if (result.stdout) terminalRef.current.write(result.stdout);
      if (result.stderr) terminalRef.current.write(result.stderr);
      terminalRef.current.write(`\r\n[Exit code: ${result.exit_code}]\r\n`);
    } catch (error) {
      terminalRef.current.write(`\r\nError: ${error instanceof Error ? error.message : 'Unknown error'}\r\n`);
    }
  };

  return (
    <Card className="fixed inset-0 z-50 flex flex-col m-4 max-h-[90vh] max-w-[90vw]">
      <div className="flex items-center justify-between border-b p-3 bg-card">
        <div className="flex items-center gap-2">
          <span className="font-medium">Terminal</span>
          <span className="text-xs text-muted-foreground">{environmentId.slice(0, 12)}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <CardContent className="flex-1 p-0 min-h-[400px]">
        <div ref={containerRef} className="h-full w-full" />
      </CardContent>
      <div className="border-t p-3 bg-card">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-mono text-sm">$</span>
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent"
            autoFocus
          />
          <Button onClick={() => command && executeCommand(command)} disabled={!command.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Create ProjectLogs**

```tsx
// src/ProjectLogs.tsx
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { X, Trash2, Pause, Play } from "./ui/icons";
import { LimaDockerAdapter } from "./runtime/lima-docker-adapter";
import { runtimeRegistry } from "./runtime";
import { cn } from "./lib/cn";

interface ProjectLogsProps {
  environmentId: string;
  onClose: () => void;
}

export function ProjectLogs({ environmentId, onClose }: ProjectLogsProps) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [paused, setPaused] = useState(false);
  const adapter = runtimeRegistry.get('lima-docker') as LimaDockerAdapter;

  const handleLog = useCallback((log: LogLine) => {
    if (!paused) setLogs(prev => [...prev.slice(-1000), log]);
  }, [paused]);

  useEffect(() => {
    let unlisten: () => void;
    adapter.getProjectEnvironmentLogs(environmentId, true, handleLog).then(fn => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
  }, [environmentId, adapter, handleLog]);

  return (
    <Card className="fixed inset-0 z-50 flex flex-col m-4 max-h-[90vh] max-w-[90vw]">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          Logs
          <Badge variant={paused ? 'secondary' : 'success'}>{paused ? 'Paused' : 'Live'}</Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setPaused(!paused)}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setLogs([])}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <div className="h-full overflow-y-auto font-mono text-sm p-4 bg-black text-green-300">
          {logs.map((log, index) => (
            <div key={index} className={cn(
              'whitespace-pre-wrap break-all',
              log.stream === 'stderr' && 'text-red-400',
              log.stream === 'system' && 'text-yellow-400'
            )}>
              {log.content}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface LogLine {
  timestamp: string;
  stream: 'stdout' | 'stderr' | 'system';
  content: string;
}
```

- [ ] **Step 4: Create ProjectPorts**

```tsx
// src/ProjectPorts.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Input } from "./ui/Input";
import { ExternalLink, X, Link2, Loader2 } from "./ui/icons";
import { LimaDockerAdapter } from "./runtime/lima-docker-adapter";
import { runtimeRegistry } from "./runtime";
import { cn } from "./lib/cn";

interface ProjectPortsProps {
  environmentId: string;
}

export function ProjectPorts({ environmentId }: ProjectPortsProps) {
  const [ports, setPorts] = useState<PortMapping[]>([]);
  const [newPort, setNewPort] = useState('');
  const [forwarding, setForwarding] = useState<Set<number>>(new Set());
  const adapter = runtimeRegistry.get('lima-docker') as LimaDockerAdapter;

  const loadPorts = async () => {
    // Ports are stored in environment; fetch from adapter or project env
    // For now, use a simple approach - ports are managed per environment
  };

  const handleForward = async () => {
    const port = parseInt(newPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) return;
    if (forwarding.has(port)) return;
    setForwarding(prev => new Set(prev).add(port));
    try {
      const mapping = await adapter.forwardPort(environmentId, port);
      setPorts(prev => {
        const existing = prev.findIndex(p => p.container_port === port);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = mapping;
          return next;
        }
        return [...prev, mapping];
      });
      setNewPort('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to forward port');
    } finally {
      setForwarding(prev => { const next = new Set(prev); next.delete(port); return next; });
    }
  };

  const handleUnforward = async (port: number) => {
    try {
      await adapter.unforwardPort(environmentId, port);
      setPorts(prev => prev.filter(p => p.container_port !== port));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to unforward port');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Port Forwarding</CardTitle>
        <div className="flex items-center gap-2">
          <Input
            value={newPort}
            onChange={(e) => setNewPort(e.target.value)}
            placeholder="Container port"
            type="number"
            min={1}
            max={65535}
            className="w-32"
            disabled={forwarding.has(parseInt(newPort, 10))}
          />
          <Button onClick={handleForward} disabled={forwarding.has(parseInt(newPort, 10)) || !newPort}>
            {forwarding.has(parseInt(newPort, 10)) ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Forward'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {ports.length === 0 ? (
          <p className="text-muted-foreground text-sm">No ports forwarded. Add a port to access services on localhost.</p>
        ) : (
          <div className="space-y-2">
            {ports.map((port) => (
              <div key={port.container_port} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="font-mono text-lg">{port.container_port}</span>
                    <Badge variant="outline" className="ml-2 text-xs">{port.protocol.toUpperCase()}</Badge>
                  </div>
                  {port.host_port && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>→ localhost:{port.host_port}</span>
                      <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(`http://localhost:${port.host_port}`)}>
                        <Link2 className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => window.open(`http://localhost:${port.host_port}`, '_blank')}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {port.is_forwarded ? <Badge variant="success">Forwarded</Badge> : <Badge variant="secondary">Pending</Badge>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleUnforward(port.container_port)}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PortMapping {
  container_port: number;
  host_port: number | null;
  protocol: string;
  is_forwarded: boolean;
}
```

- [ ] **Step 5: Add missing Tauri commands for port forwarding**

```rust
// In src-tauri/src/lima.rs
#[tauri::command]
async fn project_env_forward_port(app: tauri::AppHandle, env_id: String, container_port: u16) -> Result<PortMapping, String> { ... }

#[tauri::command]
async fn project_env_unforward_port(app: tauri::AppHandle, env_id: String, container_port: u16) -> Result<(), String> { ... }
```

- [ ] **Step 6: Verify & commit**

Run: `npm run build && cargo check`
```bash
git add src/ProjectDetail.tsx src/ProjectTerminal.tsx src/ProjectLogs.tsx src/ProjectPorts.tsx src-tauri/src/lima.rs
git commit -m "feat: add project detail page with terminal, logs, and port forwarding"
```

---

### Task 6: Auto-Discovery & Injection (SSH, Git, Dotfiles)

**Files:**
- Create: `src/lib/autoInject.ts`
- Modify: `src-tauri/src/lima.rs` (inject SSH agent, git config, etc.)

**Interfaces:**
- Consumes: Project path, user's home directory
- Produces: Environment variables and mounts to inject into container

- [ ] **Step 1: Implement injection logic (TypeScript)**

```typescript
// src/lib/autoInject.ts
import { invoke } from "@tauri-apps/api/core";

export interface InjectionConfig {
  envVars: Record<string, string>;
  mounts: MountSpec[];
}

export interface MountSpec {
  source: string;
  target: string;
  type: 'bind' | 'volume' | 'tmpfs';
  readonly: boolean;
}

export async function getInjectionConfig(projectPath: string): Promise<InjectionConfig> {
  const homeDir = await invoke<string>('get_home_dir');
  const envVars: Record<string, string> = {};
  const mounts: MountSpec[] = [];

  // 1. SSH Agent
  const sshAuthSock = await invoke<string>('get_ssh_auth_sock').catch(() => '');
  if (sshAuthSock) {
    envVars.SSH_AUTH_SOCK = sshAuthSock;
    // Mount the socket directory
    const sockDir = sshAuthSock.substring(0, sshAuthSock.lastIndexOf('/'));
    mounts.push({ source: sockDir, target: sockDir, type: 'bind', readonly: false });
  }

  // 2. Git config
  const gitConfig = await getGitConfig();
  if (gitConfig.userName) envVars.GIT_AUTHOR_NAME = gitConfig.userName;
  if (gitConfig.userEmail) envVars.GIT_AUTHOR_EMAIL = gitConfig.userEmail;
  if (gitConfig.credentialHelper) envVars.GIT_CREDENTIAL_HELPER = gitConfig.credentialHelper;

  // 3. GitHub CLI
  const ghToken = await invoke<string>('get_gh_token').catch(() => '');
  if (ghToken) envVars.GH_TOKEN = ghToken;

  // 4. Dotfiles
  const dotfilesMount = await getDotfilesMount(homeDir);
  if (dotfilesMount) mounts.push(dotfilesMount);

  // 5. Shell config
  const shellMounts = await getShellConfigMounts(homeDir);
  mounts.push(...shellMounts);

  return { envVars, mounts };
}

async function getGitConfig(): Promise<{ userName?: string; userEmail?: string; credentialHelper?: string }> {
  try {
    const name = await invoke<string>('git_config_get', { key: 'user.name' }).catch(() => '');
    const email = await invoke<string>('git_config_get', { key: 'user.email' }).catch(() => '');
    const helper = await invoke<string>('git_config_get', { key: 'credential.helper' }).catch(() => '');
    return { userName: name || undefined, userEmail: email || undefined, credentialHelper: helper || undefined };
  } catch {
    return {};
  }
}

async function getDotfilesMount(homeDir: string): Promise<MountSpec | null> {
  // Check for ~/.dotfiles or ~/dotfiles
  const dotfilesPaths = ['.dotfiles', 'dotfiles'];
  for (const name of dotfilesPaths) {
    const path = `${homeDir}/${name}`;
    try {
      await invoke('fs_stat', { path });
      return { source: path, target: '/home/user/.dotfiles', type: 'bind', readonly: true };
    } catch {
      // Not found
    }
  }
  return null;
}

async function getShellConfigMounts(homeDir: string): Promise<MountSpec[]> {
  const mounts: MountSpec[] = [];
  const shellFiles = ['.zshrc', '.bashrc', '.config/fish/config.fish'];
  for (const file of shellFiles) {
    const path = `${homeDir}/${file}`;
    try {
      await invoke('fs_stat', { path });
      mounts.push({ source: path, target: `/home/user/${file}`, type: 'bind', readonly: true });
    } catch {
      // Not found
    }
  }
  return mounts;
}
```

- [ ] **Step 2: Add Rust commands for injection**

```rust
// In src-tauri/src/lima.rs
#[tauri::command]
fn get_ssh_auth_sock() -> Result<String, String> {
    std::env::var("SSH_AUTH_SOCK").map_err(|_| "SSH_AUTH_SOCK not set".into())
}

#[tauri::command]
fn git_config_get(key: String) -> Result<String, String> {
    let output = Command::new("git").args(["config", "--global", "--get", &key]).output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("Not set".into())
    }
}

#[tauri::command]
fn get_gh_token() -> Result<String, String> {
    // Try gh auth token
    let output = Command::new("gh").args(["auth", "token"]).output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("Not authenticated".into())
    }
}
```

- [ ] **Step 3: Apply injections when creating environment**

```typescript
// In ProjectDetail.tsx handleCreateEnvironment
const injection = await getInjectionConfig(project.path);
// Merge into config before creating environment
const envConfig = {
  ...config,
  containerEnv: { ...config.containerEnv, ...injection.envVars },
  mounts: [...(config.mounts || []), ...injection.mounts],
};
```

- [ ] **Step 4: Verify & commit**

Run: `npm run build && cargo check`
```bash
git add src/lib/autoInject.ts src-tauri/src/lima.rs src/ProjectDetail.tsx
git commit -m "feat: add auto-injection of SSH, git config, GH CLI, dotfiles"
```

---

### Task 7: Polish & Integration

**Files:**
- Modify: `src/App.tsx` (keyboard shortcuts for Projects tab)
- Modify: `src/Onboarding.tsx` (include Projects in onboarding)
- Modify: `src/styles.css` / `src/ui/tokens.css` (any new styles)
- Create: `tests/e2e/projects.spec.ts`

**Interfaces:**
- Consumes: All previous tasks
- Produces: Polished, integrated feature

- [ ] **Step 1: Add Projects to keyboard shortcuts**

```tsx
// In App.tsx
const keyboardShortcuts = useMemo<KeyboardShortcut[]>(() => [
  // ... existing ...
  { key: "0", meta: true, action: () => setTab("Projects"), description: "Projects tab" },
  { key: "n", meta: true, action: () => { /* open create project dialog */ }, description: "New Project" },
], []);
```

- [ ] **Step 2: Update Onboarding**

```tsx// In Onboarding.tsx - add Projects step
```

- [ ] **Step 3: Write E2E tests**

```typescript
// tests/e2e/projects.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Projects', () => {
  test('create project from directory', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("New Project")');
    // ... test flow
  });

  test('detect devcontainer config', async ({ page }) => { ... });
  test('create and start environment', async ({ page }) => { ... });
  test('terminal works', async ({ page }) => { ... });
  test('port forwarding works', async ({ page }) => { ... });
});
```

- [ ] **Step 4: Run full test suite**

Run: `cargo test && npm run test && npx playwright test`
Expected: All tests pass

- [ ] **Step 5: Build release**

Run: `npm run tauri build`
Expected: Release binaries created

- [ ] **Step 6: Commit polish**

```bash
git add -A
git commit -m "feat: polish Projects feature - shortcuts, onboarding, tests, release build"
```

---

## Summary

This plan adds a **Projects tab** as the default landing page for project-based dev environments:

| Task | Scope | Key Deliverable |
|------|-------|-----------------|
| 1 | Runtime Adapter | `LimaDockerAdapter` with Tauri commands for project env lifecycle |
| 2 | Auto-Detection | `detectProjectConfig()` for devcontainer/compose/Dockerfile/language |
| 3 | Data Layer | SQLite persistence for projects & environments |
| 4 | Projects UI | List page, create dialog, project cards with config preview |
| 5 | Project Detail | Environment CRUD, terminal (xterm.js), logs, port forwarding, IDE launch |
| 6 | Auto-Injection | SSH agent, git config, GH CLI, dotfiles, shell config |
| 7 | Polish | Shortcuts, onboarding, E2E tests, release build |

**Total**: 7 tasks, each independently testable and committable.

**Recommended execution**: Subagent-driven (tasks have tight interface dependencies; container runtime integration is high-risk).