# Iteration 12: Image Build, Registries, Terminal, Remote, Onboarding, Localization, and Doctor Extensions (W13+W14)

Date: 2026-11-03. Status: awaiting review.

## Intent

Ship advanced Docker features (image build/push, private registries, lazydocker integration, in-app terminal, remote hosts, Linux support), an onboarding tour for first-time users, localization support, and doctor extensions (HTTP probes, "connect all to a network") — plus research the feasibility of each before implementation.

**Success:** Power users can build/push images to private registries, debug containers via an in-app terminal, connect to remote Docker hosts, and get smarter health diagnostics; new users get guided through the app; the app supports multiple languages.

## Scope

**In:**
- **Image build and push:** Build images from Dockerfiles, push to registries (Docker Hub, GHCR, AWS ECR, private registries via credential helpers)
- **More registries:** GitHub Container Registry (GHCR), Docker Hub private repositories, AWS ECR (already partially implemented), credential helpers for authentication
- **"Open in lazydocker":** Research first, then integrate lazydocker as an optional external tool (research whether lazydocker can connect to Colima's Docker socket)
- **In-app terminal:** pty-based terminal with xterm.js for interactive container shells
- **Remote hosts:** Connect to remote Docker hosts via SSH tunnel or direct TCP socket
- **Linux support:** Build and run on Linux (in addition to macOS)
- **Onboarding tour:** Guided tour for first-time users (key features, how to start Colima, how to create a container)
- **Localization:** i18n support for multiple languages (en, pt, de, ja, etc.)
- **Doctor extensions (W14):** HTTP probes, "connection refused" link from health-check output, "connect all to a network" action
- **Research first:** Tauri pty plugin availability, xterm.js integration, lazydocker Docker socket compatibility, remote Docker over SSH, Linux compatibility, i18n frameworks, onboarding UX patterns, doctor extension feasibility

**Out:**
- Windows support (Linux is the next platform after macOS; Windows is out of scope)
- Podman or other container runtimes (Docker/Colima only)
- Kubernetes dashboard (K8s integration is limited to pods from existing data fetches)
- Multi-user/team features (single-user only)
- Custom registry server (use existing registries with credential helpers)

## Research (SPEC.md Principle 2)

Per SPEC.md Principle 2, research was conducted before building. Research artifacts stored at:
- `docs/research/2026-11-03-image-build-push-registries.md` — Docker image build and push workflows, GHCR authentication, Docker Hub private repos, AWS ECR credential helpers, registry authentication flows
- `docs/research/2026-11-03-lazydocker-colima-compatibility.md` — Whether lazydocker can connect to Colima's Docker socket, integration patterns, user experience considerations
- `docs/research/2026-11-03-in-app-terminal-pty-xterm.md` — Tauri pty plugin availability, xterm.js integration patterns, security considerations for interactive shells
- `docs/research/2026-11-03-remote-docker-hosts.md` — Remote Docker over SSH tunneling, direct TCP socket access, TLS certificate authentication, security implications
- `docs/research/2026-11-03-linux-support-tauri.md` — Tauri compatibility with Linux (GTK dependencies, systemd, Docker socket permissions)
- `docs/research/2026-11-03-onboarding-tour-ux.md` — Onboarding tour patterns, guided walkthroughs, skip/continue/done flows, first-run vs re-entry
- `docs/research/2026-11-03-localization-i18n.md` — i18n frameworks (i18next, formatJS), language detection, translation management, RTL support considerations
- `docs/research/2026-11-03-doctor-extensions-http-probes.md` — HTTP probe implementation, "connection refused" detection, "connect all to a network" action, doctor extension architecture

## Current State

- Image management exists (list images, inspect, remove)
- Docker Hub registry is configured (basic pull/push)
- AWS ECR credential helper is partially implemented (W2)
- No image build functionality exists
- No GHCR or private registry support beyond Docker Hub
- No lazydocker integration
- No in-app terminal
- No remote Docker host support
- No Linux support (macOS only)
- No onboarding tour
- No localization (English only)
- Doctor checks basic container health but no HTTP probes
- No "connection refused" link from health-check output
- No "connect all to a network" action

## Design

### 1. Image Build and Push

```typescript
// src/components/ImageBuildPanel.tsx

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface BuildOptions {
  dockerfilePath: string;
  imageName: string;
  tag: string;
  registry?: string;
  pushAfterBuild: boolean;
  buildArgs: Record<string, string>;
}

export function ImageBuildPanel() {
  const [options, setOptions] = useState<BuildOptions>({
    dockerfilePath: "",
    imageName: "",
    tag: "latest",
    pushAfterBuild: false,
    buildArgs: {},
  });
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);

  const handleBuild = async () => {
    setBuilding(true);
    setProgress([]);

    try {
      // Stream build output via Tauri event
      const unsubscribe = listen("build-progress", (event) => {
        setProgress(prev => [...prev, event.payload]);
      });

      await invoke("build_image", {
        dockerfilePath: options.dockerfilePath,
        imageName: options.imageName,
        tag: options.tag,
        buildArgs: Object.entries(options.buildArgs).map(
          ([key, value]) => ({ key, value })
        ),
      });

      if (options.pushAfterBuild && options.registry) {
        await invoke("push_image", {
          imageName: options.imageName,
          tag: options.tag,
          registry: options.registry,
        });
      }
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="image-build-panel">
      <h2>Build Image</h2>
      <label>
        Dockerfile Path:
        <input
          type="text"
          value={options.dockerfilePath}
          onChange={e => setOptions(prev => ({ ...prev, dockerfilePath: e.target.value }))}
          placeholder="/path/to/Dockerfile"
        />
      </label>
      <label>
        Image Name:
        <input
          type="text"
          value={options.imageName}
          onChange={e => setOptions(prev => ({ ...prev, imageName: e.target.value }))}
          placeholder="myapp"
        />
      </label>
      <label>
        Tag:
        <input
          type="text"
          value={options.tag}
          onChange={e => setOptions(prev => ({ ...prev, tag: e.target.value }))}
          placeholder="latest"
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={options.pushAfterBuild}
          onChange={e => setOptions(prev => ({ ...prev, pushAfterBuild: e.target.checked }))}
        />
        Push to registry after build
      </label>
      {options.pushAfterBuild && (
        <label>
          Registry:
          <select
            value={options.registry}
            onChange={e => setOptions(prev => ({ ...prev, registry: e.target.value }))}
          >
            <option value="">Select registry...</option>
            <option value="dockerhub">Docker Hub</option>
            <option value="ghcr">GitHub Container Registry</option>
            <option value="ecr">AWS ECR</option>
          </select>
        </label>
      )}
      <button onClick={handleBuild} disabled={building}>
        {building ? "Building..." : "Build Image"}
      </button>
      {progress.length > 0 && (
        <OutputLog headline="Build Output" rawOutput={progress.join("\n")} />
      )}
    </div>
  );
}
```

Backend (Rust):

```rust
// src-tauri/src/commands/image_build.rs

#[derive(serde::Deserialize)]
struct BuildArg {
    key: String,
    value: String,
}

#[derive(serde::Deserialize)]
struct BuildImageInput {
    dockerfile_path: String,
    image_name: String,
    tag: String,
    build_args: Vec<BuildArg>,
}

#[tauri::command]
async fn build_image(input: BuildImageInput) -> Result<String> {
    // Build the docker build command with typed args
    let mut args = vec!["build", "-t", &format!("{}:{}", input.image_name, input.tag)];
    
    for arg in &input.build_args {
        args.extend(["--build-arg", &format!("{}={}", arg.key, arg.value)]);
    }
    
    args.push("-f");
    args.push(&input.dockerfile_path);
    args.push(".");
    
    // Stream output via event emitter
    let app = tauri::AppHandle::current();
    execute_docker_stream("docker", &args, |line| {
        app.emit("build-progress", line);
    }).await?;
    
    Ok(format!("{}:{}", input.image_name, input.tag))
}

#[derive(serde::Deserialize)]
struct PushImageInput {
    image_name: String,
    tag: String,
    registry: String,
}

#[tauri::command]
async fn push_image(input: PushImageInput) -> Result<()> {
    let mut args = vec!["push"];
    
    // Tag the image with registry if needed
    let tagged_name = match input.registry.as_str() {
        "ghcr" => format!("ghcr.io/{}/{}:{}", /* repo info */, input.image_name, input.tag),
        "ecr" => format!("{}.dkr.ecr.{}.amazonaws.com/{}:{}", /* ECR URI */, /* region */, input.image_name, input.tag),
        _ => format!("{}/{}:{}", "docker.io", input.image_name, input.tag),
    };
    args.push(&tagged_name);
    
    execute_docker_command("docker", &args).await?;
    Ok(())
}
```

### 2. Registry Credentials (Credential Helpers)

```rust
// src-tauri/src/commands/registries.rs

#[derive(serde::Deserialize)]
struct RegistryConfig {
    registry: String,
    credentials: RegistryCredentials,
}

#[derive(serde::Deserialize)]
struct RegistryCredentials {
    username: String,
    token: String,  // Personal access token, not password
}

#[tauri::command]
async fn configure_registry(config: RegistryConfig) -> Result<()> {
    // Store credentials securely (macOS Keychain via tauri-plugin-secret-store)
    let keychain = tauri_plugin_secret_store::SecretStore::default();
    keychain.set(&config.registry, &config.credentials.token).await?;
    Ok(())
}

#[tauri::command]
async fn get_registry_credentials(registry: String) -> Result<Option<RegistryCredentials>> {
    let keychain = tauri_plugin_secret_store::SecretStore::default();
    match keychain.get(&registry).await {
        Ok(Some(token)) => Ok(Some(RegistryCredentials {
            username: "token".to_string(),  // GHCR uses "token" as username
            token,
        })),
        Ok(None) => Ok(None),
        Err(e) => Err(e.into()),
    }
}
```

### 3. In-App Terminal (pty + xterm.js)

```typescript
// src/components/ContainerTerminal.tsx

import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebglAddon } from "xterm-addon-webgl";
import { invoke, listen } from "@tauri-apps/api/core";

export function ContainerTerminal({ containerId }: { containerId: string }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const ptyRef = useRef<number | null>(null);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "Menlo, Monaco, Courier New, monospace",
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebglAddon());

    term.open(terminalRef.current!);
    fitAddon.fit();

    termRef.current = term;

    // Resize handler
    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(terminalRef.current!);

    return () => {
      resizeObserver.disconnect();
      if (ptyRef.current !== null) {
        // Close the pty when component unmounts
      }
      term.dispose();
    };
  }, []);

  const attachTerminal = async () => {
    if (!termRef.current) return;

    // Open a pty for the container's shell
    const ptyId = await invoke("open_container_pty", {
      containerId,
      shell: "/bin/sh",  // Default shell; allow user to change
    });

    ptyRef.current = Number(ptyId);

    // Write user input to the pty
    termRef.current.onData((data) => {
      invoke("pty_write", { ptyId: ptyRef.current!, data });
    });

    // Read output from the pty
    listen("pty_output", (event) => {
      if (Number(event.payload.ptyId) === ptyRef.current) {
        termRef.current!.write(event.payload.data);
      }
    });
  };

  return (
    <div className="container-terminal">
      <div ref={terminalRef} />
      <button onClick={attachTerminal}>Attach Terminal</button>
    </div>
  );
}
```

Backend (Rust):

```rust
// src-tauri/src/commands/terminal.rs

use async_std::os::unix::net::UnixStream;
use std::io::{Read, Write};
use tokio::sync::Mutex;

// Map of ptyId -> PtyHandle
static PTYS: Mutex<std::collections::HashMap<u32, PtyHandle>> = Mutex::const_new(std::collections::HashMap::new());

struct PtyHandle {
    pid: i32,
    fd: i32,  // File descriptor for the pty slave
}

#[tauri::command]
async fn open_container_pty(container_id: String, shell: String) -> Result<u32> {
    // Create a pty using libc::posix_openpt or similar
    // This is platform-specific and requires careful error handling
    
    // For macOS: use posix_openpt(O_RDWR | O_NOCTTY | O_CLOEXEC)
    // Then fork/exec the container's shell in the pty
    
    // This is a simplified sketch — actual implementation requires:
    // 1. Opening a pty master/slave pair
    // 2. Forking and exec-ing the container's shell in the slave
    // 3. Attaching the slave to the container's stdin/stdout/stderr
    // 4. Returning the pty file descriptor
    
    // NOTE: This is the hardest part of this iteration.
    // Tauri does not have a built-in pty plugin.
    // Options:
    // 1. Write a custom Tauri plugin in Rust (recommended)
    // 2. Use a helper process that manages ptys and communicates via IPC
    // 3. Use an existing library (e.g., `libutil.rs` or `pty` crate)
    
    // For now, return an error indicating this feature requires a custom plugin
    Err("In-app terminal requires a custom Tauri pty plugin. See research note.".into())
}

#[tauri::command]
async fn pty_write(pty_id: u32, data: String) -> Result<()> {
    let ptys = PTYS.lock().await;
    let pty = ptys.get(&pty_id).ok_or("PTY not found")?;
    // Write data to the pty master file descriptor
    Ok(())
}
```

### 4. Remote Docker Hosts

```typescript
// src/components/RemoteHostConfig.tsx

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface RemoteHost {
  id: string;
  name: string;
  host: string;  // e.g., "docker.example.com" or "ssh://user@host"
  port: number;  // 2375 (unencrypted) or 2376 (TLS)
  tlsEnabled: boolean;
  certificatePath?: string;
  keyPath?: string;
  caCertPath?: string;
}

export function RemoteHostConfig() {
  const [hosts, setHosts] = useState<RemoteHost[]>([]);
  const [showForm, setShowForm] = useState(false);

  const handleAddHost = async (host: Omit<RemoteHost, "id">) => {
    const id = await invoke("add_remote_host", { host });
    setHosts(prev => [...prev, { ...host, id }]);
  };

  const handleTestConnection = async (hostId: string) => {
    try {
      await invoke("test_remote_connection", { hostId });
      // Success: show green status
    } catch (e) {
      // Error: show red status with error message
    }
  };

  return (
    <div className="remote-host-config">
      <h2>Remote Docker Hosts</h2>
      <button onClick={() => setShowForm(true)}>Add Remote Host</button>
      {showForm && <RemoteHostForm onSubmit={handleAddHost} />}
      <ul>
        {hosts.map(host => (
          <li key={host.id}>
            <span>{host.name} ({host.host}:{host.port})</span>
            <button onClick={() => handleTestConnection(host.id)}>Test Connection</button>
            <button onClick={() => removeHost(host.id)}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 5. Doctor Extensions (W14)

```typescript
// src/components/DoctorExtensions.tsx

import { invoke } from "@tauri-apps/api/core";

interface HealthCheckResult {
  containerId: string;
  status: "healthy" | "unhealthy" | "starting" | "unknown";
  output: string;
  issues: string[];
}

export function DoctorExtensions() {
  const [results, setResults] = useState<HealthCheckResult[]>([]);

  const runHealthChecks = async () => {
    const containerIds = await invoke("get_all_container_ids");
    const results = await Promise.all(
      containerIds.map((id: string) => invoke("http_probe", { containerId: id }))
    );
    setResults(results as HealthCheckResult[]);
  };

  const connectToNetwork = async (containerIds: string[], networkId: string) => {
    await invoke("connect_containers_to_network", {
      containerIds,
      networkId,
    });
  };

  return (
    <div className="doctor-extensions">
      <h2>Doctor Extensions</h2>
      <button onClick={runHealthChecks}>Run HTTP Probes</button>
      <ul>
        {results.map(result => (
          <li key={result.containerId}>
            <span>{result.containerId}</span>
            <span className={`status ${result.status}`}>{result.status}</span>
            {result.issues.includes("connection refused") && (
              <button onClick={() => showNetworkOptions(result.containerId)}>
                Connect to Network
              </button>
            )}
            <OutputLog headline={`HTTP Response: ${result.containerId}`} rawOutput={result.output} />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 6. Onboarding Tour

```typescript
// src/components/OnboardingTour.tsx

import { useState, useEffect } from "react";
import { store } from "@tauri-apps/plugin-store";

interface TourStep {
  title: string;
  description: string;
  targetSelector: string;  // CSS selector for the element to highlight
  position: "above" | "below" | "left" | "right";
}

const STEPS: TourStep[] = [
  {
    title: "Welcome to Colima UI",
    description: "This is your Docker management dashboard. Let me show you the key features.",
    targetSelector: ".sidebar",
    position: "right",
  },
  {
    title: "Your Containers",
    description: "Here you can see all running and stopped containers. Click on any container to view details.",
    targetSelector: ".container-list",
    position: "below",
  },
  {
    title: "Command Palette",
    description: "Press ⌘K to open the command palette for keyboard-first navigation.",
    targetSelector: ".command-palette-trigger",
    position: "below",
  },
  {
    title: "Doctor Checks",
    description: "The doctor section shows health checks for your containers and suggests fixes.",
    targetSelector: ".doctor-section",
    position: "left",
  },
  {
    title: "You're All Set!",
    description: "Explore the app or start Colima to begin managing your containers.",
    targetSelector: ".start-colima-button",
    position: "above",
  },
];

export function OnboardingTour() {
  const [currentStep, setCurrentStep] = useState(0);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    async function checkTour() {
      const storeFile = await store("app-store.json");
      const tourCompleted = await storeFile.get<boolean>("tourCompleted");
      if (!tourCompleted) {
        setShowTour(true);
      }
    }
    checkTour();
  }, []);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      finishTour();
    }
  };

  const finishTour = async () => {
    const storeFile = await store("app-store.json");
    await storeFile.set("tourCompleted", true);
    await storeFile.save();
    setShowTour(false);
  };

  if (!showTour) return null;

  const step = STEPS[currentStep];

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-tooltip" data-position={step.position}>
        <h3>{step.title}</h3>
        <p>{step.description}</p>
        <div className="onboarding-actions">
          <button onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))} disabled={currentStep === 0}>
            Back
          </button>
          <button onClick={handleNext}>
            {currentStep < STEPS.length - 1 ? "Next" : "Get Started"}
          </button>
          <button onClick={finishTour} className="skip">Skip</button>
        </div>
        <div className="step-indicator">
          {STEPS.map((_, i) => (
            <span key={i} className={i === currentStep ? "active" : ""} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 7. Localization (i18n)

```typescript
// i18n configuration (using i18next)

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      pt: { translation: ptTranslations },
      de: { translation: deTranslations },
      ja: { translation: jaTranslations },
    },
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,  // React already escapes
    },
  });

export default i18n;
```

Example translation file (`en.ts`):

```typescript
export const enTranslations = {
  "containers.title": "Containers",
  "containers.running": "Running",
  "containers.stopped": "Stopped",
  "containers.start": "Start",
  "containers.stop": "Stop",
  "containers.restart": "Restart",
  "containers.logs": "View Logs",
  "doctor.healthCheck": "Health Check",
  "doctor.connectionRefused": "Connection Refused — Connect to Network",
  "onboarding.welcome": "Welcome to Colima UI",
  "onboarding.skip": "Skip",
  "onboarding.next": "Next",
  "onboarding.getStarted": "Get Started",
};
```

### 8. Acceptance Criteria

- [ ] Users can build images from Dockerfiles and push to Docker Hub, GHCR, or AWS ECR
- [ ] Private registries work with credential helpers (GHCR tokens, Docker Hub tokens, AWS ECR credential helper)
- [ ] "Open in lazydocker" is documented in a research note (integration may be deferred if lazydocker cannot connect to Colima's socket)
- [ ] In-app terminal allows interactive shell access to running containers (pty + xterm.js)
- [ ] Remote Docker hosts can be configured via SSH or TLS
- [ ] The app builds and runs on Linux (GTK dependencies installed)
- [ ] First-time users see a guided onboarding tour (can be skipped)
- [ ] The app supports at least 4 languages (en, pt, de, ja) with auto-detection
- [ ] Doctor extensions perform HTTP probes on containers
- [ ] "Connection refused" health-check output includes a "Connect to Network" link
- [ ] "Connect all to a network" action connects multiple containers to a specified network
- [ ] All existing features remain functional after adding these features

### 9. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| In-app terminal (pty) requires a custom Tauri plugin — no existing plugin | High | Write a custom plugin in Rust; use `posix_openpt` on macOS; test thoroughly |
| lazydocker may not support Colima's Docker socket configuration | Medium | Research first; if incompatible, skip or provide a manual setup guide |
| Remote Docker over TLS requires certificate management | High | Provide a simple certificate upload UI; document the process in a research note |
| Linux support requires GTK dependencies that may not be present | Medium | Document dependencies in README; provide a setup script |
| i18n adds translation maintenance overhead | Medium | Start with 4 languages; use community translations where possible |
| Onboarding tour may overwhelm new users | Low | Make it skippable; allow re-entry from settings |
| Multiple registries increase credential management complexity | Medium | Use OS keychain (macOS Keychain, Linux keyring) for secure storage |

### 10. Open Questions

- Should the in-app terminal support multiple tabs (one per container)? (Proposal: yes, but only one tab per container; multiple tabs for the same container show the same session)
- Should lazydocker integration be a button that opens lazydocker externally, or embed it? (Proposal: external button only — lazydocker is a separate TUI app)
- Should remote hosts be configured per-project or globally? (Proposal: globally — hosts are app-wide, not project-specific)
- Should the onboarding tour run every time, or only on first launch? (Proposal: only on first launch; can be re-triggered from settings)
- Should localization include RTL languages (Arabic, Hebrew)? (Proposal: no, not for this iteration; add if there is demand)
- Should the doctor's "connect all to a network" action be a one-click action or a confirmation dialog? (Proposal: confirmation dialog — connecting containers to a network is a significant action)
- Should credential helpers be configured per-registry or globally? (Proposal: per-registry — each registry may have different authentication requirements)
- Should the app suggest registries based on the image name (e.g., "myapp" → Docker Hub, "ghcr.io/myapp" → GHCR)? (Proposal: no, let the user choose the registry explicitly)