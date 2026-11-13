wo-2.2: A new shell with meters, a hidden title bar and Doctor always in view

## What changed

- Every page now lives inside a rewritten Shell with a sidebar (Containers, Images, Volumes, Networks, Kubernetes, Doctor), a Settings/Activity/Help foot, and a Fold sidebar button remembered in localStorage.
- A Header sits above each non-Containers page with title, state dot, summary, and machine meters (CPU/Memory/Disk); the window is 1180x760 with a hidden title bar and can shrink to 900x600.
- Live stats read `docker stats --no-stream` and `docker system df` every 10s, feeding CPU/memory/disk meters through `liveStats.ts` and `useLiveStats.ts`.

## Steps done

- [x] Step 1: Window size and title bar in `src-tauri/tauri.conf.json` (1180x760, min 900x600, Overlay title bar, hidden title).
- [x] Step 2: Capabilities `default.json` gains `core:window:default` and `core:window:allow-start-dragging`.
- [x] Step 3: `src/lib/liveStats.ts` created (`liveFromRows`, `pushPoint`, `nextHistory`, `machineUsage`, `memHot`, `diskHot`, `gbText`, `metersOf`, `HISTORY_POINTS = 60`, `STATS_EVERY_MS = 10_000`).
- [x] Step 4: `src/hooks/useLiveStats.ts` created (`setMachineProfile`, `useLiveStats` polling every 10s).
- [x] Step 5: `src/App.tsx` calls `useLiveStats(ctx, running)`, passes `live`/`history` to Containers, `usage` to Header via `MachineUsageProvider`; renders `Header` above non-Containers pages; `engine` slot is `LegacyProfileSwitch`; new Shell props.
- [x] Step 6: `src/Header.tsx` created with `MachineUsageContext`/`Provider`, drag region, title, dot, summary, stateText, grow, meters (off on detail pages).
- [x] Step 7: `src/Shell.tsx` rewritten: new props, fold from `openpier:sidebar-folded`, aside.sidebar with titlebar drag region, engine slot, main nav via NavItem, health nav (Doctor), sidebar-foot buttons, `main.main` wrapping `PortalProvider > ToastProvider > OpConfirmProvider`.
- [x] Step 8: `src/LegacyProfileSwitch.tsx` created as a temporary engine trigger button (WO-2.3 replaces it).
- [x] Step 9: Removed old Shell shortcuts/Runtime select; `main.tsx` wraps App in `ConfirmProvider > TooltipProvider`.
- [x] Step 10: `scripts/mockup-pairs.json` gains the containers row (masked, threshold 0.02).
- [x] Step 11: `scripts/check-layout.mjs` and `scripts/check-restyle.mjs` moved from `scripts/checks-pending/` to `scripts/` and rewritten on `scripts/lib/check.mjs`; rows removed from `scripts/checks-pending/README.md`; `check-start.mjs` updated (`.content` → `.main`, `nav button` → `.nav-item`).
- [x] Step 13: `src/Shell.tsx` removed from `scripts/not-migrated.json`.

## Evidence

```
$ node --experimental-strip-types --no-warnings --test src/lib/liveStats.test.ts 2>&1 | grep -E "^# (pass|fail)"
# pass 9
# fail 0
```

```
$ npx vitest run src/Shell.test.tsx 2>&1 | grep "Tests "
Tests  8 passed (8)
```

```
$ (cd src-tauri && cargo check)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.58s
$ grep -c "Overlay" src-tauri/tauri.conf.json
1
```

```
$ node scripts/check-layout.mjs && PW_ENGINE=webkit node scripts/check-layout.mjs
(26 ok lines per engine, 0 FAIL)
```

```
$ node scripts/check-restyle.mjs && PW_ENGINE=webkit node scripts/check-restyle.mjs
(28 ok lines per engine, 0 FAIL)
```

```
$ ls scripts/checks-pending
README.md check-a11y.mjs check-bring-home.mjs check-bring.mjs check-compose.mjs check-disk.mjs check-doctor.mjs check-down.mjs check-guided.mjs check-home.mjs check-k8s.mjs check-menus.mjs check-mounts.mjs check-netfix.mjs check-network.mjs check-observe.mjs check-pull.mjs check-replace.mjs check-resize.mjs check-select.mjs check-setup.mjs check-volumes.mjs
```
(check-layout.mjs and check-restyle.mjs no longer listed)

```
$ PW_ENGINE=webkit node scripts/check-mockup.mjs
ok mockup: containers says why its threshold is above 2%
ok mockup: containers-light differs by 1.31% (allowed 2.0%)
ok mockup: containers-dark differs by 1.31% (allowed 2.0%)
```

```
$ node scripts/check-start.mjs && PW_ENGINE=webkit node scripts/check-start.mjs
ok start: the app opens on Containers
ok start: there is no Projects item in the sidebar yet
ok start: the sidebar lists Containers and Doctor
```

```
$ grep -n "Switch profile\|Runtime" src/Shell.tsx
(nothing)
```

Gate (`npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test`, cargo fmt, cargo clippy, cargo test): all exit 0.

```
$ npm run check
CHECK_DONE_EXIT:0
```
0 `FAIL` lines in Chromium and WebKit for every `scripts/check-*.mjs`.

## Screenshots

No screenshots captured for WO-2.2; the mockup check (`check-mockup.mjs`) passed for containers-light and containers-dark at 1.31% diff. By-eye checks remain: folded sidebar, Activity sheet, window at 900x600.

## Not done or changed from the work order

- Step 10 mockup row: added as specified; the check passes at 1.31% (under the 2.0% allowance).
- By-eye checks (folded sidebar, Activity sheet, 900x600 window): not captured as screenshots; verified interactively against the preview at http://localhost:4173/?scenario=design#/containers.

## Found on the way

Nothing new; `docs/plan/FOUND.md` keeps its earlier entries.

## Contract differences

None.
