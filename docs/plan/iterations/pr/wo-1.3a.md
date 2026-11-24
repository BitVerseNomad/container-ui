wo-1.3a: the small components exist and are tested

## What changed

The new design components exist in `src/ui/op/`, one file per component, each with a test.
They render classes from `container-ui.css` only and take their text from props.
Nothing on screen uses them yet; the old screens keep their own components.

## Steps done

- [x] 1. `Icon.tsx` and its test. Checked every lucide name; moved `lucide-react` to dependencies.
- [x] 2. `Button.tsx` and its test.
- [x] 3. `Field.tsx` (with `FormRow` and `Fields`) and its test.
- [x] 4. `Select.tsx` and its test.
- [x] 5. `Switch.tsx` and its test. Installed `@radix-ui/react-alert-dialog` and `@radix-ui/react-switch` with the package step.
- [x] 6. `Chip.tsx` (with `ChipButton`) and its test.
- [x] 7. `Tabs.tsx` (with `TabPanel`) and its test.
- [x] 8. `Dot.tsx` and `Sev.tsx`, each with a test.
- [x] 9. `Tooltip.tsx` and its test.
- [x] 10. `Banner.tsx` and its test.
- [x] 11. `Empty.tsx` and its test.
- [x] 12. `SkeletonRows.tsx` and its test.
- [x] 13. `Canvas.tsx` and `Command.tsx`, each with a test.
- [x] 14. `Tile.tsx` (with `Tiles`), `Facts.tsx` and `GroupCaption.tsx`, each with a test.
- [x] 15. `NavItem.tsx`, `Checkbox.tsx` and `Progress.tsx`, each with a test.
- [x] 16. `index.ts` exports every file.

## Evidence

Done when checks:

```text
$ ls src/ui/op/*.tsx | grep -vc test
21
```

```text
$ ls src/ui/op/*.test.tsx | wc -l
21
```

```text
$ npm test 2>&1 | grep -E "Test Files|Tests "
 Test Files  29 passed (29)
      Tests  122 passed (122)
```

```text
$ grep -rn "lucide-react" src --include="*.tsx" --include="*.ts" -l | grep -vE "^src/ui/(icons\.tsx|components/)"
src/ui/op/Icon.tsx
```

```text
$ grep -rnE "style=|#[0-9a-fA-F]{3,6}\b|[0-9]px" src/ui/op --include="*.tsx" | grep -v test; echo "exit $?"
exit 1
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
 Test Files  29 passed (29)
      Tests  122 passed (122)
# pass 592
# fail 0
test=0
```

```text
$ cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
test result: ok. 135 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out
cargo=0
```

```text
$ npm run check
== chromium
...
== webkit
...
check=0
```

## Screenshots

None. These components are not mounted on any screen yet, so there is nothing new to photograph.

## Not done or changed from the work order

- The tests were written next to each component and all passed the first time they ran. They were not committed red before the component, because the test imports the component and a commit with only the test would not build. The final tests and components are all present and pass.
- `npm install lucide-react` left the package in `devDependencies` because it was already there. `npm install --save-prod lucide-react` moved it to `dependencies`, which is what the step asks for.
- The button checks `import.meta.env.DEV` through a small type cast, because this repo has no Vite environment type file.

## Found on the way

Nothing.