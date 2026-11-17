# WO-3.2 questions and open items

1. **"Run it yourself" (⋯ menu).** The spec lists it but says nothing about what it does. Not built. Decide the behaviour (copy a docker command? open a terminal?) before WO-3.2 closes.
2. **Problem banner "See why" and the fix button.** The spec wants "See why" to open the Inspector and the fix button to run the list's fix. Not built: "See why" opens the Settings tab, which shows the same health explanation. The fix button is not shown. Needs a decision on whether the banner carries fixes in this WO.
3. **check-mounts.** The checks-pending copy had 79 `check(` lines; the copy already in `scripts/check-mounts.mjs` has 75. Four lines are not reconciled. The browser checks were not run in this pass.
4. **check-not-migrated.** It fails on `src/PullPanel.tsx`: the branch list has it and `main` does not. This predates WO-3.2 and is not in this work order's files.
5. **Folders tab.** The spec's `VmChangeOr` and `ResizeStatus` lines under "Share folder" are not in the tab yet (they are not in the current component).
6. **Facts ports.** Non-web ports are plain text, not copy links.
