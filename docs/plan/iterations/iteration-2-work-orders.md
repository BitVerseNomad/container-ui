# Iteration 2: work orders

## What this iteration delivers

1. The app has hash routes, a new shell (sidebar, header, engine switcher, Help, Activity, palette) and every shortcut in spec section 10 that has a screen to go to.
2. Containers, Container detail and the Run, Pull and Compose-start sheets are rebuilt on the new components and match the mockup; the old checks for them are back and pass in Chromium and WebKit.
3. Images, Volumes, Networks, Kubernetes, Doctor and Profiles stay on the old code (iteration 3). They still work inside the new shell.

## Order

WO-2.1, WO-2.2, WO-2.3, WO-2.4, WO-2.5, WO-3.1a, WO-3.1b, WO-3.1b-2, WO-3.1c-1, WO-2.6, WO-3.1c-2, WO-3.1c-3, WO-3.2, WO-3.3a, WO-3.3b, WO-3.3c.

**All sixteen belong to this iteration** (WO-3.1b-2 finishes WO-3.1b; WO-3.1c is done in three parts; WO-2.6 comes after WO-3.1c-1 because the states of WO-3.1c-1 are what its check looks at). A work order number is the step of the plan (`05-implementation-plan.md`), not the iteration: WO-3.1a to WO-3.3c are iteration 2 work. This iteration ends only after WO-3.3c is merged and `sh docs/plan/iterations/verify-iteration-2.sh` prints `0 FAIL`. Stopping after WO-2.5 is stopping halfway.

Splits (each must fit in one pull request): WO-3.1 is split into 3.1a (row model, pure code), 3.1b (the screen), 3.1c (states, scenarios, checks). WO-3.1 is the pattern WO-3.2 and WO-3.3 copy. WO-3.3 is split into 3.3a (Run), 3.3b (Pull), 3.3c (Compose start and logs).

## How to read these work orders

0. There are no GitHub pull requests: the implementer does not push. Each work order is on branch `wo-<id>`, its "pull request" is the file `docs/plan/iterations/pr/wo-<id>.md` (screenshots in `docs/plan/iterations/pr/wo-<id>/`), and it is merged with `git merge --no-ff wo-<id>` into the local `main`. Wherever a step says "write it in the pull request", write it in that file.

1. Read `../HANDOFF.md` and `README.md` (this folder) first.
2. Every work order is written for the repo after iteration 1 is merged. Its "Starting state" proves that. If an output differs, stop and report (see README, "What stop and report means").
3. Find code by the quoted text, never by line number.
4. Words on screen, class names and sizes come from `docs/plan/design/container-ui.css`, `docs/plan/design/mockup.html` and `docs/plan/04-design-spec.md` (called "the spec"). Nothing here is invented, and the author closed the design gaps (decisions of 2026-11-12): every class and component a step names exists. "Stop and report" stays only for a Starting state that does not match, a command whose output differs, or a class or word that is still missing (name it in the pull request file).
5. Old browser checks wait in `scripts/checks-pending/` (see its `README.md`). A work order that names one brings it back: `git mv` it to `scripts/`, rewrite it on `scripts/lib/check.mjs` with the new routes, selectors and words, and make it pass in Chromium and WebKit. Every behaviour the old script proved is listed in the work order, one line each, as **kept**, **moved** (to the work order named) or **gone by design** (with the spec rule that removes it). A behaviour may not vanish without a line.

## The UI contract (used by every work order below)

Iteration 1 built the components in `src/ui/op/` (WO-1.3a, 1.3b, 1.3c). Import them as `from "./ui/op"` (path relative to the file). They live in `op` because the old `src/ui/index.ts` exports old components with the same names until WO-5.1, which moves them up. The props below are the real ones, copied from `iteration-1-work-orders.md`. A work order here extends a component in `src/ui/op` only for an app piece (`Menu` open and radio items, `EngineButton`, `Palette`, `Row` `onMenuKey`, `Problem`), in a step named **Extend**, with the exact prop, markup, class and tests, and only classes that exist in `container-ui.css`. Nobody changes a component anywhere else.

1. `<Button variant="default" | "primary" | "danger" | "ghost" size="xs" | "sm" | "md" icon={IconName} iconOnly busy>`: renders `.btn` plus `.primary`, `.danger`, `.ghost`, `.xs`, `.md`, `.icon-only`. Default size is `sm`. `iconOnly` needs `aria-label`. A label goes in children. An icon with a label: `<Button icon="play">Start</Button>`.
2. `<Icon name={IconName} size="sm" | "md" />`. The names that exist: `search plus more chev-down chev-right close copy check error alert info download play stop restart trash external folder box image database network cluster doctor settings sidebar terminal logs refresh command back activity help updown chev-up`. A work order that needs another icon adds it in its own step.
3. `<Dot state="ok" | "warn" | "bad" | "busy" | "off" label? />`: `.dot` plus the state class (nothing for `off`). With `label` it has `role="img"`, else `aria-hidden`. `<Sev level="bad" | "warn" | "info" | "ok" />`: an icon with classes `sev bad` and so on.
4. `<Chip>` is a plain `span.chip`. A chip you can press is `<ChipButton pressed icon onClick>` (`button.chip`, `aria-pressed` only when `pressed` is given; `icon` is a small icon before the label, and a folded section line is `<ChipButton icon="chev-right" aria-expanded>`). `<Tabs value onChange items={[{ value, label }]} aria-label aside>` with `<TabPanel value>` children (role tablist, each `role="tab"` with `aria-selected`). `aside` is the controls on the right of the tabs row; they are not tabs.
5. `<Field icon="search" size="sm" | "md" width="search" | "filter" | "port" | "num" invalid onClear aria-label placeholder value onChange />`: `Field` IS the input (it renders `label.field` around it and passes every input prop on). `<Fields>` puts fields side by side (words between them are `<span className="muted nowrap">`). `<FormRow label hint htmlFor>`. `<Select value onChange options={[{ value, label, hint }]} aria-label size width="pick" | "num" />`. `<Switch checked onChange aria-labelledby />`. `<Checkbox checked onChange>{label}</Checkbox>`. `<Progress value max aria-label />` (`value` null means busy).
6. `<Menu trigger={<Button .../>} label="..." align="start" | "end" wide>` with children `<MenuItem label why shortcut danger disabled icon onSelect />` (the label is a prop, not a child; `shortcut` is the text on the right), `<MenuSeparator />`, `<MenuCaption>`. Items are `role="menuitem"` inside `.pop`. Use `wide` (280 px) when items carry a hint. `<MoreButton name="kafka" />` is the "..." button; it forwards its ref and props, so it works as a `Menu` trigger. The menu has no radio items and no controlled `open`; WO-2.3 adds both in its step 2.
7. `<Sheet open onClose title hideTitle fact busy stack footer>`; the body is `children`. `fact` is the grey text next to the title. `footer` is the `.sheet-foot` content. `busy` blocks Escape and the overlay click. `stack` makes the body a column with gaps. Renders `.overlay` and `.sheet`, inside the `.main` element through `PortalProvider`.
8. `const confirm = useConfirm()` (from `./ui/op`), then `await confirm({ title, body, command, confirm: "Remove", danger, option })` returns a boolean. `body` is text or JSX; `command` is optional and shows as a `Command`; `option` is `{ label, checked, onChange }` and draws one checkbox. NOT the old `useConfirm` of `./ui` (`(message, label, opts)`), which unmigrated files keep using; WO-2.2 (Providers) mounts both.
9. `<Banner tone="bad" | "warn" | "info" title="..." actions>` with body as children. Without `title` it is the one-line banner (`.banner.line`: the sentence and its action).
10. `<Empty icon={IconName} title="..." actions>` with body as children (`.empty`). `<SkeletonRows rows={4} />` (`.skeleton`).
11. `const toast = useToast()`, then `toast({ text, action: { label, onSelect } })`. Needs `ToastProvider`. Iteration 1 mounts it only in the gallery; WO-2.2 (Providers) mounts `ToastProvider` and the new `ConfirmProvider` inside `main.main` in `src/Shell.tsx`, and `TooltipProvider` in `src/main.tsx`.
12. `<Inspector open onClose crumb title lede evidence findings actions command />`: `evidence` is `{ text, bad? }[]`, `findings` is `string[]`, `actions` is a node. See WO-3.1b step 3. Never write `.ins` markup by hand.
13. `<Blocks services={[{ name, state, label }]} />` renders `span.blocks` and adds the "+n" block itself when there are more than nine. `<Meters meters={[{ label: "CPU" | "Memory" | "Disk", share, text, hot }]} onOpen />` renders one `button.meters` (it is already a button) or nothing when the list is empty. `<Sparkline points={number[] | null} label />`.
14. Rows: `<List aria-label>`, `<RowHead menuGap>`, `<Row lead dot name nameClass title meta metaSelectable tall action menu child onOpen selected onSelect expanded onToggle>` with `<Col kind="ports" | "stats" | "state" | "state-wide" | "state-words" | "size" | "age" | "age-short" | "id" | "subnet" | "ready" | "restarts" | "inside" | "mac" | "cpu" mono>` children, `<Dim>` (the muted part of a name), `<Members>` (chips in place of the meta), `<Problem level="bad" | "warn" text action child onOpen />` (`text` is a string), `<GroupCaption count>`. `Row` handles Enter, Space, arrows, Left and Right, the hover checkbox (also on a group row, in place of its dot) and click isolation itself. WO-3.1b step 2 adds `onMenuKey` and a portal-safe click to `Row`, and more levels to `Problem`. A plain label-and-key line (the Help sheet) may be a hand-written `div.row`; `div` is not banned.
15. `<Canvas lines={[{ text, time, level }]} aria-label ref onScroll fill wrap />` is the log block (`fill`: it takes the rest of a `.stack` and scrolls inside itself). `<Command text onCopied />` is the one-line command with a copy button; it is NOT a list. `<Tiles>`, `<Tile label value>`, `<Facts items={[{ label, value }]} />` (a `div.facts` with one span per item), `<Tooltip text shortcut>`, `<NavItem href icon label current count countBad countLabel />`, `PortalProvider` and `usePortalContainer`.

Rules that hold in every work order:

1. No `<button`, `<select`, `<table`, `style=` in a migrated file. No hex colour, no `Npx` number. ESLint enforces this. Colours, sizes, shadows: never written in a screen; only classes from `container-ui.css`. The gate `node scripts/check-classes.mjs` fails on a class that `container-ui.css` does not define.
2. A screen WO removes its files from `scripts/not-migrated.json`. The list may only shrink (`node scripts/check-not-migrated.mjs`).
3. Browser checks use `scripts/lib/check.mjs`: `import { BASE, engine, check, open, done } from "./lib/check.mjs"`. `const page = await open(path, { width = 1280, height = 800, colorScheme = "light" })` returns a Playwright page, opens `BASE + path`, and waits for nothing: wait for what you need with `await page.getByRole(...).waitFor()`. `check(cond, message)` prints `ok` or `FAIL`. `done()` ends the run with the right exit code. `engine` is `"chromium"` or `"webkit"` from `PW_ENGINE`. `scripts/check-all.sh` runs every `scripts/check-*.mjs` in both engines, so a new check needs no edit there.
4. Scenario URLs look like `/?scenario=design#/containers`. Scenario `design` is the mockup's data.
5. Every `check(...)` message is written below in words; the implementer turns it into the call.
6. **The mockup check cannot click.** `scripts/check-mockup.mjs` only goes to the `path` of a row and takes a picture. A screen that needs a click first (an open menu, an open sheet, the palette, the engine popover, the inspector, a confirm dialog) cannot be a row. Each such screen is listed under "By eye" in its work order, in `iteration-2-acceptance.md`, and compared with the shots by a person. A row has `mockup`, `path`, `themes`, `threshold` (default 0.005), `mask` and `why` (required above 0.02), and nothing else.

---

## WO-2.1 Hash routes: every page has an address

**Needs:** iteration 1 merged.

**Why:** U17 and E10: the app has no addresses, so back, forward, reload and links do not work, and `App.tsx` keeps the page in one `useState`. Everything in iteration 2 hangs on routes.

**Read first:**
1. `docs/plan/04-design-spec.md` sections 5.2 and 10.
2. `src/App.tsx` (find `useState<Tab>`, `setTab(`, `detailId`).
3. `src/Shell.tsx` (find `export type Tab`).
4. `docs/plan/05-implementation-plan.md` task 2.1.

**Starting state** (run all, from the repo root; stop if any output differs):

1. `git status --short` prints nothing.
2. `grep -n "export type Tab" src/Shell.tsx` prints one line. It lists `"Containers" | "Images" | "Volumes" | "Networks" | "Kubernetes" | "Profiles" | "Doctor"`. If `"Projects"` is in it, stop (iteration 1 should have removed it).
3. `ls src/lib/router.ts src/lib/routes.ts 2>&1` says both do not exist.
4. `grep -c "export" src/ui/op/index.ts` prints a number of at least 28. The components are the ones in "The UI contract" above.
5. `grep -n "^export" scripts/lib/check.mjs` prints `BASE`, `engine`, `check`, `open` and `done`.
6. `ls scripts/checks-pending` lists the old checks.
7. `npm test 2>&1 | tail -5` shows no failures.

**Do not touch:** `src/ui/` (old and `op`), any page file other than `App.tsx` and `Shell.tsx`'s `Tab` use, `src-tauri/`.

**Steps:**

0. Contract check. Run `npx tsc --noEmit`; it must print nothing. Then run `grep -n "export" src/ui/op/index.ts` and paste the output in the pull request. The UI contract above was written from iteration 1's work orders. If a real prop differs from the contract, use the real one, change nothing in `src/ui/`, and write one line under "Contract differences" in the pull request (assumed, real).
1. Write the tests of the next section first and see them fail (`npm test` fails with "Cannot find module").
2. Create `src/lib/routes.ts` (pure, no React). Full content:

```ts
// Routes of the app. Pure functions only: no React, no window. The hook is in router.ts.
export type Page = "containers" | "images" | "volumes" | "networks" | "kubernetes" | "doctor" | "projects" | "settings" | "setup";

export type Route = { page: Page; id?: string; tab?: string };

// Pages with an item in the path ("#/containers/<id>/<tab>") and the tabs of each page.
export const DETAIL_TABS = {
  containers: ["logs", "stats", "settings", "folders", "network", "history"],
  images: ["overview", "layers", "files", "settings"],
  projects: ["services", "logs", "ports", "settings"],
} as const;

// Pages whose first path segment is the tab ("#/settings/engines").
export const PAGE_TABS = {
  kubernetes: ["pods", "deployments", "services", "events"],
  settings: ["general", "machines", "engines", "registries", "updates", "about"],
} as const;

const PLAIN: Page[] = ["volumes", "networks", "doctor", "setup"];

export const DEFAULT_PATH = "#/containers";

// "#/containers/abc/stats" -> { page: "containers", id: "abc", tab: "stats" }. Unknown paths give null.
export function parseRoute(hash: string): Route | null {
  const segments = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const page = segments[0] as Page | undefined;
  if (!page) return null;
  const rest = segments.slice(1);
  if (PLAIN.includes(page)) return rest.length === 0 ? { page } : null;
  if (page in PAGE_TABS) {
    const tabs = PAGE_TABS[page as keyof typeof PAGE_TABS] as readonly string[];
    if (rest.length > 1) return null;
    if (rest.length === 0) return { page, tab: tabs[0] };
    return tabs.includes(rest[0]) ? { page, tab: rest[0] } : null;
  }
  if (page in DETAIL_TABS) {
    const tabs = DETAIL_TABS[page as keyof typeof DETAIL_TABS] as readonly string[];
    if (rest.length === 0) return { page };
    if (rest.length > 2) return null;
    const id = decodeURIComponent(rest[0]);
    if (rest.length === 1) return { page, id, tab: tabs[0] };
    return tabs.includes(rest[1]) ? { page, id, tab: rest[1] } : null;
  }
  return null;
}

// The reverse of parseRoute. An id is encoded, because image names contain ":" and "/".
export function buildPath(route: Route): string {
  const parts = [route.page];
  if (route.id !== undefined) parts.push(encodeURIComponent(route.id));
  if (route.tab !== undefined) parts.push(route.tab);
  return `#/${parts.join("/")}`;
}
```

3. Create `src/lib/router.ts`. Full content:

```ts
import { useSyncExternalStore } from "react";
import { DEFAULT_PATH, Route, buildPath, parseRoute } from "./routes.ts";

export { buildPath, parseRoute } from "./routes.ts";
export type { Page, Route } from "./routes.ts";

const LAST_ROUTE_KEY = "openpier:last-route";

const subscribe = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};
const snapshot = () => window.location.hash;

// Go to a path like "#/images". Setting location.hash keeps the query string (?scenario=design).
export function go(path: string) {
  window.location.hash = path;
}

// Same, without a new history entry (used to fix an unknown address).
export function replace(path: string) {
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}${path}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function rememberRoute(route: Route) {
  try {
    window.localStorage.setItem(LAST_ROUTE_KEY, buildPath(route));
  } catch {
    // Storage can be blocked; the app works without it.
  }
}

function lastRoutePath(): string {
  try {
    const saved = window.localStorage.getItem(LAST_ROUTE_KEY);
    if (saved && parseRoute(saved)) return saved;
  } catch {
    // ignore
  }
  return DEFAULT_PATH;
}

export type RouteState = { route: Route };

