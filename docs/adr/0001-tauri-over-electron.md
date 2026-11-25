# 0001. Tauri 2 over Electron

## Status

Accepted (2026-11-12).

## Context

Electron with Tailwind and Base UI was considered as the app shell. The look of the app is CSS, so it renders the same in either shell. The backend is about 6,500 lines of Rust that run `docker`, `colima` and `kubectl` through command allowlists, with tests. The `.dmg` was about 6 MB at the time.

## Decision

Stay on Tauri 2: Rust for the shell and backend, React and TypeScript for the screens.

## Consequences

1. The allowlisted Rust backend and its tests are kept, not ported to Node and re-proved.
2. The app stays small. "Light" is one of the claims of the product.
3. On macOS the app runs in WebKit (WKWebView), not Chromium. Checks must run in WebKit too (see [0006](0006-preview-with-mock-backend.md)).
4. This would change if the app needed Windows and Linux with identical rendering, or a dependency that only exists for Node.

Sources: `docs/plan/README.md` (D2) at commit 29b538e.
