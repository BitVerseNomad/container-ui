# Iteration 3: work orders

## What this iteration delivers

1. Every screen after Containers is rebuilt on `src/ui` components, to the mockup: Images, Volumes, Networks (with Test a connection), Kubernetes, Doctor, Settings, Setup and Bring volumes over.
2. Each screen has its eight states (spec section 8), each one openable by URL in the preview, and each one checked in Chromium and WebKit.
3. The old browser checks wait in `scripts/checks-pending/`. This iteration brings every one of them back, so that folder ends with no `check-*.mjs` in it. `scripts/not-migrated.json` loses every screen file named here.

Order: WO-3.4, WO-3.5, WO-3.6, WO-3.7, WO-3.8a, WO-3.8b, WO-3.9, WO-3.10, WO-3.11.

WO-3.8 is split: 3.8a is the Doctor page, 3.8b is the fix and health pieces it uses (`FixIt.tsx`, `Health.tsx`). Reason: Doctor alone is the biggest screen, and its check has about 25 behaviours.

Needs (all of iteration 1 and 2 merged): the gate is green, `src/ui/` holds the components of spec section 6, `scripts/mockup-pairs.json` and `scripts/check-mockup.mjs` work, `scripts/not-migrated.json` exists, routes and the shell exist, and `src/Containers.tsx` is rebuilt (WO-3.1).

---

## Common rules (they apply to every work order below)

Read this section once. Each work order says which rules it uses. A work order never repeats them.

### C1. How to build a screen

1. The mockup is the design. Its screens are JavaScript functions in `docs/plan/design/mockup.html`. Each screen work order names the functions to read (for example `irow` and `images`). Build the same class tree. Replace sample data with live data.
2. Use the components of `src/ui/op/` (import `from "./ui/op"`, relative to the file; WO-5.1 moves them up). Their real props, from WO-1.3a and WO-1.3b (the Starting state of each work order re-checks the ones it uses with `grep -n "Props\|props" src/ui/op/<Name>.tsx`):
   1. `Button`: `variant` default, primary, danger or ghost; `size` xs, sm (default) or md; `icon`, `iconOnly` (needs `aria-label`), `busy` (sets `aria-busy`, ignores clicks, is not `disabled`).
   2. `Field`: `size`, `icon`, `invalid`, `onClear`, `width?: "search"|"filter"|"port"|"num"`; root is `label.field`. A search field is `<Field icon="search" placeholder="Search images" aria-label="Search images" onClear={...} />`. `FormRow({label, hint, htmlFor, children})`.
   3. `Select({value, onChange(value), options: {value, label, hint?}[], "aria-label", size?, width?: "pick"|"num", disabled?})`; `Fields` puts fields side by side. `Switch({checked, onChange, "aria-labelledby", disabled?})`: the label is a separate element with that id.
   4. `Chip`, `ChipButton({pressed?, icon?})` (a folded section line is `ChipButton icon="chev-right" aria-expanded`), `Checkbox({checked, onChange, disabled?, children})`, `Progress({value: number|null, max?, "aria-label"})`, `NavItem({href, icon?, label, current?, count?, countBad?, countLabel?})`, `Tabs({value, onChange, items: {value,label}[], "aria-label", children})` with `TabPanel({value})`, `Dot({state: ok|warn|bad|busy|off, label?})`, `Sev({level: bad|warn|info|ok})`, `Tooltip({text, shortcut?, children})`.
   5. `Banner({tone: bad|warn|info, title?, children, actions})` (no `title` makes the one-line banner). `Empty({icon, title, children, actions})`. `SkeletonRows({rows?})` (four by default).
   6. `Canvas({lines?: {text, time?, level?: "w"|"e"}[], children?, "aria-label"})`. `Command({text, onCopied?})`.
   7. `Tiles` and `Tile({label, value, children})` (children are the foot). `Facts({items: {label, value}[]})` (draws `div.facts`). `GroupCaption({children, count?})` (draws ` · {count}` itself).
   8. `List({"aria-label"})`, `RowHead({menuGap?})`, `Row({lead, dot?, name: node (text with a `Dim` part), nameClass?: plain|mono|long|fixed, title?, meta?: node, metaSelectable?, tall?, children (Col), action, menu, child, onOpen, selected, onSelect, expanded, onToggle})`, `Col({kind?, mono?})` with kinds `ports, stats, state, state-wide, state-words, size, age, age-short, id, subnet, ready, restarts, inside, mac, cpu`, `Dim` (the muted part of a name) and `Members` (chips in place of the meta). `Problem({level: bad|warn, text, action?, child?, onOpen?})` renders a separate `div.subrow` that comes right AFTER its row, not inside it.
   9. `Menu({trigger, label, align?, wide?})` (`wide` when items carry a hint), `MenuItem({label, why?, shortcut?, danger?, disabled?, icon?, onSelect})`, `MenuSeparator`, `MenuCaption`, `MoreButton({name})` (its accessible name is `More actions for {name}`); it forwards its ref and props, so it works as a `Menu` trigger.
   10. `Sheet({open, onClose, title, hideTitle?, fact?, busy?, stack?, footer?, children})`. `useConfirm()` returns `(options: {title, body: ReactNode, command?, confirm, danger?, option?: {label, checked, onChange}}) => Promise<boolean>` (`option` is one checkbox under the body); Cancel is always the other button. `useToast()` returns `({text, action?: {label, onSelect}}) => void`. The providers are mounted by the shell (WO-2.2).
   11. `Inspector({open, onClose, crumb, title, lede, evidence?, findings?, actions, command?})`.
3. Router and header (WO-2.1, WO-2.2): `go("#/images")` (the argument starts with `#`), `replace("#/containers")`, `const { route } = useRoute()` with `route.page` and `route.tab` (pages: containers, images, volumes, networks, kubernetes, doctor, projects, settings, setup). Kubernetes tabs are `pods, deployments, services, events`. Settings tabs are `general, machines, engines, registries, updates, about`. Each page renders its own `<Header title summary? back? stateDot? stateText? meters?>{search, buttons, primary last}</Header>`. Until a page is migrated, `src/App.tsx` renders `<Header title={...} />` above it; the screen work order deletes that line for its page.
4. For the shape of a list screen (header, search, groups, row, menu, the eight states), copy `src/Containers.tsx` and `src/containers/*` as WO-3.1b and WO-3.1c left them. For a sheet, copy the Run sheet of WO-3.3a. For a confirm, copy the Remove confirm of `src/Containers.tsx`.
5. The screen keeps its props, its data hooks and its Docker commands. Only the markup changes, unless the work order says otherwise.
6. ESLint (WO-1.3c) rejects, in files not on the list: `<button`, `<select`, `<table`, any `style` attribute, hex colours, `NNpx` strings, `lucide-react` imports, and imports of the old `src/ui` files. No `className` that is not in `src/ui/openpier.css` (`scripts/check-classes.mjs`).
7. Words come from this file, the mockup and spec section 9. A word on the old screen that is not in the mockup is dropped, unless the work order keeps it.
8. The design is closed for this iteration: every class and component named in the steps exists in `src/ui/openpier.css` (section 11) and `src/ui/op/`. The Starting state of each work order greps the ones it uses. If a grep fails, stop and report: a class or component is still missing, and the author adds it. Do not draw a look with another class and do not write `style`.

### C2. Starting state, common to every screen work order

Run these. All must print what is shown. If not, stop and report.

```sh
git status --short | wc -l
```
Expected: `0`.

```sh
ls src/ui/op/index.ts src/Containers.tsx src/Shell.tsx src/Header.tsx src/lib/router.ts src/lib/routes.ts scripts/mockup-pairs.json scripts/check-mockup.mjs scripts/lib/check.mjs scripts/not-migrated.json src/lib/inspectorContent.ts
```
Expected: all eleven paths printed, no error.

```sh
node -e 'const l=require("./scripts/not-migrated.json");const f=process.argv.slice(1);console.log(f.map(x=>x+" "+l.includes(x)).join("\n"))' <the files this work order moves>
```
Expected: each line ends with `true`.

What the browser checks give you (WO-0.3, WO-1.5, verified by reading those work orders; the Starting state of WO-3.4 prints `scripts/lib/check.mjs` once to confirm):

1. `import { open, check, done } from "./lib/check.mjs"`. `const p = await open("/?scenario=design#/images", { width, height, colorScheme })` returns a Playwright page, 1280x800 and light by default, and navigates to `http://localhost:4173` plus the path. The engine is the environment variable `PW_ENGINE` (`chromium` default, or `webkit`). `check(cond, message)` prints `ok` or `FAIL`. `await done()` closes the browser and exits 1 if any check failed.
2. A page error fails the run by itself (`open` registers it as a failed check). A check script has no `p.errors`. The old `no page errors` lines are therefore dropped (see C3 step 5).
3. `scripts/check-all.sh` runs every `scripts/check-*.mjs` in Chromium and WebKit, by glob. A new script needs no registration.
4. `window.__mock.state()` returns the mock's data; scenarios available from iteration 2: `running`, `design`, `stopped`, `loading` (the first `docker ps` never answers), `unreachable` (the first `ps` answers, later ones throw), `desktop`, `doctor`, `k8spods`, `failed`, `stuck`, `stopfail`, `missing`, `partial`, `nobrew`, `none`, `mismatch`, `two`; flags `&empty=1` (no containers), `&failstart=<name>`.

### C3. Porting an old check from `scripts/checks-pending/`

Each screen work order brings back named old checks. Do exactly this:

1. `git mv scripts/checks-pending/<name>.mjs scripts/<name>.mjs`. Then delete its row in `scripts/checks-pending/README.md`.
2. Make the baseline BEFORE you edit the script: `node scripts/make-baseline.mjs scripts/<name>.mjs > scripts/check-baselines/<name>.messages.txt`. (`make-baseline.mjs` and `check-messages-kept.mjs` are created in WO-3.4.) The baseline lists every message the old check printed, one per line. Commit it.
3. Rewrite the script on `scripts/lib/check.mjs`: remove the local `chromium`, `check`, `failed` code and the `goto`. Start with `const p = await open("<path>");` (1280x800). A line that asserted "no horizontal scroll at 980x640" keeps its size: `const small = await open("<path>", { width: 980, height: 640 });`. End with `await done();`.
4. Change selectors with this table, and nothing else:

| Old | New |
|---|---|
| `.sidebar` button click to reach a screen | `await open("<route>")` |
| `tbody tr`, `[role=row]` of a table | `.list .row:not(.th)` (Containers rows: `[role=row][data-row]`) |
| `.drawer`, `.modal`, drawer `[role=dialog]` | `.sheet` |
| `[role=alertdialog]` | `.dialog` |
| `[role=alertdialog] .primary` | `.dialog .btn.primary` (or `.btn.danger` for a red confirm) |
| `.finding` | a `.list .row` that holds a title and evidence (Doctor) |
| `.group-row` | `.group-cap` |
| `button.small` | `.btn.xs` |
| the row's problem line | the `.subrow` right after the row |

