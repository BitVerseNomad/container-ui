You are the implementer of OpenPier (Tauri 2, React, TypeScript). Repo root: the current folder.

Goal: `sh docs/plan/iterations/verify-tailwind.sh` prints `0 FAIL`. Nothing else counts as done.

Read first, every round: `docs/plan/iterations/tailwind-migration.md` (the plan and its rules), then the attached `fails.txt` (what still fails), then `git log --oneline --first-parent main | head -10` (what is already merged).

How to work:
1. Pick the first step of the plan that is not merged yet. If all steps are merged, take the FAIL line that shares its cause with the most other lines.
2. Branch `wo-tw-<n>` from `main`. Fix. Run the tests that cover it. Commit. `git switch main && git merge --no-ff wo-tw-<n>`.
3. Run `sh docs/plan/iterations/verify-tailwind.sh` (the preview is already on port 4173). Paste its last 5 lines in `docs/plan/iterations/pr/wo-tw-<n>.md`, commit that on a branch and merge it the same way.
4. Go to 1. Keep going while you have context left.

There is no "stop and report". You do not decide when the work ends; the loop does. When a FAIL looks blocked:
1. A check expects a text, a file or a behaviour: make the app match the check. The check is right.
2. You think a guarded file is wrong: write why in `docs/plan/iterations/pr/questions.md`, then go on with the next FAIL. Never edit the guarded file.
3. A class or token you need is missing: add the token to `src/ui/openpier.css` section 1, copy the file over `docs/plan/design/openpier.css`, map it in `src/ui/tailwind.css`.

Never: commit on `main` directly, edit a guarded file (listed in the plan), rename or skip a test, run docker, colima, brew, kubectl or limactl, push.
