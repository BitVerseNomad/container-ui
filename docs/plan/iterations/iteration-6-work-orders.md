# Iteration 6, part 1: work orders 8.1 to 8.8

Read `../HANDOFF.md` and `README.md` (this folder) first. Part 2 (8.9 to 8.15) is in `iteration-6-part-2-work-orders.md`. Do part 1 first, then part 2, then one report for the whole iteration.

## What this iteration delivers (part 1)

1. OpenPier lives in the menu bar and tells you, in plain words, when a container breaks (WO-8.1a, 8.1b, 8.2a, 8.2b).
2. Every problem the app can explain has a public page and a "Learn more" (WO-8.3a, 8.3b); logs are worth using (WO-8.4); bug reports start with "Copy details" and a log file; a crashed page never leaves a blank window (WO-8.5a, 8.5b, 8.6).
3. The real engine is tested every night, and a 200-container list is proven fast (WO-8.7, 8.8).

## Order

8.1a, 8.1b, 8.2a, 8.2b, 8.3a, 8.3b, 8.4, 8.5a, 8.5b, 8.6, 8.8, 8.7.

Why 8.8 before 8.7: 8.7 is slow to prove (it needs a runner), 8.8 is not. 8.5a and 8.5b must come before 8.6 (the error page uses "Copy details"). 8.1a must come before 8.2a (the notifier reads the state the menu bar code holds).

## Facts that hold for every work order here (checked on 2026-11-12)

1. After iteration 1 the Lima code, the AI chat, `tokio`, `sqlx`, `uuid`, `chrono`, `anyhow`, `lazy_static` and `dirs` are gone. Do not add them back. Rust code here uses only `std` (`std::sync::OnceLock`, `std::thread`, `std::process::Command`) and `serde`, `serde_json`, `tauri`.
2. The window is labelled `main` (capability file `src-tauri/capabilities/default.json`, `"windows": ["main"]`). That file has one permission, `core:event:default`. **No work order in this part widens it.** The content security policy in `src-tauri/tauri.conf.json` stays as it is too. Everything new on the Rust side talks to the page with commands and `emit`, which `core:event:default` and the existing IPC already allow.
3. The bundle identifier is `dev.openpier.desktop`. Never write it in code: ask Tauri (`app.path().app_log_dir()`).
4. `docker events` is allowed by the backend only with both `--since` and `--until` (function `events_args_ok`). It is a bounded query, not a live stream. Everything in this part that "watches events" asks for a short window every few seconds. (`08-feature-gaps.md` G2 item 4 says "events stream"; this is what the allowlist permits. See "Plan contradictions" in the report.)
5. Rust files named below are where iteration 4 put the code (`exec.rs`, `engine.rs`). Each Starting state proves it with a grep. If a grep prints something else, stop and report. Do not guess the new place.
6. Test style: Rust tests are named `given_<x>_when_<y>_then_<z>`. Node tests are `src/**/*.test.ts` with `node:test` and `node:assert/strict` (run by `npm test`). Component tests are `src/**/*.test.tsx` with vitest. Browser checks are `scripts/check-<name>.mjs`, using `scripts/lib/check.mjs`.
7. There are no GitHub pull requests: each work order is merged into the local `main` and its text is the file named under "Pull request text". Where a step says "in the PR", it means that file.
8. Components are imported from `src/ui` (WO-5.1 moved them there from `src/ui/op`). Node is 22.
9. Words on screen come from `04-design-spec.md`, `08-feature-gaps.md` and `07-projects-spec.md`, and the words quoted in a work order are the design (spec section 9, first paragraph; the author accepted them). There is no "proposal" marker anywhere. "Stop and report" stays only for a Starting state that does not match, a command whose output differs, and a class, word or file that is still missing: name it in the report.
10. The mock-coverage test of WO-0.3 (`src/lib/mockCoverage.test.ts` or the name it has: `grep -rln NOT_IN_PREVIEW src`) fails when the page calls an `invoke` command that `preview/mock.ts` does not handle. Every work order here that adds a command also adds its `case` to the `invoke` switch of `preview/mock.ts` (a step says which). Check scripts open pages with `open(path, opts)` from `scripts/lib/check.mjs`, report with `check(cond, message)` and end with `await done()`. `open()` already fails a script on any `pageerror`, so no check here repeats a "no page error" line, except where a step says the opposite (WO-8.6). `npm test` prints `# pass N` when its output is not a terminal and `ℹ pass N` when it is: every `grep` on test counts here uses `grep -E "^(ℹ|#) (pass|fail)"`.

---

## WO-8.1a Menu bar item: Rust side

Needs: iteration 4 merged (engine.rs, exec.rs). Plan task 8.1 (G1), first of two work orders.

### Why

Closing the window ends the app today (G1). This work order adds the menu bar item, its icon, its menu and the "keep running when the window closes" behaviour, all in Rust, so it works with the window closed. WO-8.1b connects the page.

### Read first

1. `docs/plan/08-feature-gaps.md` section 3, G1.
2. `docs/plan/04-design-spec.md` section 5.3 (engine state words) and section 9 (words).
3. `src-tauri/src/main.rs`, `src-tauri/src/exec.rs` (`output_with_deadline`, `find_bin`, `path_env`), `src-tauri/src/engine.rs` (`context_ok`), `src-tauri/Cargo.toml`.
4. Tauri docs, system tray: https://v2.tauri.app/learn/system-tray/ . API pages: https://docs.rs/tauri/2.12.5/tauri/tray/struct.TrayIcon.html and https://docs.rs/tauri/2.12.5/tauri/tray/struct.TrayIconBuilder.html . Window events: https://docs.rs/tauri/2.12.5/tauri/enum.WindowEvent.html .

### Starting state

Run, expect the output shown. If it differs, stop and report.

```sh
test "$(wc -l < src-tauri/src/main.rs)" -lt 200 && echo main-small
grep -rn "pub(crate) fn output_with_deadline" src-tauri/src            # one line, in src-tauri/src/exec.rs
grep -rn "fn find_bin\|fn path_env" src-tauri/src                      # two lines, in src-tauri/src/exec.rs
grep -rn "fn context_ok" src-tauri/src                                 # one line, in src-tauri/src/engine.rs
grep -n "generate_handler\|\.setup(\|on_window_event\|\.plugin(" src-tauri/src/main.rs   # generate_handler only
grep -n "^tauri = " src-tauri/Cargo.toml                               # tauri = { version = "2", features = [] }
ls docs/plan/design/tray/tray-running.png docs/plan/design/tray/tray-stopped.png docs/plan/design/tray/tray-problem.png
cat src-tauri/capabilities/default.json | grep -c "core:event:default"  # 1
```

Expected: `main-small`, then the greps as commented, and the three icon files listed.

**The menu bar icons.** The three files are the design: black-and-transparent PNG "template" images, 44x44 pixels (macOS recolours them for light and dark menu bars). Three blocks on a pier: filled when a machine runs, outlined when none runs, two blocks and an exclamation mark when something needs attention. Before step 1, copy them unchanged: `cp docs/plan/design/tray/tray-*.png src-tauri/icons/`. Do not redraw them and do not use the app icon. If the `ls` fails, stop and report.

### Do not touch

`src-tauri/capabilities/default.json`, the CSP in `tauri.conf.json`, the allowlists in `allow.rs`, any `.tsx` file.

### Steps

1. **Cargo features.** In `src-tauri/Cargo.toml` replace `tauri = { version = "2", features = [] }` with `tauri = { version = "2", features = ["tray-icon", "image-png"] }`. `tray-icon` is the feature the Tauri tray page names. `image-png` is needed by `Image::from_bytes`. Not verified: that `image-png` is the exact feature name; `cargo build` in step 7 proves it. If it does not compile, read the `Image::from_bytes` page on docs.rs, use the feature it names, and say so in the PR.
2. **Make three helpers visible.** In `src-tauri/src/exec.rs`, if `find_bin` and `path_env` are not `pub(crate)`, make them `pub(crate)`. Nothing else changes there.
3. **Write the tests first.** Create `src-tauri/src/tray.rs` with only the types, the two pure functions as `todo!()`, and the test module below. Run `cd src-tauri && cargo test tray::` and see the tests fail on `todo!`. Commit the failing tests. Then write the bodies (step 4).

   Tests (all in `tray.rs`, module `tests`; `sync(...)` is a small helper in the test module that builds a `TraySync`; the engine used is `TrayEngine { id: "colima", name: "Colima · default", context: "colima", machine: Some("default") }`):

   1. `given_no_answer_when_icon_state_then_stopped`: `icon_state(None, 0) == Stopped`.
   2. `given_engine_answers_and_no_attention_when_icon_state_then_running`: `icon_state(Some(true), 0) == Running`.
   3. `given_engine_answers_and_attention_when_icon_state_then_problem`: `icon_state(Some(true), 2) == Problem`.
   4. `given_engine_silent_and_attention_when_icon_state_then_stopped`: `icon_state(Some(false), 2) == Stopped`.
   5. `given_running_machine_engine_when_menu_model_then_lines_in_order`: engine above, answers `Some(true)`, attention 2, projects `shop` and `billing`. The result equals exactly: `Item("engine", "Colima · default · Running", disabled)`, `Item("toggle-engine", "Stop Colima · default")`, `Item("doctor", "2 need attention")`, `Separator`, `Item("stop-project:shop", "Stop shop")`, `Item("stop-project:billing", "Stop billing")`, `Separator`, `Item("open", "Open OpenPier")`, `Item("quit", "Quit")`.
   6. `given_stopped_machine_engine_when_menu_model_then_start_item`: answers `Some(false)`: the first line ends with `Stopped` and the second is `Item("toggle-engine", "Start Colima · default")`.
   7. `given_engine_without_machine_when_menu_model_then_no_toggle`: `machine: None`: there is no `toggle-engine` item.
   8. `given_zero_attention_when_menu_model_then_no_doctor_item`.
   9. `given_one_attention_when_menu_model_then_label_is_1_need_attention`.
   10. `given_ten_projects_when_menu_model_then_eight_stop_items`.
   11. `given_no_engine_when_menu_model_then_only_open_and_quit`: exactly two items, no separator.
   12. `given_engine_and_no_projects_when_menu_model_then_one_separator_before_open`.
4. **Write `src-tauri/src/tray.rs`.** Content, in this order:

   1. Imports: `serde::{Deserialize, Serialize}`, `std::process::Command`, `std::sync::atomic::{AtomicBool, Ordering}`, `std::sync::{Mutex, OnceLock}`, `std::time::Duration`, `tauri::image::Image`, `tauri::menu::{Menu, MenuItem, PredefinedMenuItem}`, `tauri::tray::TrayIconBuilder`, `tauri::{AppHandle, Emitter, Manager}`.
   2. Constants: `TRAY_ID = "main"`, `POLL = 2 s`, `PROBE_DEADLINE = 2 s`, `MAX_PROJECTS = 8`.
   3. Types, all `#[derive(Clone, Debug, Default, Deserialize, PartialEq)]` and `#[serde(rename_all = "camelCase")]`:
      `pub struct TrayEngine { pub id: String, pub name: String, pub context: String, pub machine: Option<String> }`,
      `pub struct TrayProject { pub id: String, pub name: String }`,
      `pub struct TraySync { pub engine: Option<TrayEngine>, pub attention: u32, pub projects: Vec<TrayProject>, pub keep_in_menu_bar: bool }`.
      (`TraySync` also gets `#[serde(default)]` so WO-8.2a can add a field without breaking the page.)
   4. `#[derive(Clone, Copy, Debug, PartialEq)] pub enum IconState { Running, Stopped, Problem }` and
      `pub fn icon_state(answers: Option<bool>, attention: u32) -> IconState`: `Some(true)` with attention above 0 is `Problem`, `Some(true)` otherwise is `Running`, everything else is `Stopped`.
   5. `#[derive(Clone, Debug, PartialEq)] pub enum Entry { Item { id: String, label: String, enabled: bool }, Separator }` and
      `pub fn menu_model(sync: &TraySync, answers: Option<bool>) -> Vec<Entry>`. Three blocks, joined by one `Separator` between non-empty blocks:
      1. Engine block, only when `sync.engine` is `Some`: a disabled item `engine` with label `"{name} · Running"` when `answers == Some(true)`, else `"{name} · Stopped"` (words from spec 5.3); then, only when `machine` is `Some`, item `toggle-engine` with label `"Stop {name}"` when running, else `"Start {name}"`; then, only when `attention > 0`, item `doctor` with label `"{attention} need attention"` (words from G1 item 2).
      2. Project block: one item per project, at most `MAX_PROJECTS`, id `"stop-project:{id}"`, label `"Stop {name}"`.
      3. Bottom block: `open` with label `"Open OpenPier"`, `quit` with label `"Quit"` (words from G1 item 2).
   6. State: `pub struct Shared { pub sync: TraySync, pub answers: Option<bool>, pub expected_stop_until_ms: u64 }` (`Default`), `pub fn shared() -> &'static Mutex<Shared>` (a `OnceLock<Mutex<Shared>>`), `static KEEP: AtomicBool = AtomicBool::new(true)`, `pub fn keep_in_menu_bar() -> bool`.
   7. Icons: `fn icon_bytes(s: IconState) -> &'static [u8]` using `include_bytes!("../icons/tray-running.png")` and the other two. A missing file is a compile error on purpose.
   8. `fn engine_answers(context: &str) -> bool`: false when `!crate::engine::context_ok(context)`; else runs `docker --context <context> version --format {{.Server.Version}}` with `Command::new(crate::exec::find_bin("docker"))`, `.env("PATH", crate::exec::path_env())`, through `crate::exec::output_with_deadline(cmd, PROBE_DEADLINE)`; true only for `Ok((true, _, _))`.
   9. `fn build_menu(app: &AppHandle, entries: &[Entry]) -> tauri::Result<Menu<tauri::Wry>>`: `Menu::new(app)?`, then for each entry `menu.append(&MenuItem::with_id(app, id, label, enabled, None::<&str>)?)?` or `menu.append(&PredefinedMenuItem::separator(app)?)?`.
   10. `fn refresh(app: &AppHandle)`: reads `shared()`, computes `icon_state` and `menu_model`; compares with the last applied pair (a `Mutex<Option<(IconState, Vec<Entry>)>>` in a `OnceLock`); when different: `app.tray_by_id(TRAY_ID)`, then `set_icon(Some(Image::from_bytes(icon_bytes(state))?))`, then `set_icon_as_template(true)` again (call it after every `set_icon`; Not verified that `set_icon` resets the template flag, calling it again is harmless), then `set_menu(Some(build_menu(...)?))`. Errors are ignored (`let _ =`), the next tick tries again.
   11. `fn show_main(app: &AppHandle)`: `app.get_webview_window("main")`, then `.show()`, `.unminimize()`, `.set_focus()`, errors ignored.
   12. `#[derive(Serialize, Clone)] struct Action { kind: &'static str, id: Option<String> }` and `fn emit_action(app, kind, id)` doing `app.emit("tray-action", Action {..})`.
   13. `fn on_menu(app: &AppHandle, id: &str)`: `"open"` calls `show_main`; `"quit"` calls `app.exit(0)`; `"doctor"` calls `show_main` then `emit_action("open-doctor", None)`; `"toggle-engine"` reads `shared().answers`: running emits `"stop-engine"` after calling `expect_stop()`, else emits `"start-engine"`; an id starting with `"stop-project:"` emits `"stop-project"` with the rest as `id`.
   14. `pub fn expect_stop()`: sets `shared().expected_stop_until_ms` to now plus 120000 (now from `std::time::SystemTime` since `UNIX_EPOCH`, in milliseconds).
   15. Commands: `#[tauri::command] pub fn tray_sync(app: AppHandle, payload: TraySync)`: stores `payload` in `shared().sync`, sets `KEEP` from `payload.keep_in_menu_bar`, calls `refresh`. `#[tauri::command] pub fn watch_expect_stop()`: calls `expect_stop()`.
   16. `pub fn setup(app: &tauri::App) -> tauri::Result<()>`: builds the first menu from `TraySync::default()` and `None`, creates `TrayIconBuilder::with_id(TRAY_ID).icon(Image::from_bytes(icon_bytes(IconState::Stopped))?).icon_as_template(true).menu(&menu).show_menu_on_left_click(true).on_menu_event(|app, event| on_menu(app, event.id.as_ref())).build(app)?`, then starts the loop: a `std::thread::spawn` that every `POLL` reads the engine context from `shared()`, sets `shared().answers` to `engine_answers(ctx)` (or `None` with no engine), and calls `refresh`. The loop never holds the lock while it runs `docker`.
