# Tailwind migration and finishing iteration 2

Owner decision, 2026-11-15: OpenPier moves to Tailwind CSS v4. The look stays "Manifest" (`docs/plan/design/04-design-spec.md` and the mockups). Only the way styles are written changes.

Done means one command prints `0 FAIL`:

```
sh docs/plan/iterations/verify-tailwind.sh
```

The implementer runs inside `docs/plan/iterations/run-until-green.sh`. The loop decides when the work is over, not the agent.

## Rules for every step

1. One branch per step, named `wo-tw-<n>`. Merge into `main` with `git merge --no-ff`. Never commit on `main` directly.
2. Never edit these files: `docs/plan/iterations/verify-tailwind.sh`, `docs/plan/iterations/verify-iteration-2.sh`, `docs/plan/iterations/run-until-green.sh`, this file, any `scripts/check-*.mjs`, `scripts/lib/`, any file under `docs/plan/design/` except `openpier.css`. The loop stops if they change.
3. Never rename, skip or delete a test. Never add `.skip` or `.only`.
4. Keep component APIs in `src/ui/op/` the same (props and names). Screens keep importing from `./ui/op`.
5. When you change `src/ui/openpier.css`, copy it over `docs/plan/design/openpier.css` in the same commit (the two must stay equal).
6. Colours, sizes, radii, shadows and fonts come from the tokens only. No hex, no `px`, no arbitrary values like `bg-[#123456]` or `p-[13px]`, no Tailwind palette colours like `bg-blue-500`. A grid template may be arbitrary (`grid-cols-[1fr_auto]`).
7. Every step ends with `sh docs/plan/iterations/verify-tailwind.sh` run with the preview on port 4173 (`npm run preview`). Paste its last 5 lines in `docs/plan/iterations/pr/wo-tw-<n>.md`.
8. A FAIL is never "pre-existing" or "out of scope". If it prints FAIL, it is your work. Find the cause and fix it.

## Steps

### WO-TW-1 Tailwind in, nothing changes on screen

1. `npm install -D tailwindcss@4 @tailwindcss/vite@4`.
2. Add the `@tailwindcss/vite` plugin to `vite.config.ts` and `vite.preview.config.ts`.
3. New file `src/ui/tailwind.css`:
   1. `@import "tailwindcss";`
   2. One `@theme inline` block that maps every token of `src/ui/openpier.css` section 1 (`:root`) to a Tailwind name: colours as `--color-<token>: var(--<token>);` (example `--color-bg-raised: var(--bg-raised);`), radii as `--radius-*`, shadows as `--shadow-*`, font families as `--font-*`, font sizes as `--text-*`, spacing steps as `--spacing-*`.
   3. Turn the built-in palette off: `--color-*: initial;` at the top of the `@theme` block, before the mappings.
4. Import `src/ui/tailwind.css` in `src/main.tsx` before `openpier.css`. Both stay for now.
5. Proof: `check-mockup` passes in WebKit and Chromium (the screen did not change).

### WO-TW-2 The building blocks in `src/ui/op/` use Tailwind

1. One component at a time, in this order: Button, Field, Select, Checkbox, Switch, Tabs, Chip, Dot, Sev, Tile, Row, Menu, Tooltip, Sheet, ConfirmDialog, Toast, Banner, Empty, Problem, Progress, Meters, Sparkline, Facts, Inspector, Canvas, Command, Palette, NavItem, GroupCaption, EngineButton, Blocks, SkeletonRows, Icon, Portal.
2. For each: replace its `openpier.css` classes with Tailwind utilities that give the same result. Variants go in a small `const variants = { ... }` map, joined with `cn()` from `tailwind-merge`.
3. Delete the matching rules from `src/ui/openpier.css` only when no file in `src/` uses that class any more (`git grep -n "<class>" src`).
4. After every component: `npx vitest run src/ui/op` and `check-mockup` in WebKit. A screen that looks different is a FAIL.

### WO-TW-3 The screens use Tailwind

1. Every `className` in `src/*.tsx` and `src/containers/*.tsx` that still names an `openpier.css` class moves to Tailwind utilities or to a `src/ui/op` component.
2. No `style=`, no raw `<button>`, `<select>` or `<table>` in screen files. Use the `ui/op` components.

### WO-TW-4 `openpier.css` keeps only tokens

1. `src/ui/openpier.css` ends with the tokens only: `:root`, the dark theme block, `@media (prefers-color-scheme)` and `@media (prefers-reduced-motion)`, and base rules on `html`, `body`, `*`. No `.class` selector left.
2. Copy it over `docs/plan/design/openpier.css` and change its header comment to: "OpenPier design tokens. Components style themselves with Tailwind utilities mapped to these tokens in src/ui/tailwind.css."

### WO-TW-5 Every FAIL of iteration 2 is fixed

1. Run the verify script and fix each FAIL, one cause per branch (`wo-tw-5a`, `wo-tw-5b`, ...).
2. Group first: write every FAIL line and its cause in `docs/plan/iterations/pr/wo-tw-5.md`, then fix the cause behind the most lines first.
3. Text checks (for example "Choose a folder…" with the single ellipsis character) mean the screen must show that exact text.
4. Missing pull request texts: write the file for that work order, describing what is on `main`.

### WO-TW-6 The plan says Tailwind

1. `docs/plan/04-design-spec.md`: replace the line that says the app ships `openpier.css` as its stylesheet with: tokens in `openpier.css`, utilities through Tailwind v4 (`src/ui/tailwind.css`).
2. `docs/plan/HANDOFF.md`: same change where it lists the design files.

## What changed in the checks (written by the owner's planner, not the implementer)

`verify-tailwind.sh` runs `verify-iteration-2.sh` and drops three lines that belonged to the old stylesheet:
1. "every class used is defined (check-classes)". Tailwind classes are not in a CSS file.
2. "design stylesheet equals the plan's (check-design-sync)". Replaced by: the token blocks of both files are equal.
3. "design files unchanged (SHA256SUMS)". Replaced by: every design file except `openpier.css` is unchanged.

Then it adds the Tailwind checks. Everything else from iteration 2 still has to pass.
