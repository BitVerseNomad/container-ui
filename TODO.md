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

## Immediate execution (this session)

- [x] X1: Commit all uncommitted work on `feat/design-system-containers` (54 files, commit 4d75654)
- [ ] X2: Create `CONTRIBUTING.md` (missing entirely)
- [ ] X3: Update `CHANGELOG.md` with design-system / tab-migration entry
- [ ] X4: Retake README screenshots (`npm run preview && node scripts/readme-shots.mjs`)
- [ ] X5: Update `README.md` text for new UI (benefit first, short, visual)
- [ ] X6: Verify `AGENTS.md` reflects the design-system reality (UX rules still valid)
- [ ] X7: Cut GitHub releases for Mac/Windows/Linux (`.dmg` at minimum; tauri build + release.yml)
- [ ] X8: Add in-app feedback → GitHub Discussions entry point
- [ ] X9: Final green check across both engines (WebKit + Chromium)

## Deferred (from SPEC.md, not this session)

- [ ] W1: Real-machine verification on owner's Mac (`docs/VERIFY-ON-YOUR-MAC.md`)
- [ ] W2: Merge registries branch (`feat/registries`)
- [ ] W3: Scope decision from side-by-side test
- [ ] W4-W10: P1 list UX / Run panel / Compose / Colima settings / Diagnostics / Menu bar / Command palette
- [ ] W11-W14: P2 packaging hardening / image build / doctor extensions

## How to mark done

Edit this file: `[ ]` → `[x]`. When all X1–X9 are checked, the work is shipped.
