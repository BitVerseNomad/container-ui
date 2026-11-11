# colima-ui — Resume Prompt (for OpenChamber or any harness)

Paste this into a fresh session to resume exactly where we left off. Do not stop until every checkbox is `[x]`.

---

## Goal (the Definition of Done)

Make colima-ui the reference open-source UI for container management. Done means:

1. **Works flawlessly** — green tests/build: `npm test`, `tsc --noEmit`, `npm run build`, `cargo test`
2. **Accessible by default** — keyboard, VoiceOver, WCAG AA, focus rings
3. **Plain words** — no Docker jargon in labels
4. **One main action per row** — common action on the row; everything else in the `⋯` menu
5. **Installs in a few clicks** — `.dmg` / `.msi` / `.deb` via GitHub releases for Mac/Windows/Linux
6. **In-app feedback → GitHub Discussions**
7. **Open-source ready** — honest README / AGENTS.md / CHANGELOG / CONTRIBUTING

---

## Exact current state (do not re-discover)

- **Repo:** `/Users/fsousa/Desktop/colima-ui`
- **Branch:** `feat/design-system-containers` (branched from `main`, NOT merged, NOT pushed)
- **Last commit:** `c65d358 fix: shell layout, duplicate header, body margin, sidebar default`
- **Staged (54 files, ~8,886 insertions, ~2,136 deletions) but NOT committed:** `git add -A` was run; everything is in the index waiting for `git commit`
- **One stash:** `stash@{0}: WIP on agile-gecko: 641eebf fix: tests pass, multi-platform tauri config, CI workflows` (not on this branch)
- **All green** (verified): `npm test` 98/98 (10 files), `tsc --noEmit` clean, `npm run build` succeeds, `cargo test` 137 passed / 0 failed / 2 ignored
- **Browser verified:** WebKit + Chromium both load the app, all 7 tabs switch, menus open, keyboard Tab works, zero console/page errors. Firefox not installed in this env.
- **Preview build** (`npm run preview`) has a circular dependency bug (`useEnv_1 before initialization`) — React never mounts. NOT an app bug. Use `npx vite --port 1420` for the dev server instead.
- **App needs Tauri `invoke`** for data ops; without Tauri, Projects/Containers show a graceful "Failed to load projects: invoke undefined" alert. Expected, not a frontend bug.

---

## Files changed (the work that needs committing)

Modified (27): docs/EXECUTION_PLAN.md, docs/SPEC.md, docs/SUMMARY.md, package-lock.json, package.json, src/ComposeProjects.test.tsx, src/ComposeProjects.tsx, src/Containers.test.tsx, src/Containers.tsx, src/Doctor.tsx, src/Images.tsx, src/Kubernetes.tsx, src/Networks.tsx, src/Profiles.tsx, src/Volumes.tsx, src/features/projects/ProjectEnvVars.test.tsx, src/ui/Badge.tsx, src/ui/Button.tsx, src/ui/Card.tsx, src/ui/ErrorBoundary.tsx, src/ui/components/Button.tsx, src/ui/components/Card.tsx, src/ui/components/Table.tsx, src/ui/components/Tooltip.tsx, src/ui/components/index.ts, src/ui/tokens.css, vite.config.ts

New/untracked (20+): docs/superpowers/specs/2026-11-10-design-system-foundation.md (ADR), eslint.config.js, src/ui/components/{Avatar,Badge,DropdownMenu,ScrollArea,Separator,Sidebar}.tsx, src/ui/index.ts, src/ui/ui.tsx, src/ui/utils.ts, plus .playwright-mcp/ artifacts

---

## What has been done (don't redo)

- Design system foundation: `tokens.css` (semantic colors, typography, spacing, elevation, radius), 10 ownable components in `src/ui/components/` (Button, Card, Table, Badge, DropdownMenu, Sidebar, Avatar, Separator, ScrollArea, ScrollBar, Tooltip), barrel exports
- 7 tabs migrated from legacy (IconButton/Menu/Spinner) to `@ui/components` design system, with menu hints per AGENTS.md rule 3: Images, Volumes, Profiles, Networks, Doctor, ComposeProjects, Kubernetes
- Badge replaced Mark (status is now a labeled pill, not an icon dot)
- Radix DropdownMenu replaced custom Menu (keyboard, focus trap, Escape-to-close, aria-disabled)
- Button replaces native buttons (whitespace-nowrap, disabled states, loading aria-busy, focus rings)
- Docs honesty: SPEC.md, SUMMARY.md, EXECUTION_PLAN.md updated to match reality (removed false claims about completed phases; Rust compiles; cargo test passes)
- ComposeProjects.test.tsx selectors updated for new menu labels

