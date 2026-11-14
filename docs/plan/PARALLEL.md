# Running work orders in parallel

From iteration 3 on, several work orders can run at the same time, each in its own session, like a team of engineers. This file says which ones, how each session is kept apart from the others, and who merges. Iteration 2 stays one session at a time.

## The rules

1. **One lane, one folder, one branch, one port.** A lane is a list of work orders done in order by one session. Each lane works in its own git worktree, never in the main folder: `git worktree add ../openpier-lane-<x> -b wo-<id> main`. Each lane runs `npm ci` in its folder once, and uses its own preview port: lane A 4174, lane B 4175, lane C 4176, lane D 4177, lane E 4178 (`export PREVIEW_PORT=4175` before any check; WO-P.1 makes the scripts read it). Port 4173 stays free for the integrator.
2. **Lanes never merge into `main`.** A lane finishes a work order when its "Done when" passes on its branch and its pull request file is written. It then reports "ready: wo-<id>" and starts its next work order on a new branch made from the lane's last branch (`git switch -c wo-<next>`), not from `main`.
3. **One integrator merges.** The integrator is one session in the main folder `/Users/fsousa/Desktop/colima-ui`. It merges ready branches into `main` with `git merge --no-ff`, in the order of the "Merge order" line of the iteration, runs the gate after each merge, and runs the iteration's verify script at the end. Only the integrator writes to `main`.
4. **List files conflict, and that is fine.** `scripts/not-migrated.json`, `scripts/mockup-pairs.json`, `scripts/checks-pending/README.md`, `docs/plan/FOUND.md` and `preview/mock.ts` scenario lists are touched by many lanes. On a conflict in one of these, the integrator keeps both sides (a removed line stays removed, an added line stays added) and runs the gate. A conflict in any other file goes back to the lane: the lane runs `git merge main` on its branch, fixes it, reruns "Done when", and reports ready again.
5. **Never two lanes on the same files.** The lanes below follow the **Needs** line of each work order; they were not checked file by file. If a work order of your lane tells you to edit a file that another lane's work order also edits (outside the list files of rule 4), stop and report before you start it.
6. **Every HANDOFF rule still holds** (one work order per session, parts, stop on compression, no em dashes, no push). A lane session does one work order (or one part), reports, and ends; the next session of the same lane reads its folder's `git log` to carry on.
7. **Free models have rate limits.** Five sessions on one free endpoint can be throttled. Start with two or three lanes; add more only when they keep moving.

## WO-P.1 Each worktree gets its own preview port

**Needs:** iteration 2 merged. Do it before any lane starts, in the main folder, as an ordinary work order (branch `wo-P.1`, merge `--no-ff`).

**Why:** `vite.preview.config.ts` fixes the preview to port 4173 (`strictPort`), so two worktrees running checks at the same time would test each other's code (HANDOFF rule 15). `scripts/lib/check.mjs`, `scripts/check-mockup.mjs` and `scripts/check-all.sh` already read `PREVIEW_URL`.

**Starting state:**
1. `git status --short` prints nothing.
2. `grep -n "port: 4173" vite.preview.config.ts` prints one line.
3. `grep -n 'PREVIEW_URL' scripts/check-all.sh scripts/lib/check.mjs scripts/check-mockup.mjs` prints one line in each file.

**Steps:**
1. In `vite.preview.config.ts`, replace `server: { port: 4173, strictPort: true }` with `server: { port: Number(process.env.PREVIEW_PORT) || 4173, strictPort: true }`.
2. In `scripts/check-all.sh`, replace the line `url="${PREVIEW_URL:-http://localhost:4173/}"` with these two lines:
   ```sh
   url="${PREVIEW_URL:-http://localhost:${PREVIEW_PORT:-4173}/}"
   export PREVIEW_URL="$url"
   ```
   and replace `/tmp/openpier-preview.log` (both places) with `/tmp/openpier-preview-${PREVIEW_PORT:-4173}.log`. Change the comment on line 3 to say "http://localhost:4173, or PREVIEW_PORT".
3. In `docs/plan/HANDOFF.md` nothing changes: rule 15 already names this file.

**Done when:**
1. `PREVIEW_PORT=4179 npx vite --config vite.preview.config.ts &` then `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4179/` prints `200`; stop that server.
2. With nothing listening on 4173 (`lsof -nP -iTCP:4173 -sTCP:LISTEN` prints nothing), `PREVIEW_PORT=4179 PW_ENGINES=chromium sh scripts/check-all.sh` ends with every line `0`, and `lsof -nP -iTCP:4173 -sTCP:LISTEN` still prints nothing (the checks did not use 4173).
3. The gate in `HANDOFF.md` section 5.

**Pull request text:** `docs/plan/iterations/pr/wo-P.1.md`. First line: `wo-P.1: each worktree can run the checks on its own port`

