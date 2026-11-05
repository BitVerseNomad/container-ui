# Iteration 07: Colima Settings Coverage (W7)

Date: 2026-11-03. Status: awaiting review.

## Intent

Add Colima settings coverage: research `colima start` and `template` flags (vm-type vz/qemu, mount type, network address, DNS and `--dns-host`, Rosetta, docker daemon config, Kubernetes version and disable list), show current settings, edit with restart warning, and turn Kubernetes on/off.

**Success:** Settings page reads real values, applies changes via `apply_resources` (extended), and shows streamed output.

## Scope

**In:**
- **Settings discovery:** Read current Colima settings via `colima info` or `colima template`
- **VM type:** Display and switch between vz/qemu (qemu needed for non-Apple Silicon)
- **Mount type:** Display and switch between virtiofs/9p/nfs (NFS requires `nfs-server` package)
- **Network address:** Display current network address, allow custom DNS server configuration
- **DNS settings:** Configure DNS servers, `--dns-host` entries for custom host resolution
- **Rosetta:** Detect and enable Rosetta 2 on Apple Silicon (for x86_64 containers)
- **Docker daemon config:** View and edit docker daemon.json settings (registries, storage driver, logs)
- **Kubernetes:** Show Kubernetes version, enable/disable Kubernetes, configure k8s version
- **Resource limits:** Extended `apply_resources` to support CPU, memory, disk size
- **Restart warning:** Show clear warning when settings changes require VM restart
- **Streamed output:** Show `colima start` progress with streamed output

**Out:**
- Modifying container-level settings (that's per-container)
- Network configuration beyond DNS (that's Networks screen)
- Kubernetes cluster management (that's kubectl screen)

## Research (SPEC.md Principle 2)

Per SPEC.md Principle 2, research was conducted before building. Research artifacts stored at:
- `docs/research/2026-11-03-colima-template-flags.md` — `colima start` and `colima template` flags: vm-type (vz/qemu), mount type (virtiofs/9p/nfs), network address, DNS, `--dns-host`, Rosetta, docker daemon config, Kubernetes version and disable list
- `docs/research/2026-11-03-colima-info-command.md` — `colima info` output format and fields for reading current settings

## Current State

- Colima settings are partially managed through `start_profile`, `apply_resources`, `stop_profile`, `restart_profile`, `delete_profile`, `cancel_vm_op` backend commands
- No dedicated settings UI exists
- No knowledge of `colima template` or `colima info` commands

## Design

### 1. Settings Discovery

Read current Colima settings via backend command:

```typescript
interface ColimaSettings {
  vmType: "vz" | "qemu";
  arch: "x86_64" | "aarch64";
  cpu: number;
  memory: number;
  disk: number;
  mountType: "virtiofs" | "9p" | "nfs";
  networkAddress: boolean;
  dns: string[];
  dnsHost: Array<{host: string; ip: string}>;
  kubernetes: {
    enabled: boolean;
    version: string;
  };
  rosetta: {
    enabled: boolean;
    binfmt: boolean;
  };
  docker: {
    config: Record<string, unknown>;
  };
  audio: {
    driver: "coreaudio" | "pulseaudio" | null;
  };
  display: {
    backend: "virtual Display" | null;
  };
}

async function loadColimaSettings(): Promise<ColimaSettings> {
  const result = await invoke("colima_info", {});
  return parseColimaInfo(result);
}
```

### 2. Settings UI

A settings page with sections:

```
┌─────────────────────────────────────────┐
│  Colima Settings                        │
├─────────────────────────────────────────┤
│  General                                │
│  ┌───────────────────────────────────┐  │
│  │ VM Type:        [vz ▼]            │  │
│  │ Architecture:   aarch64           │  │
│  │ CPU:            [4] cores         │  │
│  │ Memory:         [8] GB            │  │
│  │ Disk:           [100] GB          │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Mounting                               │
│  ┌───────────────────────────────────┐  │
│  │ Mount Type:       [virtiofs ▼]    │  │
│  │ ~/Documents:     /Users/.../Doc... │  │
│  │ ~/Projects:      /Users/.../Proj.. │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Network                                │
│  ┌───────────────────────────────────┐  │
│  │ Network Address:  [✓] Enabled     │  │
│  │ DNS Servers:      [8.8.8.8, ...]  │  │
│  │ DNS Hosts:        host → IP       │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Kubernetes                             │
│  ┌───────────────────────────────────┐  │
│  │ Kubernetes:       [Disabled]      │  │
│  │ Version:          (N/A)           │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [Apply Settings] (requires restart)    │
└─────────────────────────────────────────┘
```

### 3. Backend Commands

New allowlisted backend commands:

```rust
#[tauri::command]
fn colima_info() -> Result<ColimaSettingsJson> {
    // Execute: colima info --json
    let output = invoke_colima(&["info", "--json"])?;
    Ok(serde_json::from_str(&output.stdout)?)
}

#[tauri::command]
fn apply_colima_settings(settings: ColimaSettings) -> Result<StreamedOutput> {
    // Build colima start command with appropriate flags
    let args = build_start_args(&settings);
    // Execute: colima start <args> --restart
    invoke_colima_streamed(&args)
}
```

### 4. Apply Settings Flow

1. User modifies settings (changes highlighted)
2. User clicks "Apply Settings"
3. Confirmation dialog: "Applying these settings will restart your Colima VM. All running containers will be stopped. Continue?"
4. On confirm: execute `colima start` with new settings, `--restart` flag
5. Show streamed progress output
6. On success: refresh settings display
7. On failure: show error, offer to revert

### 5. Kubernetes Toggle

Special handling for Kubernetes:
- If enabled: show version, show "Manage Kubernetes" button (links to kubectl screen)
- If disabled: show "Enable Kubernetes" button
- Enabling/disabling requires VM restart (same flow as above)
- Kubernetes version is configurable when enabling

```typescript
async function toggleKubernetes(enabled: boolean, version?: string): Promise<void> {
  const current = await loadColimaSettings();
  const k8sSettings = { ...current.kubernetes, enabled, version: version || current.kubernetes.version };
  
  // Show restart warning
  if (current.kubernetes.enabled !== enabled) {
    await confirmRestart("Enabling/disabling Kubernetes requires a VM restart.");
  }
  
  const settings = { ...current, kubernetes: k8sSettings };
  await applyColimaSettings(settings);
}
```

### 6. Acceptance Criteria

- Settings page reads real Colima values via `colima info` or `colima template`
- All settings (vm-type, mount type, DNS, Kubernetes, resources) are displayed
- Changes can be edited and applied via `colima start` with appropriate flags
- Restart warning is shown before applying changes
- Streamed output is visible during restart
- Kubernetes can be enabled/disabled with version selection
- DNS servers and `--dns-host` entries can be configured
- Rosetta detection and enablement works on Apple Silicon

### 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| `colima info` output format changes between versions | Medium | Parse defensively; handle missing fields gracefully |
| `colima template` not available in older Colima versions | Low | Fall back to parsing `colima info` output |
| NFS mount type requires `nfs-server` package | Medium | Show install instructions if NFS selected but package missing |
| QEMU not installed on Apple Silicon | Low | Detect and show install instructions (`brew install qemu`) |
| Settings changes break existing containers | Medium | `--restart` flag preserves containers; document breaking changes |

### 8. Open Questions

- Should settings be editable per-profile, or global? (Proposal: per-profile, matching existing profile system)
- What is the default mount type? (Proposal: virtiofs on macOS, 9p on Linux)
- Should Rosetta be auto-detected and offered, or manual opt-in? (Proposal: auto-detect, show option if x86_64 containers detected)
