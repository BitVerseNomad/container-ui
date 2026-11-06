# Projects Tasks 5-7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Projects feature by polishing the Project Detail page (Task 5), wiring auto-injection of SSH/git/GH credentials (Task 6), and a full quality pass (Task 7) — delivering a container UI that approaches OpenChamber UX quality.

**Architecture:** Tauri (Rust backend) + React/TypeScript frontend. Backend uses Lima VM for Docker runtime. SQLite via sqlx for persistence. Frontend uses TanStack Query for server state, xterm.js for terminal. Design system in `src/ui/`. Tasks 5-7 build on Tasks 1-4 foundation.

**Tech Stack:** Rust 1.78+, Tauri 2, React 18, TypeScript 5, Vite 5, TanStack Query 5, xterm.js 5, Tailwind-like CSS variables, sqlx 0.7, SQLite.

**Spec:** This plan implements the remaining work from the Projects feature spec (Tasks 1-4 completed in commits 646e360, d7fedc7, e049d11, and current HEAD).

---

## Global Constraints

- **MacOS only** for folder picker (`dialog_open`) and SSH agent socket injection
- **Lima VM** must be running for all environment operations (commands assert this)
- **SQLite DB** at `~/Library/Application Support/colima_ui/colima_ui.db` (managed by `projects::init_db`)
- **Path aliases:** `@/` = `src/`, `@shared/` = `src/shared/`, `@features/` = `src/features/`, `@ui/` = `src/ui/`, `@lib/` = `src/lib/`
- **Tauri command naming:** `snake_case` in Rust, called via `invoke('command_name', args)` from frontend
- **Error handling:** All Tauri commands return `Result<T, String>` — frontend treats `String` as error message
- **No breaking changes** to existing Tauri command signatures or TypeScript types
- **OpenChamber UX bar:** Every interactive element keyboard-accessible, loading/error/empty states for all async UI, no console errors, responsive at 320px/768px/1024px/1440px

---

## Review Focus

*These five failure modes are most likely to bite a real user. Each must be exercised by tests in the owning task.*

| # | Input / Condition | Expected Behavior |
|---|-------------------|-------------------|
| 1 | Lima VM not running / not installed | Clear error toast, "Start VM" button, no silent failures |
| 2 | Network flap during terminal session | Terminal reconnects automatically, shows "Reconnecting..." banner, preserves scrollback |
| 3 | Port forward collision (host port in use) | Inline error on port row, "Retry" button, no toast spam |
| 4 | SSH_AUTH_SOCK not set / gh not authenticated | Auto-injection gracefully skipped, environment starts without injected creds, no crash |
| 5 | Project with 100+ ports / 50+ env vars | Port table and env var list virtualized or paginated, no main-thread jank |

---

## File Structure Map

```
src-tauri/src/
├── lima.rs              ← Add 5 new Tauri commands (Task 5)
├── projects.rs          ← Fix stubbed commands, add git refresh (Task 5)
├── main.rs              ← Register new commands (Task 5)

src/
├── features/projects/
│   ├── ProjectDetail.tsx          ← NEW: Extract from ProjectsPage.tsx (Task 5)
│   ├── ProjectTerminal.tsx        ← Polish: reconnection, scrollback, resize (Task 5)
│   ├── ProjectLogs.tsx            ← Polish: filter, search, pause, persist (Task 5)
│   ├── ProjectPorts.tsx           ← Polish: collision handling, virtualization (Task 5)
│   ├── ProjectEnvVars.tsx         ← NEW: Auto-injection UI (Task 6)
│   ├── ProjectsPage.tsx           ← Modify: use ProjectDetail component (Task 5)
│   └── CreateProjectDialog.tsx    ← (done)
├── lib/
│   ├── projectsApi.ts             ← Add missing API calls (Task 5)
│   └── projectDetection.ts        ← (done)
├── shared/types/
│   ├── project.ts                 ← (done)
│   └── environment.ts             ← Add InjectedEnvVar type (Task 6)
├── ui/                            ← Design system (done)
└── hooks/
    └── useProjectTerminal.ts      ← NEW: Terminal reconnection logic (Task 5)
```

