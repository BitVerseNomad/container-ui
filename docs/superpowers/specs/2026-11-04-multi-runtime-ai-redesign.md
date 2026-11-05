# Multi-Runtime + AI Redesign — Design Doc

> **Status:** Draft for approval  
> **Branch:** New branch from `integration` (recommend `feat/multi-runtime-ai`)  
> **Goal:** Evolve Colima UI from Colima-only to multi-runtime (Colima, OrbStack, Rancher Desktop, Podman Desktop, Docker Desktop) with AI-assisted guidance, using free models via OpenRouter. Design inspired by Google Material 3, Apple HIG, Tesla — simplicity, 80/20 rule.

---

## 1. Intent & Why

**Current state:** App is tightly coupled to Colima (Rust backend calls `colima` CLI, Docker contexts named `colima-*`, profiles map 1:1 to Colima VMs).

**Problem:** Users want choice. OrbStack is faster, Rancher Desktop includes k3s, Podman Desktop is rootless, Docker Desktop is familiar. The guidance layer (Doctor, Connection Doctor, guided Run, Fix suggestions) is the unique value — it should work regardless of runtime.

**Opportunity:** Extract runtime-agnostic guidance core. Add AI-assisted troubleshooting (free models via OpenRouter). Clean repo structure. Ship via Homebrew + GitHub Releases.

---

## 2. Goals / Non-Goals / Anti-Goals

| Goals | Non-Goals | Anti-Goals |
|-------|-----------|------------|
| Runtime abstraction: Colima, OrbStack, Rancher, Podman, Docker Desktop | Build a new container runtime | Replace Colima/OrbStack/etc. |
| AI-assisted troubleshooting (OpenRouter free models) | Train custom models | Send user data to AI without consent |
| Clean repo: remove dead code, consolidate docs | Rewrite UI from scratch | Break existing Colima workflows |
| Homebrew tap + GitHub Releases distribution | Mac App Store | Unsigned/notarized builds |
| Design system: Material 3 + HIG + Tesla principles | Custom design language | Inconsistent UI patterns |

---

## 3. Constraints

- **Stack:** Tauri 2, Rust, React 18 + TS, Vite — keep
- **Runtime detection:** Auto-detect available runtimes on Mac
- **Docker contexts:** Each runtime registers its own context(s); app discovers via `docker context ls`
- **AI:** OpenRouter free tier (models: `meta-llama/llama-3.1-8b-instruct:free`, `google/gemma-2-9b-it:free`, `microsoft/phi-3-mini-128k-instruct:free`)
- **Privacy:** AI runs locally (Ollama) OR user opts in to OpenRouter; no data sent without explicit consent
- **Distribution:** Homebrew cask + GitHub Releases; Apple Developer Program required for notarization
- **Backwards compatibility:** Existing Colima users must not lose functionality

---

## 4. Approaches Considered

| Approach | Trade-offs | Decision |
|----------|------------|----------|
| **A. Runtime adapter pattern** (recommended) | Clean abstraction; each runtime = adapter implementing common interface; guidance core unchanged | ✅ |
| B. Multiple backends (separate Rust modules per runtime) | More code duplication; harder to maintain | ❌ |
| C. Fork per runtime | Unmaintainable | ❌ |
| D. Web-only (no Tauri) | Loses native integration (docker, colima, kubectl, brew) | ❌ |

**AI Approach:**
| Approach | Trade-offs | Decision |
|----------|------------|----------|
| **A. Local-first (Ollama) + optional OpenRouter** | Private by default; user chooses; free models available | ✅ |
| B. OpenRouter only | Simpler; but sends data externally | ❌ |
| C. Built-in model (gguf bundled) | Large binary; model updates hard | ❌ |

---

## 5. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React UI (TSX)                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │Containers│ │ Images  │ │Volumes  │ │Networks │  ...      │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘            │
│       └──────────┬──────────────────────┘                   │
│                  ▼                                           │
│  ┌─────────────────────────────────────────────┐             │
│  │           Guidance Core (TS)                 │             │
│  │  Doctor │ Connection Doctor │ Guided Run    │             │
│  │  Fix Engine │ Problem Detection │ Suggestions│             │
│  └──────────────────┬──────────────────────────┘             │
│                     ▼                                        │
│  ┌─────────────────────────────────────────────┐             │
│  │         Runtime Adapter Layer (TS)           │             │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│             │
│  │  │Colima  │ │OrbStack│ │Rancher │ │Podman  ││             │
│  │  │Adapter │ │Adapter │ │Adapter │ │Adapter ││             │
│  │  └────────┘ └────────┘ └────────┘ └────────┘│             │
│  └──────────────────┬──────────────────────────┘             │
│                     ▼                                        │
│  ┌─────────────────────────────────────────────┐             │
│  │           Tauri Commands (Rust)              │             │
│  │  docker │ colima │ kubectl │ brew │ open_url │             │
│  └─────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   AI Assistant    │
                    │  (Ollama/OpenRouter)│
                    └───────────────────┘
