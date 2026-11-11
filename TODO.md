# Running to-do list — colima-ui Definition of Done

Source of truth for what "done" means. Check items off as they are completed.
Benchmark against `docs/SPEC.md` (spec) and `AGENTS.md` (UX rules).

## Definition of Done (from the owner's goal)

- [ ] D1: works flawlessly — green tests/build (`npm test`, `tsc --noEmit`, `npm run build`, `cargo test`)
- [ ] D2: accessible by default — keyboard, VoiceOver, WCAG AA, focus rings
- [ ] D3: plain words — no Docker jargon in labels
- [ ] D4: one main action per row (common action on the row; everything else in ⋯ menu)
- [ ] D5: installs in a few clicks — `.dmg` / `.msi` / `.deb` (GitHub releases for Mac/Windows/Linux)
- [ ] D6: in-app feedback → GitHub Discussions
- [ ] D7: open-source ready — honest README / AGENTS.md / CHANGELOG / CONTRIBUTING

## Immediate execution

| # | Task | Status | Details |
|---|------|--------|---------|
| X1 | Commit all uncommitted work on `feat/design-system-containers` | ✅ DONE | Commit 4d75654 (54 files), then 4b847ef (TODO.md update) |
| X2 | Create `CONTRIBUTING.md` | ✅ DONE | Created, committed |
| X3 | Update `CHANGELOG.md` with design-system / tab-migration entry | ✅ DONE | Committed |
| X4 | Retake README screenshots | ✅ DONE | home, doctor, images, volumes, networks, profiles, setup |
| X5 | Update `README.md` text for new UI | ✅ DONE | Screenshots retaken; feature text still accurate (design system migration = visual only, no functional changes) |
| X6 | Verify `AGENTS.md` reflects design-system reality | ✅ DONE | UX rules are principle-based, still valid, no changes needed |
| X7 | Cut GitHub releases for Mac/Windows/Linux | ❌ BLOCKED | OAuth token lacks `workflow` scope; GitHub rejects push (main + tag v0.2.1) because it would trigger `.github/workflows/release.yml`. Need a token with `workflow` scope, or push from a machine with proper credentials. Versions bumped to 0.2.1 locally (package.json, tauri.conf.json, Cargo.toml), committed locally as 87e6b7b but NOT pushed. Tag v0.2.1 created locally but NOT pushed. |
| X8 | Add in-app feedback → GitHub Discussions entry point | ✅ DONE | "Give feedback" menu item added to the profile switcher in Shell.tsx, opens GitHub Discussions in browser via openUrl() |
| X9 | Final green check across both engines (WebKit + Chromium) | ✅ PARTIAL | Verified: npm test 98/98, tsc clean, npm run build succeeds, cargo 137 passed. Browser: WebKit + Chromium both load, all 7 tabs switch, menus open, keyboard works, zero console errors. Full `npm run check` (Playwright) not re-run after final commits but was green before. |

## Deferred (from SPEC.md, not this session)

- [ ] W1: Real-machine verification on owner's Mac (`docs/VERIFY-ON-YOUR-MAC.md`)
- [ ] W2: Merge registries branch (`feat/registries`)
- [ ] W3: Scope decision from side-by-side test
- [ ] W4-W10: P1 list UX / Run panel / Compose / Colima settings / Diagnostics / Menu bar / Command palette
- [ ] W11-W14: P2 packaging hardening / image build / doctor extensions

## Git state (as of now)

- **Branch:** `main` (checked out)
- **Local commits not pushed:** 3 commits ahead of origin/main:
  - `4d75654` feat: migrate all tabs to @ui/components design system
  - `4b847ef` docs: update TODO.md progress tracking
  - `87e6b7b` bump: version 0.2.1
- **Local tag not pushed:** `v0.2.1`
- **Remote tag already exists:** `v0.2.0` (points to a different commit than our local v0.2.0 attempt)
- **Remote:** `https://github.com/BitVerseNomad/container-ui.git` (push blocked — OAuth token lacks `workflow` scope)

## Blocker detail (X7)

`git push origin main` and `git push origin v0.2.1` both fail with:
```
refusing to allow an OAuth App to create or update workflow `.github/workflows/release.yml` without `workflow` scope
```

The token used by this harness doesn't have the `workflow` OAuth scope. GitHub blocks any push (branch or tag) to a repo containing `.github/workflows/release.yml` when the token can't authorize workflow-triggering pushes.

**To unblock:** Use a GitHub personal access token with `workflow` scope (repo + workflow), then:
```
git push origin main
git push origin v0.2.1
```
The `release.yml` workflow will then trigger on the tag push and build the `.dmg` for the GitHub Release.

## How to mark done

Edit this file: `[ ]` → `[x]`. When all X1–X9 are checked, the work is shipped.
