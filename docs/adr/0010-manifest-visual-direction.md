# 0010. Visual direction: Manifest

## Status

Accepted (2026-11-12).

## Context

The first mockup copied another app's warm palette. The owner found it had no identity. Three directions were built as a working prototype.

## Decision

Direction A, "Manifest": cool grey, one cobalt accent, dense tables with fixed columns, and a row of small blocks per service. The other two directions are not built.

1. Colour means state: green healthy, amber needs a look, red broken. The accent marks the current page and the one next step. Nothing else is coloured.
2. A project's health is a row of blocks (running, warning, broken, not running). This is the app's one signature. No second one is added.
3. Machine CPU, memory and disk sit in the header of every list page.
4. Kept from the other app: type sizes, density, one action per row. Dropped: its palette, the tinted primary button, borderless rows.
5. Light and dark follow the Mac. System fonts only, no web font.

## Consequences

1. The mockup and `container-ui.css` are the design source. A disagreement is fixed in the mockup first.

Sources: `docs/plan/README.md` (D7), `docs/plan/04-design-spec.md` (sections 1, 2, 3, 6.13, 6.14) at commit 29b538e.
