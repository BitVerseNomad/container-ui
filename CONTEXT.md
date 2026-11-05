# Colima UI — Session Context

> **Auto-loaded by every session.** Last updated: 2026-11-03

## What

Tauri 2 desktop app (Rust + React/TypeScript) managing [Colima](https://github.com/abiosoft/colima) — open-source Docker on Mac. Docker Desktop-like UI with **guidance**: explains what's wrong and fixes mistakes.

**Stack:** Tauri 2 (Rust backend), React 18 + TypeScript (Vite), Playwright. ~4,450 TS lines, ~800 Rust lines.
**Branch:** `integration` (everything except `feat/registries`). Default pushed.

## Test Status (on `integration`)

- `cargo test` → 135 passed, 0 failed, 2 ignored
- `npm test` → 586 passed (pure logic)
- `npm run check` (Vitest UI) → 79 passed
- `npm run build` → OK
- Rust toolchain: stable 1.99.1

## Active Work: W4 (List UX)

Search added to Images, Volumes, Networks. Filter/sort/bulk selection + bulk remove on Images and Networks still pending. Prune suggestions (app-side last-seen tracking) still pending.

## Deferred: W2 (Registries Merge)

`feat/registries` has 4 merge conflicts with `integration`: `src/main.rs`, `src/useEnv.ts`, `src/styles.css`, `preview/mock.ts`. Mechanical but large — deferred until W4 done.

## Key Paths & Commands

- `~/.colima/colima/colima.yaml` — Colima config (0.10.1, 6 CPUs, 8 GiB, docker, vz, aarch64)
- `~/.colima/_lima/colima/ha.stderr.log` — 31KB CLI stderr (GUI should expose)
- `src-tauri/` — Tauri backend
- Issue #1665: GUI error logs + stale state cleanup (abiosoft/colima)

```bash
npm test && cd src-tauri && cargo test    # all tests
npm run tauri dev                          # run app
npm run preview                            # build preview
```

## Session Model

- **Main session:** strongest model (`qwen3.6-35b-a3b`) — reasoning, planning, decisions. Does NOT write code or run commands.
- **Subagents:** cheapest model (`gemma-4-26b-a4b`) — actual work. Every subagent MUST receive `model:` param explicitly.

## Referenced Files (load by path, don't inline)

- `AGENTS.md` — UX rules + test commands (auto-loaded)
- `docs/SPEC.md` — Full spec, work items W1–W14
- `docs/EXECUTION_PLAN.md` — Work item status and next steps
- `docs/VERIFY-ON-YOUR-MAC.md` — Verification commands (helper container, docker events, system df)
- `docs/SUMMARY.md` — What was built and learned (Oct 11)
- `README.md` — Product pitch and install instructions
- `opencode.json` — Config with instructions and subagent routing
- `CHANGELOG.md` — Changelog

## Known Unverified Assumptions (verify on your Mac)

Helper container output, `docker events` JSON fields, `docker system df -v --format json` shape, Kubernetes context name, Terminal `osascript`, `docker ps` health text "(healthy)", AWS ECR SSO, release build CSP, prune suggestions need app-side tracking, first-use image downloads. See `docs/VERIFY-ON-YOUR-MAC.md`.

## Decisions Needed

1. After scorecard: full roadmap, narrow to guidance layer, or adopt existing tool?
2. Distribution: personal use only, or share (notarization + Homebrew tap)?
3. Registries: is AWS ECR the only private registry that matters?
4. Compose: read-only or editing required?
5. Menu bar/notifications: default or opt in?

---
*Keep this file under 40 lines. Update on major state changes.*
