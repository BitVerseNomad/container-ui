# 0006. A browser preview with a mock backend, and checks in WebKit and Chromium

## Status

Accepted. `npm run preview` and `npm run check` are in `AGENTS.md`.

## Context

The checks need a running app. The Tauri app needs a Mac and Rust. The first preview used a hand-written bundler that broke on new imports, and its mock backend was behind the code. All browser checks stopped working. The app ships in WebKit, so passing in Chromium alone is not enough.

## Decision

1. The preview is built with Vite. A second config aliases `@tauri-apps/api/core` and `@tauri-apps/api/event` to `preview/mock.ts`.
2. In the mock, an unknown command throws `mock: unsupported command <name>`. A test fails when the app calls a command the mock does not know.
3. The mock has scenarios (for example `running`, `stopped`, `k8spods`), so each screen state can be opened by URL and screenshotted.
4. Checks click with the mouse and with the keyboard. Assertions are never weakened to make one engine pass.
5. A change is done when unit tests, Rust tests and `npm run check` pass in WebKit and Chromium. `PW_ENGINES=webkit` runs WebKit only.

## Consequences

1. Contributors can run every screen without a Mac app or Rust.
2. Every screen must handle eight states: first load, loaded, empty, no search match, engine stopped, engine not reachable, action running, action failed.

Sources: `docs/plan/01-review-engineering.md` (E14), `docs/plan/05-implementation-plan.md` (task 0.3), `docs/plan/04-design-spec.md` (section 8) at commit 29b538e; `AGENTS.md`; `CHANGELOG.md` 0.3.0 item 31.
