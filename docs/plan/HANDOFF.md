# Handoff: how to implement this plan

You are the implementer. This file is your contract. Read it in full before you touch anything.

The owner will not answer design questions while you work. Everything you need is in this folder. If it is not, that is a defect in the plan: stop and report it (rule 9), do not fill the gap yourself.

## 1. What you are building

OpenPier: an open-source desktop app for containers on macOS (Tauri 2, React, TypeScript, Rust). The repo today is a half-renamed app called Wharf whose stylesheet was deleted. The plan rebuilds it in iterations.

The whole implementation is written as work orders, grouped in seven iterations, in `iterations/`:

| Iteration | File | What it delivers |
|---|---|---|
| 1 | `iteration-1-work-orders.md` | Safe and buildable repo, renamed to OpenPier, the design system |
| 2 | `iteration-2-work-orders.md` | The shell, Containers, container detail, the Run and Pull sheets |
| 3 | `iteration-3-work-orders.md` | Every other screen |
| 4 | `iteration-4-work-orders.md` | Any engine, one data layer, dead code removed |
| 5 | `iteration-5-work-orders.md` | Projects |
| 6 | `iteration-6-work-orders.md`, then `iteration-6-part-2-work-orders.md` | Menu bar, notifications, image detail, registries and the other reference features |
| 7 | `iteration-7-work-orders.md` | Licence, release workflow, install, README, launch |

**You implement one iteration at a time, in order.** After each iteration you stop and write its report (section 8). The plan's author checks it before the next one starts. Do not start work from a later iteration, even if it looks easy.

**Before the first work order**: `git status --short` must print nothing and `git rev-parse --abbrev-ref HEAD` must print `main`. If the working tree has changes you did not make, stop and report. Do not stash, reset, commit or delete them.

## 2. Read in this order

1. This file.
2. `README.md` (the index and the decisions already made).
3. `iterations/README.md` (the shape of a work order, and what "stop and report" means).
4. `iterations/iteration-<N>-work-orders.md` for the iteration you were given (your work, order by order).
5. For each work order, the files it names under "Read first". Nothing else is required reading.

## 3. Sources of truth, in order

When two things disagree, the higher one wins, and you report the disagreement.

1. The work order you are on.
2. `design/openpier.css` (every colour, size and shadow).
3. `design/mockup.html` (what each screen looks like; open it in a browser).
4. `04-design-spec.md` (component names, props, behaviour, words).
5. `07-projects-spec.md`, `08-feature-gaps.md`, `06-open-source-launch.md` for their topics.
6. The reviews `01`, `02`, `03` explain why. They do not tell you what to build.

`design/prototype.html` shows behaviour only. Directions B and C in it were rejected. Never copy their look.

## 4. Rules

1. **One work order, one branch.** Branch `wo-<id>` (for example `wo-0.2`), cut from your local `main`. Never commit to `main` directly. When the work order's "Done when" and the gate pass, merge it into your local `main` with `git checkout main && git merge --no-ff wo-<id>`, and keep the branch. The next work order starts from that `main`. Nothing is pushed (rule 10), so there is no pull request on GitHub: you write its text to a file (section 6).
2. **Do the steps in the order written.** Do not skip a step because it looks unnecessary.
3. **Do only what the work order says.** If you see something else that is wrong, add one line to `docs/plan/FOUND.md` (create it if missing: date, file, what, why it matters) and carry on.
4. **Test first where the work order gives tests.** Write the test, run it, see it fail for the right reason, then write the code. Paste the failing and the passing output in the pull request.
5. **Never weaken, skip or delete a test to make it pass.** If you believe a test is wrong, stop and report.
6. **Never invent design.** No colour, pixel size, shadow, icon or word that is not in the stylesheet, the mockup or the spec.
7. **Never run commands that change the machine**: no `docker`, `colima`, `limactl`, `kubectl`, `brew` commands that create, start, stop or delete anything; no change to `~/.docker`, `~/.colima`, system settings or the keychain. The app is checked through the browser preview with the mocked backend. Read-only commands (`docker ps`, `docker context ls`) are allowed when a work order asks for them.
8. **Never touch secrets.** Do not open `private.key`. Do not print, copy or commit any key, token or password. Do not generate signing keys; the owner does that.
9. **Stop and report** when: a step fails twice; a "Done when" check cannot be made to pass without breaking a rule; the files are not as the work order describes them; two sources disagree; you would have to guess. How to report is in `iterations/README.md`. A stopped work order is not merged into `main`. Stopping is a correct result.
10. **No pushing, no releases, no tags.** Commit locally. The owner pushes.
11. No people's names, emails or handles in code, commits or docs, other than the repo owner's account in URLs.
12. No em dashes in anything you write. Plain English, short sentences.
13. **Keep the tree clean.** Notes, saved command output and other working files go outside the repo (for example `/tmp/openpier-wo-<id>/`), never in a repo folder. Paste the output you need into the pull request file. `git status --short` must print nothing when a work order ends and when the next one starts. If it shows a file you did not make, stop and report.

## 5. The checks

Every work order ends with the same gate, plus its own "Done when". All must pass on a clean checkout of your branch.

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test
(cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test)
npm run check        # from WO-0.3 on
```

On the commit the plan was written against (`0bdafcf`) three of these fail: lint, `cargo fmt --check` and `cargo clippy`. WO-0.0 fixes them and WO-0.3 makes `npm run check` work. From then on, a failure is yours.

Node 22.6 or newer is needed (`npm test` uses `--experimental-strip-types`). `cargo` needs the folder `dist/` to exist: run `npm run build` once if it complains about `../dist`.

## 6. What a pull request contains

You do not push, so you write the pull request as a file: `docs/plan/iterations/pr/wo-<id>.md`, committed on the work order's branch as its last commit. The owner opens the real pull request from it.

First line: the title the work order gives (`wo-<id>: <what the user can now do>`).

Then these headings:

1. **What changed**: three lines at most, in terms of what a user sees or what is now safe.
2. **Steps done**: the work order's steps as a checklist, each ticked, in order.
3. **Evidence**: the output of the gate commands (last 10 lines of each), and of each "Done when" check, pasted as text.
4. **Screenshots**: for anything on screen, light and dark, WebKit, 1280x800, saved under `docs/plan/iterations/pr/wo-<id>/` and listed next to the mockup picture from `design/shots/` they should match. Say what differs. Never write that they match unless `scripts/check-mockup.mjs` passed for that screen.
5. **Not done or changed from the work order**: say "nothing", or list each item with the reason.
6. **Found on the way**: the lines you added to `FOUND.md`.

## 7. Commits

`<type>: <what the user can now do>`, types `fix`, `feat`, `docs`, `style`, `refactor`, `test`, `chore`. One logical change per commit. When a work order gives tests: commit the failing tests first, then the code that passes them.

## 8. When you finish the iteration

Write `docs/plan/iterations/iteration-<N>-report.md`:

1. A table: work order, branch, merge commit on `main`, done or stopped.
2. For each stopped work order: the step, what you tried, the exact output.
3. The full output of `sh docs/plan/iterations/verify-iteration-<N>.sh`, run on `main` after the last merge.
4. The content of `FOUND.md`.

Then stop. The plan's author checks the work against `iterations/iteration-<N>-acceptance.md`. Anything that passes the script and fails that checklist is not done.
