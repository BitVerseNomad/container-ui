# Multi-Runtime + AI Redesign — Implementation Plan (Phase 0–3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create runtime abstraction layer, extract Colima logic into ColimaAdapter, add runtime registry with auto-detection, implement OrbStackAdapter.

**Architecture:** Runtime adapter pattern — each runtime implements `RuntimeAdapter` interface. Guidance core stays runtime-agnostic. ColimaAdapter wraps existing Tauri commands. OrbStackAdapter uses `orb` CLI and Docker contexts.

**Tech Stack:** Tauri 2, Rust, React 18 + TypeScript, Vite, Vitest, existing test patterns.

**Spec:** `docs/superpowers/specs/2026-11-04-multi-runtime-ai-redesign.md`

## Global Constraints

- **Stack:** Tauri 2, Rust 1.99.1, Node 22.6+, Vite 5.4 — keep existing
- **Backwards compatibility:** Existing Colima users must not lose functionality
- **Test-first:** Write failing test, implement minimal code, verify pass, commit
- **TypeScript strict mode:** No `any`, explicit return types on public APIs
- **Runtime detection:** Auto-detect via CLI presence + Docker contexts
- **Branch:** `feat/multi-runtime-ai` from `integration`

## Review Focus

| Input/Condition | Expected Behavior | Test |
|-----------------|-------------------|------|
| Multiple runtimes installed | App detects all; user can switch; each works independently | Integration test with mocked Colima + OrbStack |
| No runtime installed | Onboarding guides to install one (Colima recommended) | E2E test with all `isAvailable()` returning false |
| Docker context mismatch | App uses correct context per runtime/profile; no cross-contamination | Unit test: adapter.getDockerContext() returns expected string |
| ColimaAdapter parity | All existing Colima functionality works through adapter | All 79 UI tests + 135 Rust tests pass |
| Type safety | No runtime type errors; adapters implement full interface | `tsc --noEmit` passes |

---

### Task 0: Create branch and scaffold runtime directory structure

**Files:**
- Create: `src/runtime/types.ts`
- Create: `src/runtime/index.ts`
- Create: `src/runtime/colima-adapter.ts`
- Create: `src/runtime/orbstack-adapter.ts`
- Create: `src/runtime/rancher-adapter.ts`
- Create: `src/runtime/podman-adapter.ts`
- Create: `src/runtime/docker-desktop-adapter.ts`

**Interfaces:**
- Produces: `RuntimeAdapter` interface, `RuntimeRegistry` class, adapter stubs

- [ ] **Step 1: Create branch `feat/multi-runtime-ai` from `integration`**
```bash
git checkout integration
git checkout -b feat/multi-runtime-ai
```

- [ ] **Step 2: Create runtime directory and types.ts with RuntimeAdapter interface**
```bash
mkdir -p src/runtime
```
Write `src/runtime/types.ts` with exact interface from spec (lines 104-129).

- [ ] **Step 3: Create adapter stubs (all returning not-implemented)**
Each adapter file exports class implementing `RuntimeAdapter` with methods throwing `Error("Not implemented")`.

- [ ] **Step 4: Create index.ts with RuntimeRegistry**
```typescript
// src/runtime/index.ts
import { RuntimeAdapter } from "./types";
import { ColimaAdapter } from "./colima-adapter";
import { OrbStackAdapter } from "./orbstack-adapter";
// ... other adapters

export class RuntimeRegistry {
  private adapters: Map<string, RuntimeAdapter> = new Map();
  private activeAdapter: RuntimeAdapter | null = null;

  register(adapter: RuntimeAdapter) { this.adapters.set(adapter.id, adapter); }
  get(id: string) { return this.adapters.get(id); }
  getAll() { return Array.from(this.adapters.values()); }
  async detectAvailable(): Promise<RuntimeAdapter[]> { ... }
  setActive(adapter: RuntimeAdapter) { this.activeAdapter = adapter; }
  getActive() { return this.activeAdapter; }
}

export const runtimeRegistry = new RuntimeRegistry();
runtimeRegistry.register(new ColimaAdapter());
runtimeRegistry.register(new OrbStackAdapter());
// ... register others
```

- [ ] **Step 5: Run TypeScript check**
```bash
npx tsc --noEmit
```
Expected: PASS (stubs compile)

- [ ] **Step 6: Commit**
```bash
git add src/runtime/
git commit -m "feat: scaffold runtime adapter layer (types, registry, stubs)"
```

---

### Task 1: Implement ColimaAdapter with existing Tauri commands

