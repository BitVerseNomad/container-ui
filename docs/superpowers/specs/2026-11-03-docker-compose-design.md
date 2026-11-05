# Docker Compose Integration: Design

Date: 2026-11-03 (revised). Status: awaiting review.

## Intent

The user opens the app and wants to manage multi-container applications defined in Docker Compose files. Currently the app only supports basic container operations (start, stop, remove). The user needs full Compose support: read-only discovery of existing compose projects, multi-container lifecycle management, and volume/network mapping visibility.

**Success:** existing compose projects appear without importing (discovered via container labels); the user can see all services per project, start/stop/restart them as a group or individually, and view container logs — all from the UI. No editing of compose files or environment variables is provided (SPEC.md W6: "Do not build a compose editor").

## Scope

**In:**
- **Label-based discovery** of existing compose projects (containers carry `com.docker.compose.project`, `.working_dir`, `.config_files`, `.service` labels — verified via `docker ps --format json`)
- Read-only multi-container application view (services grouped by compose file, discovered automatically)
- Start/stop/restart per service and per group (via allowlisted `docker compose -f <path> ...`)
- Volume and network mapping display (read-only)
- Container log viewing per service (via allowlisted `docker compose -f <path> logs`)
- Command preview before any action that changes the machine (SPEC.md Principle 1)

**Out:**
- Docker Compose file editing or creation (SPEC.md W6: "Do not build a compose editor (Dockge/Arcane do that well)")
- Kubernetes manifests (future iteration)
- Cloud deployment (future iteration)
- Plugin system (future iteration)

**Decision 4 (from SPEC.md §7): editing vs read-only** — Read-only. The product owner's decision: compose editing is out of scope. Users who need compose editing should use Dockge, Arcane, or their editor. This project provides discovery and lifecycle management only.

## Research (SPEC.md Principle 2)

Per SPEC.md Principle 2, research was conducted before building. Research artifacts stored at:
- `docs/research/2026-11-03-docker-compose-labels.md` — Container labels that identify compose projects (`com.docker.compose.project`, `.working_dir`, `.config_files`, `.service`), verified via `docker ps --format json`
- `docs/research/2026-11-03-docker-compose-cli.md` — `docker compose` CLI commands and flags (presence check via `docker compose version`, fallback to `docker-compose` v1)

## Current State

- `docker ps -a` parsed via `src/lib/homeRows.ts` into home screen rows
- Basic container lifecycle: start, stop, remove
- No Compose file awareness
- No multi-container grouping
- No label-based project discovery

## Design

### 1. Label-Based Project Discovery (Core Mechanism)

Containers created by `docker compose` carry four labels. We discover compose projects by scanning all containers and grouping by the `com.docker.compose.project` label:

```typescript
// Label keys (from Docker Compose source)
const LABEL_PROJECT = "com.docker.compose.project";
const LABEL_WORKING_DIR = "com.docker.compose.project.working_dir";
const LABEL_CONFIG_FILES = "com.docker.compose.project.config_files";
const LABEL_SERVICE = "com.docker.compose.service";

// Discovery: scan running + stopped containers
async function discoverComposeProjects(): Promise<ComposeProject[]> {
  const containers = await dockerPsAll(); // docker ps -a --format json
  const grouped = new Map<string, ComposeContainer[]>();
  for (const c of containers) {
    const project = c.Labels?.[LABEL_PROJECT] ?? path.basename(c.Name).split("_")[0];
    const workingDir = c.Labels?.[LABEL_WORKING_DIR] ?? "";
    const configFiles = c.Labels?.[LABEL_CONFIG_FILES]?.split(",") ?? [];
    const service = c.Labels?.[LABEL_SERVICE] ?? c.Name;
    grouped.get(project)?.push({ ...c, workingDir, configFiles, service });
  }
  return [...grouped.entries()].map(([id, containers]) => ({
    id,
    name: id,
    containers,
    composeFiles: [...new Set(containers.flatMap(c => c.configFiles))],
  }));
}
```

**Fallback:** If no containers carry `com.docker.compose.project`, fall back to directory-based grouping: containers whose names share a common prefix (first underscore-delimited segment).

**Acceptance:** "existing compose projects appear without importing" — SPEC.md W6.

### 2. Data Model

```typescript
type ComposeProject = {
  id: string;              // from com.docker.compose.project label (or directory-based fallback)
  name: string;            // human-readable project name
  composeFiles: string[];  // .config_files label values
  containers: ComposeContainer[];
  lastDiscovered: number;
};

type ComposeContainer = {
  id: string;              // container ID
  name: string;            // container name
  serviceName: string;     // com.docker.compose.service label
  status: ContainerStatus; // created, restarting, running, removing, dead, exited
  ports: PortMapping[];
  labels: Record<string, string>;
  composeProjectId: string;
  workingDir: string;      // com.docker.compose.project.working_dir
  configFiles: string[];   // com.docker.compose.project.config_files
};
```