## Lanes per iteration

A line "then" means the lanes before it must all be merged first.

### Iteration 3

1. Alone, in the main folder: WO-P.1, then WO-3.4 (it adds the shared helpers `states.mjs`, `rows.ts` and the baseline tools every other screen uses).
2. Then four lanes at once:
   1. Lane A: WO-3.5 Volumes.
   2. Lane B: WO-3.6 Networks.
   3. Lane C: WO-3.7 Kubernetes.
   4. Lane D: WO-3.8a Doctor, then WO-3.8b.
3. Then one lane: WO-3.9, WO-3.10, WO-3.11 (each needs the one before).
4. Merge order: 3.5, 3.6, 3.7, 3.8a, 3.8b, then 3.9, 3.10, 3.11.

### Iteration 4

One lane: every work order needs the one before (4.1 to 5.3). No parallel work.

### Iteration 5

One lane: 7.1 to 7.8 each need the one before. No parallel work.

### Iteration 6, part 1

After iterations 4 and 5 are merged, five lanes:
1. Lane A: WO-8.1a, 8.1b, 8.2a, 8.2b (menu bar, then notifications).
2. Lane B: WO-8.3a, 8.3b (problems page, Learn more).
3. Lane C: WO-8.5a, 8.5b, 8.6 (command log, copy details, error page).
4. Lane D: WO-8.4, then 8.8 (log view, size scenario).
5. Lane E: WO-8.7 (nightly real-engine job; CI files only).
6. Merge order: A, B, C, D, E, each lane's work orders in its own order.
7. Lanes A and C both write Rust (`src-tauri`). If both add a command to the same registration list, that list counts as a list file (rule 4).

### Iteration 6, part 2

1. Two lanes:
   1. Lane A: WO-8.9, 8.10 (pinned actions, security page).
   2. Lane B: WO-8.11, 8.12 (settings store, start at login).
2. Then two lanes:
   1. Lane C: WO-8.14a, 8.14b (image history).
   2. Lane D: WO-8.15a, 8.15b (registries).
3. Then alone: WO-8.13 (keyboard and VoiceOver pass over every screen).
4. Merge order: 8.9, 8.10, 8.11, 8.12, then 8.14a, 8.14b, 8.15a, 8.15b, then 8.13.

### Iteration 7

1. Two lanes:
   1. Lane A: WO-6.1 (repo files: licence, conduct, contributing).
   2. Lane B: WO-6.2a, 6.2b, 6.3, 6.5, 6.4 (updates, release, installer, signing doc, README).
2. Then alone: WO-6.6.
3. Merge order: 6.1, 6.2a, 6.2b, 6.3, 6.5, 6.4, then 6.6.

## Prompts

### A lane session

```
You are one lane of the OpenPier implementation, working in parallel with other sessions. Lane: <A>. Folder: /Users/fsousa/Desktop/openpier-lane-<a>. Port: <4174>. Work orders of this lane, in order: <WO-3.5>.

1. Read docs/plan/HANDOFF.md and docs/plan/PARALLEL.md in full (in your folder).
2. If the folder does not exist: from /Users/fsousa/Desktop/colima-ui run git worktree add ../openpier-lane-<a> -b wo-<first id> main, then cd into it and run npm ci. Otherwise cd into it and find where you are: git status --short, git branch --show-current, git log --oneline -10, and the "Steps done" list of the current pull request file.
3. export PREVIEW_PORT=<4174> before any check. Never use port 4173 and never work in /Users/fsousa/Desktop/colima-ui.
4. Do ONE work order of your lane (or one part, HANDOFF rule 19), to the letter. Run every "Done when" item on your branch and paste each command and its output in the pull request file. Do not merge into main.
5. Stop and report: "ready: wo-<id>" with the branch name, the "Done when" results and anything unclear. Or write STOPPED-wo-<id>.md on the branch and stop. Do not start the next work order in this session.
```

### The integrator session

```
You are the integrator of the OpenPier implementation. Folder: /Users/fsousa/Desktop/colima-ui (the main folder). Only you write to main.

1. Read docs/plan/HANDOFF.md and docs/plan/PARALLEL.md in full.
2. git status --short must print nothing. git switch main.
3. For each branch reported ready, in the "Merge order" of the iteration in PARALLEL.md: git merge --no-ff wo-<id>. On a conflict, follow PARALLEL.md rule 4. After each merge run the gate of HANDOFF section 5. If it fails, undo that merge: git switch -c wo-<id>-revert, git revert -m 1 HEAD --no-edit, git switch main, git merge --no-ff wo-<id>-revert. Then send the work order back to its lane with the failing output.
4. When the last work order of the iteration is merged, run sh docs/plan/iterations/verify-iteration-<n>.sh and report its full output.
5. Remove a lane folder only when its lane is done and merged: git worktree remove ../openpier-lane-<x>.
```
