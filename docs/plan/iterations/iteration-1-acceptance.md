# Iteration 1: acceptance checklist

For the plan's author. Walk this after `sh docs/plan/iterations/verify-iteration-1.sh` prints `0 failed`. The script proves what a command can prove. This list is what only a reader can judge.

## Before anything

1. Read `iteration-1-report.md`. Every work order is "done", or has a `STOPPED-wo-<id>.md` with a real reason.
2. `git log --oneline --first-parent main` shows one merge per work order, in the order 0.0, 0.2, 0.3, 0.5, 0.4, 0.6, 1.1, 1.2, 1.3a, 1.3b, 1.3c, 1.4, 1.5. No commit sits on `main` outside a merge.
3. Nothing was pushed: `git status -sb` shows `main` ahead of `origin/main`, and `git tag` has no new tag.
4. `private.key` was not read or changed: `git log --all -- private.key` shows no commit from this iteration (unless the owner did WO-0.1).

## The cheats to look for, in every work order

1. A test made weaker: `git diff 0bdafcf -- 'src/**/*.test.*' 'scripts/checks-pending' 'src-tauri/src'` and read every removed `assert`, `expect`, `check(` and `#[test]`. A removed one needs a reason in the pull request text.
2. A check moved to `scripts/checks-pending/` that passed before (the report must paste the failing line for each one moved).
3. `#[allow(...)]`, `eslint-disable`, `as any`, `@ts-ignore`, `.skip` added to get to green.
4. A value changed in `docs/plan/design/openpier.css` (the script checks this; if it changed, the design changed without the author).
5. A step skipped: each pull request text has the steps as a ticked list, and "Not done" says "nothing" or says why.

## Per work order

### WO-0.0

1. `git show --stat <merge>`: no file under `src/` changed. The Rust diff after the `cargo fmt` commit is small and is only what clippy suggests. Read it: no behaviour change.
2. `eslint.config.js` is exactly the one in the work order.

### WO-0.2

1. Start the preview (`npm run preview`, `http://localhost:4173/?scenario=running`). The app opens on Containers. There is no Projects item, no AI panel, no onboarding dialog.
2. Read the diff of `src/App.tsx` and `src/Shell.tsx`: only the lines the work order names.
3. `src-tauri/Cargo.toml` equals the one in the work order, or the pull request text says which crate came back and why.
4. `src/ComposeProjects.tsx` and the Compose commands in `main.rs` were not touched.

### WO-0.3

1. `npm run check` on a clean clone passes in both engines, and the server it started is gone afterwards (`curl -s localhost:4173` fails).
2. `scripts/checks-pending/README.md` lists exactly the files in the folder, each with its work order.
3. Open `http://localhost:4173/?scenario=stopped` and `?scenario=two`: the page loads without a console error.
4. `preview/mock.ts` gained handlers only if the mock coverage test asked for them.

### WO-0.5

1. `ls` at the root: nothing left that a new contributor would ask about.
2. `docs/research/` holds the two moved files. Links to them in `README.md` and `AGENTS.md` still work.

### WO-0.4

1. In the preview, the window title is OpenPier. Search the screens for "Wharf": none.
2. In the browser console of the preview: `localStorage.setItem("wharf:sidebar-folded", "1"); localStorage.removeItem("openpier:migrated")`, reload: the sidebar is folded and `openpier:sidebar-folded` is `"1"`.
3. Read the diff for the word "colima": the runtime's name was not renamed anywhere (`colima start`, `~/.colima`, context `colima`).
4. `CHANGELOG.md` has the two lines under `## Unreleased`.

### WO-0.6

1. `.github/workflows/ci.yml` equals section 3 of `../06-open-source-launch.md`.
2. Not verified by anyone yet: it has never run. The owner pushes a branch and watches the first run. If it fails, that is a finding for the next iteration, not a failure of this one.

### WO-1.1

1. The preview looks unstyled in most places. That is correct. What must be true: the page background, the text colour and the font come from `openpier.css` (inspect `body`).
2. The pull request text says in its first line that the app looks worse and why.

### WO-1.2

1. `node scripts/check-contrast.mjs` prints 44 `ok` lines. No token value changed.

### WO-1.3a, 1.3b, 1.3c

Open `http://localhost:4173/#/dev/gallery`, light and dark (set `document.documentElement.dataset.theme = "dark"` in the console). Compare each section with the mockup pictures in `../design/shots/`:

1. **Button**: `containers-light.png` header. `New` is solid cobalt with white text; row buttons are white with a hairline; ghost buttons have no fill. Heights 24, 28, 32.
2. **Row, Problem, Blocks, Sparkline**: `containers-light.png`. A row is 34 px with a hairline under it; the header row is muted; a problem line is tinted red or amber across the full width; the group row shows seven blocks; child rows are indented.
3. **Menu**: `containers-row-menu-light.png`. Each item has its hint under the label; the destructive item is last and red.
4. **Sheet**: `run-sheet-light.png`. 480 px from the right, the list dimmed behind.
5. **ConfirmDialog**: `confirm-dialog-light.png`. The command is shown; for a delete, focus starts on Cancel.
6. **Inspector**: `problem-inspector-light.png`. Crumb, sentence, "What it said" with the failing line in red, "What OpenPier found" numbered, the fix button, the command.
7. **Meters**: the header of any mockup screen. The memory bar is amber when hot.
8. **Empty, Banner, SkeletonRows, Toast**: `empty-state-light.png`, `loading-error-toast-light.png`.
9. Keyboard, in the gallery: Tab reaches every control and the focus ring is visible; a menu opens with Enter and moves with the arrows; Escape closes the sheet and focus returns to its button.
10. No component file has a colour, a pixel value or an English word other than the accessible names the work order lists (`Close`, `Copy the command`, `More actions for {name}`, `Loading`, `What it said`, `What OpenPier found`, `Why`, `Cancel`, `Machine use. Open machine settings`).
11. The old components in `src/ui/` and `src/ui.tsx` were not edited.
12. `scripts/not-migrated.json` lists every screen file and no file of `src/ui/op/` or `src/dev/`.

### WO-1.4

1. The pull request text shows the `chipp` proof: the check failed on the planted mistake.
2. `openpier.css` gained no class.

### WO-1.5

1. The pull request text shows the FAIL line from the proof run, and `scripts/mockup-pairs.json` is `[]` again.
2. Open `http://localhost:4173/?scenario=design`: the ten containers of the mockup's Containers screen are listed (names as in `containers-light.png`). The old scenarios still show their old data.
3. Remember what this check can and cannot prove: two different mockup screens differ by only 3.7 percent of pixels. From iteration 2 on, never accept a screen on the number alone. Open the three pictures in `test-results/mockup/` for each row.

## What nobody has verified after this iteration

1. The CI workflow has never run.
2. The app has not been started as a real Tauri window by the implementer (it does not run machine-changing commands). Do it once: `npm run tauri dev`. It opens, shows Containers, and the title bar says OpenPier.
3. Nothing in this iteration was tried against a real container engine.
