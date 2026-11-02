# Execution plan — Colima UI → state of the art

Source of truth for the roadmap: `docs/SPEC.md`. This file tracks execution status.

## Baseline (2026-11-02)
- Rust: `cargo test` → **135 passed**, 0 failed, 2 ignored.
- Node pure logic: **586 passed**.
- Vitest (UI): **79 passed**.
- `npm run build`: OK.
- Rust toolchain installed (stable 1.99.1) and working.
- Published: https://github.com/filipesousaduty/colima-ui (all branches; default `integration`).

## Status by work item
- **W1** Real-machine verification + Rust compile — **Partial**: Rust compiles and tests pass. Real-machine walk of `docs/VERIFY-ON-YOUR-MAC.md` still needs the owner.
- **W2** Merge registries branch + finish it — **Not started**: merge conflicts in `main.rs`, `mock.ts`, `PullPanel.tsx`, `styles.css`, `useEnv.ts`; resolution is mechanical (union) but large. Deferred.
- **W3** Scope decision from side-by-side test — **Needs owner**.
- **W4** List UX (search/filter/sort/bulk/prune) — **In progress**: search added to Images (already), Volumes, Networks. Filter/sort/bulk/prune pending.
- **W5** Run panel env editor + recreate — Not started.
- **W6** Compose projects — Not started.
- **W7** Colima settings coverage — Not started.
- **W8** Diagnostics page + command log — Not started.
- **W9** Menu bar + notifications — Not started.
- **W10** Command palette + shortcuts — Not started.
- **W11** Packaging/release — Not started.
- **W12** Hardening (CSP release build) — Not started.
- **W13** Image build/push, registries, terminal, remote, Linux, onboarding, i18n — Not started.
- **W14** Doctor extensions — Not started.

## Next steps
1. Finish W4: filter, sort, bulk selection + bulk remove, prune suggestions (app-side last-seen tracking).
2. Resolve W2 merge (registries) with a careful union, then add AWS mock scenarios and run `check-registries.mjs`.
3. W1 real-machine verification with the owner.
4. W5 Run panel env editor + recreate.
5. W6 Compose projects (read-only first).
6. W8 Diagnostics + command log.
7. W9 Menu bar + notifications.
8. W10 Command palette.
9. W11 Packaging (icons, dmg, signing, releases, Homebrew).
10. W12 Hardening; W13/W14 as time allows.

## Notes
- Repo default branch set to `integration`. All branches pushed.
- To publish under `BitVerseNomad`, the owner must run `gh auth login` as that account; current auth is `filipesousaduty`.
- LM Studio/OpenCode context: see `STATE.md` in the Default Project workspace.