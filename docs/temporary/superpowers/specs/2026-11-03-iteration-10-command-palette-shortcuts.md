# Iteration 10: Command Palette and Shortcuts (W10)

Date: 2026-11-03. Status: awaiting review.

## Intent

Add a command palette (⌘K) for keyboard-first navigation and common actions: jump to any container, image, network, or pod; run frequent actions (start, stop, restart, logs) without a mouse.

**Success:** Power users navigate and act entirely from the keyboard; the palette surfaces relevant actions based on context; existing mouse users are unaffected.

## Scope

**In:**
- **⌘K shortcut:** Opens a searchable, filterable command palette from anywhere in the app
- **Jump targets:** Containers, images, networks, and pods (from existing data fetches)
- **Common actions:** Start, stop, restart, inspect, view logs for selected items
- **Keyboard-first:** Arrow keys to navigate, Enter to select, Esc to close, type to filter
- **Context-aware suggestions:** Palette shows relevant actions based on the current item type and state (e.g., "Stop" for running containers, "Start" for stopped ones)
- **Research first:** Existing keyboard shortcuts in the app, command palette UX patterns, macOS accessibility guidelines for palettes

**Out:**
- Custom keybindings (⌘K is fixed)
- Palette for non-Docker actions (settings editing, app preferences)
- Voice commands or natural language parsing
- Palette for compose project editing (W6 is read-only)

## Research (SPEC.md Principle 2)

Per SPEC.md Principle 2, research was conducted before building. Research artifacts stored at:
- `docs/research/2026-11-03-command-palette-ux-macos.md` — Command palette UX patterns: search/filter behavior, keyboard navigation, macOS system search (Spotlight) conventions, accessibility considerations, existing keyboard shortcuts in the app

## Current State

- Existing lists (containers, images, networks, pods) are mouse-driven
- No global keyboard shortcut system exists
- No command palette exists
- Existing navigation uses sidebar links and list views
- Data fetches for containers, images, networks, and pods already exist

## Design

### 1. Command Palette Trigger

```typescript
// src/components/CommandPalette.tsx

import { useEffect, useState, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

interface PaletteItem {
  id: string;
  type: "container" | "image" | "network" | "pod";
  name: string;
  subtitle?: string;
  actions: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PaletteItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K shortcut (handled at the app level via Tauri global shortcut)
  useEffect(() => {
    const unsubscribe = listen("command-palette-toggle", () => {
      setOpen(prev => {
        if (!prev) {
          setQuery("");
          setSelectedIndex(0);
          fetchItems("");
        }
        return !prev;
      });
    });
    return () => unsubscribe();
  }, []);

  // Filter items as user types (debounced)
  useEffect(() => {
    if (!query) {
      fetchItems("");
      return;
    }
    const timer = setTimeout(() => fetchItems(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (items[selectedIndex]) {
          executeAction(items[selectedIndex], "view");
        }
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  }, [items, selectedIndex]);

  return open ? (
    <div className="command-palette" onKeyDown={handleKeyDown}>
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Type to search containers, images, networks..."
        autoFocus
      />
      <ul>
        {items.map((item, i) => (
          <li
            key={item.id}
            className={i === selectedIndex ? "selected" : ""}
            onClick={() => executeAction(item, "view")}
          >
            <span className="type">{item.type}</span>
            <span className="name">{item.name}</span>
            {item.subtitle && <span className="subtitle">{item.subtitle}</span>}
            <span className="actions">{item.actions.join(", ")}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : null;
}
```

### 2. Backend: Fetch Items for Palette

```rust
// src-tauri/src/command_palette.rs

#[derive(serde::Deserialize)]
struct FilterQuery {
    query: String,
}

#[derive(serde::Serialize)]
struct PaletteItem {
    id: String,
    #[serde(rename = "type")]
    item_type: String,
    name: String,
    subtitle: Option<String>,
    actions: Vec<String>,
}

#[tauri::command]
async fn get_palette_items(filter: Option<FilterQuery>) -> Result<Vec<PaletteItem>> {
    let mut items = Vec::new();

    // Containers
    let containers = docker_ps().await?;
    for c in &containers {
        let mut actions = vec!["View".to_string()];
        if c.state == "running" {
            actions.extend(["Stop", "Restart", "Logs"]);
        } else {
            actions.push("Start");
        }
        items.push(PaletteItem {
            id: c.id.clone(),
            item_type: "container".to_string(),
            name: c.name.clone(),
            subtitle: Some(c.image.clone()),
            actions,
        });
    }

    // Images
    let images = docker_images().await?;
    for img in &images {
        items.push(PaletteItem {
            id: img.id.clone(),
            item_type: "image".to_string(),
            name: img.repository.clone(),
            subtitle: Some(img.tag.clone()),
            actions: vec!["View".to_string(), "Remove".to_string()],
        });
    }

    // Networks
    let networks = docker_networks().await?;
    for net in &networks {
        items.push(PaletteItem {
            id: net.name.clone(),
            item_type: "network".to_string(),
            name: net.name.clone(),
            subtitle: Some(format!("{} drivers", net.driver)),
            actions: vec!["View".to_string()],
        });
    }

    // Pods (if Kubernetes is enabled)
    if kubernetes_enabled() {
        let pods = kubectl_get_pods().await?;
        for pod in &pods {
            items.push(PaletteItem {
                id: pod.name.clone(),
                item_type: "pod".to_string(),
                name: pod.name.clone(),
                subtitle: Some(format!("{} / {}", pod.namespace, pod.status)),
                actions: vec!["View".to_string(), "Logs".to_string()],
            });
        }
    }

    // Filter by query if provided
    if let Some(f) = filter {
        let q = f.query.to_lowercase();
        items.retain(|item| {
            item.name.to_lowercase().contains(&q)
                || item.subtitle.as_ref().map_or(false, |s| s.to_lowercase().contains(&q))
        });
    }

    Ok(items)
}
```

