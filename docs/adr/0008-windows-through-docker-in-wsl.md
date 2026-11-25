# 0008. Windows runs Docker inside WSL2

## Status

Accepted (as built). Supersedes the 2026-11-12 plan to ship macOS only. The plan says nothing about how Windows would work; this record comes from the code and commits.

## Context

The plan listed Windows and Linux as later, because Setup assumed Homebrew and the VM logic was macOS-only. A Windows port was then built on a `windows-port` branch.

## Decision

1. On Windows the engine is the `docker` inside a WSL2 distro. There is no `docker.exe`, so every engine command goes through `wsl.exe --exec <tool>`. Only `docker`, `kubectl` and `aws` are routed this way.
2. A distro can be picked; otherwise WSL's default answers. Docker Desktop's own distros are not offered.
3. Windows paths are translated to Linux paths (`C:\x` to `/mnt/c/x`, and the `\\wsl$` forms) before they reach a command. The pure parts (argv, paths, distro list) compile and test on every OS.
4. The backend reports the platform. On Windows the app skips Colima and Homebrew setup, Machines, Doctor, VM resize, Open a shell, Show in Finder and the Spotlight Compose scan. macOS is unchanged.
5. Common WSL and Docker failures get plain-word explanations.
6. A `Windows check` workflow compiles and runs the Rust tests on `windows-latest` by hand and on the `windows-port` branch.

## Consequences

1. Windows has one always-running engine and no machine controls.
2. Windows behaviour is tested by the Rust tests and that workflow, not by a full UI run.

Sources: `src-tauri/src/wsl.rs`, `.github/workflows/windows-check.yml`; commits `d9e9e31` and `f40a856`; `docs/plan/03-review-product.md` (P3 item 4, P9.5) at commit 29b538e.
