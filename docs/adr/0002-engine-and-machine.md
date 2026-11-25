# 0002. Engine and Machine are two separate things

## Status

Accepted (2026-11-12). Partly built: the engine switcher and Colima machine controls exist; other machine drivers do not.

## Context

The first design had five runtime adapters (Colima, OrbStack, Docker Desktop, Podman, Rancher). Only Colima worked. The others threw "Not yet implemented", and the backend only accepted Colima contexts. So "works with the engine you already have" was a picker with nothing behind it. Every one of these runtimes speaks the Docker API and shows up as a docker context.

## Decision

1. An **engine** is one docker context. Containers, images, volumes, networks, Compose, logs, stats and Doctor's container checks work on any engine with no runtime-specific code. The list comes from `docker context ls`.
2. A **machine** is the VM behind an engine. Start, stop, resize, delete, mounts. Only Colima has machine controls. For other runtimes the app shows "managed by" and a button to open that runtime's own app.
3. The backend takes the set of known contexts from Docker, not from the page. A context name must also match a strict pattern, so the page cannot invent one.
4. Colima is the default and the only machine the app can install and start. Colima-only code (setup, mounts, bringing volumes over, VM checks) sits behind the Colima kind. Each Doctor check says which engines it applies to.
5. Stub adapters that throw are deleted. A machine driver is added for one runtime at a time, when someone needs it.
6. In the UI the only two nouns for "where containers run" are Engine and Machine (not runtime, profile, context or instance).

## Consequences

1. With Docker Desktop or OrbStack running and Colima stopped, the app still lists that engine's resources.
2. If the engine claim cannot be built, the product must say "for Colima" and not claim five runtimes.

Sources: `docs/plan/01-review-engineering.md` (E8), `docs/plan/03-review-product.md` (P3), `docs/plan/04-design-spec.md` (sections 5.3, 9) at commit 29b538e.
