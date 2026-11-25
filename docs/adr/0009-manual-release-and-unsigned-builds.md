# 0009. Manual release workflow and unsigned builds

## Status

Accepted. The signing choice dates from 2026-11-12; the manual trigger is in the workflow file.

## Context

The first release workflow could not produce a working update, and it still held text from another project. There is no Apple Developer account, and no signing secrets exist.

## Decision

1. The release workflow runs only by hand (`workflow_dispatch`, with a version and a dry-run option). Publishing a release by hand must not start it, or it would overwrite the release notes and add unsigned extra files.
2. It builds a `.dmg` for Apple Silicon and one for Intel.
3. Builds are ad-hoc signed, not notarised. On first launch macOS asks the user to allow the app in System Settings, Privacy and Security. The README says so.
4. The install script (`scripts/install.sh`) never uses `sudo` and never changes Gatekeeper settings.
5. CI runs on every push and pull request in `.github/workflows/ci.yml`.
6. The licence is MIT.

## Consequences

1. Some people stop at the macOS warning, and the official Homebrew cask is not possible.
2. With a paid account, the plan describes how to add signing and notarisation.
3. The README still says to push a version tag. The workflow file says manual only. Treat the workflow as the truth and fix the README.

Sources: `.github/workflows/release.yml` (header comment), `docs/plan/03-review-product.md` (P9.2, P9.3), `docs/plan/06-open-source-launch.md` (sections 4 to 6) at commit 29b538e; `README.md` (Install, Release).
