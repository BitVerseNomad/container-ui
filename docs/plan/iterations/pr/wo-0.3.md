wo-0.3: the preview opens in a browser and the checks run again

## What changed

1. The preview is the real UI served by Vite with a fake backend, at http://localhost:4173.
2. The browser checks start that preview themselves and run in Chromium and WebKit.
3. Checks for screens that are rebuilt later wait in `scripts/checks-pending/`.

## Steps done

- [x] Created `vite.preview.config.ts` with the exact content in the work order.
- [x] Changed the `preview` and `check` scripts and deleted `test:visual` in `package.json`.
- [x] Deleted `scripts/build-preview.mjs`, `playwright.config.ts` and the nine `scripts/visual-regression*` files; uninstalled `@playwright/test`.
- [x] Replaced `preview/index.html` with `preview/dist/` in `.gitignore`, added `test-results/` and `playwright-report/`, and confirmed `preview/index.html` is absent.
- [x] Created `scripts/lib/check.mjs` with the exact content in the work order.
- [x] Replaced `scripts/check-all.sh` with the exact content in the work order.
- [x] Pointed every check at `http://localhost:4173/` with the given `sed`; the `file://` count is 0.
- [x] Ran `npx playwright install webkit chromium`.
- [x] Opened `http://localhost:4173/?scenario=running`: the sidebar lists Containers and Doctor, and the page is titled Containers.
- [x] Wrote `src/lib/mockCoverage.test.ts` and `scripts/check-start.mjs`; both passed in Chromium and WebKit.
- [x] Ran `npm run check`; the output is under Evidence.
- [x] Applied the file-name rule: the four checks that must pass did pass; the other 23 moved to `scripts/checks-pending/` with `git mv`, unedited.
- [x] Created `scripts/checks-pending/README.md` with the given text; all 23 rows stayed because all 23 checks moved.
- [x] Pasted the failing list and the per-script action below.
- [x] Updated `AGENTS.md`: the preview command is listed, and the README screenshot step no longer builds the preview first.

## Evidence

`npm run check; echo "exit $?"`:

```text
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
exit 0
```

The list from step 11, before the move:

```text
chromium scripts/check-a11y.mjs: crashed
chromium scripts/check-bring-home.mjs: 2
chromium scripts/check-bring.mjs: 2
chromium scripts/check-compose.mjs: crashed
chromium scripts/check-disk.mjs: crashed
chromium scripts/check-doctor.mjs: 4
chromium scripts/check-down.mjs: crashed
chromium scripts/check-guided.mjs: crashed
chromium scripts/check-home.mjs: 2
chromium scripts/check-k8s.mjs: crashed
chromium scripts/check-layout.mjs: 2
chromium scripts/check-menus.mjs: crashed
chromium scripts/check-mounts.mjs: 1
chromium scripts/check-netfix.mjs: 1
chromium scripts/check-network.mjs: crashed
chromium scripts/check-observe.mjs: crashed
chromium scripts/check-pull.mjs: crashed
chromium scripts/check-replace.mjs: 2
chromium scripts/check-resize.mjs: crashed
chromium scripts/check-restyle.mjs: crashed
chromium scripts/check-select.mjs: 2
chromium scripts/check-setup.mjs: 1
chromium scripts/check-volumes.mjs: crashed
webkit scripts/check-a11y.mjs: crashed
webkit scripts/check-bring-home.mjs: 2
webkit scripts/check-bring.mjs: 2
webkit scripts/check-compose.mjs: crashed
webkit scripts/check-disk.mjs: crashed
webkit scripts/check-doctor.mjs: 4
webkit scripts/check-down.mjs: crashed
webkit scripts/check-guided.mjs: crashed
webkit scripts/check-home.mjs: 2
webkit scripts/check-k8s.mjs: crashed
webkit scripts/check-layout.mjs: 2
webkit scripts/check-menus.mjs: crashed
webkit scripts/check-mounts.mjs: 1
webkit scripts/check-netfix.mjs: 1
webkit scripts/check-network.mjs: crashed
webkit scripts/check-observe.mjs: crashed
webkit scripts/check-pull.mjs: crashed
webkit scripts/check-replace.mjs: 2
webkit scripts/check-resize.mjs: crashed
webkit scripts/check-restyle.mjs: crashed
webkit scripts/check-select.mjs: 2
webkit scripts/check-setup.mjs: 1
webkit scripts/check-volumes.mjs: crashed
```

Per script:

| Script | Action |
|---|---|
| `check-a11y.mjs` | moved |
| `check-bring-home.mjs` | moved |
| `check-bring.mjs` | moved |
| `check-compose.mjs` | moved |
| `check-disk.mjs` | moved |
| `check-doctor.mjs` | moved |
| `check-down.mjs` | moved |
| `check-entitlements.mjs` | stays |
| `check-guided.mjs` | moved |
| `check-home.mjs` | moved |
| `check-icon.mjs` | stays |
| `check-k8s.mjs` | moved |
| `check-layout.mjs` | moved |
| `check-menus.mjs` | moved |
| `check-mounts.mjs` | moved |
| `check-netfix.mjs` | moved |
| `check-network.mjs` | moved |
| `check-observe.mjs` | moved |
| `check-pull.mjs` | moved |
| `check-replace.mjs` | moved |
| `check-resize.mjs` | moved |
| `check-restyle.mjs` | moved |
| `check-select.mjs` | moved |
| `check-setup.mjs` | moved |
| `check-start.mjs` | stays |
| `check-version-sync.mjs` | stays |
| `check-volumes.mjs` | moved |

Done when:

```text
npm run check; echo "exit $?"        exit 0, every line ": 0"
ls scripts/check-*.mjs | wc -l       4
ls scripts/checks-pending/*.mjs | wc -l   23
grep -c '^| `check-' scripts/checks-pending/README.md   23
test ! -e scripts/build-preview.mjs && test ! -e playwright.config.ts && echo gone   gone
npm test | grep -E "^# (pass|fail)"   # pass 588, # fail 0
```

Gate:

```text
npm ci          exit 0
npm run lint    exit 0 (0 errors, 33 warnings)
npx tsc --noEmit exit 0 (no output)
npm test        exit 0 (# pass 588, # fail 0, Tests 79 passed)
cargo fmt --check exit 0 (no output)
cargo clippy --all-targets -- -D warnings exit 0
cargo test      exit 0 (135 passed; 0 failed; 2 ignored)
npm run check   exit 0
```

## Screenshots

WebKit, 1280x800, `?scenario=running`:

- `docs/plan/iterations/pr/wo-0.3/containers-light.png`
- `docs/plan/iterations/pr/wo-0.3/containers-dark.png`

There is no `design/shots/` directory in the repository at this commit, so there is no mockup picture to compare against and no match is claimed. The screens still show the old, unstyled markup, with no cards, colour or shadows; iterations 2 and 3 rebuild them. The dark picture was taken by adding the existing `.dark` class to the root, because the app has no theme switch yet.

## Not done or changed from the work order

Nothing.

## Found on the way

None.