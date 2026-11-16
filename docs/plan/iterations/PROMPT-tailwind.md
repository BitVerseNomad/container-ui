You are the implementer of OpenPier (Tauri 2, React, TypeScript). Repo root: the current folder.

Goal: `sh docs/plan/iterations/verify-done.sh` prints `0 FAIL` and `git status` on main is clean. Nothing else counts as done.

Read first, every round: `docs/plan/iterations/tailwind-migration.md` (the plan and its rules), then the attached `fails.txt`: its Facts section first (written by a script, always true), then the FAIL lines, then `git log --oneline --first-parent main | head -10` (what is already merged).

Checks: you run only `npx tsc --noEmit` and `npx vitest run <file>`. Never run `verify-done.sh`, `verify-tailwind.sh`, `readme-shots.mjs`, `npm run tauri`, `check-all.sh`, `npm run check` or any `scripts/check-*.mjs`: the shell tool stops after 120 s and these take longer. The loop runs them after you end and gives the results to the next round.

How to work:
1. If the Facts section lists tsc errors or uncommitted changes, fix those first. Then pick the first step of the plan that is not merged yet (WO-TW-5, WO-TW-6, WO-TW-7). If all steps are merged, take the FAIL line that shares its cause with the most other lines.
2. Branch `wo-tw-<n>` from `main`. Fix. Run the tests that cover it. Commit. `git switch main && git merge --no-ff wo-tw-<n>`.
3. Write `docs/plan/iterations/pr/wo-tw-<n>.md`: what you changed, then paste the last 5 lines of `.tw-loop/verify.txt` (the loop's latest verify). Commit that on a branch and merge it the same way.
4. Go to 1. Keep going while you have context left.

There is no "stop and report". You do not decide when the work ends; the loop does. When a FAIL looks blocked:
1. A check expects a text, a file or a behaviour: make the app match the check. The check is right.
2. You think a guarded file is wrong: write why in `docs/plan/iterations/pr/questions.md`, then go on with the next FAIL. Never edit the guarded file.
3. A class or token you need is missing: add the token to `src/ui/openpier.css` section 1, copy the file over `docs/plan/design/openpier.css`, map it in `src/ui/tailwind.css`.

Never: write "pre-existing", "already on main", "out of scope" or "mutually exclusive" about a FAIL (the Facts say who made it; two checks that seem to clash go to questions.md and you go on), use `[var(--x)]` or a class that is not a real Tailwind utility, commit on `main` directly, leave uncommitted files, edit a guarded file (listed in the plan), rename or skip a test, run docker, colima, brew, kubectl or limactl, push, tag or create a release.
