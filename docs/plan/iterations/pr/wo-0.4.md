wo-0.4: the app is called OpenPier everywhere and keeps your settings

## What changed

The app is called OpenPier in the window, the installer, the README and the repo links.
Settings saved by older builds are copied to the new name, so nothing is lost.
macOS treats it as a new app because its identifier changed.

## Steps done

- [x] 1. Names in config, plus `npm install --package-lock-only` and `cargo build` for the lock files.
- [x] 2. Words a user reads, in README, CONTRIBUTING, feedback template, release workflow, install script and App.tsx.
- [x] 3. Temporary file names in Rust changed from `colima-ui-` to `openpier-`.
- [x] 4. Testcontainers marker changed to `# Added by OpenPier (Testcontainers)`.
- [x] 5. Created `src/lib/links.ts` and used it for the discussions link.
- [x] 6. Storage keys changed to the `openpier:` prefix.
- [x] 7. Wrote `src/lib/migrateStorage.test.ts` first, saw it fail, then created `src/lib/migrateStorage.ts` and called it before `ReactDOM.createRoot(`.
- [x] 8. Added the `## Unreleased` section with the two lines to `CHANGELOG.md`.

## Evidence

Done when checks:

```text
$ git grep -niE "wharf|container ui|container-ui|colima-ui|colima_ui" -- . ':!docs' ':!CHANGELOG.md'
scripts/eval-setup.sh:2:# Creates small, harmless problem scenarios (everything is named eval-*) so you can compare container UIs on the same situations.
src/lib/migrateStorage.test.ts:18:  const s = memory({ "colima-ui:learn": "a", "colima-ui.wayBack": "b", "wharf:sidebar-folded": "1", other: "x" });
src/lib/migrateStorage.test.ts:23:  assert.equal(s.getItem("colima-ui:learn"), "a");
src/lib/migrateStorage.test.ts:28:  const s = memory({ "wharf:sidebar-folded": "1", "openpier:sidebar-folded": "0" });
src/lib/migrateStorage.test.ts:34:  const s = memory({ "colima-ui:learn": "a" });
src/lib/migrateStorage.test.ts:36:  s.setItem("colima-ui:learn", "changed");
src/lib/migrateStorage.ts:3:const OLD_PREFIXES = ["colima-ui:", "colima-ui.", "wharf:"]; // old names, kept on purpose: this is the migration
```

```text
$ grep -c '"identifier": "dev.openpier.desktop"' src-tauri/tauri.conf.json
1
```

```text
$ npm test 2>&1 | grep -E "^# (pass|fail)"
# pass 592
# fail 0
```

```text
$ node -e '... page.title() ...'
title: OpenPier
```

Gate (all exit 0):

```text
$ npm ci
12 vulnerabilities (9 moderate, 1 high, 2 critical)
Run `npm audit` for details.
```

```text
$ npm run lint
✖ 33 problems (0 errors, 33 warnings)
```

```text
$ npx tsc --noEmit
(no output)
```

```text
$ npm test
 Test Files  8 passed (8)
      Tests  79 passed (79)
# pass 592
# fail 0
```

```text
$ cd src-tauri && cargo fmt --check
(no output)
```

```text
$ cargo clippy --all-targets -- -D warnings
    Checking openpier v0.2.1 (/Users/fsousa/Desktop/colima-ui/src-tauri)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.64s
```

```text
$ cargo test
test result: ok. 135 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 3.26s
```

```text
$ npm run check
== chromium
chromium scripts/check-entitlements.mjs: 0
chromium scripts/check-icon.mjs: 0
chromium scripts/check-start.mjs: 0
chromium scripts/check-version-sync.mjs: 0
== webkit
webkit scripts/check-entitlements.mjs: 0
webkit scripts/check-icon.mjs: 0
webkit scripts/check-start.mjs: 0
webkit scripts/check-version-sync.mjs: 0
```

## Screenshots

WebKit, 1280x800, from `npm run preview` at `http://localhost:4173/?scenario=running`.
Dark is the same screen with `.dark` added to the root element, because the app has no theme switch yet.

- `containers-light.png`
- `containers-dark.png`

The page body does not show the app name. The name is in the window title, which the browser preview shows as the tab title (`OpenPier`), and in the installed app's window title. The screen itself is unchanged from before this work order.

`design/shots/` does not exist in this repo, so there is no mockup picture to compare with and no match is claimed.

## Not done or changed from the work order

- Step 3 says there are seven `colima-ui-` temporary prefixes. There are eight: three in `main.rs`, four in `desktop.rs`, one in `setup.rs`. All eight were replaced.
- Done when says two lines stay in `scripts/eval-setup.sh`. Only one line matches: line 2, "compare container UIs". It stays.
- `README.md` still links to the deleted `docs/SUMMARY.md` and `docs/SPEC.md`. This is outside the steps and recorded in `docs/plan/FOUND.md`.

## Found on the way

- 2026-11-13, `README.md`, the contributor line still points to `docs/SUMMARY.md` and `docs/SPEC.md`, which WO-0.5 step 3 deleted. The step 4 search names only the moved files, so these dead links stay. A new contributor follows them to nothing.
- 2026-11-13, `src/ui/tokens.css`, line 42 names the deleted `Table.css` in a comment. The step 4 rule covers an import line, and this file has no import, so the stale comment stays.