---

## Task 5: Project Detail Polish

**Files:**
- Create: `src/features/projects/ProjectDetail.tsx`
- Create: `src/hooks/useProjectTerminal.ts`
- Modify: `src/features/projects/ProjectsPage.tsx:65-73` (replace inline component)
- Modify: `src/features/projects/ProjectTerminal.tsx` (full rewrite)
- Modify: `src/features/projects/ProjectLogs.tsx` (full rewrite)
- Modify: `src/features/projects/ProjectPorts.tsx` (polish)
- Modify: `src/lib/projectsApi.ts` (add missing API calls)
- Modify: `src-tauri/src/lima.rs` (add 5 Tauri commands)
- Modify: `src-tauri/src/projects.rs` (fix stubbed commands, add `project_refresh_git_info`)
- Modify: `src-tauri/src/main.rs` (register new commands)
- Test: `src/features/projects/ProjectDetail.test.tsx`
- Test: `src/hooks/useProjectTerminal.test.ts`

**Interfaces:**
- Consumes: `projectsApi` (Task 4), `Project`/`Environment` types (Task 3), `lima.rs` commands (Task 1)
- Produces: `ProjectDetail` component, `useProjectTerminal` hook, 5 new Tauri commands, fixed `projects.rs` commands

### Steps

- [ ] **Step 1: Add missing Tauri commands to `lima.rs`**

```rust
// In lima.rs, add these command functions:

#[tauri::command]
pub async fn project_env_restart(_app: tauri::AppHandle, env_id: String) -> Result<(), String> {
    // Stop then start
    project_env_stop(_app.clone(), env_id.clone()).await?;
    project_env_start(_app, env_id).await
}

#[tauri::command]
pub async fn project_env_list_ports(env_id: String) -> Result<Vec<PortMapping>, String> {
    let envs = PROJECT_ENVS.lock().unwrap();
    let env = envs.get(&env_id).ok_or("Environment not found")?;
    let ports: Vec<PortMapping> = serde_json::from_str(&env.ports_json).unwrap_or_default();
    Ok(ports)
}

#[tauri::command]
pub async fn project_detect_config(project_id: String, project_path: String) -> Result<DetectResult, String> {
    // Call the same logic as projectDetection.ts but from Rust
    // Reuse fs_read_dir, fs_read_text_file, get_home_dir helpers
    // Return DetectResult (devcontainer/compose/dockerfile/auto)
}

#[tauri::command]
pub async fn project_open_in_ide(project_path: String) -> Result<(), String> {
    // macOS: `open -a "Visual Studio Code" <path>` or cursor/code
    // Try code, then cursor, then default
}

#[tauri::command]
pub async fn project_refresh_git_info(project_id: String) -> Result<GitInfo, String> {
    // Run git commands in project_path to get remote, branch, commit, dirty status
    // Return GitInfo { remoteUrl, currentBranch, commitHash, hasUncommittedChanges }
}
```

- [ ] **Step 2: Fix stubbed commands in `projects.rs`**

```rust
// In projects.rs, replace stub implementations:

#[tauri::command]
pub async fn project_get_cmd(app: tauri::AppHandle, id: String) -> Result<Option<Project>, String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    project_get(&pool, &id).await
}

#[tauri::command]
pub async fn environment_get_cmd(app: tauri::AppHandle, id: String) -> Result<Option<ProjectEnvironment>, String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    environment_get(&pool, &id).await
}

#[tauri::command]
pub async fn environment_update_state_cmd(app: tauri::AppHandle, id: String, state: String, error: Option<String>) -> Result<(), String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    environment_update_state(&pool, &id, &state, error).await
}

#[tauri::command]
pub async fn environment_update_container_id_cmd(app: tauri::AppHandle, id: String, container_id: String) -> Result<(), String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    environment_update_container_id(&pool, &id, &container_id).await
}

#[tauri::command]
pub async fn environment_update_ports_cmd(app: tauri::AppHandle, id: String, ports_json: String) -> Result<(), String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    environment_update_ports(&pool, &id, &ports_json).await
}

// Add project_refresh_git_info_cmd that calls a new function to update git_* columns in projects table
```