```

---

## 6. Runtime Adapter Interface

```typescript
// src/runtime/types.ts
export interface RuntimeAdapter {
  readonly id: 'colima' | 'orbstack' | 'rancher' | 'podman' | 'docker-desktop';
  readonly name: string;
  readonly icon: string;
  
  // Detection
  isAvailable(): Promise<boolean>;
  getVersion(): Promise<string>;
  
  // Profiles/VMs
  listProfiles(): Promise<Profile[]>;
  startProfile(opts: StartOpts): Promise<void>;
  stopProfile(name: string): Promise<void>;
  applyResources(name: string, opts: ResourceOpts): Promise<void>;
  deleteProfile(name: string): Promise<void>;
  
  // Docker context
  getDockerContext(profileName: string): string;
  
  // Kubernetes (if supported)
  hasKubernetes(): boolean;
  getKubeContext(profileName: string): string;
  
  // Diagnostics
  getDiagnostics(): Promise<Diagnostics>;
}

// src/runtime/colima-adapter.ts
export class ColimaAdapter implements RuntimeAdapter {
  readonly id = 'colima';
  readonly name = 'Colima';
  readonly icon = 'colima-icon';
  
  async isAvailable(): Promise<boolean> {
    try { await invoke('colima_version'); return true; }
    catch { return false; }
  }
  
  async listProfiles(): Promise<Profile[]> {
    return invoke('list_profiles');
  }
  // ... implements all methods via existing Tauri commands
}
```

---

## 7. AI Assistant Design

```typescript
// src/ai/types.ts
export interface AIProvider {
  readonly id: 'ollama' | 'openrouter';
  readonly name: string;
  readonly models: AIModel[];
  
  chat(messages: ChatMessage[]): AsyncIterable<string>;
  isAvailable(): Promise<boolean>;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  free: boolean;
}

// src/ai/troubleshooting.ts
export async function analyzeProblem(
  provider: AIProvider,
  problem: ProblemContext
): Promise<TroubleshootingResult> {
  const prompt = buildPrompt(problem);
  const response = await provider.chat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ]);
  return parseResponse(response);
}

