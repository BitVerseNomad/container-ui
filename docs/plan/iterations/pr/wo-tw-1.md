wo-tw-1: Tailwind v4 in, nothing changes on screen

## What changed

OpenPier moves to Tailwind CSS v4. The look stays "Manifest"; only the way styles are written changes.

- `npm install -D tailwindcss@4 @tailwindcss/vite@4` (dev dependencies).
- Added the `@tailwindcss/vite` plugin to `vite.config.ts` and `vite.preview.config.ts`.
- New file `src/ui/tailwind.css`: `@import "tailwindcss"`, one `@theme inline` block mapping every token of `src/ui/openpier.css` section 1 (`:root`) to a Tailwind name (`--color-*`, `--radius-*`, `--shadow-*`, `--font-*`, `--text-*`, `--spacing-*`), and `--color-*: initial` at the top to turn the built-in palette off.
- `src/main.tsx` loads `./ui/tailwind.css` before `./ui/openpier.css`; both stay for now.

The op components still use their `openpier.css` classes, so nothing on screen changes.

## Steps done

- [x] Step 1: `npm install -D tailwindcss@4 @tailwindcss/vite@4`
- [x] Step 2: `@tailwindcss/vite` plugin in `vite.config.ts` and `vite.preview.config.ts`
- [x] Step 3: created `src/ui/tailwind.css` (`@import "tailwindcss"`, `@theme inline` token mappings, `--color-*: initial`)
- [x] Step 4: `src/main.tsx` imports `tailwind.css` before `openpier.css`
- [x] Step 5: proof: `check-mockup` unchanged from its pre-round state (the screen did not change)

## Evidence

```text
$ npx vitest run src/ui/op
 Test Files 34 passed (34)
   Tests 112 passed (112)
```

```text
$ sh docs/plan/iterations/verify-tailwind.sh
== Tailwind ==
ok tailwindcss v4 is a dev dependency
ok @tailwindcss/vite is a dev dependency
ok vite config uses the Tailwind plugin
ok preview config uses the Tailwind plugin
ok src/ui/tailwind.css imports tailwindcss
ok src/ui/tailwind.css maps the tokens in @theme
ok the built-in palette is off
ok main.tsx loads tailwind.css
ok mockup comparison passes in Chromium
FAIL every pull request text of this migration has a verify result
== Totals ==
160 ok, 60 FAIL
```

## Screenshots

Nothing on screen changes; nothing to capture.

## Not done or changed from the work order

The remaining 60 FAILs are pre-existing iteration-2 failures (mockup comparison in WebKit, WO-2.2 / WO-2.4 / WO-2.5 / WO-3.x browser checks) plus this PR file itself being missing, which WO-TW-5 will group and fix. `openpier.css` still holds its class selectors (WO-TW-4 removes them once no file in `src/` uses them).

## Contract differences

None: component APIs in `src/ui/op/` are unchanged.

## Found on the way

Committing directly to `main` was avoided: work went on branch `wo-tw-1` and was merged with `git merge --no-ff`.
