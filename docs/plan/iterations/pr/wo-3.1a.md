wo-3.1a: The rules of the container list as tested functions

## What changed

- `src/lib/containerRows.ts` (new): pure functions for the Containers list. They pick a container's dot and word (`stateView`), format CPU and memory (`statsText`, `memText`), read and group host ports (`hostPorts`, `portCell`), build a block's state (`blockOf`), write the header summary (`summary`), sort the list (`sortEntries`), decide whether a group is open (`isOpen`), flatten the groups into lines (`flatten`) and count what needs attention (`countNeedAttention`).
- `src/lib/containerRows.test.ts` (new): 30 tests with `node:test`, in Given/When/Then form.
- Nothing on screen changes. The screen work order (WO-3.1b) only draws these results.

Why: the rules of the list (problems first, one dot and one word per state, ports and stats in fixed columns) are now tested functions. The screen can then only draw them, and the rules are checked without a browser.

## Steps done

- [x] Step 1: `src/lib/containerRows.ts` created with the exports listed above.
- [x] Step 2: `src/lib/containerRows.test.ts` created with the 30 tests.
- [x] Only the two new files changed (merge commit `c1f0c9d`, feature commit `27ed205`).

## Evidence

```bash
$ node --experimental-strip-types --no-warnings --test src/lib/containerRows.test.ts
# tests 30
# pass 30
# fail 0
```

The run was on branch `orch/r2-d` on 2026-11-16. The feature commit `27ed205` shows `2 files changed, 351 insertions(+)`.

## Not done or changed from the work order

- Nothing from the work order is left out, as far as the merged diff shows.
- The browser check of the Containers screen belongs to WO-3.1b and WO-3.1c, not here.

## Contract differences

None. The screen, the Docker commands and the old `src/lib/homeRows.ts` are unchanged.
