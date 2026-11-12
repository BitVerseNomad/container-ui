# Product review

Reviewed on 2026-11-12. Sources: the repo's own docs (`README.md`, `docs/SPEC.md`, `docs/research/2026-10-11-landscape.md`, `TODO.md`), the code, and the owner's brief for this review. Competitor facts come from the repo's landscape note, which was built from each project's own page and not from running them. Nothing here is from user research with real people; that is the first gap (P8).

## Verdict

The product has one real edge and it is already built: **it tells you what is wrong with your containers in plain words and fixes it**. Nothing in the landscape note lists that for any other tool.

In November the project added three more products around that edge (dev environments, an AI chat, five runtimes) and renamed itself twice. None of the three is finished, and together they hide the edge. The recommendation is to cut back to one promise, make it true on any engine, and ship that as 1.0.

## P1. Positioning: one sentence

Today the README opens with "Docker on your Mac, without Docker Desktop". That is the Colima pitch, and Colima already owns it.

Proposed:

> **OpenPier is the open-source desktop app for your containers. It works with the engine you already have, shows what is wrong in plain words, and fixes it.**

Three claims, each one checkable:

1. **Open source.** A licence file, public roadmap, PRs reviewed. (Not true today: there is no `LICENSE`.)
2. **Works with the engine you already have.** Colima, Docker Desktop, OrbStack, Rancher Desktop, Podman, or any Docker context. (Not true today: Colima only. See E8.)
3. **Shows what is wrong and fixes it.** Doctor and the per-row problems. (True today.)

## P2. Is there really nothing like it?

Be precise in public, because the first comment on any launch post will name these:

| Tool | Open source | Desktop app | Works on an engine you already run | Explains and fixes problems |
|---|---|---|---|---|
| Docker Desktop | No | Yes | No (its own) | No |
| OrbStack | No | Yes | No (its own) | No |
| Podman Desktop | Yes | Yes (Electron) | Partly (Podman first; Docker engine through an extension) | No |
| Rancher Desktop | Yes | Yes (Electron) | No (its own VM) | No |
| Portainer CE | Yes | No (web, runs as a container) | Yes | No |
| lazydocker | Yes | No (terminal) | Yes | No |
| OpenPier | Yes | Yes (native webview, about 6 MB) | Yes (goal) | Yes |

"Explains and fixes problems: No" means the landscape note found no such feature listed; it is not proof.

So the honest claim is not "nothing exists". It is: **no open-source desktop app is engine-neutral, light, and built around explaining problems.** Podman Desktop is the closest and has a company behind it. Do not compete with it on breadth (extensions, Kubernetes deploy, pods). Compete on the three claims above.

## P3. Scope for 1.0: what is in, what is out

In (the reference container manager):

1. Containers, images, volumes, networks, Compose projects.
2. Logs, shell, stats, inspect for a container.
3. Doctor, per-row problems, guided fixes.
4. Guided Run and Pull.
5. Engine switcher across every Docker context on the Mac.
6. Machine controls for Colima (start, stop, resize, mounts). Other runtimes show "managed by" and a button to open their own app.
7. First-run setup that installs what is missing.
8. Kubernetes, read-only, as today.
9. Bring volumes over from Docker Desktop (it is the migration story and it is built).

Out of 1.0 (kept in the repo behind a flag, not in the default navigation):

1. **Dev environments ("Projects" on Lima, terminal, port forwarding, credential sharing).** It is a different product (closer to Dev Containers or Gitpod), it is the source of three P0 security findings, and it only works on a Lima instance named `default`. Bring it back as "Workspaces" after 1.0 if users ask.
2. **AI assistant.** A chat box next to a Doctor that already answers "why is this broken" with evidence dilutes the message. If it returns, it should be one button on a Doctor finding ("Explain more"), local model only by default.
3. **Machine controls for runtimes other than Colima.** Stubs today. Add one runtime at a time, when someone needs it.
4. **Windows and Linux builds.** `TODO.md` lists `.msi` and `.deb`. Nothing in the app has been run there, Setup assumes Homebrew, and the VM logic is macOS-only. Ship macOS (Apple Silicon and Intel) first.
5. **Menu bar app, notifications, image build, registries tab.** Listed as W4-W14 in `docs/SPEC.md`. All after 1.0.

This matches the scope decision already recorded in `docs/SPEC.md` on 2026-11-11 ("narrow to guidance layer + integrations"). The code moved the other way after that date; this review asks to follow the decision.

## P4. Name

