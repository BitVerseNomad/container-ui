# Iteration 1 work orders

What this iteration delivers:

1. A repo that is safe and buildable: every check in the gate passes, the dead and unsafe code is gone, the browser preview works again.
2. The app is called OpenPier everywhere.
3. The design system: one stylesheet, the components, and the guards that keep the app equal to the design.

Nothing a user sees gets better in this iteration. After WO-1.1 the app looks worse than before (most screens lose their styling). That is expected. Iterations 2 and 3 rebuild each screen.

Read `../HANDOFF.md` and `README.md` (this folder) first.

## Order

`WO-0.0`, `WO-0.2`, `WO-0.3`, `WO-0.5`, `WO-0.4`, `WO-0.6`, `WO-1.1`, `WO-1.2`, `WO-1.3a`, `WO-1.3b`, `WO-1.3c`, `WO-1.4`, `WO-1.5`.

Each needs the one before it. `WO-0.1` (the signing key) is the owner's work, not yours. Never open `private.key`.

## What was measured on commit `0bdafcf` before you started

| Command | Result on `0bdafcf` |
|---|---|
| `npx tsc --noEmit` | passes |
| `npm test` | passes: 586 node tests, then 98 vitest tests in 10 files |
| `npm run lint` | FAILS: 136 errors, 29 warnings |
| `(cd src-tauri && cargo test)` | passes: 137 passed, 2 ignored |
| `(cd src-tauri && cargo fmt --check)` | FAILS: 482 diffs |
| `(cd src-tauri && cargo clippy --all-targets -- -D warnings)` | FAILS: 42 errors |
| `npm run check` | FAILS: the preview does not build (`preview: unknown module @tanstack/react-query`) |

`cargo` needs the folder `dist/` to exist (`tauri::generate_context!` reads it). If `cargo` fails with a message about `../dist`, run `npm run build` once and try again.

---

## WO-0.0 The gate is green

**Needs**: nothing.

**Why**: the gate in `../HANDOFF.md` section 5 fails today, so nobody can tell a new failure from an old one.

**Read first**: `eslint.config.js`, `package.json`.

**Starting state**

```bash
git status --short            # expect: no output. If there is output, stop and report. Do not stash, reset or commit it.
git rev-parse --abbrev-ref HEAD   # expect: main
npm ci                        # expect: exit 0
npm run lint 2>&1 | tail -3   # expect: a line with "136 errors"
npx tsc --noEmit              # expect: no output, exit 0
```

If the lint error count is not 136, carry on only if every error is one of these two kinds: `no-restricted-syntax`, or `Definition for rule 'react-hooks/exhaustive-deps' was not found`. Any other kind: stop and report.

**Do not touch**: any file under `src/` other than through formatting-free config changes described below. No behaviour changes in Rust: only what `cargo fmt` and the clippy suggestions do.

**Steps**

1. Create the branch `wo-0.0` from `main`.
2. Install the missing ESLint plugin (the code already has `eslint-disable` comments that name its rule):

   ```bash
   npm install --save-dev eslint-plugin-react-hooks@^5
   ```

3. Replace the whole content of `eslint.config.js` with:

   ```js
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        requestAnimationFrame: "readonly",
        CustomEvent: "readonly",
        EventListener: "readonly",
        Event: "readonly",
        HTMLElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLHeadingElement: "readonly",
        HTMLUListElement: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
    },
    rules: {
      // Colours and sizes live in the stylesheet, never in a component.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: "Hardcoded hex colors are not allowed. Use a class from the stylesheet.",
        },
        {
          selector: "Literal[value=/^\\d+px$/]",
          message: "Hardcoded pixel values are not allowed. Use a class from the stylesheet.",
        },
      ],
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Tests may name colours and sizes: they assert on them.
    files: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Legacy files with hardcoded values. Each is deleted by a later work order; do not add to this list.
    files: ["src/ui/Skeleton.tsx", "src/hooks/useProjectTerminal.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
];
   ```

4. Run `npm run lint`. Expect `0 errors` and about 52 warnings. Warnings are allowed. If there is an error, stop and report.
5. Commit: `chore: make lint pass`.
6. Format the Rust code. This changes many lines and nothing else:

   ```bash
   (cd src-tauri && cargo fmt)
   (cd src-tauri && cargo fmt --check)    # expect: no output, exit 0
   (cd src-tauri && cargo test 2>&1 | grep "^test result")   # expect: "137 passed; 0 failed; 2 ignored"
   ```

   Commit this alone: `style: format the Rust code`.
7. Let clippy fix what it can fix by itself:

   ```bash
   (cd src-tauri && cargo clippy --fix --allow-dirty --allow-staged --all-targets)
   (cd src-tauri && cargo clippy --all-targets -- -D warnings 2>&1 | grep -E "^error" | sort | uniq -c)
   ```

8. Fix by hand what is left, using this table. One row per kind of message. Apply the fix clippy prints under `help:` where the table says "clippy's suggestion".

   | Message | File today | Fix |
   |---|---|---|
   | `this map_or can be simplified` | `main.rs`, `setup.rs`, `desktop.rs` | clippy's suggestion |
   | `called Iterator::last on a DoubleEndedIterator` | `setup.rs` | clippy's suggestion (`next_back()`) |
   | `this .filter_map(..) can be written more simply using .map(..)` | `setup.rs` | clippy prints no code here: change `.filter_map(` to `.map(` and remove the `Some(...)` wrapper around the value the closure returns |
   | `returning the result of a let binding from a block` | `main.rs` | clippy's suggestion |
   | `this operation has no effect` | `desktop.rs` | clippy's suggestion |
   | `unused import` | `projects.rs` | delete the import |
   | `unused variable: x` | `lima.rs` | rename the variable to `_x` at its declaration only |
   | `function get_db_path is never used`, `struct EnvVar is never constructed`, `fields title and multiple are never read`, `large size difference between variants` | `projects.rs`, `lima.rs` | put `#[allow(dead_code)]` (or `#[allow(clippy::large_enum_variant)]` for the last one) directly above the item's `struct`, `enum` or `fn` line (below any `#[derive]` or `#[serde]` line), with the comment `// Removed in WO-0.2.` on the line above the `#[allow]`. For `fields title and multiple are never read` the item is the struct that holds them |

   A message that is not in the table: apply clippy's suggestion if it prints one and the tests still pass; otherwise stop and report. Never use `#[allow]` anywhere else.
9. Run:

   ```bash
   (cd src-tauri && cargo fmt)
   (cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test 2>&1 | grep "^test result")
   ```

   Expect exit 0 and `137 passed; 0 failed; 2 ignored`. Commit: `chore: make clippy pass`.

**Tests to write first**: none. This work order adds no behaviour.

**Done when**

```bash
npm run lint; echo "exit $?"                 # expect: exit 0
npx tsc --noEmit; echo "exit $?"             # expect: exit 0
npm test 2>&1 | grep -E "^# (pass|fail)|Tests "   # expect: "# pass 586", "# fail 0", "Tests  98 passed (98)"
(cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test 2>&1 | grep "^test result")   # expect: "137 passed; 0 failed; 2 ignored"
git diff main --stat -- src | tail -1        # expect: no output (no file under src/ changed)
```

`npm run check` is not part of the gate yet. WO-0.3 makes it work.

**Pull request title**: `wo-0.0: every check in the gate passes`

---

## WO-0.2 Remove the Lima environments and the AI chat

**Needs**: WO-0.0.

**Why**: E2, E3, E4, E12, P3. The old "Projects" feature runs each project in a Lima VM and has three security holes (it can read any file, it builds a shell command from a path, it passes a GitHub token on a command line). The owner decided: Projects are rebuilt on Docker Compose in iteration 5, and the AI chat is out. So this code is deleted, not kept. Git keeps the history.

**Read first**: `src/App.tsx`, `src/Shell.tsx`, `src-tauri/src/main.rs` (only `fn main` at the bottom and the functions named below), `src-tauri/Cargo.toml`.

**Starting state**

```bash
git status --short                                   # expect: no output
ls src-tauri/src                                     # expect: desktop.rs lima.rs main.rs projects.rs setup.rs
grep -c "lima::\|projects::\|ollama_" src-tauri/src/main.rs   # expect: a number above 0
grep -n 'useState<Tab>("Projects")' src/App.tsx      # expect: one line
```

**Do not touch**: `src-tauri/src/desktop.rs`, `src-tauri/src/setup.rs`, any `scripts/check-*.mjs`, `preview/mock.ts`, `src/ui/Skeleton.tsx`, `src/ui/ErrorBoundary.tsx` (they are deleted later, in WO-5.1), the Compose features in `src/ComposeProjects.tsx` (a different feature with a similar name: it stays).

**Steps**

Rust:

1. Delete the files `src-tauri/src/lima.rs` and `src-tauri/src/projects.rs`, and the folder `src-tauri/migrations/`.
2. In `src-tauri/src/main.rs` delete the two lines `mod lima;` and `mod projects;`.
3. In `src-tauri/src/main.rs`, in the `tauri::generate_handler![ ... ]` list inside `fn main`, delete every entry that starts with `lima::` or `projects::`, and the three entries `ollama_chat`, `ollama_list_models`, `ollama_pull`. Keep every other entry. The very last entry of the list today is `projects::environment_delete_cmd`, and it has no comma after it: delete it too (search the list for `lima::`, `projects::` and `ollama_` after you finish; the three searches must find nothing inside the list). The last entry kept is `desktop::open_docker_desktop`; a comma after it is fine.
4. In `src-tauri/src/main.rs` delete the three functions `ollama_chat`, `ollama_list_models`, `ollama_pull` with their `#[tauri::command]` lines.
5. Run `(cd src-tauri && cargo build 2>&1 | grep -E "^(warning|error)" | sort | uniq -c)`. For every "never used", "never constructed" or "unused import" it reports, delete that item (for example the structs `ChatMessage` and `OllamaModel`). Repeat until `cargo build` prints no warning.
6. In `src-tauri/Cargo.toml` delete these lines from `[dependencies]`: `lazy_static`, `chrono`, `uuid`, `dirs`, `sqlx`, `anyhow`, `tokio`. Delete the whole `[dev-dependencies]` section (it holds only `tokio`). The file must then be:

   ```toml
   [package]
   name = "wharf"
   version = "0.2.1"
   edition = "2021"

   [build-dependencies]
   tauri-build = { version = "2", features = [] }

   [dependencies]
   tauri = { version = "2", features = [] }
   serde = { version = "1", features = ["derive"] }
   serde_json = { version = "1", features = ["preserve_order"] }
   ```

7. Run `(cd src-tauri && cargo build)`. If it fails with `unresolved import` or `use of undeclared crate` naming one of the crates you removed, put that one crate back with the exact line it had, and write which and why in the pull request. Anything else failing: stop and report.

TypeScript:

8. Delete these files and folders: `src/features/`, `src/ai/`, `src/shared/`, `src/Onboarding.tsx`, `src/hooks/useProjectTerminal.ts`, `src/lib/projectsApi.ts`, `src/lib/projectDetection.ts`, `scripts/native-interaction.test.ts`.
9. Remove the packages: `npm uninstall xterm @xterm/addon-fit @xterm/addon-webgl`.
10. In `src/App.tsx`:
    1. Delete the line `import { ProjectsPage } from "./features/projects/ProjectsPage";`.
    2. Change `useState<Tab>("Projects")` to `useState<Tab>("Containers")`.
    3. Find `tab === "Projects" ? (` followed by `<ProjectsPage key={activeRuntimeId} />` and `) :`. Delete that branch so the chain of `tab === ... ?` starts with the branch that came next. Read the surrounding ten lines first; the expression must stay valid.
    4. In the `commands` array delete the three objects whose `id` is `"new-project"`, `"switch-projects"` and `"ai-assistant"`.
    5. In the `keyboardShortcuts` array delete the object with `key: "0"`.
    6. Change `{!(tab === "Containers" && detailId) && tab !== "Projects" && <PageHeader title={tab} />}` to `{!(tab === "Containers" && detailId) && <PageHeader title={tab} />}`.
11. In `src/Shell.tsx`:
    1. In `export type Tab = ...` remove `"Projects" | `.
    2. In `NAV` delete the line `{ tab: "Projects", icon: "folder" },`.
    3. In the shortcuts list change `<dt>⌘0–7</dt>` to `<dt>⌘1–7</dt>` and delete the line `<dt>⌘⇧A</dt><dd>AI Assistant</dd>`.
12. In `src/styles.css` delete the rule `.ai-send:disabled { ... }` and everything from the comment `/* Onboarding Modal` to the end of the file.
13. In `eslint.config.js`, in the last block (legacy files), remove `"src/hooks/useProjectTerminal.ts"` from `files`.
14. Run `npx tsc --noEmit`. For each error, the cause is an import of something you deleted: remove that import and the code that used it. If an error is in a file not named in this work order, stop and report.