**Files:**
- Modify: `src/runtime/colima-adapter.ts`
- Modify: `src/runtime/types.ts` (add Profile, StartOpts, ResourceOpts, Diagnostics types if missing)
- Test: `src/runtime/colima-adapter.test.ts`

**Interfaces:**
- Consumes: Tauri `invoke` from `@tauri-apps/api/core`, existing commands: `list_profiles`, `start_profile`, `stop_profile`, `apply_resources`, `delete_profile`, `colima_config`, `docker`, `network_facts`, `host_resources`
- Produces: Fully working `ColimaAdapter` implementing `RuntimeAdapter`

- [ ] **Step 1: Write failing test for ColimaAdapter**
Create `src/runtime/colima-adapter.test.ts`:
```typescript
import { ColimaAdapter } from "./colima-adapter";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("ColimaAdapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("isAvailable returns true when colima_version succeeds", async () => {
    (invoke as any).mockResolvedValue("0.10.1");
    const adapter = new ColimaAdapter();
    await expect(adapter.isAvailable()).resolves.toBe(true);
  });

  it("isAvailable returns false when colima_version fails", async () => {
    (invoke as any).mockRejectedValue(new Error("not found"));
    const adapter = new ColimaAdapter();
    await expect(adapter.isAvailable()).resolves.toBe(false);
  });

  it("listProfiles calls list_profiles", async () => {
    const mockProfiles = [{ name: "default", status: "Running", ... }];
    (invoke as any).mockResolvedValue(mockProfiles);
    const adapter = new ColimaAdapter();
    await expect(adapter.listProfiles()).resolves.toEqual(mockProfiles);
  });

  it("getDockerContext returns correct context string", () => {
    const adapter = new ColimaAdapter();
    expect(adapter.getDockerContext("default")).toBe("colima");
    expect(adapter.getDockerContext("work")).toBe("colima-work");
  });

  it("hasKubernetes returns true", () => {
    const adapter = new ColimaAdapter();
    expect(adapter.hasKubernetes()).toBe(true);
  });

  it("getKubeContext returns correct context", () => {
    const adapter = new ColimaAdapter();
    expect(adapter.getKubeContext("default")).toBe("colima");
    expect(adapter.getKubeContext("work")).toBe("colima-work");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
```bash
npm test -- src/runtime/colima-adapter.test.ts
```
Expected: FAIL (methods not implemented)

- [ ] **Step 3: Implement ColimaAdapter in colima-adapter.ts**
Map each interface method to existing Tauri command:
- `isAvailable()` → `invoke("colima_version")` (add new Rust command) OR try `list_profiles`
- `listProfiles()` → `invoke("list_profiles")`
- `startProfile(opts)` → `invoke("start_profile", { opts })`
- `stopProfile(name)` → `invoke("stop_profile", { name })`
- `applyResources(name, opts)` → `invoke("apply_resources", { name, opts, restart: true })`
- `deleteProfile(name)` → `invoke("delete_profile", { name })`
- `getDockerContext(profileName)` → `profileName === "default" ? "colima" : \`colima-${profileName}\``
- `hasKubernetes()` → `true`
- `getKubeContext(profileName)` → same as docker context
- `getDiagnostics()` → `invoke("host_resources")` + `invoke("network_facts")` + `invoke("colima_config", { name })`

- [ ] **Step 4: Add `colima_version` Rust command if needed**
In `src-tauri/src/main.rs`:
```rust
#[tauri::command]
async fn colima_version() -> Result<String, String> {
    Command::new("colima").arg("version").output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .map_err(|e| e.to_string())
}
```
Register in `tauri::generate_handler![]`.

- [ ] **Step 5: Run test to verify it passes**
```bash
npm test -- src/runtime/colima-adapter.test.ts
```
Expected: PASS

- [ ] **Step 6: Run full test suite**
```bash
npm test && cd src-tauri && cargo test
```
Expected: All 79 UI + 586 logic + 135 Rust tests pass

- [ ] **Step 7: Commit**
```bash
git add src/runtime/colima-adapter.ts src/runtime/colima-adapter.test.ts src-tauri/src/main.rs
git commit -m "feat: implement ColimaAdapter wrapping existing Tauri commands"
```

---

### Task 2: RuntimeRegistry auto-detection and UI selector

**Files:**
- Modify: `src/runtime/index.ts`
- Modify: `src/runtime/types.ts` (add `RuntimeInfo` type)
- Create: `src/runtime/runtime-registry.test.ts`
- Modify: `src/Shell.tsx` (add runtime selector to sidebar)
- Modify: `src/App.tsx` (provide runtime registry context)

**Interfaces:**
- Consumes: All adapter `isAvailable()` methods
- Produces: `RuntimeRegistry.detectAvailable()`, UI integration

