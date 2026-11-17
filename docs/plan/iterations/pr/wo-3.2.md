wo-3.2: A container's page has its own address, and its old checks are back

**Related ticket:** WO-3.2 in `docs/plan/iterations/iteration-2-work-orders.md`

## Description

1. A container page now lives in the address: `#/containers/{id}/{tab}`. Reload and back work.
2. Tabs: Logs, Stats, Settings (was Inspect), Folders (was Mounts), Network, History (was Activity).
3. The Logs controls (filter, Follow, copy) sit in the tabs row on the Logs tab. The log fills the page and scrolls inside itself. The log keeps the last 10,000 lines.
4. The facts line and the problem banner replace the old header text.
5. Stats are four tiles with a CPU sparkline. A stopped container says "Not running" and asks you to start it.
6. `check-observe` and `check-mounts` are back in `scripts/`.

## Business and product value

1. A container page has an address, so a link or reload goes back to the same tab.
2. The tab names match the words used in the list and the Doctor.

## How to Test

1. Open `#/containers`, click `api`. The address becomes `#/containers/api/logs`.
2. Reload. The same tab shows.
3. Press Stats, Settings, Folders, Network, History. Each changes the address.
4. On Logs, type in the filter, press Follow, scroll up. Follow turns off by itself.
5. Press the copy icon. The toast says "Copied logs".

## Old and new addresses for the browser checks

1. Observe: `/?scenario=running#/containers` (old) becomes `/?scenario=design#/containers/api/logs` in the check.
2. Mounts: the scenarios are the same; the checks keep their existing list and Doctor addresses until WO-3.8.

## Known gaps

1. The problem banner's "See why" opens the Settings tab, not the Inspector. The fix button is not in the banner yet.
2. The ⋯ menu has no "Copy name" + "Run it yourself" pair beyond "Copy name" (see questions.md).
3. Doctor has no filter until WO-3.8. "and N more" opens plain Doctor.
4. Browser checks (`check-observe`, `check-mounts`, `check-layout`, the mockup row) were not run in this pass. The loop runs them.

## Testing Evidence

1. `npx tsc --noEmit`: clean.
2. `npx vitest run` for `Logs` and `ContainerDetail`: 11 passed.
3. The WO-3.2 gate: static checks of its section (see the gate output in the report).

## Checklist

- [x] Tests pass for the changed pages
- [x] Type check passes
- [ ] Browser checks run by the loop
