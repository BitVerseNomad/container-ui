wo-0.5: the repo root holds only what the project needs

## What changed

1. The old screenshots, session notes, screenshot scripts and Homebrew cask are gone.
2. The two useful notes moved under `docs/research/`, and the app icon moved next to the other Tauri icons.
3. `.gitignore` now covers local keys, env files and test output.

## Steps done

- [x] Removed from git: the five screenshots, `take-all.cjs`, `take-screenshots.cjs`, `take-screenshots.js`, `test-results`, `opencode.json`, `RESUME.md`, `TODO.md`, `CONTEXT.md`, `homebrew-colima-ui` and `src/ui/components/Table.css`. Every path existed.
- [x] Moved `docs/EVALUATION.md` to `docs/research/evaluation-kit.md`, `docs/VERIFY-ON-YOUR-MAC.md` to `docs/research/verify-on-your-mac.md`, and `app-icon.svg` to `src-tauri/icons/app-icon.svg`.
- [x] Removed the rest of `docs/` except `docs/plan`, `docs/research` and `docs/screenshots`.
- [x] Searched for the moved names; updated the two path references in `docs/research/evaluation-kit.md` and the two in `README.md`. The only `Table.css` match left is a comment in `src/ui/tokens.css`; that file has no import line.
- [x] Replaced `.gitignore` with the exact content in the work order.

## Evidence

`git ls-files | awk -F/ '{print $1}' | sort -u | tr '\n' ' '`:

```text
.github .gitignore AGENTS.md CHANGELOG.md CONTRIBUTING.md docs eslint.config.js index.html package-lock.json package.json preview private.key private.key.pub README.md scripts src src-tauri test-baselines tsconfig.json vite.config.ts vite.preview.config.ts vitest.config.ts
```

`git ls-files docs | awk -F/ '{print $2}' | sort -u | tr '\n' ' '`:

```text
plan research screenshots
```

`private.key` and `private.key.pub` stayed because WO-0.1 is not done. They were not opened.

Gate:

```text
npm ci          exit 0
npm run lint    exit 0 (0 errors, 33 warnings)
npx tsc --noEmit exit 0 (no output)
npm test        exit 0 (# pass 588, # fail 0, Tests 79 passed)
cargo fmt --check exit 0 (no output)
cargo clippy --all-targets -- -D warnings exit 0
cargo test      exit 0 (135 passed; 0 failed; 2 ignored)
npm run check   exit 0 (every line ": 0", both engines)
```

## Screenshots

None. No screen changed.

## Not done or changed from the work order

1. Step 4 updated the moved paths in the README contributor line. That line also points to `docs/SUMMARY.md` and `docs/SPEC.md`, which step 3 deleted, but the step 4 search does not name them. The dead links and the stale `Table.css` comment are recorded in `FOUND.md` instead of being changed outside the recipe.

## Found on the way

- 2026-11-13, `README.md`, the contributor line still points to `docs/SUMMARY.md` and `docs/SPEC.md`, which WO-0.5 step 3 deleted. The step 4 search names only the moved files, so these dead links stay. A new contributor follows them to nothing.
- 2026-11-13, `src/ui/tokens.css`, line 42 names the deleted `Table.css` in a comment. The step 4 rule covers an import line, and this file has no import, so the stale comment stays.