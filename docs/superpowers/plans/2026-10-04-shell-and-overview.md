# Shell, visual system and Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app a fixed-sidebar shell, a sage visual system, and an Overview that shows VM health, controls the VM, lists containers, and installs Colima via Homebrew when missing.

**Architecture:** Pure logic (output cleaning, usage math, contrast) lives in `src/lib/` and is tested first with `node --test`. Shared presentational pieces live in `src/ui/`. New screens (`Overview`, `VmCard`, `InstallCard`, `RunPicker`) sit in `src/` beside the existing ones, which adopt the new pieces. Rust gains three small units: a frame reader, `env_check`, `install_tools`.

**Tech Stack:** Tauri 2 (Rust), React 18, TypeScript, Vite. Tests: `node --test` with `--experimental-strip-types` (Node 22.6+), Rust unit tests, a Playwright layout script run in the authoring sandbox.

**Spec:** `docs/superpowers/specs/2026-10-04-shell-and-overview-design.md`

## Global Constraints

- Light palette: page `#f3f5f3`, sidebar and table head `#e8ece8`, card `#f0f2f0`, border `#d3dad4`, ink `#1c2a27`, muted `#66726e`, primary `#397863`, danger `#a14b3f`.
- Dark palette: page `#121a18`, sidebar `#172321`, card `#1a2724`, border `#2b3a36`, ink `#e6eeea`, muted `#8fa09a`, primary `#5aa688` with text `#0b1a15`, danger `#e07a6d`.
- Contrast minimums, both modes: ink on page 7:1; muted on page, text on primary, danger on page 4.5:1.
- Layout: sidebar 232px; `html, body, #root` are `height: 100%; overflow: hidden`; `.content` is the only scroller; below 700px the sidebar becomes a top bar.
- Polling: `colima list --json` every 3 s, `docker stats --no-stream` every 5 s, `docker system df` every 30 s; all pause while the window is hidden.
- Events: `colima-progress`, `pull-progress`, `brew-progress`. A payload starting with `\r` replaces the previous line.
- `env_check` searches `/opt/homebrew/bin`, `/usr/local/bin`, `/home/linuxbrew/.linuxbrew/bin`, then `PATH`. Install runs `brew install <names>`, names a subset of `colima`, `docker`, only on click. The Homebrew bootstrap script is shown, never run.
- One primary (green) button per screen; danger red only on destructive actions; sentence case; verb-first labels; no exclamation marks.
- No new runtime dependencies. Icons are inline SVG. The Rust changes stay limited to the three units above.

## Review Focus

- Colima ends output with a `\r` progress frame and no newline: the last frame must still be delivered (Task 2 and Task 4 tests).
- No containers running: `docker stats` prints nothing, and meters must show 0, never NaN (Task 3 test).
- No profile exists yet (`colima list --json` prints nothing): the Overview shows the start-first-VM state, not an error (Task 6 scenario check).
- `docker system df` reports `Reclaimable` as `0B` with no percentage, or `2.1GB (80%)`: both parse (Task 3 test).
- Installing a tool that is already installed makes `brew` exit 0 with a warning: the app treats it as success and re-checks (Task 6 scenario check).

---

### Task 1: Tokens and contrast

**Files:**
- Create: `src/lib/contrast.ts`, `src/lib/contrast.test.ts`, `src/ui/tokens.css`

**Interfaces:**
- Produces: `contrastRatio(a: string, b: string): number` (hex in, WCAG ratio out). CSS variables `--page --sidebar --card --border --ink --muted --primary --on-primary --danger` under `:root` and `@media (prefers-color-scheme: dark)`.

- [ ] **Step 1: Write the failing test** `contrast.test.ts`: `contrastRatio("#000000","#ffffff")` is 21; each pair from Global Constraints meets its minimum (light ink/page ≥ 7, light muted/page ≥ 4.57 rounded, white/primary ≥ 4.5, danger/page ≥ 4.5, and the four dark pairs).
- [ ] **Step 2: Run** `npm test` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `contrastRatio` in `src/lib/contrast.ts` using WCAG relative luminance; write `tokens.css` with the two palettes.
- [ ] **Step 4: Run** `npm test` — Expected: all pass.
- [ ] **Step 5: Commit** `git add src/lib src/ui/tokens.css && git commit -m "feat: palette tokens with contrast tests"`

### Task 2: Output cleaning

**Files:**
- Create: `src/lib/logClean.ts`, `src/lib/logClean.test.ts`

**Interfaces:**
- Produces: `type Level = "info" | "warn" | "error" | "plain"`; `type LogLine = { level: Level; text: string; raw: string }`; `cleanFrame(raw: string): LogLine`; `applyFrame(lines: LogLine[], payload: string): LogLine[]`; `summarizeFailure(lines: LogLine[]): string`.