- [ ] **Step 1: Write failing test for RuntimeRegistry**
Create `src/runtime/runtime-registry.test.ts`:
```typescript
import { RuntimeRegistry } from "./index";
import { ColimaAdapter } from "./colima-adapter";
import { OrbStackAdapter } from "./orbstack-adapter";

vi.mock("./colima-adapter");
vi.mock("./orbstack-adapter");

describe("RuntimeRegistry", () => {
  it("detectAvailable returns only available adapters", async () => {
    const mockColima = { isAvailable: vi.fn().mockResolvedValue(true), id: "colima" };
    const mockOrbStack = { isAvailable: vi.fn().mockResolvedValue(false), id: "orbstack" };
    (ColimaAdapter as any).mockImplementation(() => mockColima);
    (OrbStackAdapter as any).mockImplementation(() => mockOrbStack);

    const registry = new RuntimeRegistry();
    registry.register(mockColima);
    registry.register(mockOrbStack);

    const available = await registry.detectAvailable();
    expect(available).toHaveLength(1);
    expect(available[0].id).toBe("colima");
  });

  it("setActive/getActive works", () => {
    const registry = new RuntimeRegistry();
    const adapter = { id: "colima" } as any;
    registry.setActive(adapter);
    expect(registry.getActive()).toBe(adapter);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
```bash
npm test -- src/runtime/runtime-registry.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement detectAvailable in index.ts**
```typescript
async detectAvailable(): Promise<RuntimeAdapter[]> {
  const results = await Promise.all(
    this.getAll().map(async (a) => ({ adapter: a, available: await a.isAvailable() }))
  );
  return results.filter(r => r.available).map(r => r.adapter);
}
```

- [ ] **Step 4: Add runtime selector to Shell.tsx**
Add dropdown in sidebar header showing available runtimes, with active runtime highlighted. On change: `runtimeRegistry.setActive(selected)`, trigger app reload of profiles/containers.

- [ ] **Step 5: Wire App.tsx to use active adapter**
In `App.tsx`, use `runtimeRegistry.getActive()` to get current adapter, pass to child components via context or props. Replace direct Colima calls with adapter calls.

- [ ] **Step 6: Run tests**
```bash
npm test -- src/runtime/runtime-registry.test.ts
npm test
```
Expected: PASS

- [ ] **Step 7: Commit**
```bash
git add src/runtime/index.ts src/runtime/runtime-registry.test.ts src/Shell.tsx src/App.tsx
git commit -m "feat: runtime registry with auto-detection and UI selector"
```

---

### Task 3: Implement OrbStackAdapter

**Files:**
- Modify: `src/runtime/orbstack-adapter.ts`
- Create: `src/runtime/orbstack-adapter.test.ts`
- Modify: `src-tauri/src/main.rs` (add `orb_version`, `orb_list_vms`, `orb_start_vm`, `orb_stop_vm` commands)

**Interfaces:**
- Consumes: New Tauri commands for OrbStack CLI, Docker context `orbstack`
- Produces: Working `OrbStackAdapter` implementing `RuntimeAdapter`

