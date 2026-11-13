# Work orders

The whole implementation, as recipes. Read `../HANDOFF.md` first: it is the contract.

## The files

| Iteration | Work orders | Check script | Acceptance checklist |
|---|---|---|---|
| 1 | `iteration-1-work-orders.md` | `verify-iteration-1.sh` | `iteration-1-acceptance.md` |
| 2 | `iteration-2-work-orders.md` | `verify-iteration-2.sh` | `iteration-2-acceptance.md` |
| 3 | `iteration-3-work-orders.md` | `verify-iteration-3.sh` | `iteration-3-acceptance.md` |
| 4 | `iteration-4-work-orders.md` | `verify-iteration-4.sh` | `iteration-4-acceptance.md` |
| 5 | `iteration-5-work-orders.md` | `verify-iteration-5.sh` | `iteration-5-acceptance.md` |
| 6 | `iteration-6-work-orders.md` (8.1 to 8.8), then `iteration-6-part-2-work-orders.md` (8.9 to 8.15) | `verify-iteration-6.sh` (runs part 2 too) | `iteration-6-acceptance.md` and `iteration-6-part-2-acceptance.md` |
| 7 | `iteration-7-work-orders.md` | `verify-iteration-7.sh` | `iteration-7-acceptance.md` |

Which plan task is in which iteration:

| Iteration | Plan tasks (`../05-implementation-plan.md`) | Order inside the iteration |
|---|---|---|
| 1 | 0.0 (new: green baseline), 0.2 to 0.6, 1.1 to 1.5. Task 0.1 is the owner's | 0.0, 0.2, 0.3, 0.5, 0.4, 0.6, 1.1, 1.2, 1.3a, 1.3b, 1.3c, 1.4, 1.5 |
| 2 | 2.1 to 2.4, 3.1 to 3.3 | 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3 |
| 3 | 3.4 to 3.11 | 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11 |
| 4 | 4.1 to 4.3, 5.1 to 5.3 | 4.1, 4.2, 4.3, 5.1, 5.2, 5.3 |
| 5 | 7.1 to 7.8 (`../07-projects-spec.md`) | as numbered |
| 6 | 8.1 to 8.15 (`../08-feature-gaps.md`) | as numbered |
| 7 | 6.1 to 6.6 (`../06-open-source-launch.md`) | as numbered |

## The shape of a work order

Every work order has these parts, in this order. If a part is missing, that is a defect: stop and report.

1. **Title**: `WO-<id>` and what the user can do, or what is safe, once it is merged.
2. **Needs**: the work orders that must be merged first.
3. **Why**: one or two lines, with the finding it closes (E = engineering review, U = UX review, P = product review).
4. **Read first**: the only files you must read before starting.
5. **Starting state**: commands to run before you change anything, with the output to expect. If your output differs, stop and report. Do not adapt the recipe yourself.
6. **Do not touch**: files and behaviour this work order must leave alone.
7. **Steps**: numbered. Each step names the file and gives the change. New files are given in full. Edits are given as "find this, replace with this". Do them in order.
8. **Tests to write first**: file, test name (Given, When, Then), and what it asserts. Write them before the code of the step they cover.
9. **Done when**: commands with the output to expect. All must hold, plus the gate in `../HANDOFF.md` section 5.
10. **Pull request title**: the first line of `pr/wo-<id>.md` (see `../HANDOFF.md` section 6).

## Line numbers

Line numbers in a work order were true for commit `0bdafcf` (the commit the plan was written against). Earlier work orders move lines, and WO-0.0 reformats the Rust code. Always find code by the name of the function, constant or component, or by the quoted text, never by the number. When you cannot find it, stop and report.

## What "stop and report" means

Write `docs/plan/iterations/STOPPED-wo-<id>.md` with: the step, the command you ran, the full output, what you expected, and what you tried (at most two attempts). Commit it on the work order's branch. Then go on to the next work order that does not need this one. Stopping is a correct result. Guessing is not.

## Words used in every work order

1. **The preview**: the app running in a browser with the fake backend `preview/mock.ts`. Started with `npm run preview` (from WO-0.3 on it serves `http://localhost:4173`).
2. **A scenario**: fake data picked with `?scenario=<name>` in the preview address.
3. **The mockup**: `docs/plan/design/mockup.html`. Each screen has a name; `docs/plan/design/shots/<name>-light.png` and `<name>-dark.png` are its pictures.
4. **The gate**: the commands in `../HANDOFF.md` section 5.
5. **The list**: `scripts/not-migrated.json`, the files not yet rebuilt on the new components (created in WO-1.3c). It may only shrink.
6. **Pending checks**: `scripts/checks-pending/`, old browser checks waiting for their screen to be rebuilt (WO-0.3). Each screen's work order brings its own back. It may only shrink, and is empty when iteration 3 ends.
7. **The new components**: they live in `src/ui/op/` and are imported from `src/ui/op` (its `index.ts`). The old ones in `src/ui/` and `src/ui.tsx` stay until WO-5.1 and must not be used by new code. Where a work order of iterations 2 to 4 says a new component (`Button`, `Row`, `Sheet`, `Menu`, `Empty`, `Banner`, `Icon` and the rest of `../04-design-spec.md` section 6) comes from `src/ui` or `src/ui/index.ts`, read `src/ui/op`. WO-5.1 deletes the old set and moves `src/ui/op/*` up to `src/ui/`; from then on the import is `src/ui`.
