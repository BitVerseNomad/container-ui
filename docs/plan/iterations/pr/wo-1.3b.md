wo-1.3b: rows, menus, sheets and dialogs exist and work by keyboard

## What changed

Rows, problem lines, menus, sheets, confirm dialogs, toasts, block bars, machine meters, sparklines and the problem inspector now exist as shared pieces built on the design classes.
They work by keyboard: arrows move between rows, Enter opens, Space selects, Left and Right fold groups, and Escape closes sheets and dialogs.
No screen uses them yet. The gallery and the guards arrive with WO-1.3c.

## Steps done

- [x] Step 11 first, as the work order asks: `Portal.tsx`, with `PortalProvider` and `usePortalContainer`.
- [x] Step 1: `Row.tsx`, with `List`, `RowHead`, `Row`, `Col`, `Dim` and `Members`.
- [x] Step 2: `Problem.tsx`.
- [x] Step 3: `Menu.tsx`, with `MenuItem`, `MenuSeparator`, `MenuCaption` and `MoreButton`.
- [x] Step 4: `Sheet.tsx`.
- [x] Step 5: `ConfirmDialog.tsx`, with `ConfirmProvider` and `useConfirm`.
- [x] Step 6: `Toast.tsx`, with `ToastProvider` and `useToast`.
- [x] Step 7: `Blocks.tsx`.
- [x] Step 8: `Meters.tsx`.
- [x] Step 9: `Sparkline.tsx`.
- [x] Step 10: `Inspector.tsx`.
- [x] Added every file to `src/ui/op/index.ts`.

## Evidence

Done when:

```text
$ ls src/ui/op/*.tsx | grep -vc test
32

$ npm test 2>&1 | grep -E "Test Files|Tests "
 Test Files  40 passed (40)
      Tests  170 passed (170)

$ grep -rnE "style=" src/ui/op --include="*.tsx" | grep -v test
src/ui/op/Meters.tsx:16:          style={{ "--v": `${Math.round(meter.share * 100)}%` } as React.CSSProperties}
```

Every test file for these components failed before the components existed, because the module did not resolve. The failing tests were committed in `8052d00`.

Gate:

```text
$ npm ci
12 vulnerabilities (9 moderate, 1 high, 2 critical)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
exit 0

$ npm run lint
  148:6  warning  React Hook useCallback has a missing dependency: 'onClose'. Either include it or remove the dependency array. If 'onClose' changes too often, find the parent component that defines it with useCallback  react-hooks/exhaustive-deps

✖ 33 problems (0 errors, 33 warnings)
  0 errors and 3 warnings potentially fixable with the `--fix` option.
exit 0

$ npx tsc --noEmit
(no output)
exit 0

$ npm test
 ✓ src/ui/op/Sev.test.tsx (1 test) 14ms

 Test Files  40 passed (40)
      Tests  170 passed (170)
exit 0

$ (cd src-tauri && cargo fmt --check)
(no output)
exit 0

$ (cd src-tauri && cargo clippy --all-targets -- -D warnings)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.62s
exit 0

$ (cd src-tauri && cargo test)
test desktop::tests::given_a_receiver_still_working_after_the_last_byte_when_piped_then_it_is_not_called_stuck ... ok

test result: ok. 135 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 3.27s
exit 0

$ npm run check
== webkit
webkit scripts/check-contrast.mjs: 0
webkit scripts/check-design-sync.mjs: 0
webkit scripts/check-entitlements.mjs: 0
webkit scripts/check-icon.mjs: 0
webkit scripts/check-start.mjs: 0
webkit scripts/check-version-sync.mjs: 0
exit 0
```

## Screenshots

No screen shows these components yet, so there is nothing to capture. WO-1.3c adds the gallery. No comparison with `docs/plan/design/shots/` is claimed.

## Not done or changed from the work order

- The tests were committed red first. Two test files changed in the code commit without changing an assertion: the Inspector tests query `document` because the sheet renders in a portal, and the Toast tests use `fireEvent` because `userEvent` hung under fake timers.
- `Sheet` explicitly returns focus to the opener. Radix did not reliably do that in jsdom, and the work order requires it.
- No screenshots, as explained above.

## Found on the way

Nothing new. `docs/plan/FOUND.md` keeps its earlier entries.