// The current route. An empty or unknown address is replaced by the last route you had, else Containers.
// The gallery (#/dev/gallery) never gets here: src/main.tsx renders it instead of <App/>.
export function useRoute(): RouteState {
  const hash = useSyncExternalStore(subscribe, snapshot);
  const route = parseRoute(hash);
  if (route) rememberRoute(route);
  else queueMicrotask(() => replace(lastRoutePath()));
  return { route: route ?? { page: "containers" } };
}
```

4. Edit `src/App.tsx`.
   1. Add `import { useRoute, go } from "./lib/router";` and `import { tabOfRoute, pathOfTab } from "./lib/tabRoutes";`.
   2. Find `const [tab, setTab] = useState<Tab>(` and replace the whole statement with:

```ts
  const { route } = useRoute();
  const tab: Tab = tabOfRoute(route);
  const setTab = useCallback((t: Tab) => go(pathOfTab(t)), []);
```

   3. If `useCallback` is not imported from "react", add it. If `useState` is now unused, remove it only if tsc says so.
   4. Find the effect `if (tab === "Kubernetes" && !kubeOn` and leave it as it is (it calls `setTab`, which now navigates).
   5. In the line with `onNav={(t) => { setDetailId(null);` leave as is. Detail routes are wired in WO-3.2, not here.
5. Create `src/lib/tabRoutes.ts` (maps the old `Tab` names to routes; deleted in iteration 4 with the legacy `Tab`). Full content:

```ts
import type { Tab } from "../Shell";
import type { Route } from "./routes.ts";

// Until the old pages are rebuilt, the app still thinks in Tab names. The page file decides what each route shows.
const PATH_OF: Record<Tab, string> = {
  Containers: "#/containers",
  Images: "#/images",
  Volumes: "#/volumes",
  Networks: "#/networks",
  Kubernetes: "#/kubernetes/pods",
  Doctor: "#/doctor",
  // Machines are in Settings (spec 7.8). Until WO-3.9 that route shows today's Profiles page.
  Profiles: "#/settings/machines",
};

export const pathOfTab = (tab: Tab): string => PATH_OF[tab];

export function tabOfRoute(route: Route): Tab {
  switch (route.page) {
    case "images": return "Images";
    case "volumes": return "Volumes";
    case "networks": return "Networks";
    case "kubernetes": return "Kubernetes";
    case "doctor": return "Doctor";
    case "settings": return "Profiles";
    // Projects and Setup have no page yet (iteration 5 and WO-3.10): they show Containers.
    default: return "Containers";
  }
}
```

6. Shortcuts Cmd+[ and Cmd+]: in `App.tsx`, find the `keyboardShortcuts` array. Add two entries `{ key: "[", meta: true, action: () => window.history.back(), description: "Back" }` and `{ key: "]", meta: true, action: () => window.history.forward(), description: "Forward" }`. Do not remove the old Cmd+0 to 7 here (WO-2.4 does).
7. Gallery: nothing to change. Iteration 1 (WO-1.3c step 2) renders the gallery in `src/main.tsx` before `<App/>` exists, only when `import.meta.env.DEV && window.location.hash === "#/dev/gallery"`. So `useRoute` never sees that address. Run `grep -n "dev/gallery" src/main.tsx` and paste the one line in the pull request. If it is not there, stop and report.

**Tests to write first:**

`src/lib/routes.test.ts` (node:test; `import { test } from "node:test"; import assert from "node:assert/strict";`; relative imports end in `.ts`):

1. `Given the hash "#/containers", When parsed, Then the route is { page: "containers" }`.
2. `Given "#/containers/abc", When parsed, Then the id is "abc" and the tab is "logs"`.
3. `Given "#/containers/abc/stats", When parsed, Then the tab is "stats"`.
4. `Given "#/containers/abc/nope", When parsed, Then the result is null`.
5. `Given "#/kubernetes", When parsed, Then the tab is "pods"`.
6. `Given "#/settings/engines", When parsed, Then the page is "settings" and the tab is "engines"`.
7. `Given "#/volumes/extra", When parsed, Then the result is null`.
8. `Given "#/images/nginx%3A1.27/layers", When parsed, Then the id is "nginx:1.27"`.
9. `Given the empty hash "" and "#" and "#/", When parsed, Then each result is null`.
10. `Given a route with an id containing ":" and "/", When built and parsed again, Then the same route comes back`.
11. `Given every page and every tab in DETAIL_TABS and PAGE_TABS, When built and parsed, Then each round-trips`.
12. `Given "#/dev/gallery", When parsed, Then the result is null` (the gallery is not a route; `main.tsx` handles it).

`src/lib/router.test.tsx` (vitest, jsdom):

1. `Given the hash "#/images", When go("#/volumes") runs, Then location.hash is "#/volumes"`.
2. `Given the address "/?scenario=design#/images", When go("#/volumes") runs, Then location.search is still "?scenario=design"`.
3. `Given an unknown hash "#/nowhere", When a component calls useRoute, Then the hash becomes "#/containers"` (use `await waitFor`).
4. `Given localStorage "openpier:last-route" is "#/images" and the hash is empty, When useRoute runs, Then the hash becomes "#/images"`.
5. `Given localStorage throws on read, When useRoute runs on an empty hash, Then the hash becomes "#/containers"`.

**Done when:**

1. `node --experimental-strip-types --no-warnings --test src/lib/routes.test.ts 2>&1 | grep -E "^# (pass|fail)"` prints `# pass 12` (at least) and `# fail 0`. This is the node part of `npm test` in `package.json`.
2. `npx vitest run src/lib/router.test.tsx 2>&1 | grep -E "Tests "` shows `Tests  5 passed`.
3. `grep -n "useState<Tab>" src/App.tsx` prints nothing.
4. `npm run check` passes (the old pages still work through the new tab mapping).
5. In the preview: open `http://localhost:4173/#/images`: Images shows. Press browser back and forward: they work. Reload on `#/volumes`: Volumes shows.
6. The gate in `../HANDOFF.md` section 5.

**Pull request text:** the file `docs/plan/iterations/pr/wo-<id>.md` (no GitHub pull request exists). Its first line is this title: `wo-2.1: Every page has an address, and back and forward work`

---

## WO-2.2 The new shell: sidebar, header, meters, window

**Needs:** WO-2.1.

**Why:** U1, U2, U8 and U21 (Doctor is cut off at 900 px wide), P2. The shell is the frame of every screen. It also brings back `check-layout.mjs` and `check-restyle.mjs`.

**Read first:**
1. `docs/plan/04-design-spec.md` sections 4, 5.1, 5.2, 5.4, 6.14.
2. Mockup pictures: `docs/plan/design/shots/containers-light.png` and `containers-dark.png`.
3. `src/Shell.tsx` (all), `src/App.tsx` (find `<Shell`, `<PageHeader`, `ResizeProvider`).
4. `scripts/checks-pending/check-layout.mjs` and `check-restyle.mjs` (all).
5. `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`.

**Starting state:**
1. `git status --short` prints nothing; `ls src/lib/router.ts src/lib/routes.ts` lists both.
2. `grep -n "wharf:sidebar-folded\|openpier:sidebar-folded" src/Shell.tsx` prints one line with `openpier:sidebar-folded`. If it prints `wharf:`, stop.
3. `grep -n '"width"\|"minWidth"' src-tauri/tauri.conf.json` prints `"width": 980` and `"minWidth": 720` (the window today).
4. `cat src-tauri/capabilities/default.json` lists `core:event:default` and not `core:window:allow-start-dragging`.
5. `ls scripts/checks-pending/check-layout.mjs scripts/checks-pending/check-restyle.mjs` lists both.
6. `grep -n "export function sumStats" src/lib/usage.ts` prints one line.
7. `grep -n 'case "stats"' preview/mock.ts` prints one line; its `--no-stream` branch returns rows with `Name`, `CPUPerc`, `MemUsage` (this is what the live stats read).
8. `grep -n "ToastProvider\|TooltipProvider" src/main.tsx` prints nothing (iteration 1 mounts them only in the gallery) and `grep -n "ConfirmProvider" src/main.tsx` prints two lines (the import and the use of the old one).
9. `grep -o '"back"\|"activity"\|"help"\|"updown"' src/ui/op/Icon.tsx | sort -u | wc -l` prints `4` (iteration 1 has the icons). `grep -c "NavItem\|PortalProvider\|usePortalContainer" src/ui/op/index.ts` prints at least `3`. If either differs, stop and report.

**Do not touch:** page files (`Images.tsx`, `Volumes.tsx`, `Networks.tsx`, `Kubernetes.tsx`, `Doctor.tsx`, `Profiles*.tsx`), `src/ui/`.

**Steps:**

**Providers.** `src/main.tsx` wraps `<App/>` in the OLD `ConfirmProvider` (imported from `./ui`; its `useConfirm()` takes `(message, label, opts)`). Every screen not yet rebuilt still reads that one, so it stays. The new components need `TooltipProvider`, `PortalProvider`, `ToastProvider` and the new `ConfirmProvider` from `./ui/op`. Sheets, confirm dialogs, the palette and toasts are `position: absolute` and must sit inside the `.main` element (WO-1.3b step 11), so the shell mounts them. In `src/main.tsx` (it is in `scripts/not-migrated.json`; do not add a new file) import `{ TooltipProvider } from "./ui/op"` and wrap `<App/>` like this, leaving the old provider as the outer one: `<ConfirmProvider><TooltipProvider><App /></TooltipProvider></ConfirmProvider>` (keep whatever other wrappers are already there, in the same order). Leave the gallery branch alone: it has its own wrappers. In `src/Shell.tsx` (step 7) the `main.main` element is held in state (`const [mainEl, setMainEl] = useState<HTMLElement | null>(null)`, `ref={setMainEl}`) and its content is `<PortalProvider container={mainEl}><ToastProvider><OpConfirmProvider>{children}</OpConfirmProvider></ToastProvider></PortalProvider>` (`OpConfirmProvider` is `ConfirmProvider` from `./ui/op`, renamed on import because `Shell.tsx` may not import the old one). Both confirm contexts exist until WO-5.1 removes the old one. A migrated file imports `useConfirm` from `./ui/op` (the object form); an old file keeps `./ui`. A screen drawn outside the shell (the old setup screens) does not use the new toast or confirm until WO-3.10. No unit test can import `main.tsx` (it renders on import); `Shell.test.tsx` (test 8) proves a sheet lands inside `.main`, and WO-3.1c's check proves the toast and the confirm show.

1. Window (spec section 4). Edit `src-tauri/tauri.conf.json`: in the window object set `"width": 1180`, `"height": 760`, `"minWidth": 900`, `"minHeight": 600`, and add `"titleBarStyle": "Overlay"` and `"hiddenTitle": true`. Keep the other keys. Verified: both keys exist in `tauri-utils` 2.10.2 `config.rs`. Run `(cd src-tauri && cargo check)`: it must pass (tauri-build validates the file). If it fails on these keys, stop and report.
2. Edit `src-tauri/capabilities/default.json`: add `"core:window:default"` and `"core:window:allow-start-dragging"` to the `permissions` array (verified: the second exists in the Tauri schema). Run `(cd src-tauri && cargo check)` again.
3. Create `src/lib/liveStats.ts` (machine meters and row stats come from one read). Full content:

```ts
import { parseBytes, parsePercent, parseUsage } from "../containerInfo.ts";
import type { Meter } from "../ui/op/Meters.tsx";

// One read of `docker stats --no-stream`, per container name.
export type StatsRow = { Name: string; CPUPerc: string; MemUsage: string };
export type Live = { cpu: number; memBytes: number };
export type LiveMap = Record<string, Live>;

// 10 minutes at one read every 10 seconds.
export const HISTORY_POINTS = 60;
export const STATS_EVERY_MS = 10_000;

export function liveFromRows(rows: StatsRow[]): LiveMap {
  const out: LiveMap = {};
  for (const r of rows) out[r.Name] = { cpu: parsePercent(r.CPUPerc), memBytes: parseUsage(r.MemUsage).used };
  return out;
}

// Add a value to a history, dropping the oldest when it is full.
export function pushPoint(history: number[], value: number, max = HISTORY_POINTS): number[] {
  const next = [...history, value];
  return next.length > max ? next.slice(next.length - max) : next;
}

// Add one read to every container's history. A container missing from the read keeps no history.
export function nextHistory(old: Record<string, number[]>, live: LiveMap): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [name, v] of Object.entries(live)) out[name] = pushPoint(old[name] ?? [], v.cpu);
  return out;
}

export type MachineUsage = { cpuPercent: number; memUsedGb: number; memTotalGb: number; diskUsedGb: number; diskTotalGb: number };

// cpuPercent is the sum of the containers' CPU divided by the VM's cores (docker says 100 per core).
export function machineUsage(live: LiveMap, cpus: number, memTotalGb: number, diskUsedBytes: number, diskTotalGb: number): MachineUsage {
  const sumCpu = Object.values(live).reduce((n, v) => n + v.cpu, 0);
  const memUsed = Object.values(live).reduce((n, v) => n + v.memBytes, 0);
  const gb = (b: number) => b / 1024 ** 3;
  return {
    cpuPercent: cpus > 0 ? Math.min(100, sumCpu / cpus) : 0,
    memUsedGb: gb(memUsed),
    memTotalGb,
    diskUsedGb: gb(diskUsedBytes),
    diskTotalGb,
  };
}

// Bars turn amber above 60 percent for memory and 85 percent for disk (spec 6.14).
export const memHot = (u: MachineUsage) => u.memTotalGb > 0 && u.memUsedGb / u.memTotalGb > 0.6;
export const diskHot = (u: MachineUsage) => u.diskTotalGb > 0 && u.diskUsedGb / u.diskTotalGb > 0.85;

// One decimal below 10, none from 10 up, and no trailing ".0": 5.13 -> "5.1", 8 -> "8", 41.2 -> "41".
export const gbText = (gb: number): string => String(gb < 10 ? Math.round(gb * 10) / 10 : Math.round(gb));

// What the Meters component draws: CPU "12%", Memory "5.1 of 8 GB", Disk "41 of 60 GB". share is 0 to 1.
export function metersOf(u: MachineUsage): Meter[] {
  const share = (used: number, total: number) => (total > 0 ? Math.min(1, used / total) : 0);
  return [
    { label: "CPU", share: Math.min(1, u.cpuPercent / 100), text: `${Math.round(u.cpuPercent)}%` },
    { label: "Memory", share: share(u.memUsedGb, u.memTotalGb), text: `${gbText(u.memUsedGb)} of ${gbText(u.memTotalGb)} GB`, hot: memHot(u) },
    { label: "Disk", share: share(u.diskUsedGb, u.diskTotalGb), text: `${gbText(u.diskUsedGb)} of ${gbText(u.diskTotalGb)} GB`, hot: diskHot(u) },
  ];
}

export { parseBytes };
```

   Check: `grep -n "export function parsePercent\|export function parseBytes\|export function parseUsage" src/containerInfo.ts` prints three lines (`lib/usage.ts` imports all three). If not, stop and report.
4. Create `src/hooks/useLiveStats.ts`: one hook, mounted once in `App.tsx`, no polling elsewhere for stats. Signature: `export function useLiveStats(ctx: string | null, running: boolean): { live: LiveMap; history: Record<string, number[]>; usage: MachineUsage | null }`. Behaviour: when `running` and `ctx` are set, every `STATS_EVERY_MS` it calls `dockerJson<StatsRow>(ctx, ["stats", "--no-stream"])` and `dockerJson<DfRow>(ctx, ["system", "df"])` (`dockerJson` in `src/api.ts` adds `--format {{json .}}` itself; `DfRow` and `parseDf` are in `src/lib/usage.ts`). It sets `live`, calls `nextHistory` for `history`, and `usage` from `machineUsage(live, profile.cpus, gbOf(profile.memory), parseDf(rows).totalBytes, gbOf(profile.disk))`. `profile.memory` and `profile.disk` are in bytes (the mock has `8 * GB`), so convert them with `gbOf` from `src/api.ts` (it rounds to whole GB). When `running` is false it clears all three. Errors keep the last values (no flash). It uses `usePoll` from `src/hooks.ts` for the timing, `usePoll(load, deps, ms, enabled)` with `ms = STATS_EVERY_MS` and `enabled = running && !!ctx`. Write the hook as a thin shell over `liveFromRows`, `nextHistory` and `machineUsage` so the tests below cover the logic.
5. In `src/App.tsx`: call `useLiveStats(ctx, current?.status === "Running")` once. Pass `live`, `history` to the Containers page as props `live` and `history`, and `usage` to the new `Header` through a React context `MachineUsageContext` created in `src/Header.tsx` (export `MachineUsageProvider`). Wrap the page area in `<MachineUsageProvider value={usage}>`.
6. Create `src/Header.tsx`. Props:

```ts
export type HeaderProps = {
  title: string;
  summary?: string;            // "10 · 5 need attention"; joined with " · " by the caller
  back?: { label: string; onBack: () => void };  // detail pages
  stateDot?: DotState;         // imported from ./ui/op
  stateText?: string;
  meters?: boolean;            // default true; false on detail pages
  children?: React.ReactNode;  // the right side: search, buttons, primary last
};
```

   Structure (class names from the mockup, `header(title, sub, right)`):

```
<header className="header" data-tauri-drag-region>
  {back && <Button variant="ghost" iconOnly icon="back" aria-label={back.label} onClick={back.onBack} />}
  <h1>{title}</h1>
  {stateDot && <Dot state={stateDot} />}
  {summary && <span className="sub">{summary}</span>}
  {stateText && <span className="sub">{stateText}</span>}
  <span className="grow" />
  {meters !== false && usage && <Meters meters={metersOf(usage)} onOpen={() => go("#/settings/machines")} />}
  {children}
</header>
```

   `Meters` already renders its own `button.meters` (aria-label "Machine use. Open machine settings") and returns nothing when the list is empty; the header passes `metersOf(usage)` from `liveStats.ts` (CPU "12%", Memory "5.1 of 8 GB", Disk "41 of 60 GB"). When `usage` is null (no machine the app can measure) the header draws no meters. Meters are in list page headers only (decision D5): `meters={false}` on detail pages, as in the mockup. Report this contradiction: the mockup's "Disk 41 of 60 GB" and "Memory 5.1 of 8 GB" cannot come out of the scenario `design` data (`docker system df` adds up to about 7 GB; the ten containers use about 1.2 GB), so the meters are masked in the mockup row and compared by eye only for their look, not their numbers.
   Buttons and fields inside the header are not drag regions: the `Header` root has `data-tauri-drag-region`; children do not (Tauri only drags from the element that has the attribute).
7. Rewrite `src/Shell.tsx` to the mockup `sidebar(active, o)`. Keep the exported name `Shell` and the `Tab` type (it is removed in iteration 4). New props:

```ts
type ShellProps = {
  nav: Tab;                         // current tab (from the route)
  onNav: (t: Tab) => void;
  badges?: Partial<Record<Tab, number>>;   // Doctor: findings needing action
  counts?: { containers?: number };        // total containers, shown muted next to Containers
  hidden?: Tab[];                          // Kubernetes when the engine has no cluster
  engine: React.ReactNode;                 // the engine switcher, rendered inside .sidebar under .titlebar
  onSettings: () => void; settingsActive: boolean;
  onActivity: () => void; onHelp: () => void;
  children: React.ReactNode;               // the main column
};
```

   Structure: `div.app` > `aside.sidebar` (`div.titlebar[data-tauri-drag-region]`, then `div` wrapping `engine`, `nav.nav[aria-label="Main"]` with items Containers, Images, Volumes, Networks, Kubernetes (Kubernetes only when not hidden), `div.nav-spacer`, `nav.nav[aria-label="Health"]` with Doctor and `span.count.bad` (only when the badge is above 0; `aria-label="{n} need action"`), `div.sidebar-foot` with three buttons `<Button variant="ghost" iconOnly icon="settings" aria-label="Settings" onClick={onSettings} />`, `icon="activity"` with `aria-label="Activity: commands the app ran"`, `icon="help"` with `aria-label="Help and shortcuts"`, then `span.grow`, then `<Button variant="ghost" iconOnly icon="sidebar" aria-label="Fold sidebar" />`) and `main.main` with `children`. A nav item is `<NavItem href={path} icon label current={active} count countBad countLabel />` (it renders `a.nav-item`, with `aria-current="page"` and `span.count`); the shell does not write anchors by hand. Clicking calls `onNav` (prevent default, in a wrapper `onClick` on the `nav`). The Settings button gets `aria-current="page"` when `settingsActive`. Icons: Containers `box`, Images `image`, Volumes `database`, Networks `network`, Kubernetes `cluster`, Doctor `doctor`.
   Not in the new sidebar (spec 5.2 rule 4): the shortcuts list, the Runtime select, "Profiles", "Projects" (comes back with iteration 5; the Projects item is NOT drawn until WO-7.5; do not leave a disabled one).
   Fold: Cmd+B and the `Fold sidebar` button toggle `aria-label` between `Fold sidebar` and `Show the sidebar`. Stored in `openpier:sidebar-folded`: `"1"` means folded, anything else or absent means open; the shell writes `"1"` or removes the key, read and written in try/catch. Folded: the shell only adds the class `folded` to the root `div.app`; `container-ui.css` hides the labels, counts and engine text (`.app.folded ...`). Write no CSS and no hiding code.
8. Edit `src/App.tsx`:
   1. Replace the render of `<Shell ...>` with the new props. `engine` for now is the temporary legacy switcher: move the profile `Menu` that today lives inside the old Shell (find `Switch profile`) into a small component `src/LegacyProfileSwitch.tsx` that renders its trigger as `<Button className="engine">` (`className` is a normal button attribute; the 44 px height of `.engine` comes from `container-ui.css`). WO-2.3 deletes this component. Wrap the slot in `div[data-slot="engine"]`.
   2. Remove `{!(tab === "Containers" && detailId) && tab !== "Projects" && <PageHeader title={tab} />}`. Each page now renders its own `Header`. For the old pages that have no header yet (Images, Volumes, Networks, Kubernetes, Doctor, Profiles), render `<Header title={tab === "Profiles" ? "Settings" : tab} />` just above them in `App.tsx`. Containers renders its own in WO-3.1b, so until then `App.tsx` renders `<Header title="Containers" />` too (WO-3.1b removes this line).
   3. Settings gear: `onSettings` is `() => go("#/settings/general")`. Until WO-3.9, `tabOfRoute` maps all settings routes to Profiles (as in WO-2.1), so the page shows today's Profiles page, titled "Settings".
9. Delete the `Cmd+K` button, shortcuts block and Runtime select code from the old Shell (they are gone with the rewrite). The Cmd+K handler stays in `App.tsx` (WO-2.4 rebuilds the palette).
10. `scripts/mockup-pairs.json` (it holds `[]` after WO-1.5): put this row in the array. The check (`PW_ENGINE=webkit node scripts/check-mockup.mjs`, with `npm run preview` running) goes to the `path`, takes a picture, and compares it with the mockup screen of the same name. It cannot click. A mask hides every element that matches the selector in BOTH pages, so each selector below must match in the mockup too:

```json
{ "mockup": "containers", "path": "/?scenario=design#/containers", "themes": ["light", "dark"], "threshold": 0.02, "mask": [".content", ".header .meters", ".header .sub", ".sidebar .count", ".sidebar .engine"], "why": "The list is compared in WO-3.1c. Here only the sidebar and the header are compared, so the list, the live meters, the counts and the engine switcher are masked." }
```

    The default threshold is 0.005. This row is 0.02 and says why: the masks hide most of the page, not because it is loose. Run the check and paste its two `ok` or `FAIL` lines in the pull request. If it fails, open `test-results/mockup/containers-light-diff.png`, fix the shell (never the threshold), and run again. **By eye (the check cannot do these):** the folded sidebar (click Fold), the Activity sheet, and the window at 900x600 (resize the browser; the check always uses 1280x800).
11. Bring back the old checks. `git mv scripts/checks-pending/check-layout.mjs scripts/check-layout.mjs`, and the same for `check-restyle.mjs`. Rewrite both on `scripts/lib/check.mjs` (no own `chromium.launch`, no `file://`, no own `ok`/`bad`). Delete their lines from `scripts/checks-pending/README.md` (the table row). `scripts/check-all.sh` runs every `scripts/check-*.mjs` by itself, so it needs no edit. Also edit `scripts/check-start.mjs` (iteration 1): its line `p.locator(".sidebar nav button")` becomes `p.locator(".sidebar .nav-item")`, because nav items are anchors now. It must still pass in both engines.

    **`check-layout.mjs`: what the old script proved, and where it goes.** Run at 1180x760 and 900x600 (the new default and minimum), scenario `design`:
    1. `.content` exists. **Kept.**
    2. The last button in the sidebar foot is Fold sidebar; the foot holds Settings, Activity, Help. **Adapted** (old: "Commands opens from the bottom").
    3. Nav order is Containers, Images, Volumes, Networks, Kubernetes, then Doctor in the second nav, with no Profiles item. **Adapted** (old order had Profiles).
    4. For every nav item: click it, wait, and the window does not scroll (`document.scrollingElement.scrollHeight <= innerHeight + 1`). **Kept.**
    5. At both sizes the Doctor item is inside the viewport and a click on it shows the Doctor page (U21). **New.**
    6. Containers, open a container's detail (WO-3.2 makes the route; until then this line is added in WO-3.2): log pane scrolls inside itself; scrolling it does not move the page; the window does not scroll. **Moved to WO-3.2** (needs the new detail page).
    7. The switcher sits above the nav, shows the machine state, lists one profile ticked, offers Machines…, opens on the current engine, Escape closes it and returns focus; with two machines both are listed with their state, picking one switches the app, each row has Start or Stop, Start says "Starting…" and the app ends Running, "Machines…" opens Settings. **Moved to WO-2.3** (the same file gets these lines there).
    8. The row's state, main button and ⋯ do not overlap (own columns). **Adapted** to `.col.state`, `.act`, the ⋯ button, compared with `getBoundingClientRect`; added in WO-3.1c with the screen.
    9. At 600 px the top bar fits, ports stay visible, nothing scrolls sideways. **Gone by design**: the minimum width is 900 (spec section 4). Replaced by line 10.
    10. At 900x600 `.content` has no sideways scroll on every page. **New** (also covers old line 9).
    11. With `?k8s=off` the nav has no Kubernetes item and no page scrolls the window. **Kept.**
    12. No page errors at either size. **Kept.**

    **`check-restyle.mjs`:**
    1. No sideways overflow in `.content` on every page, at both sizes. **Kept** (page list: Containers, Images, Volumes, Networks, Kubernetes, Doctor, Settings).
    2. Containers: row actions are a labelled main button and a labelled ⋯ button (`More actions for {name}`); every row's buttons have names. **Moved to WO-3.1c** (needs the new rows).
    3. Containers: no table, icon column or checkbox in the list. **Gone by design**: spec 6.5 rule 7 adds a hover checkbox, and the list is a `role="table"` of divs.
    4. Images rows use `IconButton`; Volumes rows use `IconButton`. **Kept as is** (those pages stay legacy until WO-3.4 and WO-3.5; keep the selectors that work today and print which ones).
    5. Profiles page explains what a profile is, and Stop streams into `.out-log`. **Kept** against the Settings route (`#/settings/machines`) until WO-3.9.
    6. The pull panel shows progress in `.out-log`. **Kept** on the legacy `.drawer` now; **WO-3.3b changes the selector to the `progress` element inside the sheet.**

    Run both in Chromium and WebKit: `node scripts/check-layout.mjs` and `PW_ENGINE=webkit node scripts/check-layout.mjs` (`scripts/lib/check.mjs` reads `PW_ENGINE`; `open(path, { width: 900, height: 600 })` sets the size).
12. `scripts/check-shell.mjs` is not needed: its lines live in `check-layout.mjs` (items 3 to 5, 10, 11).
13. Remove from `scripts/not-migrated.json`: `src/Shell.tsx`, `src/Header.tsx` if listed. Run `node scripts/check-not-migrated.mjs`.

**Tests to write first:**

`src/lib/liveStats.test.ts` (node:test):
1. `Given rows with CPUPerc "12.50%" and MemUsage "512MiB / 7.7GiB", When liveFromRows runs, Then cpu is 12.5 and memBytes is 536870912`.
2. `Given a history of 60 values, When pushPoint adds one, Then the length is still 60 and the oldest is gone`.
3. `Given an old history for web and a read without web, When nextHistory runs, Then web has no history`.
4. `Given two containers using 100 and 50 percent on a 4-core VM, When machineUsage runs, Then cpuPercent is 37.5`.
5. `Given 5.1 GB used of 8 GB, When memHot runs, Then it is true; Given 4 GB of 8, Then false`.
6. `Given 52 of 60 GB, When diskHot runs, Then it is true (86 percent); Given 50 of 60, Then false`.
7. `Given a VM with 0 cores, When machineUsage runs, Then cpuPercent is 0 (no divide by zero)`.
8. `Given 5.13, 8, 41.2 and 0 GB, When gbText runs, Then it returns "5.1", "8", "41" and "0"`.
9. `Given 12.4 percent CPU, 5.1 of 8 GB memory and 41 of 60 GB disk, When metersOf runs, Then it returns three meters labelled CPU, Memory, Disk with texts "12%", "5.1 of 8 GB" and "41 of 60 GB", shares 0.124, 0.6375 and 0.683 (to three decimals), and only Memory is hot`.

`src/Shell.test.tsx` (vitest). Wrap the shell in `TooltipProvider` where a test needs it; a `sheet` is found with `document.querySelector(".sheet")`:
1. `Given badges Doctor 2, When the shell renders, Then the Doctor item has a count with the label "2 need action"`.
2. `Given badges Doctor 0, When rendered, Then there is no count`.
3. `Given hidden ["Kubernetes"], When rendered, Then there is no Kubernetes item`.
4. `Given nav "Images", When rendered, Then only the Images item has aria-current "page"`.
5. `Given the Fold sidebar button is pressed, When pressed, Then localStorage "openpier:sidebar-folded" is "1" and the button is labelled "Show the sidebar"`.
6. `Given the shell renders, Then there is no item named Profiles and none named Projects`.
7. `Given the shell renders with an engine slot, Then the foot has buttons named Settings, Activity: commands the app ran, Help and shortcuts and Fold sidebar`.
8. `Given the shell with a child that opens a Sheet, When it is open, Then the element with class sheet is inside main.main`.

**Done when:**
1. `node --experimental-strip-types --no-warnings --test src/lib/liveStats.test.ts 2>&1 | grep -E "^# (pass|fail)"` shows `# fail 0`; `npx vitest run src/Shell.test.tsx 2>&1 | grep "Tests "` shows 8 passed.
2. `(cd src-tauri && cargo check)` passes; `grep -c "Overlay" src-tauri/tauri.conf.json` prints `1`.
3. `node scripts/check-layout.mjs` and `PW_ENGINE=webkit node scripts/check-layout.mjs` print no `FAIL` and end with the count line from `done()`; same for `check-restyle.mjs`.
4. `ls scripts/checks-pending` no longer lists `check-layout.mjs` or `check-restyle.mjs`.
5. `PW_ENGINE=webkit node scripts/check-mockup.mjs` (with `npm run preview` running) prints `ok mockup: containers-light` and `ok mockup: containers-dark` lines and exits 0. `node scripts/check-start.mjs` still passes in both engines.
6. `grep -n "Switch profile\|Runtime" src/Shell.tsx` prints nothing.
7. By eye (the mockup check cannot click or resize), against `containers-light.png` and `containers-dark.png` (open `http://localhost:4173/?scenario=design#/containers` at 1180x760): sidebar 208 px wide, engine area on top, Containers has a muted count, Doctor sits at the bottom with a red count, the foot has Settings, Activity, Help, then Fold at the right; the header has the title, a muted summary, the three meters (memory amber), then the right-hand slot. At 900x600 the Doctor item is visible.
8. The gate in `../HANDOFF.md` section 5.

**Pull request text:** the file `docs/plan/iterations/pr/wo-<id>.md` (no GitHub pull request exists). Its first line is this title: `wo-2.2: A new shell with meters, a hidden title bar and Doctor always in view`

---

## WO-2.3 Engine switcher: pick which Docker you are looking at

**Needs:** WO-2.2.

**Why:** U2, U4, P1. One control answers "which Docker am I looking at". It replaces the profile box, the Runtime select and every place a profile is picked.

**Read first:**
1. `docs/plan/04-design-spec.md` section 5.3, and section 9 rules 3 and 4 (Engine and Machine).
2. Mockup pictures `docs/plan/design/shots/engine-switcher-light.png` and `-dark.png`.
3. `src/LegacyProfileSwitch.tsx` (made in WO-2.2) and the `Shell` call in `src/App.tsx` (find `data-slot="engine"`).
4. `src/api.ts` (`Profile`, `ctxFor`), `src/App.tsx` (find `vmFromAnywhere`, `runVm`, `pick`, `current`).
5. `scripts/check-layout.mjs` (the switcher lines of the old script are listed in WO-2.2 step 11, item 7).

**Starting state:**
1. `git status --short` prints nothing; `ls src/LegacyProfileSwitch.tsx` lists it.
2. `grep -n "Switch profile" src/*.tsx | head` prints only `src/LegacyProfileSwitch.tsx`.
3. `grep -c "MenuRadioItem\|menuitemradio\|onOpenChange" src/ui/op/Menu.tsx` prints `0` (iteration 1's `Menu` has no radio item and no controlled `open`; step 2 adds them) and `ls src/ui/op/EngineButton.tsx 2>&1` says it does not exist.
4. `grep -n "wharf\|colima-ui" src/App.tsx src/LegacyProfileSwitch.tsx` prints nothing.
5. `grep -c '"updown"' src/ui/op/Icon.tsx` prints at least `1` (iteration 1 has the icon). `grep -c "engines" src/ui/container-ui.css` prints at least `1` (the `.pop.engines` rule). If either differs, stop and report.

**Do not touch:** `src/ui/` (the old components; `src/ui/op/` only as step 2 says), `src-tauri/`, the Profiles page (its job moves to Settings in WO-3.9).

**Steps:**

1. Write the tests below first (the ones for step 2 too).
2. **Extend: Menu and the engine button.** The engine popover needs two things the iteration 1 components do not have. Change only the files named here, and only with classes that exist in `container-ui.css`.
   1. `src/ui/op/Menu.tsx`: `Menu` gets three optional props: `open?: boolean` and `onOpenChange?: (open: boolean) => void`, passed to the Radix `DropdownMenu.Root` as `open` and `onOpenChange`, and `contentClassName?: string`, appended to the class of the content (`pop`, plus `wide` when set). Without them it behaves as before. The engine popover passes `contentClassName="engines"` (`.pop.engines` is 300 px in `container-ui.css`).
   2. Same file: add `export function MenuRadioGroup(props: { value: string; onValueChange: (value: string) => void; children: React.ReactNode }): JSX.Element` (Radix `DropdownMenu.RadioGroup`) and `export function MenuRadioItem(props: { value: string; children: React.ReactNode }): JSX.Element` (Radix `DropdownMenu.RadioItem` with `className="row"`; Radix gives it `role="menuitemradio"` and `aria-checked`). The mockup draws its engine rows as `div.row[role=menuitemradio][aria-checked]`, so the class is `row`. Export both from `src/ui/op/index.ts`.
   3. Create `src/ui/op/EngineButton.tsx` and export it from `src/ui/op/index.ts`. A plain `button.engine` cannot be written in a screen (ESLint bans `<button`), and `Button` would add the `btn` look, so the engine trigger is a component:

```tsx
import { forwardRef } from "react";
import { Dot, DotState } from "./Dot";
import { Icon } from "./Icon";

export type EngineButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { dot: DotState; name: string; state: string };

// The button at the top of the sidebar. It is the trigger of the engine menu, so it forwards its ref and every other prop to the <button>.
export const EngineButton = forwardRef<HTMLButtonElement, EngineButtonProps>(function EngineButton({ dot, name, state, ...rest }, ref) {
  return (
    <button type="button" className="engine" ref={ref} {...rest}>
      <Dot state={dot} />
      <span className="grow"><div className="name truncate">{name}</div><div className="state truncate">{state}</div></span>
      <Icon name="updown" size="sm" className="chev" />
    </button>
  );
});
```

   4. Tests, added to `src/ui/op/Menu.test.tsx` and a new `src/ui/op/EngineButton.test.tsx`: `Given open is true, When rendered, Then the menu content is on screen without a click`; `Given a controlled menu, When Escape is pressed, Then onOpenChange is called with false`; `Given contentClassName "engines", When open, Then the content has classes pop and engines`; `Given a MenuRadioGroup with value "a" and items a and b, When rendered open, Then item a has role menuitemradio and aria-checked "true" and item b has "false"`; `Given an item b, When it is clicked, Then onValueChange is called with "b"`; `Given an EngineButton as the trigger of a Menu, When Enter is pressed on it, Then the menu opens` (this proves `Menu` puts its trigger on the element it is given; if it fails, stop and report); `Given EngineButton with name "Colima · default" and state "Running", Then it has class engine and shows both texts`. Add an `EngineButton` section and a radio group to the gallery (`src/dev/Gallery.tsx`).
3. Create `src/lib/engineModel.ts`. Plan contradiction: iteration 4 (task 4.2) defines a type `Engine` in `src/lib/engines.ts`. To avoid two types with one name this file calls its type `ColimaEngine`; iteration 4 replaces this file. Full content:

```ts
import type { Profile } from "../api";
import { ctxFor, gbOf } from "../api";

export type EngineState = "running" | "stopped" | "starting" | "stopping" | "unreachable";

// Until iteration 4 the only engines are Colima machines.
export type ColimaEngine = {
  id: string;            // the Colima profile name ("default", "work")
  context: string;       // the docker context name (ctxFor)
  caption: "Colima";
  name: string;          // "default"
  label: string;         // "Colima · default"
  state: EngineState;
  managed: true;         // the app can start and stop it
  cpus: number;
  memoryGb: number;
  kubernetes: boolean;
};

export type EngineOptions = { busy?: "starting" | "stopping" | null; kubernetes?: boolean; unreachable?: boolean };

export function engineOfProfile(p: Profile, opts: EngineOptions = {}): ColimaEngine {
  const running = p.status === "Running";
  const state: EngineState = opts.busy ?? (opts.unreachable ? "unreachable" : running ? "running" : "stopped");
  return {
    id: p.name,
    context: ctxFor(p.name),
    caption: "Colima",
    name: p.name,
    label: `Colima · ${p.name}`,
    state,
    managed: true,
    cpus: p.cpus,
    memoryGb: gbOf(p.memory),
    kubernetes: !!opts.kubernetes && running,
  };
}

// The muted line under the label (spec 5.3 rule 2).
export function stateLine(e: ColimaEngine): string {
  switch (e.state) {
    case "running": return `Running · ${e.cpus} CPU · ${e.memoryGb} GB`;
    case "stopped": return "Stopped";
    case "starting": return "Starting…";
    case "stopping": return "Stopping…";
    case "unreachable": return "Not reachable";
  }
}

// The facts on a row of the popover: "4 CPU · 8 GB · Kubernetes", "Stopped".
export function factsLine(e: ColimaEngine): string {
  if (e.state !== "running") return stateLine(e);
  return [`${e.cpus} CPU`, `${e.memoryGb} GB`, ...(e.kubernetes ? ["Kubernetes"] : [])].join(" · ");
}

export const dotOf = (e: ColimaEngine): "ok" | "bad" | "busy" | "off" =>
  e.state === "running" ? "ok" : e.state === "unreachable" ? "bad" : e.state === "starting" || e.state === "stopping" ? "busy" : "off";

// "Engine: Colima, default. Running" (the button's accessible name, as in the mockup).
export const buttonLabel = (e: ColimaEngine): string => `Engine: Colima, ${e.name}. ${stateLine(e).split(" · ")[0]}`;

export type EngineGroup = { caption: string; engines: ColimaEngine[] };
export const groupEngines = (list: ColimaEngine[]): EngineGroup[] => (list.length ? [{ caption: "Colima", engines: list }] : []);

// Which machine an operation in progress belongs to. App.tsx passes { op: vm.op, name: opName(vm) }; "restarting" shows as "starting".
export type BusyInput = { op: "starting" | "stopping" | "restarting" | null; name?: string };
export const busyOf = (b: BusyInput, machine: string): "starting" | "stopping" | null =>
  b.op && b.name === machine ? (b.op === "stopping" ? "stopping" : "starting") : null;

// Which engine is selected: the stored one if it still exists, else the first running one, else the first.
export function chooseEngine(list: ColimaEngine[], stored: string | null): ColimaEngine | null {
  return list.find((e) => e.id === stored) ?? list.find((e) => e.state === "running") ?? list[0] ?? null;
}
```

4. Create `src/EngineSwitcher.tsx`. Props:

```ts
export type EngineSwitcherProps = {
  engines: ColimaEngine[];
  selectedId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onMachines: () => void;
};
```

   Structure (mockup `engineMenu` and the `.engine` button in `sidebar`):
   1. `<Menu open={open} onOpenChange={onOpenChange} contentClassName="engines" label="Engines" align="start" trigger={<EngineButton dot={dotOf(selected)} name={selected.label} state={stateLine(selected)} aria-label={buttonLabel(selected)} />}>`. With no engine (no Colima machine) the trigger is `<EngineButton dot="off" name="No engine" state="Not set up" aria-label="Engine: none" />` and the menu holds only `Machines…`.
   2. Inside the menu, one `<MenuRadioGroup value={selectedId ?? ""} onValueChange={onSelect}>`. For each group of `groupEngines(engines)`: `<MenuCaption>{caption}</MenuCaption>`; for each engine a `<MenuRadioItem value={e.id}>` holding `<Dot state={dotOf(e)} /><span className="name">{e.name}</span><span className="meta grow truncate">{factsLine(e)}</span>` then either `<Icon name="check" size="sm" />` (the selected one) or, when `e.state === "stopped"`, `<Button size="xs" onClick={(ev) => { ev.stopPropagation(); onStart(e.id); onOpenChange(false); }}>Start</Button>`. No button on other states. (The mockup's markup for a row is `div.row[role=menuitemradio]` with exactly these children.)
   3. `<MenuSeparator />`.
   4. `<MenuItem label={`Stop ${selected.name}`} why="Stops the VM. Containers and data are kept" onSelect={() => onStop(selected.id)} />`, only when the selected engine is running. The words are from the mockup.
   5. `<MenuItem label="Machines…" why="Create, resize or delete a Colima VM" onSelect={onMachines} />`.
   6. Keyboard: arrows, Enter and Esc come from `Menu` (Radix). Esc returns focus to the trigger. Cmd+E opens it (WO-2.4 registers the key; this WO exposes `open` and `onOpenChange`).
5. Edit `src/App.tsx`:
   1. Build the list: `const engines = useMemo(() => profiles.map((p) => engineOfProfile(p, { busy: busyOf({ op: vm.op, name: opName(vm) }, p.name), kubernetes: p.name === active && kubeOn })), [profiles, vm, active, kubeOn])`. In `src/App.tsx`, `vm` is `VmState` (`{ op: "starting" | "stopping" | "restarting" | null; failure; last }`), and the machine it belongs to is `opName(vm)` (already defined near the top of the file). `busyOf` is in `engineModel.ts`; `restarting` shows as `starting`.
   2. Selected id: `const selected = chooseEngine(engines, stored)`. `App.tsx` keeps the chosen machine in `const [active, setActive] = useState<string | null>(null)` and `current` is derived from `active`; keep that. Add `const [stored] = useState(() => { try { return localStorage.getItem("openpier:engine"); } catch { return null; } })` and make the existing effect that sets `active` (find `setActive((profiles.find((p) => p.status === "Running")`) prefer `chooseEngine(engines, stored)?.id`. In `switchTo` (the existing function) add `try { localStorage.setItem("openpier:engine", name); } catch { /* not remembered */ }`. No other key stores the chosen machine today.
   3. `onSelect={switchTo}` (the existing function; the name `pick` in `App.tsx` is the host picker, not this). `onStart={(id) => { switchTo(id); setTab("Containers"); void vmFromAnywhere(id, "starting"); }}` (the old behaviour: "switcher Start: switches to dev and shows Containers"). `onStop={(id) => void vmFromAnywhere(id, "stopping")}`.
   4. `onMachines={() => go("#/settings/machines")}`.
   5. `const [engineOpen, setEngineOpen] = useState(false);` and pass `open`, `onOpenChange`.
   6. Replace `<LegacyProfileSwitch .../>` in the `engine` slot by `<EngineSwitcher .../>`. Delete `src/LegacyProfileSwitch.tsx`.
6. Remove every other place that picks a profile: `grep -rn "Switch profile\|profile-switch" src` must print nothing at the end. The Profiles page lists machines; that is its job and stays. Remove any "Runtime" select left anywhere in `src/App.tsx`.
7. The words: "Machine" and "Engine" only (spec section 9 rule 4). The popover must not say "profile", "context" or "VM instance". The two hint lines contain the word "VM" (mockup text); keep them exactly.
8. Folded sidebar: `container-ui.css` hides the engine text when `.app.folded` is set. Nothing to write.
9. Remove from `scripts/not-migrated.json`: `src/LegacyProfileSwitch.tsx` if it was listed. Add nothing.
10. Mockup row: none. The popover only exists after a click, and `check-mockup.mjs` goes to a path and takes a picture; it cannot click. The open popover is compared **by eye** against `engine-switcher-light.png` and `-dark.png` (see "Done when" 4 and `iteration-2-acceptance.md`). Say so in the pull request.
11. Extend `scripts/check-layout.mjs` with the switcher lines. Scenario `design` for one machine, `two` for two machines (default running, dev stopped). Messages in words (all at 1180x760):
    1. The engine button sits above the nav.
    2. Its text says "Colima · default" and the state line says "Running".
    3. Its accessible name is "Engine: Colima, default. Running".
    4. Click: the menu has one `menuitemradio`, it is ticked (`aria-checked="true"`), and focus is on it.
    5. The menu offers "Machines…" and "Stop default".
    6. Escape closes the menu and focus is back on the engine button.
    7. `?scenario=two`: both machines are listed; the stopped one reads "Stopped"; picking it makes the button say "Colima · dev" and Containers says dev is stopped (the stopped state of WO-3.1c; until then, check the button text only).
    8. Each row has a Start button (stopped) or no button (running); the menu has "Stop default" for the selected one.
    9. Start on dev: the button says "Starting…" at once, the page is Containers (`aria-current="page"` on Containers), and it ends "Running" (wait up to 6 s).
    10. "Machines…" changes the hash to `#/settings/machines`.
    11. In WebKit, a mouse click on the Start button inside the menu reaches it (old lesson from `check-menus.mjs`: clicks in menus must work in WKWebView).
    12. The words "profile", "context" and "runtime" (any case) do not appear in the open menu.
    13. Reload: the selected engine is still the one picked (`openpier:engine`).

**Tests to write first:**

`src/lib/engineModel.test.ts` (node:test):
1. `Given a running profile with 4 CPU and memory 8 * 1024 ** 3 bytes (Profile.memory is in bytes), When engineOfProfile runs, Then label is "Colima · default" and stateLine is "Running · 4 CPU · 8 GB"`.
2. `Given a stopped profile, When stateLine runs, Then it is "Stopped"`.
3. `Given busy "starting", When engineOfProfile runs on a stopped profile, Then state is "starting" and stateLine is "Starting…"`.
4. `Given unreachable true, When engineOfProfile runs, Then stateLine is "Not reachable" and dotOf is "bad"`.
5. `Given a running engine with Kubernetes, When factsLine runs, Then it is "4 CPU · 8 GB · Kubernetes"`.
6. `Given the profile "dev", When engineOfProfile runs, Then context is "colima-dev"`.
7. `Given engines default and dev and stored "dev", When chooseEngine runs, Then dev is chosen`.
8. `Given a stored name that no longer exists, When chooseEngine runs, Then the first running engine is chosen`.
9. `Given no engines, When chooseEngine runs, Then it returns null`.
10. `Given a running default, When buttonLabel runs, Then it is "Engine: Colima, default. Running"`.
11. `Given op "restarting" for "dev", When busyOf runs for "dev", Then it is "starting"; for "default", Then null; Given op null, Then null; Given op "stopping" for "dev", Then "stopping"`.

`src/EngineSwitcher.test.tsx` (vitest):
1. `Given two engines and the menu open, When rendered, Then the caption "Colima" shows once and two radio items show`.
2. `Given the stopped engine, When its Start button is pressed, Then onStart gets its id and onSelect is not called`.
3. `Given the selected engine is running, When open, Then "Stop default" is offered; Given it is stopped, Then it is not`.
4. `Given an item is chosen, When pressed, Then onSelect gets its id`.
5. `Given no engines, When rendered, Then the button says "No engine" and the menu offers only "Machines…"`.
6. `Given the menu is open, When Escape is pressed, Then onOpenChange(false) is called`.

**Done when:**
1. `node --experimental-strip-types --no-warnings --test src/lib/engineModel.test.ts 2>&1 | grep -E "^# (pass|fail)"` shows `# fail 0`; `npx vitest run src/EngineSwitcher.test.tsx src/ui/op/Menu.test.tsx src/ui/op/EngineButton.test.tsx 2>&1 | grep "Tests "` shows no failures (the 6 new engine switcher tests, plus the Menu and EngineButton tests of step 2).
2. `grep -rn "Switch profile\|profile-switch\|LegacyProfileSwitch" src` prints nothing.
3. `node scripts/check-layout.mjs` and the WebKit run print no `FAIL`; `check-layout.mjs` has all 13 lines above (`grep -c "check(" scripts/check-layout.mjs` is at least 13 more than after WO-2.2).
4. By eye (open `http://localhost:4173/?scenario=two#/containers`, click the engine button) against `engine-switcher-light.png` and `-dark.png`: button with dot, "Colima · default", muted state line, up-down chevron; popover with a bare caption "Colima", a ticked row, a stopped row with a small Start button, a separator, two items with grey hints. The picture also shows Docker Desktop and OrbStack (iteration 4). The popover is 300 px wide (`.pop.engines`).
5. The gate in `../HANDOFF.md` section 5.

**Pull request text:** the file `docs/plan/iterations/pr/wo-<id>.md` (no GitHub pull request exists). Its first line is this title: `wo-2.3: One engine switcher replaces the profile box`

---

## WO-2.4 Palette, Help and Activity, and one table of shortcuts

**Needs:** WO-2.3.

**Why:** U10, U19, E10. Today the shortcuts live in three places (the key handler, the Help text in Portuguese, the palette) and disagree. Spec section 10 is the one list.

**Read first:**
1. `docs/plan/04-design-spec.md` sections 6.12, 5.2 rules 5 and 6, 10.
2. Mockup pictures `command-palette-light.png`, `command-palette-dark.png`.
3. `src/CommandPalette.tsx`, `src/HelpModal.tsx`, `src/Commands.tsx`, `src/hooks/useKeyboardShortcuts.ts`, `src/lib/activity.ts`, `src/lib/links.ts`.
4. `src/App.tsx` (find `const commands`, `keyboardShortcuts`, `setCommandPaletteOpen`, `setLogOpen`).

**Starting state:**
1. `git status --short` prints nothing.
2. `grep -n "export" src/hooks/useKeyboardShortcuts.ts` prints `KeyboardShortcut`, `useKeyboardShortcuts`, `Command`, `formatShortcut`.
3. `grep -n "preventDefault" src/hooks/useKeyboardShortcuts.ts` prints at least one line. If it prints nothing, step 5 adds it.
4. `grep -n "REPO_URL" src/lib/links.ts` prints one line.
5. `grep -n "type Entry\|export type" src/lib/activity.ts` prints the entry type; write its fields in the pull request.
6. `grep -n "usePoll" src/hooks.ts | head -3` prints the function (step 6 edits it).

**Do not touch:** `src/ui/` (old and `op`), the Containers and Images pages (their Cmd+N and Cmd+P handlers keep today's behaviour until WO-3.3).

**Steps:**

1. Write the tests below first.
2. Create `src/lib/shortcuts.ts`. It is the only list of shortcuts. Full content:

```ts
export type ShortcutId =
  | "palette" | "go-projects" | "go-containers" | "go-images" | "go-volumes" | "go-networks" | "go-kubernetes"
  | "go-doctor" | "go-settings" | "engine" | "fold" | "run" | "pull" | "search" | "search-slash"
  | "back" | "forward" | "refresh" | "help";

export type ShortcutDef = {
  id: ShortcutId;
  key: string;          // as KeyboardEvent.key
  meta?: boolean;       // Cmd
  shift?: boolean;
  label: string;        // the words in Help and in the palette
  group: "Go to" | "Do" | "Page";
  pending?: boolean;    // true until the screen exists; a pending shortcut is not registered and not shown
};

export const SHORTCUTS: ShortcutDef[] = [
  { id: "palette", key: "k", meta: true, label: "Command palette", group: "Do" },
  { id: "go-projects", key: "1", meta: true, label: "Projects", group: "Go to", pending: true }, // WO-7.5 removes `pending`
  { id: "go-containers", key: "2", meta: true, label: "Containers", group: "Go to" },
  { id: "go-images", key: "3", meta: true, label: "Images", group: "Go to" },
  { id: "go-volumes", key: "4", meta: true, label: "Volumes", group: "Go to" },
  { id: "go-networks", key: "5", meta: true, label: "Networks", group: "Go to" },
  { id: "go-kubernetes", key: "6", meta: true, label: "Kubernetes", group: "Go to" },
  { id: "go-doctor", key: "d", meta: true, label: "Doctor", group: "Go to" },
  { id: "go-settings", key: ",", meta: true, label: "Settings", group: "Go to" },
  { id: "engine", key: "e", meta: true, label: "Engine switcher", group: "Do" },
  { id: "fold", key: "b", meta: true, label: "Fold sidebar", group: "Do" },
  { id: "run", key: "n", meta: true, label: "Run an image", group: "Do" },
  { id: "pull", key: "p", meta: true, label: "Pull an image", group: "Do" },
  { id: "search", key: "f", meta: true, label: "Search this page", group: "Page" },
  { id: "search-slash", key: "/", label: "Search this page", group: "Page" },
  { id: "back", key: "[", meta: true, label: "Back", group: "Page" },
  { id: "forward", key: "]", meta: true, label: "Forward", group: "Page" },
  { id: "refresh", key: "r", meta: true, label: "Refresh this page", group: "Page" },
  { id: "help", key: "?", label: "Help and shortcuts", group: "Do" },
];

// List keys are handled by the list itself (WO-3.1b). They are shown in Help only.
export const LIST_KEYS: { keys: string; label: string }[] = [
  { keys: "↑ ↓", label: "Move in a list" },
  { keys: "↵", label: "Open the row" },
  { keys: "Space", label: "Select the row" },
  { keys: "← →", label: "Fold or unfold a group" },
  { keys: "Esc", label: "Close the top layer, else clear the selection, else clear the search" },
];

export const activeShortcuts = () => SHORTCUTS.filter((s) => !s.pending);

// "⌘K", "⌘,", "/" ; used by Help and the palette.
export function showKeys(s: Pick<ShortcutDef, "key" | "meta" | "shift">): string {
  const key = s.key.length === 1 ? s.key.toUpperCase() : s.key;
  return `${s.meta ? "⌘" : ""}${s.shift ? "⇧" : ""}${key}`;
}

// A key typed in a text field is never a shortcut (only Cmd combinations are).
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}
```

3. Edit `src/App.tsx`. Find the `const keyboardShortcuts` array (the `useMemo` that holds `{ key: "0", meta: true ...`). Replace the whole array by:

```ts
  const handlers: Partial<Record<ShortcutId, () => void>> = {
    palette: () => setCommandPaletteOpen(true),
    "go-containers": () => setTab("Containers"),
    "go-images": () => setTab("Images"),
    "go-volumes": () => setTab("Volumes"),
    "go-networks": () => setTab("Networks"),
    "go-kubernetes": () => { if (kubeOn) setTab("Kubernetes"); },
    "go-doctor": () => setTab("Doctor"),
    "go-settings": () => go("#/settings/general"),
    engine: () => setEngineOpen(true),
    fold: () => window.dispatchEvent(new Event("openpier:fold")),
    run: () => { setTab("Images"); },            // unchanged until WO-3.3
    pull: () => { setPullOnOpen(true); setTab("Images"); }, // unchanged until WO-3.3
    search: focusPageSearch,
    "search-slash": focusPageSearch,
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.dispatchEvent(new Event("openpier:refresh")),
    help: () => setHelpOpen(true),
  };
  const keyboardShortcuts = useMemo(
    () => activeShortcuts().filter((s) => handlers[s.id]).map((s) => ({ key: s.key, meta: s.meta, shift: s.shift, description: s.label, action: handlers[s.id]! })),
    [/* the same dependency list the old array had, plus kubeOn */],
  );
```

   `focusPageSearch` is `() => document.querySelector<HTMLInputElement>("[data-page-search]")?.focus()`. The header search field input carries `data-page-search` (WO-3.1b does that for Containers). Remove the old Cmd+0 to 7, Cmd+Shift+A and Cmd+Shift+N entries and the old `commands` entries for them (`switch-projects` through `switch-profiles`, `new-profile`, `new-project`). Delete `setNewProfileOnOpen` only if tsc says it is unused. Edit `Shell.tsx` so the `fold` button and Cmd+B use the event: in the sidebar fold handler add `useEffect` that listens to `openpier:fold` and toggles.
4. `src/hooks/useKeyboardShortcuts.ts`. Today it (1) ignores EVERY key typed in an input, textarea, select or editable element, except Escape, and (2) calls `preventDefault()` for each match unless the shortcut sets `preventDefault: false`, and (3) needs `shiftKey` to equal `shortcut.shift`, so "?" (typed with Shift) never matches a shortcut without `shift`. Keep the public names (`KeyboardShortcut`, `useKeyboardShortcuts`, `Command`, `formatShortcut`) and change three things: (a) replace the early return for input targets by `if (isTypingTarget(e.target) && !shortcut.meta && e.key !== "Escape") continue;` inside the loop, so Cmd combinations (Cmd+K from the search field) work while typing; (b) when `shortcut.key === "?"`, ignore `shiftKey` in the match; (c) leave `preventDefault` as it is (already on by default, which also stops Cmd+R from reloading the webview). Import `isTypingTarget` from `../lib/shortcuts`.
5. Cmd+R: in `src/hooks.ts`, inside `usePoll`, add after the `reload` definition:

```ts
  useEffect(() => {
    const again = () => { void reload(); };
    window.addEventListener("openpier:refresh", again);
    return () => window.removeEventListener("openpier:refresh", again);
  }, [reload]);
```

6. Esc: Radix layers close themselves. Add to `App.tsx` one `keydown` listener for `Escape` that, when no element matches `[role=dialog], [role=alertdialog], [role=menu]`, dispatches `new Event("openpier:escape")`. The Containers page listens in WO-3.1b (clear selection, then clear search).
7. Create `src/lib/paletteModel.ts` (pure). Full content:

```ts
export type PaletteGroup = "Containers" | "Images" | "Actions" | "Go to";
export type PaletteItem = {
  id: string;
  group: PaletteGroup;
  label: string;            // "kafka", "Restart kafka"
  hint?: string;            // the image, or a short state
  dot?: "ok" | "warn" | "bad" | "busy" | "off";
  kbd?: string;             // "⌘D"
  run: () => void;
};

const ORDER: PaletteGroup[] = ["Containers", "Images", "Actions", "Go to"];
const PER_GROUP = 8;

// 0 = starts with the query, 1 = a word starts with it, 2 = contains it, null = no match.
export function score(label: string, query: string): number | null {
  const l = label.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (l.startsWith(q)) return 0;
  if (l.split(/[\s/:._-]+/).some((w) => w.startsWith(q))) return 1;
  return l.includes(q) ? 2 : null;
}

export type Section = { group: PaletteGroup; items: PaletteItem[] };

// With a query: matches only, best first, at most 8 per group. Without one: the pages, then the five most recent actions.
export function rank(query: string, items: PaletteItem[], recentIds: string[]): Section[] {
  if (!query.trim()) {
    const goTo = items.filter((i) => i.group === "Go to");
    const recent = recentIds.map((id) => items.find((i) => i.id === id)).filter((i): i is PaletteItem => !!i && i.group === "Actions").slice(0, 5);
    return [{ group: "Go to" as const, items: goTo }, { group: "Actions" as const, items: recent }].filter((s) => s.items.length);
  }
  return ORDER.map((group) => {
    const scored = items
      .filter((i) => i.group === group)
      .map((i) => ({ i, s: score(`${i.label} ${i.hint ?? ""}`, query) }))
      .filter((x): x is { i: PaletteItem; s: number } => x.s !== null)
      .sort((a, b) => a.s - b.s || a.i.label.localeCompare(b.i.label));
    return { group, items: scored.slice(0, PER_GROUP).map((x) => x.i) };
  }).filter((s) => s.items.length);
}

export const flat = (sections: Section[]): PaletteItem[] => sections.flatMap((s) => s.items);

// Keep the last five actions run, newest first, without duplicates.
export const pushRecent = (ids: string[], id: string): string[] => [id, ...ids.filter((x) => x !== id)].slice(0, 5);
```

8. **Extend: the Palette component.** iteration 1 has no component for the palette: `MenuItem` only works inside a `Menu`, and `Command` is the one-line command block, not a list. Create `src/ui/op/Palette.tsx` and export it from `src/ui/op/index.ts`. It uses the classes of the mockup `palette` (`overlay`, `palette`, `q`, `results`, `menu-cap`, `menu-item`, `top`, `muted`, `kbd`, `sr-only`), all in `container-ui.css`:

```tsx
import * as Dialog from "@radix-ui/react-dialog";   // the same import Sheet.tsx uses
import { Dot, DotState } from "./Dot";
import { Icon } from "./Icon";
import { usePortalContainer } from "./Portal";

// enter: the words shown next to the key while this entry is highlighted ("↵ Open"). kbd: its shortcut, always shown.
export type PaletteEntry = { id: string; label: string; hint?: string; dot?: DotState; kbd?: string; enter?: string };
export type PaletteSection = { group: string; items: PaletteEntry[] };
export type PaletteProps = { open: boolean; onClose: () => void; query: string; onQuery: (query: string) => void; sections: PaletteSection[]; onRun: (id: string) => void };
export function Palette(props: PaletteProps): JSX.Element;
```

   Markup: `Dialog.Root` (open, `onOpenChange` calls `onClose` when it closes) > `Dialog.Portal container={usePortalContainer()}` (so the palette sits inside `.main`, like the sheets) > `Dialog.Overlay className="overlay"` and `Dialog.Content className="palette" aria-label="Command palette"` holding `<Dialog.Title className="sr-only">Command palette</Dialog.Title>`, then `div.q` (`<Icon name="search" />`, `<input role="combobox" aria-label="Search commands and containers" aria-expanded="true" aria-controls="palette-results" aria-activedescendant={id of the highlighted option} value={query} onChange=... autoFocus />`, `<span className="kbd">esc</span>`), then `div.results#palette-results[role=listbox]` with, per section, `<div className="menu-cap">{group}</div>` and per entry `<button type="button" role="option" id={`palette-${id}`} className="menu-item" aria-selected data-highlighted={highlighted || undefined}>` holding `<span className="top">`, the `Dot` when `dot` is set, `<span>{label}</span>`, `<span className="muted">{hint}</span>` when set, `<span className="kbd">{kbd}</span>` when set, and `<span className="kbd">{enter}</span>` only while highlighted. The highlight is the index into the flat list of entries (state inside `Palette`; it goes back to 0 when `query` changes). ArrowDown and ArrowUp move it (no wrap), Enter calls `onRun(id)` of the highlighted entry, a click on an entry calls `onRun(id)`, moving the pointer over an entry highlights it. Esc closes (Radix). With no entries and a non-empty `query`, the results area holds `<div className="empty"><div className="text">Nothing matches "{query}".</div></div>` (the same words as the lists). With no entries and an empty `query` it is empty.
   Tests (`src/ui/op/Palette.test.tsx`): `Given two sections, When rendered, Then the captions show and the input has focus`; `Given three entries, When ArrowDown is pressed twice and Enter, Then onRun gets the third id`; `Given a click on the second entry, Then onRun gets its id`; `Given the first entry has enter "↵ Open", Then that text shows only while it is highlighted`; `Given Escape, Then onClose is called`; `Given a typed letter, Then onQuery gets the new text`; `Given no sections and the query "zzz", Then the text Nothing matches "zzz". shows`; `Given a PortalProvider with a div, When open, Then the palette is inside that div`. Add a `Palette` section to `src/dev/Gallery.tsx`.

   Then rewrite `src/CommandPalette.tsx` as a thin wrapper: props `{ open: boolean; onClose: () => void; items: PaletteItem[] }`. It keeps `query` in state, computes `sections = rank(query, items, recent)` with `recent` read from `openpier:recent-actions` (JSON array in try/catch), maps each `PaletteItem` to a `PaletteEntry` (`kbd` copies over, `enter: "↵ Open"` for the Containers group), and on `onRun(id)` finds the item, calls `pushRecent`, stores `openpier:recent-actions`, closes, then calls `item.run()`. The query is cleared each time it opens.
9. In `App.tsx` build the items (this is the only place that knows the data):
   1. **Containers**: `doc.containers` in `App.tsx` is what Doctor inspected, not the list. The palette reads its own list, once, each time it opens: `dockerJson<{ ID: string; Names: string; Image: string; State: string }>(ctx, ["ps", "-a"])` (the same call `Containers.tsx` makes). One item per row: label `Names`, hint `Image`, dot from the state mapping of spec 6.4 (`running` ok, `restarting` warn, anything else off), `run: () => go(\`#/containers/${ID}/logs\`)`. While the read is running, or when it fails, the group is simply empty.
   2. **Actions per container**: `Logs of {name}` (go to its logs), `Restart {name}`, `Stop {name}` when running or `Start {name}` when stopped, `Remove {name}…`. Restart, Stop and Start call `docker(ctx, [op, id])` then dispatch `openpier:refresh`. Remove asks with `useConfirm()` first: title `Remove {name}?`, body "This deletes the container. Its image and volumes are kept, so you can run it again.", command `docker --context {ctx} rm -f {name}`, button "Remove" (danger); on yes it runs `docker(ctx, ["rm", "-f", id])`. These words are from the mockup `confirm-dialog`.
   3. **Actions general**: `Run an image` (kbd ⌘N), `Pull an image` (⌘P), `Start a Compose project`, `Run Doctor` (⌘D), `Start {engine}` or `Stop {engine}`, `Machines…`. Each `run` is the same function the matching shortcut or button uses.
   4. **Go to**: one item per page that exists now: Containers, Images, Volumes, Networks, Kubernetes (only when `kubeOn`), Doctor, Settings; `kbd` from `showKeys` of the shortcut with the same label.
   5. **Images**: none in iteration 2 (the palette's Images group is empty until WO-3.4 passes the image list; the group header does not show when empty). This deviates from spec 6.12 rule 1 on purpose; report it in the pull request.
10. Help. Rewrite `src/HelpModal.tsx`. Help is a sheet (decision D9): render it in the ui `Sheet`, title "Help and shortcuts", the two buttons in `footer`, close button in the head (the `Sheet` draws it). Content, in English (the old text was Portuguese): a `<GroupCaption>` per group ("Go to", "Do", "Page", "List"), and under each a list of rows `<div className="row"><span className="name">{label}</span><span className="grow" /><span className="kbd">{showKeys(s)}</span></div>` generated from `activeShortcuts()` and `LIST_KEYS` (never typed by hand). The `Sheet` `footer` holds two buttons: `<Button onClick=...>Docs</Button>` (opens `${REPO_URL}#readme` with `openUrl`) and `<Button>Give feedback</Button>` (opens `${REPO_URL}/discussions`). Whether the repository has GitHub Discussions on is not known from here: write "Give feedback opens `${REPO_URL}/discussions`; the owner turns Discussions on before launch (WO-7.x)" in the pull request.
11. Activity. Create `src/Activity.tsx`: `export default function Activity({ open, onClose }: { open: boolean; onClose: () => void })`, a ui `Sheet` titled "Activity" with the same list `CommandLog` renders today (read it: same entries, same order, newest first, same "Run again" rules, the failed one marked). Changes: `Sheet` instead of `Drawer`; each command in `<Command text={entry.cmd} />` (it has its own copy button); the "Run again" button is `<Button size="xs">`; an entry that failed has `<Sev level="bad" />` and the word "failed". When the list is empty: `<Empty icon="logs" title="Nothing yet">Every command the app runs shows up here.</Empty>`. In `src/Commands.tsx` leave `CommandToast` and `useActivity` as they are; delete the `CommandLog` component and its export. In `App.tsx` replace `<CommandLog ...>` by `<Activity open={logOpen} onClose={() => setLogOpen(false)} />`. Rename nothing else. Keep `Commands.tsx` on `scripts/not-migrated.json` (WO-3.3 migrates `CommandToast`).
12. Remove from `scripts/not-migrated.json`: `src/CommandPalette.tsx`, `src/HelpModal.tsx`, `src/hooks/useKeyboardShortcuts.ts` if listed.
13. `scripts/check-palette.mjs` (new; the shortcut walk). Scenario `design`, 1180x760. Lines in words:
    1. Cmd+K opens the palette (`[aria-label="Command palette"]` visible, the input is focused); Escape closes it and focus returns to where it was.
    2. Typing "kaf" shows a "Containers" caption with kafka and kafka-ui, and an "Actions" caption with "Restart kafka" and "Logs of kafka".
    3. Enter on the highlighted container goes to `#/containers/<id>/logs` (the route exists from WO-3.2; until then the hash changes and the page shows Containers).
    4. An empty query shows "Go to" first, and no "Containers" caption.
    5. After running "Run Doctor" the palette's empty query lists it under "Actions" (recent).
    6. "Remove kafka-ui…" opens the confirm dialog with the title "Remove kafka-ui?" and the command text; Cancel removes nothing.
    7. Cmd+2, Cmd+3, Cmd+4, Cmd+5 set the hash to `#/containers`, `#/images`, `#/volumes`, `#/networks`; Cmd+6 sets `#/kubernetes/pods`.
    8. Cmd+1 does nothing (the hash is unchanged) and Cmd+0 and Cmd+7 do nothing. (Gone by design: spec 10 renumbers them.)
    9. Cmd+D sets `#/doctor`; Cmd+, sets `#/settings/general`.
    10. Cmd+E opens the engine menu; Escape closes it.
    11. Cmd+B toggles `.app.folded`; a reload keeps it (the check reads `localStorage["openpier:sidebar-folded"]`).
    12. Cmd+[ then Cmd+] move back and forward in the history.
    13. Cmd+R dispatches the refresh (the check adds a `window` listener for `openpier:refresh` and counts one call) and the page does not reload (a `window.__marker` set before is still there).
    14. "?" opens Help; Help lists "Command palette" with "⌘K", has the buttons "Docs" and "Give feedback", and contains no Portuguese word from the old text (grep the visible text for "Atalhos" and "Fechar": absent).
    15. Typing "?" or "/" in the palette's input does not open Help or move focus (typing target rule).
    16. Cmd+Shift+A and Cmd+Shift+N do nothing.
    17. The Activity foot button opens a sheet titled "Activity"; after Stop on a container (or any command), the list shows the command in a `.cmd` block; Escape closes the sheet.
    18. Typing "zzzz" in the palette shows `Nothing matches "zzzz".`.
    19. The palette and the Help sheet are inside `.main`: the sidebar stays clickable-looking and uncovered (the element with class `palette` or `sheet` is a descendant of `.main`).
    20. No page errors.
    Cmd+N, Cmd+P, Cmd+F and "/" are checked in `check-containers.mjs` (WO-3.1c) and `check-sheets.mjs` (WO-3.3), where their screens exist.
14. Mockup row: none. The palette, Help and the Activity sheet appear only after a key press or a click, and `check-mockup.mjs` only goes to a path and takes a picture. They are compared **by eye** against `command-palette-light.png` and `-dark.png` (see "Done when" and `iteration-2-acceptance.md`). Say so in the pull request.

**Tests to write first:**

`src/lib/shortcuts.test.ts` (node:test):
1. `Given SHORTCUTS, When ids are listed, Then none repeats`.
2. `Given SHORTCUTS, When key combinations are listed, Then none repeats`.
3. `Given the table in spec section 10, When compared, Then Cmd+K, 1 to 6, D, comma, E, B, N, P, F, [, ], R and the keys "/" and "?" are all present`.
4. `Given go-projects is pending, When activeShortcuts runs, Then it is not in the list`.
5. `Given Cmd+K, When showKeys runs, Then the text is "⌘K"; Given comma with Cmd, Then "⌘,"`.
6. `Given no shortcut uses key "0" or "7" or shift`.

`src/lib/paletteModel.test.ts` (node:test):
1. `Given "kaf" and items kafka and kafka-ui, When ranked, Then both are in Containers and kafka is first`.
2. `Given a label "Restart kafka", When scored with "kaf", Then the score is 1 (a word starts with it)`.
3. `Given an empty query, When ranked, Then "Go to" is first and no Containers section is returned`.
4. `Given 12 matching containers, When ranked, Then 8 are returned`.
5. `Given recent ids [a, b] and an empty query, When ranked, Then the Actions section lists a then b`.
6. `Given pushRecent on six different ids, When called, Then five are kept, newest first`.
7. `Given the same id pushed twice, When pushRecent runs, Then it appears once, first`.
8. `Given no match, When ranked, Then the result is []`.

`src/CommandPalette.test.tsx` (vitest):
1. `Given the palette is open, When it renders, Then the input has focus`.
2. `Given items and the query "kaf", When typed, Then Enter runs the first container's action and closes the palette`.
3. `Given Escape, When pressed, Then onClose is called`.
4. `Given ArrowDown, When pressed twice, Then the third item has data-highlighted`.

`src/HelpModal.test.tsx` (vitest):
1. `Given Help is open, When it renders, Then every active shortcut label appears with its keys`.
2. `Given go-projects is pending, When Help renders, Then "Projects" does not appear as a shortcut`.
3. `Given Help is open, When "Give feedback" is pressed, Then openUrl gets REPO_URL + "/discussions"`.

`src/hooks/useKeyboardShortcuts.test.tsx` (vitest):
1. `Given a Cmd+K shortcut, When Cmd+K is pressed, Then the action runs and the event default is prevented`.
2. `Given the "/" shortcut and focus in an input, When "/" is typed, Then the action does not run`.
3. `Given Cmd+K and focus in an input, When Cmd+K is pressed, Then the action runs`.
4. `Given the "?" shortcut, When "?" is pressed with shift held, Then the action runs`.

**Done when:**
1. `node --experimental-strip-types --no-warnings --test src/lib/shortcuts.test.ts src/lib/paletteModel.test.ts 2>&1 | grep -E "^# (pass|fail)"` shows `# fail 0`; `npx vitest run src/ui/op/Palette.test.tsx src/CommandPalette.test.tsx src/HelpModal.test.tsx src/hooks/useKeyboardShortcuts.test.tsx 2>&1 | grep "Tests "` shows 17 passed (6, 4, 3 and 4).
2. `grep -rn "Cmd+0\|key: \"0\"\|key: \"7\"" src --include=*.ts --include=*.tsx` prints nothing outside tests.
3. `grep -n "Atalhos\|Fechar" src/HelpModal.tsx` prints nothing.
4. `node scripts/check-palette.mjs` and `PW_ENGINE=webkit node scripts/check-palette.mjs` print no `FAIL`.
5. `grep -c "<Drawer" src/Commands.tsx` prints `0`.
6. By eye (press Cmd+K at `http://localhost:4173/?scenario=design#/containers`, type "kaf") against `command-palette-light.png` and `-dark.png`: search field with the `esc` key hint, captions "Containers" and "Actions", the highlighted row, the dot and the muted image text. Also by eye: Help (press "?") and Activity (click the foot button) open as sheets with the words above.
7. The gate in `../HANDOFF.md` section 5.

**Pull request text:** the file `docs/plan/iterations/pr/wo-<id>.md` (no GitHub pull request exists). Its first line is this title: `wo-2.4: One list of shortcuts for the keys, Help and the palette`

---

## WO-2.5 Fixes from the review of WO-2.1 to WO-2.4

**Needs:** WO-2.4 merged.

**Why:** the review of 2026-11-13 found five things in WO-2.2 and WO-2.4 that do not match their work order, and one step no work order had (the Containers count). Each fix below is small. Do them in this order, on branch `wo-2.5`.

**Read first:** `src/ui/op/Palette.tsx`, `src/ui/op/Palette.test.tsx`, `src/Shell.tsx`, `src/Shell.test.tsx`, `src/App.tsx` (find `<Shell`), WO-2.2 step 11 (the `check-restyle.mjs` list), `git show 212977d:scripts/checks-pending/check-restyle.mjs`.

**Starting state:**
1. `git status --short` prints nothing. `git log -1 --format=%s main` prints `Merge branch 'wo-report-2'` or a later merge.
2. `grep -n 'sections.map((section, si) => (' src/ui/op/Palette.tsx` prints one line (the bug: every caption is drawn before every entry).
3. `grep -c "settingsActive" src/Shell.tsx` prints `2` (declared and destructured, never used).
4. `grep -c "check(" scripts/check-restyle.mjs` prints `2`.
5. `grep -n "counts=" src/App.tsx` prints nothing.

**Do not touch:** anything not named in a step.

**Steps:**

1. Write the tests of step 6 first and see them fail.
2. Palette: each caption sits above its own entries, and a section with no entries draws nothing. In `src/ui/op/Palette.tsx`, add `Fragment` to the React import, and replace the two blocks `{sections.map((section, si) => ( <div key={si} className="menu-cap">{section.group}</div> ))}` and `{flatEntries.map(({ entry }, idx) => { ... })}` with one block. The button inside is the same button as today, unchanged; only where it is drawn changes:
   ```tsx
   {sections.map((section, si) => section.items.length === 0 ? null : (
     <Fragment key={section.group}>
       <div className="menu-cap">{section.group}</div>
       {section.items.map((entry, ei) => {
         const idx = flatEntries.findIndex((f) => f.sectionIndex === si && f.entryIndex === ei);
         const isHighlighted = idx === highlighted;
         return ( /* the same <button ... role="option" ...> as today, unchanged */ );
       })}
     </Fragment>
   ))}
   ```
   `flatEntries`, the arrow keys and Enter stay as they are: the highlight index still counts entries top to bottom across sections.
3. Settings button: in `src/Shell.tsx`, the Settings foot button gets `aria-current={settingsActive ? "page" : undefined}`. Nothing else changes in that line.
4. Containers count (WO-2.2 said the sidebar shows it, no step passed it). In `src/App.tsx`:
   1. Import `{ owner, toApp, Inspect }` from `"./lib/apps"` (add the names to an existing import from that file if there is one).
   2. Next to `const doctorTodo`, add `const containerCount = doc.containers?.filter((c) => owner(toApp(c as Inspect)) !== "kubernetes").length;` (Kubernetes pod containers are not counted, as in the Containers header of WO-3.1b).
   3. On `<Shell`, add `counts={{ containers: containerCount }}`. `Shell` already hides a count of 0 or undefined.
5. `check-restyle.mjs`: WO-2.2 step 11 says items 1, 4, 5 and 6 of the old file are **Kept**. Only item 1 is there. Open `git show 212977d:scripts/checks-pending/check-restyle.mjs` and bring back, on `scripts/lib/check.mjs`, with today's selectors:
   1. Images rows use `IconButton`, and Volumes rows use `IconButton` (two checks; the pages are still the old code, so the old selectors work; print which selector matched).
   2. The Settings page at `#/settings/machines` explains what a machine profile is (the old sentence, as it reads today), and Stop streams into `.out-log` (two checks).
   3. The pull panel shows its progress in `.out-log` inside the legacy `.drawer` (one check).
   That is five old lines back (old lines 36, 39, 41, 44 and 61), so the file has at least 7 `check(` lines. Do not bring back old line 48 (`=== 0 || true`: it can never fail). Run it in Chromium and WebKit.
6. Tests (Given/When/Then):
   1. `src/ui/op/Palette.test.tsx`: `Given two sections A (one entry) and B (two entries), When rendered, Then the order of captions and options in the list is A, a1, B, b1, b2`.
   2. `src/ui/op/Palette.test.tsx`: `Given a section with no entries, When rendered, Then its caption does not show`.
   3. `src/Shell.test.tsx`: `Given settingsActive, When rendered, Then the Settings button has aria-current="page"; Given it is false, Then it has none`.
   4. `src/Shell.test.tsx`: `Given counts containers 10, When rendered, Then the Containers item shows the count 10`.
7. Pull request files: add a `## Contract differences` section (write "None." when there are none) to `pr/wo-2.1.md`, `pr/wo-2.2.md`, `pr/wo-2.3.md`, `pr/wo-2.4.md`, and paste the gate output into `pr/wo-2.4.md`. Replace every em dash in `pr/wo-2.*.md` and `iteration-2-report.md` with a colon or a comma.
8. Merge `wo-2.5` with `--no-ff`.

**Done when:**
1. `npx vitest run src/ui/op/Palette.test.tsx src/Shell.test.tsx` shows `0 failed` and the four new tests pass.
2. `grep -c "check(" scripts/check-restyle.mjs` prints 7 or more; `node scripts/check-restyle.mjs` and `PW_ENGINE=webkit node scripts/check-restyle.mjs` print no `FAIL`.
3. By eye: Cmd+K, type "kaf" at `?scenario=design#/containers`: "Containers" with kafka and kafka-ui under it, then "Actions" with the actions under it. The sidebar shows a muted `10` next to Containers.
4. `grep -c "Contract differences" docs/plan/iterations/pr/wo-2.*.md` prints 1 for each of the four files.
5. The gate in `../HANDOFF.md` section 5.

**Pull request text:** `docs/plan/iterations/pr/wo-2.5.md`. First line: `wo-2.5: Fixes from the review of the shell and the palette`

---

## WO-2.6 The app picks its engine at startup

**Needs:** WO-3.1c-1 merged (`git log --oneline --first-parent main` shows `Merge branch 'wo-3.1c-1'`). Do it before WO-3.1c-2.

**Why:** the review of 2026-11-14 found that since WO-2.2 (commit `0428b92`) nothing in `src/` calls `runtimeRegistry.setActive`. WO-2.2 removed the engine picker from `src/Shell.tsx` (it only set an engine when the user picked one; nothing ever activated one at startup) and put one call in `preview/mock.ts`, only for `?scenario=design` and `?scenario=two`. So:
1. In the real app, `runtimeRegistry.getActive()` is always `null`, `reloadProfiles` never loads a profile, and every page shows "Start your first VM", even on a Mac where Colima runs.
2. In the preview, every other scenario (`running`, `loading`, `unreachable`, `stopped`, `empty=1`, `failstart=`) shows the same onboarding screen. The browser checks of WO-3.1c-3 cannot pass on top of that.
The unit tests did not see it because each one brings its own fake backend. The fix: the app finds and activates the first engine that answers, at startup, in `src/`. The preview only answers the version command, like the real backend does; it does not choose the engine for the app.

**Read first:** `src/runtime/index.ts`, `src/runtime/colima-adapter.ts` (`isAvailable`), `src/App.tsx` (the first `useEffect`, which reads `runtimeRegistry.getActive()`, and `reloadProfiles`), `preview/mock.ts` (find `runtimeRegistry.setActive` and `throw \`mock: unsupported command`), `src/test/fakeBackend.ts`, `git show 0428b92 -- src/Shell.tsx` (the picker WO-2.2 removed).

**Starting state:**
1. `git status --short` prints nothing.
2. `git grep -n "runtimeRegistry.setActive" -- src preview` prints one line, in `preview/mock.ts`.
3. `grep -c 'case "colima_version"' preview/mock.ts` prints `0`.
4. With `npm run preview` running, open `http://localhost:4173/?scenario=running#/containers`: the page shows "Start your first VM" (the bug).

**Do not touch:** `docs/plan/` except the pull request file; `src/ui/op/`; `src-tauri/`; every other `scripts/check-*.mjs`. If another browser check changes result after this fix, do not edit it: list it in the pull request file under "Found on the way" with its output.

**Steps:**

1. Write the tests of step 5 first and see them fail. Paste the failing output in the pull request file.
2. `src/runtime/index.ts`: add one method to `RuntimeRegistry`, under `detectAvailable`:
   ```ts
   // Startup: make the first engine that answers the active one. Keeps one already set.
   // Only Colima and OrbStack can list machines today; the others throw "Not yet implemented".
   async activateFirstAvailable(): Promise<RuntimeAdapter | null> {
     if (this.activeAdapter) return this.activeAdapter;
     const [first] = (await this.detectAvailable()).filter((r) => r.adapter.id === "colima" || r.adapter.id === "orbstack");
     if (first && !this.activeAdapter) this.activeAdapter = first.adapter;
     return this.activeAdapter;
   }
   ```
   `detectAvailable` keeps the order of `register`, so Colima comes first when both answer. The second `!this.activeAdapter` matters: an engine set with `setActive` while the version commands were running is kept. Nothing else in this file changes.
3. `src/App.tsx`, in `reloadProfiles`: replace `const adapter = runtimeRegistry.getActive();` with `const adapter = runtimeRegistry.getActive() ?? (await runtimeRegistry.activateFirstAvailable());`. Leave the first `useEffect` as it is. The 3 s poll now also picks up an engine installed after startup (a new user installs Colima from the onboarding, then presses Start, without relaunching). While no engine is installed, the version commands run every 3 s; once one is active, nothing more is asked.
4. `preview/mock.ts`:
   1. Add `case "colima_version": if (!env.colima) throw "colima: command not found"; return "colima version 0.8.1" as T;` next to `case "host_resources"`. `env.colima` is already `null` for `missing`, `partial` and `nobrew`. (If the object holding `colima: [...].includes(scenario) ? null : ...` has another name, use that name and say so in the pull request file.)
   2. Delete the line `runtimeRegistry.setActive(new ColimaAdapter());` and the comment above it. Delete the `runtimeRegistry` and `ColimaAdapter` imports if nothing else in the file uses them.
   The other engines (`orb_version` and the rest) keep reaching `throw \`mock: unsupported command\``, so they read as not installed. That is what the preview wants.
5. Tests (Given/When/Then):
   1. `src/runtime/index.test.tsx` (new; vitest only picks up `.test.tsx`, and `npm test` runs every `.test.ts` under plain node). Do not use `fakeBackend` here: it answers `null` for unknown commands, so every engine would look installed. Start the file with exactly this (vitest moves `vi.mock` above the imports, so the answers must come from `vi.hoisted`):
      ```ts
      import { beforeEach, describe, expect, it, vi } from "vitest";
      const answers = vi.hoisted(() => ({ ok: new Set<string>(), calls: [] as string[] }));
      vi.mock("@tauri-apps/api/core", () => ({ invoke: async (cmd: string) => { answers.calls.push(cmd); if (answers.ok.has(cmd)) return "1.0"; throw "not installed"; } }));
      import { RuntimeRegistry } from "./index";
      import { ColimaAdapter } from "./colima-adapter";
      import { OrbStackAdapter } from "./orbstack-adapter";
      import { PodmanAdapter } from "./podman-adapter";
      beforeEach(() => { answers.ok.clear(); answers.calls.length = 0; });
      ```
      Each test makes its own `new RuntimeRegistry()` and registers Colima, OrbStack and Podman, so one test's active engine does not carry over to the next. The four tests:
      1. `Given only colima_version answers, When activateFirstAvailable runs, Then Colima is the active engine` (`getActiveId()` is `"colima"`).
      2. `Given no version command answers, When activateFirstAvailable runs, Then it returns null and no engine is active`.
      3. `Given an engine is already active, When activateFirstAvailable runs, Then it keeps that engine and asks nothing` (call `setActive` first; `answers.calls` equals `[]`).
      4. `Given only podman_version answers, When activateFirstAvailable runs, Then it returns null` (Podman cannot list machines yet).
   2. `scripts/check-engine-start.mjs` (new, on `scripts/lib/check.mjs`). One `open` per line below; wait up to 5 s for the text:
      1. `/?scenario=running#/containers`: a row named `web` shows, and "Start your first VM" does not.
      2. `/?scenario=none#/containers`: "Start your first VM" shows (Colima installed, no machine yet).
      3. `/?scenario=stopped#/containers`: "default is stopped" and a `Start default` button show.
      4. `/?scenario=unreachable#/containers`: "Couldn't list containers" shows within 5 s.
      5. `/?scenario=missing#/containers`: install the tools from the onboarding, then Start; the `default` machine shows within 5 s, without a reload.
      So the file has at least 5 `check(` lines, and each one waits for real text on the page (no `check(true, ...)`). Run it in Chromium and WebKit, with the preview running.
6. Run every `scripts/check-*.mjs` once in Chromium (`for f in scripts/check-*.mjs; do node $f; done`) and paste the summary per file in the pull request file. A check that passed on `main` and fails now goes under "Found on the way" (see "Do not touch"). If a `design` or `two` check fails, say whether it measured before the first container row showed: the engine is now chosen a few mock calls after load, not when the module loads.
7. Merge `wo-2.6` with `--no-ff`.

**Done when:**
1. `npx vitest run src/runtime/index.test.tsx` shows 4 passed, 0 failed.
2. `git grep -n "runtimeRegistry.setActive" -- preview` prints nothing; `grep -c "activateFirstAvailable" src/App.tsx` prints `1`.
3. `node scripts/check-engine-start.mjs` and `PW_ENGINE=webkit node scripts/check-engine-start.mjs` print no `FAIL`. The owner runs the Chromium one himself before merging.
4. By eye at `?scenario=running#/containers`: the container list, not the onboarding. At `?scenario=design#/containers`: the same screen as before this work order.
5. Every `WO-2.6:` line of `sh docs/plan/iterations/verify-iteration-2.sh` prints `ok`.
6. The gate in `../HANDOFF.md` section 5. `src/Containers.test.tsx` may still fail only on the 19 tests WO-3.1c-2 migrates.

**Pull request text:** `docs/plan/iterations/pr/wo-2.6.md`. First line: `wo-2.6: The app picks its engine at startup`

---

## WO-3.1 Containers (the pattern for every screen): split into 3.1a, 3.1b, 3.1c

`src/Containers.tsx` is about 830 lines of logic and markup (Start and Stop with pending words, project runs, fix runs, resize and folder fixes, bring-over, the VM strip). Rule for the three work orders: **keep the logic, replace the markup**. Every function named below (`act`, `project`, `fail`, `problemLine`, `LimitLine`, `containerMenuItems`, `projectMenuItems`, `row`, `appsFrom`, `appState`) stays; only what they render changes. The three parts:

1. **WO-3.1a**: pure code and its tests (the row model). Nothing on screen changes.
2. **WO-3.1b**: the screen: header, list, rows, menus, selection, keyboard, Inspector.
3. **WO-3.1c**: the eight states of spec section 8, the mock scenarios, the browser checks (old checks `check-home`, `check-down`, `check-menus`, `check-select` come back), the mockup rows, the migration of the old tests.

WO-3.2 and WO-3.3 copy this shape: model, then screen, then states and checks.

Decisions of the author that these work orders apply:
1. Machine stopped (D4): title `{name} is stopped`, line `Your containers and data are kept. Start the machine to see them.`, primary `Start {name}`. The same words in every iteration.
2. The header summary (D1) reads `{n} · {m} need attention`, where n is the number of containers (not counting Kubernetes pod containers) and m is the number of containers that have a problem line. For the mockup data that is `10 · 5 need attention`, and the sidebar count is `10`. The mockup rows mask `.header .sub` and `.sidebar .count`.

---

## WO-3.1a Row model: the rules of the list, as pure functions

**Needs:** WO-2.4.

**Why:** U3, U5, U6 (problems first, one dot and one word per state, ports and stats in fixed columns). Pure functions are cheap to test; the screen then only draws.

**Read first:**
1. `docs/plan/04-design-spec.md` sections 6.4, 6.5, 7.1.
2. `src/lib/homeRows.ts` (all exports), `src/containerInfo.ts` (`parseBytes`, `parsePercent`, `parseUsage`, `formatBytes`).
3. `src/Containers.tsx`: find `type C =`, `const problemsOf`, `const apps = useMemo`.
4. `src/lib/homeRows.test.ts` (test style).

**Starting state:**
1. `git status --short` prints nothing; `ls src/lib/containerRows.ts 2>&1` says it does not exist.
2. `grep -n "export function appsFrom\|export const KUBE_KEY\|export type App<" src/lib/homeRows.ts` prints three lines.
3. In the preview, open `http://localhost:4173/?scenario=design#/containers` and run in the browser console `["kafka","kafka-ui","api","web","db","queue","worker","report-job","cache","scratch-postgres"].every((n) => document.body.innerText.includes(n))`. It prints `true` (the old Containers page still draws these names). If not, stop and report: iteration 1's `design` scenario is not the mockup's data.
4. The order of the shop containers inside the project (api, web, db, queue, worker, report-job, cache, the order of the blocks in the mockup) is the order `docker ps -a` returns them in the `design` scenario, and `appsFrom` keeps that order. This work order does not sort inside a project; WO-3.1c checks the order of the blocks in the browser.

**Do not touch:** `src/lib/homeRows.ts` (import from it, do not edit), any `.tsx`.

**Steps:** (tests first, then this file)

1. Create `src/lib/containerRows.ts`. Full content:

```ts
import { KUBE_KEY, type App } from "./homeRows.ts";

import type { DotState } from "../ui/op/index.ts";   // the one dot type; do not declare a second one

// What one container needs to be drawn (a plain copy of what docker ps and the Doctor say).
export type StateInput = {
  state: string;            // docker State: running, restarting, exited, paused, created, dead
  exitCode?: number;        // exited containers
  oomKilled?: boolean;
  unhealthy?: boolean;      // the health check is failing
  finding?: "bad" | "warn" | null;   // the worst Doctor finding about it
  busy?: "Starting…" | "Stopping…" | "Restarting…" | "Removing…" | null;
};

export type StateView = { dot: DotState; word: string; action: "Stop" | "Start"; busy: boolean };

// Spec 6.4 table, row by row. A busy row wins over everything.
export function stateView(i: StateInput): StateView {
  if (i.busy) return { dot: "busy", word: i.busy, action: i.busy === "Stopping…" ? "Start" : "Stop", busy: true };
  if (i.oomKilled) return { dot: "bad", word: "Out of memory", action: "Start", busy: false };
  if (i.state === "restarting") return { dot: "warn", word: "Restarting", action: "Stop", busy: false };
  if (i.state === "running" || i.state === "paused") {
    // A paused container reads "Paused" and is judged like a running one (the author accepted the word).
    const word = i.state === "paused" ? "Paused" : i.unhealthy ? "Unhealthy" : "Running";
    const dot: DotState = i.unhealthy || i.finding === "bad" ? "bad" : i.finding === "warn" ? "warn" : "ok";
    return { dot, word, action: "Stop", busy: false };
  }
  // exited, created, dead
  if (i.state === "exited" && (i.exitCode ?? 0) !== 0) return { dot: "bad", word: "Stopped (error)", action: "Start", busy: false };
  return { dot: "off", word: "Stopped", action: "Start", busy: false };
}

// "2% · 512 MB". Empty when the container is not running.
export function statsText(cpuPercent: number, memBytes: number, running: boolean): string {
  if (!running) return "";
  return `${Math.round(cpuPercent)}% · ${memText(memBytes)}`;
}

// Sizes with one unit and at most three digits (spec 9.5): "9 MB", "512 MB", "1.6 GB".
export function memText(bytes: number): string {
  const mb = bytes / 1024 ** 2;
  if (mb < 1000) return `${Math.max(1, Math.round(mb))} MB`;
  const gb = bytes / 1024 ** 3;
  return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`;
}

// Docker's Ports text ("0.0.0.0:8080->80/tcp, :::8080->80/tcp, 5432/tcp") to the host ports, once each, in order.
export function hostPorts(ports: string): number[] {
  const out: number[] = [];
  for (const m of ports.matchAll(/(?:^|[ ,])(?:[\d.]+|::|\[::\]):(\d+)->/g)) {
    const n = Number(m[1]);
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

// At most two ports show; more become "+n" that opens the detail's Network tab (spec 7.1 rule 4).
export function portCell(ports: number[]): { shown: number[]; more: number } {
  return { shown: ports.slice(0, 2), more: Math.max(0, ports.length - 2) };
}

export type BlockState = "ok" | "warn" | "bad" | "off";
// The shape the Blocks component takes (src/ui/op/Blocks.tsx): label is the word in the block's tooltip ("api: Running").
// Blocks itself draws nine slots and turns the rest into "+n" (spec 6.13), so nothing here counts.
export type Block = { name: string; state: BlockState; label: string };

export const blockOfDot = (d: DotState): BlockState => (d === "off" ? "off" : d === "busy" ? "warn" : d);
export const blockOf = (name: string, dot: DotState, word: string): Block => ({ name, state: blockOfDot(dot), label: word });

// The header summary: "10" or "10 · 5 need attention" (spec 7.1 rule 1). needAttention counts containers with a problem line.
export function summary(total: number, needAttention: number): string {
  return needAttention > 0 ? `${total} · ${needAttention} need attention` : String(total);
}

// Order (spec 7.1 rule 7): entries with a problem first, then running, then stopped; alphabetical inside each.
// The Kubernetes group is always last: the cluster owns it.
export type SortInput = { key: string; name: string; hasProblem: boolean; running: boolean };
export function sortEntries<T extends SortInput>(entries: T[]): T[] {
  const rank = (e: T) => (e.key === KUBE_KEY ? 3 : e.hasProblem ? 0 : e.running ? 1 : 2);
  return [...entries].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

// A project is open by default when anything in it needs attention (spec 7.1 rule 5). A saved choice wins.
export const isOpen = (hasProblem: boolean, saved: boolean | undefined): boolean => saved ?? hasProblem;

// The lines of the list, top to bottom. One flat list, so keys and focus are simple.
export type Line<C> =
  | { kind: "entry"; id: string; entry: App<C & { Names: string }>; open: boolean }
  | { kind: "child"; id: string; entry: App<C & { Names: string }>; c: C & { Names: string } }
  | { kind: "problem"; id: string; entry: App<C & { Names: string }>; c: C & { Names: string }; indent: boolean; prefix: boolean };

export function flatten<C extends { Names: string }>(entries: App<C>[], open: (e: App<C>) => boolean, hasProblem: (c: C) => boolean): Line<C>[] {
  const out: Line<C>[] = [];
  for (const e of entries) {
    const isGroup = e.kind === "compose";
    const opened = isGroup && open(e);
    out.push({ kind: "entry", id: e.key, entry: e as never, open: opened });
    if (e.kind === "kubernetes") continue; // the cluster owns these; they are never listed
    if (opened) {
      for (const c of e.rows) {
        out.push({ kind: "child", id: `${e.key}/${c.Names}`, entry: e as never, c: c as never });
        if (hasProblem(c)) out.push({ kind: "problem", id: `${e.key}/${c.Names}/problem`, entry: e as never, c: c as never, indent: true, prefix: false });
      }
    } else {
      // Folded group or a loose container: its problems sit under its row; in a folded group each says whose it is.
      for (const c of e.rows) if (hasProblem(c)) out.push({ kind: "problem", id: `${e.key}/${c.Names}/problem`, entry: e as never, c: c as never, indent: false, prefix: isGroup });
    }
  }
  return out;
}

// How many top-level rows (a project or a loose container) have a problem.
export const countNeedAttention = <C extends { Names: string }>(entries: App<C>[], hasProblem: (c: C) => boolean): number =>
  entries.filter((e) => e.kind !== "kubernetes" && e.rows.some(hasProblem)).length;

// "5 of 7 running".
export const runningText = (up: number, of: number): string => `${up} of ${of} running`;
```

2. Do not export anything else.

**Tests to write first:** `src/lib/containerRows.test.ts` (node:test).

State (spec 6.4, one test per table row):
1. `Given running, healthy, no finding, When stateView runs, Then dot ok, word "Running", action "Stop"`.
2. `Given running and unhealthy, When stateView runs, Then dot bad and word "Unhealthy"`.
3. `Given running with a warn finding, When stateView runs, Then dot warn and word "Running"`.
4. `Given running with a bad finding and healthy, When stateView runs, Then dot bad and word "Running"` (kafka-ui in the mockup).
5. `Given restarting, When stateView runs, Then dot warn, word "Restarting", action "Stop"`.
6. `Given busy "Starting…", When stateView runs, Then dot busy, word "Starting…", busy true`.
7. `Given exited with code 0, When stateView runs, Then dot off, word "Stopped", action "Start"`.
8. `Given exited with code 1, When stateView runs, Then dot bad and word "Stopped (error)"`.
9. `Given OOM killed, When stateView runs, Then dot bad, word "Out of memory", action "Start"`.
10. `Given busy "Stopping…", When stateView runs, Then the action is "Start" and busy is true`.
11. `Given paused, When stateView runs, Then the word is "Paused"` .

Stats and ports:
12. `Given 2.4 percent and 512 MiB running, When statsText runs, Then "2% · 512 MB"`.
13. `Given a stopped container, When statsText runs, Then ""`.
14. `Given 14 MiB, 1.6 GiB and 12 GiB, When memText runs, Then "14 MB", "1.6 GB", "12 GB"`.
15. `Given "0.0.0.0:8080->80/tcp, :::8080->80/tcp, 5432/tcp", When hostPorts runs, Then [8080]`.
16. `Given "0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp, 0.0.0.0:9000->9000/tcp", When portCell runs on the result, Then shown [80, 443] and more 1`.
17. `Given an empty Ports text, When hostPorts runs, Then []`.

Blocks and summary:
18. `Given the dot "ok" and the word "Running", When blockOf runs for "web", Then { name: "web", state: "ok", label: "Running" }`.
19. `Given the dot "busy", When blockOf runs, Then the state is "warn"`.
20. `Given the dot "off" and the word "Stopped", When blockOf runs for "cache", Then the state is "off" and the label "Stopped"`.
21. `Given 10 and 3, When summary runs, Then "10 · 3 need attention"; Given 10 and 0, Then "10"`.

Order and lines:
22. `Given kafka (problem), scratch-postgres (running), cache (stopped), shop (problem), When sortEntries runs, Then kafka, shop, scratch-postgres, cache`.
23. `Given two entries with problems, When sortEntries runs, Then they are alphabetical`.
24. `Given the Kubernetes group and a stopped container, When sortEntries runs, Then Kubernetes is last`.
25. `Given a project with no problem and no saved choice, When isOpen runs, Then false; with a problem, true; with saved false and a problem, false`.
26. `Given an open project with a problem in api, When flatten runs, Then the lines are entry, child api, problem (indent true, prefix false), children...`.
27. `Given a folded project with problems in api and worker, When flatten runs, Then entry then two problem lines with prefix true, and no child lines`.
28. `Given a loose container with a problem, When flatten runs, Then entry then one problem line with prefix false`.
29. `Given the Kubernetes entry, When flatten runs, Then only its entry line is returned`.
30. `Given the mockup data (kafka, kafka-ui, shop with 3 problem children, scratch-postgres), When countNeedAttention runs, Then 3`.

**Done when:**
1. `node --test src/lib/containerRows.test.ts` (use the node-test command of `package.json`) shows 30 tests, `fail 0`.
2. `git diff --stat` shows only `src/lib/containerRows.ts` and its test.
3. The gate in `../HANDOFF.md` section 5.

**Pull request text:** the file `docs/plan/iterations/pr/wo-<id>.md`. Its first line is this title: `wo-3.1a: The rules of the container list as tested functions`

---

## WO-3.1b Containers: the new screen

**Needs:** WO-3.1a.

**Why:** U3 to U7, U11, U12, P2. Replaces the home screen.

**Read first:**
1. `docs/plan/04-design-spec.md` sections 6.5, 6.6, 6.8, 6.13, 6.15, 6.16, 7.1, 9, 10.
2. Mockup pictures (open both themes of each): `containers`, `containers-row-menu`, `containers-new-menu`, `problem-inspector`, `confirm-dialog`. In the file `docs/plan/design/mockup.html` find `const crow`, `const cth`, `const prob`, `const containersList`, `const rowMenu`, `const newMenu`, `const inspector`: the markup is there.
3. `src/Containers.tsx` (all of it; it is the source of every behaviour).
4. `src/lib/containerRows.ts` (WO-3.1a), `src/lib/liveStats.ts` (WO-2.2), `src/Header.tsx`.
5. `scripts/checks-pending/check-home.mjs` and `check-select.mjs` (the behaviours are listed in WO-3.1c).

**Starting state:**
1. `git status --short` prints nothing; `ls src/lib/containerRows.ts src/Header.tsx src/lib/liveStats.ts` lists all three.
2. `ls src/ui/op/Row.tsx src/ui/op/Problem.tsx src/ui/op/Menu.tsx src/ui/op/Inspector.tsx src/ui/op/Blocks.tsx` lists all five, and `grep -c "onMenuKey" src/ui/op/Row.tsx` prints `0` (step 2 adds it). `grep -c "nameClass\|metaSelectable\|menuGap\|tall" src/ui/op/Row.tsx` prints at least `4` (iteration 1 has them). `grep -c "VirtualRows" src/ui/op/index.ts src/ui/index.ts` prints `0` (it is built in WO-8.8).
3. `grep -n "const row = (a: App<C>)" src/Containers.tsx` prints one line, and `grep -n "const showStrip" src/Containers.tsx` prints one line (the old row markup lies between them).
4. `grep -c "className=\"small\"" src/Containers.tsx` prints a number above 0 (old buttons to replace).
5. `grep -n "Containers" scripts/not-migrated.json` prints `src/Containers.tsx` (and later `src/Health.tsx`).
6. `npm test 2>&1 | tail -4` shows all passing. Note the count of vitest tests in `src/Containers.test.tsx` (`grep -c "^  it(\|^  test(\|^it(\|^test(" src/Containers.test.tsx`): it is used in WO-3.1c.

**Do not touch:** `src/lib/homeRows.ts`, `src/Health.tsx`, `src/Resize.tsx`, `src/FixIt.tsx`, `src/ui/` (the old components; `src/ui/op/` only as step 2 says) (they render inside the new problem lines and are migrated in WO-3.8 and WO-3.9). `src/RunPanel.tsx`, `src/RunPicker.tsx`, `src/PullPanel.tsx`, `src/ComposeProjects.tsx`, `src/ComposeLogs.tsx` (WO-3.3).

**Steps:**

1. New files. Under `src/containers/`: `ContainerRows.tsx`, `NewMenu.tsx`, `SelectionBar.tsx`, `ProblemInspector.tsx`. Plus `src/lib/inspectorContent.ts`. The folder `src/containers/` is new. There is no `ProblemLine.tsx` and no `useListKeys.ts`: the `Problem` and `Row` components of `src/ui/op` already do both jobs.
2. **Extend: Row `onMenuKey` and Problem.** Iteration 1's `Row` already has `dot`, the group checkbox, `nameClass`, `title`, `metaSelectable`, `tall` and click isolation, and `RowHead` already has `menuGap`. Two things are missing. Change only `src/ui/op/Row.tsx`, `src/ui/op/Problem.tsx` and their tests, and only with classes that exist in `container-ui.css`.
   1. `Row` gets `onMenuKey?: () => void`. On the keys `ContextMenu` and `Shift+F10` the row calls `event.preventDefault()` then `onMenuKey()` (spec 6.5 rule 8). The screen opens the row's menu with the controlled `open` prop that WO-2.3 gave `Menu`.
   2. `Problem` changes: `level` becomes `"bad" | "warn" | "ok" | "info" | "busy"`, `text` becomes `React.ReactNode`, and it gets `title?: string` (the `title` attribute of `span.what`). `bad`, `warn`, `ok` and `info` draw `<Sev level>`; `busy` draws `<span className="spinner" aria-hidden="true" />` in the same place (`.spinner` is in `container-ui.css`). The old Containers screen needs `ok` (a fix worked), `busy` (a fix is running), `info` (a note) and rich text (`Ticks` draws code ticks).
   3. Tests, added to `src/ui/op/Row.test.tsx` and `src/ui/op/Problem.test.tsx`: `Given onMenuKey, When Shift+F10 is pressed on the row, Then it is called once and onOpen is not`; `Given the ContextMenu key, Then onMenuKey is called`; `Given level busy, Then there is a .spinner and no .sev`; `Given level ok, Then Sev has class ok`; `Given text with an element inside, Then it renders`; `Given title, Then span.what has it`. Add the new `Problem` levels to the gallery.
3. `src/lib/inspectorContent.ts` (pure). It turns a Doctor `Finding` (type in `src/lib/doctor.ts`, built on `Problem` in `src/lib/health.ts`: `id`, `level`, `title`, `short`, `detail`, `fix`) into the props of the `Inspector` component. Full content:

```ts
import type { Finding } from "./doctor.ts";

// What the Inspector (src/ui/op/Inspector.tsx) is given, plus which buttons go under it.
export type InspectorContent = {
  crumb: string;               // "shop / api" or "kafka"
  title: string;               // one sentence: the problem
  lede: string;                // one paragraph in plain words
  evidence?: { text: string; bad?: boolean }[];   // "What it said"; a finding with none passes none
  findings?: string[];         // "What OpenPier found"; a finding with none passes none
  primary: { kind: "fix" | "logs"; label: string };
  also: ("logs" | "shell")[];  // secondary buttons, in this order, without the primary
  command?: string;            // what the fix will run
  level: "bad" | "warn";
};

// project: the Compose project name or null. fixLabel/fixCommand: from fixAction(); null when the app has no fix.
export function inspectorContent(f: Finding, container: string, project: string | null, fixLabel: string | null, fixCommand: string | null): InspectorContent {
  const hasFix = !!fixLabel;
  return {
    crumb: project ? `${project} / ${container}` : container,
    title: f.short ?? f.title,
    lede: f.detail.split("`").join(""),
    primary: hasFix ? { kind: "fix", label: fixLabel } : { kind: "logs", label: "Open logs" },
    also: hasFix ? ["logs", "shell"] : ["shell"],
    command: hasFix && fixCommand ? fixCommand : undefined,
    level: f.level,
  };
}
```

   The names `crumb`, `title`, `lede`, `evidence`, `findings` and `command` are the `Inspector` props; WO-3.8a uses the same names. `Finding` has no evidence or numbered findings today, so `inspectorContent` passes none and the `Inspector` draws neither heading (it draws each only when the prop is set). The Doctor gets them in WO-3.8. Do not invent text for them.
4. `src/containers/ProblemInspector.tsx`: props `{ content: InspectorContent | null; onClose: () => void; onFix: () => void; onLogs: () => void; onShell: () => void }`. It renders `<Inspector open={content !== null} onClose={onClose} crumb title lede evidence findings command actions={...} />` with the fields of `content`, and `actions` = `<Button variant="primary" size="md" onClick={onFix or onLogs}>{primary.label}</Button>` first, then for each entry of `also` a `<Button size="md">`: `Open logs` (calls `onLogs`) and `Open a shell` (calls `onShell`). The `Inspector` is a `Sheet` titled "Why"; Esc closes it and focus goes back to the line that opened it (the `Sheet` does this). The command shows in the `Command` block that the `Inspector` draws (copy button name: "Copy the command"). With `content` null it passes `open={false}` and empty strings.
5. The problem lines use `<Problem>` directly (see step 2.2 for the extra levels); there is no wrapper component. The line is tinted by `container-ui.css` (`.subrow:has(.sev.bad)`); do not add colours.
6. `src/containers/ContainerRows.tsx`: exports `TableHeadRow`, `EntryRow`, `ChildRow`. Each builds the markup of the mockup `cth` and `crow` out of `RowHead`, `Row` and `Col` with these props (all plain data, no closures over Containers' state):

```ts
type RowCommon = {
  id: string;                              // the container ID, or the project key for a group
  name: string; meta: string;              // meta: image or folder
  dot: DotState; stateWord: string;
  ports: number[]; stats: string; history: number[]; cpuNow: number | null;   // cpuNow: for the sparkline's name "CPU 4 percent"
  action: { label: "Stop" | "Start"; busy: boolean; locked: boolean } | null;
  selected: boolean; onSelect: ((v: boolean) => void) | null;   // null: the row has no checkbox (a group, Kubernetes)
  onOpen: () => void;
  onAction: () => void;
  menu: ReactNode | null;                  // the MenuItem children; null: no ⋯ button
  menuOpen: boolean; onMenuOpenChange: (open: boolean) => void;
};
type EntryProps = (RowCommon & { group: false }) | (RowCommon & { group: true; open: boolean; onToggle: () => void; blocks: Block[]; runningText: string });
```

   `Block` is the type of `src/lib/containerRows.ts` (WO-3.1a; it is the `services` item of `Blocks`). Each row is one `<Row>` with these props (`child` for `ChildRow`):
   1. `lead`: for a group, `<Button variant="ghost" size="xs" iconOnly icon={open ? "chev-down" : "chev-right"} aria-label={`${open ? "Fold" : "Unfold"} ${name}`} aria-expanded={open} onClick={(e) => { e.stopPropagation(); onToggle(); }} />`; for a single container, `<Dot state={dot} label={stateWord} />`. For a group `dot={<Dot state={dot} />}` (`Row`'s `dot` prop, already in iteration 1); for a single container no `dot`.
   2. `name` and `meta` as given. `onOpen` as given (for a group the screen passes `onToggle`). `expanded={open}` and `onToggle` for a group (the arrow keys fold and unfold).
   3. `selected` and `onSelect` as given, only when `onSelect` is not null (the hover checkbox is drawn by `Row`, and on a group row it takes the place of the dot, so the chevron stays). A group is `selected` when every container of the project is selected; its `onSelect(v)` selects or clears all of them. Only the Kubernetes entry has no checkbox.
   4. `children`, in this order: for a group `<Blocks services={blocks} />` (it draws `span.blocks`, 132 px, and turns services past nine into a "+n" block itself); then `<Col kind="ports">` holding the first two ports, each `<a className="port" href={`http://localhost:${p}`} aria-label="Open port {p} in the browser" onClick={(e) => { e.preventDefault(); e.stopPropagation(); void openUrl(`http://localhost:${p}`); }}>:{p}</a>`, and, when there are more than two, a third `<a className="port" href="#/containers/{id}/network" onClick={(e) => e.stopPropagation()}>+{n}</a>` (the route exists after WO-3.2; before that it only navigates). The old code gave a database port a copy chip and no link (`isWebPort` in `src/lib/webPort.ts`). Keep that rule: when `isWebPort(containerPort, hostPort)` is false the port draws as `<a className="port" href="#" aria-label="Copy localhost:{p}" onClick=...>` that copies `localhost:{p}` and does not open a URL (if the container port is not in the row data, `isWebPort(null, host)` decides). Then `<Sparkline points={history} label={`CPU ${n} percent`} />` when the container runs and has at least two points (else `points={null}`); then `<Col kind="stats" mono>{stats}</Col>`; then `<Col kind="state">{stateWord}</Col>`.
   5. `action`: `<Button aria-label={`${label} ${name}`} busy={busy} aria-disabled={locked || undefined} onClick={onAction}>{label}</Button>` (default variant and size, as in the mockup `btn(c.action)`; `busy` shows the spinner and ignores clicks; the word "Starting…" or "Stopping…" is in the state column); `null` when there is no action. `Row` already keeps clicks inside `.act` from opening the row.
   6. `menu` (when not null): `<Menu trigger={<MoreButton name={name} />} label={`Actions for ${name}`} align="end" wide open={menuOpen} onOpenChange={onMenuOpenChange}>{menu}</Menu>` (`MoreButton` forwards its ref and props, so it is a valid trigger). `onMenuKey={() => onMenuOpenChange(true)}`.
   `TableHeadRow` draws `cth`: `<RowHead menuGap>` with `<span className="lead" />`, `<span className="name">Name</span>`, `<span className="meta grow">Image or folder</span>`, `<Col kind="ports">Ports</Col>`, `<Col kind="cpu">CPU, 10 min</Col>`, `<Col kind="stats">Now</Col>`, `<Col kind="state">State</Col>`, `<span className="act" />`. `menuGap` draws the spacer over the ⋯ buttons.
7. `src/containers/NewMenu.tsx`: the `New` button and its menu: `<Menu label="New" align="end" wide trigger={<Button variant="primary" icon="plus" aria-label="New">New</Button>}>`. Items (words from spec 7.1 rule 1 and the mockup `newMenu`):
   1. `<MenuItem label="Run an image" why="Start one container from an image you have" shortcut="⌘N" />`
   2. `<MenuItem label="Pull an image" why="Download an image without starting it" shortcut="⌘P" />`
   3. `<MenuItem label="Start a Compose project" why="Pick a folder with a compose.yaml" />`
   There is no "Bring over from Docker Desktop" item here and none in the empty state: WO-3.11 builds it once, in its final place. `check-bring-home.mjs` stays in `scripts/checks-pending/` until then.
   The old words used an ellipsis ("Run an image…"). The spec and the mockup drop it; follow them.
8. `src/containers/SelectionBar.tsx`: props `{ count: number; canStart: boolean; canStop: boolean; onStart: () => void; onStop: () => void; onRemove: () => void; onCancel: () => void }`. Renders in the header's right side instead of search and New: `<span className="sub">{count} selected</span>`, `<Button>Start</Button>`, `<Button>Stop</Button>`, `<Button>Remove…</Button>`, `<Button variant="ghost">Cancel</Button>` (Start and Stop are disabled when `canStart` or `canStop` is false). Start and Stop act on the checked rows (the same `act` function as one row, called per row and awaited together); Remove… opens one confirm for all: `confirm({ title: "Remove {n} containers?", body: "This deletes the containers. Their images and volumes are kept, so you can run them again.", command: "docker --context {ctx} rm -f {names}", confirm: "Remove", danger: true })`. Esc clears the selection (listen to `openpier:escape`, then clear the search on the second press).
9. Keys. `Row` handles Up, Down, Enter, Space, Left and Right (it moves focus to the next row or problem line that has `tabindex="0"`, so a problem line with an `onOpen` is a stop; this differs from nothing in the spec) and, after step 2, the context-menu key and Shift+F10. `Containers` keeps `menuFor: string | null` (the row whose ⋯ menu is open) and passes `menuOpen={menuFor === id}` and `onMenuOpenChange`. Nothing else handles list keys, and no `useListKeys` exists.
10. Rewrite the markup of `src/Containers.tsx`. Method:
    1. Replace the legacy imports (`@ui/components/*`, `home.css`, `Banner` with an `error` prop, `Drawer`, `DropdownMenu*`, `Blank`, and `useConfirm` from `./ui`) by imports from `./ui/op` and the new `src/containers/*` files. Keep the imports of logic (`usePoll`, `docker`, `dockerJson`, `appsFrom`, `appState`, `runInfo`, `Findings`, `useFixRuns`, `useComposeRun`, `ResizeStatus`, `ResizeOr`, `VmChangeOr`, `LimitLine`, `fixAction`). `useConfirm` now comes from `./ui/op` and takes an object. `fixAction` (in `src/FixIt.tsx`, not migrated) still calls an old-style confirm `(message, label, { safe })`. Give it an adapter made from the new one, defined once in `Containers`: `const oldConfirm = (message: string, label = "Remove", opts?: { safe?: boolean }) => confirm({ title: `${label}?`, body: message, confirm: label, danger: !opts?.safe })`, passed where `fixAction(fix, ctx, confirm, ...)` got `confirm` (its type is `Parameters<typeof fixAction>[2]`; cast to it if tsc asks). Remove it in WO-3.8, when FixIt is rebuilt.
    2. Delete the two imports and all code of the legacy `Line` helper (it is at the bottom of the file: `function Line(`). Where `problemLine` returned `<Line level text title action />` return `<Problem level text title action child={indent} onOpen={...} />` instead (same props; `Problem` is the component of `src/ui/op` after step 2.2; its old level `off` becomes `info`). `onOpen` for a finding opens the inspector (step 11); for a line with no finding (a fix run's progress or result) it is undefined.
    3. In `problemLine`: every `<button className="small" ...>` becomes `<Button size="xs" ...>` (keep `onClick`, `aria-label`, `aria-disabled`); `Button variant="default" size="sm"` becomes `Button variant="primary" size="xs"` when it is the app's own fix ("Fix kafka and kafka-ui…"), and `variant="default" size="xs"` when the line explains ("See why"). `See why` opens the inspector, not the detail page (so `setDetailId(c.ID)` there becomes `openInspector(c, p)`).
    4. Replace the body of `const row = (a: App<C>) => {...}` (from its first line to its closing `};`): keep every computation above the JSX in it (state, `i`, `states`, `busy`, `pending`, `main` verb, `canAct`); replace the returned JSX by building `EntryProps` and `ChildRow` props from them. A row's id is `a.key` for an entry and `a.key + "/" + c.Names` for a child. `Row` draws no `data-row`, so wrap nothing: the old `rowSel` helper (it finds a row by the container name for focus after an action) becomes a lookup of the `.name` element whose text equals the container name, inside the `.list`; keep its callers as they are.
    5. Replace the returned JSX of the component (from `const showStrip` to the end of the function): see step 12 for the structure. The sr-only live regions (`role="status"` and `role="alert"`, driven by `said`) stay exactly as they are, at the top, and are rendered once.
    6. The list is `<List aria-label="Containers">` inside `<div className="content">`, first `<TableHeadRow />`, then one element per line from `flatten(sorted, isOpenFn, hasProblemFn)` with `sortEntries`. Every line renders. Spec 6.5 rule 9 asks for a virtual list above 200 rows; `VirtualRows` (`src/ui/VirtualRows.tsx`, the one component besides `Meters` and `LogView` that may write `style`) is built in WO-8.8 and used by this list then. Say so in the pull request.
    7. `Containers` no longer renders `<ContainerDetail>` itself (props `detailId` and `setDetailId` stay in the type until WO-3.2, which routes the detail). Clicking a row calls `setDetailId(c.ID)` as today.
    8. Fold state: `openpier:containers-open`, a JSON object `{ [projectKey]: boolean }`, read once in try/catch, written when the user folds or unfolds; `isOpen(hasProblem, saved[key])`. Replace the old `open` Set and `toggle` (find `const toggle = (k: string)`); the old key `...:open` is gone.
    9. Remove: the "Compose projects" toolbar button remnants, the `searching` rule `SEARCH_AT` (the search field is always shown now, spec 7.1 rule 1; delete `SEARCH_AT` and its comment), the old `Banner error=` use.
11. Inspector wiring: `const [inspect, setInspect] = useState<{ c: C; f: Finding } | null>(null)`. `openInspector(c, f)` sets it. `content = inspectorContent(f, c.Names, projectOf(c), fixLabel, fixCommand)` where `fixLabel` and `fixCommand` come from `fixAction(...)` in `src/FixIt.tsx`: it returns `null` or an object with `label`, `busyLabel`, `running`, `locked`, `go` and `hint` (read the file: the `hint` is the sentence about what it does; the command text for `.cmd` is `describe(...)` of the fix, which `problemLine` already calls for its `title`). `onFix` calls the same `go` the line's fix button calls. `onLogs` goes to `#/containers/{id}/logs` (after WO-3.2; before it, `setDetailId(c.ID)`). `onShell` calls `openShell` from `src/lib/shell.ts` with the container.
12. Screen structure (everything inside `Containers`' return):

```
<>
  <live regions />
  <Header title="Containers" summary={summary(total, needAttention)}>
    {selected.size > 0 ? <SelectionBar .../> : (<>
      <Field icon="search" width="search" data-page-search aria-label="Search containers" placeholder="Search containers" value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} />
      <NewMenu .../>
    </>)}
  </Header>
  <div className="content">
    {error banner}   // state 6, WO-3.1c
    {list or state}  // states 1 to 5, WO-3.1c
  </div>
  <ProblemInspector .../>
  {the sheets and drawers that exist today: ComposeProjects, ComposeLogs drawer, RunPicker, RunPanel}   // unchanged until WO-3.3
</>
```

    `total` counts `all` minus Kubernetes pod containers; `needAttention` counts containers that have a problem line (decision D1: the mockup now reads `10 · 5 need attention`). The header search shrinks by CSS under 1040 px; write nothing for it. Remove the `<Header title="Containers" />` line `App.tsx` has been rendering for Containers since WO-2.2.
    The `VmStrip`: keep rendering `showStrip` as it does today, above the list, until WO-3.1c (it folds start and stop failures into the states).
13. Menus (spec 7.1 rules 9 and 10; hints from the mockup `rowMenu` and the spec). `containerMenuItems(c, a)` returns, for a **running** container:
    1. `Logs` (why "To see what it printed")
    2. `Open a shell` (why "To run commands inside it")
    3. `Restart` (why "After you change a setting or it got stuck")
    4. `Not an issue` (why "Stops showing this problem"), **only when the row has a problem** (a feature today: mute a problem; the author accepted the words).
    5. separator
    6. `Copy name`
    7. `Run it yourself` (why "Shows the command, if you'd rather use Terminal")
    8. separator
    9. `Remove…` (danger; why "Deletes the container. Volumes are kept")
    For a **stopped** container: `Logs`, `Not an issue` (if a problem), separator, `Copy name`, `Run it yourself`, separator, `Remove…`. (No Open a shell and no Restart: they need a running container.) The main button already says Start.
    `projectMenuItems(a)` returns:
    1. `Start the {n} stopped ({names})` first, only when some of its containers are only stopped (the same rule and words as today). No hint.
    2. `Rebuild and start` (why "After you change a Dockerfile or the code it copies in")
    3. `Update images and start` (why "When a newer version of an image is out")
    4. `Restart` (why "After you change a setting in compose.yaml")
    5. `Show logs`
    6. `Show in Finder`
    7. separator
    8. `Run it yourself`
    9. separator
    10. `Remove containers…` (danger; why "To start clean. Volumes and data are kept")
    While a project is busy (`canAct` false) its Rebuild, Update, Restart and Remove items have `aria-disabled="true"`.
    Each item is `<MenuItem label="..." why="..." danger disabled onSelect={...} />` (the label is a prop). Every item keeps the call it makes today (the same `project(a, "build" | "pull" | "restart" | "down" ...)`, `openShell`, `reveal`). `Copy name` writes the name to the clipboard and calls `toast({ text: "Copied {name}" })`. `Run it yourself` opens the new confirm dialog with `confirm({ title: "Run {name} yourself", body: "This is what OpenPier runs. You can paste it in Terminal.", command, confirm: "Copy command" })` and copies `command` when the answer is yes. `Containers.tsx` has no such item today (`src/ComposeProjects.tsx` has a "Run it yourself" for projects that shows the commands: read it for the Compose wording), so the command is `docker --context {ctx} {start|stop|restart} {name}` for a container's main action and `cd '{dir}' && docker --context {ctx} compose {up -d|stop}` for a project (quoted with single quotes, as the old Compose copy did).
14. Remove asks first (confirm, spec 6.8): `confirm({ title: "Remove {name}?", body: "This deletes the container. Its image and volumes are kept, so you can run it again." plus, when it runs, " It is running and will be stopped first.", command: "docker --context {ctx} rm -f {name}", confirm: "Remove", danger: true })`: the dialog has `Cancel` and `Remove` (danger), focus on Cancel. Confirming removes exactly that container's ID. For a project: title `Remove the containers of {name}?`, body "This deletes the containers of the project. Images, volumes and data are kept.", `command` `cd '{dir}' && docker --context {ctx} compose down`, `confirm: "Remove containers"`, `danger: true`.
15. Selection state: `const [checked, setChecked] = useState<Set<string>>(new Set())` keyed by container ID (single containers, the children of a project and the project row itself have a checkbox; see step 6.3). Fold state, `q` (search), `focusId` stay in the component.
16. Kubernetes entry: draws an `EntryProps` single row: name `Kubernetes`, meta `{n} containers`, no ports, no stats, state word empty, `action: null` (no button), `menu: null` (no ⋯ button) and `onSelect: null` (no checkbox). A click on the row (`onOpen`) goes to `#/kubernetes/pods` (decision D10: spec 7.1 rule 8, a folded group with no actions).
17. Update `src/App.tsx`: remove the `<Header title="Containers" />` line, pass `live` and `history` (from `useLiveStats`, WO-2.2) to `Containers` as props `live: LiveMap` and `history: Record<string, number[]>`, and the `Header` count: none (Containers builds its own).
18. `scripts/not-migrated.json`: remove `src/Containers.tsx`; add nothing. Run `npx eslint src/Containers.tsx src/containers` and fix what it reports (no `<button`, `<select`, `<table`, no `style=`, no old imports).
19. `src/Containers.test.tsx` is migrated in WO-3.1c. In this work order only keep the build green: tests that fail because of new words are listed, not fixed, in `docs/plan/FOUND.md` ("test X waits for WO-3.1c"). Skipping is not allowed (HANDOFF rule 5): if a test cannot run until 3.1c, it must fail for the stated reason until 3.1c, so the gate for 3.1b is `npm run lint`, `npx tsc --noEmit`, the new tests, the Rust gate, and `npm test` with only those named failures. This is the one exception to "the gate passes"; the pull request file lists each failing test name.

**Tests to write first:**

`src/lib/inspectorContent.test.ts` (node:test):
1. `Given a bad finding "Its health check is failing" for api in shop, When inspectorContent runs with a fix label, Then crumb "shop / api", title is the short text, primary kind "fix"`.
2. `Given no fix, When inspectorContent runs, Then primary is "Open logs" and also is ["shell"]`.
3. `Given a loose container, When inspectorContent runs, Then crumb is just its name`.
4. `Given a detail with backticks, When inspectorContent runs, Then the lede has none`.
5. `Given any finding, When inspectorContent runs, Then evidence and findings are undefined`.

`src/containers/ContainerRows.test.tsx` (vitest):
0. (the tests of step 2.3, in `src/ui/op/Row.test.tsx` and `src/ui/op/Problem.test.tsx`, are written first of all.)
1. `Given an entry with two ports, When rendered, Then two links ":8080" and ":9000" show and each opens its URL on click and onOpen does not run`.
2. `Given three ports, When rendered, Then two links and "+1" show`.
3. `Given a database port, When rendered, Then it has the label "Copy localhost:3306" and click copies "localhost:3306" and does not open a URL`.
4. `Given a group with 7 blocks, When rendered, Then the blocks element has 7 children and the state text "5 of 7 running"`.
5. `Given a group, When the chevron is pressed, Then onToggle runs and aria-expanded flips`.
6. `Given an action button, When pressed, Then onAction runs once and onOpen does not run`.
7. `Given the row, When the ⋯ button is pressed, Then onOpen does not run and the menu shows`.
8. `Given onSelect and the row is hovered, When rendered, Then a checkbox shows in place of the dot; Given a group with onSelect, Then the checkbox takes the place of its dot and the chevron stays; Given onSelect is null, Then none shows`.
9. `Given busy true, When rendered, Then the action button has aria-busy "true" and a click does not call onAction`.
10. `Given a stopped container, When rendered, Then the stats cell is empty and there is no sparkline`.
11. `Given a running container with 5 history points, When rendered, Then one svg.spark with the name "CPU 4 percent" shows`.
12. `Given TableHeadRow, When rendered, Then the cell texts are Name, Image or folder, Ports, "CPU, 10 min", Now, State`.

`src/containers/ProblemInspector.test.tsx` (vitest):
1. `Given content with a fix, When rendered, Then the primary button has the fix label and the secondary buttons are "Open logs" and "Open a shell"`.
2. `Given content without evidence, When rendered, Then the text "What it said" is absent`.
3. `Given a command, When rendered, Then it shows in a code element with a button named "Copy the command"`.
4. `Given Escape is pressed, When open, Then onClose runs`.

`src/containers/NewMenu.test.tsx` (vitest):
1. `Given the menu is open, When rendered, Then the items are exactly "Run an image", "Pull an image", "Start a Compose project" in that order, and the first two show "⌘N" and "⌘P"`.
2. `Given the menu is open, Then there is no item with the text "Bring over"`.
3. `Given an item is chosen, When pressed, Then its handler runs once`.

`src/containers/SelectionBar.test.tsx` (vitest):
1. `Given count 2, When rendered, Then "2 selected" and the buttons Start, Stop, Remove…, Cancel show`.
2. `Given Remove… is pressed, When the confirm shows, Then the title is "Remove 2 containers?"`.

**Done when:**
1. All new test files pass: `npx vitest run src/containers src/ui/op/Row.test.tsx src/ui/op/Problem.test.tsx` and the node tests (`node --experimental-strip-types --no-warnings --test src/lib/containerRows.test.ts src/lib/inspectorContent.test.ts`), no `fail`.
2. `npx tsc --noEmit` and `npm run lint` pass; `grep -n "src/Containers.tsx" scripts/not-migrated.json` prints nothing; `node scripts/check-not-migrated.mjs` passes.
3. `grep -n "className=\"small\"\|<button\|<table\|style=" src/Containers.tsx src/containers/*.tsx` prints nothing.
4. In the preview (`http://localhost:4173/?scenario=design#/containers`, 1180x760), compare by eye with `containers-light.png` and `containers-dark.png`. The mockup check (WO-3.1c) compares the closed list; everything below that needs a click is by eye. Write what you compared in the pull request file:
   1. Header: title "Containers", muted "10 · 5 need attention", meters, search field, blue `New` button last.
   2. Table head row: Name, Image or folder, Ports, "CPU, 10 min", Now, State.
   3. Row order: kafka, kafka-ui, shop (open, with its seven children), scratch-postgres.
   4. kafka-ui's line "Can't reach Kafka" has the primary button "Fix kafka and kafka-ui…"; kafka's line says "Fixed together with kafka-ui" and has no button; the other lines have a plain "See why".
   5. The group row shows blocks "booowbx", port `:8080`, "5 of 7 running", and a `Stop` button.
   6. Click "See why" on api: the Inspector opens with crumb "shop / api".
   7. ⋯ on a running container shows the menu of the picture `containers-row-menu`: Logs, Open a shell, Restart, separator, Copy name, Run it yourself, separator, Remove…. (`Not an issue` also shows for a row with a problem; it is not in the picture and the author accepted it.)
   8. `New` shows the three items of `containers-new-menu`.
5. The gate in `../HANDOFF.md` section 5, except the named tests of step 19.

**Pull request text:** the file `docs/plan/iterations/pr/wo-<id>.md`. Its first line is this title: `wo-3.1b: The Containers screen on the new design`

---

## WO-3.1b-2 Containers: finish the screen WO-3.1b left on the old markup

**Needs:** WO-3.1b merged, the revert of the first WO-3.1c merged (`git log --oneline --first-parent main` shows `Merge branch 'wo-3.1c-revert'`).

**Why:** the review of 2026-11-14 found that WO-3.1b built the new components but `src/Containers.tsx` never uses them: `EntryRow`, `ChildRow` and `TableHeadRow` are imported and not drawn, the screen still draws the old `app-row`, `svc-row`, `home` and `start-first` markup, and 31 lines of classes the design does not have were added to `docs/plan/design/container-ui.css` and `src/ui/container-ui.css` (commit `c309e84`) so the class check would pass. The design files are the source of truth (HANDOFF section 3): nobody edits them.

**Read first:** WO-3.1b in full (above), `docs/plan/HANDOFF.md` rules 19 and 20, `git show c309e84 -- docs/plan/design/container-ui.css`.

**Starting state:**
1. `git status --short` prints nothing.
2. `cd docs/plan/design && shasum -a 256 -c SHA256SUMS` prints `container-ui.css: FAILED` and nothing else failed.
3. `grep -c "<EntryRow" src/Containers.tsx` prints `0`.

**Do not touch:** `docs/plan/` except the pull request file; `src/ui/op/`.

**Steps** (do them in parts, rule 19: part A is steps 1 and 2, part B is step 3 up to WO-3.1b step 12, part C is the rest):

1. Take the added block out of both stylesheets: `git show ff74f97:docs/plan/design/container-ui.css > docs/plan/design/container-ui.css`, then copy the same file to `src/ui/container-ui.css` (they must be equal: `node scripts/check-design-sync.mjs`). `cd docs/plan/design && shasum -a 256 -c SHA256SUMS` now prints only `OK` lines.
2. `node scripts/check-classes.mjs` now fails on the old classes in `src/Containers.tsx`. Write down the list it prints in the pull request file: it is the list of markup step 3 replaces.
3. Do WO-3.1b steps 10 to 18 again, to the letter, on the current `src/Containers.tsx`: the list is drawn with `TableHeadRow`, `EntryRow` and `ChildRow` from `src/containers/ContainerRows.tsx`, the problem lines with `Problem`, the header with `Header`, `NewMenu`, `SelectionBar` and `ProblemInspector` as WO-3.1b step 12 lays out. Keep every behaviour (Start and Stop with the pending words, project runs, fix runs, resize and folder fixes, the VM strip): WO-3.1b step 10 says how. Only classes from `container-ui.css` (rule 1 of "Rules that hold in every work order").
4. Tests: the WO-3.1b tests still pass. `src/Containers.test.tsx` may fail only for the reasons WO-3.1b step 19 allows; list each failing test name in the pull request file.

**Done when:**
1. `cd docs/plan/design && shasum -a 256 -c SHA256SUMS` prints only `OK` lines; `node scripts/check-design-sync.mjs` and `node scripts/check-classes.mjs` pass.
2. Every `WO-3.1b:` line of `sh docs/plan/iterations/verify-iteration-2.sh` prints `ok`, and so does `design files unchanged`.
3. WO-3.1b "Done when" 1 to 3 (run each command, paste its output).
4. By eye at `http://localhost:4173/?scenario=design#/containers` against `containers-light.png` and `-dark.png`: the list looks like the picture (columns, dots, problem lines, ports), not like plain buttons in a column.
5. Lint, tsc and the Rust gate pass.

**Pull request text:** `docs/plan/iterations/pr/wo-3.1b-2.md`. First line: `wo-3.1b-2: Containers draws the new rows`

---

## WO-3.1c Containers: eight states, scenarios, checks, migrated tests

**Needs:** WO-3.1b.

**Why:** U7, U9, U14, E12 and the rule that every list handles all eight states (spec section 8). Brings back four old checks.

**Done in three parts, one session each** (a first attempt in one session ran out of context and dropped tests and checks; it was reverted). Each part has its own branch, its own pull request file, and is merged with `--no-ff` before the next part starts. Start each part in a new session. Read this whole work order once, then only what the part names.

1. **WO-3.1c-1, the states** (branch `wo-3.1c-1`, file `pr/wo-3.1c-1.md`). Read first: items 1, 2, 3 and 5 below. Do steps 1, 2, 3 and 7, plus the `renderScreen` helper of step 4.6. Tests first: new tests 1 to 7 of "Tests to write first", added to `src/Containers.test.tsx` next to the old tests (do not touch the old ones yet). Done when: the seven new tests pass; the only failing tests are the ones WO-3.1b named (the count is not higher than "Starting state" 2); in `verify-iteration-2.sh` the lines `WO-3.1c: scenario loading`, `scenario unreachable`, `failstart parameter`, `stopped state words`, `empty state words` and `error banner words` print `ok`; lint, tsc and the Rust gate pass.
2. **WO-3.1c-2, the old tests** (branch `wo-3.1c-2`, file `pr/wo-3.1c-2.md`). Read first: item 4, the test file only, and the old file `git show 36a499b:src/Containers.test.tsx` (36a499b is the last commit before any WO-3.1c work). Do step 4: every one of the 21 old tests is kept with new selectors and words, or rewritten to the new rule, or removed with the spec rule quoted. The table in `pr/wo-3.1c-2.md` has one row per old test, 21 rows, each starting with the old test name copied exactly. Then new tests 8 to 11. Done when: "Done when" 1 (`npm test` has 0 failures) and every `WO-3.1c:` line about tests in `verify-iteration-2.sh` prints `ok`.
3. **WO-3.1c-3, the browser checks and the mockup rows** (branch `wo-3.1c-3`, file `pr/wo-3.1c-3.md`). Read first: the four files under `scripts/checks-pending/` named in step 5, one at a time. Do step 5 one old file at a time, in this order: `check-menus.mjs`, `check-down.mjs`, `check-select.mjs`, `check-home.mjs`. After each file, run the new check in Chromium and commit on the branch (`wip(wo-3.1c-3): <file> ported`), so a new session can carry on from the last commit. Then the 16 new lines, then step 6. Done when: "Done when" 2 to 8, and every `WO-3.1c:` line of `verify-iteration-2.sh` prints `ok`.

Copying lines that only check that an element exists ("h1 renders") does not port a behaviour. Each old behaviour in the lists of step 5 becomes a check of that behaviour, or a line in the pull request file saying "Moved to WO-x" or "Gone by design" as the list says.

**Read first:**
1. `docs/plan/04-design-spec.md` sections 6.9 and 8.
2. Mockup pictures `empty-state`, `machine-stopped`, `loading-error-toast` (both themes).
3. `src/Containers.tsx` (the part that renders `VmStrip`, the stopped `Blank`, `failedChange`), `src/VmStrip.tsx`.
4. `src/Containers.test.tsx` (all), `scripts/checks-pending/check-home.mjs`, `check-down.mjs`, `check-menus.mjs`, `check-select.mjs` (all four, in full).
5. `preview/mock.ts`: find `case "docker":` in the `invoke` switch, `ddParam`, `scenario`.

**Starting state:**
1. `git status --short` prints nothing; `ls src/containers` lists `ContainerRows.tsx NewMenu.tsx ProblemInspector.tsx SelectionBar.tsx` and `ls src/lib/inspectorContent.ts` lists the fifth new file of WO-3.1b.
2. `npm test 2>&1 | grep -c "FAIL\|✗\|failed"` prints a number: write it down. These are the tests named in WO-3.1b step 19; this work order brings it to 0.
3. `grep -n 'case "docker"' preview/mock.ts` prints one line; `grep -n "function ddParam\|const ddParam" preview/mock.ts` prints one line.
4. `ls scripts/checks-pending` lists `check-home.mjs check-down.mjs check-menus.mjs check-select.mjs`.

**Do not touch:** `src/ui/` (old components and `src/ui/op/`), other screens.

**Steps:**

1. Mock scenarios (edit `preview/mock.ts`; each is read from the address as the other scenarios are). Add, near the other scenario flags:
   1. `?scenario=loading`: the first `docker ps` never answers. In the `case "docker":` handler, before the command runs: `if (scenario === "loading" && args[0] === "ps") return new Promise<string>(() => {});` (the skeleton stays on screen).
   2. `?scenario=unreachable`: the first `ps` answers with the design data, every later `ps` throws `"Cannot connect to the Docker daemon at unix:///Users/me/.colima/default/docker.sock. Is the docker daemon running?"`. Implementation: a module-level `let psCalls = 0;` and `if (scenario === "unreachable" && args[0] === "ps" && ++psCalls > 1) throw "...";`.
   3. `&failstart=<name>`: `docker start <name>` throws `Error response from daemon: driver failed programming external connectivity on endpoint {name}: Bind for 0.0.0.0:8080 failed: port is already allocated`. In `case "start"` of `dockerCmd`: `const failName = ddParam("failstart"); if (cmd === "start" && failName && args.includes(failName)) throw new Error("...");` Use `ddParam` the way `ddParam("oomfail")` is used on the same switch.
   4. The empty list uses the existing `&empty=1`. The stopped machine uses the existing `?scenario=stopped`.
   5. `scenario` is one word (`design`), and `empty=1` and `failstart` are separate query parameters read with `ddParam`, so they combine with it: the failed-row address in the checks is `?scenario=design&failstart=report-job`. The checks prove it: with `&empty=1`, `await p.evaluate(() => window.__mock.state().ctrs.length)` is 0 (`window.__mock` is the handle `preview/mock.ts` already has; its `state()` returns a copy of the fake data).
2. The eight states in `src/Containers.tsx` (the JSX of step 12 of WO-3.1b gets these branches; texts are exact):
   1. **First load**: `containers.data === null && !containers.error && running` renders `<SkeletonRows rows={4} />` inside the list area, header already visible (search and New shown). A refresh never shows it again (rule: the old rows stay).
   2. **Loaded with data**: the list.
   3. **Loaded, empty** (`containers.data` is `[]` and no error): `<Empty icon="box" title="No containers yet" actions={<><Button variant="primary" size="md">Run an image</Button><Button size="md">Start a Compose project</Button></>}>Run an image, or start a Compose project from a folder.</Empty>`. There is no `Bring over from Docker Desktop` button or body here (decision E2): WO-3.11 builds it once, in its final place, and `check-bring-home.mjs` stays pending until then.
   4. **Search with no match**: when `term` is set and no entries match: `<Empty icon="search" title={`Nothing matches "${term}".`} actions={<Button size="md">Clear search</Button>}>`. Keep the old extra: when the term matches a Compose project that is not running (`projectHits > 0`) show under it the line "{n} Compose project that isn't running matches." and a `Button variant="ghost"` `Show it` (or `Show them`) that opens the Compose start sheet already searched (the old words "1 Compose project that isn't running matches" and "{n} Compose projects that aren't running match" stay).
   5. **Engine stopped** (`!running && !vm.op && !vm.failure && !failedChange`): header shows only the title (no search, no New). `<Empty icon="box" title={`${profile.name} is stopped`} actions={<Button variant="primary" size="md">{`Start ${profile.name}`}</Button>}>Your containers and data are kept. Start the machine to see them.</Empty>` (the button calls `start`). When `back` (a way back after a failed change) exists, the old two-button card stays: keep `wayBackNote(back)` as a second line and the filled button `{undoLabel(back)}` as primary, `Start {profile.name}` as default. (The words are decision D4, see the top of WO-3.1.)
   6. **Engine not reachable**: `containers.error` set: a `<Banner tone="bad" title="Couldn't list containers" actions={<><Button size="md">Try again</Button><Button variant="primary" size="md">{`Restart ${profile.name}`}</Button></>}>` with body the first line of the error and, when the error text has "Cannot connect" or "did not answer", the line "The machine may be stuck." (`Try again` calls `containers.reload`; `Restart` calls the old restart: `vmAct("starting", "restart_profile", { name: profile.name })`). The list below keeps the last good data.
   7. **An action running on a row**: the state column shows the busy word from `pending` ("Stopping…", "Starting…"), the action button has `busy` (it shows the spinner and `aria-busy="true"`), the dot is `busy` (blue). The old `pending` map and `PENDING_MS` drive it. The row does not move (rows keep their order while an action runs: `sortEntries` is computed from the order kept in a ref while `pending` is non-empty; add that ref, named `orderRef`, set when no action is pending).
   8. **An action failed on a row**: a `<Problem level="bad">` under the row with the plain reason and a `<Button size="xs">Try again</Button>` as its `action`. The old `failed` map and `fail` function give the reason; the text is `fail`'s plain-words text (for a port clash: "Port 8080 is already used by {name}. …" as today's text). Never raw Docker output alone (spec 9.6): the raw text sits in the line's `title` and in the Activity sheet.
3. The VM strip (`VmStrip`): `showStrip` (a start or stop in progress, or its failure) renders above the list as today, inside `.content`, still drawn by the old `VmStrip` component. This is the least change that keeps the old checks `starting` and `failed` and `stuck` provable. `src/VmStrip.tsx` stays on `scripts/not-migrated.json` (iteration 3 WO-3.9 rebuilds it into Settings, Machines). Write in the pull request file: "VmStrip not migrated (WO-3.9)".
4. Migrate `src/Containers.test.tsx`. Make a table in the pull request file with one row per test: old name, kept or changed or removed, and the reason. Rules: a test of behaviour that still exists is kept with new selectors and words; a test of a rule the spec changed is rewritten to the new rule; a test is removed only when its behaviour is gone by design, with the spec rule quoted. Known changes (from today's file):
   1. "apps are alphabetical, Kubernetes last" becomes "problems first, then running, then stopped, alphabetical inside, Kubernetes last" (spec 7.1 rule 7).
   2. "no checkboxes" becomes "a checkbox shows on hover or focus and with a selection" (spec 6.5 rule 7).
   3. Accessible names like "shop, project, Running" become the new row names. The new accessible name of a row is `{name}, {state word}` and, for a project, `{name}, project, {runningText}`; add `aria-label` on the row accordingly. Problems are announced by their own lines.
   4. Words `Start VM` and "The VM ... is stopped" become `Start {name}` and "{name} is stopped".
   5. `Not an issue` stays (menu item).
   6. Every render in the file is wrapped in the new providers: `<ConfirmProvider><ToastProvider><TooltipProvider>…</TooltipProvider></ToastProvider></ConfirmProvider>` imported from `./ui/op` (put it in one helper, `renderScreen`, at the top of the test file). The old tests render without them.
5. Bring back the four old checks, rewritten as ONE new check file plus the old names kept where they prove different things. `git mv` the four to `scripts/`, rewrite on `scripts/lib/check.mjs`, and delete the four rows from `scripts/checks-pending/README.md`. File plan: `scripts/check-containers.mjs` (from `check-home.mjs`, `check-select.mjs`, `check-down.mjs`) and `scripts/check-menus.mjs` (its own file, as before). Remove the files `check-home.mjs`, `check-select.mjs`, `check-down.mjs` after their lines are ported (`git mv check-home.mjs check-containers.mjs`, then append what the others proved). `scripts/check-all.sh` runs every `scripts/check-*.mjs`, so it needs no edit.

   Scenarios: use `running` (the old data: 3 top-level rows kafka, kafka-ui, shop) for lines that carry over with the old numbers, and `design` for the order and mockup lines. Each check message names its scenario in brackets. `doctor`, `desktop`, `k8spods`, `stopped`, `failed`, `stuck`, `stopfail`, `missing`, `partial`, `nobrew`, `none` keep the names the old scripts used.

   Selectors: row `.list .row:not(.th)` (the header row is `.row.th`), name `.row .name`, state `.col.state`, action `.act .btn`, ⋯ `[aria-label^="More actions for"]`, problem `.subrow`, ports `.port`, blocks `.blocks u`, checkbox `input.check`. A row has no `data-row` attribute: find a row by the text of its `.name`. Words are the new ones.

   **Behaviours of `check-home.mjs` (running scenario = `design`)** and where each goes:
   1. No VM strip while the machine simply runs. **Kept** (`.vm-strip` count 0).
   2. No usage meters and no CPU or Memory columns on home. **Gone by design**: spec 5.4 and 6.14 put meters in the header and the list has `CPU, 10 min` and `Now` columns. Replaced by: the header has `.meters` with three bars; the list has the columns named in WO-3.1b.
   3. No Restart or Stop machine button on home. **Moved**: they live in the engine switcher ("Stop default"); proved in WO-2.3.
   4. Restart and Stop are in the switcher menu. **Moved to WO-2.3** (Stop default is there; Restart is in Settings, Machines).
   5. The switcher names the machine and says Running. **Moved to WO-2.3**.
   6. One row per app: kafka, kafka-ui and the shop project (4 top-level rows with scratch-postgres). **Kept**, adapted to the design data (4 rows).
   7. Alphabetical order. **Gone by design**: replaced by "problems first, running, then stopped; alphabetical inside": the check lists the top-level names and expects `kafka, kafka-ui, shop, scratch-postgres`.
   8. Opening shop lists its 7 services; 7 `.row.child`. **Kept**.
   9. One primary outside problem lines: `New`. **Kept** (`.header .btn.primary` count is 1 plus the problem lines' primaries). New is the primary. **Kept**.
   10. New offers three items. **Kept** with the new words (`Run an image`, `Pull an image`, `Start a Compose project`).
   11. Escape closes the menu and focus returns to New. **Kept**.
   12. "Start a Compose project" opens the Compose projects panel. **Kept**: a `[role=dialog]` appears (the legacy drawer today; the sheet after WO-3.3).
   13. A row's ⋯ is visible and focusable without hovering. **Kept** (opacity 1, size above 0, focusable) for a row and for a child.
   14. Rows are one line: row height at most 34 and child at most 34 (the old numbers were 41 and 33; the new ones come from `--row`). **Adapted**.
   15. Fold the sidebar to icons and keep it usable; the choice survives a reload. **Moved to WO-2.4** (`check-palette` line 11); here nothing.
   16. A loose container's problem shows under its own row. **Kept**.
   17. A folded project shows its services' problems under its row, each naming its service. **Kept**: shop is open by default in the design data because it has problems; the check folds it first and expects lines starting with `api · `, `worker · `, `report-job · `.
   18. Every problem line has at most one button; the only line without a button says which row fixes it ("Fixed together with kafka-ui."); at most one such line. **Kept**.
   19. The shared fix is offered once, on the row that owns it, naming both ("Fix kafka and kafka-ui…"). **Kept**.
   20. Web ports have a quick link on the row (`Open shop at localhost:8080 in your browser`). **Adapted**: the label is now `Open port 8080 in the browser` (the mockup's aria-label); the check expects one `.port` link with `:8080` on shop and one with `:8082` on kafka-ui.
   21. A folded project shows the first web port and hides the database port. **Adapted**: the group row shows `:8080` only.
   22. Opened, a web port (nginx 80) opens in the browser; a database port is a copy chip, not a web link, and shows just `:3306`, not clipped. **Kept** (`.port.muted`, label `Copy localhost:3306`, text `:3306`).
   23. No All, Running or Needs attention filters. **Kept**.
   24. No checkboxes and no bulk bar. **Gone by design**: spec 6.5 rule 7. Replaced: no checkbox is visible at rest; after hover on a row an `input.check` shows in that row; checking one shows "1 selected" and the buttons Start, Stop, Remove…, Cancel; Escape clears it. **New**.
   25. No Compose projects toolbar button, no terminal note, no free-space nudge on home. **Kept**.
   26. No sideways scroll. **Kept**.
   27. Both live regions (`role=status`, `role=alert`) exist from the first render. **Kept**.
   28. No page errors. **Kept**.
   29. Search (doctor scenario, 7 apps): by image, by port number, no match says "Nothing matches" (now with the quotes and a `Clear search` button), a search for a project that is not running links to Compose projects (`Show it`). **Kept**, with the new words; `Show it` opens the Compose panel.
   30. The search field shows with 9, 7 and 6 rows (it earned its place from 7 rows). **Gone by design**: the search field is always there (spec 7.1 rule 1; the mockup `empty-state` shows it with no containers). Replaced by one new line: the search field is present in the design scenario and in `&empty=1`.
   31. Stopped scenario: one blank state with one primary, Start; no strip, no New. **Kept**, new words: title "default is stopped", primary `Start default`, no `New`, no search.
   32. The profile menu offers Start and no Restart for a stopped machine. **Moved to WO-2.3** (stopped row has a Start button).
   33. Starting: output log, strip says Starting, stopped state gone, log text cleaned; when running, the apps show. **Kept** (the strip is kept, WO-3.1c step 3).
   34. Compose: a project starts folded **Gone by design** (it starts open when something is wrong, spec 7.1 rule 5): the check uses the `running` scenario's healthy data? Not available; use `?scenario=design` and a project with no problems? None. So: **Adapted**: with problems it starts open; after the user folds it, a reload keeps it folded (`openpier:containers-open`).
   35. The folder is shown with `~`. **Kept** (meta shows `~/code/shop`).
   36. A loose container is a row of its own, not a group. **Kept**.
   37. Folding hides services; the project row counts what runs ("5 of 7 running"). **Kept**.
   38. `Stop shop` says "Stopping…" while it works, then "Stopped" and the button back to Start. **Kept**.
   39. Stopping a service from its own menu is said aloud ("web stopped" in the status region). **Kept**.
   40. Stopped scenario, other tabs name the stopped machine and start it from there (Images "default is stopped", `Start default`, Containers shows after). **Kept** against the legacy Images page text (`default is stopped`) until WO-3.4.
   41. Failed start: one card, reason and retry; the error shows once; "Try starting again"; a plain reason and the log path; the telling line; one primary; no force stop without lock-file evidence. **Kept** (VmStrip unchanged).
   42. Stuck: says stuck from an earlier run; Force stop then start works. **Kept**.
   43. Missing: install card with the exact brew command; partial lists only what is missing; nobrew shows the bootstrap command with copy and no one-click install. **Moved to WO-3.10** (Setup). Until then **Kept** unchanged: the install card still renders from the same code. (If the install card is rebuilt before, WO-3.10 owns it.)
   44. None: start-first-machine state, "Start Colima (6 CPUs, 8 GiB)", "Customize first" opens a prefilled form. **Kept** unchanged (legacy code until WO-3.10).
   45. Stop failure (`stopfail`): the card says the stop failed, not the start; state amber not red; Force stop is the one primary; Try again repeats the stop and does not start. **Kept**.
   46. A stale failure clears once the machine runs again. **Kept**.

   **Behaviours of `check-down.mjs`** (scenario `desktop`; the check keeps using it, because `design` has no "cache only stopped" case. `desktop` is an existing scenario whose data iteration 1 did not change (WO-1.5 forbids it); shop is 5 of 7 with cache stopped there. The check prints `shop` row's text first, and stops if it does not say "5 of 7 running"):
   1. shop reads "5 of 7 running". **Kept**.
   2. The last line under shop says "cache is stopped" with `Start`. **Kept** (a `.subrow` with those words; the line is plain, no severity icon colour of its own).
   3. report-job keeps its own problem line before the plain one; no other line says "is stopped". **Kept**.
   4. The row's accessible name counts problems and stopped apart ("..., 3 problems, 1 stopped"). **Adapted**: the group row's `aria-label` is `shop, project, 5 of 7 running, 3 problems, 1 stopped`.
   5. report-job's line offers "Give the VM 8 GiB…" like the Doctor. **Kept** (ResizeOr is unchanged; its label keeps today's words until WO-3.9).
   6. `Start cache` button says what it starts; clicking starts exactly cache by ID; the line goes; "cache started" is said (not "shop started"); focus is on shop's name when the line goes. **Kept**; "focus on shop's name" becomes focus on the group row.
   7. Two stopped: one shared line "cache and db are stopped", button `Start them`, label `Start them: cache and db`; done says "cache and db started". **Kept**.
   8. The project menu's "Start the N stopped (...)" says the same names when done. **Kept**.
   9. All stopped: no extra line. **Kept**.
   10. Every state's picture differs (md5 of the shop block per state). **Kept**.
   11. No page errors. **Kept**.

   **Behaviours of `check-menus.mjs`** (Chromium and WebKit; the old script runs the engine named by `PW_ENGINE`):
   1. Each New item opens its own drawer, by title ("Choose an image to run", "Pull image", "Compose projects"). **Kept** (legacy drawers until WO-3.3, which changes the titles in this file).
   2. On Containers and Doctor, every `[aria-haspopup=menu]` opens and a mouse click on its first enabled item reaches the item (counted with a capture listener). **Kept**, with `main [aria-haspopup=menu], .sidebar [aria-haspopup=menu], .header [aria-haspopup=menu]` as the opener selector.

   **Behaviours of `check-select.mjs`** (scenarios `k8spods`, `running`):
   1. Kubernetes row (scenario `k8spods`): one row; last; 4 rows; pod containers not listed (not even by pod name); counts its containers ("2 containers"); not expandable (`aria-expanded` absent); no checkbox; no Stop, Start, Restart, Remove, no menu and no button; no problem lines and no note; a click on the row goes to the Kubernetes tab (`#/kubernetes/pods`); no page errors. **Adapted** (decision D10: the row has no `Open` button; spec 7.1 rule 8). The "no checkbox" line stays true for this row only.
   2. Running (`design`): no select-all and no selection bar at rest. **Adapted** to the new rule (see item 24 above).
   3. An opened project has no checkboxes at rest. **Adapted** the same way.
   4. `New` sits on the title row. **Adapted**: the New button's vertical middle is within 4 px of the `h1`'s middle (both are in `.header`).
   5. No sideways scroll at 980 px. **Adapted** to 900.
   6. Menus: running loose container with a problem offers Logs, Open a shell, Restart, Not an issue, Remove…. **Adapted**: `Logs, Open a shell, Restart, Not an issue, Copy name, Run it yourself, Remove…` (item texts without the hint line).
   7. A running service offers Logs, Open a shell, Restart, Copy name, Run it yourself, Remove… (no Stop: the row has the button). **Adapted**.
   8. A stopped service offers Logs, Copy name, Run it yourself, Remove… and no shell or Restart. **Adapted**.
   9. A service with a problem offers Not an issue; one without does not. **Kept**.
   10. A project offers `Start the 2 stopped (cache, report-job)` first, then Rebuild and start, Update images and start, Restart, Show logs, Show in Finder, Run it yourself, Remove containers…. **Adapted** to spec 7.1 rule 10.
   11. A menu opens from the keyboard (Enter on ⋯) and focus moves to the first item; Escape closes it and focus returns to ⋯. **Kept**.
   12. Not an issue takes the problem line away. **Kept**.
   13. Remove asks first, names the container, says it is running, says image and volumes stay ("Remove web?", "running and will be stopped first", "stay" → new words "kept"); nothing is removed while the question is open; Cancel keeps it; confirming removes exactly that ID. **Kept** with the new words ("Remove web?", "It is running and will be stopped first.", "Its image and volumes are kept").
   14. A loose container: same question, same single removal; the neighbour stays. **Kept**.
   15. A busy row locks its own buttons and menu (aria-disabled): "Stopping…"; the project's Restart and Remove containers… are aria-disabled; rows do not reorder after the stop. **Kept**.
   16. No page errors. **Kept**.

   **New lines in `check-containers.mjs`** (the states, scenario in brackets):
   1. [`loading`] four skeleton rows (`.skeleton`) show and the header title "Containers" is visible; no "No containers yet".
   2. [`design&empty=1`] "No containers yet" with the buttons `Run an image` and `Start a Compose project`; search field is there.
   3. [`design`, type "zzzz"] `Nothing matches "zzzz".` and `Clear search`; pressing it brings the list back.
   4. [`stopped`] "default is stopped", "Your containers and data are kept. Start the machine to see them.", one primary `Start default`; no `New` button; clicking it ends with the list.
   5. [`unreachable`] after the first list, the next poll shows the banner "Couldn't list containers" with `Try again` and `Restart default`, and the old rows are still there.
   6. [`design`] Stop on kafka shows "Stopping…" on its button, the button is `aria-disabled`, its dot has class `busy`; the order of the rows does not change.
   7. [`design&failstart=report-job`] Start on report-job: a `.subrow` under it with the words from today's port or start failure and a `Try again` button; the raw words "driver failed" are not visible text.
   8. A selection: hover shows the `input.check`; checking two rows shows "2 selected" and Remove… asks "Remove 2 containers?"; Escape clears the selection, a second Escape clears the search text.
   9. Keyboard: ArrowDown moves between rows (a problem line that opens the inspector is a stop too), Enter opens the detail (hash changes after WO-3.2; until then `setDetailId`), Space checks, ArrowLeft folds shop, ArrowRight opens it, Shift+F10 opens ⋯ (`[role=menu]` is visible, the first item has focus).
   10. Cmd+N and Cmd+P: until WO-3.3 they go to Images as today; the check proves only that Cmd+F and "/" focus the search field (`document.activeElement` has `data-page-search`) and that typing "/" in the field types a slash.
   11. At 900x600: the row buttons beside the state, not over it: for the first row, `.col.state` right edge is less than or equal to the `.act` left edge plus 1, and `.act` right edge is less than or equal to the ⋯ left edge plus 1 (the old `check-layout` line "row buttons: beside the state, not over it").
   12. At 900x600 the ports stay visible and `.content` does not scroll sideways (the old 600 px line).
   13. Every row's action and ⋯ have accessible names (the old `check-restyle` line): all `.act .btn` and `[aria-label^="More actions for"]` have a non-empty name.
   14. There is no `<table>` element and no `.icon-btn` in the list (old line, now: no `table` tag).
   15. The Inspector: "See why" on api opens the sheet (`[role=dialog]` named "Why") with the crumb "shop / api"; Escape closes it and focus returns to the "See why" button.
   16. Cmd+R inside Containers: after removing a row in the mock state and pressing Cmd+R, the list updates within 1 s.
6. `scripts/mockup-pairs.json`: add rows (all `"threshold": 0.005` unless the `why` says otherwise):
   1. `{ "mockup": "containers", "path": "/?scenario=design#/containers", "themes": ["light","dark"], "threshold": 0.01, "mask": [".header .meters", ".header .sub", ".sidebar .count", ".sidebar .engine", ".spark", ".col.stats"], "why": "Live numbers (meters, stats, sparklines, counts) differ from the picture by design; threshold is 0.01 because the text of problem lines can wrap by a few pixels in WebKit." }`. Run `PW_ENGINE=webkit node scripts/check-mockup.mjs` (with `npm run preview` running). If the difference is above 0.01, open `test-results/mockup/containers-light-diff.png`, say in the pull request what the red areas are, and stop; do not raise the number without the author. The check goes to the path and takes a picture; it cannot click, so a fold or an open menu is never in a row.
   2. `empty-state`: `{ "mockup": "empty-state", "path": "/?scenario=design&empty=1#/containers", "themes": ["light","dark"], "mask": [".header .meters", ".sidebar .count", ".sidebar .engine"] }`.
   3. `machine-stopped`: `{ "mockup": "machine-stopped", "path": "/?scenario=stopped#/containers", "themes": ["light","dark"], "mask": [".sidebar .count"] }` (the engine button shows Stopped here: the picture has `engineDot: ""` and "Stopped"; do not mask the engine area).
   4. `loading-error-toast`: no row (it mixes three states in one picture: banner, skeleton, toast). By eye only; written in the acceptance file.
   5. `containers-row-menu`, `containers-new-menu`, `problem-inspector`, `confirm-dialog`: no row, because each needs a click first and the check cannot click. By eye, with the list in "Done when" 7 and in `iteration-2-acceptance.md`.
   Replace the row WO-2.2 put in for `containers` by row 1 (same `mockup`, new mask and threshold).
7. `scripts/not-migrated.json`: this work order removes no file (`src/VmStrip.tsx` stays on the list until WO-3.9).

**Tests to write first:** `src/Containers.test.tsx` (migrated; written before the code of steps 2 to 4). Names in Given/When/Then; each is either a kept test (renamed with the new words) or new. New ones:
1. `Given the first load has not answered, When Containers renders, Then four skeleton rows show and the header title is there`.
2. `Given docker answers an empty list, When rendered, Then "No containers yet" and the two buttons show`.
3. `Given a search with no match, When typed, Then 'Nothing matches "zzzz".' and "Clear search" show, and Clear search restores the list`.
4. `Given the engine is stopped, When rendered, Then "{name} is stopped" and the button "Start {name}" show and "New" does not`.
5. `Given the list failed after a good read, When the next read throws, Then the banner "Couldn't list containers" shows and the old rows stay`.
6. `Given Stop is pressed on a running container, When it is pending, Then the button says "Stopping…", is aria-disabled and the dot is busy`.
7. `Given docker start fails with a port clash, When Start is pressed, Then a line with a plain reason and "Try again" shows and the raw text is not visible`.
8. `Given two rows are checked, When Remove… is pressed, Then the confirm title is "Remove 2 containers?"`.
9. `Given Escape twice, When a selection and a search exist, Then the selection clears first and the search second`.
10. `Given a project with a problem and no saved choice, When rendered, Then it is open; Given it was folded by the user, When rendered again, Then it stays folded`.
11. `Given kafka, kafka-ui, a project and a stopped container, When rendered, Then the top-level order is problems first (alphabetical), running, then stopped`.

**Done when:**
1. `npm test` passes with no failures (the named failures of WO-3.1b are gone). `npx vitest run src/Containers.test.tsx` passes; the pull request file has the table of old tests (count of rows equals the count noted in WO-3.1b "Starting state" 6, plus new ones).
2. `node scripts/check-containers.mjs` and `PW_ENGINE=webkit node scripts/check-containers.mjs` print no `FAIL`; the same for `check-menus.mjs`.
3. `ls scripts/checks-pending` no longer lists `check-home.mjs`, `check-down.mjs`, `check-menus.mjs`, `check-select.mjs`; `ls scripts/check-home.mjs scripts/check-select.mjs scripts/check-down.mjs 2>&1` says they do not exist.
4. `PW_ENGINE=webkit node scripts/check-mockup.mjs` (with `npm run preview` running) prints an `ok mockup:` line for each of `containers`, `empty-state` and `machine-stopped`, in both themes, and exits 0.
5. `grep -c "check(" scripts/check-containers.mjs` is at least 100 (about 140 old lines in `check-home`, `check-select` and `check-down`, some merged, plus the new ones); print the number. A number far below means lines were dropped: stop and report.
6. `node scripts/check-not-migrated.mjs` passes; `git diff main -- scripts/not-migrated.json` shows only removed lines.
7. By eye, open each picture and the page side by side in both themes. Pictures the mockup check cannot compare because they need a click: `containers-row-menu` (⋯ on kafka), `containers-new-menu` (New), `problem-inspector` (See why on api), `confirm-dialog` (Remove… on web). Open each the same way and compare. Then the three states: `empty-state` (icon, title "No containers yet", one line, primary `Run an image`, then `Start a Compose project`), `machine-stopped` (title "default is stopped", primary `Start default`, the engine button shows "Stopped" with a grey dot), `loading-error-toast` (red banner "Couldn't list containers" with `Try again` and primary `Restart default`; skeleton rows below).
8. The gate in `../HANDOFF.md` section 5.

**Pull request text:** the file `docs/plan/iterations/pr/wo-<id>.md`. Its first line is this title: `wo-3.1c: Containers handles every state, and its old checks are back`

---

## WO-3.2 Container detail: a page with an address

**Needs:** WO-3.1c.

**Why:** U8, U12, U13, E10. The detail page is part of the route (`#/containers/{id}/{tab}`), so reload and back work. Brings back `check-observe.mjs` and `check-mounts.mjs`.

**Read first:**
1. `docs/plan/04-design-spec.md` sections 5.4 rule 4, 6.3, 6.11, 7.2.
2. Mockup pictures `container-detail-light.png` and `-dark.png`; in `mockup.html` find `const detail`.
3. `src/ContainerDetail.tsx`, `src/Logs.tsx`, `src/StatsTab.tsx` (all three, in full), `src/Health.tsx` (find `HealthPanel`, `ActivityList`), `src/FixIt.tsx` (`FixStatus`, `useFixRuns`), `src/ConnectionTest.tsx`.
4. `scripts/checks-pending/check-observe.mjs` and `check-mounts.mjs` (all; their behaviours are listed below).
5. `src/lib/events.ts`, `src/lib/health.ts`.

**Starting state:**
1. `git status --short` prints nothing; `ls src/containers` lists the files of WO-3.1b.
2. `grep -n "setDetailId\|detailId" src/App.tsx src/Containers.tsx | head` prints the lines to change.
3. `grep -n "const TABS" src/ContainerDetail.tsx` prints `["Logs", "Inspect", "Stats", "Mounts", "Network", "Activity"]`.
4. `ls scripts/checks-pending` lists `check-observe.mjs check-mounts.mjs`. `grep -c "aside" src/ui/op/Tabs.tsx` prints at least `1`, and `grep -c "forwardRef\|onScroll\|fill" src/ui/op/Canvas.tsx` prints at least `3` (iteration 1 has `Tabs` `aside` and `Canvas` with ref, `onScroll` and `fill`). If either differs, stop and report.
5. In the preview, `http://localhost:4173/?scenario=design#/containers` then click `api`: the detail shows today (the old page, no route yet).

**Do not touch:** `src/Health.tsx`, `src/FixIt.tsx`, `src/Resize.tsx`, `src/ConnectionTest.tsx` internals (they render inside the new page, migrated in WO-3.8 and WO-3.9), the Containers list.

**Steps:**

1. Routing. In `src/App.tsx` replace the `detailId` state (find `const [detailId, setDetailId]`) by values from the route:

```ts
  const detailId = route.page === "containers" ? route.id ?? null : null;
  const setDetailId = useCallback((id: string | null) => go(id ? buildPath({ page: "containers", id, tab: "logs" }) : "#/containers"), []);
```

   Import `buildPath` from `./lib/router`. Where `App.tsx` renders `Containers` with `detailId`, it now renders the list when `detailId` is null and `<ContainerPage ctx={ctx} id={detailId} tab={route.tab ?? "logs"} .../>` when not. `Containers` stops rendering `ContainerDetail`; remove that branch and the `detailId` and `setDetailId` props only if tsc and the tests agree (keep `setDetailId` for row clicks). `onNav` in the Shell call no longer needs `setDetailId(null)` (changing page changes the route).
2. Rename and rebuild: `git mv src/ContainerDetail.tsx src/containers/ContainerPage.tsx` is **not** done; keep the file name `src/ContainerDetail.tsx` and its default export so that history stays readable, and change its props to:

```ts
type Props = { ctx: string; id: string; tab: string; appProblems?: Problem[]; onReplaced?: (name: string) => void; listed?: string[]; live?: Live; history?: number[] };
```

   `onBack` goes (the header's back button calls `window.history.length > 1 ? history.back() : go("#/containers")`). The tab state `useState<Tab>` goes; the tab comes from the route and `onTab` calls `go(buildPath({ page: "containers", id, tab }))`.
3. New tab ids and words (spec 7.2 rule 4, section 9): `logs` Logs, `stats` Stats, `settings` Settings (was Inspect), `folders` Folders (was Mounts), `network` Network, `history` History (was Activity). Replace `const TABS` and the type. The tabs are `<Tabs value={tab} onChange={onTab} aria-label="Container" items={[{ value: "logs", label: "Logs" }, ...]}>` with one `<TabPanel value="logs">` and so on as children.
4. Header, in `src/ContainerDetail.tsx`: `<Header title={name} back={{ label: "Back to Containers", onBack }} stateDot={dot} stateText={stateText} meters={false}>` with the right slot:
   1. `<Button>Open a shell</Button>` (only when running; calls `openShell` as today).
   2. `<Button>Restart</Button>` (only when running; as today).
   3. `<Button>Stop</Button>` when running or `Start` when not (as today). While a fix runs or the machine changes (`locked`) these three are `aria-disabled` (as today).
   4. ⋯ `<Menu trigger={<MoreButton name={name} />} label="Actions for {name}" align="end" wide>` with `<MenuItem label="Pause" why="Freezes it without stopping it" />` (or `Unpause`), `<MenuSeparator />`, `Copy name`, `Run it yourself`, `<MenuSeparator />`, `Remove…` (`danger`). `Remove…` asks like the list (WO-3.1b step 14) and, when confirmed, goes to `#/containers`.
   `stateText`: the same word as the list (spec 6.4) joined like the mockup: a running container with a red dot reads `Running · Unhealthy`; an out-of-memory one `Out of memory`; others the plain word. While a fix runs: `A fix is running`. Use `stateView` from `src/lib/containerRows.ts`: when its dot is `bad` or `warn` and the word is `Running`, append ` · {SHORT[id]}` from the existing `SHORT` map (the file already has it) when a finding exists; when `stateView.word === "Unhealthy"` the text is `Running · Unhealthy`.
5. Facts line: `<Facts items={[...]} />` (it draws `div.facts` with one span per item, as the mockup). Items, in this order: `{ label: "Image", value: image }`, `{ label: "Project", value: project }` (only when there is one), `{ label: "Started", value: "Started {relative time} ago" }` (the old relative-time function in this file; "Started … ago" or "just now"; never "Up since"), `{ label: "Restarts", value: "{n} restarts" }` (`0 restarts` too), and `{ label: "Ports", value: ... }` with each published port as `.port` like the list (web port opens, others copy).
6. Banner: from `problemsFor(...)` plus `appProblems`: take the worst (a `bad` before a `warn`; the first in the list on a tie). `<Banner tone={level} title={p.short ?? p.title} actions={...}>` with body `p.detail` without backticks. `actions`: the finding's fix button (same function the list uses; `<Button variant="primary" size="md">`), else `<Button variant="primary" size="md">See why</Button>` that opens the Inspector (reuse `ProblemInspector` and `inspectorContent`). More than one finding: after them `<Button variant="ghost" size="xs">and {n} more</Button>` that goes to `#/doctor`. Spec 7.2 rule 3 says "Doctor filtered by this container"; the Doctor has no filter until WO-3.8 builds it, so until then the link opens plain Doctor. Name this dependency in the pull request file.
7. Tabs row: on the Logs tab only, `aside` of the `Tabs` holds the filter `<Field icon="search" width="filter" aria-label="Filter lines" placeholder="Filter lines" value onChange />`, `<ChipButton pressed={follow} onClick=...>Follow</ChipButton>` (it renders `aria-pressed`), and `<Button variant="ghost" iconOnly icon="copy" aria-label="Copy logs" />`.
8. Logs tab (`src/Logs.tsx`, rewrite the markup, keep the data code: `usePoll` every 2 s and `mergeLogs`). Props add `filter: string`, `follow: boolean`, `onFollowChange(v: boolean)`, `registerCopy(fn: () => void)`. Render `<Canvas ref={paneRef} aria-label={`Logs of ${name}`} lines={shown} onScroll={...} />`. The page body is `<div className="content stack">` holding the facts line, the banner, the tabs, and the canvas with `fill` (it takes the rest of the height and scrolls inside itself). Write no `style`.
   Lines: `{ time, text, level }` for the `lines` prop (`Canvas` draws `span.t` and the text, and the class `w` or `e` from `level`); a line the app classes as warning is `"w"`, as error `"e"` (the old classifier `level` in `logClean` or `LogLine`). Cap: keep the last 10,000 lines (`slice(-10000)`; WO-8.4 keeps this number). Filter: keep lines that contain the text, case-insensitive. Follow: when on, scroll to the end after each update; scrolling up by more than 4 px turns it off and un-presses the chip; pressing the chip turns it on and scrolls to the end. Copy: writes the visible lines (with time) to the clipboard and calls `toast({ text: "Copied logs" })`.
9. Stats tab (`src/StatsTab.tsx`): keep the data code; render `<Tiles>` with one `<Tile label value>{small text}</Tile>` per number the page shows today, and one `<Sparkline points={history} label="CPU, 10 min" />` inside the CPU tile's children. There is no Stats picture: use the same numbers and words `StatsTab` shows today, in `Tile`s, and write them in the pull request file. When the container is stopped: `<Empty icon="box" title="Not running">Start it to see its numbers.</Empty>`
10. Settings tab (was Inspect): the old Inspect content (environment, command, restart policy, the rest the tab shows today) as a `<List aria-label="Settings">` of `<Row lead={<span />} name={label} meta={value} />` (a `Row` with no `onOpen`). Pass `metaSelectable` so a value can be copied from the row. Raw text (the command, the full environment) goes in a `<Canvas aria-label="Command" >` (it is selectable). At the top of this tab: `HealthPanel` from `src/Health.tsx` unchanged (the explanation of an unhealthy, out-of-memory or no-health-check container: "More memory than it was allowed", "No health check"). The spec has no separate place for the health details; this keeps them provable.
11. Folders tab (was Mounts): the old list of mounts as `<Row lead={<Icon name="folder" size="sm" />} name={Mac path with ~} meta={path in the container}>` with one child `<Col><Chip>Read only</Chip></Col>` (or `Can change files`); the unshared-folder fix (the "Share folder…" line and its result) stays as the old components render it (`VmChangeOr`, `ResizeStatus`), placed above the list.
12. Network tab: the old list of networks and addresses as `Row`s (`lead` an `<Icon name="network" size="sm" />`), the published ports as `.port` links, and the existing `ConnectionTest` button and result (`<Button>Test a connection</Button>`).
13. History tab (was Activity): `ActivityList` from `src/Health.tsx` unchanged; only this container's events (the old rule).
14. The fix status (`FixStatus`, `useFixRuns`) and the "fix-commands" details render between the banner and the tabs, unchanged. While a fix runs the header's `Stop`, `Restart`, `Remove…` are `aria-disabled` and the state text says `A fix is running`.
15. Open a shell on a container with no shell: unchanged: today's code opens a toolbox shell next to it and the Activity entry says why. The words stay.
16. `scripts/not-migrated.json`: remove `src/ContainerDetail.tsx`, `src/Logs.tsx`, `src/StatsTab.tsx`. `Health.tsx`, `FixIt.tsx`, `ConnectionTest.tsx`, `Resize.tsx` stay.
17. Bring back `check-observe.mjs` and `check-mounts.mjs` (see the lists below). `git mv` both to `scripts/`, rewrite on `scripts/lib/check.mjs`, delete their rows in `scripts/checks-pending/README.md` (`check-all.sh` picks them up by itself). The scenarios they used (`running`, `doctor`, `unshared=1`, and others: print them from the old files) still exist in `preview/mock.ts`; the new address form is `/?scenario=<name>#/containers`. Print each old address in the pull request file next to its new one.
18. `check-layout.mjs`: add the lines moved from WO-2.2 item 6: on a container's Logs tab at 1180x760 and 900x600: the log pane scrolls inside itself (`scrollHeight > clientHeight` after the log has more than 500 characters); scrolling it does not move the page (`window.scrollY` is 0 and `.content` `scrollTop` is 0); the window does not scroll.
19. Mockup row: `{ "mockup": "container-detail", "path": "/?scenario=design#/containers/api/logs", "themes": ["light","dark"], "threshold": 0.01, "mask": [".canvas", ".facts", ".sidebar .count", ".sidebar .engine"], "why": "Log lines carry the time of the run and the facts line carries relative times." }`. The route takes the name `api` as the id: the mock's `inspect` finds a container by name first and by id prefix second (`const find` in `preview/mock.ts`), and `useRoute` does not care what the id is. Run `PW_ENGINE=webkit node scripts/check-mockup.mjs`; the check cannot click, so the Logs tab is the only tab compared. The other tabs, the ⋯ menu and the Inspector are by eye.

**Behaviours of `check-observe.mjs`** (each line: where it goes):
1. Home: an unhealthy container shows a plain reason under its project row with its name ("api · health check is failing"). **Kept** (folded project; same text).
2. Out-of-memory stop is called out ("ran out of memory"). **Kept**.
3. Keeps restarting is called out ("worker · keeps restarting"). **Kept**.
4. Healthy containers carry no problem line; 3 problem lines and 1 plain "off" line under shop. **Adapted** to `.subrow` (the plain line has no severity icon colour).
5. The row's mark follows the worst problem: kafka-ui and shop red, kafka amber. **Adapted**: the dot class (`bad` or `warn`).
6. The mark follows health per service: api red, worker amber, web green. **Adapted**.
7. Opened, each problem sits under its own service ("Health check is failing" under api, none under web). **Kept**.
8. One primary button outside the problem lines. **Kept** (`New`).
9. Container page: shows what the failing health check said (unhealthy, "Connection refused", "5 checks in a row"). **Kept** (banner body and HealthPanel).
10. Shows restarts. **Kept** (`{n} restarts` in the facts line).
11. The failed-checks line shows once. **Kept**.
12. Only the open tab is underlined, even with another hovered. **Adapted**: only one tab has `aria-selected="true"` after hovering another.
13. A red dot reads "Running · Unhealthy", not a bare "Running". **Kept** (header `stateText`).
14. The state has the same dot as the list. **Kept** (one `.dot` in the header).
15. Start time is relative ("Started … ago" or "just now"), never "Up since". **Kept**.
16. No "Open the logs" button while the Logs tab is open. **Kept**.
17. Open a shell asks for a Terminal shell in that container (`window.__terminal` has `kind: "shell"` and a target starting with a letter). **Kept**.
18. Log lines carry a time (`\d\d:\d\d:\d\d  `). **Kept** (two spaces after the time).
19. Following is a real toggle (`aria-pressed="true"`). **Adapted**: the chip named `Follow`.
20. Volumes: a size is shown. **Moved to WO-3.5** (Volumes page). Until then it stays against the legacy page unchanged; the line is kept in this file with the old selectors and a comment `// WO-3.5 moves this line`.
21. Containers: no health badge on the list for web, just a plain row. **Kept**.
22. The container page says web is healthy. **Kept** (HealthPanel in the Settings tab; the check opens `#/containers/web/settings`).
23. Out-of-memory is explained, and a missing health check is said plainly ("more memory than it was allowed", "No health check"). **Kept** (Settings tab).
24. The History tab shows only this container's events ("report-job ran out of memory", not "api became..."). **Kept** (tab `history`).
25. Row Shell: opens a shell in that container (`kind":"shell"`, `target":"web"`). **Kept** (the list menu's `Open a shell`).
26. Row Shell: not offered on a stopped container. **Kept**.
27. Row Logs: opens that container on its Logs tab. **Kept**: the hash becomes `#/containers/<id>/logs` and the Logs tab is selected.
28. Apps: Kafka UI pointed at localhost is called out on its row ("Can't reach Kafka"), the line title holds the full reason (contains "inside its own container" or "localhost is the container itself"). **Kept**.
29. A broker that only advertises localhost is called out ("Only reachable from your Mac"). **Kept**.
30. The detail page gives a safe replace command that uses the broker's name (`KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS='kafka:19092'`, `rename kafka-ui kafka-ui-old`, no `rm -f`). **Kept** (the commands in `details.fix-commands`).
31. The commands can be copied (a "Copy commands" button). **Kept**.
32. The status line names the problem ("Can't reach Kafka" in the header). **Adapted**: the banner title.
33. No page errors. **Kept** (twice).
34. Fix: Kafka UI's page has one "Fix kafka and kafka-ui" button; the commands are still there, folded; it asks first, names both, warns about topics ("Replace kafka and kafka-ui? kafka will start with no topics."); the page says both were replaced; two new containers run with the fixed settings and no `-old` is left; the page no longer reports the problem. **Kept** (legacy FixStatus).
35. Fix fails: Stop and Remove are locked while it runs ("A fix is running"); the page says what happened ("kafka was replaced, but kafka-ui couldn't be fixed", "simulated", "The old kafka-ui is back as it was"); the old kafka-ui runs again under its own name. **Kept**.

**Behaviours of `check-mounts.mjs`** (scenarios as the old script; "list" lines use the Containers list, "Doctor" lines use the legacy Doctor page whose selectors are unchanged until WO-3.8):
1. Unshared folder: one line under the shop project; it reads "web · sees an empty ~/code/web (not shared with Colima) Share folder…" with one button; the path is in the code font; the button's name starts with its visible words and has no backticks; it shows without hovering. **Kept** (a `.subrow`; `<code>` inside `.what`).
2. The confirm names the folder, the restart and what stays ("Share ~/code/web with the VM?", "VM restarts", "Your N running containers stop and start again", "Images, volumes and containers stay"); its button says "Share and restart", Cancel changes nothing. **Kept** (alertdialog).
3. While it runs the line says "Restarting…". **Kept**.
4. The backend gets the saved folders plus the new one (`apply_mounts`, name default, mounts list). **Kept**.
5. The result says what changed and that containers run again ("~/code/web is shared with the VM now. Everything that was running is running again."). **Kept**.
6. No row says "Restarting…" or spins next to the done result; the folder line is gone when the result shows; the path in the result is in the code font; Dismiss clears the result. **Kept**.
7. Doctor: names the folder and what Colima does share; paths in the code font; one `Share folder…` button; its name has no backticks; "Or run it yourself" is one line of code with the exact command; no dark block; the line sits on the row's background; the finding is gone when the success row shows; the success row is its own row, outside "Needs action", with a check and Dismiss on the right; the gap under it matches the gap between groups; Dismiss clears it. **Kept** against the legacy Doctor (WO-3.8 updates the selectors).
8. Refused: "Nothing changed: /Volumes/missing is not a folder on this Mac, so it can't be shared."; the machine is still Running. **Kept**.
9. Failed: the result is about the folder, says the machine is stopped and the folder stayed saved; never says "new size"; buttons are named with their row (`Try again: `, `Start with the folders you had: `, `Show the log: `, `Dismiss`); no size buttons; the stopped card and its Start button are hidden while the failure shows; the one filled button is "Start with the folders you had"; text full width on top, buttons in one row at the right; buttons read Dismiss, Show the log, Try again, then the filled one; Show the log is a push button; the filled button is on the right edge; Try again is plain; no log path in the text; Show the log reveals the log (`__revealedLog` is "default"). **Kept** (legacy `ResizeStatus`).
10. The old folders start the stopped machine (`apply_mounts`, `force: true`, the old list); the result says "The VM started with the folders it had."; the good result sits in the same card, once. **Kept**.
11. Way back: the stopped state offers a plain start and the way back as two buttons; says what the plain start will do ("The last change didn't start. ~/code/web is still saved in the profile, so Start VM tries it again."); the filled way back is on the right of the quiet start; Dismiss moves focus to the filled way back; a plain start runs a plain start; a start that works clears `colima-ui.wayBack` (key renamed to `openpier:way-back` by iteration 1: use the key the code uses; print it with `grep -rn "wayBack" src/lib`); the button runs the old folders. **Adapted**: the stopped state is the `Empty` of WO-3.1c; its buttons keep these words: `Start default` replaces "Start VM" (list the replaced words in the pull request file).
12. Keyboard: Tab reaches "Share and restart"; focus lands on the failed result; the page's own announcer stays quiet since focus said it; Tab goes to Dismiss then to the filled button; after the way back focus is on the good result in the same card; not said twice. **Kept**.
13. Away: the alert says it in plain words (no backticks). **Kept**.
14. Read-only: "Can't write to ~/code/docs (shared read-only) Make it writable…" with one button; path in code font; confirm "Let containers change files in ~/code?" with "Make writable and restart"; result "~/code is writable in the VM now."; the same folder, now writable. **Kept**.
15. sshfs: worth knowing (Doctor says the type can't change on a VM that exists), not counted as needing action, no button on the row, no mention when no container uses a Mac folder. **Kept** (legacy Doctor).
16. Unreadable colima.yaml: the Doctor says it can't read the shared folders; paths in code font; no change to press; nothing claimed about the unshared folder. **Kept**.
17. Default: no folder problem; "Every Mac folder a container uses is shared with the VM" is among the passed ones. **Kept**.
18. Every picture differs (md5 of states). **Kept**.

**Tests to write first:**

`src/ContainerDetail.test.tsx` (vitest; add to the existing file if there is one, `grep -l ContainerDetail src/*.test.tsx`):
1. `Given the route tab "settings", When the page renders, Then the Settings tab is selected and the environment shows`.
2. `Given a tab is pressed, When pressed, Then the hash becomes "#/containers/{id}/{tab}"`.
3. `Given a running unhealthy container, When rendered, Then the header says "Running · Unhealthy" and has one dot`.
4. `Given two findings, When rendered, Then one banner shows the worst and a button "and 1 more"`.
5. `Given a stopped container, When rendered, Then the header has "Start" and no "Open a shell" and no "Restart"`.
6. `Given Remove… is confirmed, When done, Then the hash is "#/containers"`.
7. `Given a fix is running, When rendered, Then the header says "A fix is running" and Stop, Restart and Remove… are aria-disabled`.
8. `Given the back button, When pressed with no history, Then the hash is "#/containers"`.

`src/Logs.test.tsx` (vitest):
1. `Given 12,000 lines arrive, When rendered, Then 10,000 are kept and the oldest are gone`.
2. `Given the filter "ready", When typed, Then only lines with "ready" show`.
3. `Given Follow is on, When the user scrolls up, Then the chip is no longer pressed`.
4. `Given Follow is off, When the chip is pressed, Then it is pressed and the pane is at the end`.
5. `Given lines, When Copy logs is pressed, Then the clipboard holds the visible lines and a toast says "Copied logs"`.
6. `Given a line with an error, When rendered, Then it has the class "e"`.

**Done when:**
1. `npx vitest run src/ContainerDetail.test.tsx src/Logs.test.tsx` passes; `npm test` passes.
2. `node scripts/check-observe.mjs`, `check-mounts.mjs`, `check-layout.mjs` and the WebKit runs print no `FAIL`. `grep -c "check(" scripts/check-observe.mjs` is at least 40 and `scripts/check-mounts.mjs` at least 70 (print both). A lower number means lines were dropped: stop.
3. `ls scripts/checks-pending` no longer lists `check-observe.mjs` or `check-mounts.mjs`.
4. Reload on `http://localhost:4173/?scenario=design#/containers/api/stats`: the Stats tab shows. Back goes to the list.
5. `node scripts/check-mockup.mjs` passes for `container-detail`.
6. By eye against `container-detail-light.png` and `-dark.png`: back button, name "api", red dot, "Running · Unhealthy", three buttons (`Open a shell`, `Restart`, `Stop`) and ⋯; no meters; facts line with image, project, "Started 3 h ago", "0 restarts", `:8080`; a red banner "Its health check is failing" with a primary `See why`; six tabs in the order Logs, Stats, Settings, Folders, Network, History; filter field, pressed `Follow`, copy icon at the right of the tabs row; the log canvas fills the rest, times in muted text, an error line in red.
7. `node scripts/check-not-migrated.mjs` passes.
8. The gate in `../HANDOFF.md` section 5.

**Pull request text:** the file `docs/plan/iterations/pr/wo-<id>.md`. Its first line is this title: `wo-3.2: A container's page has its own address, and its old checks are back`

---

## WO-3.3a Run an image: the picker and the Run sheet

**Needs:** WO-3.2. WO-3.3 is split into 3.3a (Run), 3.3b (Pull), 3.3c (Compose start and logs) so each fits one pull request.

**Why:** U9, U15, P3. The guided Run is the product's best idea; it moves from a drawer to the sheet of the mockup, with every guided check kept. Brings back `check-guided.mjs`.

**Read first:**
1. `docs/plan/04-design-spec.md` sections 6.7, 7.10 (items 1 to 4), 9.
2. Mockup pictures `run-sheet-light.png` and `-dark.png`; in `mockup.html` find `const runSheet`.
3. `src/RunPanel.tsx`, `src/RunPicker.tsx`, `src/lib/guided.ts`, `src/runArgs.ts` (all four, in full), `src/Images.tsx` (find where it renders `RunPanel` and `PullPanel`).
4. `scripts/checks-pending/check-guided.mjs`.

**Starting state:**
1. `git status --short` prints nothing.
2. `grep -n "import RunPanel\|import PullPanel\|<RunPanel\|<RunPicker" src/*.tsx` prints the uses in `Images.tsx` and `Containers.tsx`. Their props must keep working: `RunPanel` takes `{ ctx, image, arch?, onClose, onRan }`, `RunPicker` takes `{ ctx, onPick, onClose }`.
3. `grep -n "export function" src/lib/guided.ts src/runArgs.ts | wc -l` prints a number; write it down. No function of these two files changes.
4. `ls scripts/checks-pending/check-guided.mjs` lists it.
5. `grep -c "title?" src/ui/op/Banner.tsx` prints at least `1`, and `grep -c "Fields\|Checkbox\|Progress" src/ui/op/index.ts` prints at least `3` (iteration 1 has the title-less banner, `Fields`, `Checkbox` and `Progress`). If not, stop and report.

**Do not touch:** `src/lib/guided.ts`, `src/runArgs.ts` and their tests, `src/Images.tsx` (it keeps calling the same components with the same props).

**Steps:**

1. Keep the default export names and the props of `RunPanel` and `RunPicker`. Change only what they render. Their `Drawer` becomes `<Sheet open onClose={guardedClose} title=... fact=... busy={running} stack footer=...>` (`stack` makes the body a column with gaps).
2. `RunPicker` (title `Choose an image to run`, the old words): `<Field aria-label="Image to run" placeholder="nginx or postgres:16" value onChange />`, under it the images you have as `<List aria-label="Images you have">` of `<Row lead={<Icon name="image" size="sm" />} name={ref} meta={size} onOpen={() => fill(ref)} />`, a primary `<Button variant="primary" size="md">Continue</Button>` in the `footer` (disabled until the field has text) and `<Button variant="ghost" size="md">Cancel</Button>`. Choosing a row fills the field. Read today's `RunPicker.tsx` first: keep its list and its call `onPick(ref)`; only the container and controls change.
3. `RunPanel` becomes the Run sheet. Title `Run {image}`. Body, in this order (words from the mockup `runSheet`; each row is `<FormRow label="..." htmlFor="...">` with `<Field id="..." size="md" />` inside):
   Fields that sit side by side in one row go in `<Fields>`, with the connecting words as `<span className="muted nowrap">`.
   1. `Name`: a `Field` with the suggested name (the image's short name).
   2. `Ports`: `<Fields><Field width="port" .../><span className="muted nowrap">on this Mac, to</span><Field width="port" .../><span className="muted nowrap">in the container</span></Fields>` (Mac port field, then container port field). Pre-filled from what the image declares (the old `declared ports` code) with the first free host port (`nextFreePort`). The port check runs as you type (the old `portWarnings`). A taken port: the Mac `Field` has `invalid="Port {p} is taken"` (it sets `aria-invalid`) and, under the row, `<Banner tone="warn" actions={<Button size="xs">{`Use ${next} instead`}</Button>}>` with the body `Port {p} on this Mac is already used by <span className="mono">{name}</span>.` (no title, so it is the one-line banner) and the button fills the field and removes the banner.
   3. `Settings the image needs`: a `<Fields>` pair of fields (variable name, value) for each environment variable the image needs (the old `presetEnv`); a password variable's value field is `type="password"`; `placeholder="Required"` when required; under it `<div className="hint">` from `hintFor` (for example "postgres stops at start without a password.").
   4. `Keep its data`: for each data path the image declares: a `<Fields>` with a `Field` for the named volume (the suggestion from `suggestVolumes`), the word `at`, and a `Field` (class `mono` through `className`) with the path; `<div className="hint">A named volume. Without it the data is lost when the container is removed.</div>`.
   5. Two `ChipButton`s, `<ChipButton icon="chev-right" aria-expanded={open}>` (`icon="chev-down"` when open) with the labels `More options` and `Show command`. Opening `More options` shows: restart policy, extra environment, extra folders (each with the "Let the container change files here" checkbox, unchecked by default, remembered per folder; a Library or hidden folder is refused with "Library or hidden folders can't be shared" and no box; a named volume has no box and never gets `:ro`), and the network `<Select aria-label="Network" options value onChange />` (shared network `devnet` chosen by default; "(new, created for you)" and "doesn't exist yet" when it is to be created; the list "Already on devnet: db:3306, queue:6379"). Opening `Show command` shows `<Command text={command} />` (it has the copy button; the text contains `--network devnet`, `127.0.0.1:8080:8080` and `-v orders-api-data:/data` in the old scenario).
   6. Information the old panel showed that the mockup has no place for (the image's setup notes, Docker Hub page and source links with their hosts, "defaults itself" list, the CPU mismatch warning, the "latest can change" warning) goes here (the author accepted these places). Put the three links in one `<div className="hint">` under the `Name` row: `Read the setup notes ({host}) · Docker Hub page · Source code ({host})` (each opens through `openUrl`; the hosts are shown as today); put the CPU mismatch and `latest` warnings as `<Banner tone="warn">` (no title) at the top of the body (words unchanged: "built for amd64 ... but your VM is arm64" and `"latest" can change`); put the "defaults itself" list as a `<div className="hint">` at the top of `More options` (words unchanged).
   7. Foot (`footer`): `<Button variant="ghost" size="md">Cancel</Button>` and `<Button variant="primary" size="md" busy={running}>Run</Button>`.
4. After a run: success: the sheet closes, `onRan(id)` is called (Containers then highlights the new row and shows the toast `Started {name}` instead of opening the detail: in `Containers.tsx` find `onRan={(id) => { setRunImage(null); setDetailId(id); }}` and replace by `onRan={(id, name) => { setRunImage(null); setHighlight(id); toast({ text: \`Started ${name}\` }); }}`, and extend `RunPanel`'s `onRan` to pass the name as a second argument; `Images.tsx` ignores it). `setHighlight(id)` scrolls the row into view and gives it focus (find the row by the text of its `.name`). `container-ui.css` has no `.row.selected` look, so focus is the only mark; say so in the pull request.
5. Failure: the sheet stays open with `<Banner tone="bad" title="..." actions={<Button size="xs" variant="ghost">Show output</Button>}>` at the top: the title is what happened in plain words (a port clash says "The host port is taken" first: the old text "host port is taken" is kept), the body selectable text, and the raw output in a `<Canvas aria-label="Output" lines={...} />` that `Show output` unfolds. Never docker's raw text alone (spec 9.6).
6. Esc and a click on the overlay close the sheet when idle. While a run is in progress `busy` is set, so the `Sheet` ignores both. The `RunPanel` listens for Escape itself while running and then asks `confirm({ title: "Stop the run?", body: "...", confirm: "Stop the run", danger: true })` (spec 6.7 rule 3; use the words the old panel has for what stopping means). Closing returns focus to the control that opened it (the `Sheet` does this).
7. Cmd+N: in `App.tsx` the `run` shortcut opens the picker. App renders `<RunPicker>` and `<RunPanel>` itself when a state `runPicker` is set, with the current `ctx`. `Containers` has its own `New` item that sets the same state (pass a prop `onRun`). `Images.tsx` is not edited: it keeps rendering its own copy for its `Run {image}` buttons.
8. `scripts/not-migrated.json`: remove `src/RunPanel.tsx`, `src/RunPicker.tsx`.
9. Bring back `check-guided.mjs`. Behaviours it proved (all **kept** unless said; scenarios and the image `acme/orders-api` are the old ones: print them from the old file):
   1. The setup notes link shows the image's own docs host; Docker Hub page and Source code links show their hosts.
   2. The shared network `devnet` is selected by default; "Already on devnet" lists `db:3306` and `queue:6379`.
   3. The declared port is prefilled (8080).
   4. A named volume is suggested for the data path (`orders-api-data` at `/data`).
   5. The image's built-in defaults are listed ("defaults itself").
   6. A taken host port is warned about, naming the container in the code font ("Port 8080 on this Mac is already used by web."), without "Pick another". **Adapted**: the warning is the banner of step 3.2.
   7. A CPU mismatch is warned about ("built for amd64 ... arm64").
   8. The Run panel's two disclosures use the chevron icon (`details.run-cmd summary svg`, `details.defaults summary svg`). **Adapted**: the two `ChipButton`s have a chevron `svg`.
   9. The command box is not a dark block (its background equals the sheet's). **Adapted**: `.cmd` background is `--bg-canvas`, which differs from the sheet's `--bg` by design; the check asserts it is not black (luminance above 0.5 in light mode, below 0.5 in dark mode).
   10. The `docker run` command shows `--network devnet`, `127.0.0.1:8080:8080`, `-v orders-api-data:/data`.
   11. Clicking a link opens it through the app (`window.__opened` has `https://acme.example/docs/orders`).
   12. Warnings are ink text with a coloured icon (text colour equals the title colour; the icon colour differs). **Adapted**: `container-ui.css` draws a banner body in the muted text colour (`.banner .body`) and the icon in the tone colour, so the check asserts the icon has class `sev warn` and the body is selectable text; it no longer compares the body colour with the title colour.
   13. The port clash offers a button with the next free port; one click fills it and the warning goes.
   14. Run on a port clash says it in plain words ("host port is taken"), never raw docker output ("Error response from daemon", "driver failed").
   15. The container is created on the shared network (`made.networks` has `devnet`) and with the data volume attached.
   16. Nonet scenario: says the network will be created ("devnet (new, created for you)", "doesn't exist yet"); flags an unpinned version ("latest" can change); running creates the network and the container joins it.
   17. Folder: the "Let the container change files here" box is unchecked by default; the command mounts read-only (`:ro`); ticking drops `:ro`; a Library folder is refused with a plain line and no box; the choice is remembered for that folder; a named volume has no box and never gets `:ro`.
   18. No page errors.
   New lines: the sheet's accessible name is `Run acme/orders-api`; the foot has `Cancel` and `Run` (one primary); Escape closes it when idle; after Run the toast says `Started {name}` and the new row is focused in the Containers list; Cmd+N opens the picker; the picker's title is `Choose an image to run`.
10. Mockup row: none. The Run sheet opens only after a click (Images, then `Run {ref}`, or Cmd+N), and `check-mockup.mjs` only goes to a path and takes a picture. Compared **by eye** with `run-sheet-light.png` and `-dark.png`; say so in the pull request.

**Tests to write first:**

`src/RunPanel.test.tsx` (vitest, with `src/test/fakeBackend`; migrate the file that exists if `ls src/RunPanel.test.tsx` shows one):
1. `Given an image that declares port 80, When the sheet opens, Then the Mac field holds the first free port and the container field holds 80`.
2. `Given port 5432 is used by db, When the sheet opens for postgres, Then a warning names db and the button "Use 5433 instead" fills the field and the warning goes`.
3. `Given postgres, When the sheet opens, Then the variable POSTGRES_PASSWORD shows with a password field marked Required`.
4. `Given Run is pressed with the password empty, When pressed, Then the run does not start and the field is marked invalid`.
5. `Given a successful run, When done, Then onRan gets the id and the name and the sheet closes`.
6. `Given a failed run with a port clash, When done, Then a banner says "host port is taken" and Show output unfolds the raw text`.
7. `Given a run in progress, When Escape is pressed, Then a question "Stop the run?" shows`.
8. `Given a folder under Library, When added, Then it is refused and has no writable box`.
9. `Given Show command is opened, When rendered, Then the command contains "docker run" and a copy button`.
10. `Given the picker, When an image is typed and Continue is pressed, Then onPick gets the reference`.

**Done when:**
1. `npx vitest run src/RunPanel.test.tsx` passes; `npm test` passes; the counts of tests in `src/lib/guided.test.ts` and `src/runArgs.test.ts` did not drop (`git diff --stat -- src/lib src/runArgs*` shows no change).
2. `node scripts/check-guided.mjs` and the WebKit run print no `FAIL`; `grep -c "check(" scripts/check-guided.mjs` is at least 28.
3. `grep -n "Drawer" src/RunPanel.tsx src/RunPicker.tsx` prints nothing.
4. By eye (open Images in `?scenario=guided`, press `Run` on an image) against `run-sheet-light.png` and `-dark.png`: sheet 480 px from the right, head "Run postgres:16" with a close button; rows `Name`, `Ports` (the taken port red, the yellow banner with `Use 5433 instead`), `Settings the image needs` (password field "Required"), `Keep its data`; two folded chips `More options` and `Show command`; foot `Cancel` (quiet) and `Run` (blue).
5. The gate in `../HANDOFF.md` section 5.

**Pull request text:** the file `docs/plan/iterations/pr/wo-<id>.md`. Its first line is this title: `wo-3.3a: Run an image from a sheet, with every guided check kept`

---

## WO-3.3b Pull an image: the Pull sheet

**Needs:** WO-3.3a.

**Why:** U9, P3. Brings back `check-pull.mjs`.

**Read first:** spec 7.10 item 5; `src/PullPanel.tsx` (all); `src/lib/guided.ts` (`checkImage`), `src/lib/pullHint.ts` if present (`ls src/lib | grep -i pull`); `scripts/checks-pending/check-pull.mjs`; mockup picture: none for Pull.

**Starting state:**
1. `git status --short` prints nothing.
2. `grep -n "<PullPanel" src/*.tsx` prints its uses (Images, Containers). Props `{ ctx, onClose, onPulled, onRun, searchFor? }` stay.
3. `ls scripts/checks-pending/check-pull.mjs` lists it.

**Steps:**

1. `PullPanel` keeps its default export and props; its `Drawer` becomes a `Sheet` titled `Pull an image` (the old drawer title was "Pull image"; the spec calls the action "Pull an image"; the sheet title follows the spec). Spec 7.10 item 5 describes Pull in one line and the mockup has no Pull picture. Everything below is the old panel's behaviour in the ui components, with the words it has today (the author accepted them).
2. Body: one `<Field aria-label="Image to pull" placeholder="nginx or postgres:16" />`; suggestion `<ChipButton>`s under it (the old suggestion list; pressing one fills the field); a second `<Field icon="search" aria-label="Search Docker Hub" />` with the line "Searching downloads nothing." (the old words contain "nothing is downloaded"; keep the old sentence exactly, it is the old check's line); the result list as `<List aria-label="Search results">` of `<Row lead={<Icon name="image" size="sm" />} name={ref} meta={description} selected={chosen} onOpen={() => choose(ref)}>` with `<Col><Chip>Official</Chip></Col>` for official images and `<Col>{stars}</Col>`; sort control with two `ChipButton`s `Most stars` (pressed by default) and `Name`; choosing a result highlights it (the row's `aria-selected="true"`) and fills `Image to pull`. A `ChipButton` with a chevron `Other registry` opens: `Registry host`, `Image path`, `Tag` (default `latest`) fields (each in a `FormRow`), a preset row of `ChipButton`s (GitHub fills `ghcr.io`, ECR leaves `<account>` and `<region>` which are refused with "Replace <account> and <region>"), the full reference in `<code>`, the sentence that private images need `docker login <registry>` with `<Command text="docker login {registry}" />`. The mode switch is two `ChipButton`s (`aria-pressed`): `Docker Hub` and `Other registry`.
3. Foot (`footer`): `<Button variant="ghost" size="md">Cancel</Button>` and one `<Button variant="primary" size="md">Pull {reference}</Button>` (disabled when the reference is not valid).
4. Progress: one line per layer collapses into a single meter with "{done} of {total}" (spec 7.10 item 5): `<Progress value={done} max={total} aria-label="Pull progress" />` with `<div className="hint">{done} of {total}</div>` under it. Add `src/lib/pullProgress.ts`: `export function pullProgress(lines: string[]): { done: number; total: number }`, where `total` counts the distinct layer ids that have a line `{id}: Pulling fs layer` and `done` counts the distinct ids that have a line `{id}: Pull complete` or `{id}: Already exists`. When `total` is 0 the meter is `<Progress value={null} aria-label="Pull progress" />` (busy). Test first (`src/lib/pullProgress.test.ts`, node:test): `Given three layers started and one complete, When pullProgress runs, Then done is 1 and total is 3`; `Given no layer lines, Then total is 0`; `Given a layer listed twice, Then it counts once`. The mock's pull output (`preview/mock.ts`, `progress("pull-progress", ...)`) has one layer (`a2318d6c47ec: Pulling fs layer` then `Pull complete`), so in the preview the meter goes from "0 of 1" to "1 of 1"; the check asserts those two words. The raw lines are kept in a `Canvas aria-label="Pull output"` that `Show output` unfolds, on failure only. The old `OutputLog` and its class `out-log` are not used.
5. After a pull: `<div className="hint"><Sev level="ok" /> Pulled {ref}</div>` and `<Button>Run {ref}</Button>` that calls `onRun(ref)` and closes. Failure: the unauthorized hint "Sign in to {host} first", `<Command text="docker login {host}" />` (it has the copy button), the raw output in a `Canvas` that `<Button variant="ghost" size="xs">Show output</Button>` unfolds, and no headline made of the raw error. Going back to Docker Hub clears the hint.
6. Cmd+P: in `App.tsx` the `pull` shortcut sets `pullOpen` that `App` renders as `<PullPanel>` itself (as 3.3a step 7). Remove the `setPullOnOpen` plumbing only if tsc and tests agree.
7. `scripts/not-migrated.json`: remove `src/PullPanel.tsx`.
8. Bring back `check-pull.mjs`. Behaviours (all **kept** unless said; selectors move from `.drawer` to `[role=dialog]`):
   1. Finding and pulling are two separate fields (`Search Docker Hub`, `Image to pull`).
   2. Says plainly that searching downloads nothing.
   3. Results default to most stars first (mysql first, then bitnami/mysql).
   4. The official image carries an `Official` tag, once.
   5. Sorting by name puts A first (bitnami/mysql).
   6. The chosen result is highlighted; choosing fills `Image to pull`.
   7. The Pull button names what it will download ("Pull bitnami/mysql").
   8. Only one primary button in the sheet.
   9. Progress is shown (a `progress` element inside the sheet reading "{done} of {total}"; was `.out-log`). **Adapted** (see step 4).
   10. Run is offered once pulled ("Run bitnami/mysql").
   11. Private mode: Docker Hub is the mode you start in (`aria-pressed`); switching marks the new mode; host, path and tag fields show; Docker Hub search is hidden; the tag starts as `latest`; one primary button, off until the reference is valid; it says up front that private images need `docker login <registry>` ("sign in first"); the GitHub preset fills `ghcr.io`; the login command uses the chosen host (`docker login ghcr.io`); an unfilled ECR host is refused with a reason; the full reference shows in code (`ghcr.io/acme/api:1.4`); the Pull button names the reference; a successful private pull is reported ("Pulled ghcr.io/acme/api:1.4"); Run is offered after a private pull.
   12. An unauthorized pull says to sign in to that host ("Sign in to ghcr.io first"); the hint shows the login command (`docker login ghcr.io`); it can be copied ("Copy command"); the raw output is folded under "Show output"; the raw error is not the headline; going back to Docker Hub clears the hint.
   13. **Moved here from `check-restyle`** (WO-2.2 item 6): the Pull sheet's progress shows in a `progress` element (open Images, `Pull image`, type "redis", press Pull redis). **Adapted** (was `.out-log`).
   New lines: the sheet's name is `Pull an image`; Escape closes it when idle; Cmd+P opens it from Containers.
9. Update `check-menus.mjs` (WO-3.1c): the New items now open dialogs named `Choose an image to run`, `Pull an image`, `Start a Compose project` (the third after WO-3.3c; until then the old title).

**Tests to write first:** `src/PullPanel.test.tsx` (vitest; migrate the existing file if there is one):
1. `Given the sheet opens, When rendered, Then two fields exist: "Search Docker Hub" and "Image to pull"`.
2. `Given a search "mysql", When results arrive, Then the most starred is first and the official one has an Official tag`.
3. `Given Name sorting, When chosen, Then bitnami/mysql is first`.
4. `Given a result is chosen, When pressed, Then Image to pull holds its name and the Pull button names it`.
5. `Given Other registry, When chosen, Then host, path and tag fields show and the tag is "latest"`.
6. `Given the ECR preset, When chosen, Then the Pull button is disabled and the reason names <account> and <region>`.
7. `Given an unauthorized failure for ghcr.io, When the pull fails, Then "Sign in to ghcr.io first" and the login command show and the raw output is folded`.
8. `Given a pull finishes, When done, Then "Run {ref}" shows and pressing it calls onRun(ref)`.

**Done when:**
1. `npx vitest run src/PullPanel.test.tsx` and `npm test` pass.
2. `node scripts/check-pull.mjs` and the WebKit run print no `FAIL`; `grep -c "check(" scripts/check-pull.mjs` is at least 27.
3. `grep -n "Drawer" src/PullPanel.tsx` prints nothing.
4. By eye (no mockup picture; open Images, press `Pull`; compare with the Run sheet): same sheet head, one primary in the foot, chips for suggestions and modes, results as rows. No mockup row: the sheet needs a click first.
5. The gate in `../HANDOFF.md` section 5.

**Pull request text:** the file `docs/plan/iterations/pr/wo-<id>.md`. Its first line is this title: `wo-3.3b: Pull an image from a sheet`

---

## WO-3.3c Start a Compose project: the Compose sheet and its logs

**Needs:** WO-3.3b.

**Why:** U9, P3, and the last piece of the Containers screen. Brings back `check-compose.mjs`.

**Read first:** spec 6.7 and 7.10 item 6; `src/ComposeProjects.tsx` and `src/ComposeLogs.tsx` (all); `src/Commands.tsx` (`CommandToast`); `src/lib/compose.ts` (`ls src/lib | grep -i compose`); `scripts/checks-pending/check-compose.mjs` (all 239 lines).

**Starting state:**
1. `git status --short` prints nothing.
2. `grep -n "export" src/ComposeProjects.tsx` prints `Action`, `resetComposeRun`, `composeRunState`, `useComposeRun`, `notStarted`, `runCompose` and the default `ComposeProjects`: all keep their names and signatures (Containers and other files use them).
3. `grep -n "<Drawer" src/ComposeProjects.tsx src/Containers.tsx src/ComposeLogs.tsx` prints the drawers to replace.

**Steps:**

1. `ComposeProjects` (default export, props `{ ctx, scan, containers, attention?, onClose, onChanged?, query? }`) becomes the sheet `Start a Compose project` (spec 7.10 item 6: the projects found on the Mac as rows with name, folder, `Start`, and `Choose a folder…`). Everything the old panel does stays (it is the product's second core feature). Layout:
   1. Head: title `Start a Compose project`; a muted fact: the count of projects.
   2. Body top: a `Field` search (`aria-label="Search projects"`, same fuzzy rule as today: "global-search" and "service-search" both found by "search", initials "sss" find service-search-service first; `query` pre-fills it).
   3. A project is `<List aria-label="Compose projects">` of `<Row lead={<Icon name="folder" size="sm" />} name={project} meta={folder with ~} action={<Button busy={...}>Start</Button>} menu={...}>` with one child `<Col kind="state">{status}</Col>` ("5 of 7 running" or "Not running"). The action is the default button (not the filled one; `Stop`, or `Stopping…` while it works). Pass `title` (the full name and path) so the tooltip holds the full path. The ⋯ menu is `<Menu trigger={<MoreButton name={project} />} label="Actions for {project}" align="end" wide>` with `MenuItem`s: `Rebuild and start` or `Rebuild` (why "After you change a Dockerfile or the code it copies in"; on a stopped project the label says it starts), `Update images and start` (why "When a newer version of an image is out"), `Restart`, `Show logs`, `Show in Finder`, `Copy command` (the command with the folder quoted when it has a space), `Remove containers of {project}` (danger; why "To start clean. Volumes and data are kept"). Hints "After you change a Dockerfile or the code it copies in", "When a newer version of an image is out" and "To start clean. Volumes and data are kept" are the old words (the old check reads them).
   4. A project that needs attention shows one `<Problem level="warn" text="{n} need attention" />` under its row, no per-container detail. A failed start keeps docker's own error under that project (selectable), and a port clash says who holds the port and how to clean up ("Port 8080 is already used by web (in shop)." and "Remove containers (under More actions) clears what was left"), with a `<Button size="xs">Stop web and start blog</Button>` as the `action` of that `Problem`, which does both in one click.
   5. Foot (`footer`): `<Button size="md">Choose a folder…</Button>` (opens the folder picker as today), `<Button variant="ghost" size="md">Scan again</Button>` (shows `Scanning…` while it runs), and the `Add` result line ("Added ~/work/billing") under the list. A hidden folder or `~/Library` is refused with "Hidden folders and ~/Library can't be added". An added folder is remembered under `openpier:compose-folders` (JSON; the key was renamed in iteration 1: use the code's key). Empty scan: `<Empty icon="folder" title="No Compose files found">` with the old explanation of what Spotlight skips.
   6. `Down` (Remove containers) asks first with `confirm({ ..., danger: true })` as in WO-3.1b (title `Remove the containers of {project}?`, "volumes, and the data in them, stay" in the body); cancelling runs nothing.
   7. Escape closes the sheet; closing returns focus to the `New` button.
2. `ComposeLogs` (props `{ ctx, file, project }`): keep as is, but the container it appears in is a `Sheet` titled `Logs of {project}` (the old `Drawer` in `Containers.tsx`): find `Logs of ${logsOf.name}` and replace the `Drawer` by `Sheet`. Inside, controls become ui: `<Select aria-label="Service to show for {project}" options={...} />` (lists every service), `<Button variant="ghost" size="xs">Hide logs</Button>` keeps working when ComposeLogs is shown inside the Compose sheet's card, `<Canvas aria-label="Logs of {project}">{lines}</Canvas>` for the lines. Each line shows its time and its service name (`18:01:02  web  web ready`); draw them as `Canvas` children: `<div className="ln"><span className="t">{time}</span><span className="svc">{service}</span>{text}</div>` (`.svc` is muted, never a colour per service); new lines arrive; a restart is marked `·· 18:01:05  you ran compose restart ··`; choosing a service shows only its lines.
3. `CommandToast` (in `src/Commands.tsx`): it shows each new activity entry. Rewrite it to call `toast({ text })` from `useToast()` instead of drawing `.cmd-toast`, and keep the words: what happened and the command, in the one `text` string: `Started orders-api. docker --context colima compose up -d`. `ToastOptions` is `{ text, action? }`: it has no field for a command block, so the command sits in the text. The old check line 4 reads both parts from the toast text.
4. Cmd-less: the `Start a Compose project` item of `New` and of the palette already calls `setComposeOpen(true)`.
5. `scripts/not-migrated.json`: remove `src/ComposeProjects.tsx`, `src/ComposeLogs.tsx`, and `src/Commands.tsx`.
6. Bring back `check-compose.mjs`. Behaviours it proved (all **kept** unless said; scenario `running`; "panel" now means the sheet):
   1. The panel lists 5 projects; shop first, matched to its 7 containers ("5 of 7 running"); a project with no containers says "Not running".
   2. Folder lines: status visible, inside the row, the row's `title` holds the full path (**Kept**: `Row` takes `title`); each ⋯ names its project ("More actions for {project}"); folders show with `~`; the intro no longer tells you to copy commands.
   3. Search: "search" finds both search services first; initials "sss" find service-search-service first; a search narrows the list; no match says `Nothing matches "zzz"`.
   4. Start runs compose up for that file in the right context (`window.__composed` has `file`, `action: "up"`, `context: "colima"`); the toast says "Started orders-api" and the command (`docker --context colima compose up -d`); the card then reads "1 of 1 running".
   5. A failed start keeps docker's own error ("port is already allocated"), says who holds the port and how to clean up, the `Remove containers` item the note points to is in that card's menu, and `Stop web and start blog` is offered.
   6. Down asks first and says volumes stay; cancelling runs nothing (`__composed` length unchanged).
   7. The copied command quotes a folder with a space (`cd '/Users/me/My Apps/orders-api' && docker --context colima compose stop`) and the clipboard accepted it.
   8. Show in Finder asks for that Compose file (`__revealed`).
   9. Scan again shows `Scanning…`. Escape closes the panel.
   10. The card's main button is a plain button, not the filled one; the status sits on the folder line and the name has the full title; the shop card says "3 need attention" in one line, without per-container detail.
   11. Logs: each line shows service and time; new lines arrive ("GET /health 200"); the service picker lists every service (7 or more options); a restart is marked in the live logs; choosing a service shows only its lines; `Hide logs` closes them.
   12. Rebuild runs `up --build` for shop (`__composed` has `action: "build"` and the file); the toast shows the rebuild command; Update images runs `pull` (`action: "pull"`).
   13. Every card button fits inside the panel (right edge at most the sheet's right edge).
   14. A stopped project's Rebuild and Update images say they start it ("Rebuild and start", "Update images and start") and their hints are shown ("After you change a Dockerfile or the code it copies in", "When a newer version of an image is out", "To start clean. Volumes and data are kept").
   15. A hidden folder is refused ("Hidden folders and ~/Library can't be added"); an added folder shows as a project at once ("Added ~/work/billing") and is remembered (storage holds `/Users/me/work/billing`).
   16. **Moved here from the detail page**: a container with no shell gets a toolbox shell next to it (`__terminal` has `kind: "debug"`, `context: "colima"`, `target: "worker"`), and the toast says why and gives the toolbox command in full (`busybox:1.36 sh`). Kept (header button `Open a shell` of WO-3.2).
   17. An empty container search points to a matching project ("1 Compose project that isn't running matches"); `Show it` opens the panel already searched (first item `service-search-service`).
   18. The "recall" checkbox sits at the start of its label (offset below 2 px). **Adapted**: this line is about the legacy Commands list; it now checks the `Activity` sheet (WO-2.4) for the same box if it still exists; if the box is gone, write `gone by design` with no spec rule: **stop and report** (a behaviour may not vanish without a rule).
   19. Run again is offered for a shell and never for Compose actions; running it again runs the same click once more; each entry says what it did in words; the Activity list has both runs with the failed one marked. **Kept** against the `Activity` sheet.
   20. Searching "8080" finds the container that publishes it (1 app, 1 service, `web`).
   21. After `Stop web and start blog`, blog is running ("1 of 1 running") and the stop it ran is in Activity (`docker --context colima stop web`).
   22. Home has no Compose projects button; `New` opens the Compose panel (`[role=dialog]` named `Start a Compose project`).
   23. A restarting container shows the error behind it ("Its last error", "4182.png: no such file") and says the folder isn't mounted with where to mount it ("Nothing is mounted at /data/in"). **Kept** (this text is in the detail Settings tab's HealthPanel; the check opens `#/containers/<name>/settings`).
   24. `nocompose` scenario: "No Compose files found" explains what Spotlight skips.
   25. No page errors.
7. Update `check-menus.mjs` (WO-3.1c): the third New item opens a dialog named `Start a Compose project`.
8. Mockup: no Compose-start picture exists and the sheet needs a click first. No mockup row. Compare by eye with the Run sheet.

**Tests to write first:** migrate `src/ComposeProjects.test.tsx` (exists today). Table of old tests in the pull request file (kept, changed, removed with the reason). New or changed:
1. `Given five projects, When the sheet opens, Then shop is first and shows "5 of 7 running"`.
2. `Given the query "sss", When typed, Then service-search-service is first`.
3. `Given Start is pressed on orders-api, When it works, Then runCompose is called with action "up" and the toast names the command`.
4. `Given a failed start with a port clash, When it fails, Then docker's error shows and "Stop web and start blog" is offered`.
5. `Given Remove containers is chosen, When the confirm opens, Then it says volumes stay, and Cancel runs nothing`.
6. `Given a folder with a space, When Copy command is chosen, Then the clipboard holds the command with the folder quoted`.
7. `Given a hidden folder is added, When submitted, Then it is refused with the reason`.
8. `Given an empty scan, When rendered, Then "No Compose files found" shows`.
9. `Given Escape, When pressed, Then onClose runs`.

**Done when:**
1. `npx vitest run src/ComposeProjects.test.tsx` and `npm test` pass; `ls src/ComposeProjects.test.tsx` still exists and `grep -c "it(\|test(" src/ComposeProjects.test.tsx` is not lower than before (print both numbers; a removed test needs its line in the pull request file).
2. `node scripts/check-compose.mjs` and the WebKit run print no `FAIL`; `grep -c "check(" scripts/check-compose.mjs` is at least 55.
3. `grep -rn "<Drawer\|from \"./ui/Drawer\"" src/ComposeProjects.tsx src/ComposeLogs.tsx src/Containers.tsx src/RunPanel.tsx src/RunPicker.tsx src/PullPanel.tsx` prints nothing.
4. `ls scripts/checks-pending` lists none of `check-compose.mjs`, `check-guided.mjs`, `check-pull.mjs`, `check-home.mjs`, `check-down.mjs`, `check-menus.mjs`, `check-select.mjs`, `check-observe.mjs`, `check-mounts.mjs`, `check-layout.mjs`, `check-restyle.mjs`.
5. By eye: rows with name, folder, status, small `Start`, ⋯; the sheet looks like the Run sheet (same head and foot); logs sheet has the service picker and a canvas.
6. The gate in `../HANDOFF.md` section 5.

**Pull request text:** the file `docs/plan/iterations/pr/wo-<id>.md`. Its first line is this title: `wo-3.3c: Start a Compose project from a sheet, with its logs`