- [ ] **Step 3: Register new commands in `main.rs` invoke_handler**

Add to `tauri::generate_handler![]`:
- `lima::project_env_restart`
- `lima::project_env_list_ports`
- `lima::project_detect_config`
- `lima::project_open_in_ide`
- `lima::project_refresh_git_info`
- `projects::project_get_cmd`
- `projects::environment_get_cmd`
- `projects::environment_update_state_cmd`
- `projects::environment_update_container_id_cmd`
- `projects::environment_update_ports_cmd`
- `projects::project_refresh_git_info_cmd`

- [ ] **Step 4: Add missing API calls to `projectsApi.ts`**

```typescript
// In projectsApi.ts, ensure these exist and use correct signatures:
detectConfig: (id: string) => tauriInvoke<DetectResult>("project_detect_config", { project_id: id, project_path: /* need to pass */ }),
openInIde: (id: string, path: string) => tauriInvoke<void>("project_open_in_ide", { project_path: path }),
refreshGitInfo: (id: string) => tauriInvoke<void>("project_refresh_git_info", { project_id: id }),
listEnvironmentPorts: (environmentId: string) => tauriInvoke<PortMapping[]>("project_env_list_ports", { env_id: environmentId }),
```

- [ ] **Step 5: Extract `ProjectDetail` component to own file**

Create `src/features/projects/ProjectDetail.tsx`:
- Move the inline `ProjectDetail` function from `ProjectsPage.tsx` (lines 135-319)
- Accept `project: Project`, `onBack: () => void`, `onRefresh: () => void` as props
- Use `useProject(id)` hook instead of inline state where possible
- Add proper loading skeleton while environment loads
- Add error boundary for environment operations

- [ ] **Step 6: Rewrite `ProjectTerminal.tsx` with reconnection**

Create `src/hooks/useProjectTerminal.ts`:
```typescript
// Hook managing terminal lifecycle, reconnection, scrollback
export function useProjectTerminal(environmentId: string) {
  // Returns: { terminalRef, fitAddonRef, executeCommand, isConnected, reconnect }
  // Handles: WebSocket-style reconnection via exec API, scrollback buffer, resize
}
```

Rewrite `ProjectTerminal.tsx` to use the hook:
- On disconnect (exec fails with network error), show "Reconnecting..." banner
- Auto-retry exec every 2s until success or user closes
- Preserve scrollback (last 1000 lines) across reconnections
- Handle resize properly with FitAddon
- Keyboard shortcuts: Ctrl+C, Ctrl+L, Ctrl+D

- [ ] **Step 7: Polish `ProjectLogs.tsx`**

- Add log level filter buttons (stdout/stderr/system)
- Add search/filter input (debounced)
- Add "Pause" toggle (already exists) with visual indicator
- Persist logs to sessionStorage per environmentId (survive close/reopen)
- Virtualize list for >1000 lines (use `react-window` or simple windowing)
- Timestamp formatting: relative time ("2m ago") with hover for exact

- [ ] **Step 8: Polish `ProjectPorts.tsx`**

- Handle port collision: if forward fails with "address in use", show inline error on row with "Retry" button
- Add "Open in Browser" button per forwarded port (already has ExternalLink)
- Copy `localhost:port` to clipboard with toast confirmation
- If >20 ports, add pagination or virtualization
- Show protocol badge (TCP/UDP) with tooltip

- [ ] **Step 9: Update `ProjectsPage.tsx` to use extracted `ProjectDetail`**

```tsx
// Replace lines 65-73:
import { ProjectDetail } from "./ProjectDetail";

// In detailView block:
return <ProjectDetail project={selectedProject} onBack={() => setDetailView(false)} onRefresh={refetch} />;
```

- [ ] **Step 10: Write tests**

```typescript
// ProjectDetail.test.tsx
- Renders project name, path, git info
- Shows config detection button when no config
- Shows environment controls when environment exists
- Terminal/Logs/Ports modals open on button click

// useProjectTerminal.test.ts
- Executes command and renders stdout/stderr
- Reconnects on network error (mock failed then succeeded exec)
- Preserves scrollback across reconnect
- Handles resize
```

