# Iteration 1 report

Run on `main` after the last merge. The last merge on `main` is `a4c90b6 Merge branch 'wo-1.5'`. The working tree is clean.

## Work orders

| Work order | Branch | Merge commit on `main` | Result |
| --- | --- | --- | --- |
| WO-0.0 | `wo-0.0` | `f7e9f26` | done |
| WO-0.2 | `wo-0.2` | `d694d41` | done |
| WO-0.3 | `wo-0.3` | `e37d47a` | done |
| WO-0.5 | `wo-0.5` | `b39928a` | done |
| WO-0.4 | `wo-0.4` | `02328bf` | done |
| WO-0.6 | `wo-0.6` | `c8aef29` | done |
| WO-1.1 | `wo-1.1` | `963adf6` | done |
| WO-1.2 | `wo-1.2` | `d91eb79` | done |
| WO-1.3a | `wo-1.3a` | `84499c0` | done |
| WO-1.3b | `wo-1.3b` | `fb9ef8c` | done |
| WO-1.3c | `wo-1.3c` | `5aba9c8` | done |
| WO-1.4 | `wo-1.4` | `713b68b` | done |
| WO-1.5 | `wo-1.5` | `a4c90b6` | done |

No work order was stopped. Every `wo-*` branch is merged into `main`.

WO-0.1 is the owner's signing key work and was not part of the iteration 1 order. The signing key files are still tracked, as the verify script notes.

## Stopped work orders

None. All work orders in the iteration order were completed and merged.

## Verify output

Command:

```bash
sh docs/plan/iterations/verify-iteration-1.sh
```

Exit code: 0.

