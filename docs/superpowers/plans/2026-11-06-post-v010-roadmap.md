# Container UI — Post-v0.1.0 Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete remaining work items from original execution plan (W4, W2, W5-W14) and deliver post-v0.1.0 enhancements for Container UI multi-runtime app.

**Architecture:** Tauri 2 (Rust backend) + React 18 + TypeScript (Vite). Runtime adapter pattern for Colima, OrbStack, Rancher Desktop, Podman Desktop, Docker Desktop. Guidance Core for problem detection/fixes. AI Assistant with Ollama + OpenRouter free tier.

**Tech Stack:** Rust 1.99+, Node 18+, Tauri 2, React 18, TypeScript 5.5, Vite 5, Vitest 2, Playwright, css variables design tokens (Material 3 semantic colors).

**Spec:** `docs/SPEC.md` (original), `docs/EXECUTION_PLAN.md` (current status), `docs/RECOMMENDATIONS.md` (UX findings)

---

## Global Constraints

- **Version floor:** Rust 1.99+, Node 18+, Tauri 2 stable
- **Dependency limit:** No new heavy deps; prefer stdlib / existing deps
- **Naming:** "Container UI" everywhere (productName, window title, onboarding, cask, README)
- **Copy rules:** Portuguese UI, plain words, no Docker jargon in labels
- **Platform:** macOS only (Apple Silicon primary, Intel via universal binary later)
- **Test gates:** `npm test && cargo test` must pass before any commit
- **Browser engines:** Chromium + WebKit (WKWebView) — `npm run check` tests both
- **Accessibility:** WCAG 2.1 AA; keyboard + VoiceOver for every interactive element
- **Design system:** tokens.css (Material 3 semantic colors), 11 components — extend, don't replace

---

## Review Focus

Five input classes / failure modes most likely to bite a person using this software:

1. **Multi-runtime detection race** — When multiple runtimes installed, detection order / caching may show stale data. Test: install Colima + OrbStack, switch rapidly, verify profiles reload correctly.
2. **Profile start/stop deadlock** — VM operations lock dockerLocked; concurrent start+resize+compose run must not deadlock. Test: trigger resize while compose up runs, verify one completes, other queues.
3. **AI Assistant hallucination on CLI commands** — Free models (Llama 3.1 8B, Gemma 2 9B) may invent flags. Test: ask "how to prune volumes", verify suggested command matches `docker volume prune --filter` exactly.
4. **Testcontainers socket override corruption** — Shell profile edit may leave duplicate/broken lines. Test: run Fix for Testcontainers 3×, verify `~/.zshrc` has exactly one override line.
5. **Bring-over volume copy partial failure** — Large Docker Desktop volumes may time out mid-stream. Test: 10GB volume, kill network mid-copy, verify Colima volume is clean (no half-written data).

---

## Task Structure

### Task 1: Finish W4 — List UX (Filter, Sort, Bulk, Prune)

**Files:**
- Modify: `src/Images.tsx`, `src/Networks.tsx`, `src/Volumes.tsx` (add filter/sort/bulk)
- Modify: `src/ui/Table.tsx` (add bulk selection support)
- Create: `src/hooks/useListState.ts` (shared filter/sort/selection logic)
- Test: `src/Images.test.tsx`, `src/Networks.test.tsx`, `src/Volumes.test.tsx`

**Interfaces:**
- Consumes: `src/ui/Table.tsx` (Table component with selection prop), `src/hooks/useListState.ts` (new hook)
- Produces: Filter/sort/bulk UI on Images, Networks, Volumes tabs; prune suggestions in Doctor

- [ ] **Step 1: Write failing tests for filter/sort/bulk on Images**

```tsx
// src/Images.test.tsx
test("given image list, when filter typed, then only matching rows remain", () => { ... })
test("given image list, when sort by size clicked, then rows reorder", () => { ... })
test("given image list, when bulk select + delete, then confirmation shows count", () => { ... })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/Images.test.tsx`
Expected: FAIL (filter/sort/bulk not implemented)

- [ ] **Step 3: Create `src/hooks/useListState.ts`**