- [ ] **Step 1: Write failing test for OrbStackAdapter**
Create `src/runtime/orbstack-adapter.test.ts`:
```typescript
import { OrbStackAdapter } from "./orbstack-adapter";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("OrbStackAdapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("isAvailable returns true when orb_version succeeds", async () => {
    (invoke as any).mockResolvedValue("1.0.0");
    const adapter = new OrbStackAdapter();
    await expect(adapter.isAvailable()).resolves.toBe(true);
  });

  it("getDockerContext returns orbstack", () => {
    const adapter = new OrbStackAdapter();
    expect(adapter.getDockerContext("default")).toBe("orbstack");
  });

  it("hasKubernetes returns true (OrbStack includes k3s)", () => {
    const adapter = new OrbStackAdapter();
    expect(adapter.hasKubernetes()).toBe(true);
  });

  it("listProfiles calls orb_list_vms", async () => {
    const mockVMs = [{ name: "orb", status: "Running", cpus: 4, memory: 8, disk: 60 }];
    (invoke as any).mockResolvedValue(mockVMs);
    const adapter = new OrbStackAdapter();
    await expect(adapter.listProfiles()).resolves.toEqual(mockVMs);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
```bash
npm test -- src/runtime/orbstack-adapter.test.ts
```
Expected: FAIL

- [ ] **Step 3: Add Rust commands for OrbStack**
In `src-tauri/src/main.rs`:
```rust
#[tauri::command]
async fn orb_version() -> Result<String, String> {
    Command::new("orb").arg("version").output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn orb_list_vms() -> Result<Vec<Profile>, String> {
    // parse `orb list --format json` output into Profile structs
}

#[tauri::command]
async fn orb_start_vm(name: String) -> Result<(), String> {
    Command::new("orb").args(["start", &name]).status()
        .map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn orb_stop_vm(name: String) -> Result<(), String> {
    Command::new("orb").args(["stop", &name]).status()
        .map(|_| ()).map_err(|e| e.to_string())
}
```
Register all in `tauri::generate_handler![]`.

- [ ] **Step 4: Implement OrbStackAdapter**
Map methods to new Tauri commands:
- `isAvailable()` → `invoke("orb_version")`
- `listProfiles()` → `invoke("orb_list_vms")`
- `startProfile(opts)` → `invoke("orb_start_vm", { name: opts.name })` (OrbStack VMs have fixed resources)
- `stopProfile(name)` → `invoke("orb_stop_vm", { name })`
- `applyResources()` → Not supported (OrbStack VMs recreate) — throw `Error("Not supported")`
- `deleteProfile(name)` → `invoke("orb_delete_vm", { name })` (add command)
- `getDockerContext()` → `"orbstack"`
- `hasKubernetes()` → `true`
- `getKubeContext()` → `"orbstack"`
- `getDiagnostics()` → `invoke("host_resources")` + custom OrbStack diagnostics

- [ ] **Step 5: Run test to verify it passes**
```bash
npm test -- src/runtime/orbstack-adapter.test.ts
```
Expected: PASS

- [ ] **Step 6: Run full test suite**
```bash
npm test && cd src-tauri && cargo test
```
Expected: All tests pass

- [ ] **Step 7: Commit**
```bash
git add src/runtime/orbstack-adapter.ts src/runtime/orbstack-adapter.test.ts src-tauri/src/main.rs
git commit -m "feat: implement OrbStackAdapter with orb CLI integration"
```

---

### Task 4: Add remaining adapter stubs (Rancher, Podman, Docker Desktop) — minimal

**Files:**
- Modify: `src/runtime/rancher-adapter.ts`
- Modify: `src/runtime/podman-adapter.ts`
- Modify: `src/runtime/docker-desktop-adapter.ts`
- Create: Basic tests for each

**Interfaces:**
- Produces: Stubs that implement interface but return `isAvailable: false` until Rust commands added

- [ ] **Step 1: Implement minimal stubs**
Each adapter:
- `isAvailable()` → check for CLI (`rdctl`, `podman`, `docker`) + Docker context
- Other methods → throw `Error("Not yet implemented")`
- `getDockerContext()` → `"rancher-desktop"`, `"podman"`, `"desktop-linux"`

- [ ] **Step 2: Add basic tests (isAvailable only)**
```typescript
it("isAvailable checks for rdctl", async () => {
  (invoke as any).mockResolvedValue("1.0.0");
  await expect(new RancherAdapter().isAvailable()).resolves.toBe(true);
});
```

- [ ] **Step 3: Run tests**
```bash
npm test -- src/runtime/*-adapter.test.ts
```
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add src/runtime/rancher-adapter.ts src/runtime/podman-adapter.ts src/runtime/docker-desktop-adapter.ts
git commit -m "feat: add Rancher, Podman, Docker Desktop adapter stubs"
```

---

### Task 5: Integration verification and docs update

**Files:**
- Modify: `docs/superpowers/plans/2026-11-04-multi-runtime-ai.md` (mark Phase 0-3 complete)
- Modify: `README.md` (note multi-runtime support)

- [ ] **Step 1: Manual verification on Mac with Colima + OrbStack**
```bash
npm run tauri dev
```
- Verify runtime selector shows both
- Switch runtimes, verify profiles/containers load correctly
- Verify Doctor, Connection Doctor work with both

- [ ] **Step 2: Run all tests**
```bash
npm test && cd src-tauri && cargo test
```
Expected: 79 UI + 586 logic + 135 Rust = PASS

- [ ] **Step 3: TypeScript strict check**
```bash
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add -A
git commit -m "chore: Phase 0-3 complete — runtime abstraction layer with Colima + OrbStack"
```

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-11-04-multi-runtime-ai.md`. Please review the plan. Which execution approach would you prefer?**

- **Subagent-driven** - A fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native** - I implement every task myself in this session, the way this harness runs work, then one fresh reviewer on the most capable model checks the whole branch. Cheapest and fastest; no independent review until the end. Runs well with a mid-tier session model, since the plan carries the design.

**For this plan I recommend Subagent-driven**, because the tasks have clear interfaces between them (adapter interface, registry, Tauri commands) and a shipped mistake in runtime switching would break Colima workflows for existing users.