- [ ] **Step 11: Run verification**

```bash
# TypeScript
npm run typecheck
# Expected: PASS

# Vite build
npm run build
# Expected: PASS (no errors, bundle size reasonable)

# Tauri dev
npm run tauri dev
# Expected: App launches, Projects page works, detail view works, terminal connects
```

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(projects): Task 5 - Project Detail polish (terminal, logs, ports, config detection)"
```

---

## Task 6: Auto-Injection Wiring

**Files:**
- Modify: `src-tauri/src/lima.rs` (extend `create_devcontainer_env` to inject env vars)
- Modify: `src/shared/types/environment.ts` (add `InjectedEnvVar` type)
- Modify: `src/features/projects/ProjectDetail.tsx` (add Env Vars tab/section)
- Create: `src/features/projects/ProjectEnvVars.tsx` (new component)
- Modify: `src/lib/projectsApi.ts` (add env var API if needed)
- Test: `src/features/projects/ProjectEnvVars.test.tsx`

**Interfaces:**
- Consumes: `get_ssh_auth_sock`, `git_config_get`, `get_gh_token` (Task 1), `ProjectEnvConfig` (Task 1)
- Produces: Injected env vars mounted into container, UI to view/edit injections

### Steps

- [ ] **Step 1: Add `InjectedEnvVar` type to `environment.ts`**

```typescript
export interface InjectedEnvVar {
  key: string;
  source: "ssh_agent" | "git_user" | "git_email" | "gh_token" | "custom";
  enabled: boolean;
  value?: string; // For custom
}
```

- [ ] **Step 2: Extend `create_devcontainer_env` in `lima.rs` to inject credentials**

```rust
// In create_devcontainer_env, after building run_args:
let mut injected_env = Vec::new();

// SSH_AUTH_SOCK
if let Ok(sock) = get_ssh_auth_sock() {
    injected_env.push(("SSH_AUTH_SOCK".to_string(), sock));
}

// Git user.name
if let Ok(name) = git_config_get("user.name".to_string()) {
    injected_env.push(("GIT_AUTHOR_NAME".to_string(), name.clone()));
    injected_env.push(("GIT_COMMITTER_NAME".to_string(), name));
}

// Git user.email
if let Ok(email) = git_config_get("user.email".to_string()) {
    injected_env.push(("GIT_AUTHOR_EMAIL".to_string(), email.clone()));
    injected_env.push(("GIT_COMMITTER_EMAIL".to_string(), email));
}

// GH_TOKEN
if let Ok(token) = get_gh_token() {
    injected_env.push(("GH_TOKEN".to_string(), token));
    injected_env.push(("GITHUB_TOKEN".to_string(), token));
}