1. The owner chose **OpenPier** on 2026-11-12, to follow the "Open…" family (OpenCode, OpenChamber).
2. Checked on GitHub only: no notable project or organisation uses the name; one inactive personal account does. **Not checked: trademarks and domains.** Do that before the first public post.
3. Rejected and why: OpenContainers (it is the Open Container Initiative), OpenDock (an existing logistics software company), OpenHarbor, OpenQuay, OpenCrane (each collides with a well-known container tool), OpenBerth (an existing deployment platform), OpenDeck (an existing app with thousands of stars).
4. Repo: `openpier`. App: "OpenPier". Bundle identifier: `dev.openpier.app`. Tagline: "The open-source desktop app for your containers."

## P5. Who it is for

1. **Primary: a developer on a Mac who left, or wants to leave, Docker Desktop**, and now runs Colima, OrbStack or Rancher. They know `docker ps`. They lose time on "why can't A reach B" and "where did my disk go".
2. **Secondary: someone newer to containers** who was told to "just run the compose file" and needs the app to say what broke.
3. Not for: people managing remote servers or clusters (Portainer, k9s and Headlamp do that).

Every screen decision in `04-design-spec.md` assumes the primary user: dense lists, keyboard first, no teaching paragraphs on the main screens.

## P6. What "the reference open-source project" takes

A reference project is judged in the first two minutes on the repo page. Today it fails most of them:

| Check | Today | Needed |
|---|---|---|
| Licence | None | `LICENSE` (MIT recommended, same as Colima and OpenChamber) |
| Install line works | No (`OWNER/REPO` placeholder) | One line, tested on a clean Mac |
| Latest release has a downloadable app | v0.2.0 is; v0.2.1 is a draft | Every tag publishes a signed `.dmg` |
| Screenshots match the app | No (old name, old UI) | Retaken by a script on every release |
| CI badge | No CI | Green badge on `main` |
| Security policy | None, and a private key is in the repo | `SECURITY.md`, key rotated |
| Contributing guide matches the repo | Says "Container UI", `cd colima-ui` | One page, accurate |
| Issue and PR templates | One feedback template | Bug, feature, question |
| Roadmap | Spread over 12 docs that disagree | One `ROADMAP.md` |
| Code of conduct | None | Contributor Covenant |
| Signed and notarised app | Ad hoc signature, "Open Anyway" needed | Decision for the owner (P9, item 3) |

The full recipe is `06-open-source-launch.md`.

## P7. How to know it is working (two measures per goal)

| Goal | Leading (moves first) | Lagging (the outcome) |
|---|---|---|
| People can install it | Install line passes on a clean Mac in CI | Release downloads per version |
| The edge is real | Share of Doctor findings where the user clicks the fix (local counter, shown only to the user unless they opt in to share) | Issues titled "it told me why" versus "it didn't know why" |
| It is a reference repo | Time from PR opened to first review | Number of contributors with a merged PR |

There is no telemetry today and none should be added without an explicit opt-in. Until then, the lagging measures come from GitHub's own numbers.

## P8. Risks

1. **No real user has used it.** Every UX score so far came from reviewer agents on screenshots. Before 1.0, sit five engineers in front of it with the scenarios in `docs/EVALUATION.md` (moved to `docs/research/evaluation-kit.md` by task 0.5) and watch.
2. **Never verified on a real machine after the October build** (`docs/VERIFY-ON-YOUR-MAC.md` is still open as W1; task 0.5 keeps it as `docs/research/verify-on-your-mac.md`).
3. **The engine-neutral claim is the whole positioning and it is not built.** If E8 slips, ship 1.0 as "for Colima" and say so, rather than claim five runtimes with stubs.
4. **One maintainer.** A reference project needs reviews within days. Set expectations in `CONTRIBUTING.md` ("reviews on weekends").
5. **A personal GitHub account owns the repo.** Fine to start. Move to an `openpier` organisation when a second maintainer joins, so the URL does not change twice.

## P9. Decisions for the owner

Ordered by what they unblock.

1. **Leaked signing key.** Decided on 2026-11-12: rotate the key only. Generate a new key, remove the old files in a normal commit, leave the history as it is. The old key stays readable in old commits and is no longer trusted, because the app ships with the new public key. The repo is kept and renamed to `openpier` (GitHub redirects the old URL).
2. **Licence.** Decided on 2026-11-12: MIT.
3. **Apple Developer account.** Decided on 2026-11-12: no account. The app is ad-hoc signed, so every user must allow it once in System Settings. The README shows that step with a screenshot. Known cost: some people stop at that screen, and the official Homebrew cask is not possible.
4. **Dev environments and the AI chat: out of the 1.0 navigation (recommended), or in?** Blocks the navigation in the design spec.
5. **macOS only for 1.0 (recommended), or also Windows and Linux?** Blocks the release workflow.
6. **Who owns the repo on GitHub: the personal account now and an `openpier` organisation when a second maintainer joins (recommended), or the organisation from day one?** Blocks every URL in the README, the updater and the install script.

Already decided on 2026-11-12: the name (OpenPier) and the stack (stay on Tauri; see `README.md` in this folder).