```text
== the gate
ok   gate: npm run lint
ok   gate: npx tsc --noEmit
ok   gate: npm test
ok   gate: cargo fmt --check
ok   gate: cargo clippy -D warnings
ok   gate: cargo test
ok   gate: npm run check (Chromium and WebKit)
ok   gate: npm run build
== WO-0.0 the gate is green
ok   0.0 eslint-plugin-react-hooks is installed
ok   0.0 no #[allow] was added
== WO-0.2 Lima environments and AI chat removed
ok   0.2 lima.rs is gone
ok   0.2 projects.rs is gone
ok   0.2 migrations are gone
ok   0.2 src/features, src/ai, src/shared are gone
ok   0.2 no file-reading, token or ollama code in Rust
ok   0.2 no sqlx, tokio, uuid, chrono in Cargo.toml
ok   0.2 no xterm in package.json
ok   0.2 the app starts on Containers
== WO-0.3 the preview and the checks
ok   0.3 vite.preview.config.ts exists
ok   0.3 the hand-written bundler is gone
ok   0.3 playwright.config.ts is gone
ok   0.3 scripts/lib/check.mjs exists
ok   0.3 check-start.mjs exists
ok   0.3 the mock coverage test exists
ok   0.3 no check opens a file:// page
ok   0.3 checks-pending: 23 files, 23 rows in its README
ok   0.3 check-entitlements.mjs was not moved to pending
ok   0.3 check-icon.mjs was not moved to pending
ok   0.3 check-version-sync.mjs was not moved to pending
ok   0.3 pending checks were moved, not edited (only the address and storage keys may differ)
== WO-0.5 the repo root
ok   0.5 only expected names at the root
ok   0.5 docs holds only plan, research, screenshots
note the signing key files are still tracked: WO-0.1 is the owner's and is not done
== WO-0.4 the name
ok   0.4 no old name outside the migration
ok   0.4 identifier is dev.openpier.desktop
ok   0.4 Cargo package is openpier
ok   0.4 REPO_URL exists
ok   0.4 migrateStorage is called at startup
== WO-0.6 CI
ok   0.6 ci.yml is valid YAML with jobs web and rust
ok   0.6 ci.yml uses Node 22
== WO-1.1 one stylesheet
ok   1.1 the only CSS file is src/ui/openpier.css
ok   1.1 the shipped stylesheet equals the design
ok   1.1 no tailwindcss or fontsource in package.json
ok   1.1 the design folder is as the author left it (docs/plan/design/SHA256SUMS)
== WO-1.2 contrast
ok   1.2 check-contrast passes
== WO-1.3 components
ok   1.3 32 component files in src/ui/op
ok   1.3 Icon has a component and a test
ok   1.3 Button has a component and a test
ok   1.3 Field has a component and a test
ok   1.3 Select has a component and a test
ok   1.3 Switch has a component and a test
ok   1.3 Chip has a component and a test
ok   1.3 Tabs has a component and a test
ok   1.3 Dot has a component and a test
ok   1.3 Sev has a component and a test
ok   1.3 Tooltip has a component and a test
ok   1.3 Banner has a component and a test
ok   1.3 Empty has a component and a test
ok   1.3 SkeletonRows has a component and a test
ok   1.3 Canvas has a component and a test
ok   1.3 Command has a component and a test
ok   1.3 Tile has a component and a test
ok   1.3 Facts has a component and a test
ok   1.3 GroupCaption has a component and a test
ok   1.3 Row has a component and a test
ok   1.3 Problem has a component and a test
ok   1.3 Menu has a component and a test
ok   1.3 Sheet has a component and a test
ok   1.3 ConfirmDialog has a component and a test
ok   1.3 Toast has a component and a test
ok   1.3 Blocks has a component and a test
ok   1.3 Meters has a component and a test
ok   1.3 Sparkline has a component and a test
ok   1.3 Inspector has a component and a test
ok   1.3 NavItem has a component and a test
ok   1.3 Checkbox has a component and a test
ok   1.3 Progress has a component and a test
ok   1.3 Portal has a component and a test
ok   1.3 lucide-react is imported only by Icon (and the old icons file)
ok   1.3 no inline style in the components except Meters
ok   1.3 no test is skipped
ok   1.3 the gallery exists
ok   1.3 not-migrated list is valid
ok   1.3 no new component file is on the not-migrated list
== WO-1.4 classes
ok   1.4 check-classes passes
== WO-1.5 mockup comparison
ok   1.5 check-mockup.mjs exists
ok   1.5 mockup-pairs.json is empty for now
ok   1.5 the design scenario exists
ok   1.5 the design scenario uses no random or clock values
== across the iteration
ok   no TODO, FIXME or HACK was added
ok   no eslint-disable was added
ok   no stopped work order (every wo- branch is merged into main)
ok   the report exists
ok   pull request text for wo-0.0 exists
ok   pull request text for wo-0.2 exists
ok   pull request text for wo-0.3 exists
ok   pull request text for wo-0.5 exists
ok   pull request text for wo-0.4 exists
ok   pull request text for wo-0.6 exists
ok   pull request text for wo-1.1 exists
ok   pull request text for wo-1.2 exists
ok   pull request text for wo-1.3a exists
ok   pull request text for wo-1.3b exists
ok   pull request text for wo-1.3c exists
ok   pull request text for wo-1.4 exists
ok   pull request text for wo-1.5 exists

105 ok, 0 failed
```

## FOUND.md

```markdown
# Found on the way

- 2026-11-13, `preview/index.html`, a 1.3 MB generated preview page was left on disk by the old bundler. It is untracked and ignored by git, but it still held the deleted Projects and AI code, so the WO-0.2 done-when search matched it. Removed the stale file. WO-0.3 deletes it as part of the new preview.
- 2026-11-13, `README.md`, the contributor line still points to `docs/SUMMARY.md` and `docs/SPEC.md`, which WO-0.5 step 3 deleted. The step 4 search names only the moved files, so these dead links stay. A new contributor follows them to nothing.
- 2026-11-13, `src/ui/tokens.css`, line 42 names the deleted `Table.css` in a comment. The step 4 rule covers an import line, and this file has no import, so the stale comment stays.
```