- [ ] **Step 1: Write the failing tests**: `cleanFrame('\x1b[32mINFO\x1b[0m[0000] starting colima')` gives level `info`, text `starting colima`; `cleanFrame('time="2026-10-04T10:00:00Z" level=error msg="exit status 1"')` gives `error`, `exit status 1`; `cleanFrame('level=warning msg="slow disk"')` gives `warn`; `cleanFrame('> [hostagent] ready')` gives `plain`, `[hostagent] ready`; `applyFrame([a], "\r45%")` replaces `a`; `applyFrame([a], "a text")` with identical text collapses to one line; `applyFrame([], "\r50%")` appends (nothing to replace); `summarizeFailure` returns the last error line's text, else the last non-empty line, else `""`.
- [ ] **Step 2: Run** `npm test` — Expected: FAIL.
- [ ] **Step 3: Implement** the three functions in `logClean.ts`; strip ANSI with `/\x1b\[[0-9;?]*[A-Za-z]/g`; try logfmt, then logrus `LEVEL[nnnn] msg`, then the `> ` prefix; `raw` always keeps the input.
- [ ] **Step 4: Run** `npm test` — Expected: all pass.
- [ ] **Step 5: Commit** `git commit -m "feat: clean Colima output frames"`

### Task 3: Usage math

**Files:**
- Create: `src/lib/usage.ts`, `src/lib/usage.test.ts`

**Interfaces:**
- Consumes: `parseBytes(s: string): number`, `parsePercent(s: string): number`, `parseUsage(s: string): {used:number;limit:number}` from `src/containerInfo.ts`.
- Produces: `type StatRow = { CPUPerc: string; MemUsage: string }`; `type DfRow = { Type: string; Size: string; Reclaimable: string }`; `sumStats(rows: StatRow[]): { cores: number; memBytes: number }` (cores = summed percent / 100); `parseDf(rows: DfRow[]): { totalBytes: number; reclaimableBytes: number }`; `fraction(used: number, total: number): number` clamped to 0..1.

- [ ] **Step 1: Write the failing tests**: `sumStats([])` is `{cores:0, memBytes:0}`; two rows `150%` and `50%` give `cores` 2; `MemUsage` `"12.5MiB / 2GiB"` contributes 12.5 MiB; a `"--"` percent contributes 0; `parseDf` of `Reclaimable: "0B"` and `"2.1GB (80%)"` gives 2.1e9 reclaimable; `fraction(5, 0)` is 0 and `fraction(15, 10)` is 1.
- [ ] **Step 2: Run** `npm test` — Expected: FAIL.
- [ ] **Step 3: Implement** in `usage.ts`; take the leading size token of `Reclaimable`.
- [ ] **Step 4: Run** `npm test` — Expected: all pass.
- [ ] **Step 5: Commit** `git commit -m "feat: usage aggregation helpers"`

### Task 4: Rust frame reader, env_check, install_tools

**Files:**
- Modify: `src-tauri/src/main.rs` (the `stream` function and handler list; new tests in the existing `tests` module)

**Interfaces:**
- Produces: `fn split_frames(bytes: &[u8]) -> Vec<(String, bool)>` (text, replaces-previous); `fn parse_version(out: &str) -> Option<String>`; `struct Tool { path: String, version: String }`; `struct EnvReport { brew: Option<Tool>, colima: Option<Tool>, docker: Option<Tool> }`; commands `env_check() -> EnvReport` and `install_tools(app, names: Vec<String>) -> Result<(), String>` (event `brew-progress`).

