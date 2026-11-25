# Architecture decision records

An ADR is a short note about one decision: what we faced, what we chose, and what follows. They replace the working diary in `docs/plan/`, which is gone from the tree and stays in git history (for example `git show 29b538e:docs/plan/04-design-spec.md`). Each ADR ends with a Sources line that names the original file and the commit.

The plan files call the app OpenPier. The app is now Container UI (see `CHANGELOG.md`, 0.3.0). The ADRs use the current name.

Format: Status, Context, Decision, Consequences, Sources. To change a decision, add a new ADR and mark the old one "Superseded by NNNN". Do not rewrite history.

| No. | Title | Status |
|---|---|---|
| [0001](0001-tauri-over-electron.md) | Tauri 2 over Electron | Accepted |
| [0002](0002-engine-and-machine.md) | Engine and Machine are two separate things | Accepted, partly built |
| [0003](0003-design-tokens-and-design-system-gate.md) | Design tokens, one source of style, and a gate against native controls | Accepted |
| [0004](0004-one-main-action-and-plain-words.md) | One main action per row, and plain words | Accepted |
| [0005](0005-every-fix-asks-first-and-backend-allowlist.md) | Every fix asks first and can be undone; the backend runs only allowlisted commands | Accepted |
| [0006](0006-preview-with-mock-backend.md) | A browser preview with a mock backend, and checks in WebKit and Chromium | Accepted |
| [0007](0007-projects-on-compose.md) | Projects are Compose projects on the selected engine | Accepted |
| [0008](0008-windows-through-docker-in-wsl.md) | Windows runs Docker inside WSL2 | Accepted |
| [0009](0009-manual-release-and-unsigned-builds.md) | Manual release workflow and unsigned builds | Accepted |
| [0010](0010-manifest-visual-direction.md) | Visual direction: Manifest | Accepted |

See also: [UI principles](../design/ui-principles.md), [AGENTS.md](../../AGENTS.md).