// Add to run_args
for (k, v) in injected_env {
    run_args.push("-e".into());
    run_args.push(format!("{}={}", k, v));
}
```

- [ ] **Step 3: Create `ProjectEnvVars.tsx` component**

```tsx
// Shows injected env vars in a table with toggle switches
// Columns: Key, Source (SSH/Git/GH/Custom), Value (masked for tokens), Enabled
// Allows adding custom env vars
// Persists to environment.env_vars_json in SQLite
```

- [ ] **Step 4: Add Env Vars section to `ProjectDetail.tsx`**

- New Card "Injected Credentials" between Environment and Git cards
- Shows toggles for each injected var (SSH, Git, GH)
- Link to full `ProjectEnvVars` modal for custom vars

- [ ] **Step 5: Write tests**

```typescript
// ProjectEnvVars.test.tsx
- Renders injected vars with correct source badges
- Toggle disables/enables var
- Custom var form validates key format
- Masked values show •••• with reveal on click
```

- [ ] **Step 6: Run verification**

```bash
npm run typecheck && npm run build
npm run tauri dev
# Verify: Env vars appear in terminal (echo $GH_TOKEN), git works without config
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(projects): Task 6 - Auto-injection of SSH/Git/GH credentials"
```

---

## Task 7: Polish Pass

**Files:**
- Modify: Multiple files across `src/features/projects/`, `src/ui/`, `src/hooks/`
- Create: `src/ui/Skeleton.tsx`, `src/ui/Toast.tsx` (if missing)
- Test: E2E tests in `test/` or `playwright.config.ts`

**Interfaces:**
- Consumes: All previous tasks
- Produces: Production-quality UX meeting OpenChamber bar

### Steps

- [ ] **Step 1: Add loading skeletons**

- `ProjectCardSkeleton` for `ProjectsPage` grid
- `ProjectDetailSkeleton` for detail view
- `TerminalSkeleton`, `LogsSkeleton`, `PortsSkeleton`

- [ ] **Step 2: Error boundary + toast system**

- Wrap `ProjectDetail` in error boundary
- Add toast notifications for: create/start/stop/delete success, port forward failure, terminal reconnect
- Use existing design system or add `src/ui/Toast.tsx`

- [ ] **Step 3: Accessibility audit**

- Tab order: Project list → Card → Detail → Terminal/Logs/Ports modals
- ARIA labels on all icon-only buttons
- Focus trap in modals (Terminal, Logs, Ports, CreateProjectDialog)
- Color contrast: verify all text meets 4.5:1
- Screen reader: `role="status"` for loading, `aria-live` for logs/terminal output

- [ ] **Step 4: Responsive fixes**

- Test at 320px, 768px, 1024px, 1440px
- Project grid: 1 col <640px, 2 col <1024px, 3 col <1280px, 4 col ≥1280px (already)
- Detail view: stack cards vertically on mobile, side-by-side on desktop
- Terminal/Logs modals: full-screen on mobile, 90vw/90vh on desktop
- Port table: horizontal scroll on mobile, full width on desktop

- [ ] **Step 5: Empty states & edge cases**

- No projects: illustration + CTA (done)
- No environment: "Create Environment" primary action (done)
- No config detected: "Detect Config" + manual entry fallback
- Terminal: "Connection lost" banner with retry
- Logs: "No logs yet" when paused from start
- Ports: "No ports forwarded" + inline forward form

- [ ] **Step 6: Performance**

- Virtualize logs >500 lines
- Debounce port list refetch (5s → 10s when idle)
- Memoize `ProjectCard` with `React.memo`
- Lazy-load xterm.js addons (webgl, fit) only when Terminal opens

- [ ] **Step 7: Run full verification**

```bash
# TypeScript + build
npm run typecheck && npm run build

# Unit tests
npm run test

# Playwright E2E (if configured)
npx playwright test

# Manual smoke test
npm run tauri dev
# - Create project → detect config → create env → start → terminal → logs → ports → stop → delete
# - Verify auto-injection works (echo $GH_TOKEN in terminal)
# - Verify git works in terminal (git status)
# - Verify SSH agent works (ssh-add -l in terminal)
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(projects): Task 7 - Polish pass (skeletons, a11y, responsive, performance, edge cases)"
```

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-11-06-projects-tasks-5-7.md`.**

You requested **subagent-driven execution with multi-SME challenge rounds** (UI/UX, Principal Engineer, Product Person per task). This is the correct approach for OpenChamber UX quality bar.

**To proceed:** Confirm the plan captures what you want, then I'll invoke `superpowers:subagent-driven-development` to execute Task 5 with the three-SME review gate, then Task 6, then Task 7.

---

## Rulings (pre-emptive)

| # | Conflict | Decision | Cost if Wrong |
|---|----------|----------|---------------|
| 1 | `project_detect_config` in Rust vs TypeScript | Implement in Rust (Tauri command) for consistency with other env commands; TypeScript `detectProjectConfig` becomes deprecated | Duplication of detection logic; mitigate by sharing test fixtures |
| 2 | Terminal reconnection: WebSocket vs exec polling | Use exec polling (existing `project_env_exec` command) — simpler, no new protocol | Slightly higher latency on reconnect; acceptable for dev use |
| 3 | Auto-injection: per-environment or global | Per-environment (stored in `env_vars_json`), user can toggle per env | More DB columns; negligible |
| 4 | Port collision handling: backend or frontend | Backend returns error, frontend shows inline retry — keeps backend simple | Frontend must parse error string; acceptable |