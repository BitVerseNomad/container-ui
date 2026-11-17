# WO-3.3c open questions (lane orch/r3-33c)

1. CommandToast. WO-3.3c step 3 says to rewrite `CommandToast` in `src/Commands.tsx` to call `toast({ text })` from `useToast()`. `src/Commands.tsx` is outside this lane's files, so it is not done here. Owner: the lane that owns Commands/Activity.

2. Other lanes' pending checks. `scripts/checks-pending/` still holds `check-observe.mjs`, `check-mounts.mjs`, `check-guided.mjs` and `check-pull.mjs`. They belong to the WO-3.2, 3.3a and 3.3b lanes and are left in place as instructed. The gate's "old checks still pending" and "pending folder shrank" lines stay FAIL until those lanes merge.

3. Browser run outstanding. `scripts/check-compose.mjs` keeps its 61 `check(` lines and its selectors now name the renamed sheet and button. It has not been run in Chromium or WebKit, because this lane does not run browser checks.