**Tests to write first**: none. The proof is that the code is gone and everything else still passes. The check that the app opens on Containers is written in WO-0.3, when the preview works.

**Done when**

```bash
ls src-tauri/src                                      # expect: desktop.rs main.rs setup.rs
grep -rn "fs_read_text_file\|fs_read_dir\|get_gh_token\|GH_TOKEN\|ollama\|lima::\|projects::" src-tauri/src; echo "exit $?"   # expect: no lines, exit 1
grep -rnE "features/projects|useProjectTerminal|projectsApi|projectDetection|xterm|Onboarding|ProjectsPage" src scripts preview package.json; echo "exit $?"   # expect: only lines in src/test/setup.ts (a canvas mock, harmless). Any other file: not done.
grep -c "sqlx\|tokio\|uuid\|chrono" src-tauri/Cargo.toml   # expect: 0
(cd src-tauri && cargo test 2>&1 | grep "^test result")     # expect: "135 passed; 0 failed" (one test lived in lima.rs and one in projects.rs)
npm test 2>&1 | grep -E "^# (pass|fail)|Test Files"         # expect: "# pass 586", "# fail 0", "Test Files  8 passed (8)"
```

Plus the gate (without `npm run check`).

**Pull request title**: `wo-0.2: the unsafe Lima environments and the AI chat are gone`

---

## WO-0.3 The browser preview works and the checks run

**Needs**: WO-0.2.

**Why**: E14. The preview is how every screen is seen and checked without touching a real container engine. Today it is built by a hand-written bundler that fails.

**Read first**: `scripts/build-preview.mjs`, `scripts/check-all.sh`, `scripts/check-volumes.mjs` (one check, as an example), `preview/mock.ts` lines 1 to 60 and the function `invoke`, `playwright.config.ts`.

**Starting state**

```bash
git status --short                          # expect: no output
grep -cF 'file://${root}/preview/index.html' scripts/check-*.mjs | grep -vc ":0$"   # expect: 23
grep -n '"preview"\|"check"' package.json   # expect: the two script lines with build-preview.mjs
```

**Do not touch**: the assertions inside any check script. In this work order you change only the address a check opens.

**Steps**

1. Create `vite.preview.config.ts` in the repo root:

   ```ts
// The browser preview: the real UI with preview/mock.ts standing in for the Rust backend.
// Usage: npm run preview, then open http://localhost:4173/?scenario=running
import { defineConfig, mergeConfig } from "vite";
import path from "path";
import base from "./vite.config";

const mock = path.resolve(__dirname, "./preview/mock.ts");

export default mergeConfig(
  base,
  defineConfig({
    server: { port: 4173, strictPort: true },
    resolve: {
      alias: {
        "@tauri-apps/api/core": mock,
        "@tauri-apps/api/event": mock,
      },
    },
    build: { outDir: "preview/dist", emptyOutDir: true },
  }),
);
   ```

2. In `package.json` change two scripts and delete one:
   1. `"preview": "vite --config vite.preview.config.ts"`
   2. `"check": "sh scripts/check-all.sh"`
   3. Delete the line `"test:visual": "node scripts/visual-regression.mjs",`
3. Delete: `scripts/build-preview.mjs`, `playwright.config.ts`, and the nine files `scripts/visual-regression*.mjs` and `scripts/visual-regression*.ts` (`ls scripts/visual-regression*` lists them). Run `npm uninstall @playwright/test` (the checks use the package `playwright`, which stays).
4. In `.gitignore` replace the line `preview/index.html` with `preview/dist/`, and add the lines `test-results/` and `playwright-report/`. Delete the file `preview/index.html` if it exists on your disk (it is not tracked).
5. Create `scripts/lib/check.mjs`:

   ```js
// Shared helpers for the browser checks (scripts/check-*.mjs).
// The checks run against the preview: the real UI with preview/mock.ts as the backend.
// scripts/check-all.sh starts the preview; to run one check by hand: npm run preview, then node scripts/check-<name>.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export const BASE = process.env.PREVIEW_URL || "http://localhost:4173/";
// PW_ENGINE=webkit runs the same check in the engine the app ships with.
export const engine = require("playwright")[process.env.PW_ENGINE || "chromium"];

let failed = 0;
let browser;

// check(condition, "what must be true"): prints "ok ..." or "FAIL ...".
export const check = (cond, message) => {
  console.log(cond ? "ok" : "FAIL", message);
  if (!cond) failed++;
};

// open("/?scenario=running#/containers") returns a page at 1280x800. Page errors count as failures.
export const open = async (path = "/", { width = 1280, height = 800, colorScheme = "light" } = {}) => {
  browser ??= await engine.launch();
  const page = await browser.newPage({ viewport: { width, height }, colorScheme, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => check(false, `page error: ${String(e).slice(0, 200)}`));
  await page.goto(BASE.replace(/\/$/, "") + path);
  return page;
};

// done() closes the browser and exits 1 if any check failed.
export const done = async () => {
  await browser?.close();
  process.exit(failed ? 1 : 0);
};
   ```

6. Replace the whole content of `scripts/check-all.sh` with:

   ```sh
#!/bin/sh
# Runs every check (scripts/check-*.mjs) in Chromium and in WebKit (the engine the app ships with).
# Starts the preview (npm run preview, http://localhost:4173) if it is not already running, and stops it at the end.
# A script that crashes counts as failed, not as "0 FAIL lines".
# One engine only: PW_ENGINES=webkit sh scripts/check-all.sh
cd "$(dirname "$0")/.." || exit 1
url="${PREVIEW_URL:-http://localhost:4173/}"
started=""
if ! curl -s -o /dev/null "$url"; then
  npx vite --config vite.preview.config.ts >/tmp/openpier-preview.log 2>&1 &
  started=$!
  i=0
  until curl -s -o /dev/null "$url"; do
    i=$((i + 1))
    if [ "$i" -gt 60 ]; then echo "FAIL the preview did not start; see /tmp/openpier-preview.log"; kill "$started" 2>/dev/null; exit 1; fi
    sleep 1
  done
fi
trap '[ -n "$started" ] && kill "$started" 2>/dev/null' EXIT
bad=0
for engine in ${PW_ENGINES:-chromium webkit}; do
  echo "== $engine"
  for f in scripts/check-*.mjs; do
    out=$(PW_ENGINE=$engine node "$f" 2>&1); code=$?
    n=$(printf '%s\n' "$out" | grep -c '^FAIL')
    if [ "$code" -ne 0 ] && [ "$n" -eq 0 ]; then n=crashed; fi
    echo "$engine $f: $n"
    printf '%s\n' "$out" | grep -E '^FAIL|Error' | head -5
    [ "$n" = 0 ] || bad=1
  done
done
exit $bad
   ```

7. Point every check at the preview server. Run exactly:

   ```bash
   sed -i '' 's#file://${root}/preview/index.html#http://localhost:4173/#g' scripts/check-*.mjs
   grep -c "file://" scripts/check-*.mjs | grep -vc ":0$"     # expect: 0
   ```

8. Install the browsers the checks use (this downloads them into your user cache; it changes nothing else): `npx playwright install webkit chromium`.
9. See the preview with your own eyes once: `npm run preview`, open `http://localhost:4173/?scenario=running` in a browser. Expect the sidebar and a page titled Containers. Stop the server with Ctrl+C.
10. Write the test and the check under "Tests to write first" now. Run them. They must pass.
11. Run `npm run check 2>&1 | tee /tmp/openpier-check.txt`. It takes several minutes. Then:

    ```bash
    grep -E "^(chromium|webkit) scripts/" /tmp/openpier-check.txt | grep -v ": 0$"
    ```

    These are the checks that fail. Most of them fail: they test the look and the selectors of screens that lost their stylesheet, and those screens are rebuilt in iterations 2 and 3.
12. Apply this rule to each check script, by its file name:
    1. It is `check-entitlements.mjs`, `check-icon.mjs`, `check-version-sync.mjs` or `check-start.mjs`: it must pass in both engines. If it fails, stop and report.
    2. It passes in both engines: leave it where it is.
    3. It fails in either engine: move it to `scripts/checks-pending/` with `git mv`. Do not edit it.
13. Create `scripts/checks-pending/README.md` with this content, then delete from the table every row whose file you did not move:

    ```markdown
    # Checks waiting for their screen

    These browser checks failed when the preview was repaired (WO-0.3), because the screens they test lost their stylesheet. `npm run check` does not run them.

    Rules:

    1. The work order in the table brings its check back: move it to `scripts/`, make it use `scripts/lib/check.mjs`, the new routes and the new words, and make it pass in Chromium and WebKit.
    2. Every behaviour the old check proved must still be proved.
    3. This folder may only shrink. It must be empty when iteration 3 ends.

    | Check | Brought back by |
    |---|---|
    | `check-layout.mjs` | WO-2.2 |
    | `check-restyle.mjs` | WO-2.2 |
    | `check-home.mjs` | WO-3.1 |
    | `check-down.mjs` | WO-3.1 |
    | `check-menus.mjs` | WO-3.1 |
    | `check-select.mjs` | WO-3.1 |
    | `check-observe.mjs` | WO-3.2 |
    | `check-mounts.mjs` | WO-3.2 |
    | `check-compose.mjs` | WO-3.3 |
    | `check-guided.mjs` | WO-3.3 |
    | `check-pull.mjs` | WO-3.3 |
    | `check-disk.mjs` | WO-3.4 |
    | `check-volumes.mjs` | WO-3.5 |
    | `check-network.mjs` | WO-3.6 |
    | `check-netfix.mjs` | WO-3.8 (it tests a Doctor fix) |
    | `check-k8s.mjs` | WO-3.7 |
    | `check-doctor.mjs` | WO-3.8 |
    | `check-resize.mjs` | WO-3.9 |
    | `check-setup.mjs` | WO-3.10 |
    | `check-bring.mjs` | WO-3.11 |
    | `check-bring-home.mjs` | WO-3.11 |
    | `check-replace.mjs` | WO-3.11 |
    | `check-a11y.mjs` | WO-3.11 |
    ```

14. In the pull request, paste the list from step 11 and say for each script: stays, or moved.
15. Update `AGENTS.md`: replace `npm run preview && node scripts/readme-shots.mjs` with `node scripts/readme-shots.mjs`, and in "Test in the engine that ships" add the line `npm run preview         # the app in a browser with a fake backend, http://localhost:4173`.

**Tests to write first**