```ts
export function useListState<T>(items: T[], config: {
  filterKeys: (keyof T)[];
  sortKeys: { key: keyof T; label: string }[];
  bulkActions: { label: string; action: (selected: T[]) => Promise<void> }[];
}) {
  // Returns: filteredItems, sortConfig, selection, handlers
}
```

- [ ] **Step 4: Integrate useListState into Images.tsx**

Replace local filter state with hook; add filter input, sort dropdown, bulk selection checkboxes, bulk action bar.

- [ ] **Step 5: Repeat for Networks.tsx and Volumes.tsx**

Same pattern; Networks sorts by name/driver/scope; Volumes by name/driver/size.

- [ ] **Step 6: Add prune suggestions to Doctor**

In `src/Doctor.tsx`, add rows for: unused images, stopped containers, anonymous volumes, build cache — with "Prune" bulk action.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- src/Images.test.tsx src/Networks.test.tsx src/Volumes.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useListState.ts src/Images.tsx src/Networks.tsx src/Volumes.tsx src/Doctor.tsx src/ui/Table.tsx src/*.test.tsx
git commit -m "feat: finish W4 — filter/sort/bulk/prune on Images, Networks, Volumes"
```

---

### Task 2: Resolve W2 — Merge feat/registries Branch

**Files:**
- Modify: `src-tauri/src/main.rs`, `src/useEnv.ts`, `src/styles.css`, `src/preview/mock.ts`
- Test: `src/registries.test.ts` (if exists), `src-tauri/src/registries.rs` (if exists)

**Interfaces:**
- Consumes: `feat/registries` branch changes (registry UI, AWS ECR login, credential helpers)
- Produces: Merged registry management in Images tab + Pull panel

- [ ] **Step 1: Fetch and inspect feat/registries branch**

```bash
git fetch origin feat/registries
git diff main..origin/feat/registries --stat
```

- [ ] **Step 2: Attempt merge with union strategy**

```bash
git merge origin/feat/registries --no-commit
# Resolve 4 conflicts mechanically (union of both sides)
```

- [ ] **Step 3: Run full test suite**

Run: `npm test && cargo test`
Expected: PASS (all 226 tests)

- [ ] **Step 4: Add AWS mock scenarios and run check-registries.mjs**

```bash
node scripts/check-registries.mjs
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: merge registries branch — registry UI, AWS ECR, credential helpers"
```

---

### Task 3: W5 — Run Panel Env Editor + Recreate

**Files:**
- Modify: `src/RunPanel.tsx` (add env editor, recreate button)
- Modify: `src/ui/Table.tsx` (editable env rows)
- Create: `src/hooks/useEnvEditor.ts`
- Test: `src/RunPanel.test.tsx`

**Interfaces:**
- Consumes: `src/RunPanel.tsx` (existing run form), `src/api.ts` (container inspect)
- Produces: Inline env var editor, "Recreate" action preserving volumes/networks

- [ ] **Step 1: Write failing tests for env editor**

```tsx
test("given running container, when env edited + recreate, then new container has new env", () => { ... })
test("given env editor, when invalid key=value, then inline error shown", () => { ... })
```

- [ ] **Step 2: Implement env editor in RunPanel**

Add editable rows for Env section; validate `KEY=VALUE` format; show "Recreate" button (not "Run") when container exists.

- [ ] **Step 3: Implement recreate logic**

`docker run` with same config + new env; preserve volumes (`--volumes-from`), networks, restart policy.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/RunPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/RunPanel.tsx src/hooks/useEnvEditor.ts src/ui/Table.tsx src/RunPanel.test.tsx
git commit -m "feat: W5 — Run panel env editor + recreate"
```

---

### Task 4: W6 — Compose Projects (Read-Only First)

**Files:**
- Create: `src/ComposeProjects.tsx`, `src/useComposeProjects.ts`
- Modify: `src/Shell.tsx` (add Compose tab if projects exist)
- Test: `src/ComposeProjects.test.tsx`

**Interfaces:**
- Consumes: `src/api.ts` (compose ls, compose config), `src/runtime/` (adapter compose support)
- Produces: Compose projects list, services tree, logs, start/stop per service

- [ ] **Step 1: Write failing tests for compose list**

```tsx
test("given compose projects, when tab opened, then projects listed with service count", () => { ... })
```

- [ ] **Step 2: Implement compose detection in runtime adapters**

Each adapter: `listComposeProjects(): Promise<ComposeProject[]>`

- [ ] **Step 3: Build ComposeProjects UI**

List → select project → show services tree → service actions (logs, start, stop, restart).

- [ ] **Step 4: Add Compose tab to Shell (conditional)**

Only show when `composeProjects.length > 0`.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/ComposeProjects.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ComposeProjects.tsx src/useComposeProjects.ts src/Shell.tsx src/ComposeProjects.test.tsx
git commit -m "feat: W6 — Compose projects read-only"
```

---

### Task 5: W7 — Runtime Settings Coverage (Beyond Colima)

**Files:**
- Modify: `src/runtime/*.ts` (each adapter: settings schema + UI)
- Create: `src/Settings.tsx`, `src/useRuntimeSettings.ts`
- Test: `src/Settings.test.tsx`

**Interfaces:**
- Consumes: `src/runtime/` (adapter settings methods), `src/Profiles.tsx` (profile create/edit)
- Produces: Settings panel per runtime (CPU, memory, disk, DNS, proxy, Kubernetes, etc.)

- [ ] **Step 1: Define settings schema per runtime**

```ts
interface RuntimeSettings {
  colima: { cpus, memory, disk, dns, proxy, kubernetes, vz, rosetta };
  orbstack: { cpus, memory, disk, dns, proxy, kubernetes, rosetta };
  rancher: { cpus, memory, disk, kubernetes, wsl };
  podman: { cpus, memory, disk, machineType };
  dockerDesktop: { cpus, memory, disk, kubernetes, wsl };
}
```

- [ ] **Step 2: Implement settings read/write in each adapter**

`getSettings()`, `applySettings(partial)` — map to CLI flags / config files.

- [ ] **Step 3: Build Settings UI**

Tabbed by runtime; only show active runtime's settings; integrate with Profiles create/edit.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/Settings.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtime/*.ts src/Settings.tsx src/useRuntimeSettings.ts src/Settings.test.tsx
git commit -m "feat: W7 — Runtime settings coverage for all 5 runtimes"
```

---

### Task 6: W8 — Diagnostics Page + Command Log

**Files:**
- Modify: `src/Doctor.tsx` (expand to full Diagnostics page)
- Create: `src/CommandLog.tsx` (if not exists), `src/useCommandLog.ts`
- Test: `src/Doctor.test.tsx`, `src/CommandLog.test.tsx`

**Interfaces:**
- Consumes: `src/Commands.ts` (command log), `src/Doctor.ts` (checks), `src/FixIt.ts` (fix runs)
- Produces: Unified diagnostics page: checks + command log + fix history + export

- [ ] **Step 1: Merge Doctor + CommandLog into Diagnostics page**

Single page with tabs: Checks | Commands | Fix History | Export.

- [ ] **Step 2: Add structured export (JSON/Markdown)**

"Copy diagnostics" button → clipboard with all checks, commands, fixes, timestamps.

- [ ] **Step 3: Run tests**

Run: `npm test -- src/Doctor.test.tsx src/CommandLog.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/Doctor.tsx src/CommandLog.tsx src/useCommandLog.ts src/*.test.tsx
git commit -m "feat: W8 — Diagnostics page with command log + export"
```

---

### Task 7: W9 — Menu Bar + Notifications

**Files:**
- Modify: `src-tauri/src/main.rs` (tray menu, notifications)
- Create: `src-tauri/src/tray.rs`, `src-tauri/src/notifications.rs`
- Test: `src-tauri/src/tray_test.rs`, `src-tauri/src/notifications_test.rs`

**Interfaces:**
- Consumes: `src/runtime/` (VM state changes), `src/Doctor.ts` (problem count)
- Produces: Menu bar icon with status, VM start/stop/restart, open app, notifications on problems

- [ ] **Step 1: Implement tray menu in Rust**

```rust
// Menu items: Open Container UI | Start VM | Stop VM | Restart VM | Quit
// Icon: green (running, no problems), yellow (running, problems), grey (stopped), red (error)
```

- [ ] **Step 2: Add notifications via tauri-plugin-notification**

On problem count change → notification; on VM start/stop complete → notification.

- [ ] **Step 3: Wire runtime state changes to tray**

Listen to `runtime-changed` + profile status updates; update tooltip + icon.

- [ ] **Step 4: Run Rust tests**

Run: `cargo test tray notifications`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/tray.rs src-tauri/src/notifications.rs src-tauri/src/main.rs src-tauri/src/*_test.rs
git commit -m "feat: W9 — Menu bar + notifications"
```

---

### Task 8: W10 — Command Palette Enhancements

**Files:**
- Modify: `src/CommandPalette.tsx`, `src/hooks/useKeyboardShortcuts.ts`
- Test: `src/CommandPalette.test.tsx`

**Interfaces:**
- Consumes: All app commands (navigation, actions, AI, settings)
- Produces: ⌘K palette with fuzzy search, recent commands, keyboard hints

- [ ] **Step 1: Add recent commands + fuzzy scoring**

Track last 20 executed commands; boost in search results.

- [ ] **Step 2: Add keyboard hint column**

Show shortcut next to each command (⌘1, ⌘N, ⌘K, etc.).

- [ ] **Step 3: Run tests**

Run: `npm test -- src/CommandPalette.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/CommandPalette.tsx src/hooks/useKeyboardShortcuts.ts src/CommandPalette.test.tsx
git commit -m "feat: W10 — Command palette enhancements (recent, hints)"
```

---

### Task 9: W11 — Packaging Enhancements

**Files:**
- Modify: `src-tauri/tauri.conf.json`, `.github/workflows/release.yml`
- Create: `homebrew-tap/Formula/container-ui.rb` (separate repo)
- Test: Local DMG build + install verification

**Interfaces:**
- Consumes: `tauri.conf.json` (bundle config), GitHub Actions (release workflow)
- Produces: Signed/notarized DMG, Homebrew cask auto-update, universal binary

- [ ] **Step 1: Configure universal binary (Apple Silicon + Intel)**

```json
"bundle": { "macOS": { "universalBinary": true } }
```

- [ ] **Step 2: Add Apple Developer signing (when team ID available)**

```json
"signingIdentity": "Developer ID Application: <NAME> (<TEAM_ID>)"
"providerShortName": "<TEAM_ID>"
```

- [ ] **Step 3: Create Homebrew tap repo and formula**

Separate repo `homebrew-container-ui` with `Formula/container-ui.rb` pointing to GitHub Releases.

- [ ] **Step 4: Test local build**

```bash
npm run tauri build
# Verify DMG installs, auto-updates, runs on clean Mac
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/tauri.conf.json .github/workflows/release.yml
git commit -m "feat: W11 — Packaging: universal binary, notarization prep, Homebrew tap"
```

---

### Task 10: W12 — Hardening (CSP Release Build)

**Files:**
- Modify: `src-tauri/tauri.conf.json` (CSP), `src/main.tsx` (remove unsafe-inline)
- Test: `npm run build && npm run tauri build` — verify no CSP violations in console

**Interfaces:**
- Consumes: Vite build output, Tauri CSP config
- Produces: Strict CSP (`script-src 'self'`, no `unsafe-inline`)

- [ ] **Step 1: Remove all `unsafe-inline` from devCsp**

Move inline styles/scripts to files; use nonce if needed.

- [ ] **Step 2: Verify production build passes CSP**

```bash
npm run build && cd src-tauri && cargo tauri build
# Run app, check DevTools console for CSP errors
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tauri.conf.json src/main.tsx src/styles.css
git commit -m "feat: W12 — CSP hardening for release build"
```

---

### Task 11: W13 — Image Build/Push, Registries, Terminal, Remote, Linux, Onboarding, i18n

**Files:**
- Create: `src/ImageBuild.tsx`, `src/RegistryManager.tsx`, `src/Terminal.tsx`, `src/Remote.tsx`
- Modify: `src/Onboarding.tsx` (i18n), `src/i18n.ts` (new)
- Test: Each component test file

**Interfaces:**
- Consumes: `src/runtime/` (build/push support), `src/api.ts` (docker CLI)
- Produces: Image build UI, registry auth management, embedded terminal, remote Docker context, i18n framework

- [ ] **Step 1: Image build UI** — Dockerfile editor, build args, tag, push to registry
- [ ] **Step 2: Registry manager** — Add/edit/delete registries, test auth, ECR/GHCR/Docker Hub presets
- [ ] **Step 3: Embedded terminal** — xterm.js + docker exec / shell access
- [ ] **Step 4: Remote Docker context** — SSH + TLS connection profiles
- [ ] **Step 5: i18n framework** — pt-BR (default), en-US, es-ES; JSON locale files
- [ ] **Step 6: Run tests**
- [ ] **Step 7: Commit**

---

### Task 12: W14 — Doctor Extensions

**Files:**
- Modify: `src/Doctor.ts`, `src/Doctor.tsx`
- Create: `src/checks/*.ts` (new check modules)
- Test: `src/Doctor.test.tsx`, each check test

**Interfaces:**
- Consumes: `src/runtime/` (runtime-specific checks), `src/api.ts` (docker info)
- Produces: Extended checks: network connectivity, DNS resolution, disk pressure, Kubernetes health, compose validity, buildx status

- [ ] **Step 1: Add new check modules**

```ts
// checks/network.ts — ping registry, resolve DNS, test connectivity
// checks/kubernetes.ts — cluster reachable, nodes ready, core pods running
// checks/compose.ts — validate compose files, check service health
// checks/buildx.ts — builder running, platforms supported
```

- [ ] **Step 2: Integrate into Doctor page**

Group by category; show runtime-specific checks only for active runtime.

- [ ] **Step 3: Run tests**
- [ ] **Step 4: Commit**

---

## Post-v0.1.0 Quick Wins (Can run in parallel)

| Item | Files | Effort |
|------|-------|--------|
| About dialog (version, license, links) | `src/About.tsx`, `src/Shell.tsx` | 1h |
| Copy docker command to clipboard (RunPanel) | `src/RunPanel.tsx` | 30m |
| Export/import profiles (JSON) | `src/Profiles.tsx`, `src/api.ts` | 1h |
| Dark mode toggle (override system) | `src/hooks/useTheme.ts`, `tokens.css` | 1h |
| Undo for destructive actions (toast + revert) | `src/ui/Toast.tsx`, `src/App.tsx` | 2h |
| Version visible in UI (footer/settings) | `src/Shell.tsx`, `tauri.conf.json` | 30m |

---

## Execution Order Recommendation

**Sequential (dependencies):**
1. Task 1 (W4) → Task 2 (W2) → Task 3 (W5) → Task 4 (W6) → Task 5 (W7)

**Parallelizable after Task 1:**
- Task 6 (W8), Task 7 (W9), Task 8 (W10) — independent
- Task 9 (W11), Task 10 (W12) — need Apple Dev Program
- Task 11 (W13), Task 12 (W14) — large, can start anytime

**Quick wins:** Do anytime between larger tasks for morale.

---

## Branching Strategy

- All work on `main` (or feature branches `feat/w4-list-ux`, `feat/w2-registries`, etc.)
- PR per task with before/after screenshots for UI changes
- CI: `npm test && cargo test && npm run check` must pass
- Merge to `main` after review

---

## Success Criteria

- All 12 original work items (W1-W14) complete (W1, W3, W4 partial → done; W2 merged; W5-W14 done)
- 226+ tests passing (add ~50 new tests for new features)
- Zero CSP violations in release build
- Signed/notarized DMG installable on clean Mac
- Homebrew tap `brew install container-ui` works
- Multi-runtime: all 5 runtimes detectable, switchable, manageable

---

*Plan created: 2026-11-06 | Branch: `main` | Tag: `v0.1.0`*