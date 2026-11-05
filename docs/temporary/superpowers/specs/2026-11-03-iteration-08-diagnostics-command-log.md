# Iteration 08: Diagnostics Page and Command Log (W8)

Date: 2026-11-03. Status: awaiting review.

## Intent

Add diagnostics page and command log: versions and paths of colima, docker, kubectl, brew, aws; active docker context and socket; VM state; one "Copy diagnostics" button for bug reports. Command log: every command the app ran (argv, exit code, stdout/stderr tail), searchable, with Copy.

**Success:** A "what did the app just do?" answer for every action; a "Copy diagnostics" button that gathers all system info for bug reports.

## Scope

**In:**
- **Diagnostics page:** Display versions and paths of colima, docker, kubectl, brew, aws; active docker context and socket; VM state
- **"Copy diagnostics" button:** Gathers all system info into a single block for bug reports
- **Command log:** Every command the app ran (argv, exit code, stdout/stderr tail), searchable, with Copy
- **Log formatter:** Tested formatter that produces human-readable output
- **Searchable log:** Filter commands by text, exit code, time range

**Out:**
- Modifying or replaying commands from the log (read-only)
- Exporting logs to files (copy to clipboard is sufficient)
- Real-time streaming of logs (batched updates are sufficient)

## Research (SPEC.md Principle 2)

Per SPEC.md Principle 2, research was conducted before building. Research artifacts stored at:
- `docs/research/2026-11-03-colimastack-diagnostics.md` — ColimaStack diagnostics approach: what system info to collect, how to format for bug reports
- `docs/research/2026-11-03-command-logging-patterns.md` — Command logging patterns: what to log, how to store, how to search

## Current State

- Backend has `list_profiles`, `docker` (allowlisted), `kubectl` (read-only), `install_tools` commands
- No diagnostics page exists
- No command logging exists
- No way to gather system info for bug reports

## Design

### 1. Diagnostics Page

A page that displays system information:

```
┌─────────────────────────────────────────┐
│  Diagnostics                            │
├─────────────────────────────────────────┤
│  System                                 │
│  ┌───────────────────────────────────┐  │
│  │ Colima:          0.6.0            │  │
│  │ Path:            /usr/local/bin/  │  │
│  │ Docker:          24.0.7           │  │
│  │ Path:            /usr/local/bin/  │  │
│  │ kubectl:         1.28.0           │  │
│  │ Path:            /usr/local/bin/  │  │
│  │ Homebrew:        4.2.0            │  │
│  │ Path:            /opt/homebrew/   │  │
│  │ AWS CLI:         2.15.0           │  │
│  │ Path:            (not installed)  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Docker                                 │
│  ┌───────────────────────────────────┐  │
│  │ Context:         colima           │  │
│  │ Socket:          /var/run/...     │  │
│  │ Server:          v24.0.7          │  │
│  │ Client:          v24.0.7          │  │
│  └───────────────────────────────────┘  │
│                                         │
│  VM State:        Running (colima)      │
│  Profile:         default               │
│  VM Type:         vz                   │
│  CPUs:            4                     │
│  Memory:          8 GB                  │
│  Disk:            100 GB                │
│                                         │
│  [Copy Diagnostics]                     │
└─────────────────────────────────────────┘
```

### 2. Backend Command: `collect_diagnostics`

```rust
#[tauri::command]
fn collect_diagnostics() -> Result<DiagnosticsReport> {
    let mut report = DiagnosticsReport::default();
    
    // Collect version and path for each tool
    report.colima = get_version_and_path("colima");
    report.docker = get_version_and_path("docker");
    report.kubectl = get_version_and_path("kubectl");
    report.brew = get_version_and_path("brew");
    report.aws = get_version_and_path("aws");
    
    // Docker context and socket
    report.docker_context = get_docker_context();
    report.docker_socket = get_docker_socket();
    
    // VM state
    let colima_output = invoke_colima(&["info", "--json"])?;
    report.vm_state = parse_colima_info(&colima_output);
    
    // System info
    report.os_version = get_os_version();
    report.architecture = get_architecture();
    report.hostname = get_hostname();
    
    Ok(report)
}

// Returns a formatted string for copying
#[tauri::command]
fn format_diagnostics(report: DiagnosticsReport) -> Result<String> {
    Ok(format_report(&report))
}
```

### 3. Command Log

A searchable log of every command the app ran:

