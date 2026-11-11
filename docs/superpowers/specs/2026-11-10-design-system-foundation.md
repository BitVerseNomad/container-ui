# Design System Foundation: shadcn/ui + Radix + Tailwind

Date: 2026-11-10. Status: approved.

## Intent

Establish a stable, ownable design system foundation for the colima-ui Tauri app that enables evolutionary UI improvements without full overhauls. The system must be:
- **Owned** — no external version upgrades breaking UI
- **Accessible** — WCAG AA by default via Radix primitives
- **Performant** — zero runtime CSS-in-JS, works in WebKit (Tauri)
- **Evolutionary** — token changes propagate everywhere; component APIs stay stable

## Decision

Adopt **shadcn/ui + Radix UI + Tailwind CSS** as the design system stack.

### Stack Breakdown

| Layer | Package | Role | Why |
|-------|---------|------|-----|
| Primitives | `@radix-ui/react-*` | 50+ unstyled, accessible components (Dialog, Dropdown, Tabs, Select, Tooltip, etc.) | Battle-tested a11y, zero styling opinions, React 19 ready |
| Components | shadcn/ui (copied source) | Pre-built components on Radix (Button, Table, Card, Sidebar, Sheet, Badge, Avatar, Separator, ScrollArea) | You own the source. No `npm update` surprises. Modify once, it's yours. |
| Styling | Tailwind CSS | Utility-first, design tokens as config | Tokens live in `tailwind.config.js` + `tokens.css`. No runtime. Works in WebKit. |

### What We Reject

| Option | Reason |
|--------|--------|
| Material UI | Google's design language, heavy bundle, theming complexity, "web app" feel |
| Bootstrap | Opinionated defaults you fight, dated aesthetic |
| Ark UI / Base UI / Panda CSS | Too new, insufficient production hardening |
| CSS-in-JS (styled-components, emotion) | Runtime overhead, WebKit compatibility risk, no token portability |

## Scope

### In (This Spec)

- [ ] Tailwind CSS v4 setup with custom design tokens
- [ ] `tokens.css` as single source of truth for colors, spacing, typography, elevation, radius
- [ ] shadcn/ui components copied to `src/ui/components/`:
  - `Button` (variants: default, destructive, ghost, link, outline, secondary)
  - `Card` (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter)
  - `Table` (Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption)
  - `Badge` (variants: default, secondary, destructive, outline, success, warning)
  - `DropdownMenu` (DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel)
  - `Sidebar` (Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuSub, SidebarMenuSubButton)
  - `Avatar` (Avatar, AvatarImage, AvatarFallback)
  - `Separator`
  - `ScrollArea` (ScrollArea, ScrollBar)
  - `Tooltip` (Tooltip, TooltipTrigger, TooltipContent, TooltipProvider)
- [ ] `src/ui/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- [ ] `src/ui/index.ts` — barrel exports
- [ ] Example `ContainerCard` component demonstrating the system
- [ ] Storybook setup for component development
- [ ] Visual regression test baseline (Playwright)

### Out

- Redesigning any existing tabs (Containers, Projects, Images, etc.) — separate specs
- Migration of existing `Button` components in Shell.tsx/Containers.tsx — follow-up work
- Dark mode polish beyond token definition — follow-up
- Animation/transition system — follow-up

## Token Design

### Color Palette (Semantic, CSS Custom Properties)

```css
:root {
  /* Base */
  --bg: #FAFAFA;
  --bg-elevated: #FFFFFF;
  --fg: #1A1A1A;
  --fg-muted: #6B6B6B;
  --border: #E5E5E5;

  /* Brand */
  --accent: #0066CC;
  --accent-hover: #0052A3;
  --accent-muted: #E8F0FE;

  /* Status — semantic, not decorative */
  --success: #007A33;
  --success-bg: #E6F4EA;
  --warning: #B54708;
  --warning-bg: #FFF4E5;
  --danger: #C00000;
  --danger-bg: #FCE8E6;
  --info: #0066CC;
  --info-bg: #E8F0FE;

  /* Focus */
  --focus: #0066CC;
  --focus-ring: 0 0 0 2px rgba(0, 102, 204, 0.3);
}

