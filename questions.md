# WO-3.3c open questions (lane orch/r3-33c)

Not done in this lane because the files sit outside its ownership. Each needs a decision or an owner's edit.

1. Double sheet. `src/Containers.tsx` (around line 880) wraps `ComposeProjects` in its own `Sheet` titled "Compose projects". `ComposeProjects` now draws its own `Sheet` titled "Start a Compose project", so the screen shows two nested dialogs. Owner of `Containers.tsx` should drop the outer `Sheet` (the sheet is the one inside `ComposeProjects`) or retitle it. `scripts/check-menus.mjs` line 8 still expects the dialog name "Compose projects" and needs the same change (WO-3.1c owns it).

2. CommandToast. WO-3.3c step 3 says to rewrite `CommandToast` in `src/Commands.tsx` to call `toast({ text })` from `useToast()`. `src/Commands.tsx` is not in this lane's files, so it is not done here. Owner: the lane that owns Commands/Activity.

3. Checks still in `scripts/checks-pending/`: `check-observe.mjs`, `check-mounts.mjs`, `check-guided.mjs`, `check-pull.mjs`. These belong to the WO-3.2, 3.3a and 3.3b lanes and are left in place as instructed. The gate's "old checks still pending" and "pending folder shrank" lines stay FAIL until those lanes merge.

4. Browser checks not run. `scripts/check-compose.mjs` needs Chromium and WebKit, which this lane may not run. Its 61 `check(` lines are unchanged. Its selector `Compose projects` (lines 40, 180, 207, 222, 237) will not match the renamed sheet until question 1 is settled.
