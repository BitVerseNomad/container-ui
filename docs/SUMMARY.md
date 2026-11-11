# What we built and learned (summary)

> Snapshot from 2026-10-11, kept as a record. Several lines are out of date (the Rust now compiles and its tests pass; the Overview was replaced by the Containers home). For today's state read `README.md` and `CHANGELOG.md`.

Status date: 2026-11-11. Primary work branch: `feat/design-system-containers` (design-system rollout, uncommitted); `integration` holds everything except the AWS registries tab. Nothing is merged into `main`.

**Health today (all green):**
- `npm test`: 98 passed / 10 files
- `tsc --noEmit`: clean
- `npm run build`: succeeds
- `cargo test`: 137 passed / 0 failed / 2 ignored

## 1. What this is
A desktop app for people who run containers on a Mac with **Colima** and want a Docker-Desktop-like UI that also **guides** them: it explains what is wrong in plain words, links to the image's own documentation, and fixes the common cross-container mistakes. Stack: **Tauri 2** (small Rust backend that launches `colima`, `docker`, `kubectl`, `brew`) with a **React + TypeScript** UI. About 4,450 lines of TypeScript and 800 lines of Rust.

It was driven by the owner's own pains: a Kafka container and a Kafka UI container that cannot connect; delete buttons that did nothing; weird Colima output when creating profiles; needing env vars when running images; wanting private (AWS) registries and Compose files from repos; and wanting guidance, not clever automation.

