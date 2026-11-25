# 0003. Design tokens, one source of style, and a gate against native controls

## Status

Accepted (2026-11-12, updated 2026-11-15 for Tailwind).

## Context

The UI once broke because components used classes that had no CSS, and nothing noticed. A second stylesheet and two copies of many components made it worse.

## Decision

1. Every colour, size, radius, shadow and font is a design token in `src/ui/container-ui.css`. A component never writes a colour, a pixel size or a shadow of its own.
2. Styling is Tailwind CSS v4. `src/ui/tailwind.css` maps the tokens to utilities. No CSS modules, no second stylesheet, no hex values, no Tailwind palette colours, no inline `style` (three components may, because their numbers come from data).
3. Light is the root. Dark is `data-theme="dark"`, set from Settings (Light, Dark, System). A component never checks the theme: a different dark value is a token.
4. Behaviour (focus trap, menus, dialogs, select, tooltip) comes from Radix, unstyled. Icons come from `lucide-react` only.
5. Screens use the app's own controls in `src/ui/op`, which carry `data-op`. A check (`tests/e2e/design-system.spec.ts`) fails on any native button, select or text input outside them, against a baseline that should shrink to empty.
6. A second check fails when a class is used but produces no CSS.
7. Contrast is computed for both themes: body text 4.5:1 or better.

## Consequences

1. A new native control or an undefined class fails CI.
2. If the mockup and the app differ, the app is wrong. To change the design, change the CSS first.

Sources: `docs/plan/README.md` (D3), `docs/plan/04-design-spec.md` (sections 0, 3), `docs/plan/iterations/tailwind-migration.md` at commit 29b538e; `tests/e2e/design-system.spec.ts`, `CHANGELOG.md` 0.3.0 item 30.
