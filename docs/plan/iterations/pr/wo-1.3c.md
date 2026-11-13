wo-1.3c: a gallery shows every component, and lint keeps screens on them

## What changed

There is now a development gallery page (`/#/dev/gallery`) that shows every new component in light and dark. A new lint guard stops new screens from importing the old `src/ui` components directly. New scripts: `check-not-migrated` (the not-migrated list may only shrink) and `check-gallery` (the gallery opens and lists each section in both themes).

## Steps done

- [x] Step 1: created `src/dev/Gallery.tsx` with one `.group-cap` section per `src/ui/op` component and all variants and states from WO-1.3a and WO-1.3b.
- [x] Step 2: created `src/vite-env.d.ts`; replaced the render call in `src/main.tsx` so `#/dev/gallery` renders the gallery in development only.
- [x] Step 3: generated `scripts/not-migrated.json` (71 paths, sorted).
- [x] Step 4: created `scripts/check-not-migrated.mjs`; it exits 0.
- [x] Step 5.1-5.2: added `import fs from "node:fs"`, `notMigrated`, and the `src/**/*.tsx` block with the regex `no-restricted-imports` pattern to `eslint.config.js`.
- [x] Step 5.3: probe `src/dev/Probe.tsx` gave exactly the two expected errors (`Use <Button>`, `No inline styles`); the gallery import is no longer flagged; probe deleted.
- [x] Step 6: created `scripts/check-gallery.mjs`; it passes in Chromium and WebKit (`check-gallery: 0`).
- [x] Step 7: attached `gallery-light.png` and `gallery-dark.png` (WebKit, 1280x800, full page); reviewer to compare; no match claimed.

## Evidence

Done when:

```text
$ node scripts/check-not-migrated.mjs | grep -c "^FAIL"
0

$ node -e 'console.log(require("./scripts/not-migrated.json").length)'
71

$ npm run lint; echo "exit $?"
exit 0
```

Probe output (`npm run lint`, exit 1 with the probe):

```text
src/dev/Probe.tsx
  1:28  error  Use <Button> from src/ui/op                        no-restricted-syntax
  1:36  error  No inline styles. Use a class from the stylesheet  no-restricted-syntax

✖ 35 problems (2 errors, 33 warnings)
```

Gallery check (WebKit and Chromium):

```text
webkit scripts/check-gallery.mjs: 0
chromium scripts/check-gallery.mjs: 0
```

Gate on the branch:

```text
npm ci: exit 0
npm run lint: 0 errors, 33 warnings
npx tsc --noEmit: exit 0
npm test: Test Files 40 passed (40), Tests 170 passed (170)
cargo: 135 passed; 0 failed; 2 ignored
npm run check: all lines 0
```

## Screenshots

- `docs/plan/iterations/pr/wo-1.3c/gallery-light.png` (WebKit, 1280x800)
- `docs/plan/iterations/pr/wo-1.3c/gallery-dark.png` (WebKit, 1280x800, `data-theme="dark"`)

No `docs/plan/design/shots/gallery-*` exists, so no match claim; say they differ from any mockup picture.

## Not done or changed from the work order

The probe was deleted after it proved the guard works, as the work order says. Nothing else.

## Found on the way

Nothing new; `docs/plan/FOUND.md` keeps its three earlier entries.