5. Words: when a message or a regular expression holds a word the new design changed (Profiles to Machines, the mockup's words), change the word in the condition and keep the message. Every other message text stays as it was. Never turn a condition into `true`. Never delete a `check(`. One exception: the old `no page errors` lines are removed, because `open()` already fails the run on a page error. Put each in `scripts/dropped-checks.json` with the reason `open() fails the run on any page error`. These do not count in the limit of step 6.
6. `node scripts/check-messages-kept.mjs` must print `ok` for your script. A message you cannot keep goes in `scripts/dropped-checks.json` with the reason, as `{"<name>": [{"message": "<prefix>", "why": "<reason>"}]}`. The author reads that file in the acceptance step. Three entries per work order (page-error lines excluded) is normal. More means you weakened the check: stop and report.
7. The script must pass in both engines: `PW_ENGINE=chromium node scripts/<name>.mjs` and `PW_ENGINE=webkit node scripts/<name>.mjs`.

### C4. The eight states, and how to open each

WO-3.4 adds to the mock the switches in this table (code in WO-3.4 step 1). The ones marked "from 3.1c" already exist.

| State | How to open it |
|---|---|
| First load | `/?scenario=design&slow=1500#<route>` (every mocked docker and kubectl command waits 1500 ms). For Containers only: `?scenario=loading` (from 3.1c) |
| Loaded | `/?scenario=design#<route>` |
| Empty | `/?scenario=design&blank=<list>#<route>` (`<list>` is `images`, `volumes`, `networks` or `pods`). `&empty=1` (from 3.1c) is Containers only and stays |
| Search with no match | type `zzzz-no-match` in the header search |
| Engine stopped | `/?scenario=stopped#<route>` (from 3.1c) |
| Engine not reachable | open Loaded, then `await p.evaluate(() => window.__mock.unreach(true))` |
| Action running on a row | `window.__mock.holdNext("<command words>", 3000)`, then click the action |
| Action failed on a row | `window.__mock.failOnce("<command words>", "<docker text>")`, then click the action |

Words (the ones WO-3.1c uses, so the screens agree):

1. Skeleton: `<SkeletonRows />` (four rows) below the header, which is already drawn.
2. Empty: `<Empty icon title>{line}</Empty>` with the one or two buttons that fix it. The words are in each work order.
3. Stopped: header shows only the title (no search, no buttons). `<Empty icon="box" title="{name} is stopped">Your containers and data are kept. Start the machine to see them.</Empty>` and a primary button `Start {name}`. `{name}` is the machine's name. Copy how `src/Containers.tsx` gets `profile.name` and calls `start`.
4. Not reachable: `<Banner tone="bad" title="Couldn't list {things}">` (things: images, volumes, networks, pods) with the first line of the error as the body and a default button `Try again` (calls the reload). The rows stay (last good data).
5. No match: `<Empty icon="search" title={`Nothing matches "${term}".`}>` and a `Clear search` button.
6. Running on a row: the row's action button shows its busy word (`Removing…`) and is `aria-disabled`; the row's `Dot` is `busy`. The row does not move.
7. Failed on a row: a `Problem` (level bad) under the row with the plain reason and a default xs button `Try again`. The raw Docker text is not the visible text (it is the `title` of the line and in Activity).

`scripts/lib/states.mjs` (created in WO-3.4) holds `checkStates(open, check, s)` that runs all eight for a screen.

### C5. The mockup comparison

1. `scripts/check-mockup.mjs` (WO-1.5) compares in WebKit only (it prints `ok ... skipped` in Chromium). It only navigates to `path`; it cannot click, so a sheet or an open menu cannot be a pair. Sheets and menus are compared by eye.
2. Add one row per mockup screen to `scripts/mockup-pairs.json`: `{ "mockup": "<name>", "path": "<path>", "themes": ["light", "dark"], "threshold": 0.005, "mask": [<selectors>], "why": "" }`. The `design` scenario holds the mockup's containers, images, volumes and networks (WO-1.5 step 4). Pods, Doctor findings, two machines and the Setup state are not in it: the work order that needs them adds them to the `design` scenario only.
3. The default threshold is `0.005`. Never raise it yourself. A row above `0.02` needs a `why`. If your screen is over the threshold, stop and report with the diff image path (`test-results/mockup/<name>-<theme>-diff.png`).
4. `mask` hides elements with `visibility: hidden` in both pages. Use the narrowest selector for live text only. `why` says what each mask hides. A mask never covers a row or a button.
5. Pixel equality is a weak proof. Every work order also lists what to compare by eye. The acceptance file repeats it.

### C6. Leaving the list

At the end of each screen work order, remove its files from `scripts/not-migrated.json` (the list is a JSON array of paths; delete the entries and keep the rest, same order, same formatting). Then `npm run lint` must pass with those files now checked by the strict rules. Fix the files, never the rules. `node scripts/check-not-migrated.mjs` must pass (the list only shrinks).

### C7. The PR text, and merging

There are no GitHub pull requests. Each work order is one branch `wo-<id>`, merged into the local `main` with `git merge --no-ff wo-<id>` after its checks pass. Its "PR text" is the file `docs/plan/iterations/pr/wo-<id>.md`, with the headings of `../HANDOFF.md` section 6. Screenshots go under `docs/plan/iterations/pr/wo-<id>/`: light and dark, WebKit, 1280x800, each next to the matching `docs/plan/design/shots/<name>-light.png` or `-dark.png`. Every "PR file" below means that file. New components are imported from `src/ui/op` (relative: `from "./ui/op"`) until WO-5.1 moves them up.

---

## WO-3.4 Images: see what is on the engine and free space (task 3.4)

**Title**: The Images screen looks and works like the mockup, shows the space the VM uses, and has all eight states.

**Needs**: iteration 2 (all of it), WO-1.3c, WO-1.5.

**Why**: U9 (Images and the disk card are hard to scan and the clean-up buttons are not explained). It also adds the tools every later screen uses: the mock state switches, `checkStates`, and the check-baseline tool that stops a check from being weakened while it is ported.

**Read first**:

1. `docs/plan/04-design-spec.md` sections 6.5, 6.6, 6.9, 7.3, 8, 9.
2. `docs/plan/design/mockup.html`: the functions `irow`, `images`, `more`, `btn`, `header`, `search`.
3. `src/Images.tsx`, `src/DiskCard.tsx`, `src/lib/disk.ts`, `src/lib/events.ts` (`parseVolumeSizes`, `ago`), `src/containerInfo.ts` (`parseBytes`, `formatBytes`).
4. `scripts/checks-pending/check-disk.mjs`, `preview/mock.ts`, `src/api.ts`, `src/ui/Ticks.tsx` and `src/ui/OutputLog.tsx`.

**Starting state**: run C2 with these files: `src/Images.tsx src/DiskCard.tsx`. Then:

```sh
sed -n 1,40p scripts/lib/check.mjs
```
Expected: it exports `open`, `check` and `done` as described in C2. If `open` does not take `{ width, height, colorScheme }` as its second argument, stop and report.

```sh
grep -n 'case "docker"\|case "kubectl"' preview/mock.ts
```
Expected: one line for each. In each `case`, the arguments are an array you can `join(" ")` (WO-3.1c step 1 uses `args[0] === "ps"` in `case "docker"`). Read both cases. If `case "kubectl"` is missing or its arguments are not an array, stop and report.

```sh
grep -n 'slow\|blank\|unreach\|holdNext\|failOnce' preview/mock.ts | wc -l
```
Expected: `0`. If not, stop: a name is taken. (`empty` and `failstart` exist from WO-3.1c and are not used here.)

```sh
ls src/lib/ticks.tsx src/lib/useOutput.ts src/lib/rows.ts 2>&1 | grep -c 'No such file'
```
Expected: `3`. If a file exists, read it, use it, and skip creating it in step 4 or 5. Say so in the PR file.

```sh
grep -rn 'case "images"' src | head -3
```
Expected: one line (the route-to-tab map of WO-2.1). If none, stop and report.

```sh
grep -n '<Images\|<PullPanel\|<RunPanel' src/*.tsx
```
Expected: the mount site of `Images` in `src/App.tsx` with its props (`{ctx, onRan, startPull, arch}` today), and the uses of `PullPanel` (props `{ctx, onClose, onPulled, onRun, searchFor?}`) and `RunPanel` (props `{ctx, image, arch?, onClose, onRan}`) from WO-3.3. Keep the props that are there.

```sh
grep -n '<Header title={tab === "Profiles"' src/App.tsx
```
Expected: one line (WO-2.2 step 8.2). Step 6 edits it.

**Do not touch**: `src/PullPanel.tsx`, `src/RunPanel.tsx`, `src/RunPicker.tsx` (WO-3.3 rebuilt them; call them as it left them), `src/lib/disk.ts` logic, the Docker commands (`builder prune -f`, `image prune -a -f`, `image rm`, `system df`), the Rust allowlist.

**Steps**:

1. Mock state switches. Create `preview/states.ts`:

```ts
// Switches that open each screen state by URL or from a check. Used by preview/mock.ts only.
//   ?slow=1500          every docker and kubectl command waits 1500 ms (the first-load state)
//   ?blank=images,pods  those lists come back empty (images, volumes, networks, pods)
//   window.__mock.unreach(true)           every command throws "Cannot connect to the Docker daemon"
//   window.__mock.holdNext("image rm", 3000)   the next command that starts with these words waits 3000 ms
//   window.__mock.failOnce("image rm", "text") the next command that starts with these words throws that text
const params = new URLSearchParams(location.search);
const slowMs = Number(params.get("slow") ?? 0);
const blankLists = new Set((params.get("blank") ?? "").split(",").filter(Boolean));
let unreachable = false;
const failures: { prefix: string; text: string }[] = [];
const holds: { prefix: string; ms: number }[] = [];

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const BLANK_FOR: [string, string][] = [
  ["image ls", "images"],
  ["volume ls", "volumes"],
  ["network ls", "networks"],
  ["get pods", "pods"],
];

// Called first in every docker and kubectl case of preview/mock.ts with the arguments joined by spaces.
// Returns { value } to answer in place of the normal handler, or undefined to carry on.
export async function gate(line: string): Promise<{ value: string } | undefined> {
  if (slowMs) await wait(slowMs);
  if (unreachable) throw new Error("Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?");
  const hold = holds.findIndex((h) => line.startsWith(h.prefix));
  if (hold >= 0) await wait(holds.splice(hold, 1)[0].ms);
  const fail = failures.findIndex((f) => line.startsWith(f.prefix));
  if (fail >= 0) throw new Error(failures.splice(fail, 1)[0].text);
  if (BLANK_FOR.some(([prefix, list]) => blankLists.has(list) && line.includes(prefix))) return { value: "" };
  return undefined;
}

export const stateApi = {
  unreach: (on: boolean) => { unreachable = on; },
  holdNext: (prefix: string, ms: number) => { holds.push({ prefix, ms }); },
  failOnce: (prefix: string, text: string) => { failures.push({ prefix, text }); },
};
```

In `preview/mock.ts`: add `import { gate, stateApi } from "./states";`. As the first line inside `case "docker":` and inside `case "kubectl":` add (with the real name of the argument array in that case, called `args` below):

```ts
{ const gated = await gate(args.join(" ")); if (gated) return gated.value; }
```
(If the case is not inside an async function, make that function async and check its callers await it.) Find `window.__mock = {` and add `...stateApi,` inside the object. No existing scenario changes. Not verified: that an empty string is a valid answer for `docker image ls --format json`, `volume ls`, `network ls` and `kubectl get pods`. Step 8 checks it (state 3).

Start the preview (`npm run preview`, background) and run:

```sh
node --input-type=module -e 'import("./scripts/lib/check.mjs").then(async m=>{const p=await m.open("/?scenario=design&blank=images#/images");console.log(await p.evaluate(()=>typeof window.__mock.unreach));await m.done()})'
```
Expected: prints `function`.

2. `scripts/lib/states.mjs` in full:

```js
// Runs the eight states of spec section 8 for one list screen (see C4 of the iteration 3 work orders).
// s = { name, route, row, emptyList, things, busy, failed }
//   name: "images"                 used in messages
//   route: "#/images"
//   row: ".list .row:not(.th)"     one selector that matches a data row
//   emptyList: "images"            value for &blank=
//   things: "images"               for the banner title "Couldn't list images"
//   busy:   { hold: "image rm", open: async (p) => {...}, row: async (p) => locator } or null
//   failed: { fail: "image rm", text: "Error response from daemon: ...", open: async (p) => {...}, row: async (p) => locator } or null
export async function checkStates(open, check, s) {
  const base = "/?scenario=design";
  let p = await open(`${base}&slow=1500${s.route}`);
  check((await p.locator(".skeleton").count()) >= 4, `${s.name} state 1: first load shows skeleton rows`);
  await p.locator(s.row).first().waitFor({ timeout: 8000 });
  check((await p.locator(".skeleton").count()) === 0, `${s.name} state 1: skeleton rows go when data arrives`);

  p = await open(`${base}${s.route}`);
  await p.locator(s.row).first().waitFor();
  check((await p.locator(s.row).count()) > 0, `${s.name} state 2: loaded rows show`);

  p = await open(`${base}&blank=${s.emptyList}${s.route}`);
  await p.locator(".empty").first().waitFor({ timeout: 8000 });
  check((await p.locator(s.row).count()) === 0 && (await p.locator(".empty .title").count()) === 1, `${s.name} state 3: empty list shows an empty state, no rows`);

  p = await open(`${base}${s.route}`);
  await p.locator(s.row).first().waitFor();
  const q = "zzzz-no-match";
  await p.locator(".header input").first().fill(q);
  await p.getByText(`Nothing matches "${q}".`).waitFor({ timeout: 4000 }).catch(() => {});
  check((await p.getByText(`Nothing matches "${q}".`).count()) === 1, `${s.name} state 4: search with no match says so`);
  await p.getByRole("button", { name: "Clear search" }).click();
  check((await p.locator(s.row).count()) > 0, `${s.name} state 4: Clear search brings the rows back`);

  p = await open(`/?scenario=stopped${s.route}`);
  await p.locator(".empty").first().waitFor({ timeout: 8000 });
  const stoppedText = await p.locator(".empty").first().innerText();
  check(/is stopped/.test(stoppedText) && /Your containers and data are kept\./.test(stoppedText), `${s.name} state 5: engine stopped says the data is kept`);
  check((await p.locator(".empty .btn.primary").count()) === 1 && /^Start /.test(await p.locator(".empty .btn.primary").innerText()), `${s.name} state 5: one primary Start button`);

  p = await open(`${base}${s.route}`);
  await p.locator(s.row).first().waitFor();
  const before = await p.locator(s.row).count();
  await p.evaluate(() => window.__mock.unreach(true));
  await p.locator(".banner.bad").first().waitFor({ timeout: 15000 }).catch(() => {});
  check((await p.locator(".banner.bad").count()) === 1, `${s.name} state 6: engine not reachable shows one error banner`);
  check(new RegExp(`Couldn't list ${s.things}`).test(await p.locator(".banner.bad").first().innerText().catch(() => "")), `${s.name} state 6: the banner says Couldn't list ${s.things}`);
  check((await p.locator(s.row).count()) === before, `${s.name} state 6: the last data stays under the banner`);
  check((await p.locator(".banner.bad").getByRole("button", { name: "Try again" }).count()) === 1, `${s.name} state 6: the banner offers Try again`);

  if (s.busy) {
    p = await open(`${base}${s.route}`);
    await p.locator(s.row).first().waitFor();
    await p.evaluate((h) => window.__mock.holdNext(h, 3000), s.busy.hold);
    await s.busy.open(p);
    const r = await s.busy.row(p);
    await r.locator(".dot.busy").first().waitFor({ timeout: 2500 }).catch(() => {});
    check((await r.locator(".dot.busy").count()) === 1, `${s.name} state 7: a running action turns the row's dot blue`);
    check((await r.locator('.btn[aria-disabled="true"], .btn[aria-busy="true"], .btn:disabled').count()) >= 1, `${s.name} state 7: its button is locked while it runs`);
  }
  if (s.failed) {
    p = await open(`${base}${s.route}`);
    await p.locator(s.row).first().waitFor();
    await p.evaluate(([f, t]) => window.__mock.failOnce(f, t), [s.failed.fail, s.failed.text]);
    await s.failed.open(p);
    const r = await s.failed.row(p);
    const line = r.locator("xpath=following-sibling::*[1][contains(@class,'subrow')]");
    await line.waitFor({ timeout: 5000 }).catch(() => {});
    check((await line.count()) === 1, `${s.name} state 8: a failed action puts a problem line under the row`);
    check((await line.getByRole("button", { name: "Try again" }).count()) === 1, `${s.name} state 8: the line offers Try again`);
    check(!/^\s*Error response from daemon/.test(await line.innerText()), `${s.name} state 8: the line is plain words, not the raw Docker text`);
  }
}
```
`Problem` renders its `.subrow` as the next sibling of the row (WO-1.3b), so the `following-sibling` line is right. If the first run shows it is not (the row is wrapped), change only that line to find the `.subrow` after the row, and say so in the PR file.

3. Baseline tools.

`scripts/make-baseline.mjs`:

```js
// Prints the behaviours an old check proves: every "tag: text" message string, one per line, cut before the first ${.
import fs from "node:fs";
const src = fs.readFileSync(process.argv[2], "utf8");
const found = [...src.matchAll(/(?:"([a-zA-Z0-9 -]+: [^"]*)"|`([a-zA-Z0-9 -]+: [^`]*)`)/g)].map((m) => (m[1] ?? m[2]).split("${")[0].trimEnd());
console.log([...new Set(found)].join("\n"));
```

`scripts/check-messages-kept.mjs`:

```js
// Fails when a ported check lost a message of its old version. Each scripts/check-baselines/<name>.messages.txt
// lists the old messages. A message may be missing only if scripts/dropped-checks.json explains why.
import fs from "node:fs";
const dir = "scripts/check-baselines";
const dropped = fs.existsSync("scripts/dropped-checks.json") ? JSON.parse(fs.readFileSync("scripts/dropped-checks.json", "utf8")) : {};
let failed = 0;
for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith(".messages.txt")) : []) {
  const name = f.replace(".messages.txt", "");
  const script = fs.readFileSync(`scripts/${name}.mjs`, "utf8");
  const allowed = new Set((dropped[name] ?? []).map((d) => d.message));
  const lost = fs.readFileSync(`${dir}/${f}`, "utf8").split("\n").filter(Boolean).filter((m) => !script.includes(m) && !allowed.has(m));
  if (lost.length) { failed++; console.log(`FAIL ${name}: ${lost.length} message(s) lost`); lost.forEach((m) => console.log(`  ${m}`)); }
  else console.log(`ok ${name}: every old message is still there`);
}
process.exit(failed ? 1 : 0);
```
Create `scripts/dropped-checks.json` with content `{}`.

Messages that change on purpose (a word the design changed) would trip this tool. Keep the message text and change only the regular expression. If the message itself names a changed word (for example "Profiles"), write the new message and add the old prefix to `dropped-checks.json` with the reason "word changed: <old> to <new>".

4. Helpers with tests. Create `src/lib/rows.ts`:

```ts
// Small text helpers shared by the list screens. Pure, so they have node tests.
export const shortId = (id: string): string => id.replace(/^sha256:/, "").slice(0, 12);

export function splitRef(ref: string): { name: string; tag: string } {
  const colon = ref.lastIndexOf(":");
  const slash = ref.lastIndexOf("/");
  return colon > slash && colon > 0 ? { name: ref.slice(0, colon), tag: ref.slice(colon + 1) } : { name: ref, tag: "latest" };
}

export const usedByText = (names: string[]): string => (names.length ? `Used by ${names.join(", ")}` : "Not used");

// A volume with no name is a 64-character hash. Show its first 11 characters, "…" and a "no name" mark.
export function volumeLabel(name: string): { text: string; noName: boolean } {
  return /^[0-9a-f]{64}$/.test(name) ? { text: `${name.slice(0, 11)}…`, noName: true } : { text: name, noName: false };
}

// At most `max` names, then "+n".
export function memberChips(names: string[], max = 4): { shown: string[]; more: number } {
  return names.length <= max ? { shown: names, more: 0 } : { shown: names.slice(0, max), more: names.length - max };
}