### 3. UI Components

**ComposeProjectCard** — Top-level card for a discovered compose project:
- Project name (from `com.docker.compose.project` label)
- Compose file paths (clickable, opens in Finder)
- Service list (collapsible, showing container status)
- **One primary action button per screen** (SPEC.md Principle 5):
  - If all services stopped: "Start All" (primary, green)
  - If any service running: "Stop All" (primary, red)
  - If mixed state: "Restart All" (primary, yellow)
  - No per-group action buttons when a single service is selected (use per-service row actions)

**ComposeServiceRow** — Per container row within a project:
- Service name + status indicator (color-coded: green=running, yellow=restarting, gray=stopped)
- Ports display (host:container)
- Volume mounts (read-only, truncated, hover to see full)
- **Per-service actions** (secondary, not primary):
  - Start / Stop / Restart — each shown with command preview (SPEC.md Principle 1)
  - "View Logs" — opens log viewer
  - "View in Containers" — links to the container's row in the Containers tab

**Command Preview** (SPEC.md Principle 1):
Before any action that changes the machine, show the exact command:
```
docker compose -f /path/to/docker-compose.yml -p project-name up -d --no-recreate
```
- Displayed in a `<details>` block (collapsed by default)
- User must click to confirm execution
- No automatic execution

### 4. API Layer Changes (`src/api.ts`)

```typescript
// New allowlisted docker compose commands
async function dockerComposePs(projectPath: string): Promise<ContainerInfo[]>
async function dockerComposeUp(projectPath: string, projectName?: string): Promise<Output>
async function dockerComposeDown(projectPath: string, projectName?: string, removeVolumes?: boolean): Promise<Output>
async function dockerComposeRestart(projectPath: string, projectName?: string): Promise<Output>
async function dockerComposeLogs(projectPath: string, serviceName: string, tail?: number): Promise<string>
async function dockerPsAll(): Promise<ContainerInfo[]>  // for label-based discovery
```

**Implementation:** Wrapper around `docker compose` CLI commands:
- `docker compose -f <file> -p <project> ps --format json` — service status (used for discovery + polling)
- `docker compose -f <file> -p <project> up -d` — start services (shown with preview)
- `docker compose -f <file> -p <project> down` — stop services (shown with preview)
- `docker compose -f <file> -p <project> restart` — restart services (shown with preview)
- `docker compose -f <file> -p <project> logs <service>` — streaming logs
- `docker ps -a --format json` — for label-based project discovery

### 5. Integration with Existing Code

- **`src/Containers.tsx`**: Add "Compose" tab alongside "Containers" tab
- **`src/lib/homeRows.ts`**: Extend `usePoll()` to also call `discoverComposeProjects()` on mount (discovery happens once; polling updates status)
- **`src/hooks.ts`**: Add `usePollCompose()` hook (polls `compose ps` every 5s for status updates only — discovery is one-shot on mount)
- **`src/lib/colimaConfig.ts`**: No changes needed (compose works with any Colima runtime)

### 6. Error Handling

- Invalid YAML in compose file → show parse error with line number, suggest fix (read-only; do not offer to edit)
- Missing compose file on disk → show warning, remove from view (containers may have been removed externally)
- Service dependency failure → show which service failed, allow retry
- Permission denied → suggest checking file permissions
- `docker compose` not available → detect, show message pointing to `brew install docker-compose`
- Colima not running → prompt to start Colima first

### 7. Test Plan

- **Unit tests:**
  - `discoverComposeProjects()` groups containers by `com.docker.compose.project` label
  - Fallback to directory-based grouping when no labels present
  - `ComposeContainer` status mapping from `docker compose ps` output
  - Error parsing for `docker compose up/down/restart/logs` output

- **Shell tests:**
  - `docker compose` command available in Colima
  - `docker compose up -d` starts services
  - `docker compose logs` returns expected output
  - `docker compose down` stops and removes containers

- **Integration tests (Playwright):**
  - Create a sample compose project → appears automatically in Compose tab (no import needed)
  - Start all services → status changes to green (with command preview shown)
  - Stop individual service → status updates (with command preview shown)
  - View logs → shows correct service logs

### 8. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Large compose files with 50+ services → slow rendering | High | Virtualize service list, lazy-load logs |
| `docker compose` not available in older Colima | Medium | Detect version, fallback to `docker-compose` (v1) |
| Label `com.docker.compose.project` not set (legacy compose) | Medium | Fallback to directory-based grouping |
| Network conflicts between projects | Low | Use project name isolation (default behavior) |

### 9. Open Questions

None. Decision 4 (editing vs read-only) resolved: read-only. All scope decisions align with SPEC.md W6.