1. `src/lib/mockCoverage.test.ts` (runs with `node --test`, part of `npm test`):

   ```ts
   // Every backend command the UI calls must have a handler in the preview's fake backend.
   // Without this, a screen works in the app and crashes in the preview, and the browser checks stop meaning anything.
   import test from "node:test";
   import assert from "node:assert/strict";
   import fs from "node:fs";
   import path from "node:path";

   // Commands of the runtime adapters in src/runtime/, which the preview does not fake. WO-4.2 deletes those adapters
   // and this list with them. It may only shrink.
   const NOT_IN_PREVIEW = ["colima_version", "docker_desktop_version", "orb_delete_vm", "orb_list_vms", "orb_start_vm", "orb_stop_vm", "orb_version", "podman_version", "rdctl_version"];

   const root = path.resolve(import.meta.dirname, "../..");
   const walk = (dir: string): string[] =>
     fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

   const called = new Set<string>();
   for (const file of walk(path.join(root, "src")).filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."))) {
     for (const m of fs.readFileSync(file, "utf8").matchAll(/invoke(?:<[^>]*>)?\(\s*["'`]([a-z_]+)["'`]/g)) called.add(m[1]);
   }
   const mock = fs.readFileSync(path.join(root, "preview/mock.ts"), "utf8");
   const handled = new Set([...mock.matchAll(/case "([a-z_]+)"/g)].map((m) => m[1]));

   test("given the commands the UI invokes, when the mock is read, then it handles every one", () => {
     const missing = [...called].filter((c) => !handled.has(c) && !NOT_IN_PREVIEW.includes(c)).sort();
     assert.ok(called.size > 30, `expected to find the UI's commands, found ${called.size}`);
     assert.deepEqual(missing, [], `preview/mock.ts has no handler for: ${missing.join(", ")}`);
   });

   test("given the list of commands the preview does not fake, when read, then each is still called and still not handled", () => {
     const stale = NOT_IN_PREVIEW.filter((c) => !called.has(c) || handled.has(c));
     assert.deepEqual(stale, [], `remove from NOT_IN_PREVIEW: ${stale.join(", ")}`);
   });
   ```

   If it fails with a list of missing commands: for each, add a `case "<name>":` to the `switch (cmd)` in `invoke` in `preview/mock.ts` that returns data of the shape the Rust command returns (read the command in `src-tauri/src/`). If more than five are missing, stop and report.

2. `scripts/check-start.mjs`:

   ```js
   // The app opens on Containers, with no Projects item yet, and without page errors.
   import { open, check, done } from "./lib/check.mjs";
   const p = await open("/?scenario=running");
   await p.waitForSelector(".content");
   check((await p.locator("h1").first().innerText()) === "Containers", "start: the app opens on Containers");
   const nav = await p.locator(".sidebar nav button").allInnerTexts();
   check(!nav.some((t) => /Projects/.test(t)), "start: there is no Projects item in the sidebar yet");
   check(nav.some((t) => /Containers/.test(t)) && nav.some((t) => /Doctor/.test(t)), "start: the sidebar lists Containers and Doctor");
   await done();
   ```

**Done when**

```bash
npm run check; echo "exit $?"                        # expect: exit 0. Every line "<engine> scripts/check-...: 0"
ls scripts/check-*.mjs | wc -l                       # expect: at least 4
ls scripts/checks-pending/*.mjs 2>/dev/null | wc -l  # expect: the number of rows left in scripts/checks-pending/README.md
test ! -e scripts/build-preview.mjs && test ! -e playwright.config.ts && echo gone   # expect: gone
npm test 2>&1 | grep -E "^# (pass|fail)"             # expect: "# pass 588", "# fail 0"
```

Plus the gate. From this work order on, `npm run check` is part of the gate.

**Pull request title**: `wo-0.3: the preview opens in a browser and the checks run again`

---

## WO-0.5 The repo holds only what is needed

**Needs**: WO-0.3.

**Why**: E, P2. The root has screenshots, session notes of earlier tools and an old Homebrew folder. A new contributor cannot tell what matters.

**Read first**: nothing.

**Starting state**

```bash
git status --short                               # expect: no output
git ls-files | awk -F/ '{print $1}' | sort -u | tr '\n' ' '
# expect to see, among others: CONTEXT.md RESUME.md TODO.md app-icon.svg homebrew-colima-ui opencode.json private.key private.key.pub screenshot-env.png take-all.cjs test-results
```

**Do not touch**: `private.key` and `private.key.pub` (the owner removes them in WO-0.1; if they are already gone, good), `docs/plan/`, `docs/screenshots/`, `docs/research/`, `test-baselines/`.

**Steps**

1. Remove from git (the history keeps them):

   ```bash
   git rm -r --quiet screenshot-env.png screenshot-logs.png screenshot-ports.png screenshot-projects.png screenshot-terminal.png \
     take-all.cjs take-screenshots.cjs take-screenshots.js test-results opencode.json RESUME.md TODO.md CONTEXT.md homebrew-colima-ui \
     src/ui/components/Table.css
   ```

   If `git rm` says a path does not exist, remove that path from the command and run it again. Write which in the pull request.
2. Move three files:

   ```bash
   git mv docs/EVALUATION.md docs/research/evaluation-kit.md
   git mv docs/VERIFY-ON-YOUR-MAC.md docs/research/verify-on-your-mac.md
   git mv app-icon.svg src-tauri/icons/app-icon.svg
   ```

3. Remove the rest of `docs/` except the three folders kept:

   ```bash
   git rm -r --quiet docs/EXECUTION_PLAN.md docs/HIGHLIGHTS.md docs/ITERATION_LOG.md docs/RECOMMENDATIONS.md docs/SPEC.md docs/SUMMARY.md \
     docs/WORKING_METHOD.md docs/WORK_DOCUMENTATION.md docs/benchmark-integration-vs-refactor.md docs/superpowers docs/temporary
   ```

4. Search for references to what moved: `grep -rn "app-icon.svg\|EVALUATION.md\|VERIFY-ON-YOUR-MAC.md\|Table.css" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=target --exclude-dir=plan .` and update each path found to the new place. A reference to `Table.css` in a file under `src/`: delete that import line.
5. Replace the whole content of `.gitignore` with:

   ```
   node_modules/
   dist/
   src-tauri/target/
   src-tauri/gen/
   .DS_Store
   *.log
   preview/dist/
   test-results/
   playwright-report/
   artifacts/
   *.key
   *.key.pub
   .env*
   .superpowers/
   .claude/worktrees/
   .playwright-mcp/
   .freebuff/
   ```

**Tests to write first**: none.

**Done when**

```bash
git ls-files | awk -F/ '{print $1}' | sort -u | tr '\n' ' '
# expect exactly these names, in any order, and `private.key private.key.pub` only if WO-0.1 is not done yet:
# .github .gitignore AGENTS.md CHANGELOG.md CONTRIBUTING.md README.md docs eslint.config.js index.html package-lock.json package.json preview scripts src src-tauri test-baselines tsconfig.json vite.config.ts vite.preview.config.ts vitest.config.ts
git ls-files docs | awk -F/ '{print $2}' | sort -u | tr '\n' ' '   # expect: plan research screenshots
```

Plus the gate.

**Pull request title**: `wo-0.5: the repo root holds only what the project needs`

---

## WO-0.4 The app is called OpenPier everywhere

**Needs**: WO-0.5.

**Why**: P4. The repo uses four names: Wharf, Container UI, colima-ui, container-ui.

**Read first**: `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `scripts/install.sh`, `README.md`, `CONTRIBUTING.md`.

**Starting state**

```bash
git status --short     # expect: no output
git grep -niE "wharf|container ui|container-ui|colima-ui|colima_ui" -- . ':!docs' ':!CHANGELOG.md' | wc -l
# expect: a number above 20
```

**Do not touch**: the word "Colima" or "colima" where it names the Colima runtime (`colima start`, `~/.colima`, `ctxFor`, profile names, the Docker context `colima`). `CHANGELOG.md` entries of past versions (they are history). The value of `plugins.updater.pubkey`. The file `.github/workflows/release.yml` except the product name (iteration 7 replaces the file).

**Steps**

1. Names in config. Change exactly:

   | File | Find | Replace with |
   |---|---|---|
   | `package.json` | `"name": "colima-ui"` | `"name": "openpier"` |
   | `src-tauri/Cargo.toml` | `name = "wharf"` | `name = "openpier"` |
   | `src-tauri/tauri.conf.json` | `"productName": "Wharf"` | `"productName": "OpenPier"` |
   | `src-tauri/tauri.conf.json` | `"identifier": "dev.colima.wharf"` | `"identifier": "dev.openpier.desktop"` |
   | `src-tauri/tauri.conf.json` | `"title": "Wharf"` | `"title": "OpenPier"` |
   | `src-tauri/tauri.conf.json` | `BitVerseNomad/container-ui` | `BitVerseNomad/openpier` |
   | `index.html` | `<title>Wharf</title>` | `<title>OpenPier</title>` |
   | `src-tauri/src/main.rs` | `"error while running Wharf"` | `"error while running OpenPier"` |

   Then run `npm install --package-lock-only` and `(cd src-tauri && cargo build)` so the two lock files take the new name.
2. Words a user reads. In `README.md`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/feedback.md`, `.github/workflows/release.yml`, `scripts/install.sh`, `src/App.tsx`: replace `Wharf` with `OpenPier` and `Container UI` with `OpenPier`. In `CONTRIBUTING.md` replace `cd colima-ui` with `cd openpier`. In `scripts/install.sh` replace `colima-ui.dmg` with `openpier.dmg`. In `release.yml` replace `Container%20UI_` with `OpenPier_`.
3. Temporary file names in Rust. In `src-tauri/src/main.rs`, `desktop.rs` and `setup.rs`, inside `format!("colima-ui-...")` strings, replace the prefix `colima-ui-` with `openpier-`. There are eight (`main.rs` 3, `desktop.rs` 4, `setup.rs` 1). Then run `cargo fmt` (the shorter name lets rustfmt join a line).
4. The Testcontainers marker. In `src-tauri/src/setup.rs` change `const TC_MARK: &str = "# Added by Wharf (Testcontainers)";` to `"# Added by OpenPier (Testcontainers)"`, and the same text in the test that asserts on it. The marker is only written, never searched for, so nothing else changes.
5. One place for the repo address. Create `src/lib/links.ts`:

   ```ts
   // The project's home. Every link to the repo is built from this.
   export const REPO_URL = "https://github.com/BitVerseNomad/openpier";
   ```

   In `src/Shell.tsx` add `import { REPO_URL } from "./lib/links";` and replace `"https://github.com/BitVerseNomad/container-ui/discussions"` with `` `${REPO_URL}/discussions` ``.
6. Storage keys. Replace these string constants (one per line, the file, the old value, the new value):

   | File | Old | New |
   |---|---|---|
   | `src/Shell.tsx` | `"wharf:sidebar-folded"` | `"openpier:sidebar-folded"` |
   | `src/useComposeScan.ts` | `"colima-ui:compose-folders"` | `"openpier:compose-folders"` |
   | `src/useComposeScan.test.tsx` | `"colima-ui:compose-folders"` | `"openpier:compose-folders"` |
   | `src/Setup.tsx` | `"colima-ui.broughtOver"` | `"openpier:broughtOver"` |
   | `src/Resize.tsx` | `"colima-ui.wayBack"` | `"openpier:wayBack"` |
   | `src/VmChange.test.tsx` | `"colima-ui.wayBack"` (4 times) | `"openpier:wayBack"` |
   | `src/lib/activity.ts` | `"colima-ui:learn"` | `"openpier:learn"` |
   | `src/lib/folderMemory.ts` | `` `colima-ui:writable:${folder}` `` | `` `openpier:writable:${folder}` `` |
   | `preview/mock.ts` | `"colima-ui.broughtOver"` | `"openpier:broughtOver"` |
   | every file under `scripts/` (also `scripts/checks-pending/`) | `colima-ui.wayBack`, `colima-ui:compose-folders` | `openpier:wayBack`, `openpier:compose-folders` |

7. Keep what people already saved. Write the test under "Tests to write first", see it fail, then create `src/lib/migrateStorage.ts`:

   ```ts
   // Before the rename the app saved its settings under three prefixes. Copy them once to "openpier:".
   // The old keys are kept, so going back to an older build loses nothing.
   const OLD_PREFIXES = ["colima-ui:", "colima-ui.", "wharf:"]; // old names, kept on purpose: this is the migration
   const DONE = "openpier:migrated";

   export function migrateStorage(store: Storage): number {
     let moved = 0;
     try {
       if (store.getItem(DONE) === "1") return 0;
       const keys = Array.from({ length: store.length }, (_, i) => store.key(i)).filter((k): k is string => k !== null);
       for (const key of keys) {
         const prefix = OLD_PREFIXES.find((p) => key.startsWith(p));
         if (!prefix) continue;
         const next = "openpier:" + key.slice(prefix.length);
         if (store.getItem(next) === null) { store.setItem(next, store.getItem(key) ?? ""); moved++; }
       }
       store.setItem(DONE, "1");
     } catch {
       /* storage can be blocked; the app then starts with defaults */
     }
     return moved;
   }
   ```

   In `src/main.tsx` add `import { migrateStorage } from "./lib/migrateStorage";` and, on the line before `ReactDOM.createRoot(`, add `migrateStorage(window.localStorage);`.
8. `CHANGELOG.md`: add a section `## Unreleased` after the intro paragraph that starts "Newest first" and before the first existing `## ` heading, with these two lines:

   ```markdown
   1. The app is now called OpenPier. Your saved settings are kept.
   2. macOS sees OpenPier as a new app (its identifier changed to `dev.openpier.desktop`). Remove the old app from Applications by hand.
   ```

**Tests to write first**

`src/lib/migrateStorage.test.ts` (node test). It needs a small in-memory `Storage`; define it in the test file:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { migrateStorage } from "./migrateStorage.ts";

const memory = (init: Record<string, string>): Storage => {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  } as Storage;
};

test("given keys under the three old prefixes, when migrating, then each is copied to openpier: and the old ones stay", () => {
  const s = memory({ "colima-ui:learn": "a", "colima-ui.wayBack": "b", "wharf:sidebar-folded": "1", other: "x" });
  assert.equal(migrateStorage(s), 3);
  assert.equal(s.getItem("openpier:learn"), "a");
  assert.equal(s.getItem("openpier:wayBack"), "b");
  assert.equal(s.getItem("openpier:sidebar-folded"), "1");
  assert.equal(s.getItem("colima-ui:learn"), "a");
  assert.equal(s.getItem("other"), "x");
});

test("given a value already saved under the new key, when migrating, then it is not overwritten", () => {
  const s = memory({ "wharf:sidebar-folded": "1", "openpier:sidebar-folded": "0" });
  migrateStorage(s);
  assert.equal(s.getItem("openpier:sidebar-folded"), "0");
});