// Problem context includes:
// - Container/config details
// - Doctor findings
// - Docker/Colima versions
// - Network topology
// - Recent events (docker events)
```

**Privacy:** 
- Default: Ollama local (user runs `ollama serve` + pulls model)
- Opt-in: OpenRouter free tier (API key stored in macOS Keychain via Tauri)
- No telemetry without explicit consent

---

## 8. Repo Cleanup Plan

| Area | Action |
|------|--------|
| `docs/superpowers/` | Archive old specs/plans to `docs/archive/` |
| `docs/temporary/` | Delete (screenshots, research, old superpowers) |
| `docs/research/` | Keep only current, relevant notes |
| Business plan iterations | Delete (13 files) |
| Root-level `.md` files | Consolidate into `docs/` |
| `CONTEXT.md` | Keep (session state) |
| `opencode.json` | Keep (config) |
| Unused branches | Delete merged branches; keep `feat/registries`, `feat/private-pull` |

---

## 9. Design System (Material 3 + HIG + Tesla)

### Colors (extend existing tokens)
```css
:root {
  /* Existing --page, --sidebar, --card, --border, --ink, --muted, --primary, etc. */
  /* Material 3 additions */
  --md-sys-color-primary: var(--primary);
  --md-sys-color-on-primary: var(--on-primary);
  --md-sys-color-primary-container: color-mix(in srgb, var(--primary) 15%, transparent);
  --md-sys-color-on-primary-container: var(--ink);
  --md-sys-color-secondary: color-mix(in srgb, var(--primary) 40%, var(--ink));
  --md-sys-color-on-secondary: var(--on-primary);
  --md-sys-color-tertiary: var(--warn);
  --md-sys-color-error: var(--danger);
  --md-sys-color-on-error: white;
  --md-sys-color-surface: var(--card);
  --md-sys-color-on-surface: var(--ink);
  --md-sys-color-surface-variant: var(--sidebar);
  --md-sys-color-outline: var(--border);
  
  /* Tesla: high contrast, minimal */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-1: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-2: 0 4px 8px rgba(0,0,0,0.08);
  --shadow-3: 0 8px 16px rgba(0,0,0,0.1);
  
  /* Motion */
  --motion-ease: cubic-bezier(0.2, 0, 0, 1);
  --motion-duration-short: 100ms;
  --motion-duration-medium: 200ms;
}
```

### Components to standardize
- Button variants: Primary, Secondary, Tertiary, Danger, Ghost
- IconButton: icon-only, icon+text (existing `text` prop), badge
- Card: elevated, outlined, filled
- Dialog/Modal: consistent focus trap, Escape handling
- Toast/Snackbar: success, warning, error, info
- Tooltip: keyboard accessible
- Select/Combobox: searchable, multi-select
- Table: sortable, filterable, selectable rows

---

## 10. New Branch Structure

```
feat/multi-runtime-ai
├── src/
│   ├── runtime/
│   │   ├── types.ts
│   │   ├── index.ts           # factory + registry
│   │   ├── colima-adapter.ts
│   │   ├── orbstack-adapter.ts
│   │   ├── rancher-adapter.ts
│   │   ├── podman-adapter.ts
│   │   └── docker-desktop-adapter.ts
│   ├── ai/
│   │   ├── types.ts
│   │   ├── providers/
│   │   │   ├── ollama.ts
│   │   │   └── openrouter.ts
│   │   ├── troubleshooting.ts
│   │   └── chat-panel.tsx
│   ├── guidance/              # extracted from Doctor, Containers, etc.
│   │   ├── problem-detection.ts
│   │   ├── fix-engine.ts
│   │   ├── connection-doctor.ts
│   │   └── guided-run.ts
│   └── ui/                    # enhanced design system
├── src-tauri/
│   ├── src/
│   │   ├── runtime/           # Rust-side runtime detection
│   │   ├── ai/                # Ollama/OpenRouter integration
│   │   └── keychain.ts        # Secure API key storage
├── docs/
│   ├── superpowers/specs/2026-11-04-multi-runtime-ai-design.md
│   └── superpowers/plans/2026-11-04-multi-runtime-ai.md
```

---

## 11. Migration Strategy

| Phase | Scope | Validation |
|-------|-------|------------|
| **0. Prep** | Create branch, cleanup repo, add runtime types | TypeScript compiles |
| **1. Colima Adapter** | Extract existing Colima logic into `ColimaAdapter` | All existing tests pass |
| **2. Runtime Registry** | Auto-detect available runtimes; UI shows selector | Manual test on Mac with Colima + OrbStack |
| **3. OrbStack Adapter** | Implement `OrbStackAdapter` (uses `orb` CLI, Docker contexts) | Start/stop VM, list profiles work |
| **4. Guidance Core** | Extract Doctor, Connection Doctor, Fix Engine to runtime-agnostic | Unit tests pass with mock adapters |
| **5. AI Assistant (Ollama)** | Local troubleshooting chat panel | `ollama run llama3.1:8b` works |
| **6. AI Assistant (OpenRouter)** | Optional cloud fallback | API key in Keychain, free model works |
| **7. Design System** | Apply Material 3 + HIG tokens; component library | Visual regression tests |
| **8. Packaging** | Homebrew tap + GitHub Releases + notarization | `brew install --cask colima-ui` works |
| **9. Polish** | Onboarding, empty states, keyboard shortcuts | Accessibility audit |

---

## 12. Review Focus (5 failure modes)

| Input/Condition | Expected Behavior | Test |
|-----------------|-------------------|------|
| **Multiple runtimes installed** | App detects all; user can switch; each works independently | Integration test with Colima + OrbStack |
| **No runtime installed** | Onboarding guides to install one (Colima recommended) | E2E test on clean Mac |
| **AI provider unavailable** | Graceful degradation; local-only mode works; no crash | Unit test with mocked unavailable provider |
| **Docker context mismatch** | App uses correct context per runtime/profile; no cross-contamination | Integration test switching profiles |
| **Notarization + CSP** | Release build loads without CSP errors; Gatekeeper accepts | `npm run tauri build` → `spctl -a -v` |

---

## 13. Decisions Needed from Owner

1. **Branch name:** `feat/multi-runtime-ai` or other?
2. **Default runtime:** Colima (current) or auto-detect first available?
3. **AI default:** Ollama local-only, or OpenRouter opt-in at first run?
4. **OpenRouter models:** Which free models to recommend? (Llama 3.1 8B, Gemma 2 9B, Phi-3 Mini)
5. **Homebrew tap:** `filipesousaduty/homebrew-colima-ui` or new org?
6. **Version for first multi-runtime release:** `0.2.0` or `1.0.0`?
7. **OrbStack detection:** `orb` CLI or Docker context `orbstack`?
8. **Rancher Desktop detection:** `rdctl` or Docker context `rancher-desktop`?
9. **Podman Desktop detection:** `podman` CLI or Docker context `podman`?
10. **Docker Desktop detection:** Docker context `desktop-linux`?

---

## 14. Next Step After Approval

Invoke `writing-plans` for detailed task-by-task implementation plan (Phase 0–3 first, then iterate).