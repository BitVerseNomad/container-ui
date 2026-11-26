# 0007. Projects are Compose projects on the selected engine

## Status

Accepted (2026-11-12). The earlier Lima-based Projects code is parked.

## Context

The old Projects feature built a second virtual machine (a Lima instance) and ran everything inside it. It ignored the selected engine, its containers did not show in Containers, and it carried three security findings (see [0005](0005-every-fix-asks-first-and-backend-allowlist.md)). The owner wanted several projects running side by side with no collisions.

## Decision

1. A project is a folder with a Compose file, run as its own Compose project on the selected engine. It is not a VM and not a new runtime.
2. Each project gets a unique name (`-p`).
3. The app never edits the user's Compose file. What it changes goes in a separate override file it owns, passed with `-f`.
4. A start check runs before every Start. It remaps a busy port to the next free one, resets a taken fixed container name, and warns on `network_mode: host`, a shared image name from `build:` and low memory.
5. It stops and asks only when two projects share a named volume or network that is not `external`, because sharing is sometimes the point.
6. The AI chat and the in-app terminal were dropped.

## Consequences

1. Projects work on any engine.
2. The app depends on Compose's `!override` and `!reset` merge tags. The plan marks the lowest supported Compose version as not verified.

Sources: `docs/plan/07-projects-spec.md` (sections 1 to 6), `docs/plan/03-review-product.md` (P3, P9.4), `docs/plan/01-review-engineering.md` (E12) at commit 29b538e.
