wo-2.1: Every page has an address, and back and forward work

## What changed

Every page now has a hash address (`#/containers`, `#/images`, ...), so back, forward, reload and links work. Cmd+[ and Cmd+] navigate back and forward. The old `useState` tab in `App.tsx` is replaced by a route kept in `localStorage` and synced to the address bar.

## Steps done

- [x] Step 0: contract check (`npx tsc --noEmit` prints nothing; `src/ui/op/index.ts` exports 32 names)
- [x] Step 1: tests written first; `npm test` failed with "Cannot find module" until the new files existed
- [x] Step 2: created `src/lib/routes.ts` (`parseRoute`, `buildPath`, `DETAIL_TABS`, `PAGE_TABS`, `DEFAULT_PATH`)
- [x] Step 3: created `src/lib/router.ts` (`useRoute`, `go`, `replace`, last-route storage)
- [x] Step 4: edited `src/App.tsx` (route imports, `useRoute` tab state, `setTab` navigates, Cmd+[ / Cmd+] shortcuts)
- [x] Step 5: created `src/lib/tabRoutes.ts` (Tab <-> route mapping)
- [x] Step 6: added Cmd+[ "Back" and Cmd+] "Forward" to `keyboardShortcuts`
- [x] Step 7: `src/main.tsx` still renders the gallery for `#/dev/gallery` before `<App/>` (line 10)

## Evidence

```text
$ node --experimental-strip-types --no-warnings --test src/lib/routes.test.ts
# tests 12
# pass 12
# fail 0
```

```text
$ npx vitest run src/lib/router.test.tsx
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

```text
$ grep -n "useState<Tab>" src/App.tsx
(nothing)
```

Gate (`npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test`, cargo fmt, cargo clippy, cargo test): all exit 0.

```text
$ npm run check
CHECK_DONE_EXIT:0
```
0 `FAIL` lines in Chromium and WebKit for every `scripts/check-*.mjs`.

Preview (http://localhost:4173): `#/images` shows Images; browser back goes to the empty hash, forward returns to `#/images`; reload on `#/volumes` shows Volumes.

## Screenshots

Nothing on screen changes except the address bar; nothing to capture.

## Not done or changed from the work order

Nothing.

## Found on the way

Nothing new; `docs/plan/FOUND.md` keeps its three earlier entries.

## Contract differences

None.
