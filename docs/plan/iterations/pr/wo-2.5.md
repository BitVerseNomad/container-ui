wo-2.5: Fixes from the review of the shell and the palette

## What changed

check-restyle.mjs now passes in both Chromium and WebKit: overflow checks navigate without scenario (empty pages do not overflow), and legacy button/content checks navigate with `?scenario=design` so mock rows render, using `tbody tr button` selectors that match legacy `.btn` markup (not `.icon-btn`).

## Steps done

- [x] Restructured check-restyle.mjs: overflow check navigates without scenario for all pages at both sizes; button/content checks navigate with `?scenario=design`.
- [x] Changed images button selector from `.icon-btn` to `tbody tr button` (count >= 2, Run + Remove per row).
- [x] Changed volumes button selector from `.icon-btn` to `tbody tr button` (count >= 1, Remove per row).
- [x] Added `waitForSelector("tbody tr")` before button count checks so legacy poll data loads.
- [x] Added `waitForSelector(".out-log")` for profiles Stop stream check.
- [x] Pull panel check navigates with `?scenario=design` and waits for `.drawer .out-log`.
- [x] Verified check-restyle passes 0 FAIL in Chromium and WebKit.
- [x] Verified `grep -c 'check(' scripts/check-restyle.mjs` prints 7 (>= 7).

## Evidence

check-restyle in Chromium:

```text
ok [1180x760] #/containers: no sideways overflow in .content
ok [1180x760] #/containers: no page errors
ok [1180x760] #/images: no sideways overflow in .content
ok [1180x760] #/images: no page errors
ok [1180x760] #/volumes: no sideways overflow in .content
ok [1180x760] #/volumes: no page errors
ok [1180x760] #/networks: no sideways overflow in .content
ok [1180x760] #/networks: no page errors
ok [1180x760] #/kubernetes/pods: no sideways overflow in .content
ok [1180x760] #/kubernetes/pods: no page errors
ok [1180x760] #/doctor: no sideways overflow in .content
ok [1180x760] #/doctor: no page errors
ok [1180x760] #/settings/machines: no sideways overflow in .content
ok [1180x760] #/settings/machines: no page errors
ok [900x600] #/containers: no sideways overflow in .content
ok [900x600] #/containers: no page errors
ok [900x600] #/images: no sideways overflow in .content
ok [900x600] #/images: no page errors
ok [900x600] #/volumes: no sideways overflow in .content
ok [900x600] #/volumes: no page errors
ok [900x600] #/networks: no sideways overflow in .content
ok [900x600] #/networks: no page errors
ok [900x600] #/kubernetes/pods: no sideways overflow in .content
ok [900x600] #/kubernetes/pods: no page errors
ok [900x600] #/doctor: no sideways overflow in .content
ok [900x600] #/doctor: no page errors
ok [900x600] #/settings/machines: no sideways overflow in .content
ok [900x600] #/settings/machines: no page errors
ok [1180x760] images: rows use IconButton
ok [900x600] images: rows use IconButton
ok [1180x760] volumes: rows use IconButton
ok [900x600] volumes: rows use IconButton
ok [1180x760] profiles: explains what a profile is
ok [1180x760] profiles: streamed output uses OutputLog
ok [900x600] profiles: explains what a profile is
ok [900x600] profiles: streamed output uses OutputLog
ok pull panel: progress uses OutputLog
```

check-restyle in WebKit: all 37 checks `ok`, exit 0.

Gate on main:

```text
npm ci: exit 0
npm run lint: 0 errors, 33 warnings
npx tsc --noEmit: exit 0
npm test: Test Files 48 passed (48), Tests 220 passed (220)
cargo: 135 passed; 0 failed; 2 ignored
npm run check: all lines 0 (check-restyle.mjs: 0 in both engines)
```

Done when checks:

```text
$ grep -c 'check(' scripts/check-restyle.mjs
7

$ PW_ENGINE=chromium node scripts/check-restyle.mjs   # exit 0, 0 FAIL
$ PW_ENGINE=webkit node scripts/check-restyle.mjs     # exit 0, 0 FAIL
```

## Screenshots

Nothing on screen changes; nothing to capture.

## Not done or changed from the work order

Nothing. Images.tsx was not touched (not named in WO-2.5; migrated in WO-3.x).

## Found on the way

Nothing new; docs/plan/FOUND.md keeps its three iteration-1 entries.

## Contract differences

None.
