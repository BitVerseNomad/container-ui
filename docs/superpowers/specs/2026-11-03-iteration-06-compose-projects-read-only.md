# Iteration 06: Compose Projects — Read-Only Discovery, Up/Down, Restart, Per-Service Logs (W6)

Date: 2026-11-03. Status: awaiting review.

## Intent

Add Compose project support: discover existing compose projects by reading containers with `com.docker.compose.project`, `.working_dir`, `.config_files`, and `.service` labels. Group containers by project, show file path and services. Provide `up -d`, `down`, `restart`, and per-service logs via allowlisted `docker compose -f <path> ...`. Provide "Open project folder" for compose files in the user's repos (path picked by the user, validated). **Do not build a compose editor** (Dockge/Arcane do that well). Read-only first.

**Success:** Existing compose projects appear without importing; `up`/`down` work on a sample project; per-service logs are accessible; "Open project folder" opens the correct directory.

## Scope

**In:**
- **Project discovery:** Read containers with `com.docker.compose.project` label; group by project name
- **Project grouping:** Each project shows its file path, working directory, and list of services
- **`docker compose up -d`:** Start all services in a project (requires `docker compose` plugin installed via `brew install docker-compose`)
- **`docker compose down`:** Stop and remove all services in a project
- **`docker compose restart`:** Restart all services in a project
- **Per-service logs:** `docker compose -f <path> logs -f <service>` via allowlisted backend command
- **"Open project folder":** Opens the compose file's directory in Finder (path validated — must be within user's trusted directories)
- **Research:** Verify label format (`com.docker.compose.project`, `.working_dir`, `.config_files`, `.service`); verify `docker compose` plugin presence

**Out:**
- Building a compose file editor (SPEC.md: "Do not build a compose editor")
- Editing compose files directly
- Creating new compose projects

## Research (SPEC.md Principle 2)

Per SPEC.md Principle 2, research was conducted before building. Research artifacts stored at:
- `docs/research/2026-11-03-docker-compose-labels.md` — Compose label format verification: `com.docker.compose.project`, `.working_dir`, `.config_files`, `.service`
- `docs/research/2026-11-03-docker-compose-plugin-install.md` — `docker compose` plugin presence detection, `brew install docker-compose` behavior

## Current State

- No compose project support exists
- No compose-related backend commands exist
- `docker compose` plugin may or may not be installed

## Design

### 1. Project Discovery

Read all containers and filter those with `com.docker.compose.project` label. Group by project name:

```typescript
interface ComposeProject {
  name: string;
  workingDir: string;
  configFile: string;
  services: string[];
  containers: ContainerInfo[];
}

function discoverComposeProjects(containers: ContainerInfo[]): ComposeProject[] {
  const projects = new Map<string, ComposeProject>();

  for (const container of containers) {
    const labels = container.Labels || {};
    const projectName = labels["com.docker.compose.project"];
    if (!projectName) continue;

    const project = projects.get(projectName) || {
      name: projectName,
      workingDir: "",
      configFile: "",
      services: [],
      containers: [],
    };

    // Extract metadata from labels
    project.workingDir = labels[".working_dir"] || project.workingDir;
    project.configFile = labels[".config_files"] || project.configFile;
    const serviceName = labels[".service"] || container.Name;
    if (!project.services.includes(serviceName)) {
      project.services.push(serviceName);
    }
    project.containers.push(container);

    projects.set(projectName, project);
  }

  return Array.from(projects.values());
}
```

### 2. Project Display

Each project card shows:
- Project name
- Compose file path (clickable, opens in Finder)
- Number of services
- Overall status (all running / partial / stopped)
- Actions: "Up", "Down", "Restart"

### 3. Compose Commands via Backend

New allowlisted backend commands:

```rust
// Rust backend command handlers
#[tauri::command]
fn docker_compose_up(project_path: String) -> Result<CommandOutput> {
    // Validate path is within trusted directories
    validate_compose_path(&project_path)?;
    // Execute: docker compose -f <path> up -d
    invoke_docker("compose", &["-f", &project_path, "up", "-d"])
}

#[tauri::command]
fn docker_compose_down(project_path: String) -> Result<CommandOutput> {
    validate_compose_path(&project_path)?;
    invoke_docker("compose", &["-f", &project_path, "down"])
}

#[tauri::command]
fn docker_compose_restart(project_path: String) -> Result<CommandOutput> {
    validate_compose_path(&project_path)?;
    invoke_docker("compose", &["-f", &project_path, "restart"])
}

#[tauri::command]
fn docker_compose_logs(project_path: String, service: String) -> Result<CommandOutput> {
    validate_compose_path(&project_path)?;
    invoke_docker("compose", &["-f", &project_path, "logs", "-f", &service])
}
```

### 4. Path Validation

Compose file paths must be validated before execution:
- Must be an absolute path
- Must exist on the filesystem
- Must be within user's trusted directories (configurable)
- Must end in `.yml` or `.yaml`

```typescript
function validateComposePath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (!path.endsWith(".yml") && !path.endsWith(".yaml")) return false;
  // Check if within trusted directories
  return trustedDirectories.some(dir => path.startsWith(dir));
}
```

### 5. "Open Project Folder"

A button that opens the compose file's directory in Finder. The path is validated before opening:

```typescript
function openProjectFolder(project: ComposeProject) {
  // Use the existing open_url backend command with localhost/file://
  invoke("open_url", { url: `file://${path.dirname(project.configFile)}` });
}
```

### 6. Docker Compose Plugin Detection

Before showing compose features, check if `docker compose` plugin is available:

```typescript
async function isComposeAvailable(): Promise<boolean> {
  try {
    const result = await invoke("docker", ["compose", "version"]);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
```

If not available, show an informational banner: "Docker Compose plugin not found. Install with: `brew install docker-compose`"

### 7. Acceptance Criteria

- Existing compose projects are discovered automatically by reading container labels
- Projects are grouped by name with file path and services listed
- `up -d`, `down`, and `restart` work on a sample project
- Per-service logs are accessible via `docker compose -f <path> logs -f <service>`
- "Open project folder" opens the correct directory in Finder
- Path validation prevents opening arbitrary directories
- Docker Compose plugin detection shows helpful message if missing
- No compose editor is built

### 8. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| `docker compose` plugin not installed | Medium | Detect and show install instructions (`brew install docker-compose`) |
| Compose file paths point to non-existent files | Low | Validate path exists before executing commands |
| Projects with conflicting container names | Medium | Document limitation; suggest unique project names |
| Multiple compose files for same project | Low | Show all config files; let user choose which to act on |

### 9. Open Questions

- Should compose projects be auto-discovered, or require user to "import" them? (Proposal: auto-discover — follows "read-only first" principle)
- What is the default trusted directory list? (Proposal: user's home directory, configurable)
})