export const countLabel = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
```

Create `src/lib/rows.test.ts` (node test, same style as the other `src/lib/*.test.ts`; read one first and copy its imports):

1. `Given an id with the sha256 prefix, When shortId runs, Then it returns the first 12 hex characters`: `shortId("sha256:bfbd7fe0b37e1234")` equals `"bfbd7fe0b37e"`.
2. `Given a ref with a registry port and no tag, When splitRef runs, Then the tag is latest`: `splitRef("localhost:5000/app")` equals `{ name: "localhost:5000/app", tag: "latest" }`.
3. `Given a ref with a tag, When splitRef runs, Then name and tag are split at the last colon`: `splitRef("acme/orders-api:1.4")` equals `{ name: "acme/orders-api", tag: "1.4" }`.
4. `Given no containers, When usedByText runs, Then it says Not used`.
5. `Given two containers, When usedByText runs, Then it says Used by db, web`: `usedByText(["db", "web"])`.
6. `Given a 64-character hash, When volumeLabel runs, Then it shows 11 characters, an ellipsis and the no-name mark`: `volumeLabel("c".repeat(64))` equals `{ text: "ccccccccccc…", noName: true }`.
7. `Given a normal name, When volumeLabel runs, Then it is unchanged`: `volumeLabel("mysql-data")`.
8. `Given six members, When memberChips runs, Then four are shown and two are counted`: `memberChips(["a","b","c","d","e","f"])` equals `{ shown: ["a","b","c","d"], more: 2 }`.
9. `Given four members, When memberChips runs, Then none is counted`.
10. `Given 1 and 2, When countLabel runs, Then it is singular then plural`.

Run `npm test`: see them fail (module missing), then add the file, see them pass.

5. Text and output helpers (the legacy `Ticks` and `OutputLog` are not in the new component set).

`src/lib/ticks.tsx` in full:

```tsx
import type { ReactNode } from "react";

// Shows `name` (in backticks) in the mono font. The rest is plain text.
export function Ticks({ text }: { text: string }): ReactNode {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 2 ? <span key={i} className="mono">{part.slice(1, -1)}</span> : part,
  );
}

export const plain = (text: string): string => text.replace(/`/g, "");
```
Test `src/lib/ticks.test.tsx` (vitest; copy the import line style of `src/BringOver.test.tsx`): `Given text with two backtick spans, When Ticks renders, Then two .mono elements hold the inner words` and `Given backticks, When plain runs, Then they are removed`.

`src/lib/useOutput.ts`: open `src/ui/OutputLog.tsx`. Move its event listening (the effect that calls `listen` for `pull-progress`, `colima-progress` and `brew-progress`, and the code that turns a payload into a line) into this hook, unchanged:

```ts
export function useOutput(events: string[], max = 200): { lines: string[]; clear: () => void }
```
It returns the last `max` lines, newest last, and a `clear`. Do not delete `OutputLog.tsx` (WO-5.1 does). Rendering is done by the screens with `<Canvas>` (read `src/ui/op/Canvas.tsx` for its props). Test `src/lib/useOutput.test.tsx` only if `OutputLog` had a test; otherwise the hook is covered by the browser check of WO-3.10.

6. Images screen. Rewrite `src/Images.tsx` to this tree (read `irow` and `images` in the mockup; classes are the same). Props and data hooks stay.

```
<Header title="Images" summary="{n} · {size}">              (WO-2.2 Header; copy its use in src/Containers.tsx)
   <Field icon="search" placeholder="Search images" aria-label="Search images" onClear={...} />
   <Button variant="primary" icon="download">Pull</Button>   -> opens the Pull sheet (startPull)
</Header>
<div className="content">
  <GroupCaption>Space inside the VM</GroupCaption>
  <div className="tiles"> four <Tile> (below) </div>
  <GroupCaption>Images</GroupCaption>
  <div className="list"> one <Row> per image </div>
```
Summary: `{count} · {total size}`, for example `5 · 1.6 GB` (use `formatBytes`). Delete the line `<Header title={tab === "Profiles" ? "Settings" : tab} />` that `src/App.tsx` renders above this page only if it is specific to Images; if it is the shared line of WO-2.2 step 8.2, change it so it no longer renders for the Images tab (the screen draws its own Header). Do the same in WO-3.5, 3.6, 3.7 and 3.8a for their tabs.

`Row` takes `name` as a node and `<Dim>` draws the muted part (`<Dim>:1.4</Dim>`). Starting-state check: `grep -n 'name: React.ReactNode' src/ui/op/Row.tsx` prints one line, and `grep -n 'export function Dim' src/ui/op/Row.tsx` prints one line. If not, stop and report.

Tiles, in this order, with these words (the numbers are live):

1. `Build cache`, value = build cache size, foot: `All can be freed` and `<Button size="xs">Clear</Button>`. Disabled when nothing can be freed.
2. `Images`, value = images size, foot: `{unused size} unused` and `<Button size="xs">Remove unused</Button>`.
3. `Stopped containers`, value = their size, foot: a link `Show in Containers` (goes to `#/containers`). No button: containers cannot be pruned (`container prune` is not allowed by the backend).
4. `Volumes`, value = their size, foot: a link `Show in Volumes` (goes to `#/volumes`). Never a button.

Keep what `DiskCard.tsx` does: the numbers come from `docker system df` as before; `Clear` runs `builder prune -f` and `Remove unused` runs `image prune -a -f`, each after a confirm that names what goes (`useConfirm`). The confirm for `Clear` has the word `build cache` in its title. Keep the line `Freed 3.4 GB from build cache.` (the number is live) as a toast (`useToast`) after it runs. Keep the sentence `Freeing space here does not always shrink the VM's disk file on your Mac.` as the hint under the confirm's body, not on the page. Move `freedBy` and the row map out of the old card: delete `src/DiskCard.tsx` at the end of this work order (remove it from `not-migrated.json` too) and put its logic into `src/lib/disk.ts` if it is not there yet, or into `src/Images.tsx` if it is under 40 lines.

Image row (`Row`): in this order: image icon, name with the tag muted after a colon (`splitRef`), used-by in `.meta.grow` (`usedByText`, built from the containers that use the image), short ID in `<Col kind="id" mono>` (`shortId`), size in `<Col kind="size" mono>` (`formatBytes`), age in `<Col kind="age">` (`ago`, with the exact time in a `Tooltip`), a `Run` button (default variant) inside `.act`, and the `⋯` menu.

Starting-state check for the column kinds used by Images, Networks and Kubernetes:

```sh
grep -c 'col.id\|col.subnet\|col.ready\|col.restarts\|col.state.words' src/ui/openpier.css
```
Expected: `5` or more (openpier.css section 11.2). If fewer, stop and report which class is missing.

Menu (`<Menu wide>` because the items carry hints; `MenuItem`, `MenuSeparator`):

1. `Pull again`, hint `To get the newest build of this tag`. Runs the same pull that `startPull` runs for that reference.
2. `Copy name`. Copies `name:tag`, then a toast `Copied`.
3. a separator.
4. `Remove…` (danger). Opens a confirm. The command is the existing `image rm`. It is disabled when a container uses the image, with the hint `Used by {names}. Remove {first name} first`.

`Run` opens the Run sheet for the image (the `RunPanel` of WO-3.3, with the image preselected, as today). Clicking the row itself does nothing in this iteration (Image detail is task 8.14).

Search: the existing fuzzy `score` from `lib/fuzzy` over name and tag. States: C4, all eight, with the empty title `No images yet` and its one button `Pull an image` (primary, opens the Pull sheet). Use exactly `No images yet` and `Pull an image` (the author accepted these words).

The action that runs on a row is `Remove…` (confirm, then `image rm`). Busy: the row's lead shows `<Dot state="busy" />` in place of the image icon, and the row's `Run` button is locked. Failed: a `.subrow` with the plain words `Couldn't remove {name}. {reason}` and `Try again`. Take the reason from the existing error handling in `Images.tsx`; if it only has Docker's raw text, keep that text as the evidence line (`.meta.selectable`) under the plain sentence.

7. Mock data for the design scenario. Open `preview/mock.ts`, find the `design` scenario (from WO-1.5). Check it already has the five images of the mockup: `acme/orders-api:1.4`, `mysql:8`, `nginx:latest`, `redis:7`, `postgres:16` and that `system df` gives Build cache 3.4 GB, Images 1.6 GB (666 MB unused), Stopped containers 64 MB, Volumes 1.6 GB. If a value is missing, add it to the `design` scenario only.

8. Bring back the old check. Follow C3 for `check-disk.mjs` (path `/?scenario=design#/images`). Then create `scripts/check-images.mjs`:

```js
import { open, check, done } from "./lib/check.mjs";
import { checkStates } from "./lib/states.mjs";

const p = await open("/?scenario=design#/images");
await p.locator(".list .row").first().waitFor();
const rows = p.locator(".list .row:not(.th)");
// the "check(" lines below, each: message then the condition in words
```
Its `check(` lines (message: condition):

1. `images: header says Images with a count and a size`: the `.header h1` is `Images` and the summary matches `/^\d+ · [\d.]+ (MB|GB)$/`.
2. `images: Pull is the one primary button in the header`: `.header .btn.primary` count is 1 and its text is `Pull`.
3. `images: four tiles in the order Build cache, Images, Stopped containers, Volumes`: the `.tile .k` texts equal that array.
4. `images: Stopped containers and Volumes tiles have a link and no button`: those two `.tile .foot` have 0 `.btn` and 1 `a`; the links read `Show in Containers` and `Show in Volumes`.
5. `images: five rows`: row count is 5 in the design scenario.
6. `images: a row reads name, muted tag, used-by, short id, size, age, Run`: for the row with `nginx`, the text has `nginx`, `latest`, `Used by web`, `c471664d435b`, `183 MB`, and a `Run` button; `.muted` holds `:latest`.
7. `images: Not used is said plainly`: the `mysql` row says `Not used`.
8. `images: Remove is off when a container uses the image`: open the `nginx` row's `⋯`, the item `Remove…` is `aria-disabled` and its hint starts with `Used by web.`.
9. `images: Remove on an unused image asks first, and removes it`: open `mysql`'s `⋯`, click `Remove…`, a `.dialog` shows, click its `.btn.danger`, the `mysql` row is gone.
10. `images: Copy name copies name:tag`: click `Copy name` on `redis`, then read the clipboard (`navigator.clipboard.readText()` after `context.grantPermissions`) and expect `redis:7`. Not verified: that the preview grants clipboard in WebKit. If it does not, check for the toast `Copied` instead.
11. `images: Run opens the Run sheet with the image filled in`: click `Run` on `redis`, a `.sheet` shows with the text `redis:7`.
12. `images: column order matches the mockup`: the left edges of the cells (icon, name, used-by, id, size, age, Run) increase in that order for the first row.
13. `images: no horizontal scroll at 1280x800`.
14. (no page-error line: `open()` fails the run on a page error, see C2.)
15. The state lines: `await checkStates(open, check, { name: "images", route: "#/images", row: ".list .row:not(.th)", emptyList: "images", things: "images", busy: { hold: "image rm", open: async (q) => { const r = q.locator(".list .row", { hasText: "mysql" }); await r.getByRole("button", { name: /More actions/ }).click(); await q.getByRole("menuitem", { name: "Remove…" }).click(); await q.locator(".dialog .btn.danger").click(); }, row: async (q) => q.locator(".list .row", { hasText: "mysql" }) }, failed: { fail: "image rm", text: "Error response from daemon: conflict: unable to remove repository reference", open: <same as busy.open>, row: <same as busy.row> } })`.

End with `await done();`.

9. Mockup pairs. Add to `scripts/mockup-pairs.json`: `{ "mockup": "images", "path": "/?scenario=design#/images", "themes": ["light","dark"], "threshold": 0.005, "mask": [], "why": "" }`. Ages in the design scenario are fixed text, so no mask. If the age differs from the mockup's (`1 week ago`), fix the mock data, not the threshold.

10. C6 with `src/Images.tsx`, `src/DiskCard.tsx` (deleted: `git rm`; the entry goes too).

**Tests to write first**:

1. `src/lib/rows.test.ts` (step 4), ten tests. Write and run first. Expected before: `npm test` fails with a missing module. After: passes.
2. `src/lib/ticks.test.tsx` (step 5), two tests.
3. `scripts/check-images.mjs` (step 8): write the `check(` lines before the screen. Run it against the old screen: it must FAIL. Paste the output.

**Done when** (plus the gate of `HANDOFF.md` section 5):

```sh
node -e 'const l=require("./scripts/not-migrated.json");console.log(["src/Images.tsx","src/DiskCard.tsx"].filter(f=>l.includes(f)).length)'
```
Expected: `0`.

```sh
test ! -e src/DiskCard.tsx && echo gone
```
Expected: `gone`.

```sh
grep -nE '<button|<select|<table|style=' src/Images.tsx | wc -l
```
Expected: `0`.

```sh
ls scripts/checks-pending/check-disk.mjs 2>&1 | grep -c 'No such file'
```
Expected: `1`.

```sh
node scripts/check-messages-kept.mjs && PW_ENGINE=chromium node scripts/check-disk.mjs | grep -c FAIL; PW_ENGINE=webkit node scripts/check-images.mjs | grep -c FAIL
```
Expected: `ok check-disk: every old message is still there`, then `0`, then `0`.

```sh
node -e 'const r=require("./scripts/mockup-pairs.json").find(x=>x.mockup==="images");console.log(r&&r.threshold<=0.005)'
```
Expected: `true`.

By eye, against `docs/plan/design/shots/images-light.png` and `images-dark.png`: the group caption `Space inside the VM` above four tiles; the Pull button is the only blue button; each row reads icon, name with a grey tag, used-by in grey, ID in the mono font, size, age, `Run`, `⋯`, in that order and at those widths; no table lines; `Remove unused` and `Clear` are small buttons inside their tiles.

**PR file title** (the title line of `docs/plan/iterations/pr/wo-<id>.md`): `wo-3.4: Images screen on the new design, with the VM space tiles and all eight states`

---

## WO-3.5 Volumes: see what each volume holds and remove the unused ones (task 3.5)

**Title**: The Volumes screen looks like the mockup, removes unused volumes behind one confirm, and has all eight states.

**Needs**: WO-3.4 (it adds `states.mjs`, `rows.ts`, the baseline tools).

**Why**: U9 (sort, filter and select controls bury the screen). Removing is the only action, so it is one button and one confirm.

**Read first**:

1. Spec 7.4, 6.8 (Dialog), 8, 9. Mockup functions `vrow`, `volumes`.
2. `src/Volumes.tsx`, `src/lib/volumes.ts` (`volumeUsage`, `unusedAnonymous`, `isAnonymous`), `src/lib/bringOver.ts` (`backupOf`), `src/dockerLock.ts` (`dockerLocked`, `useDockerLocked`), `src/lib/events.ts` (`parseVolumeSizes`).
3. `scripts/checks-pending/check-volumes.mjs`.

**Starting state**: C2 with `src/Volumes.tsx`. Then:

```sh
ls src/lib/rows.ts scripts/check-messages-kept.mjs scripts/lib/states.mjs
```
Expected: all three printed.

```sh
grep -n 'export const backupOf\|export function backupOf' src/lib/bringOver.ts
```
Expected: one line.

```sh
grep -n 'export function dockerLocked\|export function useDockerLocked' src/dockerLock.ts
```
Expected: two lines.

```sh
grep -n '<Volumes' src/*.tsx
```
Expected: one mount site, with `ctx` as its prop (today `<Volumes ctx>`). Keep what it is.

**Do not touch**: the lock rule (`dockerLocked`, text `Waits for what is changing Docker now.`), `parseVolumeSizes`, `backupOf`, the `volume rm` command.

**Steps**:

1. Rewrite `src/Volumes.tsx`. Props and data stay. Tree (from `vrow` and `volumes` in the mockup):

```
Header: title "Volumes", summary "{n} · {size}", search "Search volumes", <Button>Remove unused…</Button> (default variant)
<div className="content"><div className="list">
  <GroupCaption>In use</GroupCaption>      one <Row> per volume a container uses
  <GroupCaption>Not used</GroupCaption>    one <Row> per volume nothing uses
```
A group with no rows is not drawn. Row: database icon, name (`volumeLabel`: a hash shows 11 characters, `…` and `<Dim>no name</Dim>`), used-by in `.meta.grow` (`Used by db`, or for an unused volume: `Last used by a container that was removed` when the volume's usage data says so, otherwise empty), size in `<Col kind="size" mono>` (`parseVolumeSizes`), an empty `.act`, the `⋯` menu. A volume made by Bring over keeps its backup mark: when `backupOf(name)` returns text, show it as a `Chip` after the name.

2. Remove, drop, and keep. Drop the sort control, the filter control and the multi-select. Keep the `useDockerLocked` rule: while Docker is locked, `Remove…` items and the header button are disabled and their hint is `Waits for what is changing Docker now.`.

Menu per row:

1. `Copy name` (toast `Copied`).
2. separator.
3. `Remove…` (danger). Disabled while a container uses the volume, hint `Used by {names}. Remove {first name} first`. Opens a confirm: title `Remove {name}?`, body `Its data is deleted and can't be brought back.`, buttons `Cancel` and `Remove` (danger). Runs `volume rm {name}`.

Do not build `Show what's inside` (spec 7.4 lists it). It needs a command that lists a volume's files and the backend has none (feature G6 is "Next"). Say so in the PR file.

3. `Remove unused…` (header). Opens a confirm with one checkbox (`ConfirmOptions.option`):

```tsx
let onlyUnnamed = false;
const ok = await confirm({
  title: "Remove unused volumes?",
  body: `${unused.length} volumes, ${formatBytes(totalBytes)} in all. ${unnamed.length} of them have no name (${formatBytes(unnamedBytes)}). Their data can't be brought back.`,
  confirm: "Remove",
  danger: true,
  option: { label: "Only volumes with no name", checked: false, onChange: (v) => { onlyUnnamed = v; } },
});
```
   1. The body is one sentence with both counts (a confirm's body does not change when the box is ticked). For one volume the text reads `1 volume, ...`. Use `removalPlan` (below) for the numbers.
   2. After `ok`, remove `removalPlan(unused, onlyUnnamed).names` with `volume rm`, one at a time, in order, and stop at the first failure. The failure shows as a `Banner tone="bad"` above the list with the volume name and the reason; the rest are not tried.
   3. When no volume is unused, the header button is disabled and its `Tooltip` says `Nothing unused`.
   4. Words not in the spec: the title and the body sentence. The author accepted them.
4. States. C4. Empty title `No volumes yet`, no button (volumes are made by containers; spec gives no fix). The action that runs on a row is `Remove…`. Busy and failed as in WO-3.4, with command words `volume rm`.

5. Check. Port `check-volumes.mjs` (C3, route `#/volumes`, scenario `design`). Old behaviours it proved, from its messages (all must stay):

1. mysql-data shows it is in use by db.
2. redis-data shows Not used.
3. an in-use volume cannot be removed.
4. an unused named volume can be removed one at a time.
5. the bulk action is limited to volumes with no name, and counts them (now: the confirm's checkbox `Only volumes with no name`, and the count in its body).
6. the confirmation names what it removes.
7. the unused no-name volume is gone after the bulk remove.
8. unused NAMED volumes survive the bulk action.

Then add `scripts/check-volumes-new.mjs`? No: put the new lines in `check-volumes.mjs` after the ported ones: 

9. `volumes: two groups In use then Not used, in that order`.
10. `volumes: a volume with no name shows 11 characters, an ellipsis and the words no name`: the row text matches `/^c{11}….*no name/s`.
11. `volumes: Remove unused… states the count and the total size`: the `.dialog` text has `3 volumes`, `2 of them have no name` and a size like `GB`.
12. `volumes: ticking Only volumes with no name removes only the no-name volumes`.
13. `volumes: no Show what's inside item` (the menu has no such item).
14. `volumes: no sort, filter or select controls` (no `input[type=checkbox]` in the rows, no element with text `Sort`).
15. `volumes: while a Fix is running the remove buttons wait`: if the preview has a way to start a Fix (see `scripts/checks-pending/check-bring-home.mjs`'s lock lines, they do this with a replace run), otherwise skip this line and say so in the PR file.
16. the `checkStates` call, `name: "volumes"`, `row: ".list .row:not(.th)"`, `emptyList: "volumes"`, `things: "volumes"`, busy and failed on `redis-data`'s `Remove…` with command words `volume rm`.

The old script's lock behaviour for `check-replace` is brought back by WO-3.11.

6. Mockup pair: `{ "mockup": "volumes", "path": "/?scenario=design#/volumes", "themes": ["light","dark"], "threshold": 0.005, "mask": [], "why": "" }`. Check the `design` scenario volumes equal the mockup's five: `mysql-data` (393 MB, db), `ccccccccccc…` (3.9 KB, web), `pgdata-old` (1.1 GB), `redis-data` (17 MB), `aaaaaaaaaaa…` (36 B).

7. C6 with `src/Volumes.tsx`.

**Tests to write first**:

1. `src/lib/rows.test.ts` already covers `volumeLabel`. Add to `src/lib/volumes.test.ts` (if the file does not exist, create it; read `src/lib/volumes.ts` first) a test for the new helper in step 3: `Given volumes with two no-name ones, When removalPlan runs with onlyUnnamed false, Then it lists every unused volume and sums the sizes` and `... with onlyUnnamed true, Then it lists only the no-name ones`. Add to `src/lib/volumes.ts`:

```ts
// What "Remove unused…" will remove. `volumes` are the unused ones with their sizes in bytes.
export function removalPlan(volumes: { name: string; bytes: number }[], onlyUnnamed: boolean): { names: string[]; bytes: number } {
  const picked = onlyUnnamed ? volumes.filter((v) => /^[0-9a-f]{64}$/.test(v.name)) : volumes;
  return { names: picked.map((v) => v.name), bytes: picked.reduce((sum, v) => sum + v.bytes, 0) };
}
```
2. The lines of step 5, written before the screen; run them against the old screen and see them FAIL.

**Done when**: the gate, plus:

```sh
node -e 'const l=require("./scripts/not-migrated.json");console.log(l.includes("src/Volumes.tsx"))'
```
Expected: `false`.

```sh
grep -nE '<button|<select|<table|style=|Sort|Filter' src/Volumes.tsx | wc -l
```
Expected: `0`.

```sh
test ! -e scripts/checks-pending/check-volumes.mjs && node scripts/check-messages-kept.mjs | grep -c 'ok check-volumes'
```
Expected: `1`.

```sh
PW_ENGINE=chromium node scripts/check-volumes.mjs | grep -c FAIL; PW_ENGINE=webkit node scripts/check-volumes.mjs | grep -c FAIL
```
Expected: `0` and `0`.

By eye, against `volumes-light.png` and `volumes-dark.png`: two group captions `In use` and `Not used`; the no-name rows show eleven letters, `…` and a grey `no name`; no main button on any row, only `⋯`; the header has one default-coloured button `Remove unused…` and no blue button.

**PR file title** (the title line of `docs/plan/iterations/pr/wo-<id>.md`): `wo-3.5: Volumes screen on the new design with one Remove unused confirm`

---

## WO-3.6 Networks and Test a connection (task 3.6)

**Title**: The Networks screen looks like the mockup, a network opens in a sheet where containers connect and disconnect, and Test a connection is a sheet with checked steps.

**Needs**: WO-3.4.

**Why**: U10 (a long teaching paragraph and a hidden diagnostic).

**Read first**:

1. Spec 7.5, 6.7 (Sheet), 6.8, 8, 9. Mockup: `nrow`, `networksMain`, `networks`, `networkSheet`, `prob`, `btn`.
2. `src/Networks.tsx`, `src/ConnectionTest.tsx`, `src/lib/network.ts` (`parseNetworks`, `diagnose`, `parseContainerFacts`, `parseProbe`, `sharedNetworks`), `src/lib/guided.ts` if `ConnectionTest` imports it.
3. `scripts/checks-pending/check-network.mjs`, `scripts/checks-pending/check-netfix.mjs`.

**Starting state**: C2 with `src/Networks.tsx src/ConnectionTest.tsx`. Then:

```sh
grep -n 'BUILTIN\|const NAME' src/Networks.tsx
```
Expected: two lines (`BUILTIN` is `bridge`, `host`, `none`; `NAME` is `/^[A-Za-z0-9][A-Za-z0-9_.-]*$/`).

```sh
grep -n 'nicolaka/netshoot' src/ConnectionTest.tsx
```
Expected: one line with `v0.16`.

```sh
grep -c 'row .members\|col.subnet' src/ui/openpier.css
```
Expected: `2` or more. Fewer: stop and report.

```sh
grep -n '<Networks\|<ConnectionTest' src/*.tsx
```
Expected: mount sites. Note the props (`ConnectionTest` takes `{ctx, from?, onClose}` today; the container page and the Doctor open it).

**Do not touch**: `diagnose` and the other `lib/network.ts` logic; the helper image `nicolaka/netshoot:v0.16`; the `network_probe` command; the `network create|connect|disconnect|rm|inspect|ls` commands.

**Steps**:

1. Rewrite `src/Networks.tsx`. Tree:

```
Header: "Networks", count, search "Search networks", <Button>Test a connection</Button>, <Button variant="primary" icon="plus">New</Button>
<div className="content"><div className="list">
  <GroupCaption>Yours</GroupCaption>      user networks
  <GroupCaption>Built in</GroupCaption>   bridge, host, none
```
Row (`nrow`): network icon, name, a `Chip` `Built in` when built in, then `<Members>` with one `Chip` per member (`memberChips`, at most four, then a chip `+{n}`), or `<span class="meta">No containers</span>` when empty, then the subnet in `<Col kind="subnet" mono>` (empty for `host` and `none`), an empty `.act`, the `⋯` menu with `Copy name` and `Remove…` (danger; disabled with the hint `Still has containers` when it has members; absent for the built in ones). A click on the row opens its sheet.

2. The old teaching paragraph is deleted. Its idea appears as a problem line (`Problem`, severity warn) right under the `bridge` row, with the text `{name} can't find other containers by name here. Put containers that talk to each other on a network of your own.` and a button `Move to {network}…` (size xs). A container is flagged when `bridge` is its only network. `{name}` is the first flagged container; with more than one, `{name} and {n} more`. `{network}` is the user network with the most members; when there is none, the button is `New network…` and opens the New dialog. `Move to {network}…` asks first (`useConfirm`: title `Move {name} to {network}?`, body `It joins {network} and leaves bridge. It is not restarted.`, button `Move`) and then runs `network connect` and `network disconnect bridge`.

Not verified: that "its only network is bridge" is the rule the old `diagnose` used for "no name lookup". Step: read `diagnose` in `src/lib/network.ts`. If it says something else, use its rule and say so in the PR file. If it has no such rule, stop and report.

3. `New` opens a `Sheet` titled `New network` (a confirm cannot hold a field, so this is a sheet: the author decided it) with one `Field` labelled `Name` (`FormRow`), and in `footer` the buttons `Cancel` (ghost) and `Create` (primary, disabled while the name is invalid). The old `NAME` rule stays; an invalid name shows its message under the field in the old words. Runs `network create {name}`.

4. The network sheet (`networkSheet` in the mockup). `Sheet` with: head `{name}` and the subnet in mono muted; body: `GroupCaption` `Containers on this network` (no left padding inside a sheet; this needs the class below), then a `.list` with one row per member (`Dot ok`, name, address in `.meta.grow.mono`, `Button` `Disconnect` with variants `xs ghost`); `GroupCaption` `Add a container`; one row with a `Select` of containers not on this network and a `Button` `Connect` (size md); then the hint `Connecting only adds. Nothing is restarted.`.

The sheet's captions need no extra class: `.sheet-body .group-cap` has no left padding in `openpier.css`. Use `<Sheet stack>` for the body.

5. Test a connection becomes a `Sheet`, title `Test a connection`. Its body: `Field` `From` (a `Select` of running containers; preset by the `from` prop), `Field` `To` (a `Select` of running containers), `Field` `Port` (number, prefilled from what the target declares, as today), and `Button` `Check` (primary, md). Then the steps from the old `diagnose` result, each a row with a tick or a cross (`Sev` ok or bad) and one line; a failed step with a fix shows the fix button as now (for example `Connect kafka-ui to devnet`). The old title `Why can't one container reach another?` becomes the lede line under the head. Keep every sentence `diagnose` returns (the old checks assert them). Container pages and the Doctor open this sheet as before.

6. States C4 (empty: `No networks yet`, no button; stopped: as C4). Action on a row: `Remove…` of an empty user network, command words `network rm`. Failed: reason in plain words plus `Try again`.

7. Checks. Port `check-network.mjs` (route `#/networks`) by C3. `check-netfix.mjs` needs the Doctor page of WO-3.8a, so WO-3.8a step 5 moves it; its row in `scripts/checks-pending/README.md` stays until then. Write that in the PR file.

Old behaviours of `check-network.mjs` (all stay):

1. lists devnet with its containers and their addresses.
2. the built-in networks are marked.
3. explains in plain words why a network of your own is needed (now: the problem line under `bridge`, text `can't find other containers by name`).
4. a network can be created.
5. an empty network can be removed after confirming.
6. a network with containers cannot be removed.
7. a running container can be connected to a network.
8. no page errors.
9. the Test a connection sheet: the port is prefilled from what the target declares; says they don't share a network and why; offers the one-click fix naming exactly what it will do; also flags the setting that points at localhost; after connecting says they share a network, the name resolves, the port accepts connections; the localhost warning stays with a corrected setting to copy; links to the target image's setup notes; a closed port is reported with the ports the target declares; no page errors.
10. the container page opens it with this container as the client, shows its networks and flags the default bridge.

New lines: `networks: groups Yours then Built in`, `networks: a member list over four shows four chips and +n` (devnet has api, worker, kafka, queue, +2), `networks: the subnet column holds 172.18.0.0/16 for devnet`, `networks: bridge has a problem line with Move to devnet…`, `networks: Move to devnet… asks first and moves kafka-ui` (after it, the problem line is gone), `networks: the sheet lists members with Disconnect and the hint Connecting only adds. Nothing is restarted.`, `networks: Disconnect removes the member from the sheet`, `networks: the teaching paragraph is gone` (no text `doesn't do name lookup` outside the problem line), and the `checkStates` call (`name: "networks"`, `route: "#/networks"`, `emptyList: "networks"`, `things: "networks"`, busy and failed on `Remove…` of an empty network with command words `network rm`; the design scenario has no empty user network, so add `scratch-net` (172.19.0.0/16, no members) to the `design` scenario and check that the Networks pair still passes; if it does not, add it only for `&blank` runs and say so).

8. Mockup pair: `{ "mockup": "networks", ... "path": "/?scenario=design#/networks" ... }`. The design scenario must hold devnet (api, worker, kafka, queue, web, db), `bridge` (kafka-ui), `host`, `none`. The `network-sheet` picture is compared by eye only (a sheet has no route and `check-mockup.mjs` cannot click; the acceptance file lists it).

9. C6 with `src/Networks.tsx`, `src/ConnectionTest.tsx`.

**Tests to write first**: `src/lib/rows.test.ts` covers `memberChips`. Add `src/lib/network.test.ts` cases (read the existing file first and copy its style) for the helper you add to `src/lib/network.ts`:

```ts
// The network "Move to…" should offer: the user network with the most members, or null.
export function moveTarget(networks: { name: string; builtin: boolean; members: string[] }[]): string | null {
  const own = networks.filter((n) => !n.builtin);
  if (!own.length) return null;
  return own.reduce((best, n) => (n.members.length > best.members.length ? n : best)).name;
}
```
1. `Given no user network, When moveTarget runs, Then it returns null`.
2. `Given two user networks, When moveTarget runs, Then it returns the one with more members`.
3. `Given built-in networks with many members, When moveTarget runs, Then they are ignored`.

Then the `check(` lines of step 7, before the screen. Run them on the old screen: FAIL.

**Done when**: the gate, plus:

```sh
node -e 'const l=require("./scripts/not-migrated.json");console.log(["src/Networks.tsx","src/ConnectionTest.tsx"].filter(f=>l.includes(f)).length)'
```
Expected: `0`.

```sh
grep -nE '<button|<select|<table|style=' src/Networks.tsx src/ConnectionTest.tsx | wc -l
```
Expected: `0`.

```sh
grep -rn "doesn't do name lookup" src --include=*.tsx | grep -v test | wc -l
```
Expected: `0`.

```sh
node scripts/check-messages-kept.mjs | grep -c 'ok check-network'; PW_ENGINE=chromium node scripts/check-network.mjs | grep -c FAIL; PW_ENGINE=webkit node scripts/check-network.mjs | grep -c FAIL
```
Expected: `1`, `0`, `0`.

By eye, against `networks-light.png`, `network-sheet-light.png` and the dark ones: `Yours` then `Built in`; devnet shows four chips and `+2`; `bridge` carries a `Built in` chip and a tinted warning line under it with a small `Move to devnet…` button; `Test a connection` is default, `New` is blue; the sheet's `Disconnect` buttons are ghost and small, the hint is muted.

**PR file title** (the title line of `docs/plan/iterations/pr/wo-<id>.md`): `wo-3.6: Networks and Test a connection on the new design`

---

## WO-3.7 Kubernetes: see which pods need attention, in plain words (task 3.7)

**Title**: The Kubernetes screen groups pods into Need attention and Running with plain-word statuses, and a pod opens in a sheet.

**Needs**: WO-3.4.

**Why**: U12 (a "Needs attention" block repeats the table, and raw reasons such as CrashLoopBackOff).

**Read first**: spec 7.6, 6.3 (Tabs), 6.7, 8, 9; mockup `krow`, `kubernetes`; `src/Kubernetes.tsx`, `src/PodDrawer.tsx`, `src/lib/k8s.ts` (`parsePods`, `podProblems`, the other parsers); `scripts/checks-pending/check-k8s.mjs`; `src/InstallTool.tsx`.

**Starting state**: C2 with `src/Kubernetes.tsx src/PodDrawer.tsx`. Then:

```sh
grep -n '<Kubernetes' src/*.tsx
```
Expected: a mount site with `profile` and `ctx`.

```sh
grep -c 'col\.ready\|col\.restarts' src/ui/openpier.css
```
Expected: `2` or more (`col.ready` and `col.restarts` are in openpier.css 11.2). Fewer: stop and report.

```sh
grep -n 'kubernetes:' src/lib/routes.ts
```
Expected: one line: `PAGE_TABS` lists `pods`, `deployments`, `services`, `events` (WO-2.1). If missing, stop and report.

**Do not touch**: the `kubectl` calls and arguments, `lib/k8s.ts` parsers, `open_terminal` for k9s, `InstallTool` install command (`brew install kubectl`).

**Steps**:

1. Plain-word states from `podProblems`. Create `src/lib/podStatus.ts`. A pod needs attention when `podProblems` (`src/lib/k8s.ts`) returns at least one entry for it, also when its status is `Running`. The status words are the first problem's `title`; the dot level is that problem's `level`:

```ts
import { podProblems, type Pod } from "./k8s";

// What the State column says and which dot a pod gets (spec 7.6). The raw status goes in the tooltip and the pod sheet.
export const podState = (p: Pod, now: number): { words: string; dot: "bad" | "warn" | "ok"; attention: boolean } => {
  const [first] = podProblems(p, now);
  if (!first) return { words: p.status, dot: "ok", attention: false };
  return { words: first.title, dot: first.level, attention: true };
};
export const needsAttention = (p: Pod, now: number): boolean => podProblems(p, now).length > 0;
```
Test `src/lib/podStatus.test.ts` (node test; build each `Pod` with a small helper that fills the fields of the `Pod` type in `src/lib/k8s.ts`): `Given a pod waiting in CrashLoopBackOff, When podState runs, Then the words are Keeps crashing and restarting and the dot is bad`; the same for `ImagePullBackOff` (`Can't download its image`, bad), an unschedulable pod (`Can't be placed on a node`, warn), a pod whose `lastTerminated.reason` is `OOMKilled` and is running again (`Restarted after running out of memory`, warn); `Given a Running pod with no problem, When needsAttention runs, Then false`; `Given a Running pod whose last run was OOMKilled, When needsAttention runs, Then true`; `Given a pod with status Completed, When needsAttention runs, Then false`. The words come from `podProblems`; the test only checks that the first one is used. Do not copy the words into this file.

2. Rewrite `src/Kubernetes.tsx` (tree from `kubernetes` in the mockup):

```
Header (delete the shared App.tsx Header line for this tab): "Kubernetes", summary "{nodes} · {version} · {running} of {total} pods running" (e.g. "1 node · v1.30.2+k3s1 · 3 of 6 pods running"),
        <Select> namespaces ("All namespaces" first), <Button>Open in k9s</Button>
<div className="content">
  <Tabs value={route.tab} onChange={(t) => go(`#/kubernetes/${t}`)} items=[Pods, Deployments, Services, Events] aria-label="Kubernetes">   (route.tab from useRoute(); "pods" by default) with a <TabPanel> per tab
  Pods:   <div className="list">
            <GroupCaption count={n}>Need attention</GroupCaption>  rows (pods with `needsAttention` true)
            <GroupCaption>Running · {n}</GroupCaption>        rows
```
The old "Needs attention" block is deleted. Pod row: `.lead` with a `Dot` (`podState(...).dot`), name, namespace in `.meta.grow`, Ready in `<Col kind="ready" mono>`, state in `<Col kind="state-words">` with `podState(...).words` and a `Tooltip` holding the raw `status`, Restarts in `<Col kind="restarts" mono>`, age in `<Col kind="age-short">`, the `⋯` menu (`Copy name`; `Copy kubectl logs command`). A click opens the pod sheet.

Deployments, Services and Events tabs keep today's data as `.list` rows built the same way: Deployments (`name`, namespace, `ready/desired` e.g. `0/1`, age), Services (`name`, namespace, type, ports like `80→8080/TCP`, age), Events (`reason`, object, message, age; warnings first, as today). Column order is today's table order.

The namespace select filters all four tabs. With Kubernetes off (profile has none): the empty state `Kubernetes is off` with its one button `Turn on Kubernetes` (the old Profiles action; WO-3.9 moves it to Settings; here the button calls the same function it calls today). Without `kubectl`: the empty state `kubectl is missing` with the exact command `brew install kubectl` and the `InstallTool` button as today. Both sets of words are the old ones; keep them as they are in the old file if they differ and list them in the PR file.

3. Pod sheet (`PodDrawer.tsx` becomes `src/PodSheet.tsx`; `git mv`). `Sheet`: head = pod name and namespace; body = four parts in this order: the plain-words state as the title (`podState(...).words`) with the raw `status` in mono muted beside it; `What to check` (the `detail` of the first `podProblems` entry; none when the pod has no problem); `Last events` (warning events of the pod, as today); `Logs` in a `Canvas` with the previous-run toggle (`Switch` (`aria-labelledby` the id of a label with the text `Previous run`)) and a `Button` `Copy kubectl logs command`. Behaviour as the old drawer.

4. States C4 on the Pods tab (empty list: `No pods` with no button). Pod actions are read-only, so states 7 and 8 do not apply: pass `busy: null, failed: null`, and the PR file says why.

5. Check. Port `check-k8s.mjs` (route `#/kubernetes/pods`, scenario for pods: the old script used `k8spods`; the `design` scenario must now also hold the six pods of the mockup: `api-5c4d`, `worker-6f2a`, `report-8a1b`, `cache-1b3c`, `web-7d9f`, `coredns-5f9c`; use `design` for the new lines and the old scenario name where the old script needed it). Old behaviours (all stay):

1. the summary shows the node is ready.
2. a crash-looping pod is called out in plain words (`api`, "keeps crashing").
3. an image pull failure is called out (`worker`, "download its image").
4. an unschedulable pod is called out (`report`, "placed on a node").
5. an out-of-memory pod is called out (`cache`).
6. a healthy pod is not listed as a problem.
7. the namespace filter narrows the pods.
8. the pods list shows each pod's status (the raw `CrashLoopBackOff`, `ImagePullBackOff`, `Pending` are now in the tooltip; change the condition to read the tooltip text; keep the message).
9. the pod's warning events are shown.
10. the pod's logs are shown.
11. offers the kubectl logs command to copy.
12. deployments show ready over desired.
13. services show their ports.
14. Open in k9s asks the app to open k9s for this cluster.
15. no page errors.
16. Kubernetes off: the nav item is hidden; the screen offers Turn on Kubernetes; it asks first and says the VM restarts; after turning it on the nav item appears and the cluster appears.
17. no kubectl: the nav item stays hidden; the screen shows the exact install command.

Line 16 uses the Kubernetes switch of Profiles (now Settings, WO-3.9). Keep the old route to it for now (whatever `check-k8s.mjs` clicks), and WO-3.9 re-points it. Say in the PR file which lines depend on WO-3.9. If a line cannot pass until WO-3.9, keep it, mark it in `dropped-checks.json` with the reason `moves with Settings in WO-3.9`, and WO-3.9 restores it (its Done when checks that file has no entry for `check-k8s`).

New lines: `k8s: two groups Need attention · 4 then Running · 2`, `k8s: the status column holds plain words`, `k8s: the old Needs attention block is gone` (only one text `Need attention` per group caption), `k8s: the pod sheet opens with the plain-words title, What to check, Last events and Logs`, `k8s: tabs are Pods, Deployments, Services, Events and the route changes with the tab`, and the `checkStates` call (`name: "k8s"`, `route: "#/kubernetes/pods"`, `emptyList: "pods"`, `things: "pods"`, `busy: null`, `failed: null`).

6. Mockup pair: `{ "mockup": "kubernetes", "path": "/?scenario=design#/kubernetes/pods", ... "threshold": 0.005 }`.

7. C6 with `src/Kubernetes.tsx`, `src/PodDrawer.tsx` (renamed, entry removed and not re-added).

**Tests to write first**: `src/lib/podStatus.test.ts` (step 1), then the `check(` lines, which fail on the old screen.

**Done when**: the gate, plus:

```sh
node -e 'const l=require("./scripts/not-migrated.json");console.log(["src/Kubernetes.tsx","src/PodDrawer.tsx"].filter(f=>l.includes(f)).length)'
```
Expected: `0`.

```sh
test ! -e src/PodDrawer.tsx && test -e src/PodSheet.tsx && echo ok
```
Expected: `ok`.

```sh
grep -nE '<button|<select|<table|style=' src/Kubernetes.tsx src/PodSheet.tsx | wc -l
```
Expected: `0`.

```sh
node scripts/check-messages-kept.mjs | grep -c 'ok check-k8s'; PW_ENGINE=chromium node scripts/check-k8s.mjs | grep -c FAIL; PW_ENGINE=webkit node scripts/check-k8s.mjs | grep -c FAIL
```
Expected: `1`, `0`, `0`.

By eye, against `kubernetes-light.png` and `-dark.png`: summary `1 node · v1.30.2+k3s1 · 3 of 6 pods running`; the namespace select and `Open in k9s` sit in the header; the four tabs are chips with Pods selected; red dots for the first two pods, yellow for the next two, green for the last two; status words match the mockup exactly; no raw `CrashLoopBackOff` on screen.

**PR file title** (the title line of `docs/plan/iterations/pr/wo-<id>.md`): `wo-3.7: Kubernetes screen with plain-word pod statuses and a pod sheet`

---

## WO-3.8a Doctor: the page of findings (task 3.8, part 1)

**Title**: The Doctor page shows what needs action, what is worth knowing, and what passed, with one button per finding.

**Needs**: WO-3.4. WO-3.1 (it built the Inspector use for "See why").

**Why**: U13 (Doctor findings are long blocks with many buttons and hidden commands).

**Read first**:

1. Spec 7.7, 6.5, 6.6, 6.16 (Inspector), 8, 9. Mockup: `finding`, `doctor`, `inspector`, `problem-inspector` screen.
2. `src/Doctor.tsx` in full (it exports `useMuted`, `useDoctor(ctx, profile)`, `groups(setupFindings, report, mutedKeys)`, and the default `Doctor` with props `{ctx, setup, doc, onProfiles, onBring, onGo, onOpen, composePaths}`; internal `DoctorFix` and `SizeRow`).
3. `src/FixIt.tsx`, `src/Health.tsx` (Doctor imports `LimitActions` and `isListed`), `src/lib/doctor.ts`, `src/lib/health.ts`, `src/lib/fixStore.ts`.
4. `scripts/checks-pending/check-doctor.mjs`, `check-netfix.mjs`.

**Starting state**: C2 with `src/Doctor.tsx`. Then:

```sh
grep -n 'export function useMuted\|export function useDoctor\|export function groups\|export default function Doctor' src/Doctor.tsx
```
Expected: four lines. If a name is missing, stop and report.

```sh
grep -n '<Doctor' src/*.tsx
```
Expected: one mount site with the props above. Keep them. The badge in the sidebar uses `todo` from `useDoctor` or `groups`: find where, and keep that count the same.

```sh
grep -c 'row.tall\|export function ChipButton\|export function Dim' src/ui/openpier.css src/ui/op/*.tsx | grep -v ':0' | wc -l
```
Expected: `2` or more (the `.row.tall` class in the stylesheet, and `ChipButton` in `src/ui/op/`). Fewer: stop and report which is missing.

```sh
grep -n 'Inspector' src/Containers.tsx src/ContainerDetail.tsx | head -3
```
Expected: at least one line (WO-3.1 or 3.2 used the Inspector). Write down how it is opened. If nowhere, stop and report.

**Do not touch**: `groups()` and `useDoctor` logic, the per-check data in `src/lib/doctor.ts` and `health.ts`, the fix commands, `FixIt.tsx` and `Health.tsx` internals (WO-3.8b), `Resize.tsx` (WO-3.9). Doctor keeps importing them as they are.

**Steps**:

1. Rewrite the markup of `src/Doctor.tsx`. Logic, hooks and props stay. Tree (from `finding` and `doctor`):

```
Header: "Doctor", sub "Checked {n} seconds ago", <Button>Check again</Button>
<div className="content"><div className="list">
  <GroupCaption count={n}>Needs action</GroupCaption>
  rows (severity bad)
  <GroupCaption count={n}>Worth knowing</GroupCaption>
  rows (severity warn)
  <GroupCaption><ChipButton icon="chev-right" aria-expanded={open}>Passed · {n}</ChipButton></GroupCaption>       folded; click unfolds the passed rows (the icon turns to `chev-down` when open)
  <GroupCaption><ChipButton icon="chev-right" aria-expanded={open}>Hidden by you · {n}</ChipButton></GroupCaption> folded; unfolds the hidden rows, each with ⋯ "Bring it back"
</div></div>
```
A group with no rows is not drawn. The two folded lines are always drawn when their count is above zero. When nothing needs action (and nothing is worth knowing), show an `Empty` with a check icon, title `Nothing needs action`, and the line `{n} checks passed` (spec 7.7 item 6; the author accepted the second line's words).

Finding row: `<Row tall lead={<Sev .../>} name={title} meta={evidence} metaSelectable action={<Button/>} menu={...}>`. `tall` draws the two lines and puts the button and `⋯` in `.side`; `Sev` is the bad, warn or ok icon. Names in the title and evidence that are in backticks render with `Ticks` from `src/lib/ticks.tsx`.

Button by kind of fix, from what the existing finding already carries (read `DoctorFix` and the finding type in `src/lib/doctor.ts`):

1. The app can fix it: primary, names what it fixes, ends with `…` (`Fix kafka and kafka-ui…`, `Install Compose…`). It opens a confirm that says what will change and where the backup goes (copy the old confirm text and the `FixIt` run as they are).
2. Only the user can decide: default, `Show how`. It opens a `Sheet` with the explanation and the commands to copy (each command in a `Canvas` with `Copy`). The old collapsed "Or run it yourself" block becomes this sheet. Commands are never shown unfolded on the row.
3. Fixed on another page: default, `Open Images` (or `Open Volumes`, `Open Settings`), which goes to that route.
4. A container problem is not counted here: the old behaviour (container problems are counted on the Containers screen, and the Doctor summary says where) stays: show it as one line under the header, `{n} container problems are on Containers.` with a link. Read the old summary text in `Doctor.tsx` and keep its words as they are.

`⋯` menu: `Not an issue` (hint `Hide it here and on its container. You can bring it back`), `Run it yourself` (opens the same sheet as `Show how`; absent when there is no command). Keep `useMuted` for hide and bring back.

"See why": a finding that has an Inspector explanation (read the finding type for a field such as a container name or a `why` block) shows `See why` as its button and opens the Inspector as WO-3.1b does: `inspectorContent(finding, container, project, fixLabel, fixCommand)` from `src/lib/inspectorContent.ts` (pure; its input is the Doctor `Finding` of `src/lib/doctor.ts`, built on `Problem` of `src/lib/health.ts`: `id`, `level`, `title`, `short`, `detail`, `fix`) returns `{ crumb, title, lede, evidence?, findings?, command? }`, which are the `Inspector` props (a finding without evidence passes none); pass them as `<Inspector open onClose {...content} actions={...} />`, the `actions` built the way `src/Containers.tsx` does (copy that wiring; `fixLabel` and `fixCommand` come from `fixAction`, find it with `grep -rn "export function fixAction" src`). A finding about a container has a container name; a finding about the machine or the setup has none: it keeps rule 1, 2 or 3, no Inspector. Do not write new explanations.

2. Setup findings (the old `setupFindings` rows for Docker Desktop leftovers, the Testcontainers fix, the "Fix all") keep their logic. Show each as a finding row with the same rules. `Fix all` stays one primary button in the header next to `Check again`, shown only while at least two fixable setup findings exist. Its confirm lists every step and every backup file, as the old one did.

3. Counts. The page summary count, the group counts and the sidebar badge are one number. After this work order the badge and the page agree (the old check asserted it).

4. States C4. The list screen states: loaded, empty (step 1), stopped, not reachable (banner), and the first load shows four skeleton rows. Search does not exist on Doctor: for state 4 the check skips. So `checkStates` is not used; write the five states by hand in `check-doctor.mjs` with the same URLs as C4 and say in the PR file that Doctor has no search.

5. Move `check-netfix.mjs` and `check-doctor.mjs` out of `checks-pending/` by C3. (`check-netfix.mjs` tests Doctor findings, so it comes back here; the table in `scripts/checks-pending/README.md` names this work order for it.) (route `#/doctor`; `check-netfix.mjs` uses scenarios with DNS and proxy problems; keep the scenario names it uses, and read them from the script).

Old behaviours of `check-doctor.mjs` (all stay; selectors map by C3):

1. container problems are not counted: nothing else needs action, and the summary says where they are.
2. localhost: names the setting and the container it meant.
3. names: explains the default network has no name lookup.
4. postgres: names the missing setting, as a likely cause.
5. CPU: the amd64 image is worth knowing, not an alarm.
6. no "Or run it yourself" block uses `rm -f`, or runs a container without renaming the old one first.
7. storage: the database without a volume is worth knowing.
8. rows: nothing about problems sits above the list.
9. rows: the localhost problem offers Fix… ; the name problem offers Connect… ; a crash with no one-click fix offers See why.
10. rows: a healthy row has no problem line and no button; each problem shows once, under its own row.
11. rows: at 980 wide the main and ⋯ buttons keep their room on every row; the Fix button shows without hovering.
12. rows: Fix… asks before changing anything; Cancel leaves the problem as it was.
13. rows: while the fix runs the line is busy and its button says Fixing…; the row's Stop is aria-disabled; the sidebar's Stop is disabled.
14. rows: after the fix the line says Fixed., green, with Done; Done puts the row back to normal.
15. rows: See why opens the container page.

Lines 8 to 15 describe Containers rows (WO-3.1 rebuilt them). They were in `check-doctor.mjs`. They stay in this script and run against `#/containers`. Port their selectors from how `check-home.mjs` (WO-3.1) addresses the same rows. If WO-3.1 already covers a line with the same message in its own script, keep it here too (a duplicate is allowed; a missing line is not).

`check-netfix.mjs` behaviours (all stay): the DNS finding is listed under Needs action with the words "can't look up names"; one button `Restart the VM…`; the page and the badge both count it; "Or run it yourself" shows `colima restart default` (now: in the `Show how` sheet); the confirm says what restarting does and keeps its button `Restart the VM`; Cancel changes nothing; the row says it is restarting; the result says names work again and everything is running again; Dismiss; a stuck DNS says it still fails; a VPN finding names the tunnel; a proxy finding appears only after a failed pull, is worth knowing, is not counted, shows the two lines to add to `colima.yaml` and no button; with no failed pull the proxy check passes; the default scenario has no network problem; every picture differs. The `shots` message (every picture differs) stays and takes pictures of the Doctor states.

New lines: `doctor: groups Needs action, Worth knowing, then folded Passed and Hidden by you`, `doctor: a finding row is two lines: title, then muted evidence`, `doctor: the button is primary when the app can fix it and its label ends with …`, `doctor: Show how opens a sheet with a command and Copy`, `doctor: Not an issue hides the finding and it appears in Hidden by you`, `doctor: Check again runs the checks and updates the time`, `doctor: with nothing wrong the page says Nothing needs action`, `doctor: the badge equals the number of Needs action rows`.

6. Mockup pairs: `doctor` at `/?scenario=design#/doctor`, mask `[".header .sub"]` with `why: "the Checked n seconds ago text is live"`. The `design` scenario must produce the five findings of the mockup (`kafka-ui can't reach Kafka`, `docker compose is missing`, `db keeps its data inside the container`, `3.4 GB of build cache can be freed`, `orders runs an amd64 image on your arm64 VM`) and counts `Passed · 14`, `Hidden by you · 1`. If the `design` scenario lacks any, add data to it (not to other scenarios). `problem-inspector` is compared by eye.

7. C6 with `src/Doctor.tsx`.

**Tests to write first**: add `src/Doctor.test.tsx`? Skip a render test (the page needs Resize and Setup providers). Instead add node tests for what you add to `src/lib/doctor.ts`:

```ts
// The button kind of a finding, from what it carries.
export type FixKind = "fix" | "show-how" | "go" | "why";
export function fixKind(f: { fixable: boolean; hasCommand: boolean; goTo?: string; hasWhy?: boolean }): FixKind {
  if (f.hasWhy) return "why";
  if (f.fixable) return "fix";
  if (f.goTo) return "go";
  return "show-how";
}
```
Cases: `Given a finding the app can fix, When fixKind runs, Then fix`; `Given a finding with a page to go to, Then go`; `Given a finding with only a command, Then show-how`; `Given a finding with an explanation, Then why`. Map the real finding fields to this input in `Doctor.tsx` (read the finding type). Then the `check(` lines, before the page.

**Done when**: the gate, plus:

```sh
node -e 'const l=require("./scripts/not-migrated.json");console.log(l.includes("src/Doctor.tsx"))'
```
Expected: `false`.

```sh
grep -nE '<button|<select|<table|style=' src/Doctor.tsx | wc -l
```
Expected: `0`.

```sh
ls scripts/checks-pending/check-doctor.mjs scripts/checks-pending/check-netfix.mjs 2>&1 | grep -c 'No such file'
```
Expected: `2`.

```sh
node scripts/check-messages-kept.mjs | grep -c 'ok check-doctor\|ok check-netfix'; for e in chromium webkit; do PW_ENGINE=$e node scripts/check-doctor.mjs | grep -c FAIL; PW_ENGINE=$e node scripts/check-netfix.mjs | grep -c FAIL; done
```
Expected: `2`, then `0` four times.

By eye, against `doctor-light.png` and `doctor-dark.png` (and `problem-inspector-light.png` for See why): two-line rows with a red or yellow icon; the title is dark and the evidence grey; the first group's buttons are blue and end with `…`; the yellow group's are default; the two folded lines at the bottom have a chevron; no command text shows on a row; the header has only `Check again` (plus `Fix all` when it applies).

**PR file title** (the title line of `docs/plan/iterations/pr/wo-<id>.md`): `wo-3.8a: Doctor page on the new design with one button per finding`

---

## WO-3.8b Fix and health pieces on the new components (task 3.8, part 2)

**Title**: The fix runner and the health pieces (`FixIt`, `Health`) use the new components, so Doctor and Containers show one look while a fix runs.

**Needs**: WO-3.8a.

**Why**: U13 and the lock rule. Doctor and Containers both show a running fix; today they show it with old markup.

**Read first**: `src/FixIt.tsx` (exports `useFixRuns`, `fixAction`, the default `FixIt`, `FixStatus`, `FixRuns`), `src/Health.tsx` (`HealthPanel`, `LimitActions`, `useServiceLimit`, `useOpenCompose`, `isListed`, `HealthBadge`, `ActivityList`), `src/lib/fixStore.ts`, `src/Health.test.tsx`, spec 6.4, 6.5, 6.10.

**Starting state**: C2 with `src/FixIt.tsx src/Health.tsx`. Then:

```sh
grep -rn "from \"./FixIt\"\|from \"./Health\"\|from './FixIt'\|from './Health'" src --include=*.tsx --include=*.ts | grep -v test
```
Expected: lines in `src/Doctor.tsx` and possibly `src/Containers.tsx`, `src/ContainerDetail.tsx`, `src/Shell.tsx`. Write down every importer and the names it imports. These names must still exist after this work order.

```sh
npm test 2>&1 | grep -E 'Health|FixIt' | head -5
```
Expected: the Health tests pass today. Record the count; it must not drop.

**Do not touch**: `fixStore.ts`, the exported names and their signatures, `fixAction`'s behaviour, `useServiceLimit`, `isListed`, the commands.

**Steps**:

1. In `src/FixIt.tsx`: replace each raw `<button className="small ...">` with `Button` (`size="xs"`; a primary fix button keeps variant primary), each status spinner with `Dot` `busy`, `Ticks` and `OutputLog` imports with `src/lib/ticks.tsx` and `useOutput` + `Canvas`. The running state of a fix is a `.subrow` under the row: `Dot busy`, the plain words, and the button reading `Fixing…` disabled. The finished state: `Sev ok`, `Fixed.`, a `Button` `Done`. A failed fix: `Sev bad`, the reason in plain words, `Try again`. Keep every string the old file shows; the old checks (WO-3.8a, WO-3.1) assert `Fixing…`, `Fixed.` and `Done`.
2. In `src/Health.tsx`: the same replacement. `HealthBadge` uses `Chip` or `Dot` per `src/ui/op`. `ActivityList` rows become `Row`s. `LimitActions` buttons become `Button size="xs"`. Keep logic and exports.
3. No new logic, so no new tests. Keep `src/Health.test.tsx` as it is. If a test queries an old class (`.small`, `.drawer`), change only the query to the new class or a role, and write each such change in the PR file. Never change an assertion's expected value.
4. C6 with `src/FixIt.tsx`, `src/Health.tsx`.

**Tests to write first**: none new. Run `npm test` before you start and after each file; the count of passing tests stays equal.

**Done when**: the gate, plus:

```sh
node -e 'const l=require("./scripts/not-migrated.json");console.log(["src/FixIt.tsx","src/Health.tsx"].filter(f=>l.includes(f)).length)'
```
Expected: `0`.

```sh
grep -nE '<button|<select|<table|style=|className="small' src/FixIt.tsx src/Health.tsx | wc -l
```
Expected: `0`.

```sh
grep -nE 'ui/Ticks|ui/OutputLog' src/FixIt.tsx src/Health.tsx | wc -l
```
Expected: `0`.

```sh
for e in chromium webkit; do PW_ENGINE=$e node scripts/check-doctor.mjs | grep -c FAIL; done
```
Expected: `0` and `0` (the fix lines of WO-3.8a still pass).

By eye: start a fix on the Doctor page (scenario `design`, click `Fix kafka and kafka-ui…`, confirm): the line under the row shows a blue dot and `Fixing…`, then a green tick and `Fixed.` with `Done`. Compare the tint and spacing with the problem lines in `containers-light.png`.

**PR file title** (the title line of `docs/plan/iterations/pr/wo-<id>.md`): `wo-3.8b: Fix runner and health pieces on the new components`

---

## WO-3.9 Settings: General, Machines, Engines, Updates, About (task 3.9)

**Title**: Settings has five sections, Profiles is called Machines everywhere, the theme is saved and applied before first paint, and the resize flow uses the new components.

**Needs**: WO-3.8a, WO-3.8b.

**Why**: U6 and U19 (a Profiles page that is a table with a modal; no theme; "Profiles" in the UI while the design says Machines).

**Read first**: spec 7.8, 6.2 (Field, Select, Switch), 6.7, 9; mockup `machines`; `src/Profiles.tsx`, `src/EditPanel.tsx`, `src/Resize.tsx` in full, `src/Resize.test.tsx`, `src/VmChange.test.tsx`, `src/lib/links.ts`, `index.html`, `src/api.ts` (`Profile`, `StartOpts`), `scripts/checks-pending/check-resize.mjs`, `vite.config.ts`, `tsconfig.json`.

**Starting state**: C2 with `src/Profiles.tsx src/Resize.tsx src/EditPanel.tsx`. Then:

```sh
grep -n 'settings:' src/lib/routes.ts
```
Expected: one line: `PAGE_TABS` lists `general`, `machines`, `engines`, `registries`, `updates`, `about` (WO-2.1). If absent, stop and report.

```sh
grep -n 'resolveJsonModule' tsconfig.json
```
Expected: one line with `true`. If absent, add `"resolveJsonModule": true` to `compilerOptions` (this is allowed in this work order) and say so.

```sh
grep -c 'data-theme' index.html src/ui/openpier.css
```
Expected: `0` for `index.html` and `2` or more for the CSS (the stylesheet defines `[data-theme]` rules). If the CSS has none, stop and report.

```sh
grep -rn 'colima-ui\.\|wharf:' src --include=*.ts --include=*.tsx | grep -v test | wc -l
grep -rn 'openpier:wayBack\|openpier:broughtOver' src --include=*.ts --include=*.tsx | grep -v test | wc -l
```
Expected: `0`, then `2` or more. WO-0.4 renamed the storage keys; this work order never renames a key. If the first prints more than `0`, stop and report the lines.

```sh
grep -n '<Profiles\|<EditPanel\|<ResizeProvider' src/*.tsx
```
Expected: mount sites. Keep the props that App passes to `<Profiles>`; the new Machines section takes the same.

```sh
grep -n 'setup_report' src/lib/setup.ts src/Setup.tsx | head -3
```
Expected: a line that invokes it. The Engines section uses the same call.

**Do not touch**: the Resize state store and every exported function name of `Resize.tsx`, the `apply_resources`, `start_profile`, `stop_profile`, `restart_profile`, `delete_profile` commands and their arguments, `askResize`, `useResize`, `ResizeProvider`.

**Steps**:

1. Version. Create `src/lib/version.ts`:

```ts
import pkg from "../../package.json";
export const APP_VERSION: string = pkg.version;
```
Test `src/lib/version.test.ts`? A node test cannot import JSON without flags; use vitest: `src/lib/version.test.tsx`: `Given package.json, When APP_VERSION is read, Then it equals the version in package.json and matches /^\d+\.\d+\.\d+/`.

2. Theme. Create `src/lib/theme.ts`:

```ts
export type Theme = "system" | "light" | "dark";
export const THEME_KEY = "openpier:theme";
export const readTheme = (s: Pick<Storage, "getItem">): Theme => {
  try {
    const v = s.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch { return "system"; }
};
export const resolveTheme = (t: Theme, prefersDark: boolean): "light" | "dark" => (t === "system" ? (prefersDark ? "dark" : "light") : t);
export function saveTheme(s: Pick<Storage, "setItem" | "removeItem">, t: Theme) {
  try { if (t === "system") s.removeItem(THEME_KEY); else s.setItem(THEME_KEY, t); } catch { /* storage is off: the choice lasts until the page closes */ }
}
export function applyTheme(t: Theme, root: HTMLElement, prefersDark: boolean) { root.dataset.theme = resolveTheme(t, prefersDark); }
```
Tests, `src/lib/theme.test.ts` (node): `Given nothing saved, When readTheme runs, Then system`; `Given dark saved, Then dark`; `Given junk saved, Then system`; `Given system and a dark Mac, When resolveTheme runs, Then dark`; `Given light and a dark Mac, Then light`; `Given system chosen, When saveTheme runs, Then the key is removed`; `Given a storage that throws, When readTheme runs, Then system and no throw`.

In `index.html`, inside `<head>` before any stylesheet or module script, add:

```html
<script>
  (function () {
    var root = document.documentElement;
    var query = window.matchMedia("(prefers-color-scheme: dark)");
    function saved() { try { var v = localStorage.getItem("openpier:theme"); return v === "light" || v === "dark" ? v : "system"; } catch (e) { return "system"; } }
    function apply() { var t = saved(); root.setAttribute("data-theme", t === "system" ? (query.matches ? "dark" : "light") : t); }
    apply();
    query.addEventListener("change", apply);
    window.addEventListener("storage", apply);
  })();