test("given a migration that already ran, when migrating again, then nothing is copied", () => {
  const s = memory({ "colima-ui:learn": "a" });
  migrateStorage(s);
  s.setItem("colima-ui:learn", "changed");
  s.removeItem("openpier:learn");
  assert.equal(migrateStorage(s), 0);
  assert.equal(s.getItem("openpier:learn"), null);
});

test("given storage that throws, when migrating, then it returns 0 and does not throw", () => {
  const s = { get length(): number { throw new Error("blocked"); } } as unknown as Storage;
  assert.equal(migrateStorage(s), 0);
});
```

**Done when**

```bash
git grep -niE "wharf|container ui|container-ui|colima-ui|colima_ui" -- . ':!docs' ':!CHANGELOG.md'
# expect: lines only in src/lib/migrateStorage.ts (the OLD_PREFIXES line with its comment) and src/lib/migrateStorage.test.ts.
# One more line is expected and stays: scripts/eval-setup.sh ("compare container UIs" describes other tools, it is not the product name).
# In scripts/install.sh rename the two variables COLIMA_UI_DMG and COLIMA_UI_REPO to OPENPIER_DMG and OPENPIER_REPO (the app was never released, so nobody has them set).
# Any other line: replace it by the rules of steps 1 to 6 and run the grep again.
grep -c '"identifier": "dev.openpier.desktop"' src-tauri/tauri.conf.json   # expect: 1
npm test 2>&1 | grep -E "^# (pass|fail)"     # expect: "# pass 592", "# fail 0"
```

Plus the gate.

**Pull request title**: `wo-0.4: the app is called OpenPier everywhere and keeps your settings`

---

## WO-0.6 Every pull request is checked

**Needs**: WO-0.4.

**Why**: E13. There is no check on pull requests today.

**Read first**: `../06-open-source-launch.md` section 3.

**Starting state**

```bash
ls .github/workflows      # expect: release.yml
```

**Do not touch**: `.github/workflows/release.yml`.

**Steps**

1. Create `.github/workflows/ci.yml` with the YAML in `../06-open-source-launch.md` section 3, copied exactly, including the line `- run: npm run check`.
2. Check that it is valid YAML: `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/ci.yml"); puts "valid"'`. Expect `valid`.
3. If `actionlint` is installed (`command -v actionlint`), run `actionlint .github/workflows/ci.yml` and expect no output. If it is not installed, do not install it; write "actionlint not run" in the pull request.

Not verified: this workflow has never run. You cannot run it (you do not push). Say so in the pull request under "Not done". The owner pushes, watches the first run and reports back.

**Tests to write first**: none.

**Done when**

```bash
ruby -e 'require "yaml"; y = YAML.load_file(".github/workflows/ci.yml"); puts y["jobs"].keys.sort.join(",")'   # expect: rust,web
grep -c "npm run check" .github/workflows/ci.yml    # expect: 1
```

Plus the gate.

**Pull request title**: `wo-0.6: a workflow checks every pull request (not yet run)`

---

## WO-1.1 One stylesheet

**Needs**: WO-0.6.

**Why**: E6, E10, U1. The app's stylesheet was deleted in the last commit, and what is left is spread over four CSS files and Tailwind. From here the app ships the design's stylesheet, unchanged.

**Read first**: `docs/plan/design/openpier.css` (all of it; it is the design), `src/main.tsx`, `vite.config.ts`.

**Starting state**

```bash
git status --short                         # expect: no output
grep -rn '^import .*\.css' src | grep -v test
# expect exactly: src/main.tsx (./ui/tokens.css and ./styles.css), src/Shell.tsx (./Shell.css), src/Containers.tsx (./home.css)
```

**Do not touch**: `docs/plan/design/openpier.css`. The components and screens: they keep their old class names for now and will look unstyled. Do not try to make them look right.

**Steps**

1. `cp docs/plan/design/openpier.css src/ui/openpier.css`
2. In `src/main.tsx` replace the two lines `import "./ui/tokens.css";` and `import "./styles.css";` with the one line `import "./ui/openpier.css";`.
3. In `src/Shell.tsx` delete the line `import "./Shell.css";`. In `src/Containers.tsx` delete the line `import "./home.css";`.
4. Delete `src/styles.css`, `src/home.css`, `src/Shell.css`, `src/ui/tokens.css`.
5. `npm uninstall tailwindcss @tailwindcss/vite @fontsource/inter @fontsource/jetbrains-mono`. Leave `tailwind-merge`, `class-variance-authority` and `clsx`: old component files still import them, and WO-5.1 removes them.
6. In `vite.config.ts` delete the line `import tailwindcss from "@tailwindcss/vite";` and change `plugins: [react(), tailwindcss()],` to `plugins: [react()],`.
7. Create `scripts/check-design-sync.mjs`:

   ```js
// The app ships the design stylesheet unchanged. This fails when the two copies differ.
// Change docs/plan/design/openpier.css first, then copy it over src/ui/openpier.css.
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const design = fs.readFileSync(path.join(root, "docs/plan/design/openpier.css"), "utf8");
const shipped = fs.readFileSync(path.join(root, "src/ui/openpier.css"), "utf8");
const same = design === shipped;
console.log(same ? "ok" : "FAIL", "design sync: src/ui/openpier.css equals docs/plan/design/openpier.css");
process.exit(same ? 0 : 1);
   ```

8. Run `npm run check`. A check that passed before this work order and fails now is failing because the look changed: move it to `scripts/checks-pending/` with `git mv`, add its row to `scripts/checks-pending/README.md` with the work order from the table in WO-0.3 step 13, and list it in the pull request. `check-start.mjs`, `check-design-sync.mjs`, `check-entitlements.mjs`, `check-icon.mjs` and `check-version-sync.mjs` must pass; if one does not, stop and report.
9. In the pull request, say in the first line of "What changed": "The app looks worse after this change. Screens lose their old styling until iterations 2 and 3 rebuild them. This is planned."

**Tests to write first**: none (the check in step 7 is the test).

**Done when**

```bash
grep -rn 'import .*\.css' src | grep -v test     # expect exactly one line: src/main.tsx:... import "./ui/openpier.css";
find src -name "*.css"                           # expect exactly: src/ui/openpier.css
grep -c "tailwindcss\|fontsource" package.json   # expect: 0
node scripts/check-design-sync.mjs               # expect: "ok design sync: ..."
npm run build; echo "exit $?"                    # expect: exit 0
```

Plus the gate.

**Pull request title**: `wo-1.1: the app ships the design's stylesheet and nothing else`

---

## WO-1.2 The colours are readable, and a check proves it

**Needs**: WO-1.1.

**Why**: the token values were chosen by eye. Measured on `0bdafcf` they all pass (the lowest text pair is 5.20:1, the lowest state pair 4.35:1). The check keeps it that way.

**Read first**: `docs/plan/design/openpier.css` section 1 (tokens).

**Starting state**: `test -f src/ui/openpier.css && echo ok` prints `ok`.

**Do not touch**: any token value. If the check fails, stop and report; do not change a colour.

**Steps**