.dark {
  --bg: #0D0D0D;
  --bg-elevated: #161616;
  --fg: #F5F5F5;
  --fg-muted: #9E9E9E;
  --border: #2D2D2D;
  --accent: #4D9FFF;
  --accent-hover: #7AB3FF;
  --accent-muted: #1A3A5C;
  --success: #4ADE80;
  --success-bg: #052E16;
  --warning: #FBBF24;
  --warning-bg: #3D2B00;
  --danger: #FF6B6B;
  --danger-bg: #3D0A0A;
  --info: #4D9FFF;
  --info-bg: #1A3A5C;
  --focus: #4D9FFF;
  --focus-ring: 0 0 0 2px rgba(77, 159, 255, 0.4);
}
```

### Typography

| Role | Font | Scale |
|------|------|-------|
| Display | `JetBrains Mono` | 28px / 600 / 1.2 |
| Heading | `Inter` | 20px / 600 / 1.3 |
| Body | `Inter` | 14px / 400 / 1.5 |
| Body-sm | `Inter` | 12px / 400 / 1.5 |
| Mono | `JetBrains Mono` | 13px / 400 / 1.5 |
| Mono-sm | `JetBrains Mono` | 11px / 400 / 1.5 |

### Spacing (4px base)

`xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px, 2xl: 48px`

### Elevation

| Level | Shadow | Use |
|-------|--------|-----|
| 0 | none | Flat elements, tables |
| 1 | `0 1px 2px rgba(0,0,0,0.05)` | Cards, sidebar items |
| 2 | `0 4px 8px rgba(0,0,0,0.08)` | Dropdowns, tooltips |
| 3 | `0 12px 24px rgba(0,0,0,0.12)` | Modals, drawers |

### Border Radius

`sm: 4px` (buttons, inputs), `md: 8px` (cards, panels), `lg: 12px` (modals)

## Architecture

```
src/
├── ui/                          # DESIGN SYSTEM (stable, versioned)
│   ├── components/              # shadcn/ui components YOU OWN
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── sidebar.tsx
│   │   ├── avatar.tsx
│   │   ├── separator.tsx
│   │   ├── scroll-area.tsx
│   │   ├── tooltip.tsx
│   │   └── ...
│   ├── tokens.css               # SINGLE SOURCE OF TRUTH
│   ├── utils.ts                 # cn() helper
│   └── index.ts                 # Barrel exports
├── features/
│   ├── containers/
│   │   ├── ContainerCard.tsx    # Uses ui/components/Card + Table + Badge
│   │   ├── ContainerTable.tsx   # Uses ui/components/Table
│   │   └── ...
│   ├── projects/
│   └── ...
└── app/                         # App shell (Shell.tsx, App.tsx)
```

**Contract:** Components consume tokens via Tailwind classes (`bg-[var(--bg-elevated)]`, `text-[var(--fg)]`, etc.). Features compose components. **Never bypass tokens with arbitrary values.**

## Evolution Guarantees

| Change | How | Impact |
|--------|-----|--------|
| New brand color | Update `tokens.css` + `tailwind.config.js` once | All components update automatically |
| Rounder cards | Change `--radius-md` in tokens | All cards, buttons, inputs update |
| New button variant | Add to `Button.tsx` variant map | Existing call sites unchanged |
| Dark mode tweak | Adjust `.dark` token values | Entire app responds |
| Radix upgrade | Update `@radix-ui/*` deps | Zero UI changes (unstyled primitives) |

**Component APIs are contracts.** We version-break them intentionally, never accidentally.

## Commands

- `npm install -D tailwindcss@next @tailwindcss/vite` — Tailwind v4
- `npm install clsx tailwind-merge class-variance-authority` — Utilities
- `npm install @radix-ui/react-*` — Primitives (per component)
- `npx shadcn@latest add button card table badge dropdown-menu sidebar avatar separator scroll-area tooltip` — Scaffold components
- `npm run storybook` — Component development
- `npm run test:visual` — Playwright visual regression

## Testing Strategy

- **Unit:** Component render + variant tests (Vitest + React Testing Library)
- **Visual:** Storybook stories + Playwright screenshot comparison
- **A11y:** axe-core in CI (Radix gives us most of this free)
- **Integration:** Existing Playwright suites must pass

## Boundaries

- **Always:** Use `tokens.css` values via Tailwind arbitrary values (`bg-[var(--bg)]`) or Tailwind config mappings
- **Always:** Export components from `src/ui/index.ts` — no deep imports
- **Ask first:** Adding new Radix primitives (bundle size), changing component prop APIs
- **Never:** Hardcode colors (`#0066CC`), spacing (`16px`), or radii (`8px`) in feature components
- **Never:** Import from `src/ui/components/*` directly in features — use barrel export

## Success Criteria

- [ ] `npm run build` succeeds with Tailwind v4
- [ ] All 9 shadcn/ui components render in Storybook with light/dark modes
- [ ] `ContainerCard` example composes 3+ ui components correctly
- [ ] Visual regression baseline captured
- [ ] Existing `npm test && cd src-tauri && cargo test` still passes
- [ ] Zero hardcoded design values in new `ui/` code

## Open Questions

- [ ] Should we use Tailwind v4 (CSS-first) or v3 (config-first)? **Decision: v4** — simpler, faster, native CSS variables
- [ ] Font loading strategy? **Decision: `@fontsource` packages** — self-hosted, no Google Fonts requests
- [ ] Icon system? **Decision: `lucide-react`** — tree-shakeable, consistent stroke weight, 1000+ icons

## References

- shadcn/ui: https://ui.shadcn.com/
- Radix UI: https://www.radix-ui.com/
- Tailwind CSS v4: https://tailwindcss.com/blog/tailwindcss-v4
- Existing specs: `docs/superpowers/specs/2026-11-03-iteration-01-real-machine-verification.md`