## 2. How the work went (in order)
1. **First app**: Colima profiles (start, stop, restart, delete, edit CPU/memory/disk), containers, images, volumes, live logs, Docker Hub search and pull.
2. **Run and details**: Run panel (ports, volumes, env), container page with logs, inspect, stats sparklines, mounts.
3. **Bug reports fixed**: deleting images/volumes did nothing because `window.confirm()` is unreliable in the desktop webview (now an in-app dialog); new profiles failed to initialize (Colima output now streams into a panel, free default names, duplicate-name guard).
4. **Browser preview** with a simulated backend, so UI work needs no installs; a bundler (`scripts/build-preview.mjs`) and Playwright checks.
5. **Process change** (the owner asked to use the superpowers skills): brainstorm, written spec, written plan, native execution, self-review. First sub-project: fixed-sidebar shell, sage visual system (palette sampled from the owner's screenshots, light and dark, contrast tested), Overview with VM control and Homebrew install, cleaned Colima output.
6. **Design, accessibility and code reviews**, then fixes: bulk volume prune could delete named volumes (now anonymous-only, usage column, in-use volumes protected); the page could request any docker command (now an allowlist); published ports bound to all interfaces (now 127.0.0.1 unless opted in); landmarks, table scopes, modal side panels with focus handling.
7. **Guided Run**: setup-notes links from image labels or Docker Hub, shared network with copyable name:port of peers, ports and named volumes suggested from what the image declares, plain-language warnings, the `docker run` command shown.
8. **Pull panel**: find (search Docker Hub, sort by stars/name/official) then pull; Official detection fixed.
9. **Networking**: Networks tab and the **Connection doctor** (checks from the client's side with a throwaway helper container; flags settings pointing at localhost; one-click connect).
10. **Observability**: health, restart and out-of-memory problems explained, activity timeline from `docker events`, volume sizes, heaviest containers.
11. **Kubernetes**: Kubernetes tab (nodes, pods, deployments, services, events), pod problems in plain words, pod drawer with logs, Turn on Kubernetes, Open in k9s; read-only kubectl.
12. **AWS ECR registries tab**: component, logic and Rust written, parked unfinished on `feat/registries`.
13. **Landscape scouting** (ColimaStack, Podman Desktop, Rancher Desktop, Portainer, Dockge, Arcane, lazydocker, k9s, Headlamp, Freelens) and an **evaluation kit** (scenario scripts, guide, scorecard) so the owner can compare tools side by side.

## 3. What exists today (branch `integration`)
| Area | What works (against the simulated backend) |
|---|---|
| Shell | Fixed sidebar, only the content scrolls, icon nav, status pill, light/dark, icon rail at mid widths, phone layout |
| Overview | VM card (start/stop/restart/retry, cleaned output), CPU/memory/disk meters, searchable containers, needs-attention (problems), heaviest containers, recent activity, Pull and Run image, Homebrew install card |
| Containers | List with health badges; page with health panel, logs, inspect, stats, mounts, network, activity |
| Images | List, remove, prune, find-then-pull, guided Run |
| Volumes | Used by, sizes, safe bulk removal |
| Networks | Members and addresses, create, remove, connect, disconnect, Connection doctor |
| Kubernetes | Cluster summary, problems explained, pods/deployments/services/events, pod logs and warnings, turn on, open in k9s |
| Profiles | Create, edit resources, lifecycle, streamed cleaned output |
| Preview | Single-file browser preview with scenarios (`?scenario=`, `?k8s=`) |

## 4. Verification status (be honest)
| Verified | Not verified |
|---|---|
| 142 unit tests (pure logic) pass; 10 browser suites (204 assertions) pass against the **simulated** backend; screenshots reviewed in light, dark, mid and phone widths | **Rust compiles** (`cargo test`: 137 passed, 0 failed, 2 ignored) but the **strict CSP release build has never been opened on a real Mac**; 24 Rust tests are written but unrun on `main` (23 more on `feat/registries`) |
| Every feature was test-first for its pure logic | Real Docker, Colima, kubectl, AWS, Terminal automation, the helper container's real output, the real JSON of `docker events` and `docker system df -v`, the Colima Kubernetes context name |
| Self-review found and fixed real bugs (see below) | Tauri CSP is not set; Homebrew/notarized packaging not done |

Bugs found by our own testing and fixed: stale poll answers overwriting newer ones; Activity tab flashing an empty state; dark-mode warning contrast; Retry repeating the wrong action; stale failures pinned after the VM started elsewhere; confirm dialog stacking above panels; several preview/mock defects.

## 5. Branch map
| Branch | Commits | Contents |
|---|---|---|
| `main` | 10 | First app (untouched since) |
| `feat/shell-overview` | 19 | Shell, visual system, Overview, onboarding, preview |
| `fix/review-findings` | 27 | Review fixes, retry/stale fixes |
| `feat/guided-run` | 34 | Guided Run, Pull panel |
| `feat/networking` | 38 | Networks, Connection doctor |
| `feat/observability` | 43 | Health, events, problems |
| `feat/kubernetes` | 47 | Kubernetes tab, k9s |
| `integration` | 49 | `feat/kubernetes` plus the landscape notes (**use this**) |
| `feat/registries` | 37 | AWS ECR registries tab (unfinished, own branch off `feat/guided-run`) |

## 6. Repository map
- `src/` UI screens; `src/ui/` shared components and tokens; `src/lib/` pure logic with tests (`*.test.ts`); `preview/mock.ts` simulated backend; `src-tauri/src/main.rs` Rust commands and allowlists.
- `scripts/`: `build-preview.mjs`, ten `check-*.mjs` browser suites, `eval-setup.sh` and `eval-teardown.sh`.
- `docs/`: `SPEC.md` (what is left), this summary, `VERIFY-ON-YOUR-MAC.md`, `EVALUATION.md`, `research/` (sourced notes per feature), `superpowers/specs` and `plans` (the shell/overview spec and plan).
- `artifacts/` (in the zip): the preview and the scorecard as single HTML files.

## 7. How to run things
```
npm install && npx tauri icon icon.png        # one time (any square PNG)
npm test                                       # 98 unit + UI tests (10 files, Node 22.6+)
cd src-tauri && cargo test                     # Rust tests: 137 passed, 0 failed, 2 ignored
npm run tauri dev                              # the real app
npm run preview                                # builds preview/index.html (simulated)
# browser suites (need playwright resolvable): node scripts/check-<name>.mjs
```

## 8. Working principles we settled on
Guide plainly, do not try to be clever; research official docs first and keep the sources in `docs/research/`; test first for logic; show the exact command before running anything that changes the machine, and run installs only on a click; never store AWS keys or tokens; link to the image's own documentation instead of encoding per-image rules; say plainly what is unverified.

## 9. Landscape conclusion
ColimaStack (the only Colima-specific GUI found) is early (no releases). Rancher Desktop and Podman Desktop replace Colima rather than sit on top of it. lazydocker and k9s are mature terminal UIs; Portainer, Dockge and Arcane are server dashboards. None of their feature lists mention a connection doctor, plain-language problem explanations, or guided Run (absence is not proof). Recommendation recorded in `docs/research/2026-10-11-landscape.md`: do not rebuild what they do well; integrate (open lazydocker/k9s), borrow (menu bar, diagnostics, command log, list filters and bulk actions), and keep investing in the guidance layer. The evaluation kit lets the owner confirm this on their machine.

## 10. Artifacts
- Preview (simulated, runs in a browser): https://claude.ai/artifact/H36HdsY6Zn7PtP3o6794Z9
- Scorecard for the side-by-side test: https://claude.ai/artifact/8F1uZmXSa639dyh6v9ex7d
- Also in the zip under `artifacts/`.
