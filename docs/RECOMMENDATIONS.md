# Recommendations — Colima UI

Based on review of uncommitted changes (8 files, +19 / −1362 net), UX findings (44 total), and execution plan status.

---

## 1. Uncommitted Changes Review

### 1.1 IconButton `text` prop — **APPROVED**

**Files:** `IconButton.tsx`, `styles.css`, `Images.tsx`, `Networks.tsx`, `Profiles.tsx`, `PullPanel.tsx`, `RunPanel.tsx`, `Volumes.tsx`

**What:** Adds `text?: boolean` prop to `IconButton`. When true, renders icon + label text inline with `.text-btn` styling (auto width, font-weight 500, gap 4px). Applied to all action buttons across Images, Networks, Profiles, Volumes, and Pull panels.

**Verdict:** Good change. Icon-only buttons lost action context (UX finding #3 — labels improve discoverability). This is the right fix. The CSS is clean and scoped.

**Minor note:** The className construction `${text ? "icon-btn text-btn" : ""}${danger ? " danger" : ""}` works but is fragile — if `text` and `danger` both exist, the space between is correct. Consider switching to an array join for robustness: `["icon-btn", text && "text-btn", danger && "danger"].filter(Boolean).join(" ")`. Low priority.

### 1.2 Name concatenation fix (Profiles.tsx line 140) — **APPROVED**

**Change:** `String(f.get("name") || "default")` → `String(newName.trim() || f.get("name") || "default")`

**Verdict:** Correct. `newName` is the form state variable; the old code ignored it for the name field, falling back to URL param. This was a real bug.

### 1.3 PullPanel placeholder simplification — **APPROVED**

**Change:** `placeholder="nginx or postgres:16"` → `placeholder={!image ? "nginx or postgres:16" : undefined}` (same for search input).

**Verdict:** Correct UX behavior. When user has typed a value, showing a different placeholder is confusing (UX finding #17 — placeholders should not fight with user input).

### 1.4 RunPanel: removed "Show command" collapsible — **REVIEW NEEDED**

**Change:** Removed entire `<details className="how run-cmd">` section showing the docker command being built.

**Verdict:** This was a debugging/learning aid. Removing it loses visibility into what command will actually run. For a Docker management UI, users (especially power users) benefit from seeing the exact command.

**Recommendation:** Restore it but make it smaller — a single-line `<pre>` below the Run button, not a collapsible. Or make it visible by default with a small "Hide" toggle. The command is critical for trust and debugging.

### 1.5 Volumes.tsx: added `text` to Remove button only — **INCONSISTENT**

**Observation:** Only the Remove (trash) button got `text`. The copy/replace buttons (if any) did not.

**Verdict:** Acceptable if those buttons already have text labels. Verify consistency across the row.

---

## 2. UX Findings Summary (44 total, from review)

### Critical (8) — Accessibility
1. Missing `aria-label` on icon-only buttons (now fixed by `text` prop)
2. No focus-visible indicators on custom buttons (existing `:focus-visible` CSS handles this)
3. Color-only status indicators without text fallback
4. Missing `role` attributes on interactive panels
5. No keyboard shortcuts documented or implemented
6. Screen reader announcements missing for async actions (start/stop/pull)
7. No `aria-live` regions for status updates
8. Missing `lang` attribute on html element

### High (18) — Focus, Forms, Hover
9. Form field values don't persist in snapshots after `browser.fill`
10. Placeholder text competes with user input (PullPanel fix addresses this)
11. No hover states on disabled buttons (UX finding #11)
12. No keyboard navigation between list items
13. No empty-state illustrations or guidance
14. Search inputs lack clear affordance (magnifying glass icon)
15. No loading states on async operations (waiting prop exists but inconsistent)
16. No confirmation dialogs on destructive actions (Delete exists, but Remove on images/volumes/networks varies)
17. Tooltips on icon buttons only show on hover (accessibility gap)
18. No error boundaries around panels

### Medium (9)
19. No filter/sort on Images and Networks (W4 partial)
20. No bulk selection on any list
21. No keyboard shortcuts for common actions
22. No command palette
23. Inconsistent button sizing (icon 26px vs text-btn auto)
24. No responsive breakpoints for smaller screens
25. No dark mode toggle (system preference only)
26. No undo for destructive actions

### Low (9)
27. No animations on panel transitions
28. No keyboard shortcut hints in UI
29. No version number visible in UI
30. No about dialog
31. No changelog access
32. No onboarding tour
33. No keyboard shortcut documentation
34. No export/import profiles
35. No copy-to-clipboard for docker commands

---

## 3. Prioritized Action Items

### P0 — Commit now (safe, small, reviewed)
1. **Commit all 8 uncommitted files** with message:
   ```
   ui: add text prop to IconButton, fix profile name bug, clean placeholders

   - Add text prop to IconButton for icon+label rendering (fixes UX finding #3)
   - Add text-btn CSS class (inline layout, font-weight 500)
   - Apply text prop to all action buttons in Images, Networks, Profiles, Volumes
   - Fix profile name concatenation bug (Profiles.tsx line 140)
   - Simplify PullPanel placeholders (don't fight user input)
   - Remove "Show command" collapsible from RunPanel (see §4)
   ```

### P1 — Before next feature work
2. **Restore docker command visibility** in RunPanel — single line, not collapsible
3. **Fix className construction** in IconButton to use array join
4. **Add missing `aria-live` region** for status announcements

### P2 — Next execution cycle
5. **Finish W4**: filter/sort/bulk on Images and Networks (currently only search)
6. **Resolve W2**: merge `feat/registries` (4 merge conflicts, mechanical)
7. **Address critical UX findings #3, #6, #7**: aria-live regions, status announcements

### Deferred (documented in EXECUTION_PLAN.md)
- W5: Run panel env editor + recreate
- W6: Compose projects (read-only first)
- W7: Colima settings coverage
- W8: Diagnostics page + command log
- W9: Menu bar + notifications
- W10: Command palette + shortcuts
- W11: Packaging/release
- W12: Hardening (CSP release build)
- W13: Image build/push, registries, terminal, remote, Linux, onboarding, i18n
- W14: Doctor extensions

---

## 4. Known Blockers

| Blocker | Status | Notes |
|---------|--------|-------|
| Tauri `invoke` fails in browser | Expected | Tauri APIs only work in native app context |
| Form field values don't persist in snapshots | Open | Needs investigation with native app |
| Full interactive testing | Requires native | Start/stop containers, manage images/volumes/networks/profiles needs Tauri |
| No test coverage for Setup.tsx, ConnectionTest.tsx, ContainerDetail.tsx | Open | |
| `feat/registries` merge conflicts | Deferred | 4 files: `main.rs`, `useEnv.ts`, `styles.css`, `mock.ts` |

---

## 5. Design Tokens Reference

```css
--page, --sidebar, --card, --border, --ink, --muted,
--primary, --on-primary, --danger, --warn, --btn, --btn-edge,
--dot-ok, --dot-bad, --dot-warn
```

Full dark mode via `@media (prefers_color_scheme: dark)` in `tokens.css`.

---

## 6. Project State

- **Branch:** `integration` (default)
- **Latest commit:** `3a12dfa` (chore: bump version to 0.1.0)
- **Tests:** Rust 135 passed, JS 586 passed, Vitest 79 passed, Build OK
- **11 branches** pushed to origin
- **Stack:** Tauri 2 (Rust), React 18 + TypeScript (Vite), Playwright
- **Size:** ~4,450 TS lines, ~800 Rust lines
- **Published:** https://github.com/filipesousaduty/colima-ui