</script>
```
The Theme setting calls `saveTheme` and `applyTheme` at once (no reload).

3. Settings shell. Create `src/Settings.tsx`: the `Header` with title `Settings` and no summary; `<div className="content"><div className="settings">`; a `<nav className="nav" aria-label="Settings sections">` with five `NavItem`s (`General`, `Machines`, `Engines`, `Updates`, `About`; each `<NavItem href="#/settings/<lowercase>" label=... current={route.tab === "<lowercase>"} />`; `NavItem` sets `aria-current="page"` and `go()` runs from the router's link handling); on the right the section. The section comes from `const { route } = useRoute()`: `route.tab` (`general` is the default; WO-2.1 defines the tabs `general, machines, engines, registries, updates, about`; `registries` is built in iteration 6 and has no nav item here). Delete the shared `<Header ... />` line of `src/App.tsx` for this tab, change `tabOfRoute` so the settings route no longer maps to the `Profiles` tab (it renders `Settings`), and have the engine switcher's `Machines…` and the meters button (both go to `#/settings/machines`) keep working. `Machines` is shown only when Colima is installed (read how App decides this today, it passes `profiles` to Profiles). Section files in `src/settings/`: `General.tsx`, `Machines.tsx`, `Engines.tsx`, `Updates.tsx`, `About.tsx`. Mount `Settings` where `Profiles` was mounted (the Settings route from WO-2.1).

