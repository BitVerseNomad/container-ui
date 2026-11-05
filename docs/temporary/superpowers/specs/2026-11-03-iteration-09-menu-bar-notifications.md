# Iteration 09: Menu Bar Item and Notifications (W9)

Date: 2026-11-03. Status: awaiting review.

## Intent

Add menu bar item and notifications: Tauri tray showing VM state and problem count; macOS notification when a container turns unhealthy or is OOM-killed (from existing problem detection); quick Start/Stop VM from tray.

**Success:** User sees VM status at a glance from the menu bar; gets notified when problems arise; can start/stop the VM without opening the full app.

## Scope

**In:**
- **Tauri tray:** System tray icon showing VM state (running/stopped/error) and problem count badge
- **macOS notifications:** Alert when a container turns unhealthy or is OOM-killed (integrating with existing problem detection)
- **Quick Start/Stop VM:** Tray menu with Start VM / Stop VM / Restart VM actions
- **VM state tracking:** Tray updates when VM state changes (via existing polling)
- **Problem count badge:** Display number of problems in the tray icon or tooltip
- **Research:** Tauri 2 tray and notification plugin permissions on macOS

**Out:**
- Full VM management from tray (settings editing, container management — that's the main app)
- Custom tray icons per container (generic Docker icon is sufficient)
- Tray notifications for non-problem events (info-level messages only)

## Research (SPEC.md Principle 2)

Per SPEC.md Principle 2, research was conducted before building. Research artifacts stored at:
- `docs/research/2026-11-03-tauri-2-tray-notification-macos.md` — Tauri 2 tray and notification plugin: permissions, API, macOS-specific behavior, tray icon requirements, notification permissions

## Current State

- Problem detection exists (unhealthy, OOM-killed containers are detected)
- No menu bar integration exists
- No system tray exists
- No macOS notifications are sent
- Existing `usePoll` hook polls for problems (latest-answer-wins, pauses while window is hidden)

## Design

### 1. Tauri Tray Setup

A system tray icon that reflects VM state:

```rust
// src-tauri/src/tray.rs

#[tauri::command]
fn setup_tray(window: tauri::Window) -> Result<()> {
    use tauri::Emitter;
    
    // Create tray with icon (Docker whale icon)
    let tray = tray_icon::Icon::from_resource(
        include_bytes!("../../assets/tray-icon.png"), 
        None
    )?;
    
    let menu = Menu::new()
        .item(&MenuItem::new("Colima UI", true, None))
        .separator()
        .item(&MenuItem::with_id(
            "open", 
            "Open Colima UI", 
            true, 
            None
        )?)
        .item(&MenuItem::with_id(
            "start_vm", 
            "Start VM", 
            true, 
            None
        )?)
        .item(&MenuItem::with_id(
            "stop_vm", 
            "Stop VM", 
            true, 
            None
        )?)
        .item(&MenuItem::with_id(
            "restart_vm", 
            "Restart VM", 
            true, 
            None
        )?)
        .separator()
        .item(&MenuItem::with_id(
            "quit", 
            "Quit", 
            true, 
            None
        )?);
    
    Tray::with_menu(tray, menu, move |event| {
        match event.id() {
            "open" => window.emit("tray-open", ()).ok(),
            "start_vm" => window.emit("tray-start-vm", ()).ok(),
            "stop_vm" => window.emit("tray-stop-vm", ()).ok(),
            "restart_vm" => window.emit("tray-restart-vm", ()).ok(),
            "quit" => app_handle.exit(0),
            _ => (),
        }
    })?;
    
    Ok(())
}
```

### 2. Tray State Updates

The tray icon updates based on VM state from existing polling:

```typescript
// src/hooks/useTrayState.ts

interface TrayState {
  vmState: "running" | "stopped" | "error" | "unknown";
  problemCount: number;
  tooltip: string;
}

function useTrayState() {
  const [state, setState] = useState<TrayState>({
    vmState: "unknown",
    problemCount: 0,
    tooltip: "Colima UI",
  });

  useEffect(() => {
    // Subscribe to VM state changes from existing polling
    const unsubscribeVm = listen("vm-state-changed", (event: { payload: string }) => {
      setState(prev => ({
        ...prev,
        vmState: event.payload as TrayState["vmState"],
      }));
    });

    // Subscribe to problem count changes from existing problem detection
    const unsubscribeProblems = listen("problems-changed", (event: { payload: { count: number } }) => {
      setState(prev => ({
        ...prev,
        problemCount: event.payload.count,
        tooltip: prev.problemCount > 0
          ? `Colima UI (${event.payload.count} problems)`
          : "Colima UI",
      }));
    });

    return () => {
      unsubscribeVm();
      unsubscribeProblems();
    };
  }, []);

  return state;
}
```

### 3. Tray Icon and Badge

The tray icon reflects the current state:

```
┌─────────────────────────────────┐
│  [Docker Icon]  Colima UI       │  ← Running, no problems
│  [Docker Icon ⚠3] Colima UI    │  ← Running, 3 problems
│  [Docker Icon Grey] Colima UI  │  ← Stopped
│  [Docker Icon Red] Colima UI   │  ← Error
└─────────────────────────────────┘
```

```rust
#[tauri::command]
fn update_tray_icon(vm_state: String, problem_count: u32) -> Result<()> {
    let icon_path = match (vm_state.as_str(), problem_count) {
        ("running", 0) => include_bytes!("../../assets/tray-icon-running.png"),
        ("running", _) => include_bytes!("../../assets/tray-icon-problems.png"),
        ("stopped", _) => include_bytes!("../../assets/tray-icon-stopped.png"),
        ("error", _) => include_bytes!("../../assets/tray-icon-error.png"),
        _ => include_bytes!("../../assets/tray-icon.png"),
    };
    
    // Update tray icon (Tauri 2 API)
    // Update tooltip with problem count
    Ok(())
}
```

### 4. macOS Notifications

Integrate with existing problem detection to send macOS notifications:

```rust
// src-tauri/src/notifications.rs

use tauri_plugin_notification::NotificationExt;

#[tauri::command]
fn send_notification(
    window: tauri::Window,
    title: String,
    body: String,
    action: Option<NotificationAction>,
) -> Result<()> {
    window.notification().builder()
        .title(&title)
        .body(&body)
        .action(action)  // "View" button that opens the app
        .show()?;
    Ok(())
}

enum NotificationAction {
    View,  // Opens the app and navigates to the problematic container
}
```

Integration with existing problem detection:

```rust
// When problem detection finds an unhealthy or OOM-killed container:
#[tauri::command]
fn check_and_notify(problems: Vec<Problem>) -> Result<()> {
    for problem in &problems {
        match problem.kind {
            ProblemKind::Unhealthy => {
                send_notification(
                    "Container Unhealthy".to_string(),
                    format!("{} is unhealthy. {}", problem.container_name, problem.message),
                    Some(NotificationAction::View),
                )?;
            }
            ProblemKind::OomKilled => {
                send_notification(
                    "Container OOM-Killed".to_string(),
                    format!("{} was OOM-killed. Consider increasing memory.", problem.container_name),
                    Some(NotificationAction::View),
                )?;
            }
            ProblemKind::Restarting => {
                send_notification(
                    "Container Restarting".to_string(),
                    format!("{} keeps restarting. {}", problem.container_name, problem.message),
                    None,  // No action button for restarting (less urgent)
                )?;
            }
        }
    }
    Ok(())
}
```

### 5. Tray Menu Actions

Tray menu actions that interact with existing backend commands:

```typescript
// src/hooks/useTrayActions.ts

function useTrayActions() {
  const appWindow = useAppWindow();

  const openApp = useCallback(async () => {
    await appWindow.show();
    await appWindow.setFocus();
  }, [appWindow]);

  const startVm = useCallback(async () => {
    await invoke("start_profile", {});
    // The existing polling will update the tray state
  }, []);

  const stopVm = useCallback(async () => {
    await invoke("stop_profile", {});
  }, []);

  const restartVm = useCallback(async () => {
    await invoke("restart_profile", {});
  }, []);

  return { openApp, startVm, stopVm, restartVm };
}
```

### 6. Acceptance Criteria

- System tray icon appears after app launch
- Tray icon reflects VM state (running/stopped/error)
- Problem count is shown in tray tooltip (and optionally as a badge)
- Tray menu has: Open Colima UI, Start VM, Stop VM, Restart VM, Quit
- Clicking "Open Colima UI" shows/restores the main window
- macOS notifications are sent when containers become unhealthy or OOM-killed
- Notification "View" button opens the app and navigates to the problematic container
- Tray icon updates when VM state changes (via existing polling)
- Tray integration respects macOS notification permissions (user is prompted)

### 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| macOS notification permissions prompt may be intrusive | Low | Only prompt when first problem is detected; explain why notifications are useful |
| Tauri 2 tray API may change between versions | Medium | Abstract tray interactions behind a trait; write integration tests against the preview |
| Tray icon may not display correctly on all macOS versions | Low | Test on macOS 12, 13, 14; provide fallback text-based tooltip |
| Problem count badge may not render on all systems | Low | Fall back to tooltip text showing problem count |
| Frequent problem state changes may spam notifications | Medium | Debounce notifications (max 1 every 30 seconds); batch problem notifications |

### 8. Open Questions

- Should the tray show per-container problem details, or just a count? (Proposal: count in tooltip, details in notification body)
- Should there be a "Mute Notifications" option in the tray menu? (Proposal: yes, toggle in settings)
- Should the tray icon be a custom Docker whale, or use the system default? (Proposal: custom Docker whale for brand consistency)
- Should notifications include a "Dismiss" action, or only "View"? (Proposal: "View" opens the app and navigates to the problem; no dismiss needed since the problem is visible in the app)