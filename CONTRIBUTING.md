# Contributing to Container UI

Thanks for wanting to help. Container UI is a Tauri 2 (Rust + React/TypeScript) desktop app for managing Colima/Docker containers. This doc covers how to run, test, and submit changes.

## 1. Getting started

```bash
# Clone and install
git clone https://github.com/OWNER/REPO.git
cd colima-ui
npm install

# Prereqs: Node 22.6+, Rust (rustup), Colima and Docker CLI
brew install colima docker

# Run the real app (needs Tauri)
npm run tauri dev

# Run the UI in a browser against a simulated backend (no Tauri/Rust needed)
npm run preview      # writes preview/index.html
npx vite --port 1420 # dev server with hot reload
```

## 2. Before you change anything

- Read **AGENTS.md** — it has the UX rules (one main action per row, plain words, buttons never wrap, every fix asks first and can be undone, keyboard/VoiceOver support) and the checks to run.
- Read **docs/SPEC.md** — what is left to build, and the Definition of Done per feature.
- Read **docs/SUMMARY.md** — what was built and learned, branch map, repo map.
- Check there isn't already an open issue or PR for what you want to do.

## 3. How to make a change

1. **Branch from `main`**: `git checkout -b feat/your-change`
2. **Make the change**: one logical change per branch/PR. Small, test-first commits.
3. **Run the checks** (both engines — the app ships in WebKit):

```bash
npm test             # TypeScript logic + screen tests in jsdom (vitest)
npx tsc --noEmit     # TypeScript type check
npm run build        # Vite production build
cd src-tauri && cargo test   # Rust tests
```

4. **Browser checks** (WebKit + Chromium):

```bash
npm run check        # builds preview, runs every Playwright browser suite
```

5. **Screenshot review** if a screen changed:

```bash
npm run preview && node scripts/readme-shots.mjs
```

6. **Update docs** if a screen looks or acts differently: README text (benefit first, short, visual) + a line in CHANGELOG.md.

7. **Commit**: small commits with a `Co-authored-by` trailer:

```
feat: your change summary

What the user can now do, not how the code does it.

Co-authored-by: Your Name <you@example.com>
```

8. **Open a PR** from your branch to `main`. Include before/after screenshots for any UI change. A maintainer reviews every PR.

## 4. UX rules (from AGENTS.md — non-negotiable)

1. **One main action per card or row**, the common one (Start when stopped, Stop when running). Everything else goes in the row's `⋯` menu.
2. **Actions are push buttons.** Links only go somewhere (another screen, a web page). Never a link next to a button for doing something.
3. **Every option says when you'd use it.** Menu items get a one-line hint ("After you change a Dockerfile").
4. **Run it, don't make people copy it.** A command to copy is a last resort.
5. **Plain words.** No Docker jargon in labels ("Remove containers", not "Down").
6. **Buttons never wrap.** Shorten the label, or give the row more room.
7. **Every fix asks first, says what it will run, and can be undone or tells you it can't.**
8. **Keyboard and VoiceOver work too.** Accessible names start with the visible words; focus goes somewhere sensible after every action.

## 5. Design system

Shared components and tokens live in `src/ui/`:
- `src/ui/tokens.css` — semantic colors, typography, spacing, elevation, radius
- `src/ui/components/` — Button, Card, Table, Badge, DropdownMenu, Sidebar, Avatar, Separator, ScrollArea, ScrollBar, Tooltip
- `src/ui/index.ts` — barrel exports

Prefer `@ui/components/` over native elements or legacy `./ui` components.

## 6. Testing

- **Unit tests**: `src/**/*.test.ts` (Node, pure logic) and `*.test.tsx` (screens in jsdom via vitest) — `npm test`
- **Rust tests**: `cd src-tauri && cargo test`
- **Browser checks**: Playwright suites in `scripts/` against the preview build — `npm run check` (Chromium + WebKit)

## 7. Questions?

Open an issue with a screenshot. Two lines is plenty.