- [ ] **Step 1: Write the failing tests**: `split_frames(b"a\nb")` is `[("a",false),("b",false)]`; `b"10%\r20%\r30%\n"` is `[("10%",false),("20%",true),("30%",true)]`; `b"a\r\nb"` is `[("a",false),("b",false)]`; `b"x\r50%"` flushes `("50%",true)` at the end; `parse_version("colima version 0.8.1")` is `Some("0.8.1")`; `"Docker version 27.3.1, build ce12230"` gives `27.3.1`; `""` gives `None`; `install_tools` rejects an empty list and any name outside `colima`, `docker`.
- [ ] **Step 2: Run** `cd src-tauri && cargo test` — Expected: FAIL to compile. (Cannot be run in the authoring sandbox; report as unrun.)
- [ ] **Step 3: Implement** the functions; make `stream` read bytes, emit `\r`-prefixed payloads for replacing frames, keep the last 30 frames as the error; register both commands in `generate_handler!`.
- [ ] **Step 4: Run** `cd src-tauri && cargo test` — Expected: PASS (user's machine).
- [ ] **Step 5: Commit** `git commit -m "feat: frame reader, env_check, install_tools"`

### Task 5: Shell, shared components, layout check

**Files:**
- Create: `src/ui/icons.tsx`, `src/ui/PageHeader.tsx`, `src/ui/StatusPill.tsx`, `src/ui/IconButton.tsx`, `src/ui/Card.tsx`, `src/ui/Meter.tsx`, `src/ui/OutputLog.tsx`, `src/Shell.tsx`, `scripts/check-layout.mjs`
- Modify: `src/App.tsx` (the old Colima tab becomes Profiles), `src/styles.css` (import tokens, shell layout, table selected-row style), `src/ui.tsx` (re-export EmptyState), `preview/mock.ts` (only `?scenario=two`: a second, stopped profile)

**Interfaces:**
- Consumes: `LogLine`, `applyFrame`, `summarizeFailure` (Task 2); `listen` from `@tauri-apps/api/event`.
- Produces: `<PageHeader breadcrumb: string, title: string, status?: ReactNode />`; `<StatusPill state: "running"|"stopped"|"starting"|"stopping"|"error" />`; `<IconButton label: string, icon: IconName, onClick, danger?: boolean />`; `<Meter label: string, value: string, fraction: number />`; `<OutputLog event: string, onDone?: (failure: string|null) => void />`; `type Tab = "Overview" | "Containers" | "Images" | "Volumes" | "Profiles"`; `<Shell nav: Tab, onNav: (t: Tab) => void, profiles: Profile[], active: string | null, onSelect: (name: string) => void, children />` (footer is a picker at two or more profiles, plain text `runtime · N CPU · N GB` otherwise); `type IconName`.

- [ ] **Step 1: Write the failing check** `scripts/check-layout.mjs`: opens `preview/index.html` at 1100x680 and 800x600, visits Overview, Containers, Images, Volumes, Profiles and a container's Logs tab, asserts `document.scrollingElement.scrollHeight <= window.innerHeight` on each, asserts `.content` exists, asserts the sidebar footer is plain text with one profile and a `select` under `?scenario=two`, prints `ok <page> <size>` per check.
- [ ] **Step 2: Run** `node scripts/build-preview.mjs && node scripts/check-layout.mjs` — Expected: FAIL (no `.content`).
- [ ] **Step 3: Implement** the components and `Shell` per spec section 1; the selected table row uses a visible tint; OutputLog replaces on `\r`, colours warn and error, has Copy raw output, scrolls inside its own pane, and shows `summarizeFailure` as a headline when `onDone` receives a failure.
- [ ] **Step 4: Run** the same command — Expected: `ok` for every page and size. View the screenshots it saves to `/tmp/layout-*.png`.
- [ ] **Step 5: Commit** `git commit -m "feat: fixed-sidebar shell, shared components, layout check"`

### Task 6: Overview and onboarding

**Files:**
- Create: `src/Overview.tsx`, `src/VmCard.tsx`, `src/InstallCard.tsx`, `src/RunPicker.tsx`, `src/useEnv.ts`
- Modify: `src/hooks.ts` (pause polling while `document.hidden`), `src/App.tsx`, `preview/mock.ts` (extend with `env_check`, `install_tools`, all-container `stats`, `system df`, `?scenario=running|stopped|starting|failed|missing|none`)

**Interfaces:**
- Consumes: Task 2, 3, 5 interfaces; `EnvReport` from Task 4 (TypeScript mirror in `useEnv.ts`).
- Produces: `useEnv(): { env: EnvReport | null; recheck(): Promise<void> }`; `<Overview profiles, ctx, onNav />`; `<VmCard profile: Profile|null, totals />`; `<InstallCard env: EnvReport, onDone />`; `<RunPicker ctx, onPick(imageRef: string) />`.

- [ ] **Step 1: Write the failing check**: extend `check-layout.mjs` with scenarios: `running` shows Restart and Stop; `stopped` shows exactly one primary button, labelled Start; `starting` shows the output log; `failed` shows a headline and Retry; `missing` shows the install card with the `brew install` command text; `none` shows a start-first-VM state; an already-installed tool path reports success. Each prints `ok <scenario>`.
- [ ] **Step 2: Run** the build and check — Expected: FAIL on the first scenario.
- [ ] **Step 3: Implement** per spec section 2 and 3: VM card states, meters from Task 3, searchable containers panel (running first, then by name), Pull image secondary and Run image primary, Needs attention strip only when actionable, empty state, install card with the Homebrew-missing variant (copyable bootstrap command), re-check after install.
- [ ] **Step 4: Run** the build and check — Expected: `ok` for all scenarios; review screenshots for each.
- [ ] **Step 5: Commit** `git commit -m "feat: Overview with VM control and Homebrew install"`

### Task 7: Restyle, rename, document, ship

**Files:**
- Modify: `src/Containers.tsx`, `src/Images.tsx`, `src/Volumes.tsx`, `src/ContainerDetail.tsx`, `src/Profiles.tsx`, `src/PullPanel.tsx`, `src/EditPanel.tsx`, `src/RunPanel.tsx`, `README.md`

**Interfaces:**
- Consumes: Task 5 components and `OutputLog`.

- [ ] **Step 1: Extend the check** to open the Profiles page and assert its first paragraph explains what a profile is, and that Profiles, the Pull panel and the VM card all render `OutputLog`.
- [ ] **Step 2: Run** the build and check — Expected: FAIL on the new assertions.
- [ ] **Step 3: Implement** the restyle with the shared components; add the one-line explainer that a profile is a separate Colima VM to the Profiles page; use `OutputLog` in Profiles and the Pull panel; add a README changelog entry.
- [ ] **Step 4: Run** `npm test`, then the build and check — Expected: all tests pass; every check prints `ok`.
- [ ] **Step 5: Ship**: commit `git commit -m "feat: restyle screens, rename Profiles, changelog"`, zip the project excluding `node_modules`, `src-tauri/target`, `dist`, publish the preview artifact, and report which Rust tests could not be run.