1. Create `scripts/check-contrast.mjs`:

   ```js
// WCAG contrast of the design tokens, light and dark. Text needs 4.5:1, state colours (icons, dots) need 3:1.
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const css = fs.readFileSync(path.join(root, "docs/plan/design/openpier.css"), "utf8");

const block = (selector) => {
  const at = css.indexOf(selector + " {");
  if (at < 0) throw new Error(`contrast: no block "${selector}" in openpier.css`);
  return css.slice(at, css.indexOf("\n}", at));
};
const tokens = (text) => Object.fromEntries([...text.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));
const light = tokens(block(":root"));
const dark = { ...light, ...tokens(block(':root[data-theme="dark"]')) };

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

const TEXT = ["--fg", "--fg-muted", "--accent-ink"];
const STATE = ["--ok", "--warn", "--bad", "--info"];
const SURFACES = ["--bg", "--bg-sidebar", "--bg-raised"];
let failed = 0;
for (const [theme, t] of [["light", light], ["dark", dark]]) {
  for (const name of [...TEXT, ...STATE, "--on-accent"]) {
    const need = TEXT.includes(name) || name === "--on-accent" ? 4.5 : 3;
    const surfaces = name === "--on-accent" ? ["--accent"] : SURFACES;
    for (const s of surfaces) {
      if (!t[name] || !t[s]) { console.log("FAIL", `contrast: ${theme} token ${!t[name] ? name : s} is missing or not a #rrggbb colour`); failed++; continue; }
      const r = ratio(t[name], t[s]);
      const ok = r >= need;
      console.log(ok ? "ok" : "FAIL", `contrast: ${theme} ${name} on ${s} is ${r.toFixed(2)}:1 (needs ${need}:1)`);
      if (!ok) failed++;
    }
  }
}
process.exit(failed ? 1 : 0);
   ```

2. Run `node scripts/check-contrast.mjs`. Expect 44 lines starting with `ok` and exit 0.

**Tests to write first**: none (the script is the test).

**Done when**

```bash
node scripts/check-contrast.mjs | grep -c "^ok"      # expect: 44
node scripts/check-contrast.mjs | grep -c "^FAIL"    # expect: 0
```

Plus the gate (`npm run check` now runs this script too, because its name starts with `check-`).

**Pull request title**: `wo-1.2: a check proves every text and state colour is readable`

---

## WO-1.3a Components: the small pieces

**Needs**: WO-1.2.

**Why**: E10, U14, U15, U16. Today there are three overlapping component sets. The new set is one file per component, and each renders classes from `openpier.css` only.

**Read first**: `../04-design-spec.md` sections 6.1 to 6.4, 6.9, 6.10, 6.11; `src/ui/openpier.css` sections 5, 6, 8, 10; the mockup pictures `containers-light.png`, `empty-state-light.png`, `loading-error-toast-light.png`, `images-light.png` in `docs/plan/design/shots/`.

**Starting state**

```bash
ls src/ui/*.tsx | wc -l         # expect: 20 or more (the old components)
test -d src/ui/components && echo old-set-present     # expect: old-set-present
```

**Do not touch**: any existing file in `src/ui/` or `src/ui.tsx`. The old components stay until their last user is rebuilt (WO-5.1). You add new files next to them in a new folder, `src/ui/op/`, so no name collides. `src/ui/index.ts` is not changed in this work order.

**Rules for every component in WO-1.3a and WO-1.3b**

1. One file per component in `src/ui/op/`, named as the component (`Button.tsx`). One test file next to it (`Button.test.tsx`).
2. A component renders class names from `src/ui/openpier.css` and nothing else. No `style=` except where this work order names it. No colour, no pixel value.
3. Every component takes `className?: string` (appended to its own classes with `clsx`) and passes unknown props to its root element (`...rest`), so `aria-*` and `data-*` reach the DOM.
4. Icons come from `<Icon name>` only. No new file imports `lucide-react` except `src/ui/op/Icon.tsx` (the old files in `src/ui/` that import it today stay as they are).
5. Radix parts are used where the spec says so. The packages are already installed. Install the two that are missing: `npm install @radix-ui/react-alert-dialog @radix-ui/react-switch`.
6. Words on screen are props. A component has no English text of its own except accessible names listed here.
7. Tests use `@testing-library/react` and `@testing-library/user-event`, as `src/Containers.test.tsx` does. Each test name is "given ..., when ..., then ...".

**Steps**: create these files, in this order. Write each test file before its component.

1. `src/ui/op/Icon.tsx`

   ```ts
   export type IconName =
     | "search" | "plus" | "more" | "chev-down" | "chev-right" | "close" | "copy" | "check" | "error" | "alert" | "info"
     | "download" | "play" | "stop" | "restart" | "trash" | "external" | "folder" | "box" | "image" | "database" | "network"
     | "cluster" | "doctor" | "settings" | "sidebar" | "terminal" | "logs" | "refresh" | "command"
     | "back" | "activity" | "help" | "updown" | "chev-up";
   export function Icon(props: { name: IconName; size?: "sm" | "md"; className?: string }): JSX.Element;
   ```

   Renders the lucide icon for the name as `<svg class="icon">` (add `sm` for size `sm`), with `aria-hidden="true"`. Map: search `Search`, plus `Plus`, more `Ellipsis`, chev-down `ChevronDown`, chev-right `ChevronRight`, close `X`, copy `Copy`, check `Check`, error `CircleAlert`, alert `TriangleAlert`, info `Info`, download `Download`, play `Play`, stop `Square`, restart `RotateCw`, trash `Trash2`, external `ExternalLink`, folder `Folder`, box `Box`, image `Image`, database `Database`, network `Network`, cluster `Hexagon`, doctor `Activity`, settings `SlidersHorizontal`, sidebar `PanelLeft`, terminal `Terminal`, logs `ScrollText`, refresh `RefreshCw`, command `Command`, back `ChevronLeft`, activity `SquareTerminal`, help `CircleHelp`, updown `ChevronsUpDown`, chev-up `ChevronUp`. (These follow the drawings in `docs/plan/design/mockup.html`: Doctor is a pulse line, Activity is a terminal window, Settings is two sliders, Images is a picture.) Before writing, check each name exists: `node -e 'const l=require("lucide-react"); for (const n of process.argv.slice(1)) if(!l[n]) console.log("missing", n)' Search Plus Ellipsis ...`. If one is missing, stop and report; do not pick another icon. Move `lucide-react` from `devDependencies` to `dependencies` (`npm install lucide-react`).
   Tests: given a name, when rendered, then there is one `svg` with class `icon` and `aria-hidden="true"`; given size `sm`, then the class list has `sm`.

2. `src/ui/op/Button.tsx`

   ```ts
   export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
     variant?: "default" | "primary" | "danger" | "ghost";   // default "default"
     size?: "xs" | "sm" | "md";                               // default "sm"
     icon?: IconName;        // shown before the label
     iconOnly?: boolean;     // needs aria-label
     busy?: boolean;
   };
   export const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;
   ```

   Root: `<button type="button" class="btn [primary|danger|ghost] [xs|md] [icon-only]">`. `busy` sets `aria-busy="true"`, shows `<span class="spinner">` in place of the icon and ignores clicks. `disabled` sets the attribute. In development, `iconOnly` without `aria-label` logs `console.error("Button: iconOnly needs aria-label")`.
   Tests: given no props, then class is exactly `btn` and `type` is `button`; given `variant="primary" size="md"`, then classes `btn primary md`; given `busy`, when clicked, then `onClick` is not called and `aria-busy` is `true`; given `aria-label` and `data-x`, then both are on the button; given a ref, then it points at the button.

3. `src/ui/op/Field.tsx`

   ```ts
   export type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
     size?: "sm" | "md";       // default "sm"
     icon?: IconName;
     invalid?: string;         // the message; when set the field is invalid
     onClear?: () => void;     // when set, Escape in the input calls it
     width?: "search" | "filter" | "port" | "num";   // a fixed width from openpier.css 11.3; none = fills its parent
   };
   export const Field: React.ForwardRefExoticComponent<FieldProps & React.RefAttributes<HTMLInputElement>>;
   export function FormRow(props: { label: string; hint?: string; htmlFor: string; children: React.ReactNode }): JSX.Element;
   export function Fields(props: { children: React.ReactNode }): JSX.Element;   // <div class="fields">: fields side by side, with words between them as <span class="muted nowrap">
   ```

   `Field` root: `<label class="field [md] [search|filter|port|num]">` holding the optional `<Icon>` and the `<input>`. When `invalid` is set: `aria-invalid="true"` on the label and the input, and a `<span class="hint" id="{inputId}-error">` after the label with the message, linked by `aria-describedby`. The `id` comes from the `id` prop or `useId()`. `FormRow`: `<div class="form-row"><label class="label" for>{label}</label>{children}{hint && <div class="hint">}</div>`.
   Tests: given `invalid="Port 8080 is in use"`, then the input has `aria-invalid="true"` and is described by an element with that text; given `onClear`, when Escape is pressed in the input, then `onClear` is called; given `size="md"`, then the label has classes `field md`.

4. `src/ui/op/Select.tsx`

   ```ts
   export type SelectOption = { value: string; label: string; hint?: string };
   export function Select(props: { value: string; onChange: (value: string) => void; options: SelectOption[]; "aria-label": string; size?: "sm" | "md"; width?: "pick" | "num"; disabled?: boolean; className?: string }): JSX.Element;
   ```

   Radix Select (`@radix-ui/react-select`). Trigger: `<button class="field [md] [pick|num]">` with the selected label and `<Icon name="chev-down" size="sm">`. Content: `class="pop"`, each item `class="menu-item"` with the label and, when present, `<span class="why">{hint}</span>`.
   Tests: given three options, when the trigger gets focus and Enter then ArrowDown then Enter are pressed, then `onChange` is called with the second option's value; then the trigger has the `aria-label`.

5. `src/ui/op/Switch.tsx`

   ```ts
   export function Switch(props: { checked: boolean; onChange: (checked: boolean) => void; "aria-labelledby": string; disabled?: boolean; className?: string }): JSX.Element;
   ```

   Radix Switch root rendered as `<button role="switch" class="switch" aria-checked>`.
   Tests: given unchecked, when Space is pressed, then `onChange(true)`; then `role` is `switch` and `aria-checked` is `false`.

6. `src/ui/op/Chip.tsx`

   ```ts
   export function Chip(props: React.HTMLAttributes<HTMLSpanElement>): JSX.Element;                      // <span class="chip">
   export function ChipButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean; icon?: IconName }): JSX.Element;   // <button type="button" class="chip">. aria-pressed only when `pressed` is given. `icon` is a small icon before the label (a folded section uses icon "chev-right" and aria-expanded)
   ```

   Tests: given `pressed`, then `aria-pressed="true"`; given no `pressed`, then there is no `aria-pressed` attribute; `Chip` renders a `span` with class `chip`.

7. `src/ui/op/Tabs.tsx`

   ```ts
   export type TabItem = { value: string; label: string };
   export function Tabs(props: { value: string; onChange: (value: string) => void; items: TabItem[]; "aria-label": string; aside?: React.ReactNode; children: React.ReactNode; className?: string }): JSX.Element;
   export function TabPanel(props: { value: string; children: React.ReactNode }): JSX.Element;
   ```

   Radix Tabs. List: `class="tabs"`. Each trigger: `class="chip"` (Radix sets `aria-selected`). When `aside` is set, the list ends with `<span class="grow"></span>` and then `aside` (controls that belong to the selected tab, on the right of the tabs row; they are not tabs and arrow keys skip them). `TabPanel` is Radix `Tabs.Content`.
   Tests: given two tabs, when ArrowRight is pressed on the first, then `onChange` is called with the second value; the selected trigger has `aria-selected="true"`.

8. `src/ui/op/Dot.tsx` and `src/ui/op/Sev.tsx`

   ```ts
   export type DotState = "ok" | "warn" | "bad" | "busy" | "off";
   export function Dot(props: { state: DotState; label?: string; className?: string }): JSX.Element;   // <span class="dot [ok|warn|bad|busy]">; "off" adds no class. label -> role="img" aria-label, else aria-hidden="true"
   export type SevLevel = "bad" | "warn" | "info" | "ok";
   export function Sev(props: { level: SevLevel; className?: string }): JSX.Element;   // <Icon> with classes "sev {level}"; bad -> error, warn -> alert, info -> info, ok -> check
   ```

   Tests: `Dot state="off"` has class exactly `dot`; with `label` it has `role="img"` and the label; `Sev level="bad"` has classes `sev bad`.

9. `src/ui/op/Tooltip.tsx`

   ```ts
   export function Tooltip(props: { text: string; shortcut?: string; children: React.ReactElement }): JSX.Element;
   ```

   Radix Tooltip with `delayDuration={500}`; content `class="tooltip"`: the text, then `<span class="kbd">{shortcut}</span>` when set. Export also `TooltipProvider` (Radix's, re-exported).
   Tests: given a button inside, when it gets focus, then an element with role `tooltip` and the text appears.

10. `src/ui/op/Banner.tsx`

    ```ts
    export function Banner(props: { tone: "bad" | "warn" | "info"; title?: string; children?: React.ReactNode; actions?: React.ReactNode; className?: string }): JSX.Element;
    ```

    With a title: `<div class="banner {tone}" role={tone === "bad" ? "alert" : "status"}>`: `<Sev level={tone}>`, then a `<div>` with `<div class="title">{title}</div>` and `<div class="body selectable">{children}</div>`, then `<div class="actions">{actions}</div>` when set. Without a title (one sentence and its action): the root also has class `line`, the `Sev` icon is size `sm`, and `<div class="body selectable">{children}</div>` is a direct child of the root (no wrapper, no `.title`).
    Tests: tone `bad` has `role="alert"`; tone `info` has `role="status"`; the title and the actions render; given no title, then the root has class `line` and there is no `.title`.

11. `src/ui/op/Empty.tsx`

    ```ts
    export function Empty(props: { icon: IconName; title: string; children?: React.ReactNode; actions?: React.ReactNode; className?: string }): JSX.Element;
    ```

    `<div class="empty">`: `<Icon name={icon}>`, `<div class="title">{title}</div>`, `<div class="text">{children}</div>`, `<div class="actions">{actions}</div>` when set.
    Tests: the title, the text and a button passed in `actions` render inside `.empty`.

12. `src/ui/op/SkeletonRows.tsx`

    ```ts
    export function SkeletonRows(props: { rows?: number }): JSX.Element;   // default 4
    ```

    `<div aria-busy="true" aria-label="Loading">` with `rows` times `<div class="row"><span class="lead"></span><span class="skeleton {w}"></span><span class="grow"></span><span class="skeleton short"></span></div>`, where `{w}` cycles through `a`, `b`, `c`, `d` (the four widths in `openpier.css` 11.4).
    Tests: default renders 4 rows, each with 2 elements with class `skeleton`; the root has `aria-busy="true"`.

13. `src/ui/op/Canvas.tsx` and `src/ui/op/Command.tsx`

    ```ts
    export type CanvasLine = { text: string; time?: string; service?: string; level?: "w" | "e" };
    export const Canvas: React.ForwardRefExoticComponent<{ lines?: CanvasLine[]; children?: React.ReactNode; "aria-label": string; fill?: boolean; wrap?: boolean; onScroll?: React.UIEventHandler<HTMLPreElement>; className?: string } & React.RefAttributes<HTMLPreElement>>;
    export function Command(props: { text: string; onCopied?: () => void; className?: string }): JSX.Element;
    ```

    `Canvas`: `<pre class="canvas selectable [fill] [wrap]" tabindex="0">` (`fill` makes it take the rest of a `.stack` and scroll inside itself; `wrap` wraps long lines); the ref and `onScroll` go to the `pre`; each line a `<div class="ln {level}">` with `<span class="t">{time}</span>` when set, `<span class="svc">{service}</span>` when set, then the text. Without `lines` it renders `children`. `Command`: `<div class="cmd"><code class="selectable">{text}</code><Button variant="ghost" size="xs" iconOnly icon="copy" aria-label="Copy the command" /></div>`; the button calls `navigator.clipboard.writeText(text)` then `onCopied`.
    Tests: a line with `level: "e"` has class `e`; when the copy button is clicked, `navigator.clipboard.writeText` (mock it) is called with the text.

14. `src/ui/op/Tile.tsx`, `src/ui/op/Facts.tsx`, `src/ui/op/GroupCaption.tsx`

    ```ts
    export function Tiles(props: { children: React.ReactNode }): JSX.Element;                                  // <div class="tiles">
    export function Tile(props: { label: string; value: string; children?: React.ReactNode }): JSX.Element;   // <div class="tile"><span class="k">{label}</span><span class="v">{value}</span><div class="foot">{children}</div></div>
    export function Facts(props: { items: { label: string; value: React.ReactNode }[] }): JSX.Element;        // <div class="facts"> with, per item, <span class="selectable"><span class="sr-only">{label}: </span>{value}</span>. The label is for screen readers; the picture shows only the values, with a dot between them (the stylesheet draws the dot)
    export function GroupCaption(props: { children: React.ReactNode; count?: number }): JSX.Element;         // <div class="group-cap">{children}{count !== undefined && <span class="count"> · {count}</span>}</div>
    ```

    Tests: one per component: it renders its class and its text.

15. `src/ui/op/NavItem.tsx`, `src/ui/op/Checkbox.tsx`, `src/ui/op/Progress.tsx`

    ```ts
    export function NavItem(props: { href: string; icon?: IconName; label: string; current?: boolean; count?: number; countBad?: boolean; countLabel?: string }): JSX.Element;
    export function Checkbox(props: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; children: React.ReactNode }): JSX.Element;
    export function Progress(props: { value: number | null; max?: number; "aria-label": string }): JSX.Element;   // max default 1
    ```

    `NavItem`: `<a class="nav-item" href aria-current={current ? "page" : undefined}>` with the optional `<Icon>`, `<span>{label}</span>`, and when `count` is set `<span class="count [bad]" aria-label={countLabel}>{count}</span>`. `Checkbox`: `<label class="checkline"><input type="checkbox" class="check" />{children}</label>`. `Progress`: `<progress class="progress" value max>`; with `value` null it has no `value` attribute (it then shows as busy).
    Tests: `NavItem current` has `aria-current="page"` and without it the attribute is absent; a `count` with `countBad` has classes `count bad`; `Checkbox`, when its text is clicked, calls `onChange(true)`; `Progress value={0.5}` has `value="0.5"` and `Progress value={null}` has no `value` attribute.

16. `src/ui/op/index.ts`: export everything above by name (`export * from "./Button";` and so on, one line per file).

**Done when**

```bash
ls src/ui/op/*.tsx | grep -vc test      # expect: 21
ls src/ui/op/*.test.tsx | wc -l         # expect: at least 17
npm test 2>&1 | grep -E "Test Files|Tests "   # expect: 0 failed, and at least 22 test files
grep -rn "lucide-react" src --include="*.tsx" --include="*.ts" -l | grep -vE "^src/ui/(icons\.tsx|components/)"   # expect exactly: src/ui/op/Icon.tsx (the old set in src/ui/components keeps its own imports until WO-5.1)
grep -rnE "style=|#[0-9a-fA-F]{3,6}\b|[0-9]px" src/ui/op --include="*.tsx" | grep -v test; echo "exit $?"   # expect: no lines, exit 1
```

Plus the gate.

**Pull request title**: `wo-1.3a: the small components exist and are tested`

---

## WO-1.3b Components: rows, menus, sheets, dialogs

**Needs**: WO-1.3a.

**Why**: same as WO-1.3a. These are the pieces every screen is made of.

**Read first**: `../04-design-spec.md` sections 6.5 to 6.8, 6.10, 6.13 to 6.16; `src/ui/openpier.css` sections 7, 8, 12; the mockup pictures `containers-light.png`, `containers-row-menu-light.png`, `run-sheet-light.png`, `confirm-dialog-light.png`, `problem-inspector-light.png`; `docs/plan/design/mockup.html` (search for `const crow`, `const prob`, `const blocks`, `const meters`, `const spark` to see the exact markup of each piece).

**Starting state**: `test -f src/ui/op/Button.tsx && echo ok` prints `ok`.

**Do not touch**: the same as WO-1.3a. The rules of WO-1.3a apply.

**Steps**: create these files in `src/ui/op/`, test first, and add each to `src/ui/op/index.ts`. Do step 11 (`Portal.tsx`) first: `Sheet`, `ConfirmDialog` and `Toast` import it. Then steps 1 to 10 in order.

1. `Row.tsx`

   ```ts
   export function List(props: { "aria-label": string; children: React.ReactNode }): JSX.Element;   // <div class="list" role="table">
   export function RowHead(props: { children: React.ReactNode }): JSX.Element;                       // <div class="row th" role="row">
   export type RowProps = {
     lead: React.ReactNode;            // a <Dot>, an <Icon>, a chevron button for a group, or a number (a step number: the cell is then `lead num`)
     dot?: React.ReactNode;            // a group row only: the <Dot> drawn after the chevron
     name: React.ReactNode;            // text, or text with a <Dim> part
     nameClass?: string;               // extra classes for the name cell, from openpier.css 11.2: "plain", "mono", "long", "fixed"
     title?: string;                   // the native tooltip of the row (the full name when it is cut)
     meta?: React.ReactNode;
     metaSelectable?: boolean;         // the meta text can be selected and copied
     tall?: boolean;                   // two lines: name over meta, the action at the right (Doctor, Setup)
     children?: React.ReactNode;       // the fixed columns, each a <Col>
     action?: React.ReactNode;         // one <Button>, or nothing
     menu?: React.ReactNode;           // the row's <Menu>
     child?: boolean;                  // indented inside a group
     onOpen?: () => void;              // click or Enter on the row
     selected?: boolean; onSelect?: (selected: boolean) => void;   // Space toggles
     expanded?: boolean; onToggle?: () => void;                    // a group row: ArrowLeft folds, ArrowRight unfolds
   };
   export function Row(props: RowProps): JSX.Element;
   export type ColKind = "ports" | "stats" | "state" | "state-wide" | "state-words" | "size" | "age" | "age-short" | "id" | "subnet" | "ready" | "restarts" | "inside" | "mac" | "cpu";
   export function Col(props: { kind?: ColKind; mono?: boolean; children?: React.ReactNode }): JSX.Element;   // <span class="col {classes} [mono]">
   export function Dim(props: { children: React.ReactNode }): JSX.Element;     // <span class="dim">: the muted part of a name (":16", "no name")
   export function Members(props: { children: React.ReactNode }): JSX.Element; // <span class="members grow">: a row of <Chip>, in place of the meta
   ```

   `Col` classes per kind: `state-wide` gives `state wide`, `state-words` gives `state words`, `age-short` gives `age short`; every other kind is its own class. The widths are in `openpier.css` sections 7 and 11.2. `RowHead` takes one more prop, `menuGap?: boolean`: when true it ends with `<span class="more-gap"></span>` (the head cell over the ⋯ buttons).

   `Row` markup, in this order: `<div class="row [child]" role="row" tabindex="0" aria-selected>`: `<span class="lead">{lead}</span>`, `{dot}`, `<span class="name truncate {nameClass}">{name}</span>`, `<span class="meta truncate grow [selectable]">{meta}</span>`, `{children}`, `<span class="act">{action}</span>`, `{menu}`. When `lead` is a number, the lead cell is `<span class="lead num">`. With `tall`: the root is `class="row tall"`, and in place of the name and meta cells there is `<span class="grow"><div class="name">{name}</div><div class="meta selectable">{meta}</div></span>`, and the action is in `<span class="side">{action}</span>` (not `.act`). Clicks and key presses that start inside `.act` or the menu do not call `onOpen`. Keys on the row: Enter `onOpen`, Space `onSelect(!selected)`, ArrowDown and ArrowUp move focus to the next and previous element with `role="row"` and `tabindex="0"` in the same `.list`, ArrowLeft and ArrowRight call `onToggle` when `expanded` is `true` and `false`. When `onSelect` is set and the row is hovered, focused or selected, the row shows `<input type="checkbox" class="check" aria-label="Select {name as text}">` in place of `lead` (in place of `dot` when the row is a group, so the chevron stays).
   Tests: given `onOpen`, when the row is clicked, then it is called once; when the button in `action` is clicked, then `onOpen` is not called; when Enter is pressed on the row, then `onOpen` is called; given three rows in a `List`, when ArrowDown is pressed on the first, then the second has focus; given `expanded={true}` and ArrowLeft, then `onToggle` is called; given `onSelect`, when Space is pressed, then `onSelect(true)`; given `tall`, then the root has classes `row tall` and the action is inside `.side`; given `name={<>mysql<Dim>:8</Dim></>}`, then the name cell holds a `.dim` with `:8`; `Col kind="state-words"` has classes `col state words`; given `lead={3}`, then the lead cell has classes `lead num`.

2. `Problem.tsx`

   ```ts
   export function Problem(props: { level: "bad" | "warn"; text: string; action?: React.ReactNode; child?: boolean; onOpen?: () => void }): JSX.Element;
   ```

   `<div class="subrow [child]" role="row" tabindex={onOpen ? 0 : undefined}>`: `<Sev level>`, `<span class="what truncate">{text}</span>`, `<span class="act">{action}</span>`. Click or Enter calls `onOpen`, except from inside `.act`.
   Tests: the text renders; `Sev` has the level class; a click on the action button does not call `onOpen`; Enter does.

3. `Menu.tsx`

   ```ts
   export function Menu(props: { trigger: React.ReactElement; label: string; align?: "start" | "end"; wide?: boolean; children: React.ReactNode }): JSX.Element;
   export function MenuItem(props: { label: string; why?: string; shortcut?: string; danger?: boolean; disabled?: boolean; icon?: IconName; onSelect: () => void }): JSX.Element;
   export function MenuSeparator(): JSX.Element;          // class "menu-sep"
   export function MenuCaption(props: { children: React.ReactNode }): JSX.Element;   // class "menu-cap"
   export const MoreButton: React.ForwardRefExoticComponent<{ name: string } & React.ButtonHTMLAttributes<HTMLButtonElement> & React.RefAttributes<HTMLButtonElement>>;   // <Button variant="ghost" iconOnly icon="more" aria-label={`More actions for ${name}`} />. It forwards its ref and every other prop to the Button, so it works as a Menu trigger
   ```

   Radix DropdownMenu. Content `class="pop"` (plus `wide` when `wide` is set: use it when the items carry a hint), `aria-label={label}`, `collisionPadding={8}`. `MenuItem`: `class="menu-item [danger]"` holding `<span class="top">` (the optional icon, `<span>{label}</span>`, and `<span class="kbd">{shortcut}</span>` when set) and, when `why` is set, `<span class="why">{why}</span>` under it.
   Tests: given a menu with two items, when the trigger has focus and Enter is pressed, then the first item has focus; when ArrowDown then Enter, then the second item's `onSelect` is called and the menu is closed; `MoreButton name="kafka"` has the accessible name `More actions for kafka`; an item with `danger` has class `danger`.

4. `Sheet.tsx`

   ```ts
   export function Sheet(props: { open: boolean; onClose: () => void; title: string; hideTitle?: boolean; fact?: string; busy?: boolean; stack?: boolean; footer?: React.ReactNode; children: React.ReactNode }): JSX.Element;
   ```

   Radix Dialog. Overlay `class="overlay"`, content `class="sheet"`. `<div class="sheet-head">`: `Dialog.Title` rendered as `<h2>` with the title (with class `sr-only` when `hideTitle`), `<span class="muted mono">{fact}</span>` when set, `<span class="grow"></span>`, close `<Button variant="ghost" iconOnly icon="close" aria-label="Close" />`. `<div class="sheet-body [stack]">{children}</div>`. The Radix `Dialog.Portal` gets `container={usePortalContainer()}` (step 11). `<div class="sheet-foot">{footer}</div>` only when `footer` is set. Escape and a click on the overlay call `onClose`, except when `busy` is true (then nothing happens; the screen that owns the sheet asks first). Focus on open: the first input, select or textarea in the body, else the close button. Radix returns focus to the opener on close.
   Tests: given an opener button and a sheet with one input, when opened, then the input has focus; when Escape is pressed, then `onClose` is called; given `busy`, when Escape is pressed, then `onClose` is not called; given no `footer`, then there is no `.sheet-foot`; after closing, the opener has focus.

5. `ConfirmDialog.tsx`

   ```ts
   export type ConfirmOptions = { title: string; body: React.ReactNode; command?: string; confirm: string; danger?: boolean;
     option?: { label: string; checked: boolean; onChange: (checked: boolean) => void } };   // one checkbox under the body, for a confirm with one choice
   export function ConfirmProvider(props: { children: React.ReactNode }): JSX.Element;
   export function useConfirm(): (options: ConfirmOptions) => Promise<boolean>;
   ```

   Radix AlertDialog. Content `class="dialog"` (portal `container={usePortalContainer()}`, overlay `class="overlay"`): the title in an `<h2>`, the body in a `<p>`, `<Checkbox>` with the option's label when `option` is set (it starts at `option.checked` and calls `option.onChange` on every change), `<Command text={command}>` when set, then `<div class="foot">` with `<Button size="md">Cancel</Button>` and `<Button size="md" variant={danger ? "danger" : "primary"}>{confirm}</Button>`. Focus starts on Cancel when `danger`, on the confirm button otherwise. The promise resolves `true` on confirm, `false` on Cancel or Escape. Only one dialog at a time.
   Tests: given `danger: true`, when opened, then Cancel has focus; given `danger` false, then the confirm button has focus; when confirm is clicked, the promise resolves `true`; when Escape is pressed, it resolves `false`; the command text is on screen; given `option`, when its checkbox is clicked, then `option.onChange(true)` is called; the two buttons are inside `.foot`.

6. `Toast.tsx`

   ```ts
   export type ToastOptions = { text: string; action?: { label: string; onSelect: () => void } };
   export function ToastProvider(props: { children: React.ReactNode }): JSX.Element;
   export function useToast(): (options: ToastOptions) => void;
   ```

   One toast at a time, rendered with `createPortal` into `usePortalContainer()` (step 11): `<div class="toast" role="status">` with the text and the optional `<Button size="xs">`. It leaves after 6000 ms; the timer pauses while the pointer is over it. A new toast replaces the current one.
   Tests (fake timers): given a toast, then an element with role `status` holds the text; after 6000 ms it is gone; when the action is clicked, `onSelect` is called and the toast is gone.

7. `Blocks.tsx`

   ```ts
   export type BlockState = "ok" | "warn" | "bad" | "off";
   export function Blocks(props: { services: { name: string; state: BlockState; label: string }[] }): JSX.Element;
   ```

   `<span class="blocks" role="img" aria-label="{n} of {total} running">` with one `<u class="[warn|bad|off]" title="{name}: {label}">` per service, in the given order; `ok` has no class. With more than nine services: the first eight, then one `<u class="off">` with the text `+{rest}`.
   Tests: given states ok, bad, off, then the `u` classes are empty, `bad`, `off`; given 11 services, then 9 `u` elements and the last has text `+3`; the accessible name counts the `ok` ones.

8. `Meters.tsx`

   ```ts
   export type Meter = { label: "CPU" | "Memory" | "Disk"; share: number; text: string; hot?: boolean };   // share is 0 to 1
   export function Meters(props: { meters: Meter[]; onOpen?: () => void }): JSX.Element | null;
   ```

   `null` when `meters` is empty. Else `<button type="button" class="meters" aria-label="Machine use. Open machine settings">` with, per meter, `<span class="meter [hot]" style={{ "--v": `${Math.round(share * 100)}%` } as React.CSSProperties}>{label} <i></i> {text}</span>`. This `style` (one CSS variable) is the only inline style allowed in `src/ui/op/`; add the file to the ESLint allowlist in WO-1.3c.
   Tests: an empty list renders nothing; a meter with `share: 0.64` sets `--v` to `64%`; `hot` adds the class; a click calls `onOpen`.

9. `Sparkline.tsx`

   ```ts
   export function Sparkline(props: { points: number[] | null; label: string }): JSX.Element;
   ```

   With `points` null or empty: `<span class="spark" aria-hidden="true"></span>`. Else `<svg class="spark" viewBox="0 0 86 18" role="img" aria-label={label}><polyline points="..."/></svg>`: x from 0 to 86 in equal steps, y = `18 - 2 - (value / max) * 14` where `max` is the largest point or 1.
   Tests: `null` renders a `span.spark` and no `svg`; three points render a `polyline` with three coordinate pairs; the label is the accessible name.

10. `Inspector.tsx`

    ```ts
    export type InspectorProps = {
      open: boolean; onClose: () => void;
      crumb: string;                    // "shop / api"
      title: string;                    // the problem as one sentence
      lede: string;                     // one paragraph in plain words
      evidence?: { text: string; bad?: boolean }[];   // "What it said"
      findings?: string[];              // "What OpenPier found"
      actions: React.ReactNode;         // buttons; the first is the primary one
      command?: string;                 // the command the fix will run
    };
    export function Inspector(props: InspectorProps): JSX.Element;
    ```

    A `<Sheet title={title} hideTitle>` holding `<div class="ins">`, with exactly the markup of `const inspector` in the mockup: `<div class="crumb">{crumb}</div>`, `<h2>{title}</h2>`, `<p>{lede}</p>`; then when `evidence` is set `<div><div class="lbl">What it said</div><pre>...</pre></div>`, where the `pre` holds the lines joined by a newline and a line with `bad` is wrapped in `<b>`; then when `findings` is set `<div><div class="lbl">What OpenPier found</div><div class="steps">...</div></div>`, where each finding is `<div><i>{n}</i><span>{text}</span></div>` with `n` counting from 1; then `<div class="acts">{actions}</div>`; then `<Command text={command}>` when set. The two labels are the only fixed English text. Do not use `h3`, `ol`, `.lede` or `.actions` here: the stylesheet has no rule for them inside `.ins`.
    Tests: given evidence with one `bad` line, then that line is inside a `b`; given two findings, then `.steps` has two children and the second starts with `2`; the buttons are inside `.acts`; Escape calls `onClose`.

11. `Portal.tsx`

    ```ts
    export function PortalProvider(props: { container: HTMLElement | null; children: React.ReactNode }): JSX.Element;
    export function usePortalContainer(): HTMLElement | undefined;   // undefined = document.body
    ```

    A React context. In the stylesheet `.overlay`, `.sheet`, `.dialog`, `.palette` and `.toast` are `position: absolute`: they are placed inside `.main`, so a sheet covers the page and leaves the sidebar alone, as in every mockup picture. `Sheet`, `ConfirmDialog` and `Toast` pass `usePortalContainer()` as the portal container. The shell (WO-2.2) wraps the app in `<PortalProvider container={the .main element}>`. Without a provider (tests, the gallery) they go to `document.body`, which is fine there. Menus, selects and tooltips are placed by Radix next to their trigger and always go to `document.body`.
    Tests: given a `PortalProvider` with a `div` container and an open `Sheet` inside it, then the element with class `sheet` is a descendant of that `div`; given no provider, then it is a descendant of `document.body`.

**Done when**

```bash
ls src/ui/op/*.tsx | grep -vc test      # expect: 32
npm test 2>&1 | grep -E "Test Files|Tests "   # expect: 0 failed, at least 36 test files
grep -rnE "style=" src/ui/op --include="*.tsx" | grep -v test    # expect exactly one line, in src/ui/op/Meters.tsx
```

Plus the gate.

**Pull request title**: `wo-1.3b: rows, menus, sheets and dialogs exist and work by keyboard`

---

## WO-1.3c The gallery, and the rules that keep screens on the components

**Needs**: WO-1.3b.

**Why**: a reviewer needs one page that shows every component, and the linter must stop new code from going around the components.

**Read first**: `eslint.config.js`, `src/main.tsx`, `docs/plan/design/mockup.html` (how one screen is put together).

**Starting state**: `ls src/ui/op/*.tsx | grep -vc test` prints `32`.

**Do not touch**: the screens. They are not migrated in this work order.

**Steps**

1. Create `src/dev/Gallery.tsx`: one page, default export `Gallery`, with the app's `<div class="content">` and one `<section>` per component file of `src/ui/op/`, each with `<div class="group-cap">{ComponentName}</div>` and every variant and state listed in WO-1.3a and WO-1.3b: every `Button` variant in every size, plus busy, disabled and icon only; `Field` normal, with icon, invalid; `Select`; `Switch` on and off; `Chip` and `ChipButton` pressed and not; `Tabs`; `Dot` in its five states; `Sev` in its four levels; `Banner` in its three tones; `Empty`; `SkeletonRows`; `Canvas` with a normal, a warning and an error line; `Command`; `Tiles` with two `Tile`s; `Facts`; `GroupCaption` with a count; a `List` with a `RowHead`, a normal `Row`, a group `Row` with `Blocks`, a child `Row`, a `Problem` of each level, `Sparkline` with and without points; `Meters` with one hot meter; a `Menu` with a hint, a shortcut, a separator and a danger item; buttons that open a `Sheet`, a confirm (danger and not), a toast and the `Inspector`. Sample words: take them from the mockup's Containers screen (`kafka`, `kafka-ui`, `shop`, `api`), never invent.
2. Create `src/vite-env.d.ts` with the single line `/// <reference types="vite/client" />` (without it `import.meta.env` does not type-check). Then in `src/main.tsx`, render the gallery in development only. Keep every import line as it is (the `ConfirmProvider` here is the old one from `./ui`, which the old screens still need; the gallery imports the new providers from `../ui/op` inside `src/dev/Gallery.tsx`). Replace the `ReactDOM.createRoot(...).render(...)` call with:

   ```tsx
   const root = ReactDOM.createRoot(document.getElementById("root")!);
   if (import.meta.env.DEV && window.location.hash === "#/dev/gallery") {
     void import("./dev/Gallery").then(({ default: Gallery }) => root.render(<Gallery />));
   } else {
     root.render(
       <ConfirmProvider>
         <App />
       </ConfirmProvider>,
     );
   }
   ```

   `Gallery` wraps its content in the new `ConfirmProvider`, `ToastProvider` and `TooltipProvider` from `src/ui/op`.
3. Create `scripts/not-migrated.json`: a sorted JSON array with every `.tsx` file under `src/` that is not a test and is not under `src/ui/op/` or `src/dev/`. Generate it:

   ```bash
   find src -name "*.tsx" ! -name "*.test.tsx" ! -path "src/ui/op/*" ! -path "src/dev/*" | LC_ALL=C sort | node -e 'const l=require("fs").readFileSync(0,"utf8").trim().split("\n"); console.log(JSON.stringify(l,null,2))' > scripts/not-migrated.json
   ```

4. Create `scripts/check-not-migrated.mjs`:

   ```js
// scripts/not-migrated.json lists the files not yet rebuilt on the new components. It may only shrink.
// Fails when a path is in the list here and not in the list on main, or when a listed file no longer exists.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const now = JSON.parse(fs.readFileSync(path.join(root, "scripts/not-migrated.json"), "utf8"));
let failed = 0;
const check = (cond, message) => { console.log(cond ? "ok" : "FAIL", message); if (!cond) failed++; };

check(Array.isArray(now) && now.every((p) => typeof p === "string"), "not-migrated: the file is a JSON array of paths");
check(JSON.stringify(now) === JSON.stringify([...now].sort()), "not-migrated: the list is sorted");
const gone = now.filter((p) => !fs.existsSync(path.join(root, p)));
check(gone.length === 0, `not-migrated: every listed file exists${gone.length ? ` (missing: ${gone.join(", ")})` : ""}`);

let before = null;
try { before = JSON.parse(execFileSync("git", ["show", "main:scripts/not-migrated.json"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString()); } catch { /* the list is not on main yet: this is the pull request that adds it */ }
if (before) {
  const added = now.filter((p) => !before.includes(p));
  check(added.length === 0, `not-migrated: nothing was added to the list${added.length ? ` (added: ${added.join(", ")})` : ""}`);
} else {
  console.log("ok", "not-migrated: no list on main yet, nothing to compare with");
}
process.exit(failed ? 1 : 0);
   ```

5. In `eslint.config.js`:
   1. At the top add: `import fs from "node:fs";` and `const notMigrated = JSON.parse(fs.readFileSync(new URL("./scripts/not-migrated.json", import.meta.url), "utf8"));`
   2. Add this block at the end of the exported array:

      ```js
      {
        // Screens are built from src/ui/op. Files still on the old components are in scripts/not-migrated.json.
        files: ["src/**/*.tsx"],
        ignores: ["src/ui/op/**", "src/**/*.test.tsx", ...notMigrated],
        rules: {
          "no-restricted-imports": ["error", { patterns: [
            // A regex, not a `group`: a group "**/ui" also matches "../ui/op" (it works like .gitignore, a folder covers what is inside it).
            { regex: "(^|/)ui(/(index|ui|icons|components(/.*)?|Button|Card|Dialog|Menu|Input|Select|Drawer|Badge|Skeleton|Spinner|PageHeader|Status))?$", message: "Use the components in src/ui/op." },
            { group: ["lucide-react"], message: "Use <Icon> from src/ui/op." },
          ] }],
          "no-restricted-syntax": ["error",
            { selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]", message: "No colours in components. Use a class from the stylesheet." },
            { selector: "Literal[value=/^\\d+px$/]", message: "No pixel values in components. Use a class from the stylesheet." },
            { selector: "JSXOpeningElement[name.name='button']", message: "Use <Button> from src/ui/op." },
            { selector: "JSXOpeningElement[name.name='select']", message: "Use <Select> from src/ui/op." },
            { selector: "JSXOpeningElement[name.name='table']", message: "Use <List> and <Row> from src/ui/op." },
            { selector: "JSXAttribute[name.name='style']", message: "No inline styles. Use a class from the stylesheet." },
          ],
        },
      },
      {
        // The one inline style in the design system: the meter's fill is a CSS variable.
        files: ["src/ui/op/Meters.tsx"],
        rules: { "no-restricted-syntax": "off" },
      },
      ```

   3. Prove the rule works: create `src/dev/Probe.tsx` with `export const Probe = () => <button style={{ color: "red" }}>x</button>;`, run `npm run lint`, expect two errors in that file (`Use <Button>` and `No inline styles`). Delete the file. Paste the output in the pull request.
6. Create `scripts/check-gallery.mjs`:

   ```js
   // The gallery shows every component without a page error, in both themes.
   import { open, check, done } from "./lib/check.mjs";
   for (const theme of ["light", "dark"]) {
     const p = await open("/#/dev/gallery", { colorScheme: theme });
     await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
     await p.waitForSelector(".group-cap");
     const names = await p.locator(".group-cap").allInnerTexts();
     for (const n of ["Button", "Field", "Select", "Switch", "Chip", "Tabs", "Dot", "Sev", "Banner", "Empty", "SkeletonRows", "Canvas", "Command", "Tile", "Facts", "GroupCaption", "Row", "Problem", "Blocks", "Sparkline", "Meters", "Menu", "Sheet", "ConfirmDialog", "Toast", "Inspector"])
       check(names.some((x) => x.startsWith(n)), `gallery (${theme}): has a section for ${n}`);
     check((await p.locator(".btn.primary").count()) > 0, `gallery (${theme}): shows a primary button`);
     await p.screenshot({ path: `test-results/gallery-${theme}.png`, fullPage: true });
   }
   await done();
   ```

   The check names 26 of the 32 sections on purpose (the ones with something to look at). The gallery still has one section per component file.

7. Attach `test-results/gallery-light.png` and `test-results/gallery-dark.png` to the pull request. The reviewer compares each section with the same piece in the mockup pictures. Do not claim they match; say you attached them.

**Tests to write first**: step 5.3 (the probe) and step 6 (the check) are the tests.

**Done when**

```bash
node scripts/check-not-migrated.mjs | grep -c "^FAIL"     # expect: 0
node -e 'console.log(require("./scripts/not-migrated.json").length)'   # expect: a number between 55 and 75
npm run lint; echo "exit $?"                              # expect: exit 0
PW_ENGINES=webkit sh scripts/check-all.sh | grep "check-gallery"   # expect: "webkit scripts/check-gallery.mjs: 0"
```

Plus the gate.

**Pull request title**: `wo-1.3c: a gallery shows every component, and lint keeps screens on them`

---

## WO-1.4 A check that every class exists

**Needs**: WO-1.3c.

**Why**: E6. The app broke because a stylesheet was deleted and no check noticed that hundreds of class names pointed at nothing. This check makes that impossible for migrated files.

**Read first**: `scripts/not-migrated.json`.

**Starting state**: `test -f scripts/not-migrated.json && test -f src/ui/openpier.css && echo ok` prints `ok`.

**Do not touch**: `scripts/not-migrated.json` (do not add files to it to make this pass).

**Steps**

1. Create `scripts/check-classes.mjs`:

   ```js
