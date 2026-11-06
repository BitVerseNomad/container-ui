# Container UI — Session Context

> **Auto-loaded by every session.** Last updated: 2026-11-05

## What

Tauri 2 desktop app (Rust + React/TypeScript) for container runtimes: Colima, OrbStack, Rancher Desktop, Podman Desktop, Docker Desktop. Unified Docker Desktop-like UI with **guidance**: explains what's wrong and fixes mistakes.

**Stack:** Tauri 2 (Rust backend), React 18 + TypeScript (Vite), Playwright. ~4,450 TS lines, ~800 Rust lines.
**Branch:** `main` (v0.1.0 tagged). `feat/multi-runtime-ai` merged.

## Test Status (on `main`)

- `cargo test` → 135 passed, 0 failed, 2 ignored
- `npm test` → 586 passed (pure logic)
- `npm run check` (Vitest UI) → 79 passed
- `npm run build` → OK
- Rust toolchain: stable 1.99.1

## Completed: All Phases 1-17

- Multi-runtime adapter layer (Colima, OrbStack, Rancher, Podman, Docker Desktop)
- Guidance Core: problem detection, fix engine, connection doctor
- AI Assistant: Ollama local + OpenRouter free tier
- Design System: tokens.css (Material 3), 11 components
- Packaging: tauri.conf.json, GitHub Actions, Homebrew cask
- Onboarding: 6-step modal, don't show again
- Keyboard shortcuts: ⌘K palette, ⌘1-7 tabs, Escape close
- Visual regression: 6 tests (light/dark × containers/images/volumes)

## Key Paths & Commands

- `~/.colima/colima/colima.yaml` — Colima config (0.10.1, 6 CPUs, 8 GiB, docker, vz, aarch64)
- `src-tauri/` — Tauri backend
- `src/runtime/` — Runtime adapters

```bash
npm test && cd src-tauri && cargo test    # all tests (226 total)
npm run tauri dev                          # run app native
npm run preview                            # build preview
```

## Session Model

- **Main session:** strongest model — reasoning, planning, decisions. Does NOT write code or run commands.
- **Subagents:** cheapest model — actual work. Every subagent MUST receive `model:` param explicitly.

## Referenced Files (load by path, don't inline)

- `AGENTS.md` — UX rules + test commands (auto-loaded)
- `docs/SPEC.md` — Full spec, work items W1–W14
- `docs/EXECUTION_PLAN.md` — Work item status and next steps
- `docs/VERIFY-ON-YOUR-MAC.md` — Verification commands
- `docs/HIGHLIGHTS.md` — Work summary for future sessions
- `README.md` — Product pitch and install instructions
- `opencode.json` — Config with instructions and subagent routing
- `CHANGELOG.md` — Changelog

---
*Keep this file under 40 lines. Update on major state changes.*
