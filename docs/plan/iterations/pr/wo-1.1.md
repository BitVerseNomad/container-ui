wo-1.1: the app ships the design's stylesheet and nothing else

## What changed

The app looks worse after this change. Screens lose their old styling until iterations 2 and 3 rebuild them. This is planned.
`src/ui/container-ui.css` is now the only stylesheet, copied unchanged from `docs/plan/design/container-ui.css`.
Tailwind and the bundled fonts are gone; the design uses system fonts.

## Steps done

- [x] 1. Copied `docs/plan/design/container-ui.css` to `src/ui/container-ui.css`.
- [x] 2. Replaced the two imports in `src/main.tsx` with `import "./ui/container-ui.css";`.
- [x] 3. Removed the `Shell.css` import from `src/Shell.tsx` and the `home.css` import from `src/Containers.tsx`.
- [x] 4. Deleted `src/styles.css`, `src/home.css`, `src/Shell.css` and `src/ui/tokens.css`.
- [x] 5. Uninstalled `tailwindcss`, `@tailwindcss/vite`, `@fontsource/inter` and `@fontsource/jetbrains-mono`.
- [x] 6. Removed the Tailwind import and plugin from `vite.config.ts`.
- [x] 7. Created `scripts/check-design-sync.mjs`.
- [x] 8. Ran `npm run check`. Every check passed, so none moved to `scripts/checks-pending/`.
- [x] 9. This section starts with the required sentence about the planned worse look.

## Evidence

Done when checks:

```text
$ grep -rn 'import .*\.css' src | grep -v test
src/main.tsx:6:import "./ui/container-ui.css";
```

```text
$ find src -name "*.css"
src/ui/container-ui.css
```

```text
$ grep -c "tailwindcss\|fontsource" package.json
0
```

```text
$ node scripts/check-design-sync.mjs
ok design sync: src/ui/container-ui.css equals docs/plan/design/container-ui.css
```

```text
$ npm run build; echo "exit $?"
✓ built in 1.40s
exit 0
```

```text
$ npm run check
== chromium
chromium scripts/check-design-sync.mjs: 0
chromium scripts/check-entitlements.mjs: 0
chromium scripts/check-icon.mjs: 0
chromium scripts/check-start.mjs: 0
chromium scripts/check-version-sync.mjs: 0
== webkit
webkit scripts/check-design-sync.mjs: 0
webkit scripts/check-entitlements.mjs: 0
webkit scripts/check-icon.mjs: 0
webkit scripts/check-start.mjs: 0
webkit scripts/check-version-sync.mjs: 0
```

Gate (all exit 0):

```text
$ npm ci
12 vulnerabilities (9 moderate, 1 high, 2 critical)
ci=0
```

```text
$ npm run lint
✖ 33 problems (0 errors, 33 warnings)
lint=0
```

```text
$ npx tsc --noEmit
tsc=0
```

```text
$ npm test
 Test Files  8 passed (8)
      Tests  79 passed (79)
test=0
```

```text
$ cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
test result: ok. 135 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 3.27s
cargo=0
```

```text
$ npm run check
== chromium
chromium scripts/check-design-sync.mjs: 0
chromium scripts/check-entitlements.mjs: 0
chromium scripts/check-icon.mjs: 0
chromium scripts/check-start.mjs: 0
chromium scripts/check-version-sync.mjs: 0
== webkit
webkit scripts/check-design-sync.mjs: 0
webkit scripts/check-entitlements.mjs: 0
webkit scripts/check-icon.mjs: 0
webkit scripts/check-start.mjs: 0
webkit scripts/check-version-sync.mjs: 0
check=0
```

## Screenshots

WebKit, 1280x800, from `npm run preview` at `http://localhost:4173/?scenario=running`.
Dark is the same screen with `data-theme="dark"` set on the root element, because the app has no theme switch yet.

- `containers-light.png`, next to `docs/plan/design/shots/containers-light.png`.
- `containers-dark.png`, next to `docs/plan/design/shots/containers-dark.png`.

What differs: everything. The app still uses the old markup and class names, so the design stylesheet only reaches the parts that happen to share names. The sidebar sits above the content instead of beside it, the header is missing, the list is not a table, and there are no state colours, ports, meters or row actions. The mockup shows the target design. No match is claimed, and `scripts/check-mockup.mjs` does not exist yet (WO-1.5 creates it).

## Not done or changed from the work order

- No checks moved to `scripts/checks-pending/`. All checks passed after the change, including `check-start.mjs`.

## Found on the way

Nothing.