5. **Register in `src-tauri/src/main.rs`.** Add `mod tray;` beside the other `mod` lines. In the `tauri::Builder`, before `.invoke_handler(...)`, add:
   ```rust
   .setup(|app| { tray::setup(app)?; Ok(()) })
   .on_window_event(|window, event| {
       if let tauri::WindowEvent::CloseRequested { api, .. } = event {
           if window.label() == "main" && tray::keep_in_menu_bar() {
               api.prevent_close();
               let _ = window.hide();
           }
       }
   })
   ```
   and add `tray::tray_sync, tray::watch_expect_stop` to the `generate_handler![ ... ]` list. If a `.setup(` already exists (it did not at the Starting state), stop and report.
6. Run `cd src-tauri && cargo fmt` and `cargo clippy --all-targets -- -D warnings`. Fix what clippy says without changing behaviour.
7. Run `cd src-tauri && cargo build`. It must compile with the three icons present.
8. Add one line to `CHANGELOG.md` under the unreleased heading: `The app now has a menu bar item and keeps running when the window is closed.`

### Tests to write first

Step 3 lists them (12 tests, file `src-tauri/src/tray.rs`). Commit them failing, then passing.

### Done when

```sh
cd src-tauri && cargo test tray:: 2>&1 | grep "test result"       # ok. 12 passed (at least 12), 0 failed
cd src-tauri && cargo build 2>&1 | tail -1                         # Finished
git diff --stat main -- src-tauri/capabilities src-tauri/tauri.conf.json   # prints nothing
grep -n '"tray-icon"' src-tauri/Cargo.toml                         # one line
```

Plus the gate in `../HANDOFF.md` section 5. Eyes: none yet (the page is connected in WO-8.1b).

### Pull request text

There is no GitHub pull request. Write `docs/plan/iterations/pr/wo-8.1a.md` (screenshots in `docs/plan/iterations/pr/wo-8.1a/`), with the headings of `../HANDOFF.md` section 6, then merge with `git merge --no-ff wo-8.1a` into the local `main`. First line of the file: `wo-8.1a: OpenPier has a menu bar item that stays when the window closes`

---

## WO-8.1b Menu bar item: the page side

Needs: WO-8.1a. Plan task 8.1 (G1), second of two.

### Why

The menu needs to know the selected engine, the Doctor count and the running projects, and its Start, Stop and "need attention" lines need to do something. The page owns all of that, so it pushes it to Rust and reacts to the menu's actions with the code the buttons already use.

### Read first

1. `docs/plan/08-feature-gaps.md` G1.
2. `src/Shell.tsx` (the sidebar Doctor count, the engine switcher), `src/lib/engines.ts` (`useEngine`), `src/lib/router.ts` (`go`), `src/lib/machines/colima.ts`.
3. `preview/mock.ts` (the `invoke` switch and the `listen` helper at the top).
4. `scripts/lib/check.mjs`.

### Starting state

```sh
test -f src-tauri/src/tray.rs && echo tray-rust
grep -n "export" scripts/lib/check.mjs                              # open, check, done
grep -rn "start_profile\|stop_profile" src --include=*.ts --include=*.tsx | grep -v test   # lines only in src/lib/machines/colima.ts
grep -n "export" src/lib/machines/colima.ts                          # note the names of the start and stop functions: START_FN and STOP_FN below
grep -rn "count bad\|count.bad" src/Shell.tsx                        # the line that renders the Doctor count: note the variable, ATTENTION below
grep -rln "compose_down\|compose_action" src --include=*.ts --include=*.tsx | grep -v test   # the files Projects use; note the function the Stop button of a project row calls: STOP_PROJECT_FN
```

Expected: `tray-rust`, then the lines described. If `colima.ts` has no start and no stop function, or if no single function stops a project, stop and report.

### Do not touch

Rust files (WO-8.1a did them), `src-tauri/capabilities/`, the engine switcher's look.

### Steps

1. **Tests first.** Create `src/lib/trayBridge.test.ts` (node tests):
   1. `given_colima_engine_when_build_tray_sync_then_context_and_machine_are_set`: input engine `{ id: "colima", kind: "colima", name: "Colima · default", context: "colima", machine: "default" }` gives `engine` with the same four fields and nothing else.
   2. `given_docker_desktop_engine_when_build_tray_sync_then_machine_is_null`.
   3. `given_no_engine_when_build_tray_sync_then_engine_is_null`.
   4. `given_two_running_projects_when_build_tray_sync_then_both_are_listed_by_id_and_name`.
   5. `given_same_input_twice_when_same_sync_then_true_and_one_field_changed_then_false`.
   Then `src/lib/trayBridge.test.tsx` (vitest, jsdom; `vi.mock("@tauri-apps/api/core")` with an `invoke` spy, `vi.mock("@tauri-apps/api/event")` with a `listen` that stores the callback):
   6. `given_the_hook_when_it_mounts_then_invoke_tray_sync_is_called_once_with_the_payload`.
   7. `given_the_same_input_when_it_rerenders_then_tray_sync_is_not_called_again`.
   8. `given_a_stop_engine_action_when_it_arrives_then_stopEngine_is_called`; the same for `start-engine`, `stop-project` (called with the id) and `open-doctor`.
   Run `npm test`, see them fail, commit.
2. **`src/lib/watchSettings.ts`** (new, in full):
   ```ts
   // The settings the menu bar item and the notifier read. One module, so WO-8.11 moves them in one place.
   const KEEP_KEY = "openpier:keep-in-menu-bar";
   export function readKeepInMenuBar(): boolean {
     try { return localStorage.getItem(KEEP_KEY) !== "0"; } catch { return true; }
   }
   export function writeKeepInMenuBar(on: boolean): void {
     try { localStorage.setItem(KEEP_KEY, on ? "1" : "0"); } catch { /* storage may be blocked */ }
   }
   ```
3. **`src/lib/trayBridge.ts`** (new). Exports:
   ```ts
   export type TrayEngine = { id: string; name: string; context: string; machine: string | null };
   export type TrayProject = { id: string; name: string };
   export type TraySync = { engine: TrayEngine | null; attention: number; projects: TrayProject[]; keepInMenuBar: boolean };
   export type TrayActions = { startEngine(): void; stopEngine(): void; stopProject(id: string): void; openDoctor(): void };
   export function buildTraySync(i: { engine: (TrayEngine & { kind: string }) | null; attention: number; projects: TrayProject[]; keepInMenuBar: boolean }): TraySync;
   export function sameSync(a: TraySync, b: TraySync): boolean;   // JSON.stringify equality
   export function useTrayBridge(input: Parameters<typeof buildTraySync>[0], actions: TrayActions): void;
   ```
   `buildTraySync` copies only `id, name, context, machine` of the engine (machine is `null` when absent). `useTrayBridge`: one `useEffect` that calls `invoke("tray_sync", { payload })` when the built value differs from the last sent (`useRef`), and one `useEffect` that calls `listen<{ kind: string; id?: string }>("tray-action", ...)` once, maps `kind` to the four actions through a ref holding the latest `actions`, and unlistens on unmount. Imports `invoke` from `@tauri-apps/api/core` and `listen` from `@tauri-apps/api/event`.