// Every class name used in a className must exist in src/ui/openpier.css.
// This is the guard against a deleted stylesheet leaving the app unstyled without any test failing.
// Files in scripts/not-migrated.json are skipped until their screen is rebuilt.
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const css = fs.readFileSync(path.join(root, "src/ui/openpier.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const defined = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
const skip = new Set(JSON.parse(fs.readFileSync(path.join(root, "scripts/not-migrated.json"), "utf8")));

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const files = walk(path.join(root, "src")).filter((f) => f.endsWith(".tsx") && !f.includes(".test."));

// The text of a className value: a quoted string, or a {...} expression with balanced braces.
const values = (src) => {
  const out = [];
  for (const m of src.matchAll(/className=/g)) {
    let i = m.index + m[0].length;
    if (src[i] === '"') { out.push(src.slice(i, src.indexOf('"', i + 1) + 1)); continue; }
    if (src[i] !== "{") continue;
    let depth = 0, j = i;
    do { if (src[j] === "{") depth++; else if (src[j] === "}") depth--; j++; } while (depth > 0 && j < src.length);
    out.push(src.slice(i, j));
  }
  return out;
};
// Class names inside a value: the words of every string literal, with ${...} parts dropped.
const names = (value) =>
  [...value.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)]
    .flatMap((m) => (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, " ").split(/\s+/))
    .filter((w) => /^[a-zA-Z][\w-]*$/.test(w));

let failed = 0, checked = 0;
for (const file of files) {
  const rel = path.relative(root, file);
  if (skip.has(rel)) continue;
  checked++;
  const unknown = [...new Set(values(fs.readFileSync(file, "utf8")).flatMap(names))].filter((n) => !defined.has(n));
  if (unknown.length) { console.log("FAIL", `classes: ${rel} uses classes that openpier.css does not define: ${unknown.join(", ")}`); failed++; }
}
console.log(failed ? "FAIL" : "ok", `classes: ${checked} files checked, ${skip.size} skipped (not migrated), ${failed} with unknown classes`);
process.exit(failed ? 1 : 0);
   ```

2. Run `node scripts/check-classes.mjs`. It checks the files of `src/ui/op/` and `src/dev/`. For each unknown class it reports: the class is a mistake in the component. Fix the component to use the class the spec names. Never add a class to `openpier.css`. If the spec names a class that `openpier.css` does not have, stop and report (it is a defect in the design).
3. Prove it catches a mistake: in `src/ui/op/Chip.tsx` change `chip` to `chipp`, run the script, expect `FAIL classes: src/ui/op/Chip.tsx uses classes that openpier.css does not define: chipp`, then undo the change. Paste the output in the pull request.

**Tests to write first**: step 3 is the test.

**Done when**

```bash
node scripts/check-classes.mjs | tail -1     # expect: "ok classes: <n> files checked, <m> skipped (not migrated), 0 with unknown classes" with n at least 32
```

Plus the gate.

**Pull request title**: `wo-1.4: a check fails when a class name does not exist in the stylesheet`

---

## WO-1.5 A check that compares the app with the mockup

**Needs**: WO-1.4.

**Why**: the mockup is the design. Each screen work order in iterations 2 and 3 adds its row to this check.

**Read first**: `docs/plan/design/shoot.mjs`, `preview/mock.ts` (the `db` object, how `scenario` is read near line 49, and how the scenarios `stopped` and `two` change `db`), `docs/plan/design/mockup.html` (search for `const containersList`, `const images =`, `const volumes =`, `const networksMain`, `const meters`).

**Starting state**: `grep -c '"design"' preview/mock.ts` prints `0`.

**Do not touch**: the existing scenarios in `preview/mock.ts`. Their data must not change (the remaining checks depend on it).

**Steps**

1. `npm install --save-dev pixelmatch@^7 pngjs@^7`
2. Create `scripts/mockup-pairs.json` with the content `[]` and a newline.
3. Create `scripts/check-mockup.mjs`:

   ```js
// Compares the app with the mockup, screen by screen, in WebKit at 1280x800.
// The pairs are in scripts/mockup-pairs.json:
//   { "mockup": "containers", "path": "/?scenario=design#/containers", "themes": ["light", "dark"],
//     "threshold": 0.005, "mask": [".age"], "why": "" }
// "mask" hides elements (by CSS selector, in both pages) that change between runs. "threshold" is the share of
// pixels allowed to differ; the default is 0.005 (half a percent); when a row needs more than 0.02, "why" must say why.
// The two pictures and their difference are written to test-results/mockup/.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import pixelmatch from "pixelmatch";
const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BASE = (process.env.PREVIEW_URL || "http://localhost:4173/").replace(/\/$/, "");
const pairs = JSON.parse(fs.readFileSync(path.join(root, "scripts/mockup-pairs.json"), "utf8"));
const out = path.join(root, "test-results/mockup");
let failed = 0;
const check = (cond, message) => { console.log(cond ? "ok" : "FAIL", message); if (!cond) failed++; };

if ((process.env.PW_ENGINE || "chromium") !== "webkit") {
  console.log("ok", "mockup: compared in WebKit only, skipped in this engine");
  process.exit(0);
}
if (pairs.length === 0) { console.log("ok", "mockup: no pairs yet"); process.exit(0); }

fs.mkdirSync(out, { recursive: true });
const { webkit } = require("playwright");
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const hide = async (selectors) => { if (selectors.length) await page.addStyleTag({ content: `${selectors.join(", ")} { visibility: hidden !important; }` }); };
const still = () => page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }" });

