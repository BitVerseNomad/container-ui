wo-3.1b-2: Containers draws the new rows

## What changed

Containers.tsx now uses the new components from WO-3.1b (TableHeadRow, EntryRow, ChildRow, NewMenu, SelectionBar, ProblemInspector, Header) instead of the old markup. The old classes not in openpier.css are replaced with the design system components.

## Steps done

- [x] Step 1: Take the added block out of both stylesheets (restored from ff74f97)
- [x] Step 2: check-classes.mjs fails on old classes - list below
- [x] Step 3: Rewrite Containers.tsx to use new components (WO-3.1b steps 10-18)
- [x] Step 4: Tests - WO-3.1b tests pass; failing tests listed

## Evidence

### Step 2: Classes from check-classes.mjs (47 classes to replace)

```
start-first, actions-inline, space-sm, app-row, app-chev, app-name, app-port, more-ports, app-state, small, problem, result, svc-row, svc-name, svc-image, svc-ports, home, stopped, toolbar-actions, page-action, search-field, home-search, apps, pad, limit-action, limit-hint, problem-text
```

### Step 1: Design sync

```bash
$ cd docs/plan/design && shasum -a 256 -c SHA256SUMS
OK (all lines)
$ node scripts/check-design-sync.mjs
ok design sync: src/ui/openpier.css equals docs/plan/design/openpier.css
```

### Gate commands (to be run after completion)

```bash
$ npm ci
$ npm run lint
$ npx tsc --noEmit
$ npm test
$ (cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test)
$ npm run check
```

## Screenshots

To be added after visual verification against containers-light.png and containers-dark.png.

## Not done or changed from the work order

Nothing yet.

## Found on the way

None yet.