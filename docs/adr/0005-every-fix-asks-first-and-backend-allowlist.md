# 0005. Every fix asks first and can be undone; the backend runs only allowlisted commands

## Status

Accepted. Rule 7 is in `AGENTS.md`; the allowlist is the part of the Rust core to protect.

## Context

An engineering review found the app's own claim "the page can only ask the backend for allowlisted commands" was no longer true. Some commands read any file, exposed a GitHub token in `docker run` arguments, and built a shell string by concatenation.

## Decision

1. The Rust backend runs commands as argument lists (argv), never as a shell string. Each command has an allowlist and a deadline.
2. The page never reads arbitrary files and never receives a token.
3. Every fix asks first in a confirm dialog that states what will happen and shows the exact command to copy.
4. A fix says how it can be undone, or says it cannot be.
5. Delete is the red button, only inside a confirm dialog.
6. A toast with Undo reports a finished action. Errors are banners, not toasts, and keep the last good data below.
7. The app writes nothing into the user's Compose files (see [0007](0007-projects-on-compose.md)).

## Consequences

1. Fixes are slower by one click and safer.
2. Rust tests for argv building are part of the protected asset.

Sources: `docs/plan/01-review-engineering.md` (E2, E3, E4, "What to keep"), `docs/plan/04-design-spec.md` (6.8, 6.9, 6.10), `AGENTS.md` (rule 7), `README.md` ("Safe by design") at commit 29b538e.