4. General (`src/settings/General.tsx`): one `.setting` row: `.t` `Theme`, a `Select` with `System`, `Light`, `Dark` (value from `readTheme(localStorage)`), on change `saveTheme` and `applyTheme`. Spec also lists `Start OpenPier at login` and `Check for updates automatically`. They are not built here: they need the autostart plugin (task 8.12) and the updater (task 6.2). The PR file lists them under "Not done or changed".

5. Machines (`src/settings/Machines.tsx`, from `Profiles.tsx`; `git mv src/Profiles.tsx src/settings/Machines.tsx` then edit). Tree (from `machines` in the mockup):

```
<div className="toolbar"><span className="muted grow">Colima VMs on this Mac. Each has its own containers, images and volumes.</span><Button variant="primary" icon="plus">New machine</Button></div>
<div className="list"> one Row per machine: Dot (ok running, none stopped, busy while starting or stopping), name, facts in .meta.grow ("4 CPU · 8 GB memory · 60 GB disk · Kubernetes"), state in .col.state ("Running", "Stopped", "Starting…", "Stopping…"), .act with Button "Stop" or "Start", ⋯ menu: Restart, Edit folders, Delete… </div>
<GroupCaption> {selected machine name} </GroupCaption>
.setting rows: CPU, Memory, Disk, Kubernetes, Shared folders
```
Selecting a row selects the machine (the first running one by default). Setting rows (words from the mockup and spec):

