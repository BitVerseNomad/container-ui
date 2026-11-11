# Execution plan — Container UI → state of the art

Source of truth for the roadmap: `docs/SPEC.md`. This file tracks execution status.

## Baseline (2026-11-11)
- `npm test`: **98 passed** / 10 files
- `tsc --noEmit`: clean
- `npm run build`: succeeds
- `cargo test`: **137 passed**, 0 failed, 2 ignored
- Rust toolchain installed and working (stable)
- Tags exist: `v0.1.0`, `v0.2.0` (published to https://github.com/filipesousaduty/container-ui)
- **Design system in progress (uncommitted on `feat/design-system-containers`):** tokens.css, 10 components in `src/ui/components/`, Containers tab migrated to `@ui/components/` (Button, Badge, Table, DropdownMenu via Radix). Legacy `IconButton`, `Menu`, `Spinner` still exported from `src/ui/index.ts`.
- **Containers tab** is the only screen fully on the design system; Images, Volumes, Networks, Doctor, Profiles, Compose Projects, Kubernetes still use legacy components.
- **Docs were stale:** SPEC.md said "Rust has never been compiled" (false); SUMMARY.md admitted out of date; EXECUTION_PLAN.md claimed phases complete that don't exist. This file is now honest.

## What is actually done (verified)
- Pure-logic unit tests: 98 pass across 10 files (vitest/jsdom)
- Rust backend: 137 tests pass, allowlists, deadlines, process groups
- Preview browser suite: build + Playwright checks against simulated backend
- Containers home screen: one main action per row, push buttons, Badge status pills, Radix DropdownMenu menus, focus management, live regions
- Design system: tokens.css (semantic colors, type scale, spacing, elevation, radius) + Button, Card, Table, Badge, DropdownMenu, Dialog, FocusTrap, Portal, ScrollArea, ScrollBar, Select, Separator, Sidebar, Tooltip components

## What is genuinely left (from SPEC.md backlog)
None of the following are complete — the old plan claiming otherwise is wrong:

**P0:**
- **W1** Real-machine verification: Rust compiles but release build never opened on a real Mac; parsers (Colima config, docker ps health text, docker system df) unverified against real output; `colima stop --force` and docker-logs stderr paths unverified.
- **W2** Merge registries branch (`feat/registries`, AWS ECR) and finish it — still on its own branch, unmerged.
- **W3** Decide scope from the side-by-side evaluation (existing tool vs. guidance layer).

**P1:**
- **W4** List UX: search/filter/sort/bulk actions/prune suggestions on Images, Volumes, Networks (Containers already has some of this).
- **W5** Run panel: env editor and "recreate with changes".
- **W6** Compose projects read-only discovery + up/down (partially exists as a drawer; needs polish).
- **W7** Colima settings page.
- **W8** Diagnostics page and command log.
- **W9** Menu bar item and notifications.
- **W10** Command palette and shortcuts.

**P2:**
- **W11** Packaging and release: .dmg, code signing, notarization, GitHub Releases, Homebrew tap.
- **W12** Hardening: strict CSP on real Mac, typed commands.
- **W13+** Image build/push, more registries, in-app terminal, remote hosts, Linux, localization.

## Items that do NOT exist (old plan claimed they did)
- Phase 3 AI Assistant (Ollama + OpenRouter) — not built
- Phase 5 Packaging (tauri.conf.json, GitHub Actions, Homebrew cask) — not done
- Phase 6 Onboarding (6-step modal) — not built
- Phase 7 Keyboard shortcuts (⌘K palette, ⌘1-7 tabs) — not built
- Phase 8 Visual regression tests — not built
- Phase 9 Final Polish (empty/loading states, micro-interactions) — partial only

## Definition of done (per feature, from SPEC.md §8)
Research note committed; unit tests and browser checks green; all existing suites still green; screenshots reviewed; README updated; unverified items listed; owner-verifiable steps added to `docs/VERIFY-ON-YOUR-MAC.md`.