for (const pair of pairs) {
  const { mockup, path: appPath, themes = ["light", "dark"], threshold = 0.005, mask = [], why = "" } = pair;
  check(threshold <= 0.02 || why.length > 0, `mockup: ${mockup} says why its threshold is above 2%`);
  for (const theme of themes) {
    const name = `${mockup}-${theme}`;
    await page.goto(`file://${path.join(root, "docs/plan/design/mockup.html")}#screen=${mockup}&theme=${theme}&bare=1`);
    await page.reload();
    await still(); await hide(mask);
    const want = PNG.sync.read(await page.screenshot());

    await page.goto(BASE + appPath);
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    await still(); await hide(mask);
    const got = PNG.sync.read(await page.screenshot());

    const diff = new PNG({ width: want.width, height: want.height });
    const pixels = pixelmatch(want.data, got.data, diff.data, want.width, want.height, { threshold: 0.1, includeAA: false });
    const share = pixels / (want.width * want.height);
    fs.writeFileSync(path.join(out, `${name}-mockup.png`), PNG.sync.write(want));
    fs.writeFileSync(path.join(out, `${name}-app.png`), PNG.sync.write(got));
    fs.writeFileSync(path.join(out, `${name}-diff.png`), PNG.sync.write(diff));
    check(share <= threshold, `mockup: ${name} differs by ${(share * 100).toFixed(2)}% (allowed ${(threshold * 100).toFixed(1)}%)`);
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
   ```

4. Add the scenario `design` to `preview/mock.ts`: when `scenario === "design"`, `db` holds exactly the things the mockup shows, and nothing else. Follow the way the scenario `stopped` replaces data. The data:

   Machine: one Colima profile named `default` (its Docker context is `colima`), Running, 4 CPU, 8 GB memory, 60 GB disk, Kubernetes on. The sidebar then reads `Colima · default` and `Running · 4 CPU · 8 GB`, as in the mockup. Machine use: CPU 12 percent, memory 5.1 of 8 GB, disk 41 of 60 GB.

   Containers (10). "Project" is the Compose project (label `com.docker.compose.project`) with working folder `/Users/you/code/shop`:

   | Name | Image | Project | State | Health | Ports | CPU | Memory |
   |---|---|---|---|---|---|---|---|
   | `kafka` | `apache/kafka:3.8` | | running | | | 2% | 512 MB |
   | `kafka-ui` | `provectuslabs/kafka-ui` | | running | | 8082 | 0% | 310 MB |
   | `api` | `acme/billing-api:3.1` | `shop` | running | unhealthy | 8080 | 1% | 120 MB |
   | `web` | `nginx:1.27` | `shop` | running | | | 0% | 14 MB |
   | `db` | `postgres:16` | `shop` | running | | | 0% | 96 MB |
   | `queue` | `redis:7` | `shop` | running | | | 0% | 9 MB |
   | `worker` | `acme/worker:3.1` | `shop` | restarting (6 restarts in 10 minutes; shown as `Restarting`) | | | | |
   | `report-job` | `acme/report:3.1` | `shop` | exited 137, out of memory, limit 256 MB (shown as `Out of memory`) | | | | |
   | `cache` | `memcached:1.6` | `shop` | exited 0 (shown as `Stopped`) | | | | |
   | `scratch-postgres` | `postgres:16` | | running | | 5433 | 0% | 88 MB |

   The group row of `shop` reads `5 of 7 running`: a restarting container counts as running (Docker restarts it by itself), so api, web, db, queue and worker count. That is ten containers, and five of them have a problem line (the mockup header says `10 · 5 need attention`). `kafka` is on the network `devnet`; `kafka-ui` is on `bridge` only (this is why it cannot reach Kafka).

   Images (5): `acme/orders-api:1.4` 200 MB 1 week ago; `mysql:8` 559 MB 3 weeks ago; `nginx:latest` 183 MB 2 weeks ago; `redis:7` 112 MB 5 weeks ago; `postgres:16` 435 MB 6 weeks ago. Disk: build cache 3.4 GB, images 1.6 GB (666 MB unused), stopped containers 64 MB, volumes 1.6 GB.

   Volumes (5): `mysql-data` 393 MB used by `db`; an unnamed volume (id starting `ccccccccccc`) 3.9 KB used by `web`; `pgdata-old` 1.1 GB not used; `redis-data` 17 MB not used; an unnamed volume (id starting `aaaaaaaaaaa`) 36 B not used.

   Networks (4): `devnet` 172.18.0.0/16 with `api`, `worker`, `kafka`, `queue`, `db`, `web`; `bridge` 172.17.0.0/16 with `kafka-ui`; `host`; `none`.

   Where the mock's `db` needs a field this table does not give (an id, a created date), use a fixed value, never `Math.random()` or the clock: the pictures must be the same on every run.
5. Add a node test `src/lib/designScenario.test.ts`: it reads `preview/mock.ts` as text and asserts that the names `kafka-ui`, `report-job`, `scratch-postgres`, `pgdata-old` and `devnet` each appear in the text between the line that first contains `"design"` and the end of the file (put the `design` data last in `preview/mock.ts`, in one constant named `DESIGN`). (The mock runs only in a browser, so the test reads the text.)
6. Prove the check works, without leaving a row behind:
   1. Put this in `scripts/mockup-pairs.json`: `[{ "mockup": "containers", "path": "/?scenario=design", "themes": ["light"], "threshold": 0.005 }]`
   2. Run `npm run preview` in one terminal and `PW_ENGINE=webkit node scripts/check-mockup.mjs` in another. Expect a `FAIL mockup: containers-light differs by <n>%` line and exit 1 (the Containers screen is not rebuilt yet). Open `test-results/mockup/containers-light-diff.png` to see it was written.
   3. Put `[]` back in `scripts/mockup-pairs.json`. Paste the FAIL line in the pull request.

**Tests to write first**: step 5, then step 6.

**Done when**

```bash
cat scripts/mockup-pairs.json                         # expect: []
PW_ENGINE=webkit node scripts/check-mockup.mjs        # expect: "ok mockup: no pairs yet"
PW_ENGINE=chromium node scripts/check-mockup.mjs      # expect: "ok mockup: compared in WebKit only, skipped in this engine"
grep -c '"design"' preview/mock.ts                    # expect: at least 1
```

Plus the gate. Then write the iteration report (`../HANDOFF.md` section 8).

**Pull request title**: `wo-1.5: a check compares each screen with the mockup`
