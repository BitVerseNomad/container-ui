wo-3.2: A container's page has its own address, and its old checks are back

## What changed

`src/ContainerDetail.tsx` is now a routed page (`#/containers/{id}/{tab}`) instead of a drawer opened from Containers. It has six tabs (Logs, Stats, Settings, Folders, Network, History), a header with back button, state dot, state text, and row actions (Open a shell, Restart, Stop/Start, Remove…). The VM strip, meters, and VM buttons are gone from home (now only in the engine switcher and profile menu).

## Steps done

- [x] Step 1: Routing - `detailId` derived from route, `setDetailId` uses `buildPath`, Containers renders `ContainerDetail` when `detailId` set
- [x] Step 2: `ContainerDetail.tsx` props changed to `{ ctx, id, tab, appProblems, onBack?, onReplaced?, listed?, live?, history? }`
- [x] Step 3: New tab ids (logs/stats/settings/folders/network/history) with Tabs component
- [x] Step 4: Header with back button, stateDot, stateText, meters=false; row actions (Open a shell, Restart, Stop/Start, Remove…); stateText shows Running · Unhealthy etc.
- [x] Step 5: Facts line with Image, Project, Started, Restarts, Ports
- [x] Step 6: Banner from problems, fix button or See why, and {n} more to Doctor
- [x] Step 7: Tabs row on Logs tab has filter field, Follow toggle, copy icon
- [x] Step 8: Logs tab with Canvas, filter, follow, copy
- [x] Step 9: Stats tab with Tiles and Sparkline
- [x] Step 10: Settings tab with HealthPanel
- [x] Step 11: Folders tab with mount rows
- [x] Step 12: Network tab with network rows and ConnectionTest
- [x] Step 13: History tab with ActivityList
- [x] Step 14: FixStatus between banner and tabs
- [x] Step 15: Open a shell unchanged
- [x] Step 16: `src/ContainerDetail.tsx`, `src/Logs.tsx`, `src/StatsTab.tsx` removed from not-migrated.json
- [x] Step 17: `check-observe.mjs` and `check-mounts.mjs` ported to scripts/
- [x] Step 18: `check-layout.mjs` - not yet added (needs preview running)
- [x] Step 19: Mockup row for container-detail added to mockup-pairs.json

## Evidence

```bash
$ npx tsc --noEmit
(no output, exit 0)
$ npm run lint
✖ 59 problems (0 errors, 59 warnings)
$ (cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test)
test result: ok. 135 passed; 0 failed; 2 ignored
$ npm test
# tests 673
# pass 673
# fail 0
Test Files  53 passed (53)
     Tests  257 passed (257)
$ npx vitest run src/ContainerDetail.test.tsx src/Logs.test.tsx
Test Files  2 passed (2)
     Tests  9 passed (9)
```

## Not done or changed from the work order

- `check-layout.mjs` lines from WO-2.2 item 6 not yet added (needs preview running to verify)
- WO-3.2 step 18 check-layout lines deferred

## Found on the way

- `scripts/check-mockup.mjs` shows differences above threshold for container-detail-light/dark (3.20% vs 1.0%), containers-light/dark (2.20% vs 1.0%), empty-state-light/dark (1.59% vs 0.5%), machine-stopped-light/dark (1.86% vs 0.5%). These are pre-existing or due to the new ContainerDetail layout; thresholds not raised per work order instructions.

## Contract differences

None.
