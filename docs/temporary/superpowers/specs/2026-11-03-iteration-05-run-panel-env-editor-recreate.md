# Iteration 05: Run Panel — Env Editor and "Recreate with Changes" (W5)

Date: 2026-11-03. Status: awaiting review.

## Intent

Add environment variable editing and "recreate with changes" to the Run panel. Users can inspect an existing container's run arguments, modify environment variables (with `.env` import, masked secrets, add/remove rows), set restart policies, memory/CPU limits, and command overrides. The key feature: **recreate from an existing container** — stop, remove, and run again with new args — so the doctor can apply fixes (e.g., localhost settings, env changes) without the user needing to know Docker commands.

**Success:** Inspected container args round-trip through the arg builder; the doctor offers "Recreate with this fix"; changes are previewed before application; a backup of old settings is created.

## Scope

**In:**
- **Key/value env var rows** with add/remove functionality
- **`.env` file import** via `parseDotenv`: handles `export` prefix, quoted values, comments
- **Masked secret-looking values** with show/hide toggle (keys matching `password`, `secret`, `key`, `token`, `credential` — case insensitive)
- **Restart policy selector:** no, always, on-failure, unless-stopped
- **Memory/CPU limits** input (human-readable: "512MB", "2 cores")
- **Command override** input (replaces the container's default command)
- **Recreate from existing container:**
  - Inspect existing container to extract `docker run` arguments
  - Display what will change (diff view)
  - Stop existing container → remove → run with new args
  - Preview shows: what changes, what stays the same, what is removed
  - Backup of old settings stored in app storage (not on disk)
  - Doctor offers "Recreate with this fix" for known issues (localhost settings, env changes)
- **Docker cannot edit a running container's env** — the recreate flow is the workaround

**Out:**
- Editing a running container's environment in-place (Docker does not support this)
- Building a compose editor (SPEC.md W6: "Do not build a compose editor")
- Editing container labels (not requested by owner)

## Research (SPEC.md Principle 2)

Per SPEC.md Principle 2, research was conducted before building. Research artifacts stored at:
- `docs/research/2026-11-03-docker-env-var-handling.md` — Docker environment variable behavior, `.env` file format, `docker run --env-file` semantics
- `docs/research/2026-11-03-docker-recreate-pattern.md` — Container recreation pattern: inspect → stop → remove → run with new args; backup strategies

## Current State

- The Run panel exists with basic container creation
- No environment variable editing for existing containers
- No `.env` file import
- No "recreate" functionality
- No command override or restart policy editing

## Design

### 1. Environment Variable Editor

A table of key/value pairs representing the container's environment variables:

```typescript
interface EnvVarRow {
  key: string;
  value: string;
  isSecret?: boolean; // auto-detected or user-marked
  isHidden: boolean; // for secrets, default hidden
  isReadOnly?: boolean; // from inspected container, not editable
  isNew?: boolean; // newly added, not yet saved
}

function isSecretKey(key: string): boolean {
  const secretPatterns = /password|passwd|pwd|secret|key|token|credential|auth|private/i;
  return secretPatterns.test(key);
}
```

**Features:**
- Add row button (prominent, follows SPEC.md Principle 5: one primary button)
- Remove row button (per-row, secondary)
- Toggle show/hide for secret-looking values (eye icon)
- `.env` file import button: opens file picker, parses `.env` file, adds all valid key/value pairs
- Changes are staged until "Apply" is clicked

### 2. `.env` File Import (`parseDotenv`)

A pure logic function that parses `.env` file format:

```typescript
function parseDotenv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || /^#/.test(trimmed)) continue;

    // Handle 'export' prefix
    const withoutExport = trimmed.replace(/^export\s+/, "");

    // Handle quoted values (single and double quotes)
    const eqIndex = withoutExport.indexOf("=");
    if (eqIndex === -1) continue;

    const key = withoutExport.slice(0, eqIndex).trim();
    let value = withoutExport.slice(eqIndex + 1).trim();

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}
```

### 3. Restart Policy, Memory/CPU, Command Override

- **Restart policy:** Dropdown selector with options: "no", "always", "on-failure", "unless-stopped"
- **Memory limit:** Text input accepting human-readable values ("512MB", "1GB", "2048m"). Converted to bytes internally.
- **CPU limit:** Text input accepting decimal values ("0.5", "2", "1.5 cores"). Converted to nanocores internally.
- **Command override:** Text input. When empty, uses the container's default command. When set, overrides the default.

### 4. Recreate from Existing Container (Core Mechanism)

This is the critical feature. Docker cannot edit a running container's environment. The workaround:

**Flow:**
1. **Inspect** existing container → extract all `docker run` arguments (env vars, volumes, ports, labels, restart policy, memory/CPU limits, command)
2. **Display** extracted args in the editor (pre-filled, editable)
3. **User modifies** what they need (env vars, restart policy, etc.)
4. **Preview** shows a diff:
   - What will change (modified env vars, new restart policy, etc.)
   - What stays the same (volumes, ports, etc.)
   - What will be removed (the existing container)
5. **Backup** of old settings stored in app storage (not on disk, per safety spec)
6. **Execute** on user confirmation:
   - Stop existing container (if running)
   - Remove existing container
   - Run new container with modified args
7. **Result:** New container with the same identity (same name, volumes, ports) but with the user's changes

```typescript
// Recreate flow
async function recreateContainer(
  containerId: string,
  modifiedArgs: ContainerArgs
): Promise<{ success: boolean; newContainerId?: string; error?: string }> {
  // 1. Inspect existing container
  const existing = await inspectContainer(containerId);

  // 2. Build new docker run command from modified args
  const newArgs = buildRunArgs(existing, modifiedArgs);

  // 3. Create backup of old settings
  saveBackup(containerId, existing);

  // 4. Stop and remove existing
  await stopContainer(containerId);
  await removeContainer(containerId);

  // 5. Run new container
  const result = await runContainer(newArgs);

  return { success: true, newContainerId: result.id };
}
```

### 5. Doctor Integration

The doctor (existing "Health" tab) offers "Recreate with this fix" when it detects:
- **Localhost settings issue:** Container cannot reach localhost → doctor suggests adding `--add-host localhost:127.0.0.1` or fixing network mode
- **Environment variable issue:** Missing required env vars → doctor suggests adding them

When the doctor identifies a fixable issue, it shows a "Recreate with this fix" button that pre-fills the recreate editor with the fix applied.

### 6. Acceptance Criteria

- Env editor supports add/remove key/value rows
- `.env` file import correctly parses `export`, quotes, and comments
- Secret-looking values are masked by default with show/hide toggle
- Restart policy, memory/CPU limits, and command override inputs work
- Inspecting a container and recreating it round-trips the args correctly
- The doctor offers "Recreate with this fix" for known issues
- Changes are previewed before application (diff view)
- A backup of old settings is created before recreation
- Unit tests cover `parseDotenv` edge cases
- Browser test covers the full recreate flow

### 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Recreate flow may lose container state (logs, attached volumes) | High | Document limitations; preserve volume mounts; warn about log loss |
| User may not understand what "recreate" means | Medium | Clear diff view; explanation text; doctor explains when applicable |
| Secrets stored in backup may be a security concern | Medium | Backups stored in app storage (encrypted if possible), auto-expire after 7 days |
| Long-running containers may have active connections that break on restart | Low | Warn user about active connections; suggest graceful stop first |

### 8. Open Questions

- Should the doctor auto-apply fixes, or always require user confirmation? (Proposal: always require confirmation — follows SPEC.md Principle 1: "guidance plainly")
- How long should backups of old settings be retained? (Proposal: 7 days, configurable)
