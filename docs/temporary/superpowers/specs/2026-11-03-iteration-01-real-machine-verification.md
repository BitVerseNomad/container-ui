# Iteration 01: Real-Machine Verification and Rust Compile (W1)

Date: 2026-11-03. Status: awaiting review.

## Intent

Verify the app launches and all existing screens (Containers home, Setup, Run, delete, Networks, doctor, Activity, Volumes sizes, Kubernetes) behave correctly on a real Colima VM, and ensure Rust compiles cleanly. This is the foundation — nothing downstream is safe to build until the existing code works on real hardware.

**Success:** app launches on the owner's Mac; all screens respond; parsers match real Docker/Colima output; list of known fixes is closed.

## Scope

**In:**
- Walk `docs/VERIFY-ON-YOUR-MAC.md` on the real machine
- Capture real outputs: helper container (`nslookup`/`nc`), `docker events` JSON, `docker system df -v --format json`, Colima Kubernetes context names, `docker ps` health text
- Adjust parsers to match real output shapes
- Run `cargo test` on `integration` and `feat/registries`
- Close the list of known fixes

**Out:**
- Building new features (that's iterations 2+)
- AWS/ECR scenarios (W2)
- Compose, list UX, settings, diagnostics, menu bar, command palette (later iterations)

## Commands

- `cargo test` (on `integration`, then `feat/registries`)
- Walk `docs/VERIFY-ON-YOUR-MAC.md` sections 2–3
- `docker ps --format '{{json .}}'` (verify health text)
- `docker events --format '{{json .}}'` (verify fields)
- `docker system df -v --format json` (verify volume sizes show dash if unreadable)
- `kubectl config get-contexts -o name` (verify context name pattern)

## Project Structure

```
docs/VERIFY-ON-YOUR-MAC.md        → Verification checklist (source of truth)
src/                                → App source (existing screens)
src-tauri/src/main.rs              → Rust backend (parsers, handlers)
docs/research/2026-10-11-landscape.md → Existing landscape research
```

## Code Style

- Parsers must handle real Docker output shapes (dash for unreadable sizes, `(healthy)` text)
- No silent failures — if a parser can't handle real output, log and surface the gap
- Tests assert against real output shapes, not mock convenience

## Testing Strategy

- `cargo test` must pass on both `integration` and `feat/registries`
- `npm test` (pure logic) must pass
- All 10 Playwright suites (`scripts/check-*.mjs`) must pass against the preview
- Real-machine outputs captured and compared to parser expectations

## Boundaries

- **Always:** Run `cargo test` before committing Rust changes; walk VERIFY-ON-YOUR-MAC.md end-to-end; capture real outputs
- **Ask first:** Changing parser contracts (affecting other screens); adding new Docker commands
- **Never:** Skip real-machine verification; commit mock-dependent code as "verified"; ignore parser mismatches

## Success Criteria

- [ ] App launches on a real Colima VM (not preview/mock)
- [ ] All screens respond: Containers home, Setup, Run, delete, Networks, doctor, Activity, Volumes sizes, Kubernetes
- [ ] Parsers handle real output: `docker ps` health text, `docker events` JSON fields, `docker system df -v` volume sizes
- [ ] `cargo test` passes on `integration` and `feat/registries`
- [ ] All 10 Playwright suites + unit tests pass
- [ ] List of known fixes from SPEC.md section 6 is closed or documented as known

## Open Questions

- Which Colima profile is being used? (default, or `colima-<profile>`)
- Does the helper container (`nicolaka/netshoot`) download correctly on the target machine?
- Are there any macOS permissions (Terminal/osascript) that need one-time approval?

## References

- `docs/VERIFY-ON-YOUR-MAC.md` — verification checklist
- SPEC.md section 6 — known issues and unverified assumptions
- SPEC.md section 2 — current architecture (UI + Rust backend)