```typescript
interface CommandLogEntry {
  id: string;
  timestamp: Date;
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  duration: number; // ms
  success: boolean;
}

function CommandLogPage() {
  const [entries, setEntries] = useState<CommandLogEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<CommandLogEntry | null>(null);

  // Search/filter
  const filtered = entries.filter(e => 
    e.command.includes(filter) || 
    e.args.some(a => a.includes(filter)) ||
    e.stdout.includes(filter) || 
    e.stderr.includes(filter)
  );

  return (
    <div>
      <SearchBox value={filter} onChange={setFilter} placeholder="Search commands..." />
      <CommandList entries={filtered} onSelect={setSelectedEntry} />
      {selectedEntry && (
        <CommandDetail 
          entry={selectedEntry}
          onCopy={() => copyToClipboard(formatCommandEntry(selectedEntry))}
        />
      )}
    </div>
  );
}
```

### 4. Log Storage

Commands are stored in app storage (not Docker):
- In-memory during session
- Persisted to `~/.colima-ui/command-log.json` (rotated, max 1000 entries)
- Each entry: timestamp, command, args, exit code, stdout/stderr tail (1024 chars), duration

```rust
#[tauri::command]
fn log_command(command: String, args: Vec<String>) -> Result<CommandId> {
    let entry = CommandLogEntry {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now(),
        command,
        args,
        exit_code: None,
        stdout: String::new(),
        stderr: String::new(),
        duration: 0,
        success: false,
    };
    // Store in memory and persist to disk
    COMMAND_LOG.lock().unwrap().push(entry);
    rotate_log(); // Keep max 1000 entries
    Ok(entry.id)
}

#[tauri::command]
fn update_command_log(id: String, exit_code: i32, stdout: String, stderr: String, duration: u64) -> Result<()> {
    let mut log = COMMAND_LOG.lock().unwrap();
    if let Some(entry) = log.iter_mut().find(|e| e.id == id) {
        entry.exit_code = Some(exit_code);
        entry.stdout = stdout.chars().take(1024).collect();
        entry.stderr = stderr.chars().take(1024).collect();
        entry.duration = duration;
        entry.success = exit_code == 0;
    }
    Ok(())
}
```

### 5. "Copy Diagnostics" Button

Formats the diagnostics report into a human-readable string and copies to clipboard:

```typescript
async function copyDiagnostics() {
  const report = await invoke("collect_diagnostics");
  const formatted = await invoke("format_diagnostics", { report });
  await navigator.clipboard.writeText(formatted);
  // Show confirmation: "Diagnostics copied to clipboard"
}
```

Example output:
```
Colima UI Diagnostics
=====================
Date: 2026-11-03T12:00:00Z
OS: macOS 14.1 (23B74)
Architecture: arm64
Hostname: macbook.local

Tools:
  Colima: 0.6.0 (/usr/local/bin/colima)
  Docker: 24.0.7 (/usr/local/bin/docker)
  kubectl: 1.28.0 (/usr/local/bin/kubectl)
  Homebrew: 4.2.0 (/opt/homebrew/bin/brew)
  AWS CLI: 2.15.0 (/usr/local/bin/aws)

Docker:
  Context: colima
  Socket: /var/run/docker.sock
  Server: v24.0.7
  Client: v24.0.7

VM:
  State: Running (colima)
  Profile: default
  VM Type: vz
  CPUs: 4
  Memory: 8 GB
  Disk: 100 GB
```

### 6. Acceptance Criteria

- Diagnostics page shows versions and paths of colima, docker, kubectl, brew, aws
- Active docker context and socket are displayed
- VM state is shown (running/stopped, profile, VM type, resources)
- "Copy diagnostics" button produces a formatted report for bug reports
- Command log shows every command the app ran (argv, exit code, stdout/stderr tail)
- Command log is searchable by text, exit code, or time range
- Each command log entry has a "Copy" button
- Log formatter is tested

### 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Command log grows large over time | Medium | Rotate to max 1000 entries; oldest entries removed |
| stdout/stderr may contain sensitive data | High | Truncate to 1024 chars; redact known patterns (tokens, keys) |
| `colima info` may fail if Colima not installed | Low | Show "not installed" for missing tools |
| Docker socket path varies by installation | Low | Detect dynamically; don't hardcode paths |

### 8. Open Questions

- Should command log be persisted across app restarts? (Proposal: yes, rotated to 1000 entries)
- Should sensitive data (tokens, keys) be automatically redacted? (Proposal: yes, regex-based redaction)
- Should users be able to export the full command log? (Proposal: no, clipboard copy is sufficient for debugging)
