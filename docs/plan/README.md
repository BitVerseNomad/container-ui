# OpenPier: reviews, design and plan

Written on 2026-11-12. This folder is the brief for turning today's app into OpenPier 1.0: three reviews, the design, and the work in order. It is written so that someone who was not in the room, or a cheaper model, can do each task without guessing.

## Read in this order

| File | What it is | Read it when |
|---|---|---|
| `01-review-engineering.md` | Findings E1 to E15: security, what is broken, architecture. Each with a prescription and a "done when" | Before any backend or structure task |
| `02-review-ux.md` | Findings U1 to U21 on today's screens, with screenshots in `current-ui/` | Before any screen task |
| `03-review-product.md` | Positioning, scope for 1.0, name, risks, and the owner's open decisions (P9) | Before deciding what to build |
| `04-design-spec.md` | The design in words: tokens, shell, components, every screen, states, words, keyboard | While building anything on screen |
| `design/mockup.html` | The design you can open. 19 screens, light and dark | Same. Open it in a browser |
| `design/openpier.css` | The stylesheet. Ships unchanged as `src/ui/openpier.css` | Same |
| `design/shots/` | Screenshots of the mockup (WebKit). Remake with `node docs/plan/design/shoot.mjs` | To compare your screen with the design |
| `05-implementation-plan.md` | The tasks, in order, one PR each | To pick up work |
| `06-open-source-launch.md` | Licence, CI, release workflow, install, README, launch checklist | For phase 6 and task 0.6 |

To see a mockup screen: open `design/mockup.html#screen=containers&theme=dark`. Screen names are in the file's left menu.

## What is true today, in five lines

1. The app renders with almost no styling: its stylesheet was deleted by commit `5defa01` (E6). The screenshots in `current-ui/` are real.
2. A private signing key is committed and public (E1). Three commands from the dev-environments feature can read any file, hand out a GitHub token, and build a shell string from input (E2, E3, E4).
3. Only Colima works. The other four runtimes are stubs (E8).
4. The release workflow cannot produce a working update (E5). There is no licence and no CI.
5. The useful core is real and worth keeping: Doctor, per-row problems, guided Run, the connection test, the allowlisted backend and its tests.

## Decisions already made

### D1. Name: OpenPier (2026-11-12, owner)

The owner wanted a name in the "Open…" family. Alternatives and why they were dropped are in `03-review-product.md`, P4. Trademarks and domains are not checked yet.

### D2. Stack: stay on Tauri (2026-11-12, owner)

Electron with Tailwind and Base UI (OpenChamber's stack) was on the table. We stay because:

1. **The look is CSS, not the shell.** Everything that makes OpenChamber feel clean (flat layout, quiet colour, dense rows) is in `design/openpier.css` and renders the same in a Tauri webview. The mockup proves it in WebKit, which is the engine Tauri uses on macOS.
2. **The backend would be rewritten.** About 6,500 lines of Rust with command allowlists and its tests do the risky work (running `docker`, `colima`, `kubectl`). Electron would mean porting that to Node and re-proving it.
3. **Size.** The current `.dmg` is about 6 MB. An Electron app starts above 100 MB. "Light" is one of the three claims in the positioning.

What would change this: needing Windows and Linux soon with identical rendering, or a dependency that only exists for Node.

### D3. One stylesheet, no utility classes (2026-11-12)

The UI broke because classes in the components had no matching CSS, and nothing noticed. So: one file, semantic classes, and a check that fails when a class is used but not defined (task 1.4). Radix stays for behaviour (menus, dialogs, focus). Icons come from `lucide-react` only.

### D4. Engine and Machine are two things (2026-11-12)

An **engine** is any Docker context; every resource screen works on any engine. A **machine** is the VM behind an engine, and only Colima has controls for it in 1.0. This is what makes "works with the engine you already have" true without five half-built adapters. Detail in E8.

## Decisions still open (the owner's)

In `03-review-product.md`, P9. Decided on 2026-11-12: rotate the leaked key only (history kept), MIT licence, no Apple Developer account. Still open: dev environments and AI chat out of 1.0, macOS only, who owns the repo on GitHub.

## What has and has not been checked

1. Checked by reading code and git history: every file and line cited in the engineering review.
2. Checked by rendering: the mockup, in WebKit, light and dark.
3. Not run: the app's tests and build (counts in the reviews come from the repo's own docs), the workflows in `06`, the profile-list bug E7 (read, not reproduced).
4. Not measured: colour contrast of the tokens (task 1.2 does it).
5. Not done: any test with real users.

## Rules for this folder

1. The mockup and `openpier.css` are the source for the design. If they and the spec disagree, the mockup wins and the spec gets fixed.
2. When a task changes a decision here, change this folder in the same PR.
3. Things found on the way that are out of a task's scope go in `FOUND.md`.