---

## What is NOT done (this is the execution list)

| # | Task | Details |
|---|------|---------|
| 1 | **Commit everything** | `git commit` all 54 staged files on `feat/design-system-containers`. Small, test-first commits with `Co-authored-by` trailer per SPEC §5 |
| 2 | **Create CONTRIBUTING.md** | Missing entirely. Needs: how to run, how to test, how to PR, UX rules reference |
| 3 | **Update CHANGELOG.md** | Add entry for design-system rollout + tab migration (Changelog exists; newest first) |
| 4 | **Retake README screenshots** | `npm run preview && node scripts/readme-shots.mjs` (or dev server on 1420 + scripts/readme-shots.mjs) |
| 5 | **Update README.md** | Text must match new UI. Benefit first, short, visual. Screenshots at docs/screenshots/ |
| 6 | **Verify AGENTS.md** | UX rules still valid; confirm they reflect design-system reality |
| 7 | **Cut GitHub releases** | Mac (.dmg via tauri build), Windows, Linux. `release.yml` workflow exists; needs version tag + push. Bump version in package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml first |
| 8 | **In-app feedback → GitHub Discussions** | Add a "Give feedback" entry point linking to GitHub Discussions |
| 9 | **Final green check** | WebKit + Chromium: `npm test && (cd src-tauri && cargo test)` and browser checks both pass |

---

## Execution order (do not skip)

1. Commit (task 1) — this locks in all the design-system work
2. CONTRIBUTING.md + CHANGELOG (tasks 2, 3)
3. README screenshots + text (tasks 4, 5)
4. AGENTS.md sanity check (task 6)
5. Releases (task 7) — needs version bumps in 3 files, then `git tag v0.x.y && git push origin v0.x.y`
6. In-app feedback (task 8)
7. Final verification (task 9)

---

## Key constraints (from AGENTS.md / SPEC.md)

- **One main action per row.** Push buttons, not links. Links only go somewhere.
- **Every menu item needs a one-line hint** ("when you'd use it"). Two options differing only in a flag = one option + hinted menu item.
- **Buttons never wrap.** Shorten the label or give the row more room.
- **Every fix asks first, says what it will run, and can be undone or tells you it can't.**
- **Keyboard and VoiceOver work.** Accessible names start with visible words; focus goes somewhere sensible after every action.
- **Test in the engine that ships:** WebKit (WKWebView) + Chromium. `npm test && (cd src-tauri && cargo test)` and `npm run check` must both pass.
- **Keep README in step:** when a screen changes, retake screenshots, update text, add CHANGELOG line.
- **PRs:** branch from `main`; one change per PR; before/after screenshots for UI changes; say what the user can now do, not how the code does it; CI green in both engines.

---

## Commands that work in this env

- `cd /Users/fsousa/Desktop/colima-ui && npm test` — 98/98 pass
- `cd /Users/fsousa/Desktop/colima-ui && npx tsc --noEmit` — clean
- `cd /Users/fsousa/Desktop/colima-ui && npm run build` — succeeds
- `cd /Users/fsousa/Desktop/colima-ui && cd src-tauri && cargo test` — 137 passed / 0 failed / 2 ignored
- `cd /Users/fsousa/Desktop/colima-ui && npx vite --port 1420` — dev server (use this, not `npm run preview`)
- `cd /Users/fsousa/Desktop/colima-ui && npm run lint` — ESLint
- `git add -A && git commit -m "..."` — commit all staged work

---

## Stop condition

Do not stop until tasks 1–9 are all `[x]` in TODO.md and the final green check passes on both WebKit and Chromium. That is the objective. Everything else is a distraction.

---
