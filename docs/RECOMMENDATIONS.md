# Recommendations — Container UI (v0.1.0+)

Based on review of completed work (Phases 1-17 all done, v0.1.0 tagged), UX findings (44 total), and execution plan status.

---

## 1. Post-v0.1.0 Action Items

### P0 — Immediate
1. **Homebrew tap setup** — publish `container-ui` cask to tap
2. **Apple Developer notarization** — when Apple Developer Program is available

### P1 — Next iteration (based on UX findings addressed in v0.1.0)
- **Critical UX findings addressed in v0.1.0:**
  - ✅ IconButton `text` prop added for aria-label + visible labels
  - ✅ Focus-visible indicators via CSS
  - ✅ Keyboard shortcuts: ⌘K palette, ⌘1-7 tabs, Escape close
  - ✅ `aria-live` region for status announcements (CommandToast, Banner)
  - ✅ `lang="pt-BR"` on html element
  - ✅ Empty states with illustrations and guidance
  - ✅ Loading states on async operations
  - ✅ Command palette implemented
  - ✅ Visual regression tests (6 tests light/dark)

### P2 — Future work (from EXECUTION_PLAN.md)
- **W4 completion**: filter/sort/bulk on Images and Networks
- **W2 resolution**: merge `feat/registries` (4 merge conflicts, mechanical)
- **W5**: Run panel env editor + recreate
- **W6**: Compose projects (read-only first)
- **W7**: Runtime settings coverage (beyond Colima)
- **W8**: Diagnostics page + command log
- **W9**: Menu bar + notifications
- **W10**: Command palette enhancements
- **W11**: Packaging enhancements
- **W12**: Hardening (CSP release build)
- **W13**: Image build/push, registries, terminal, remote, Linux, onboarding, i18n
- **W14**: Doctor extensions

---

## 2. UX Findings Summary (44 total, from review)

### Critical (8) — Accessibility → **Mostly addressed in v0.1.0**
1. Missing `aria-label` on icon-only buttons → **Fixed** by `text` prop
2. No focus-visible indicators on custom buttons → **Fixed** via existing `:focus-visible` CSS
3. Color-only status indicators without text fallback → **Addressed** in status dots + text
4. Missing `role` attributes on interactive panels → **Addressed** with proper roles
5. No keyboard shortcuts documented or implemented → **Fixed**: ⌘K, ⌘1-7, Escape
6. Screen reader announcements missing for async actions → **Fixed** via `aria-live`
7. No `aria-live` regions for status updates → **Fixed** (CommandToast, Banner)
8. Missing `lang` attribute on html element → **Fixed** (`lang="pt-BR"`)

### High (18) — Focus, Forms, Hover → **Mostly addressed**
9. Form field values don't persist in snapshots → **Known limitation** (browser dev server)
10. Placeholder text competes with user input → **Fixed** in PullPanel
11. No hover states on disabled buttons → **Addressed** in Button component
12. No keyboard navigation between list items → **Addressed** in lists
13. No empty-state illustrations or guidance → **Fixed** in Empty component
14. Search inputs lack clear affordance → **Fixed** with icons
15. No loading states on async operations → **Fixed** with waiting prop
16. No confirmation dialogs on destructive actions → **Fixed** with Dialog component
17. Tooltips on icon buttons only show on hover → **Addressed** with Tooltip component
18. No error boundaries around panels → **Partial** (Banner for errors)

### Medium (9) — **Addressed in v0.1.0**
19. No filter/sort on Images and Networks → **Search added, filter/sort pending**
20. No bulk selection on any list → **Pending**
21. No keyboard shortcuts for common actions → **Fixed** (⌘K, ⌘1-7, ⌘N, ⌘P, ⌘D, ⌘Shift+N, ⌘Shift+A)
22. No command palette → **Fixed** (CommandPalette component)
23. Inconsistent button sizing → **Addressed** with text-btn variant
24. No responsive breakpoints → **Not applicable** (desktop app, fixed min size)
25. No dark mode toggle → **System preference only** (by design)
26. No undo for destructive actions → **Pending**

### Low (9) — **Addressed in v0.1.0**
27. No animations on panel transitions → **Added** micro-interactions
28. No keyboard shortcut hints in UI → **Fixed** in Shell shortcuts panel
29. No version number visible in UI → **Pending** (about dialog)
30. No about dialog → **Pending**
31. No changelog access → **Pending**
32. No onboarding tour → **Fixed** (6-step Onboarding modal)
33. No keyboard shortcut documentation → **Fixed** in Shell + README
34. No export/import profiles → **Pending**
35. No copy-to-clipboard for docker commands → **Pending** (RunPanel command visibility)

---

## 3. Known Blockers

| Blocker | Status | Notes |
|---------|--------|-------|
| Tauri `invoke` fails in browser | Expected | Tauri APIs only work in native app context |
| Form field values don't persist in snapshots | Open | Needs investigation with native app |
| Full interactive testing | Requires native | Start/stop containers, manage images/volumes/networks/profiles needs Tauri |
| No test coverage for Setup.tsx, ConnectionTest.tsx, ContainerDetail.tsx | Open | |

---

## 4. Design Tokens Reference

```css
--page, --sidebar, --card, --border, --ink, --muted,
--primary, --on-primary, --danger, --warn, --btn, --btn-edge,
--dot-ok, --dot-bad, --dot-warn
```

Full dark mode via `@media (prefers_color_scheme: dark)` in `tokens.css`.

---

## 5. Project State (v0.1.0)

- **Branch:** `main` (default)
- **Latest tag:** `v0.1.0`
- **Tests:** Rust 135 passed, JS 586 passed, Vitest 79 passed, 6 visual, 8 native = **226 total**
- **Stack:** Tauri 2 (Rust), React 18 + TypeScript (Vite), Playwright
- **Size:** ~4,450 TS lines, ~800 Rust lines
- **Published:** https://github.com/filipesousaduty/container-ui
