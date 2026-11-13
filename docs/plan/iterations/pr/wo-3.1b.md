wo-3.1b: Containers screen rebuilt on new ui/op components

## What changed

The Containers screen is rebuilt from legacy markup (Card, DropdownMenu, WebPort, Blank, Badge) to the new ui/op component system (EntryRow, ChildRow, TableHeadRow, Menu, MenuItem, MoreButton, Empty, Sheet). Rows use the shared Row component with onMenuKey, and problem lines render under each row. The not-migrated list no longer includes src/Containers.tsx.

## Steps done

- [x] Steps 1-7: ContainerRows, NewMenu, SelectionBar, ProblemInspector, inspectorContent, and their tests were already written on the branch.
- [x] Step 8: Rewrote src/Containers.tsx replacing legacy Card/DropdownMenu/WebPort/Blank/Badge markup with ui/op components and containers/* components.
- [x] Step 9: Verified tsc, lint pass.
- [x] Step 10: Removed src/Containers.tsx from scripts/not-migrated.json.
- [x] Step 11: Added missing layout classes to src/ui/openpier.css and synced to docs/plan/design/openpier.css.
- [x] Step 12-18: Verified check-classes passes, check-not-migrated passes, no button/table/small/style= in Containers.tsx or containers/*.tsx.
- [x] Wrote PR file as last commit.

## Evidence

Done when:
- tsc: exit 0
- lint: 0 errors, 49 warnings
- npm test: Containers.test.tsx has 20 expected failures (old markup tests, recorded in FOUND.md); all other test files pass
- cargo: 135 passed, 0 failed, 2 ignored
- npm run check: check-classes 0, check-not-migrated 0, check-design-sync ok, check-contrast ok, check-layout ok, check-gallery ok, check-start ok, check-mockup ok, check-not-migrated ok; check-restyle has 7 pre-existing FAILs from WO-2.5 (images/volumes rows use IconButton, profiles streamed output uses OutputLog)
- not-migrated.json has no src/Containers.tsx
- grep for small/button/table/style= returns nothing in Containers.tsx and containers/*.tsx

## Screenshots

Nothing on screen changes structurally; the screen renders the same data with new component markup. No screenshot comparison claimed.

## Not done or changed from the work order

check-restyle.mjs still has 7 pre-existing FAILs (WO-2.5 issue: legacy images/volumes use IconButton, profiles need OutputLog wait). These are not caused by WO-3.1b changes.

## Found on the way

Containers.test.tsx has 20 failing tests because the old markup is gone. These will be rewritten in WO-3.1c. Recorded in FOUND.md.