### 3. Execute Actions from Palette

```rust
// src-tauri/src/command_palette.rs (continued)

#[derive(serde::Deserialize)]
struct ExecuteActionInput {
    item_id: String,
    item_type: String,
    action: String,
}

#[tauri::command]
async fn execute_palette_action(input: ExecuteActionInput) -> Result<()> {
    match input.action.as_str() {
        "Start" => {
            match input.item_type.as_str() {
                "container" => start_container(&input.item_id).await,
                _ => Err("Start not available for this type".into()),
            }
        }
        "Stop" => {
            match input.item_type.as_str() {
                "container" => stop_container(&input.item_id).await,
                "pod" => stop_pod(&input.item_id).await,
                _ => Err("Stop not available for this type".into()),
            }
        }
        "Restart" => {
            match input.item_type.as_str() {
                "container" => restart_container(&input.item_id).await,
                _ => Err("Restart not available for this type".into()),
            }
        }
        "Logs" => {
            match input.item_type.as_str() {
                "container" => stream_container_logs(&input.item_id).await,
                "pod" => stream_pod_logs(&input.item_id).await,
                _ => Err("Logs not available for this type".into()),
            }
        }
        "View" | "Remove" => {
            // Emit event to open the appropriate view in the frontend
            // The frontend handles navigation to the detail view
            Ok(())
        }
        _ => Err(format!("Unknown action: {}", input.action).into()),
    }
}
```

### 4. Palette UI Layout

```
┌────────────────────────────────────────────────┐
│  🔍  Type to search containers, images...     │  ← Search input (auto-focused)
├────────────────────────────────────────────────┤
│  📦 container  nginx-main                     │  ← Arrow key navigable
│     nginx:latest  • Stop, Restart, Logs       │
│  📦 container  postgres-db                  │
│     postgres:15  • Start                      │
│  🖼 image       myapp:v2.1                  │
│     2 weeks ago  • View, Remove               │
│  🌐 network     app-internal                │
│     bridge  • View                            │
└────────────────────────────────────────────────┘
   ↑↓ navigate  • Enter to view  • Esc to close
```

### 5. Keyboard Shortcut Registration

```rust
// src-tauri/src/main.rs (Tauri builder)

use tauri::Builder;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Register ⌘K global shortcut
            let shortcut = tauri_plugin_global_shortcut::Shortcut::new(
                Some(tauri_plugin_global_shortcut::Modifiers::COMMAND),
                tauri_plugin_global_shortcut::Code::KeyK,
            );
            let handler = move |_, _, _| {
                app.emit_all("command-palette-toggle", ());
            };
            tauri_plugin_global_shortcut::GlobalShortcutManager::register(
                app.global_shortcut_manager(),
                shortcut,
                handler,
            )?;
            Ok(())
        })
        .run(tauri::generate_context!());
}
```

### 6. Acceptance Criteria

- Pressing ⌘K opens the command palette from any screen in the app
- Palette is searchable: typing filters results in real-time (debounced 150ms)
- Arrow keys navigate through results; Enter selects; Esc closes
- Palette shows containers, images, networks, and pods (if K8s enabled)
- Each item shows its type, name, and subtitle (image for containers, tag for images, driver for networks, namespace/status for pods)
- Context-aware actions are shown per item (e.g., "Start" for stopped containers, "Stop" for running ones)
- Executing "View" navigates to the existing detail view for that item
- Executing "Start/Stop/Restart/Logs" performs the action and shows feedback (Banner for errors, OutputLog for streamed output)
- Palette is keyboard-accessible (Tab order, focus management)
- Existing mouse-driven workflows are unaffected
- Palette appears above all other UI (z-index, modal overlay)

### 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Global ⌘K shortcut may conflict with existing shortcuts | Medium | Check existing shortcuts first; use ⌘⇧K if ⌘K is taken; document the shortcut in the help section |
| Large number of containers/images may slow palette rendering | Medium | Virtualize the list (render only visible items); debounce search; limit results to 50 |
| Palette may steal focus from form inputs | Low | Only trigger on global shortcut (⌘K), not on Tab or Click; close when focus returns to main window |
| Actions from palette may conflict with existing UI actions | Low | Palette actions call the same backend commands as the UI — no duplicate logic |
| macOS accessibility permissions for global shortcuts | Low | Global shortcuts do not require accessibility permissions in Tauri; verify during Tauri 2 testing |

### 8. Open Questions

- Should the palette support fuzzy matching (e.g., "ngxl" matches "nginx-main")? (Proposal: yes, use a fuzzy-match library like `fuse.js` or `fzf` algorithm)
- Should the palette show recently used items at the top? (Proposal: yes, track the last 10 viewed/acted-on items and surface them when the palette is empty)
- Should the palette support action shortcuts (e.g., ⌘K then "s" for "Stop")? (Proposal: no, keep it simple; use arrow keys + Enter)
- Should the palette be context-aware of the current screen (e.g., on the containers screen, prioritize containers)? (Proposal: no, the palette is global and always shows all types equally)
- Should there be a "Run Command" option in the palette to execute arbitrary Docker commands (within the allowlist)? (Proposal: no — W8 already has the diagnostics command log; keep the palette focused on navigation and common actions)