1. `CPU`, description `Your Mac has {n}. Changing it restarts the VM.`, a number `Field`.
2. `Memory`, description `Your Mac has {n} GB. Containers used {x} GB at most today.` Keep this only if the old code has a "most today" number (the old Resize rows used a measured peak); if not, use `Your Mac has {n} GB. Changing it restarts the VM.`. A `Field` with `{n} GB`.
3. `Disk`, description `Changing it restarts the VM. A disk can grow but not shrink.` (use the old EditPanel's words if they differ and list the difference in the PR file).
4. `Kubernetes`, a `Switch`, description `Runs a small cluster (K3s) inside the VM.` Turning it on or off asks first and says the VM restarts (old behaviour of `Turn on Kubernetes`).
5. `Shared folders`: the old Edit folders action. A row with the text and a `Button` `Edit folders` that opens the old editor as it works today (find it in `Profiles.tsx`: keep its sheet, changing only its markup).

CPU, Memory and Disk apply with a `Button` `Apply and restart…` shown while any of the three differ from the machine's value. It opens a confirm and runs the same call `EditPanel.tsx` made on apply (find `apply_resources` in it; move that call, unchanged, into `src/settings/applyResources.ts` with the same arguments). `src/EditPanel.tsx` is then deleted (`git rm`; its entry leaves the list).

`New machine` opens a `Sheet` with the fields of the old New profile dialog: name, CPUs, memory, disk, runtime, Kubernetes switch, and buttons `Cancel` and `Create`. The runtime field keeps its old options (their values do not change) but its words are new, because spec 9 bans "runtime" in the UI: label `Container tool`, options shown as `Docker` and `containerd`, hint `Docker works with everything. Pick containerd only if you know you need it.` The create call is the old one.

Every user-visible string that says Profile or Profiles becomes Machine or Machines (including `Delete…`'s confirm, toasts, errors and empty states). Internal identifiers (`Profile`, `useProfiles`, `onProfiles`) stay.

6. Engines (`src/settings/Engines.tsx`): a `.list` of every Docker context from `setup_report` (`contexts: [{name, current}]`): `Dot` (ok for the current one), name in `.name`, a `Chip` `Current` for the current one. Then the hint `To add an engine, run docker context create.` with the command in the mono font. Spec 7.8 also shows runtime, address and whether it answers. Those come from `list_engines` (task 4.1): not built here, and the PR file lists it under "Not done or changed". When no context is found, an `Empty` with title `No engines found`.

7. Updates (`src/settings/Updates.tsx`): one `.setting` row: `.t` `Version`, `.d` `OpenPier {APP_VERSION}`. Check now and the release notes arrive with task 6.2 (WO-6.2a adds the button and its check line). Not drawn here.

8. About (`src/settings/About.tsx`): `.setting` rows `Version` (`{APP_VERSION}`), `License` (`MIT`), and three link rows `Repository` (`REPO_URL`), `Changelog` (`${REPO_URL}/blob/main/CHANGELOG.md`), `Discussions` (`${REPO_URL}/discussions`), each with a `Button` (default, xs) `Open` that calls `openUrl` from `src/api.ts`. The Changelog link goes to the releases page.

9. Resize on the new components (`src/Resize.tsx`). Markup only. Every exported name and signature stays (`ResizeProvider`, `useResize`, `askResize`, `ResizeButton`, `VmChangeButton`, `ResizeOr`, `ResizeStatus`, `ResultRow`, `ResizeAnnouncer`, `useHeld`, `afterDismiss`, `REACHABLE`). Replace: raw `<button className="small">` with `Button` (xs; primary only where the old button was the page's one green button); result rows with `.subrow` (`Sev ok` or `Sev bad`, the text, buttons on the right edge, `Dismiss` last); the running spinner with `Dot busy`; folded Colima output with `Canvas` and `useOutput`; `Ticks` with `src/lib/ticks.tsx`. Keep every string. `src/Resize.test.tsx` and `src/VmChange.test.tsx` keep their expectations; change only a query that used an old class (`.app-name` stays if Containers rows still have it; if WO-3.1 renamed it, use the new class) and list each change.

9b. `src/VmStrip.tsx` (WO-3.1c left it on the list, "VmStrip not migrated (WO-3.9)"). It shows a machine start or stop in progress and its failure above the Containers list. Re-skin it, logic unchanged: `Banner` (`tone="bad"` for a failure, `info` while it runs) with `Button`s for its actions (`Try starting again`, `Force stop`, as today), `Dot busy` while running, the log in a `Canvas` fed by `useOutput`. Keep every string. The lines of `check-containers.mjs` for the starting, failed, stuck and stopfail scenarios must still pass. Remove `src/VmStrip.tsx` from the list.
10. Check. Port `check-resize.mjs` (C3). It is 555 lines and about 150 behaviours (the baseline file lists each one, because the tool made it from the old script). The groups, so the PR file can tick them: the Doctor size row and its confirm; the running state (spinner, status line, folded output, locked buttons, sidebar says restarting); the other-tab strip; the starting state (rows say Restarting…, buttons locked, focus kept); the done state (one line, everything runs again, containers start in waves, no toast); dismiss and focus; start fails (one line, Start web, See why, Dismiss); resize fails (step down, start as it was); pods (Kubernetes brings them back); out of memory (Give the VM 8 GiB…); out of memory fails (12 GiB offered); the limit lines (Open compose.yaml, Open in TextEdit, Show in Finder, Apply and start, the refusal); and `shots`. The routes it uses are `#/doctor` and `#/containers`. Map selectors by C3. `check-k8s`'s Kubernetes switch lines that were parked by WO-3.7 return here: the script no longer has `check-k8s` entries in `dropped-checks.json`.

New lines for Settings in `scripts/check-settings.mjs` (new file):

1. `settings: five sections General, Machines, Engines, Updates, About in that order`.
2. `settings: the route changes with the section` (`#/settings/machines`).
3. `settings: Machines lists default and work with Start or Stop`.
4. `settings: a machine's CPU row says Your Mac has 10. Changing it restarts the VM.`.
5. `settings: changing CPU shows Apply and restart…, and it asks first`.
6. `settings: no word Profile or Profiles on any Settings section` (text scan of all five).
7. `settings: New machine opens a sheet with name, CPU, memory, disk and Create`.
8. `settings: Engines lists the contexts and marks the current one`.
9. `settings: Updates shows the version`.
10. `settings: About shows License, MIT and three links`.
11. `settings: theme choice dark sets data-theme to dark at once and survives a reload` (`localStorage["openpier:theme"] === "dark"`).
12. `settings: with colorScheme dark and nothing saved, data-theme is dark before the app mounts`: open a page with `open("/?scenario=design#/containers", { colorScheme: "dark" })` (`open` takes that option) and read `document.documentElement.dataset.theme` at `DOMContentLoaded`.
13. `settings: Machines hides when Colima is not installed` (scenario `nobrew`, name taken from the old mock flags; read `preview/mock.ts`).

11. Mockup pair: `settings-machines` at `/?scenario=design#/settings/machines`, `threshold: 0.005`. The `design` scenario (WO-1.5) has one machine: the profile `default` (4 CPU, 8 GB, 60 GB, Kubernetes on), as in the mockup. Add a second one, `work` (stopped, 2 CPU, 4 GB, 40 GB), to the `design` scenario and re-run the Containers pair: it must still pass (the engine switcher popover is closed in that picture). The names and facts of both rows are then the mockup's, so do not mask them. No other mask: the mockup has no `Start when I log in` row any more.

12. C6 with `src/Profiles.tsx` (moved: the entry goes), `src/Resize.tsx`, `src/EditPanel.tsx` (deleted), `src/VmStrip.tsx`.

**Tests to write first**: `theme.test.ts` (step 2) and `version.test.tsx` (step 1); then `scripts/check-settings.mjs` lines, before the screen: they fail.

**Done when**: the gate, plus:

```sh
node -e 'const l=require("./scripts/not-migrated.json");console.log(["src/Profiles.tsx","src/Resize.tsx","src/EditPanel.tsx","src/VmStrip.tsx"].filter(f=>l.includes(f)).length)'
```
Expected: `0`.

```sh
test ! -e src/Profiles.tsx && test ! -e src/EditPanel.tsx && echo gone
```
Expected: `gone`.

```sh
grep -c 'data-theme' index.html
```
Expected: `1` or more.

```sh
grep -rnE '"[^"]*\bProfiles?\b[^"]*"|>[^<{]*\bProfiles?\b[^<]*<' src --include=*.tsx | grep -v 'import\|from "\|test\.' | wc -l
```
Expected: `0` (no user-visible Profile or Profiles left).

```sh
grep -rn 'colima-ui\.\|wharf:' src --include=*.ts --include=*.tsx | grep -v 'test\.' | wc -l
```
Expected: `0` (WO-0.4 renamed every key; this work order adds no key with the old prefix).

```sh
grep -nE '<button|<select|<table|style=' src/Resize.tsx src/Settings.tsx src/settings/*.tsx | wc -l
```
Expected: `0`.

```sh
node scripts/check-messages-kept.mjs | grep -c 'ok check-resize'; for e in chromium webkit; do PW_ENGINE=$e node scripts/check-resize.mjs | grep -c FAIL; PW_ENGINE=$e node scripts/check-settings.mjs | grep -c FAIL; PW_ENGINE=$e node scripts/check-k8s.mjs | grep -c FAIL; done
```
Expected: `1`, then `0` six times.

By eye, against `settings-machines-light.png` and `-dark.png`: a left list of five sections with Machines selected; a grey line and a blue `New machine` on the right; two machine rows with a green and a grey dot, facts in grey, `Stop` and `Start` buttons (the first row's name and facts are `colima`, not `default`); a machine name caption, then CPU, Memory, Disk, Kubernetes and Shared folders rows with the title on the left and a small field on the right (no `Start when I log in` row); the theme: set Dark in General and the whole app turns dark with no flash after a reload.

**PR file title** (the title line of `docs/plan/iterations/pr/wo-<id>.md`): `wo-3.9: Settings with Machines, theme and About, and the resize flow on the new components`

---

## WO-3.10 Setup: the first run (task 3.10)

**Title**: A first-run Setup screen in the mockup's centred column installs everything with one button, or opens the engine already installed.

**Needs**: WO-3.9, WO-3.4 (`useOutput`, `Ticks`).

**Why**: Task 3.10 (a first run that matches the new design). The logic (`useSetup`, `useSetupActions`) is good and stays.

**Read first**: spec 7.9, 6.9; mockup `step`, `setup`; `src/Setup.tsx` in full (`useSetup(profile)`, `useSetupActions(...)` with `row`, `fixAll`, `log`, `quick`, `quickAll`, `planText`, `broughtOver`/`markBroughtOver`, the `STEP` map, `doneLine`), `src/InstallCard.tsx` (`BOOTSTRAP`, `open_homebrew_install`), `src/InstallTool.tsx`, `src/lib/setup.ts`, `scripts/checks-pending/check-setup.mjs`.

**Starting state**: C2 with `src/Setup.tsx src/InstallCard.tsx src/InstallTool.tsx`. Then:

```sh
grep -c 'app\.bare\|\.center' src/ui/openpier.css
```
Expected: `2` or more (`.app.bare` and `.center` are in openpier.css). Fewer: stop and report which is missing.

```sh
grep -n 'openpier:broughtOver' src/Setup.tsx; grep -n 'colima-ui\.' src/Setup.tsx | wc -l
```
Expected: one line with `openpier:broughtOver`, then `0` (WO-0.4 renamed the key). Anything else: stop and report.

```sh
grep -n '"setup"' src/lib/routes.ts src/lib/*.ts | head -5; grep -rn 'InstallCard' src --include=*.tsx | grep -v test | head
```
Expected: the page `"setup"` is in the route table (WO-2.1), and `InstallCard` is used by the Containers states for the scenarios `missing`, `partial`, `nobrew` and `none` (WO-3.1c keeps them "unchanged until WO-3.10"). Write down every file and branch that renders `InstallCard` or the start-first-machine card. If a branch is not where you expect, stop and report.

```sh
grep -n "scenario === \"missing\"\|\"missing\"\|\"nobrew\"" preview/mock.ts | head -4
```
Expected: scenarios for missing tools and for no Homebrew. Names are used below; if different, use the real ones.

**Do not touch**: `useSetup`, `useSetupActions` logic and their commands (`brew install ...`, the Colima start), the `BOOTSTRAP` command text, `open_homebrew_install`.

**Steps**:

1. `src/Setup.tsx` markup (from `setup` and `step`):

```
<div className="app bare"><main className="main"><div className="content"><div className="center">
  <h1>Set up containers on this Mac</h1>
  <p className="lede">OpenPier needs an engine to run containers. It can install Colima for you, or use one you already have.</p>
  <div className="list"> four step rows </div>
  <div> <Button size="md" variant="primary">Install and start</Button> <Button size="md" variant="ghost">Use Docker Desktop instead</Button> </div>
  <p className="hint">Every command it runs is listed in Activity. Nothing needs your password except Homebrew's own installer.</p>
</div></div></main></div>
```
Routing: `#/setup` is a route (`PLAIN` page in `src/lib/routes.ts`) that `tabOfRoute` maps to Containers until now. `src/App.tsx` renders `<Setup />` alone, with no `<Shell>`, when `route.page === "setup"`. Each Containers branch that rendered `InstallCard` or the start-first-machine card now calls `replace("#/setup")` (from `src/lib/router.ts`) instead, so the user lands on Setup. When the setup report shows an engine that answers, Setup calls `replace("#/containers")`. Delete the old branches and the `InstallCard` use from Containers (WO-3.1b/c left them for this work order).

Steps, in this order, with titles and lines: `Homebrew` (`Found at /opt/homebrew.` when found), `Colima` (`Installing… about a minute.` while it runs), `Docker command line tools` (`docker, Compose and Buildx.`), `Start the first machine` (`4 CPU · 8 GB · 60 GB. You can change it later.`). Each step row is `<Row tall>`: its state icon (`Sev ok` done, `Dot busy` while running, `Dot` to do), title in `.name`, line in `.meta`, and at the right, while it runs, `Button` `Show output` (xs, ghost) that unfolds a `Canvas` with `useOutput(["brew-progress", "colima-progress"])` lines. `Install and start` runs the steps in order (the old `quickAll`), is `aria-busy` while running. If Homebrew is missing, the first step's button is `Open Terminal to install Homebrew` (`open_homebrew_install`). The ghost button is `Use Docker Desktop instead` (or the name of whichever installed engine is stopped: `OrbStack` etc., from `setup_report` contexts as today); it opens that app and waits for its context to answer. When an engine answers, Setup closes by itself and Containers opens (the existing behaviour at the mount site).

The old `Setup.tsx` also had the fix list ("Fix all", Testcontainers, Docker Desktop leftovers, Bring over). Spec 7.9 item 6: those are Doctor findings after Setup, not part of Setup. Check that WO-3.8a shows them there: `grep -n 'broughtOver\|markBroughtOver' src/Doctor.tsx`. Expected: lines. Keep `useSetupActions` and export it unchanged so Doctor still works. `Setup.tsx` keeps exporting `useSetup` and `useSetupActions` (Doctor imports them); only the default component's markup is the screen above.

2. `src/InstallCard.tsx` and `src/InstallTool.tsx`: replace raw buttons with `Button`, `OutputLog` with `Canvas` and `useOutput`, `Ticks` with `src/lib/ticks.tsx`. The Kubernetes screen (WO-3.7) and others use `InstallTool`; keep its props. Keep the strings.

3. Check. Port `check-setup.mjs` (C3). Also move into it the lines that WO-3.1c left in `scripts/check-containers.mjs` for the scenarios `missing`, `partial`, `nobrew` and `none` (find them with `grep -n "missing\|partial\|nobrew\|none" scripts/check-containers.mjs`; they are the old `check-home` lines 43 and 44: the install card with the exact brew command, only what is missing, the bootstrap command with copy and no one-click install, the start-first-machine state with `Start Colima (6 CPUs, 8 GiB)` and `Customize first`). Their selectors now address the Setup screen; delete them from `check-containers.mjs` and list each deleted message in `scripts/dropped-checks.json` under `check-containers` with the reason `moved to check-setup.mjs`. Important: it tests two things in one script. Setup of the first run (`missing`, `nobrew`) and the Doctor's setup findings for a Docker Desktop leftover (`desktop`, `mismatch`, `healthy`). Both stay. The Doctor lines run against `#/doctor`. Old behaviours (all stay):

1. missing: Setup asks for the tools instead of showing green.
2. healthy: no terminal note and no strip on home; every check passes; no setup row outside Passed.
3. desktop: the Doctor badge counts the setup problems; home has no VM row and no terminal note; the page summary equals the badge's count; failures sorted first; commands sit in collapsed details until asked for (now: behind `Show how`); the exact command shows before fixing; command boxes hold no English like "(a backup is kept)"; config edits show as steps above the box; passing checks are collapsed and hidden until expanded; one row says how many pass; Testcontainers is fixed by the app, nothing to copy; file names and settings are in the code font.
4. desktop: one Fix all; it asks first and names every file it backs up; the confirm lists what each step does; its Fix them button is the normal green button, not the red one; Cancel changes nothing; every failure clears after its fix; Fix all also points Testcontainers at Colima; after Fix all one line says it worked and the one thing left to do; where each backup went is behind Details, with ~ for the home folder; Fix all leaves the start-at-login info row alone and start at login stayed off; the only warning left is the VM size; Fix all goes away when nothing is left to fix; the badge and the summary still agree; no horizontal scroll at 980x640; home still says nothing about the terminal.
5. mismatch: home has no VM row note about the other context; Doctor names the other context; the problem and the badge go away after switching context.

New lines in the same file: `setup: the screen is one centred column with the title Set up containers on this Mac`, `setup: four steps in the order Homebrew, Colima, Docker command line tools, Start the first machine`, `setup: one primary button Install and start and one ghost button Use Docker Desktop instead`, `setup: with no Homebrew the first step offers Open Terminal to install Homebrew`, `setup: Show output opens a canvas while a step runs`, `setup: when an engine answers Setup closes and Containers opens` (scenario that starts as missing and flips to running when the install finishes; read `preview/mock.ts` for the `start`/`setup` flags and use the one the old script used), `setup: the sidebar is not shown`.

4. Mockup pair: `{ "mockup": "setup", "path": "/?scenario=missing#/setup", "themes": ["light","dark"], "threshold": 0.005, "mask": [], "why": "" }`. The mockup shows step 2 running (`Installing…`). The static scenario shows the first state (nothing running). Not verified: that this passes at 0.005. Define the scenario `setup-installing` here, once (iteration 7 uses it): in `preview/mock.ts`, a mocked setup stopped at "Colima installing" (Homebrew found, Colima busy, the rest to do). Use it as the pair's path. If the install animation cannot be frozen, mask `.list` with `why: "the install steps animate"` and say so.

5. C6 with `src/Setup.tsx`, `src/InstallCard.tsx`, `src/InstallTool.tsx`.

**Tests to write first**: the `check(` lines (step 3) fail on the old screen first. There is no unit test: this work order changes markup and routing only.

**Done when**: the gate, plus:

```sh
node -e 'const l=require("./scripts/not-migrated.json");console.log(["src/Setup.tsx","src/InstallCard.tsx","src/InstallTool.tsx"].filter(f=>l.includes(f)).length)'
```
Expected: `0`.

```sh
grep -rn 'colima-ui\.\|wharf:' src --include=*.ts --include=*.tsx | grep -v 'test\.' | wc -l
```
Expected: `0`.

```sh
grep -nE '<button|<select|<table|style=' src/Setup.tsx src/InstallCard.tsx src/InstallTool.tsx | wc -l
```
Expected: `0`.

```sh
node scripts/check-messages-kept.mjs | grep -c 'ok check-setup'; for e in chromium webkit; do PW_ENGINE=$e node scripts/check-setup.mjs | grep -c FAIL; done
```
Expected: `1`, `0`, `0`.

By eye, against `setup-light.png` and `-dark.png`: no sidebar; one 520 px column; four steps with a green tick, a blue dot, and two grey dots (when frozen as in the mockup); a blue `Install and start`; a ghost `Use Docker Desktop instead`; a small muted hint underneath.

**PR file title** (the title line of `docs/plan/iterations/pr/wo-<id>.md`): `wo-3.10: First-run Setup on the new design`

---

## WO-3.11 Bring volumes over from Docker Desktop (task 3.11)

**Title**: Bringing volumes over from Docker Desktop is a sheet opened from a Doctor finding, on the new components, with the same copy flow.

**Needs**: WO-3.8a, WO-3.8b, WO-3.9, WO-3.10.

**Why**: Task 3.11. Only the look and the entry point change. Do not redesign the copy flow.

**Read first**: `src/BringOver.tsx` in full, `src/BringOver.test.tsx`, `src/lib/bringOver.ts`, `src/bringBusy.ts`, spec 7.7 item 6 and 7.9 item 6, spec 6.7 (Sheet); `scripts/checks-pending/check-bring.mjs`, `check-bring-home.mjs`, `check-replace.mjs`, `check-a11y.mjs`.

**Starting state**: C2 with `src/BringOver.tsx`. Then:

```sh
grep -n 'desktop_state\|desktop_docker\|desktop_copy\|desktop_replace\|desktop_start\|desktop_copy_stop\|desktop-progress\|desktop-step' src/BringOver.tsx | wc -l
```
Expected: `8` or more (the flow's commands and events). Fewer: stop and report.

```sh
grep -n 'BringOver' src/*.tsx | grep -v 'test\|^src/BringOver.tsx'
```
Expected: the mount sites (App and Doctor passed `{ctx, only?, forVm?, onClose, onDone, onProfiles}`). Write them down. After WO-3.8a, Doctor owns the entry (`onBring`).

```sh
npm test 2>&1 | grep -c 'BringOver'
```
Expected: `1` or more (the test file runs). Record the count of passing tests in it. The new total must not be lower.

**Do not touch**: the flow (`desktop_*` commands, events, the order of steps, the stop and start of containers, the backup naming), `src/BringOver.test.tsx` assertions (the button names `/^Bring 1 volume over/` and `/and bring over$/` stay the same), `bringBusy` and the lock.

**Steps**:

1. `src/BringOver.tsx`: Drawer becomes `Sheet`. Title and body text stay as they are. Replace raw buttons with `Button` (the footer's main button is the one primary button; `Stop` replaces it while running; `Done` when nothing is left). Replace the copy progress bar, tick boxes, notes and the result lines with the `src/ui/op` equivalents: the item list is a `.list` of `Row`s, each with a `<Checkbox checked onChange disabled>` as its lead (the checkbox's text is the item's name; a volume Colima already has is `disabled`), its size in `<Col kind="size" mono>`, notes in the meta; the bar under the item being copied is `<Progress value={bytes} max={total} aria-label=... />` (`value={null}` while the size is not known yet). The failure and result lines are `.subrow`s with `Sev`; `Show output` is a folded `Canvas` using `useOutput(["desktop-progress", "desktop-step"])` (keep the event names the old file listens to; read them). Keep every string and every `aria-*` attribute: the checks (`check-bring`, `check-replace`, `check-a11y`) assert them.

2. Entry point. Bring over is built once, here, and is offered only as a Doctor finding (spec 7.7 and 7.9): `Bring your volumes over` with the button `Bring it over…` (WO-3.8a made the row; this step makes sure the row opens this sheet through `onBring`). WO-3.1b and WO-3.1c did not add it to the Containers empty state or the `New` menu, so there is nothing to remove. Check that nothing else offers it:

```sh
grep -rn 'Bring over' src --include=*.tsx | grep -v 'BringOver.tsx\|test\.' | wc -l
```
Expected: `0` or only lines in `src/Doctor.tsx`. Any other file: remove that entry, list the file in the PR file. `check-bring-home.mjs` has been waiting in `scripts/checks-pending/` for this work order; its lines about the empty state and the New menu change here (see step 3).

3. Checks. Port four scripts by C3: `check-bring.mjs`, `check-bring-home.mjs`, `check-replace.mjs`, `check-a11y.mjs` (a11y covers the sheet, the Kubernetes nav item and the project chevron: its last three groups are about the sheet (aria-modal, focus inside, Tab stays inside, Escape closes, focus returns), so use the new `.sheet`). Their baselines are made by the tool, so every old line is listed there. The groups of behaviours, so the PR file can tick them:

   `check-bring.mjs` (24 lines): the Doctor row has nothing to copy; the panel lists named volumes then images, nothing untagged; says it left the unnamed volume out; a volume Colima already has cannot be picked; volumes are picked and images are not; the button says what and how much; picking an image updates the button; a volume a running container writes to says it will be stopped first; it asks before stopping the container in Docker Desktop; one bar under the item being copied; Stop is offered and Close waits; focus stays on the button, now Stop; short lines say what moved; a finished volume reads Copied with a tick; with nothing left the button is Done; focus is on Done, described by the result line; one click starts the stopped container; after a copy the Doctor row moves to Passed; stop says the rest was stopped; a failure says what to do and the others still copied and is announced; after a full disk Profiles (now Machines) is the main button and the retry says it is one; Docker Desktop closed says so and, once opened, the list shows up on its own; data gone says the data is still there, how big, and how to get it back.

   `check-replace.mjs` (about 45 lines): a fresh Colima copy is picked by default; the checkbox name says it replaces; the size column says what comes and what goes; the backup sentence describes the checkbox; the footer says Colima's copy is backed up first; the button counts it; the VM size button works before, waits during and works after a replace; the confirm puts each side on its own line, names the backup, and keeps names in the code font; Colima's container is stopped while its volume is replaced and runs again after; steps say backing up, then bytes and a bar, then starting again; the result counts the replaced volume and says what is stopped; names never break; the backup is marked in Volumes; a 90 MB copy is listed but not picked, and ticked says what it replaces; a failure leads with the safe fact, says what was not reached, folds Docker's text, announces itself, restores Colima's container, keeps the pick, names both in the retry, says what to do on a write error and makes the retry the main button; every Remove on Volumes waits during a replace, and the bulk remove waits and says why (now: `Remove unused…` waits).

   `check-a11y.mjs` (7 lines): no Kubernetes nav item with Kubernetes off; the project chevron is hidden from assistive tech and out of the tab order (Projects are parked: this line keeps its message but its condition now looks at the chevron of the `Passed · n` fold in Doctor; add the reason to `dropped-checks.json` as "projects deleted in iteration 1: chevron of the Passed fold"); the sheet has `aria-modal`, focus moves inside on open, Tab never leaves it, Escape closes it, focus returns to the opener.

   `check-bring-home.mjs` (about 80 lines): the "home" lines. They assert things on the Containers empty state, the New menu and the shop row's problem line. After step 2:
   1. The lines about the empty state and the New menu (`empty: ...`, `after: nothing is left to bring, so the offer and the menu item are gone`, `no Docker Desktop: the empty state and New are unchanged`) change their condition: the entry is NOT there (`no Bring over button on the empty state`, `no Bring over item in New`), as WO-3.1 left it. Keep each message. Put each in `dropped-checks.json` ONLY IF the message text itself names the removed entry; otherwise keep the message and flip the condition. Write each case in the PR file.
   2. The lines about the nearly-empty-volume problem under the shop row (`morning: ...`) and the Doctor row (`Doctor: ...`) stay. Containers still shows that problem line (it is a container problem), and its button opens this sheet.
   3. The lines about the sheet (`stale:`, `late:`, `both:`, `alone:`, `bind:`, `later:`, `partial:`, `flag:`) stay as they are.
   4. `shots: every state's picture is different` stays.

   If a line cannot be kept and is not covered by 1 to 4, stop and report with its message. The author reads `dropped-checks.json` in the acceptance step.

4. Mockup: there is no mockup screen for the Bring over sheet. The sheet is compared by eye with `run-sheet-light.png` for the sheet frame (head, body, foot) and `confirm-dialog-light.png` for the confirm. No pair row.

5. C6 with `src/BringOver.tsx`. Then confirm the end-of-iteration state in step 6.

6. The end of the iteration. `scripts/checks-pending/` must hold no `check-*.mjs`:

```sh
ls scripts/checks-pending/check-*.mjs 2>/dev/null | wc -l
```
Expected: `0`. Delete `scripts/checks-pending/README.md` only if every row of its table was brought back (it should be empty of rows after the ports of iterations 2 and 3). If a row for another iteration is still there, leave the file and say which.

**Tests to write first**: none new for the flow. Run `npm test`: the `BringOver` tests pass before you start and after each edit, with the same count. The ported scripts' `check(` lines are changed first (see step 3), then the markup.

**Done when**: the gate, plus:

```sh
node -e 'const l=require("./scripts/not-migrated.json");console.log(l.includes("src/BringOver.tsx"))'
```
Expected: `false`.

```sh
grep -nE '<button|<select|<table|style=|Drawer' src/BringOver.tsx | wc -l
```
Expected: `0`.

```sh
grep -rn 'Bring over from Docker Desktop' src --include=*.tsx | grep -v 'test\.' | wc -l
```
Expected: `0`.

```sh
ls scripts/checks-pending/check-*.mjs 2>/dev/null | wc -l
```
Expected: `0`.

```sh
node scripts/check-messages-kept.mjs | grep -c '^FAIL'; for e in chromium webkit; do for s in check-bring check-bring-home check-replace check-a11y; do PW_ENGINE=$e node scripts/$s.mjs | grep -c FAIL; done; done
```
Expected: `0`, then `0` eight times.

By eye, against `run-sheet-light.png` (frame) and `confirm-dialog-light.png` (the confirm that asks to stop and replace): a right-hand sheet with a head, a body list of volumes with sizes and a foot with one blue button; nothing else on the page changes while it is open; no entry for Bring over on the empty Containers page.

**PR file title** (the title line of `docs/plan/iterations/pr/wo-<id>.md`): `wo-3.11: Bring volumes over as a sheet opened from Doctor`