4. **Expect-stop on every stop.** In `src/lib/machines/colima.ts`, in STOP_FN (the function that calls `stop_profile`), call `await invoke("watch_expect_stop")` just before `stop_profile`. This is what tells the notifier (WO-8.2a) that a stop was asked for, wherever the click came from.
5. **Mount it.** In `src/Shell.tsx` call `useTrayBridge(...)` once: `engine` from `useEngine()` (with `machine` set to the Colima machine name when `kind === "colima"`, else `null`), `attention` is ATTENTION (the number the sidebar Doctor item shows, 0 when none), `projects` are the running projects (id and name) from the hook the Projects list uses (find it from STOP_PROJECT_FN's caller), `keepInMenuBar` from `readKeepInMenuBar()`. Actions: `startEngine` and `stopEngine` call START_FN and STOP_FN for the selected Colima machine; `stopProject` calls STOP_PROJECT_FN; `openDoctor` calls `go("/doctor")`. Nothing else in `Shell.tsx` changes.
6. **Mock.** In `preview/mock.ts`: after the `emit` constant add `(window as any).__emit = emit;`. In the `invoke` switch add `case "tray_sync": ((window as any).__tray ??= []).push(a.payload); return undefined as T;` and `case "watch_expect_stop": ((window as any).__expectStop ??= []).push(Date.now()); return undefined as T;`. (There is a vitest that fails when a command used in `src/` has no mock handler: it passes after this step.)
7. **Browser check** `scripts/check-tray.mjs`, using `open`, `check`, `done` from `scripts/lib/check.mjs`. It opens `/?scenario=running#/containers` and does:
   1. `check` "tray: a sync was sent on load": `window.__tray.length >= 1`.
   2. `check` "tray: the engine context is colima": `__tray.at(-1).engine.context === "colima"`.
   3. `check` "tray: attention equals the Doctor count in the sidebar": the number in the sidebar's Doctor `.count.bad` (0 when there is none) equals `__tray.at(-1).attention`.
   4. `check` "tray: keep in menu bar is on by default": `__tray.at(-1).keepInMenuBar === true`.
   5. `__emit("tray-action", { payload })` with `{ kind: "stop-engine" }`: `check` "tray: stop-engine stops the machine": within 5 s the `.engine` button text contains `Stopped`.
   6. `check` "tray: a stop tells the notifier": `window.__expectStop.length >= 1`.
   7. `__emit` with `{ kind: "start-engine" }`: `check` "tray: start-engine starts it again": within 8 s the `.engine` text contains `Running`.
   8. `__emit` with `{ kind: "open-doctor" }`: `check` "tray: open-doctor opens Doctor": `location.hash` starts with `#/doctor`.
   9. `await done()`.
   Run it in both engines: `PW_ENGINES="chromium webkit" sh scripts/check-all.sh` (it picks the new script up by its name).
8. **Settings row.** In Settings, General, add one `.setting` row with the ui `Switch`: title `Keep OpenPier in the menu bar`, description `When you close the window, OpenPier keeps running so the menu bar can show your engine.` It reads and writes through `readKeepInMenuBar` and `writeKeepInMenuBar`. Add to `scripts/check-tray.mjs`: `check` "tray: the Settings switch is on and turning it off tells the notifier": open `#/settings`, find the switch named `Keep OpenPier in the menu bar`, it is on, click it, and `__tray.at(-1).keepInMenuBar === false`.

### Done when

```sh
node --experimental-strip-types --no-warnings --test src/lib/trayBridge.test.ts 2>&1 | grep -E "^(ℹ|#) (pass|fail)"    # pass 5, fail 0
npx vitest run src/lib/trayBridge.test.tsx 2>&1 | grep -E "Tests"                                                   # 4 passed (at least 4)
PW_ENGINES="chromium webkit" sh scripts/check-all.sh 2>&1 | grep "check-tray"                                       # check-tray.mjs: 0 in both engines
grep -c "tray_sync" preview/mock.ts                                                                                 # 1 or more
```

Plus the gate. By hand on a Mac (the plan's author does this, it cannot run in CI): with the real app and Colima running, close the window; the menu bar icon stays; the menu shows the engine line, `Stop <name>`, `Open OpenPier`, `Quit`; `Stop <name>` stops Colima and the icon changes within 5 seconds; `Start <name>` starts it again and the icon changes within 5 seconds. Not verified: that timers in a hidden window keep running. The 5-second promise does not depend on them (the icon is driven by Rust), but the "need attention" count and the project lines come from the page: with the window closed for 10 minutes, check that they still change. Report the result.

### Pull request text

There is no GitHub pull request. Write `docs/plan/iterations/pr/wo-8.1b.md` (screenshots in `docs/plan/iterations/pr/wo-8.1b/`), with the headings of `../HANDOFF.md` section 6, then merge with `git merge --no-ff wo-8.1b` into the local `main`. First line of the file: `wo-8.1b: the menu bar shows your engine and can start and stop it`

---

## WO-8.2a Notifications: the watcher

Needs: WO-8.1a, WO-8.1b. Plan task 8.2 (G2), first of two.

### Why

The app only tells you what is wrong while you look at it. This work order watches the engine's events in Rust and shows a macOS notification, in the same plain sentence as the problem line. It works with the window closed.

### Read first

1. `docs/plan/08-feature-gaps.md` G2.
2. `src/lib/health.ts` (`problemsFor`, `exitCodeMeaning`), `src/lib/events.ts` (`parseEvents`, `eventWindow`).
3. Docker events reference (event names, attributes): https://docs.docker.com/reference/cli/docker/system/events/ .
4. Notification plugin: https://v2.tauri.app/plugin/notification/ and https://docs.rs/tauri-plugin-notification/2.8.1/tauri_plugin_notification/ .
5. `src-tauri/src/tray.rs` (`shared()`, `expect_stop`), `src-tauri/src/exec.rs`, `src-tauri/src/allow.rs` (`events_args_ok`).

### Starting state

```sh
test -f src-tauri/src/tray.rs && grep -c "pub fn shared" src-tauri/src/tray.rs     # 1
grep -n "fn events_args_ok" src-tauri/src/*.rs                                       # one line, in allow.rs
grep -n "resolveJsonModule" tsconfig.json                                             # prints nothing (this work order adds it)
npm view @tauri-apps/plugin-notification version                                     # a 2.x number (2.8.1 on 2026-11-12)
grep -n '"Stopped with an error"\|"Ran out of memory"\|"Its health check is failing"\|"It keeps restarting"' src/lib/health.ts   # four lines
```

### Do not touch

`src-tauri/capabilities/default.json`: notifications are sent from Rust, so the page needs no notification permission. `allow.rs`: the watcher builds its `docker events` arguments itself, from a fixed list and a context that `context_ok` accepted.

### Decisions already made (do not change)

1. One source for the sentences: `src/lib/sentences.json`, read by `health.ts` and, with `include_str!`, by Rust. The notification body is the problem line's title.
2. A container is skipped when its name starts with `k8s_` (pods are the cluster's), or when it is destroyed in the same window (a `--rm` helper, or `docker rm -f`).
3. A stop the user asked for is not a crash: a `die` that has a `stop` event for the same container after it is ignored. `docker kill` has no `stop` event, so it notifies. The decision about a `die` waits until 3 seconds have passed, so its `stop` or `destroy` has arrived.
4. At most one notification per container per 10 minutes. The engine-stopped notice has its own key.
5. Not verified: that Docker names its events and attributes as used below (`die` with `exitCode`, `oom`, `health_status: unhealthy`, `stop`, `destroy`, `kill`). They come from the Docker events page above. WO-8.7's nightly job captures real events and fails if the shape differs.

### Steps

1. **Sentences.** Create `src/lib/sentences.json`:
   ```json
   {
     "crashed": "Stopped with an error",
     "oom": "Ran out of memory",
     "unhealthy": "Its health check is failing",
     "restarting": "It keeps restarting",
     "engine-stopped": "{name} is stopped. Your containers and data are kept."
   }
   ```
   The last one is the machine-stopped sentence of spec 6.9. In `tsconfig.json` add `"resolveJsonModule": true` to `compilerOptions`. In `src/lib/health.ts` add `import sentences from "./sentences.json" with { type: "json" };` and replace the four literal titles with `sentences.crashed`, `sentences.oom`, `sentences.unhealthy`, `sentences.restarting` (only the generic out-of-memory title, the one that is exactly `"Ran out of memory"`; the longer "It hit its own ... memory limit" title stays). Run `npm test`: every existing health test must still pass, and `npx tsc --noEmit` must pass. Not verified: that `node --experimental-strip-types` and vite accept the `with { type: "json" }` attribute together. If either fails, stop and report the error; do not switch to a copy of the text.
2. **Test for the sentences.** Create `src/lib/sentences.test.ts`: `given_the_sentence_file_when_problems_for_runs_then_each_title_is_the_file_text`: build a `State` for each of the four cases (use the same helper values the existing tests in `src/lib/health.test.ts` use; read that file first) and assert `problemsFor(state)[0].title` equals the file's text.
3. **Dependencies.** In `src-tauri/Cargo.toml` add under `[dependencies]`: `tauri-plugin-notification = "2"`. Run `npm install @tauri-apps/plugin-notification@2` is **not** needed (the page never calls the plugin): do not add the npm package.
4. **Write the Rust tests first.** Create `src-tauri/src/notify.rs` with the types and `todo!()` bodies, and the test module. Tests (each builds events from small helper `ev(time_ms, action, name, exit_code)`; `cfg()` is a `NotifyConfig` with everything on; `feed(&mut decider, events, until_ms)`):
   1. `given_a_kill_and_die_137_with_no_stop_when_fed_then_one_crashed_notice`.
   2. `given_a_stop_then_die_137_then_stop_event_when_fed_then_no_notice`: kill 15, kill 9, die 137, stop.
   3. `given_a_kill_die_destroy_when_fed_then_no_notice` (`docker rm -f`).
   4. `given_die_with_exit_code_0_when_fed_then_no_notice`.
   5. `given_oom_and_die_137_in_one_window_when_fed_then_one_oom_notice`.
   6. `given_health_status_unhealthy_when_fed_then_one_unhealthy_notice`; `health_status: healthy` gives none.
   7. `given_twenty_deaths_in_a_minute_when_fed_then_exactly_one_notice` and its kind is `Restarting`.
   8. `given_a_notice_when_the_same_container_dies_nine_minutes_later_then_no_second_notice`, and `..._eleven_minutes_later_then_a_second_notice`.
   9. `given_a_container_named_k8s_pod_when_it_dies_then_no_notice`.
   10. `given_a_die_newer_than_three_seconds_when_fed_then_it_waits_and_the_next_feed_decides_it`.
   11. `given_the_kind_is_switched_off_when_fed_then_no_notice`; `given_the_master_switch_is_off_when_fed_then_no_notice`.
   12. `given_events_json_lines_when_parsed_then_name_action_exit_code_and_time_are_read`: a real-shaped line `{"Type":"container","Action":"die","Actor":{"ID":"abc","Attributes":{"exitCode":"137","image":"redis:7","name":"queue"}},"timeNano":1700000000123456789}`; also a `health_status: unhealthy` line; a non-container line is skipped; a broken line is skipped.
   13. Engine watch: `given_three_failed_probes_in_a_row_when_stepped_then_one_engine_stopped_notice`; `..._after_it_answered_again_and_fails_again_then_a_second_notice`; `..._with_an_expected_stop_then_no_notice`; `..._one_failed_probe_then_none`.
   14. `given_the_sentence_file_when_loaded_then_all_five_keys_exist`.
   Run `cd src-tauri && cargo test notify::`, see them fail, commit.
5. **Write `src-tauri/src/notify.rs`.**
   1. Types: `#[derive(Clone, Debug, Deserialize, PartialEq)] #[serde(rename_all = "camelCase", default)] pub struct NotifyConfig { pub enabled: bool, pub crashed: bool, pub oom: bool, pub restarting: bool, pub unhealthy: bool, pub engine_stopped: bool }` with `Default` all true. `pub enum Kind { Crashed, Oom, Restarting, Unhealthy, EngineStopped }` with `fn key(&self) -> &'static str` returning `"crashed" | "oom" | "restarting" | "unhealthy" | "engine-stopped"`. `pub struct Ev { pub time_ms: i64, pub action: String, pub name: String, pub exit_code: Option<i32> }`. `pub struct Notice { pub kind: Kind, pub title: String, pub body: String }`.
   2. `fn sentence(key: &str) -> String`: parses `include_str!("../../src/lib/sentences.json")` once (`OnceLock<serde_json::Value>`) and returns the text.
   3. `pub fn parse_events(text: &str) -> Vec<Ev>`: one JSON object per line; only `Type == "container"`; `action` from `Action`; `name` and `exitCode` from `Actor.Attributes`; time from `timeNano` divided by 1,000,000, else `time` times 1000; bad lines skipped.
   4. `pub struct Decider { last_sent: HashMap<String, i64>, deaths: HashMap<String, Vec<i64>>, pending: Vec<Ev> }` with `new()` and `pub fn feed(&mut self, new: Vec<Ev>, until_ms: i64, cfg: &NotifyConfig) -> Vec<Notice>`:
      1. `all = pending + new`, sorted by time. Events with `time_ms <= until_ms - 3000` are decided; the rest stay in `pending`.
      2. Skip names starting `k8s_`.
      3. Per name, from the decided events: `oom` present gives `Oom`; else the count of non-zero `die` events in the last 300000 ms (this window's included, `deaths` pruned to that span) of 3 or more gives `Restarting`; else a non-zero `die` that has no `stop` or `destroy` for that name at or after it gives `Crashed`; else `health_status: unhealthy` gives `Unhealthy`. First match wins in that order. A death that is a user stop or a destroy is not counted in `deaths`.
      4. Drop it when `!cfg.enabled` or the kind's switch is off.
      5. Rate limit: when `last_sent[name]` is within 600000 ms of the event time, drop it; else record it and emit `Notice { kind, title: name, body: sentence(kind.key()) }`.
   5. `pub struct EngineWatch { fails: u32, told: bool }` with `pub fn step(&mut self, answered: bool, now_ms: i64, expected_until_ms: i64, engine_name: &str, cfg: &NotifyConfig) -> Option<Notice>`: answered resets `fails` and `told`; a failure adds 1; on the third failure in a row, when not `told`, `now_ms >= expected_until_ms`, `cfg.enabled && cfg.engine_stopped`, return `Notice { kind: EngineStopped, title: engine_name, body: sentence("engine-stopped") with "{name}" replaced by engine_name }` and set `told`.
   6. The loop, `pub fn start(app: tauri::AppHandle)`: a `std::thread::spawn` that every 3 seconds: reads `crate::tray::shared()` (engine context and name, `expected_stop_until_ms`, and the config) without holding the lock while it works; when there is an engine and `crate::engine::context_ok` accepts it, runs `docker --context <ctx> events --since <last_until_s> --until <until_s> --filter type=container --format {{json .}}` with `until_s = now_s - 1` and the first `last_until_s = until_s - 3`, through `crate::exec::output_with_deadline(cmd, 5 s)`, parses, feeds the `Decider` with `until_ms = until_s * 1000`; steps `EngineWatch` with the probe result from `crate::tray::shared().answers`; shows each notice with `tauri_plugin_notification::NotificationExt`: `app.notification().builder().title(&n.title).body(&n.body).show()`. It stores `(name, now_ms)` of the last notice in `LAST_NOTICE: Mutex<Option<(String, i64)>>` (a `pub static` through `OnceLock`) for WO-8.2b.
   7. Not verified: that the first notification on a Mac shows without asking. The plugin's desktop `request_permission` always answers granted. The first real notification will show whether macOS asks; report what happened.
6. **Config from the page.** In `tray.rs` add `pub notify: crate::notify::NotifyConfig` to `TraySync` and make `refresh`/`tray_sync` leave it in `shared().sync.notify`. In `src/lib/trayBridge.ts` add `notify` to `TraySync`, to `buildTraySync`'s input and to `sameSync`; its value comes from `readNotifyConfig()` (step 7). Update the five node tests and the vitest tests of WO-8.1b for the new field (they build inputs with `notify: DEFAULT_NOTIFY`).
7. **`src/lib/notifySettings.ts`** (new, in full):
   ```ts
   export type NotifyConfig = { enabled: boolean; crashed: boolean; oom: boolean; restarting: boolean; unhealthy: boolean; engineStopped: boolean };
   export const DEFAULT_NOTIFY: NotifyConfig = { enabled: true, crashed: true, oom: true, restarting: true, unhealthy: true, engineStopped: true };
   const KEY = "openpier:notify";
   export function readNotifyConfig(): NotifyConfig {
     try {
       const raw = localStorage.getItem(KEY);
       return raw ? { ...DEFAULT_NOTIFY, ...(JSON.parse(raw) as Partial<NotifyConfig>) } : DEFAULT_NOTIFY;
     } catch { return DEFAULT_NOTIFY; }
   }
   export function writeNotifyConfig(c: NotifyConfig): void {
     try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* storage may be blocked */ }
   }
   ```
   and `src/lib/notifySettings.test.ts`: `given_nothing_stored_when_read_then_everything_is_on`; `given_one_kind_stored_off_when_read_then_only_that_kind_is_off`; `given_broken_json_when_read_then_defaults`.
8. **Register.** `main.rs`: `mod notify;`, `.plugin(tauri_plugin_notification::init())` before `.invoke_handler`, and in the `.setup` closure after `tray::setup(app)?;` add `notify::start(app.handle().clone());`.
9. `cargo fmt`, `cargo clippy --all-targets -- -D warnings`, `cargo build`.
10. Add to `CHANGELOG.md`: `OpenPier now shows a notification when a container stops with an error, runs out of memory, keeps restarting or turns unhealthy, and when the engine stops by itself.`

### Done when

```sh
cd src-tauri && cargo test notify:: 2>&1 | grep "test result"                                # at least 21 passed, 0 failed
node --experimental-strip-types --no-warnings --test src/lib/notifySettings.test.ts src/lib/sentences.test.ts src/lib/trayBridge.test.ts 2>&1 | grep -E "^(ℹ|#) (pass|fail)"   # fail 0
grep -c "notification" src-tauri/capabilities/default.json                                    # 0
git diff --stat main -- src-tauri/capabilities                                                 # prints nothing
```

Plus the gate. By hand (the plan's author): with the sandbox (`sh scripts/eval-setup.sh`) running and the window closed, `docker kill eval-vol` produces one notification titled `eval-vol` with the body `Stopped with an error`; `docker stop eval-server` produces none; the restart loop `eval-crash` produces one notification, not twenty. Report what was seen.

### Pull request text

There is no GitHub pull request. Write `docs/plan/iterations/pr/wo-8.2a.md` (screenshots in `docs/plan/iterations/pr/wo-8.2a/`), with the headings of `../HANDOFF.md` section 6, then merge with `git merge --no-ff wo-8.2a` into the local `main`. First line of the file: `wo-8.2a: OpenPier notifies you when a container breaks`

---

## WO-8.2b Notifications: settings and click

Needs: WO-8.2a. Plan task 8.2 (G2), second of two.

### Why

G2 asks for a switch per kind and one for all, and for a click that opens the container on its explanation.

### Read first

`docs/plan/08-feature-gaps.md` G2 items 2 and 3; `docs/plan/04-design-spec.md` sections 7.8, 6.2 (Switch), 7.2 item 3; `src/lib/notifySettings.ts`; `src-tauri/src/notify.rs` (`LAST_NOTICE`); `src/lib/router.ts`.

### Starting state

```sh
test -f src/lib/notifySettings.ts && grep -c "LAST_NOTICE" src-tauri/src/notify.rs     # 1 or more
```

### Do not touch

The decision rules in `notify.rs`. The capability file.

### Steps

1. **Click through, Rust.** In `notify.rs` add `pub fn open_on_focus(app: &AppHandle)`: called from `main.rs`'s `.on_window_event` for `tauri::WindowEvent::Focused(true)` on the `main` window. When `LAST_NOTICE` holds a container name and its time is less than 60000 ms old, take it out (so it fires once) and `emit("notice-open", name)`. Also record, in `start`, whether the window was already focused when the notice was shown: when it was, do not store the notice (the user was looking). Not verified: that clicking a macOS notification focuses the window of the app. The plugin may expose a click callback on macOS; its docs do not say. This focus rule is the stand-in. Report in the PR what a real click does.
2. **Click through, page.** In `src/lib/trayBridge.ts` add to `TrayActions` the member `openContainer(name: string): void`, and a third effect in `useTrayBridge` that listens to `notice-open` and calls it. In `Shell.tsx`, `openContainer` runs `docker ps -a --filter name=^<name>$ --format {{.ID}}` through the page's `docker` helper for the selected engine and calls `go("/containers/<id>/logs")`; when nothing is found it calls `go("/containers")`. Add vitest `given_a_notice_open_event_when_it_arrives_then_openContainer_is_called_with_the_name`. The container page already shows the problem banner with the explanation (spec 7.2 item 3), which is the "explanation".
3. **Settings rows.** In Settings, General, add `.setting` rows with the ui `Switch`, writing through `writeNotifyConfig`: the master row `Tell me when something breaks`, then one row per kind: `A container stops with an error`, `A container runs out of memory`, `A container keeps restarting`, `A container's health check fails`, `The engine stops by itself`. Each row has a one-line description of when you would turn it off (rule 3 of `AGENTS.md`): write them as `Turn it off if you stop containers with errors on purpose.`, `Turn it off if you run containers that are meant to hit their memory limit.`, `Turn it off if you have containers that restart on purpose.`, `Turn it off if you have containers with checks that fail while they start.`, `Turn it off if you stop the engine from outside OpenPier.` The kind rows are disabled while the master row is off.
4. **Browser check** `scripts/check-notify.mjs`: `check` "notify: the page sends the default config": `__tray.at(-1).notify.enabled === true` and `.crashed === true`; after `localStorage.setItem("openpier:notify", JSON.stringify({ enabled: false }))` and a reload, `check` "notify: a stored switch reaches the backend": `__tray.at(-1).notify.enabled === false`; `__emit("notice-open", { payload: "api" })`: `check` "notify: a notice opens the container": within 3 s `location.hash` starts with `#/containers/`. The mock's `docker ps --filter name=` must answer; if it prints no id, add the filter to the mock's `ps` case (it already filters by `network=`; add `name=^...$`).

### Done when

```sh
npx vitest run src/lib/trayBridge.test.tsx 2>&1 | grep Tests       # all passed
PW_ENGINES="chromium webkit" sh scripts/check-all.sh 2>&1 | grep "check-notify"    # 0 in both
```

Plus the gate. Eyes: compare the General section with `design/shots/settings-machines-light.png` for row shape (`.setting`).

### Pull request text

There is no GitHub pull request. Write `docs/plan/iterations/pr/wo-8.2b.md` (screenshots in `docs/plan/iterations/pr/wo-8.2b/`), with the headings of `../HANDOFF.md` section 6, then merge with `git merge --no-ff wo-8.2b` into the local `main`. First line of the file: `wo-8.2b: choose which breakages notify you, and click through to the container`

---

## WO-8.3a The problems page, built from the code

Needs: iteration 3 merged (WO-3.8, Doctor). Plan task 8.3 (G3), first of two.

### Why

"What the app can explain" is the product's claim. It should be a page anyone can read and link to, and it must not drift from the code (G3).

### Read first

1. `docs/plan/08-feature-gaps.md` G3.
2. `src/lib/doctor.ts` (the `CHECKS` array, the comments above each check), `src/lib/health.ts` (`problemsFor`), `src/lib/apps.ts` (`appProblems`).
3. `src/lib/sentences.json` (from WO-8.2a): its four titles must be the catalogue titles of `oom`, `crashed`, `unhealthy`, `restarting`.

### Starting state

```sh
test -f src/lib/sentences.json && echo sentences
# every id literal the app can show: this list is what the catalogue must cover
grep -ho 'id: "[a-z][a-z0-9-]*"' src/lib/doctor.ts src/lib/health.ts src/lib/apps.ts | sort -u
test ! -f docs/problems.md && echo no-page-yet
node --version        # v22 (CI and docs use Node 22)
```

Expected: `sentences`, then a list. On the author's machine at commit `0bdafcf` the list holds at least these 22 ids: `arch, crashed, db-password, db-volume, disk, dns-vm, fix-leftover, kafka-localhost, kafka-ui-empty, kafka-ui-localhost, localhost-target, mount-readonly, mount-slow, mount-unreadable, mount-unshared, no-shared-network, oom, port-taken, proxy-not-passed, restarting, unhealthy, vm-memory`. Iterations 3 to 5 may have added more (for example the Compose version check of WO-7.2). Write one catalogue entry for every id the command prints, no more, no less. Save the printed list; the test in step 1 checks it.

### Do not touch

The checks themselves: no behaviour of `doctor.ts`, `health.ts` or `apps.ts` changes in this work order.

### Steps

1. **Test first.** Create `src/lib/problemCatalog.test.ts` (node test). It reads the three source files as text, collects every `id: "<x>"` with the regex `/\bid: "([a-z][a-z0-9-]*)"/g`, and imports `PROBLEMS` from `./problemCatalog.ts`:
   1. `given_every_id_in_the_code_when_the_catalogue_is_read_then_each_has_an_entry`: the message names the missing ids.
   2. `given_the_catalogue_when_compared_with_the_code_then_it_has_no_entry_the_code_lacks`.
   3. `given_each_entry_when_checked_then_title_sees_why_and_fix_are_not_empty_and_at_least_20_characters`: so `"TODO"` or `"-"` fails.
   4. `given_each_entry_when_checked_then_id_matches_its_key_and_ids_are_unique`.
   5. `given_the_four_row_problems_when_checked_then_their_titles_equal_the_sentence_file`: `oom`, `crashed`, `unhealthy`, `restarting` titles equal `sentences.json`.
   6. `given_the_catalogue_when_rendered_then_the_page_has_one_anchor_per_id`: `renderProblems(PROBLEMS)` (step 3) contains `<a id="<id>"></a>` once for each id.
   7. `given_the_rendered_page_when_checked_for_the_banned_dashes_then_it_has_none`: no `—` and no ` -- `.
   Run, see failures, commit.
2. **`src/lib/problemCatalog.ts`** (new). Shape, in full:
   ```ts
   // One entry per problem the app can explain. The test in problemCatalog.test.ts fails when the code gains
   // an id that this file lacks, so docs/problems.md cannot fall behind the code.
   export type ProblemDoc = {
     id: string;      // the id used in the code, also the link anchor
     title: string;   // the sentence the app shows, with {container} where a name goes
     sees: string;    // what you see: where it shows and what it says
     why: string;     // why it happens, one or two sentences
     fix: string;     // what the app runs or tells you to run, in words and, where there is one, the command
   };
   export const PROBLEMS: Record<string, ProblemDoc> = {
     // one entry per id, in the order doctor.ts lists its checks, then the four row problems, then the app ones
   };
   ```
   Fill each entry from the code, with these rules (the entries are prose, so these rules replace guessing):
   1. `title`: the check's own `title` text, with template parts like `${a.name}` written as `{container}`.
   2. `sees`: where it shows (a problem line under the container's row; a Doctor finding; a banner on the container page) and the `detail` sentence, with names as `{container}`.
   3. `why`: only what the code comments, the file header of `doctor.ts` or the cited docs say. If the code gives no reason, write the check's own `passed` text turned around ("A container looks for another one at localhost" is the problem, so the reason is "Inside a container, localhost is the container itself."), never a new claim.
   4. `fix`: the `fix.label`, and the commands from `fix.text` or the `steps` when there are some; "Only you can decide: the app explains it and shows how" when the fix is `manual`; "No fix runs: the app explains it" when there is none.
   5. Plain words, short sentences, no em dashes. The two worked entries below set the tone.
   ```ts
   oom: {
     id: "oom",
     title: "Ran out of memory",
     sees: "A red problem line under {container}, and a banner on its page: Docker stopped it because it used more memory than it was allowed.",
     why: "{container} used more memory than the VM or its own limit gave it, so Docker stopped it.",
     fix: "Give the VM more memory, from the problem line's button. If the container has its own memory limit, raise that in the Compose file instead.",
   },
   "localhost-target": {
     id: "localhost-target",
     title: "{container} looks for another container at localhost",
     sees: "A red finding in Doctor, with the setting that points at localhost (for example DATABASE_URL) as its evidence.",
     why: "Inside a container, localhost is the container itself, so the other container is never reached.",
     fix: "Change the setting to the other container's name and put both on one network. The app asks first and shows the exact commands.",
   },
   ```
   (Check each of the two against the code before keeping it; the code wins.)
3. **`scripts/problems-doc.mjs`** (new). It imports `PROBLEMS` from `../src/lib/problemCatalog.ts`, and exports nothing. Node runs the TypeScript file because the npm script passes `--experimental-strip-types`. It writes `docs/problems.md` (or, with the argument `--check`, compares and exits 1 when the file differs from what it would write, printing `docs/problems.md is stale: run npm run problems`). The page, exactly:
   ```
   # What OpenPier can explain

   This page is written by `npm run problems` from the app's code. Each problem has an id, which is also the link anchor.

   <a id="oom"></a>
   ## Ran out of memory

   Id: `oom`

   What you see: ...

   Why it happens: ...

   What the fix runs: ...
   ```
   one block per entry, in catalogue order. Export the renderer too: put `renderProblems(problems): string` in `src/lib/problemCatalog.ts` (so the test of step 1 can call it), and let the script call it.
4. **npm scripts** in `package.json`: `"problems": "node --experimental-strip-types --no-warnings scripts/problems-doc.mjs"` and `"problems:check": "node --experimental-strip-types --no-warnings scripts/problems-doc.mjs --check"`. Run `npm run problems`. Commit `docs/problems.md`.
5. **CI.** In `.github/workflows/ci.yml`, job `web`, add after `npm test`: `- run: npm run problems:check`.
6. **CHANGELOG.** Add: `A public page lists every problem OpenPier can explain: docs/problems.md.`
7. The README link ("What it does") is written by WO-6.4 in iteration 7, which replaces the README. Add the line `- docs/problems.md is linked from the README under "What it does" (WO-6.4)` to `docs/plan/FOUND.md` so it is not forgotten.

### Done when

```sh
node --experimental-strip-types --no-warnings --test src/lib/problemCatalog.test.ts 2>&1 | grep -E "^(ℹ|#) (pass|fail)"   # pass 7, fail 0
npm run problems:check; echo $?                                                           # 0
grep -c '<a id=' docs/problems.md                                                          # equals the number of ids printed in Starting state
# prove the guard: add  id: "zz-test"  to a comment-free line in a copy of doctor.ts and the test must fail:
# (do it by hand once, show the output in the PR, then revert)
```

Plus the gate. Eyes: open `docs/problems.md` on GitHub's preview or a Markdown viewer: each entry reads as plain sentences a non-expert understands.

### Pull request text

There is no GitHub pull request. Write `docs/plan/iterations/pr/wo-8.3a.md` (screenshots in `docs/plan/iterations/pr/wo-8.3a/`), with the headings of `../HANDOFF.md` section 6, then merge with `git merge --no-ff wo-8.3a` into the local `main`. First line of the file: `wo-8.3a: every problem OpenPier can explain is on one page that cannot go stale`

---

## WO-8.3b "Learn more" on every finding

Needs: WO-8.3a. Plan task 8.3 (G3), second of two.

### Why

G3 item 3: each finding in the app has "Learn more" that opens its entry.

### Read first

`docs/plan/08-feature-gaps.md` G3; `docs/plan/04-design-spec.md` section 6.16 (Inspector); `src/lib/links.ts` (`REPO_URL`); `src/lib/problemCatalog.ts`.

### Starting state

```sh
grep -n "REPO_URL" src/lib/links.ts                      # one export
test -f docs/problems.md && echo page
grep -rn "open_url" src --include=*.ts --include=*.tsx | grep -v test | head -3   # how the page opens a web link today
```

### Steps

1. **Test first.** `src/lib/links.test.ts` (add to it if it exists, else create): `given_a_problem_id_when_problem_url_is_built_then_it_is_the_repo_page_with_the_id_as_anchor`: `problemUrl("oom") === \`${REPO_URL}/blob/main/docs/problems.md#oom\``; `given_an_unknown_id_when_problem_url_is_built_then_it_points_at_the_page_without_an_anchor`; `given_any_catalogue_id_when_problem_url_is_built_then_it_starts_with_https`.
2. **`src/lib/links.ts`**: add `export function problemUrl(id: string): string` (`PROBLEMS[id]` known gives the anchor form, else the page URL). Import `PROBLEMS` from `./problemCatalog.ts`.
3. **The button.** Add a `Button` with `variant="ghost"` and the label `Learn more` that opens `problemUrl(finding.id)` through the same helper other web links use (`open_url`, https only), on every finding in the inspector and in Doctor, with accessible name `Learn more about <title>`. The inspector is the ui `Inspector` (WO-1.3b): the button goes last in its `actions` prop (find the one file that renders `<Inspector` with `grep -rln "<Inspector" src`; Doctor and the container page both use it).
4. **Browser check** `scripts/check-learn-more.mjs` : open `/?scenario=doctor#/doctor`, open the first finding's inspector, click `Learn more`, `check` "learn more: it opens the problems page with the finding's id": `window.__opened` last entry starts with `https://` and contains `/docs/problems.md#`.

### Done when

```sh
node --experimental-strip-types --no-warnings --test src/lib/links.test.ts 2>&1 | grep -E "^(ℹ|#) (pass|fail)"     # fail 0
PW_ENGINES="chromium webkit" sh scripts/check-all.sh 2>&1 | grep "check-learn-more"                            # 0, or no line if step 3 stopped
```

Plus the gate.

### Pull request text

There is no GitHub pull request. Write `docs/plan/iterations/pr/wo-8.3b.md` (screenshots in `docs/plan/iterations/pr/wo-8.3b/`), with the headings of `../HANDOFF.md` section 6, then merge with `git merge --no-ff wo-8.3b` into the local `main`. First line of the file: `wo-8.3b: every finding links to its explanation`

---

## WO-8.4 One log view for containers and projects

Needs: WO-3.2 (container logs), WO-7.6 (project logs). Plan task 8.4 (G4).

### Why

Logs are one of the three jobs people hire a container app for (J3). Container logs and project logs are two near-copies today (`Logs.tsx`, `ComposeLogs.tsx`). G4 asks for one view with search, Follow, Since, copy, save and a way to the first error.

### Read first

1. `docs/plan/08-feature-gaps.md` G4; `docs/plan/04-design-spec.md` sections 6.3 (Chip), 6.11 (Canvas), 7.2 items 4 and 5; `docs/plan/07-projects-spec.md` section 7.2 item 3.
2. `docs/plan/design/shots/container-detail-light.png` (the log controls in the tabs row and the red lines).
3. The two files that fetch logs today (Starting state finds them), `src/lib/logMerge.ts`, `src/lib/composeLogs.ts`.
4. `@tanstack/react-virtual`: https://tanstack.com/virtual/latest/docs/framework/react/react-virtual .

### Starting state

```sh
grep -rln '"--timestamps"' src --include=*.tsx --include=*.ts | grep -v test      # one file: CONTAINER_LOGS (src/Logs.tsx today, or its new place)
grep -rln 'compose_logs' src --include=*.tsx --include=*.ts | grep -v test          # one file: PROJECT_LOGS (the Logs tab of the project detail)
grep -n "react-virtual" package.json                                                # present from WO-3.1 (list virtualisation); if absent run: npm install @tanstack/react-virtual@3
grep -n "canvas.wrap\|\.canvas \.ln\|\.canvas \.svc\|\.canvas \.hit" src/ui/openpier.css   # prints the rules of section 11.6 (Logs); if one is missing, stop and report its name
grep -n "Meters.tsx" eslint.config.js                                                # the one block that allows style=; LogView.tsx (and VirtualRows.tsx, WO-8.8) join it
npx tsc --version                                                                    # Version 5.x
```

### Decisions already made

1. The view keeps the last **10,000** lines, not 5,000. Reason: G4's done-when names a 10,000-line log, and spec 7.2 item 5 says 5,000. (Reported as a plan contradiction.)
2. "Looks like an error": the line matches `/\b(error|err|fatal|panic|exception|refused|failed|failure|critical|traceback)\b/i` or has an HTTP status of 500 to 599 between spaces (`/\s5\d\d\s/`). Warning: `/\b(warn|warning)\b/i`. (This makes `GET /health 503 "connection refused: db:5432"` red, as in the mockup.)
3. Rows have a fixed height (the `.canvas` line height, 19.2 px), so the list is virtualised with `@tanstack/react-virtual`. Wrap on (step 10) switches to measured rows.
4. The controls stay where WO-3.2 put them: the tabs row, right side (`<Tabs aside>`). There is no second toolbar (author's decision D3). Since, Wrap, Jump to first error and Save are items of one `Menu` behind a `⋯` button with `aria-label="Log options"` at the end of the aside. Previous match and Next match are two ghost icon buttons shown only while the filter has text. There is no gutter mark: the stylesheet has no gutter class and none is drawn. A service name is drawn with `.svc` (muted), never a colour per service.
5. Save to a file writes to the Mac's Downloads folder and shows it in Finder. No file dialog.
6. Since, for a container: `10 min` is `--since 10m`, `1 h` is `--since 1h`, `start` is `--tail 10000`. For a project: `10 min` and `1 h` send a UTC time computed on the page (the backend accepts only that form); `start` sends none (the backend then returns the last 300 lines per service). Not verified: what "start" should mean (spec 7.2 gives the word only). Reported under "Could not determine".

### Steps

1. **Tests first.** Create `src/lib/logView.test.ts` (node tests) for the pure functions of step 2:
   1. `given_a_line_with_error_when_classified_then_error`; `..._connection_refused_then_error`; `..._status_503_between_spaces_then_error`; `..._a_port_like_5432_then_info` (no false positive); `..._warn_then_warn`; `..._plain_then_info`.
   2. `given_rows_and_a_query_when_matches_then_the_indexes_of_rows_containing_it_ignoring_case`; `given_an_empty_query_then_no_matches`.
   3. `given_three_matches_when_next_from_the_last_then_it_wraps_to_the_first`; `..._previous_from_the_first_then_the_last`; `given_no_matches_when_next_then_null`.
   4. `given_rows_when_first_error_then_the_index_of_the_first_error_row`; `given_none_then_null`.
   5. `given_ten_thousand_five_hundred_rows_when_capped_then_the_last_10000_remain`.
   6. `given_rows_with_sources_when_to_text_then_source_time_and_text_are_joined_by_two_spaces`; `given_rows_without_sources_then_time_and_text`.
   7. `given_since_10_min_and_now_when_since_arg_for_project_then_the_utc_time_ten_minutes_earlier_in_rfc3339_nano_form_ending_Z`; `..._start_then_null`.
   8. `given_since_choices_when_since_args_for_container_then_the_docker_logs_flags` (`10m`: `["--since","10m"]`, `1h`: `["--since","1h"]`, `start`: `["--tail","10000"]`).
   Then `src/ui/LogView.test.tsx` (vitest; render `LogControls` and `LogView` together with one `useLogView` in a small test component):
   9. `given_rows_when_rendered_then_error_rows_carry_class_e_and_warn_rows_class_w_and_the_time_class_t`.
   10. `given_a_query_when_typed_then_the_counter_reads_1_of_n_and_next_moves_to_2_of_n`.
   11. `given_errors_in_the_rows_when_jump_to_first_error_is_pressed_then_that_row_is_scrolled_into_view_and_follow_turns_off`.
   12. `given_follow_on_when_rows_grow_then_the_view_stays_at_the_end`; `given_the_user_scrolls_up_then_follow_turns_off`.
   13. `given_the_view_has_rows_when_copy_is_pressed_then_the_clipboard_gets_to_text_of_the_visible_rows`.
   14. `given_10000_rows_when_rendered_then_fewer_than_200_row_elements_are_in_the_document`.
   15. `given_no_query_then_previous_and_next_match_are_not_in_the_document`; `given_a_query_then_they_are`.
   16. `given_log_options_is_opened_then_it_has_since_wrap_jump_and_save_and_the_current_since_is_checked`.
   Run, see failures, commit.
2. **`src/lib/logView.ts`** (new, pure): `export type LogRow = { id: string; iso: string; time: string; text: string; source?: string }`; `export type Level = "error" | "warn" | "info"`; `classify(text): Level`; `matches(rows, query): number[]`; `stepMatch(matches: number[], current: number | null, dir: 1 | -1): number | null`; `firstError(rows): number | null`; `cap(rows, n = 10000): LogRow[]`; `toText(rows): string`; `export type Since = "10m" | "1h" | "start"`; `sinceArgsForContainer(s: Since): string[]`; `sinceForProject(s: Since, now: number): string | null`. `LOG_CAP = 10000`, `LOG_ROW_PX = 19.2`.
3. **`src/ui/LogView.tsx`** (new). It exports three things: a hook that owns the state, a controls component for the tabs row, and the view. Tests of WO-3.2 keep passing, because `Logs.tsx` keeps its props (see step 5).
   ```ts
   export type LogViewState = {
     rows: LogRow[]; setRows(rows: LogRow[]): void;
     query: string; setQuery(q: string): void;
     follow: boolean; setFollow(v: boolean): void;
     wrap: boolean; setWrap(v: boolean): void;
     since: Since; setSince(s: Since): void;
     matches: number[]; current: number | null;       // indexes into rows
     next(): void; prev(): void; jumpToFirstError(): void;
     hasError: boolean;
     copy(): void;                                    // writes toText(rows shown) to the clipboard and calls onCopied
   };
   export function useLogView(opts: { onCopied(): void }): LogViewState;
   export function LogControls(props: { log: LogViewState; onSave(text: string): void }): JSX.Element;
   export function LogView(props: { log: LogViewState; label: string; loading: boolean; sources?: string[] }): JSX.Element;
   ```
   `LogControls` is the content of `aside` of `<Tabs>` on the Logs tab. In order, left to right (no wrapper element, no `.toolbar`):
   ```
   <Field icon="search" width="filter" aria-label="Filter lines" placeholder="Filter lines" value={log.query} onChange=... onClear={() => log.setQuery("")} />
   {log.query && <>
     <span aria-live="polite" className="muted nowrap">  "{i} of {n}" when n > 0, "No matches" when none </span>
     <Button variant="ghost" iconOnly icon="chev-up"   aria-label="Previous match" onClick={log.prev} />
     <Button variant="ghost" iconOnly icon="chev-down" aria-label="Next match"     onClick={log.next} />
   </>}
   <ChipButton pressed={log.follow} onClick=...>Follow</ChipButton>
   <Button variant="ghost" iconOnly icon="copy" aria-label="Copy logs" onClick={log.copy} />
   <Menu label="Log options" trigger={<Button variant="ghost" iconOnly icon="more" aria-label="Log options" />}>
     <MenuCaption>Since</MenuCaption>
     <MenuRadioGroup value={log.since} onValueChange={...}>
       <MenuRadioItem value="10m">10 min</MenuRadioItem>
       <MenuRadioItem value="1h">1 h</MenuRadioItem>
       <MenuRadioItem value="start">Start</MenuRadioItem>
     </MenuRadioGroup>
     <MenuSeparator />
     <MenuItem label={log.wrap ? "Stop wrapping lines" : "Wrap long lines"} onSelect=... />
     <MenuItem label="Jump to first error" disabled={!log.hasError} onSelect={log.jumpToFirstError} />
     <MenuItem label="Save to a file" icon="download" onSelect={() => onSave(toText(log.rows))} />
   </Menu>
   ```
   `MenuRadioGroup` and `MenuRadioItem` are the ones WO-2.3 added to `Menu`. `Copy logs` is the name WO-3.2 gave the copy button: keep it. `LogView` renders, for the one place it is used:
   ```
   <Canvas fill wrap={log.wrap} aria-label={label} ref=... onScroll=...>     (ref, onScroll, fill and wrap are props of Canvas since WO-1.3a)
     <div style={{ height: total }}>   (the virtualizer's total height)
      <div style={{ transform: `translateY(${firstStart}px)` }}>   (ONE wrapper around all drawn rows; firstStart is the `start` of the first virtual item, 0 when there is none. The rows inside stay in normal flow, so no row has a style= of its own. These two style= are the only ones in the file)
       <div className="ln" role="row" aria-current={isCurrentMatch ? "true" : undefined}>
         <span className="t">{time}</span>{source && <span className="svc">{source}</span>}<span className={level}>{textWithHits}</span>
       </div>
      </div>
     </div>
   </Canvas>
   ```
   Row classes: `.ln` per row, `.t` for the time, `.svc` for the service name, `.e` or `.w` on the text for an error or a warning, `<mark className="hit">` around each match and `hit now` around the match of the current row. While `loading`, show `Reading logs…` in place of the rows. When `sources.length > 1`, a `ChipButton` per source above the canvas is **not** drawn (no second toolbar): the project Logs tab filters by service with the filter field, which matches the `source` text too.
   Words: `Follow`, `Filter lines`, `Copy logs`, `Log options`, `Since`, `10 min`, `1 h`, `Start`, `Wrap long lines`, `Stop wrapping lines`, `Jump to first error`, `Save to a file`, `Previous match`, `Next match` (accessible names only), `No matches`, `Reading logs…`. Icons only through the ui `Icon`: `chev-up` (in `IconName` since WO-1.3a), `chev-down`, `copy`, `download`, `more`, `search`. `lucide-react` is imported nowhere else.
   Behaviour: Enter in the filter field is Next, Shift+Enter is Previous; Escape clears it. Follow is on at first; a scroll up of more than 4 px turns it off; scrolling to the end turns it on. `Jump to first error` scrolls that row into view, makes it the current row and turns Follow off.
   Virtualisation: `useVirtualizer({ count: rows.length, getScrollElement: () => scroller.current, estimateSize: () => LOG_ROW_PX, overscan: 20 })`. The `style=` on the sizer and on each row is the only inline style. In `eslint.config.js` find the block whose `files` lists `Meters.tsx` (`grep -n "Meters.tsx" eslint.config.js`) and make sure `"src/ui/LogView.tsx"` is in that `files` array (the allowlist is exactly `Meters.tsx`, `LogView.tsx`, `VirtualRows.tsx`; WO-8.8 adds the last), with the comment `// virtual rows are positioned by the virtualizer`. No other `style=` anywhere.
   Add `export { useLogView, LogControls, LogView } from "./LogView";` and the `LogViewState` type to `src/ui/index.ts`.
4. **Backend: `save_log`.** In `src-tauri/src/applog.rs` this does not exist yet (WO-8.5a); put it in `src-tauri/src/logsave.rs` (new): `#[tauri::command] pub fn save_log(name: String, text: String) -> Result<String, String>`. It refuses when `name` is not a plain name (letters, digits, `.`, `_`, `-`, 1 to 64 characters, starting with a letter or digit) or when `text.len() > 20 << 20`. It writes to `$HOME/Downloads/openpier-<name>-<epoch seconds>.log` (`HOME` from `std::env::var`; refuse when empty), then runs `open -R <path>` (fixed argv, ignore its failure) and returns the path. Rust tests in the same file: `given_a_plain_name_when_save_log_path_is_built_then_it_is_under_downloads_with_the_epoch`, `given_a_name_with_a_slash_or_leading_dash_when_saved_then_refused`, `given_text_over_20_mb_when_saved_then_refused`, `given_a_temp_home_when_saved_then_the_file_holds_the_text` (set `HOME` to a temp dir inside the test; give the path builder a `home: &str` parameter so the test does not touch the environment). Register `mod logsave;` and `logsave::save_log` in `main.rs`. Mock: `case "save_log": ((window as any).__saved ??= []).push({ name: a.name, text: a.text }); return "/Users/me/Downloads/openpier-" + a.name + "-1.log" as T;`. Not verified: that writing to Downloads asks for permission on first use on macOS; report it.
5. **Build on WO-3.2 (the container Logs tab); delete none of its tests.** WO-3.2 put the filter `Field`, the `Follow` chip and the `Copy logs` button in `<Tabs aside>` of `src/ContainerDetail.tsx`, gave `src/Logs.tsx` the props `filter`, `follow`, `onFollowChange` and `registerCopy`, and kept 10,000 lines. This work order keeps that place and those props. Do: (a) in `ContainerDetail.tsx` call `const log = useLogView({ onCopied: () => toast({ text: "Copied logs" }) })` (use the toast words WO-3.2 test 5 asserts), put `<LogControls log={log} onSave={saveLog} />` in the `aside` on the Logs tab in place of the three loose controls, and pass `log` to `Logs`; (b) `Logs.tsx` gains one optional prop `log?: LogViewState`. When it is absent, `Logs` builds its own `useLogView` from the four old props (so every test of `src/Logs.test.tsx` passes unchanged); when present it renders `<LogView log={log} label=... loading=... />` in place of its `<Canvas>`; (c) in `src/Logs.test.tsx` and `src/ContainerDetail.test.tsx` only add tests (the new ones of step 1); (d) `scripts/check-observe.mjs` keeps its checks: the chip named `Follow` is still in the tabs row.
6. **Use it for containers (continued).** In CONTAINER_LOGS: keep the data code (the fetch, the merge, `have`, the 2-second refresh) exactly; read `log.since`; build the first fetch's args from `sinceArgsForContainer(since)` (today `["logs","--timestamps","--tail","500",id]`) and reset `have.current` and `lines` when `since` changes; map `LogLine` to `LogRow` (`id` = `key || index`, `time` = the `clock()` of today's file); call `log.setRows(rows)` after each fetch and render `<LogView log label={`Logs of ${name}`} loading={lines === null} />` with today's `Banner` for errors above it; `log.since` changes reset the fetch as said. Delete the old toolbar and the `<pre>`. `saveLog` (the `onSave` of `LogControls`) calls `invoke("save_log", { name, text })` and shows the toast `toast({ text: "Saved to Downloads" })` (`const toast = useToast()`; WO-1.3b). The mock `case "save_log"` of step 4 already answers it; do not add a second one.
7. **Use it for projects.** Same for PROJECT_LOGS: `rows` carry `source` (the service name from `serviceName(...)`), `since` goes through `sinceForProject` into the `since` argument of `compose_logs` (today `projectSince(have.current)` after the first fetch, and the first fetch sends `sinceForProject(since, Date.now())`); the "you ran ..." marks of today's file are kept as rows with `source` `you`. The project detail's Logs tab puts `<LogControls>` in its own `Tabs aside` the same way. Delete the old toolbar and the `<pre>`.
8. **Mock data for the errors.** In `preview/mock.ts` make `logLines(c)` of `api` contain the mockup's lines (`GET /health 503 "connection refused: db:5432"`, `GET / 200 612 "curl/8.4.0"`, `acme/billing-api:3.1: listening on 0.0.0.0:80`, `/docker-entrypoint.sh: Configuration complete; ready for start up`) if it does not already. Add scenario `longlog`: `docker logs` for any container returns 10,000 lines (the four lines repeated; every 997th line is the 503 line, the first error is line 7).
9. **Browser check** `scripts/check-logs.mjs`:
   1. `check` "logs: the controls are in the tabs row": on `#/containers/<api id>/logs` in scenario `design` (read the id from the row link), the `Filter lines` field, the `Follow` chip, `Copy logs` and `Log options` are inside the tabs row (`.tabs`), and there is no `.toolbar` in the page. Click `Log options`: the menu has `10 min`, `1 h`, `Start`, `Wrap long lines`, `Jump to first error`, `Save to a file`.
   2. `check` "logs: error lines are red": a row with `.e` exists and its computed colour differs from a plain row's.
   3. `check` "logs: search counts matches": type `503`; the counter reads `1 of ` followed by a number.
   4. `check` "logs: next moves to the following match": click `Next match` (it exists only while the filter has text: `check` that it is absent before typing); the counter reads `2 of`.
   5. `check` "logs: copy puts the lines on the clipboard": stub `navigator.clipboard.writeText`, click `Copy`, the stub received text containing `connection refused`.
   6. `check` "logs: save sends the lines to the backend": open `Log options`, click `Save to a file`; `window.__saved.length === 1` and the toast (`.toast`, from `useToast()` of WO-1.3b) reads `Saved to Downloads`.
   7. `check` "logs: Since 10 min is on after a click": open `Log options`, click `10 min`; reopen the menu: its `aria-checked` is `true`.
   8. Scenario `longlog`: `check` "logs: first error in 10,000 lines in one click": open `Log options`, click `Jump to first error`; within 1 s the row with `aria-current="true"` contains `503`.
   9. `check` "logs: only a screenful of rows is in the page": `.canvas .ln` count is under 200.
   10. `check` "logs: scrolling 10,000 lines stays quick": scroll the canvas to the bottom with `scrollTop = scrollHeight`, then wait for a frame (`requestAnimationFrame`); the last row text is in the page within 500 ms. Print the measured milliseconds with `console.log("info: scroll to end took N ms")` and put the number in the PR (G4: "state the number").
   11. The same on the project logs tab of scenario `design`: `check` "logs: a service name is muted and typing it filters": a `.svc` element exists; typing a service name leaves only that service's rows.
10. **Wrap and match marks.** `Wrap long lines` sets `log.wrap`, which `Canvas wrap` turns into the class `.wrap`; while it is on, switch the virtualizer to measured rows (`measureElement` on each row). The current match uses `.hit.now`, the other matches `.hit` (both exist in `openpier.css` 11.6). Test: `given_wrap_on_when_a_long_line_renders_then_the_canvas_has_class_wrap_and_the_row_is_taller_than_one_line`. Check line: `check` "logs: wrap long lines adds the class wrap": after the menu item, `.canvas.wrap` exists.
11. **Service name.** The source prefix of a row is `<span className="svc">`. No colour per service, no new class.
12. **No gutter.** Error rows are red text (`.e`) only. Do not add a gutter class or a mark.

### Done when

```sh
node --experimental-strip-types --no-warnings --test src/lib/logView.test.ts 2>&1 | grep -E "^(ℹ|#) (pass|fail)"     # at least 19 pass, fail 0
npx vitest run src/ui/LogView.test.tsx 2>&1 | grep Tests                                                         # at least 10 passed, 0 failed
cd src-tauri && cargo test logsave:: 2>&1 | grep "test result"                                                    # 4 passed
PW_ENGINES="chromium webkit" sh scripts/check-all.sh 2>&1 | grep "check-logs"                                    # 0 in both
grep -c "<pre" src/Logs.tsx src/ComposeLogs.tsx 2>/dev/null                                                       # 0 for each file that still exists (use CONTAINER_LOGS and PROJECT_LOGS)
grep -rln "style=" src --include=*.tsx | grep -v test | sort                                                 # only Meters.tsx and LogView.tsx (VirtualRows.tsx joins in WO-8.8)
```

Run `node scripts/check-mockup.mjs` (WebKit only): the existing `container-detail` row must still pass with no new mask and no higher `threshold`. If it fails, stop and report.

Plus the gate, and `scripts/not-migrated.json` must be no longer than before. Eyes: compare with `design/shots/container-detail-light.png` and `-dark.png`: the tabs row (filter, Follow, copy, then the ⋯ button), red error lines, timestamps in the faint colour, the canvas filling the rest of the height. The ⋯ menu and the next and previous buttons have no picture: they use `Menu` and ghost icon buttons only.

### Pull request text

There is no GitHub pull request. Write `docs/plan/iterations/pr/wo-8.4.md` (screenshots in `docs/plan/iterations/pr/wo-8.4/`), with the headings of `../HANDOFF.md` section 6, then merge with `git merge --no-ff wo-8.4` into the local `main`. First line of the file: `wo-8.4: one log view with search, Since, save and a jump to the first error`

---

## WO-8.5a The command log file and the recent commands

Needs: WO-0.0 (green baseline), iteration 4 (exec.rs). Plan task 8.5 (G5, X8), first of two.

### Why

X8: there is no log file, so every bug report starts with five questions. This work order records every command the backend runs, in a rolling file in the app's log folder and in a list of the last 20, with the exit code and nothing private. WO-8.5b shows it ("Copy details").

### Read first

1. `docs/plan/08-feature-gaps.md` G5 and X8.
2. `src-tauri/src/exec.rs`: `exec_in`, `run_with_deadline`, `output_with_deadline`, `stream_in` (the function names are from `main.rs` at commit `0bdafcf`; iteration 4 moved them).
3. Tauri path API: https://docs.rs/tauri/2.12.5/tauri/path/struct.PathResolver.html (`app_log_dir`).

### Starting state

```sh
grep -n "async fn exec_in\|pub(crate) fn run_with_deadline\|pub fn stream_in\|pub(crate) fn output_with_deadline" src-tauri/src/exec.rs   # four lines
grep -rn "output_with_deadline(" src-tauri/src | grep -v "fn output_with_deadline" | wc -l       # note the number: other callers keep using it
test ! -f src-tauri/src/applog.rs && echo no-applog-yet
```

### Do not touch

What `exec_in` returns and when it returns it (the text of errors, the 60 second deadline). `output_with_deadline` keeps its signature and its tests.

### Decisions already made

1. What is written is only: UTC time, program, verb, exit, milliseconds. The verb is the program's first word plus, for the grouped docker words (`compose`, `volume`, `image`, `network`, `system`, `builder`) and for `kubectl get`, the second word. Never a container, volume, image or folder name, never an argument value.
2. A failed command also writes one `error:` line: the first line of its error text, cut at 200 characters, with the home folder replaced by `~`. This line stays in the file on this Mac. **It is never part of "Copy details".** (It can hold a container name; that is why.)
3. The file is `openpier.log` in the folder `app.path().app_log_dir()` returns (on macOS `~/Library/Logs/<bundle identifier>/`). At 1,000,000 bytes it is renamed to `openpier.1.log` (replacing an older one) and a new file starts. So the log never holds more than about 2 MB.
4. Commands that are streamed (pulls, Colima start and stop, Compose) are recorded when they end, with the exit `0` or `failed`: the stream function does not return a code.

### Steps

1. **Tests first.** Create `src-tauri/src/applog.rs` with signatures and `todo!()` bodies and these tests (module `tests`; temp folders come from `std::env::temp_dir()` plus a unique name made from `std::process::id()` and a counter, removed at the end):
   1. `given_docker_logs_with_flags_and_a_container_when_verb_then_docker_logs`: args `["--context","colima","logs","--timestamps","--tail","500","api"]`.
   2. `given_compose_up_when_verb_then_docker_compose_up`.
   3. `given_volume_rm_with_a_name_when_verb_then_docker_volume_rm`.
   4. `given_run_with_name_and_port_when_verb_then_docker_run`.
   5. `given_colima_start_with_flags_when_verb_then_colima_start`.
   6. `given_kubectl_get_pods_when_verb_then_kubectl_get_pods`; `given_kubectl_config_when_verb_then_kubectl_config`.
   7. `given_no_args_when_verb_then_just_the_program`.
   8. `given_epoch_0_when_iso_utc_then_1970_01_01T00_00_00Z`; `given_1700000000_then_2023_11_14T22_13_20Z`; `given_a_leap_day_1709164800_then_2024_02_29T00_00_00Z`.
   9. `given_home_in_the_text_when_redacted_then_tilde`; `given_a_long_first_line_when_redacted_then_cut_at_200_characters`; `given_two_lines_when_redacted_then_only_the_first`.
   10. `given_a_record_when_written_then_the_file_has_one_line_with_time_program_verb_exit_and_ms`.
   11. `given_a_failed_record_when_written_then_an_error_line_follows`.
   12. `given_a_file_over_the_limit_when_written_then_the_old_one_is_renamed_to_dot_1_and_a_new_file_starts`.
   13. `given_25_records_when_recent_20_is_asked_then_the_last_20_in_order`.
   14. `given_the_written_text_when_scanned_then_it_has_no_container_name`: record `docker rm -f secret-db` and assert the file text does not contain `secret-db`.
   Run `cd src-tauri && cargo test applog::`, see them fail, commit.
2. **`src-tauri/src/applog.rs`.** Items, in order:
   1. `#[derive(Clone, Debug, Serialize)] pub struct CmdRecord { pub at: u64, pub line: String, pub exit: String }` (`line` is `"<program> <verb words>"`, `exit` is `"0"`, `"1"`, ... or `"timeout"`, `"signal"`, `"failed"`, `"not-run"`).
   2. `pub fn verb(program: &str, args: &[String]) -> String` per decision 1. Skip a leading `--context <value>` pair. The first remaining word is the verb. Add the second word only when the program is `docker` and the verb is one of the six grouped words, or when the program is `kubectl` and the verb is `get`.
   3. `pub fn iso_utc(epoch_secs: u64) -> String` returns `YYYY-MM-DDTHH:MM:SSZ` using days-to-civil arithmetic (the public-domain "civil_from_days" algorithm). No date crate.
   4. `pub fn redact(text: &str, home: &str) -> String` per decision 2 (first line, home to `~` when `home` is not empty, at most 200 characters).
   5. `struct LogFile { dir: PathBuf, max: u64 }` with `fn append(&self, line: &str)` (creates the folder, rotates when the file is at or over `max`, appends `line` plus a newline; all errors ignored: logging must never break a command).
   6. `static STATE: OnceLock<Mutex<State>>` with `State { file: Option<LogFile>, ring: VecDeque<CmdRecord> }`. `pub fn init(dir: PathBuf)` sets the file (`max` 1_000_000). `pub fn record(program: &str, args: &[String], exit: &str, ms: u128, error: Option<&str>)` pushes a `CmdRecord` (ring capped at 100, so `recent` can answer up to 100), writes the line `"<iso> <line> exit=<exit> ms=<ms>"` and, with an error, `"<iso> error: <redacted first line>"` (home from `HOME`). `pub fn recent(n: usize) -> Vec<CmdRecord>`. `pub fn dir() -> Option<PathBuf>`.
   7. `#[tauri::command] pub fn reveal_logs() -> Result<(), String>`: runs `open <dir>` with a fixed argv (`Command::new("open").arg(dir)`), error text `"The log folder is not ready yet."` when there is no dir.
3. **Hook `exec_in`.** In `src-tauri/src/exec.rs`, inside `exec_in`, replace the call `output_with_deadline(cmd, EXEC_DEADLINE)` with `run_with_deadline(cmd, EXEC_DEADLINE)` and rebuild what the first call did: when the status is `None` append `format!("\nStopped after {}s with no answer. Docker or Colima may be stuck; try restarting the VM.", EXEC_DEADLINE.as_secs())` to stderr (the same text as in `output_with_deadline`), and `ok = status.map_or(false, |s| s.success())`. Take `let started = Instant::now();` before the call. After it, call `crate::applog::record(bin, &args, &exit, started.elapsed().as_millis(), error_text)`, where `exit` is the code as text, `"timeout"` when the status is `None`, `"signal"` when it has no code, and `error_text` is the stderr (or, with `merge_stderr`, the stdout) as `Some` when `!ok`. When the process could not be started (`missing`), record `"not-run"` before returning the error. Behaviour and returned values stay as they were.
4. **Hook `stream_in`.** Rename the existing `pub fn stream_in` to `fn stream_in_inner` and add a new `pub fn stream_in` with the same signature that starts a timer, calls `stream_in_inner`, then records `"0"` on `Ok` or `"failed"` on `Err` (error text: the `Err` string), and returns the result unchanged.
5. **Start it.** In `main.rs` add `mod applog;` and, in the `.setup` closure of WO-8.1a, before `tray::setup`: `if let Ok(dir) = app.path().app_log_dir() { applog::init(dir); }` (needs `use tauri::Manager;`). Register `applog::reveal_logs` in `generate_handler!`. Mock: `case "reveal_logs": ((window as any).__revealedLogs ??= 0); (window as any).__revealedLogs++; return undefined as T;`.
6. `cargo fmt`, `cargo clippy --all-targets -- -D warnings`, `cargo test`. The count of tests that existed before must still pass.
7. Add to `CHANGELOG.md`: `OpenPier keeps a small rolling log of the commands it runs, in the app's log folder.`

### Done when

```sh
cd src-tauri && cargo test applog:: 2>&1 | grep "test result"       # at least 16 passed, 0 failed
cd src-tauri && cargo test 2>&1 | grep "test result"                 # no failures; passed count not lower than at the Starting state plus 16
grep -n "applog::record" src-tauri/src/exec.rs | wc -l                # 3 or more (exec_in ok, exec_in not-run, stream_in)
```

Plus the gate. By hand (the plan's author): run the real app, press a few buttons, open `~/Library/Logs/<bundle id>/openpier.log`: each command is one line with a verb and an exit, and no container name appears in the command lines.

### Pull request text

There is no GitHub pull request. Write `docs/plan/iterations/pr/wo-8.5a.md` (screenshots in `docs/plan/iterations/pr/wo-8.5a/`), with the headings of `../HANDOFF.md` section 6, then merge with `git merge --no-ff wo-8.5a` into the local `main`. First line of the file: `wo-8.5a: OpenPier keeps a small log of the commands it runs`

---

## WO-8.5b Copy details, and the log folder from Help

Needs: WO-8.5a. Plan task 8.5 (G5, X8), second of two.

### Why

G5: one button in Settings, About that copies what a bug report needs: app version, macOS version, engine kind and version, Compose version, the last 20 commands with exit codes. No container names, no paths, no environment values.

### Read first

`docs/plan/08-feature-gaps.md` G5; `docs/plan/04-design-spec.md` sections 7.8 (About), 5.2 item 6 (Help), 6.10 (Toast); `src/lib/engines.ts`; the Settings About section file (Starting state finds it).

### Starting state

```sh
test -f src-tauri/src/applog.rs && echo applog
grep -rln "About" src --include=*.tsx | grep -i settings     # the file of the About section: ABOUT_FILE
grep -rn "Give feedback" src --include=*.tsx | head -3        # the Help dialog file: HELP_FILE
```

### Steps

1. **Tests first.** `src/lib/diagnostics.test.ts` (node tests):
   1. `given_a_full_answer_when_formatted_then_the_text_is_exactly_the_five_parts`: input `{ appVersion: "0.1.0", macos: "15.1", docker: "27.3.1", compose: "2.29.7", commands: [{ at: 1700000000, line: "docker ps", exit: "0" }, { at: 1700000001, line: "docker logs", exit: "1" }] }` and engine kind `colima` give exactly:
      ```
      OpenPier 0.1.0
      macOS 15.1
      Engine: colima (Docker 27.3.1)
      Compose: 2.29.7
      Last 2 commands:
      2023-11-14T22:13:20Z docker ps exit 0
      2023-11-14T22:13:21Z docker logs exit 1
      ```
   2. `given_no_docker_answer_when_formatted_then_engine_line_says_not_answering`: `Engine: colima (not answering)`.
   3. `given_no_compose_when_formatted_then_compose_line_says_not_found`.
   4. `given_thirty_commands_when_formatted_then_only_the_last_20`.
   5. `given_a_command_line_with_a_slash_when_formatted_then_it_is_dropped_from_the_list` (defence in depth: a line that contains `/` or `=` is replaced by its first word).
   Run, see failures, commit.
2. **`src-tauri/src/diagnostics.rs`** (new): `#[derive(Serialize)] #[serde(rename_all = "camelCase")] pub struct Diagnostics { app_version: String, macos: String, docker: Option<String>, compose: Option<String>, commands: Vec<crate::applog::CmdRecord> }` and `#[tauri::command] pub fn diagnostics(app: tauri::AppHandle, context: String) -> Diagnostics`. Order inside: take `crate::applog::recent(20)` first (so the commands below are not in the list); `app_version` is `app.package_info().version.to_string()`; `macos` is the trimmed output of `/usr/bin/sw_vers -productVersion` (empty text when it fails); `docker` is the trimmed output of `docker --context <context> version --format {{.Server.Version}}` and `compose` of `docker --context <context> compose version --short`, both only when `crate::engine::context_ok(&context)`, each through `crate::exec::output_with_deadline(cmd, 3 s)` (`None` when not `Ok((true, ..))` or empty). Register `mod diagnostics;` and `diagnostics::diagnostics`. Mock: `case "diagnostics": return { appVersion: "0.1.0", macos: "15.1", docker: "27.3.1", compose: "2.29.7", commands: [{ at: 1700000000, line: "docker ps", exit: "0" }] } as T;`.
3. **`src/lib/diagnostics.ts`** (new): `export type Diagnostics = { appVersion: string; macos: string; docker: string | null; compose: string | null; commands: { at: number; line: string; exit: string }[] }`; `export function formatDetails(d: Diagnostics, engineKind: string): string` (the text of test 1; times by an `isoUtc(seconds)` helper written with `new Date(s * 1000).toISOString().slice(0, 19) + "Z"`); `export async function copyDetails(engineKind: string, context: string): Promise<string>` that calls `invoke<Diagnostics>("diagnostics", { context })`, formats, writes it with `navigator.clipboard.writeText` and returns the text.
4. **The button.** In ABOUT_FILE add a `Button` (default variant), label exactly `Copy details`, after the links, that calls `copyDetails(engine.kind, engine.context)` for the selected engine (`useEngine()`) and then shows the toast `Copied`: `const toast = useToast(); toast({ text: "Copied" })` (`useToast()` returns a function, WO-1.3b; the page is already inside the `ToastProvider` of the shell). Words: `Copy details` is from G5; `Copied` is the toast text.
5. **Mock.** In `preview/mock.ts` add `case "diagnostics": return { appVersion: "0.1.0", macos: "15.0", docker: "27.0.0", compose: "2.29.7", commands: [{ at: 1700000000, line: "docker ps", exit: "0" }] } as T;` (the fields of the `Diagnostics` type; one command, so the check's `Last 1 commands:` is true) and `case "reveal_logs": (window as any).__revealedLogs = ((window as any).__revealedLogs ?? 0) + 1; return undefined as T;` (`__revealedLogs` is a number that counts calls) (the mock-coverage test needs both).
6. **Browser check** `scripts/check-copy-details.mjs`: open `/?scenario=running#/settings/about`; stub `navigator.clipboard.writeText` to store its argument; click `Copy details`; `check` "copy details: the text starts with the app version": it starts with `OpenPier 0.1.0`; `check` "copy details: it has the engine, compose and commands lines": it contains `Engine: colima`, `Compose: 2.29.7` and `Last 1 commands:`; `check` "copy details: it has no container name": it does not contain `api`, `worker` or `kafka`; `check` "copy details: a toast confirms": the text `Copied` is on the page.
7. **Open log folder from Help.** Help is a sheet (decision D9). In HELP_FILE add a ghost `Button` `Open log folder` next to `Give feedback`, calling `invoke("reveal_logs")`. Add to the check script: open the Help sheet, click it, `check` "help: open log folder reaches the backend": `window.__revealedLogs === 1`.

### Done when

```sh
node --experimental-strip-types --no-warnings --test src/lib/diagnostics.test.ts 2>&1 | grep -E "^(ℹ|#) (pass|fail)"      # pass 5, fail 0
PW_ENGINES="chromium webkit" sh scripts/check-all.sh 2>&1 | grep "check-copy-details"                               # 0 in both
cd src-tauri && cargo build 2>&1 | tail -1                                                                          # Finished
```

Plus the gate. Eyes: Settings, About shows the button in the style of the other buttons; compare the page frame with `design/shots/settings-machines-light.png` (the About section has no picture).

### Pull request text

There is no GitHub pull request. Write `docs/plan/iterations/pr/wo-8.5b.md` (screenshots in `docs/plan/iterations/pr/wo-8.5b/`), with the headings of `../HANDOFF.md` section 6, then merge with `git merge --no-ff wo-8.5b` into the local `main`. First line of the file: `wo-8.5b: Copy details gives a bug report everything it needs and nothing private`

---

## WO-8.6 A broken page shows an error, not a blank window

Needs: WO-8.5b (it uses `copyDetails`), iteration 2 (router). Plan task 8.6 (X7).

### Why

X7: the error boundary exists in one place only, and that place is parked or deleted. One thrown error in a page blanks the whole window. Every page gets a boundary that shows the error state and "Copy details".

### Read first

`docs/plan/08-feature-gaps.md` X7; `docs/plan/04-design-spec.md` sections 6.9 (Error), 6.10 (Banner), 9 (words, rule 6); `src/ui/Banner.tsx`, `src/ui/Canvas.tsx` and `src/ui/Button.tsx` (their props are in WO-1.3a and 1.3b); where the router picks the page (Starting state).

### Starting state

```sh
ls src/ui/ErrorBoundary.tsx 2>&1                         # either the old Tailwind file (it is replaced) or "No such file" (it is created)
grep -rn "ErrorBoundary" src --include=*.tsx --include=*.ts | grep -v "src/ui/ErrorBoundary"    # prints nothing, or imports of the old one (remove them)
grep -rn "useRoute" src/Shell.tsx src/App.tsx            # the place that renders the current page: PAGE_OUTLET
grep -rn "dev/gallery" src/lib/router.ts                      # how the router table guards a development-only route
grep -n "export" src/ui/index.ts | grep -c "Button\|Sev"  # 2 or more
test -f src/lib/diagnostics.ts && echo diagnostics
```

### Do not touch

The parked or deleted old Projects page. Any page's own code: no page is edited, only wrapped.

### Words (spec 9, rule 6: what happened, the evidence, the next step)

Title `This page stopped working`. Line `OpenPier hit an unexpected error while showing it. What it said:`. Evidence: the error message, selectable. Buttons `Try again` (primary) and `Copy details`. These are built from the three-part rule and the button words of spec 9.

### Steps

1. **Tests first.** `src/ui/ErrorBoundary.test.tsx` (vitest). A helper `Bomb` that throws `new Error("boom")` when its `fail` prop is true.
   1. `given_a_child_that_throws_when_rendered_then_the_alert_shows_the_title_and_the_message_and_the_sibling_layout_remains` (render the boundary inside a `<nav>` sibling; the nav is still there).
   2. `given_the_error_state_when_try_again_is_pressed_and_the_child_no_longer_throws_then_the_child_shows`.
   3. `given_the_error_state_when_the_reset_key_changes_then_the_boundary_resets`.
   4. `given_the_error_state_when_copy_details_is_pressed_then_on_copy_is_called_once`.
   5. `given_no_error_when_rendered_then_children_show_and_there_is_no_alert`.
   6. `given_the_error_state_then_the_alert_has_role_alert_and_the_buttons_are_named_try_again_and_copy_details`.
   Run, see failures, commit.
2. **`src/ui/ErrorBoundary.tsx`** (replace the whole file; delete the Tailwind version and its `ProjectDetailErrorFallback`):
   ```tsx
   import { Component, type ErrorInfo, type ReactNode } from "react";
   import { Banner } from "./Banner";
   import { Button } from "./Button";
   import { Canvas } from "./Canvas";

   type Props = { children: ReactNode; resetKey: string; onCopy: () => void };
   type State = { error: Error | null };

   // Catches an error thrown while a page draws. The shell around it stays; the page shows what failed.
   export class ErrorBoundary extends Component<Props, State> {
     state: State = { error: null };
     static getDerivedStateFromError(error: Error): State { return { error }; }
     componentDidCatch(error: Error, info: ErrorInfo) { console.error("page error", error, info.componentStack); }
     componentDidUpdate(prev: Props) {
       if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
     }
     render() {
       const { error } = this.state;
       if (!error) return this.props.children;
       return (
         <div className="content">
           <Banner
             tone="bad"
             title="This page stopped working"
             actions={
               <>
                 <Button variant="primary" onClick={() => this.setState({ error: null })}>Try again</Button>
                 <Button onClick={this.props.onCopy}>Copy details</Button>
               </>
             }
           >
             OpenPier hit an unexpected error while showing it. What it said:
             <Canvas aria-label="Error message" lines={[{ text: error.message || String(error) }]} />
           </Banner>
         </div>
       );
     }
   }
   ```
   The props of `Banner`, `Button` and `Canvas` are fixed by WO-1.3a and WO-1.3b (`Banner`: `tone`, `title`, `children`, `actions`; `Canvas`: `lines`, `aria-label`). Export `ErrorBoundary` from `src/ui/index.ts` (the one named export that is not in spec section 6; the PR says why).
3. **Wrap every page.** In PAGE_OUTLET wrap the element that renders the current page in `<ErrorBoundary resetKey={route.page + "/" + (route.id ?? "")} onCopy={() => void copyDetails(engine.kind, engine.context)}>`. One boundary around the whole outlet (not one per page file), keyed by the route, so each navigation starts clean. The sidebar and header stay outside it.
4. **A page that throws, for the check.** Create `src/dev/Crash.tsx` (a component that throws `new Error("This page was made to fail")` when rendered). Add `#/dev/crash` to the router table (`src/lib/router.ts`, development builds only: the same `import.meta.env.DEV` guard the router already uses for `#/dev/gallery`; if it has none, guard the table entry with `import.meta.env.DEV`) and render it in the page outlet **inside** the `ErrorBoundary` of step 3, so the boundary catches it. Do not register it in `main.tsx`. Add its route test to `src/lib/router.test.ts`: `given_a_development_build_when_dev_crash_is_parsed_then_the_page_is_crash` and `given_a_production_build_when_dev_crash_is_parsed_then_the_page_is_the_default`.
5. **Browser check** `scripts/check-error-boundary.mjs`: `const p = await open("/#/dev/crash")` from `scripts/lib/check.mjs` (WO-0.3), then at once `p.removeAllListeners("pageerror")`: React in development logs a thrown render error again as a page error, and `open()` would count that as a FAIL. Only this script removes the guard.
   1. `check` "error page: the alert is shown": a `[role=alert]` contains `This page stopped working`.
   2. `check` "error page: the evidence is shown": it contains `This page was made to fail`.
   3. `check` "error page: the sidebar still works": the sidebar's Containers item is present, click it, `location.hash` starts with `#/containers` and the alert is gone.
   4. `check` "error page: Try again is primary and Copy details is there": a `.btn.primary` named `Try again` and a button named `Copy details`.
   5. Stub the clipboard, return to `#/dev/crash`, click `Copy details`: `check` "error page: copy details puts the report on the clipboard": the stub got text starting with `OpenPier `.
   6. `check` "error page: the boundary caught the error": the `[role=alert]` of item 1 exists (an error the boundary did not catch leaves a blank page and no alert).
   7. End with `await done()`.
6. Add to `CHANGELOG.md`: `A page that fails now shows what went wrong, with a Copy details button, instead of a blank window.`

### Done when

```sh
npx vitest run src/ui/ErrorBoundary.test.tsx 2>&1 | grep Tests                              # 6 passed
PW_ENGINES="chromium webkit" sh scripts/check-all.sh 2>&1 | grep "check-error-boundary"     # 0 in both
grep -rn "ErrorBoundary" src --include=*.tsx | grep -v test | grep -v "src/ui/" | wc -l      # 1 or more (the wrapper in the shell)
grep -c "Tailwind\|className=\"flex\|bg-\[var" src/ui/ErrorBoundary.tsx                       # 0
```

Plus the gate. Eyes: compare the alert with the banner in `design/shots/loading-error-toast-light.png` (same `.banner.bad`: icon, title, grey body, buttons at the right). Do the same in dark.

### Pull request text

There is no GitHub pull request. Write `docs/plan/iterations/pr/wo-8.6.md` (screenshots in `docs/plan/iterations/pr/wo-8.6/`), with the headings of `../HANDOFF.md` section 6, then merge with `git merge --no-ff wo-8.6` into the local `main`. First line of the file: `wo-8.6: a page that fails shows the error and Copy details, not a blank window`

---

## WO-8.8 Size scenario and check

Needs: WO-3.1 (Containers), WO-7.5 (Projects list). Plan task 8.8 (X2).

### Why

X2: nothing checks 200 containers or 50 projects. The budget (stated in G2's neighbour, X2): the list renders and scrolls, and first paint is under 1 second in the preview.

### Read first

`docs/plan/08-feature-gaps.md` X2; `preview/mock.ts` (the `Ctr` type, `labelsOf`, the `ps` case, and the handler for the projects list); `docs/plan/04-design-spec.md` section 6.5 item 9 (virtualised above 200 rows); `@tanstack/react-virtual`: https://tanstack.com/virtual/latest/docs/framework/react/react-virtual .

### Starting state

```sh
grep -n 'scenario === "design"\|scenario === "doctor"' preview/mock.ts | head -3      # how a scenario adds data
grep -n 'case "projects_read"\|case "compose_ls"' preview/mock.ts                      # the project handlers (WO-7.5); note PROJECTS_CASE
grep -n "scenario" scripts/lib/check.mjs | head -3                                      # how open(path) builds the address
ls src/ui/VirtualRows.tsx 2>&1                                                          # "No such file": it is built here
grep -n "react-virtual" package.json                                                    # present, or run: npm install @tanstack/react-virtual@3 (WO-8.4 also needs it)
grep -rln "Need attention" src --include=*.tsx | grep -v test                           # exactly one file: CONTAINERS_LIST_FILE (WO-3.1b renders every row there and says so); anything else: stop and report
```

### Steps

0. **`VirtualRows` (new, `src/ui/VirtualRows.tsx`), tests first** in `src/ui/VirtualRows.test.tsx` (vitest): `given_150_items_when_rendered_then_every_item_is_in_the_document`; `given_500_items_when_rendered_then_fewer_than_100_are_in_the_document_and_the_first_is_one_of_them`; `given_500_items_when_the_scroll_parent_is_scrolled_to_the_end_then_the_last_item_is_in_the_document` (jsdom has no layout: stub `getBoundingClientRect` and `offsetHeight` on the scroll parent to 600 and each row to 32, as the `react-virtual` docs do for tests); `given_items_when_the_list_shrinks_below_the_threshold_then_every_item_is_rendered_again`. Then the component:
   ```tsx
   export const VIRTUAL_ROWS_THRESHOLD = 200;
   export function VirtualRows<T>(props: {
     items: T[];
     getKey: (item: T) => string;
     render: (item: T, index: number) => React.ReactNode;   // one list row, or one group with its sub rows
     estimate: number;                                       // px, a first guess; rows are measured
     scrollParent: React.RefObject<HTMLElement>;             // the element that scrolls (the page's `.content`)
   }): JSX.Element;
   ```
   Up to `VIRTUAL_ROWS_THRESHOLD` items it returns `<>{items.map(...)}</>` with no wrapper and no `style`. Above it, it uses `useVirtualizer({ count, getScrollElement: () => scrollParent.current, estimateSize: () => estimate, overscan: 10 })` and renders `<div style={{ height: total, position: "relative" }}>` with each item in `<div key data-index ref={virtualizer.measureElement} style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${start}px)` }}>`. These `style=` are the only ones in the file. In `eslint.config.js`, in the block whose `files` lists `Meters.tsx` and `LogView.tsx` (`grep -n "Meters.tsx" eslint.config.js`), add `"src/ui/VirtualRows.tsx"`. The allowlist is then exactly `Meters.tsx`, `LogView.tsx`, `VirtualRows.tsx` (spec section 0 rule 2). Export it from `src/ui/index.ts`.
   Use it in CONTAINERS_LIST_FILE: the top-level rows (a loose container, or a project group with its sub rows as one item) go through `<VirtualRows items getKey render estimate={...} scrollParent={contentRef} />`. `estimate` is the height of one row `34`: the stylesheet sets `.row { height: var(--row) }` and `--row: 34px` (check with `grep -n -e "--row:" src/ui/openpier.css`; if it is not 34px, stop and report). A problem line under a row is 32 pixels; the virtual list measures real heights after the first draw, so the estimate only has to be close. Remove the sentence "renders every row" that WO-3.1b put in the file's comment. The Projects list is under the threshold and stays as it is.
1. **Mock scenarios `big` and `huge`.** In `preview/mock.ts` after the `doctor` scenario block add a block for `scenario === "big" || scenario === "huge"` that replaces `db.ctrs` with N containers built by a loop (`i` from 1 to N; N is 200 for `big` and 500 for `huge`): name `svc-${pad3(i)}`, image `acme/svc:${1 + (i % 7)}`, state `running` for 90 per cent and `exited` for every tenth, `ports: i % 5 === 0 ? [[8000 + i, 80]] : []`, `networks: ["devnet"]`, `born: now - i * 6e4`, `cpu` `(i % 13) / 4`, `mem` `(20 + (i % 17) * 10) * 1e6`, `mounts: []`, `env: []`, `id: hex(64)`. For `big` only, containers 151 to 200 belong to five Compose projects of ten (`proj-01` to `proj-05`), by setting `labels` to `com.docker.compose.project=proj-0N,com.docker.compose.project.working_dir=/Users/me/code/proj-0N,com.docker.compose.project.config_files=/Users/me/code/proj-0N/compose.yaml,com.docker.compose.service=svc-NNN`. All of them healthy and running (no problem lines), so the five groups are not special. For `big` also add 50 projects to the project list handler (`proj-01` to `proj-50`, found by the Projects page; see PROJECTS_CASE). Rows: `big` shows 150 loose containers and 5 groups (155 top-level rows, under the threshold, so every row is rendered); `huge` shows 500 (over it, so the list is virtual).
2. **Check** `scripts/check-big.mjs`, using `open`, `check`, `done`. It opens `/?scenario=big#/containers` once (to warm the dev server's module cache; its result is ignored), then opens it again and measures:
   1. `check` "big: 155 rows are listed (150 containers and 5 groups)": count the rows with the row class of the list (`.row:not(.th)`) after scrolling the list to its end in steps and collecting the names; the set has 155 names. (If the list is virtualised the DOM holds fewer at any moment; the set across the scroll is the proof.)
   2. `check` "big: first rows appear within 1000 ms": the time from the navigation start to the first `.row:not(.th)` in the document is under 1000 (measure in the page with `performance.now()` read when a `requestAnimationFrame` loop first finds the row). Print `info: first rows after N ms`.
   3. `check` "big: scrolling to the end shows the last container": set the content area's `scrollTop` to its `scrollHeight` and, within 500 ms, a row whose text contains `svc-150` is in the document. Print `info: scroll to end showed the last row after N ms`.
   4. `check` "big: the filter answers quickly": type `svc-077` in the search field; within 500 ms exactly one row is listed.
   5. Open `/?scenario=big#/projects`: `check` "big: 50 projects within 1000 ms": the first project row appears under 1000 ms and the set of names across a scroll has 50 entries.
   6. Open `/?scenario=huge#/containers`: `check` "huge: only a screenful of rows is in the page": the count of `.row:not(.th)` in the document is under 100; `check` "huge: scrolling to the end shows the last container": set the content area's `scrollTop` to its `scrollHeight`; within 500 ms a row whose text contains `svc-500` is in the document; `check` "huge: the filter finds one in 500": type `svc-377`; within 500 ms exactly one row is listed.
   7. End with `await done()` (`open()` already fails the script on a page error).
   The budget is a number in the script: `const BUDGET_MS = 1000;` with the comment `X2 in 08-feature-gaps.md`. If a measurement is over it, **stop and report the numbers**; do not raise the budget.
3. Add a line to `docs/plan/FOUND.md` only if a measurement is over 700 ms (a warning, not a failure), with the number.

### Done when

```sh
PW_ENGINES="chromium webkit" sh scripts/check-all.sh 2>&1 | grep "check-big"        # 0 in both
grep -n "BUDGET_MS = 1000" scripts/check-big.mjs                                     # one line
grep -c 'scenario === "big"' preview/mock.ts                                          # 1 or more
npx vitest run src/ui/VirtualRows.test.tsx 2>&1 | grep Tests                          # 4 passed
grep -rln "style=" src --include=*.tsx | grep -v test | sort                           # exactly Meters.tsx, LogView.tsx, VirtualRows.tsx
```

Plus the gate. The PR states the printed `info:` numbers for WebKit.

### Pull request text

There is no GitHub pull request. Write `docs/plan/iterations/pr/wo-8.8.md` (screenshots in `docs/plan/iterations/pr/wo-8.8/`), with the headings of `../HANDOFF.md` section 6, then merge with `git merge --no-ff wo-8.8` into the local `main`. First line of the file: `wo-8.8: a long container list is virtual, and 200 containers and 50 projects are proven fast`

---

## WO-8.7 Nightly real-engine job

Needs: WO-7.8 (the two-project test), WO-0.6 (CI). Plan task 8.7 (X1).

### Why

X1: every browser check runs against a fake backend, and the Rust tests never meet a real engine. One slow job each night starts Colima, runs the two-project test of `07` section 10 and three Doctor scenarios, and checks that real Docker events look the way WO-8.2a assumes.

### Read first

`docs/plan/08-feature-gaps.md` X1; `docs/plan/07-projects-spec.md` section 10; `scripts/eval-setup.sh` and `scripts/eval-teardown.sh`; `.github/workflows/ci.yml`; `src/lib/doctor.ts` (`doctor`, `Facts`), `src/lib/health.ts` (`parseState`, `problemsFor`).

### Starting state

```sh
ls scripts/*two-project* 2>&1                            # exactly one file: TWO_PROJECT_SCRIPT (written by WO-7.8)
ls src-tauri/tests 2>&1 | head -3                        # note it: if WO-7.8 wrote a cargo test instead of a script, stop and report
test -f .github/workflows/ci.yml && echo ci
ls scripts/fixtures/projects/a/app scripts/fixtures/projects/b/app    # the fixtures of WO-7.8
```

Expected: one script; `ci`; the fixture folders. If WO-7.8's test is not a script `sh` can run, stop and report: do not rewrite it.

### Safety

The script starts an engine, so it refuses to run unless `CI=true` or `OPENPIER_ENGINE_TEST=1` is set. Nobody runs it on a developer Mac by accident. (Rule 7 of the handoff: no command that changes the machine.) This work order does not run it; the first real run happens on the runner and is part of the work order's result.

### Steps

1. **`scripts/real-engine-test.sh`** (new, POSIX sh, executable). In order:
   1. `set -eu`; refuse unless `[ "${CI:-}" = "true" ] || [ "${OPENPIER_ENGINE_TEST:-}" = "1" ]`, printing `This starts an engine. Set OPENPIER_ENGINE_TEST=1 to run it here.` and exiting 2.
   2. `colima start --cpu 2 --memory 4 --disk 20`, then `docker context use colima` and `docker info >/dev/null`.
   3. Part A, Doctor on real containers: `sh scripts/eval-setup.sh`; `sleep 40` (the health check needs about 10 seconds, the crash loop a few restarts, the memory kill a few seconds); `node --experimental-strip-types --no-warnings scripts/real-doctor.mjs`.
   4. Part B, events: `node scripts/real-events-shape.mjs`.
   5. Part C, projects: `sh "$TWO_PROJECT_SCRIPT"` where `TWO_PROJECT_SCRIPT` is the file found with `set -- scripts/*two-project*; [ -e "$1" ] || exit 3` (so the script's name is not repeated here).
   6. A `trap` that always runs `sh scripts/eval-teardown.sh` on exit.
   7. Exit non-zero if any part failed, after running all three (collect a `bad` flag, as `scripts/check-all.sh` does).
2. **`scripts/real-doctor.mjs`** (new, ESM, run with `--experimental-strip-types`): runs `docker ps -aq --filter name=eval-` and `docker inspect <ids>` with `child_process.execFileSync`, parses the JSON, and for each container calls `parseState` and `problemsFor` from `../src/lib/health.ts`; and calls `doctor({ containers: <the inspect array>, ctx: "colima" })` from `../src/lib/doctor.ts`. It prints `ok <what>` or `FAIL <what>` for exactly these three scenarios (the names come from `scripts/eval-setup.sh`):
   1. `ok doctor: eval-unhealthy is reported as its health check failing`: `problemsFor(parseState(<eval-unhealthy>))` contains id `unhealthy`.
   2. `ok doctor: eval-oom is reported as out of memory`: for `eval-oom`, id `oom`.
   3. `ok doctor: eval-client is reported as looking for a server at localhost`: `doctor(...).findings` contains id `localhost-target` with `subject` `eval-client`.
   Exit 1 on any FAIL. Not verified: that all three ids appear on a real engine (they come from reading `doctor.ts` and `health.ts`; `eval-client` needs `eval-server` running and exposing 80). The first run on the runner decides. If one is absent, report the printed findings and stop. Do not loosen the test.
3. **`scripts/real-events-shape.mjs`** (new): with `docker run -d --name eval-shape alpine:3.20 sleep 60`, then `docker stop eval-shape`, then `docker run -d --name eval-shape2 alpine:3.20 sleep 60` and `docker kill eval-shape2`, then `docker rm -f eval-shape eval-shape2`: reads `docker events --since <t0> --until <t1> --filter type=container --format '{{json .}}'` (the exact form the app uses) and checks, printing `ok` or `FAIL`:
   1. `events: a stop gives a kill event with a signal attribute, a die event with an exitCode attribute, and a stop event, in that order, for eval-shape`.
   2. `events: a kill gives a die event with exitCode 137 and no stop event for eval-shape2`.
   3. `events: every event has Type, Action, Actor.Attributes.name and timeNano`.
   These are the shapes WO-8.2a's parser and rules rely on. Exit 1 on any FAIL.
4. **`.github/workflows/nightly-engine.yml`** (new):
   ```yaml
   name: Nightly engine test
   on:
     schedule:
       - cron: "17 3 * * *"
     workflow_dispatch:
   permissions:
     contents: read
   jobs:
     engine:
       # Not verified: that Colima's VM starts on this runner. GitHub's Apple silicon runners (M1 and M2) cannot run
       # a VM inside a VM; the Intel image can. The first run decides. If it fails at "colima start", report it.
       runs-on: macos-15-intel
       timeout-minutes: 60
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 22 }
         - run: brew install colima docker docker-compose
         - run: sh scripts/real-engine-test.sh
         - if: failure()
           run: colima status || true
   ```
   (Action versions follow `ci.yml`; WO-8.9 pins them all by commit.)
5. **Prove what can be proved here.** `sh -n scripts/real-engine-test.sh`; `node --experimental-strip-types --no-warnings --check`-style parse is not available, so run `node --experimental-strip-types --no-warnings -e "import('./scripts/real-doctor.mjs')"` **only** with `OPENPIER_NO_ENGINE=1` set, which the script reads at its top and answers by printing `skip: no engine` and exiting 0 (add that guard). Same for `real-events-shape.mjs`.
6. **The first run.** After merge the plan's author starts the workflow with `workflow_dispatch` and records the result in the PR (green run link, or the failing step and output). This work order is "done" for the repo when the files exist and the checks below pass; it is "proven" only when that run is green. Say which in the PR.
7. `CHANGELOG.md` needs no line (no user-visible change).

### Done when

```sh
sh -n scripts/real-engine-test.sh && echo syntax-ok
sh scripts/real-engine-test.sh; echo "exit $?"                           # prints the refusal text, exit 2 (with CI unset)
OPENPIER_NO_ENGINE=1 node --experimental-strip-types --no-warnings scripts/real-doctor.mjs        # skip: no engine
grep -c "cron:" .github/workflows/nightly-engine.yml                      # 1
grep -c "workflow_dispatch" .github/workflows/nightly-engine.yml          # 1
grep -c "runs-on: macos" .github/workflows/nightly-engine.yml             # 1
```

Plus the gate (it does not run the new job).

### Pull request text

There is no GitHub pull request. Write `docs/plan/iterations/pr/wo-8.7.md` (screenshots in `docs/plan/iterations/pr/wo-8.7/`), with the headings of `../HANDOFF.md` section 6, then merge with `git merge --no-ff wo-8.7` into the local `main`. First line of the file: `wo-8.7: a nightly job tests OpenPier against a real engine`
