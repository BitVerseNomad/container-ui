wo-1.5: a check compares each screen with the mockup

## What changed

`scripts/check-mockup.mjs` compares a screen rendered by the app with its mockup picture in WebKit at 1280x800, pixel by pixel, and reports the share of differing pixels. The pairs live in `scripts/mockup-pairs.json`, which starts empty (`[]`) so the check passes with "no pairs yet" until a screen work order adds a row. The `design` scenario is added to `preview/mock.ts` with fixed values only (no random, no clock), and `src/lib/designScenario.test.ts` asserts it names the mockup's containers, volumes and networks.

## Steps done

- [x] Step 1: `npm install --save-dev pixelmatch@^7 pngjs@^7`.
- [x] Step 2: created `scripts/mockup-pairs.json` with `[]` and a newline.
- [x] Step 3: created `scripts/check-mockup.mjs` exactly as given (WebKit only, exits early in other engines and when there are no pairs).
- [x] Step 4: added the `design` scenario to `preview/mock.ts` in one constant named `DESIGN`, placed last, with the machine, 10 containers, 5 images, 5 volumes and 4 networks from the mockup table, using fixed ids and no `Math.random()` or the clock.
- [x] Step 5: added `src/lib/designScenario.test.ts` (node --test) asserting `kafka-ui`, `report-job`, `scratch-postgres`, `pgdata-old` and `devnet` appear after the first line containing `"design"`; it passes.
- [x] Step 6: set `mockup-pairs.json` to one `containers` pair, ran `PW_ENGINE=webkit node scripts/check-mockup.mjs` against the running preview, got `FAIL mockup: containers-light differs by 6.19% (allowed 0.5%)` and exit 1 (the Containers screen is not rebuilt yet), then restored `mockup-pairs.json` to `[]`.

## Evidence

Done when:

```text
$ cat scripts/mockup-pairs.json
[]

$ PW_ENGINE=webkit node scripts/check-mockup.mjs
ok mockup: no pairs yet

$ PW_ENGINE=chromium node scripts/check-mockup.mjs
ok mockup: compared in WebKit only, skipped in this engine

$ grep -c '"design"' preview/mock.ts
2
```

Step 6 proof (mockup-pairs.json temporarily held one containers pair):

```text
ok mockup: containers says why its threshold is above 2%
FAIL mockup: containers-light differs by 6.19% (allowed 0.5%)
```
exit 1, then `mockup-pairs.json` restored to `[]`.

Gate on the branch:

```text
npm ci: exit 0
npm run lint: 0 errors, 33 warnings
npx tsc --noEmit: exit 0
npm test: node tests pass, vitest Test Files 40 passed (40), Tests 170 passed (170)
cargo: 135 passed; 0 failed; 2 ignored
npm run check: all lines 0 (check-mockup.mjs runs in both engines)
```

## Screenshots

Nothing on screen changes; nothing to capture.

## Not done or changed from the work order

Nothing. `mockup-pairs.json` is intentionally left at `[]` (no screen row yet).

## Found on the way

Nothing new; `docs/plan/FOUND.md` keeps its three earlier entries.
