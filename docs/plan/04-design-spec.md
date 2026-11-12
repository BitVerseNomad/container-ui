# Design spec

This is the design for OpenPier 1.0. It is written so that someone who has never seen the app can build it exactly.

## 0. How to use this spec

There are three sources, in this order of authority:

1. **`design/openpier.css`** is the design. Every colour, size, radius and shadow lives there and nowhere else. The app ships this file unchanged as `src/ui/openpier.css`.
2. **`design/mockup.html`** shows every screen built with that stylesheet. Open it in a browser, pick a screen, toggle dark. `design/shots/` has a WebKit screenshot of each screen in light and dark (`node docs/plan/design/shoot.mjs` regenerates them).
3. **This file** says what the mockup cannot show: behaviour, rules, states, words, keyboard.

If the built app and the mockup differ, the app is wrong. If you think the mockup is wrong, change the CSS and the mockup first, in their own PR, then the app.

Rules for the implementer:

1. Never write a colour, a pixel size or a shadow in a component. Use a class from `openpier.css`. If the class you need does not exist, stop and add it to the CSS and the mockup first.
2. No inline `style` except for a width that depends on data (a meter, a column the spec sizes per screen).
3. No Tailwind utilities, no CSS modules, no second stylesheet. One file.
4. Behaviour primitives (focus trap, menus, dialogs, select, tooltip) come from Radix, unstyled, with `className` set to the classes below.
5. Icons come from `lucide-react` only, at 16px (`.icon`) or 14px (`.icon.sm`), stroke 1.5. Delete `src/ui/icons.tsx`.

## 1. Principles

Taken from OpenChamber's own design notes, kept where they fit a container manager, with one deliberate exception (1.6).

1. **Controls stand up, layout lies flat.** Anything you can press has a hairline edge and a short shadow. Everything else has no border and no box. Regions differ by a small step in tone.
2. **Quiet at rest.** A row shows its name, its state and one action. The rest is in the ⋯ menu. Row buttons are a hairline outline until the row is hovered or focused.
3. **Colour means state.** Green is healthy, amber needs a look, red is broken, blue is busy. The accent (burnt orange) marks the one thing to do next. Nothing else is coloured.
4. **One line per thing.** A row is one line. Facts are joined with " · ". Long values truncate and show in full in a tooltip.
5. **Nothing moves when you touch it.** Hover and selection never change a size. Columns have fixed widths. A slot that may hold a status is reserved even when empty.
6. **Keyboard focus is always visible.** OpenChamber removes focus rings; this app does not. Every focusable thing shows a 2px accent ring on `:focus-visible` (keyboard only). This is rule 8 of `AGENTS.md`.
7. **Plain words.** Rules 3 and 5 of `AGENTS.md`. Section 9 has the word list.

## 2. Reference

1. Reference app: OpenChamber, `github.com/openchamber/openchamber`, MIT. Its design notes are in `.agents/skills/openchamber-ui-guidance/` of that repo.
2. What is copied: the warm palette, the flat layout with raised controls, the type sizes, the density, the tinted (not solid) primary button, the bare-word captions.
3. What is not copied: its code (React 19, Base UI, Tailwind), its three-pane chat layout, its theme marketplace, its no-focus-ring rule.

## 3. Tokens

All in `design/openpier.css` section 1. This table is the meaning of each group, not a second copy of the values.

| Group | Tokens | Use |
|---|---|---|
| Surfaces | `--bg`, `--bg-sidebar`, `--bg-raised`, `--bg-canvas`, `--bg-overlay` | page, sidebar, controls and popovers, logs and code, dim behind sheets |
| Ink | `--fg`, `--fg-muted`, `--fg-faint` | text, secondary text, placeholders and disabled only |
| Lines | `--line`, `--edge`, `--edge-strong` | dividers, control hairline, focused field |
| Tone steps | `--tile`, `--tile-hover`, `--tile-active` | flat tiles, hover, selected |
| Accent | `--accent`, `--accent-ink`, `--accent-fill`, `--accent-fill-hover`, `--accent-edge`, `--focus` | the next action, links, focus ring |
| State | `--ok`, `--warn`, `--bad`, `--info` and their `-fill` | dots, severity icons, banners |
| Depth | `--shadow-control`, `--shadow-raised`, `--shadow-floating` | buttons, raised cards, popovers and sheets |
| Type | `--font-ui`, `--font-mono`, `--text-micro` 12, `--text-meta` 12.5, `--text-body` 13.5, `--text-title` 14, `--text-page` 17 | system fonts; no web font is loaded |
| Shape | `--r-xs` 4, `--r-sm` 5, `--r-md` 7, `--r-lg` 9, `--r-xl` 12 | |
| Size | `--h-xs` 24, `--h-sm` 28, `--h-md` 32, `--row` 36, `--subrow` 28, `--sidebar` 224, `--header` 48, `--sheet` 480, `--dialog` 440, `--palette` 560 | |
| Motion | `--fast` 120ms, `--normal` 200ms, `--ease` | opacity and transform only |

Theme rules:

1. Light is `:root`. Dark is `:root[data-theme="dark"]`. The app sets `data-theme` from Settings: Light, Dark or System (follows `prefers-color-scheme` and updates live).
2. A component never checks the theme. If it needs a different value in dark, that is a token.
3. Text contrast: `--fg` and `--fg-muted` on `--bg` and on `--bg-sidebar` must be 4.5:1 or better in both themes. `--fg-faint` is below that on purpose and is only for placeholders and disabled text. A script in the plan checks this (task 1.2).
4. Remove `@fontsource/inter` and `@fontsource/jetbrains-mono`. System fonts load instantly and match macOS.

## 4. Window

1. Minimum window size 900x600. Default 1180x760.
2. Title bar: `titleBarStyle: "Overlay"` and `hiddenTitle: true` in `tauri.conf.json`, so the macOS window buttons sit on the sidebar. The top 36px of the sidebar (`.titlebar`) and the header are drag regions (`data-tauri-drag-region`); buttons and fields inside them are not.
3. The sidebar colour runs the full height, including behind the window buttons.

## 5. Shell

Mockup: `containers`, `engine-switcher`.

### 5.1 Layout

Two columns: `.sidebar` (224px, or 52px folded) and `.main`. `.main` is a column: `.header` (48px) then `.content` (scrolls). There is no border between sidebar and main; the tone step separates them.

### 5.2 Sidebar

Top to bottom:

1. `.titlebar` (36px drag region).
2. **Engine switcher** (5.3).
3. **Main nav**: Projects, Containers, Images, Volumes, Networks, Kubernetes. Kubernetes is shown only when the selected engine has a cluster.
4. A flexible spacer.
5. **Doctor**, with a count of findings that need action in `.count.bad`. No count when zero.
6. **Foot**: three ghost icon buttons (Settings, Activity, Help), a spacer, and Fold sidebar.

Rules:

1. Nav item: icon, label, optional count on the right. Projects and Containers show their total count in muted text.
2. Active item: `aria-current="page"`, `--tile-active` fill, ink text, weight 500. No outline, no accent colour.
3. Folded (Cmd+B): only icons, each with a tooltip of its label and shortcut. The engine switcher becomes its state dot. The choice is remembered (`openpier:sidebar-folded`).
4. Removed from the sidebar: the shortcuts list (it moves to Help), the Runtime select (merged into the switcher), Profiles as a top-level item. Projects stays, rebuilt (section 7.11).
5. **Activity** is the list of every command the app ran, newest first, with its output and exit code (today's `Commands.tsx`). It opens as a sheet.
6. **Help** opens a dialog with the shortcuts table (section 10), a link to the docs and "Give feedback" (opens GitHub Discussions).

### 5.3 Engine switcher

One control answers "which Docker am I looking at?".

1. Button (`.engine`, 44px): state dot, then two lines: the label ("Colima · default") and a muted state line ("Running · 4 CPU · 8 GB"), then an up-down chevron.
2. State line by case: `Running · {cpu} CPU · {mem}` when the app manages the machine; `Running` when it does not; `Stopped`; `Starting…`, `Stopping…` with the busy dot; `Not reachable` with a red dot.
3. Click opens a popover (`.pop`, 300px) below it. Engines are grouped under a bare caption per runtime (Colima, Docker Desktop, OrbStack, Rancher Desktop, Podman, Other). Each engine is a row: dot, name, muted facts, and either a check mark (selected) or a `Start` button (stopped and manageable).
4. Below a separator, two menu items with hints: "Stop {name}" (only for a running, manageable machine) and "Machines…" (opens Settings, Machines).
5. Picking an engine closes the popover, switches every list, and remembers the choice (`openpier:engine`).
6. An engine the app cannot start shows no button; its facts say "Not running. Start it from Docker Desktop." in the tooltip of the row.
7. Keyboard: Cmd+E opens it; arrow keys move; Enter selects; Esc closes and returns focus to the button.

### 5.4 Header

1. Left: the page title (`h1`, 17px, 600). Next to it, a muted summary (`.sub`): counts joined with " · " ("11 · 3 need attention").
2. Right: the search field for that list (220px), then secondary buttons, then at most one primary button (`.btn.primary`), last.
3. The header never wraps. If it does not fit at 900px wide, the search field shrinks to 140px, then secondary buttons move into a ⋯ menu.
4. On a detail page the header is: back button (ghost icon), name, state dot, state text, spacer, up to three actions, ⋯ menu.

## 6. Components

Each component is one file in `src/ui/`, exported from `src/ui/index.ts`. Props below are the whole API. The class column is what the component renders.

### 6.1 Button

`<Button variant size busy icon>label</Button>`

| Prop | Values | Class |
|---|---|---|
| `variant` | `default` | `.btn` |
| | `primary` | `.btn.primary` |
| | `danger` | `.btn.danger` |
| | `ghost` | `.btn.ghost` |
| `size` | `xs` 24px, `sm` 28px (default), `md` 32px | `.xs`, none, `.md` |
| `iconOnly` | needs `aria-label` (a lint rule enforces it) | `.icon-only` |
| `busy` | shows a spinner in place of the icon, sets `aria-busy`, blocks clicks | |

Which variant where:

1. **A row's main action** is `default` (`Stop`, `Start`, `Run`). It is quiet until the row is hovered or focused; the CSS does this.
2. **`primary`** is the one next step on a surface: the header's `New`, a fix on a problem line, the confirm button of a sheet. At most one per region.
3. **`danger`** only inside a confirm dialog, for the action that deletes.
4. **`ghost`** for icon buttons, Cancel in a sheet, and row-level secondary actions inside a sheet.
5. Labels never wrap (`white-space: nowrap` is in the class). A label is 1 to 3 words. A label that opens a confirm ends with "…".
6. Sizes: 28px in headers, toolbars and rows; 32px in sheets, dialogs and forms; 24px on problem lines and inside tiles.

### 6.2 Field, Select, Switch

1. `<Field size invalid icon>` wraps one `<input>`. Class `.field` (28px) or `.field.md` (32px in forms). Invalid sets `aria-invalid` on the wrapper and the input and links the message with `aria-describedby`.
2. `<Select>` is Radix Select with the trigger styled as `.field` and the list as `.pop` with `.menu-item` rows. Never a native `<select>` (the mockup uses native ones only to stay static).
3. `<Switch>` is a `button[role="switch"]` with class `.switch`. Its label is the setting's title, linked with `aria-labelledby`.
4. A form row is `.form-row`: `.label`, the field, then an optional `.hint`. The hint says why, in one line.
5. Search fields have the search icon, a placeholder that names the thing ("Search containers"), and clear on Esc.

### 6.3 Chip and Tabs

1. `.chip` is a flat 24px pill for a small fact (a container on a network, "Built in").
2. A chip that toggles is a `button.chip` with `aria-pressed` (Follow in logs).
3. `<Tabs>` is Radix Tabs; the list is `.tabs`, each trigger a `.chip` with `aria-selected`. No underline, no border.

### 6.4 Status dot and severity icon

1. `<Dot state>`: `ok`, `warn`, `bad`, `busy`, or none (grey, stopped). 6px. It always has a text equivalent next to it or an `aria-label`; colour is never the only signal.
2. `<Sev level>` is a 14px icon: circle-alert for `bad`, triangle-alert for `warn`, info for `info`, check for `ok`, coloured by state.
3. Mapping for a container:

| Condition | Dot | State text |
|---|---|---|
| Running, healthy or no health check | ok | Running |
| Running, health check failing | bad | Unhealthy |
| Running, has a warning finding | warn | Running |
| Restarting | warn | Restarting |
| Starting, stopping, pulling | busy | Starting… |
| Exited with code 0 or stopped by the user | none | Stopped |
| Exited with an error | bad | Stopped (error) |
| Killed for memory | bad | Out of memory |

### 6.5 Row, problem line, list

The row is the app. Mockup: `containers`.

1. `<Row>` renders `.row` (36px): `.lead` (16px slot: chevron for a group, else the dot), name, muted meta that grows and truncates, then fixed columns, the `.act` slot (68px, one button or empty), then the ⋯ button.
2. Columns have fixed widths set by the screen (section 7), right aligned, so every row lines up and nothing shifts when a value is missing.
3. `.row.child` indents a row inside a group by 26px.
4. `<Problem>` renders `.subrow` (28px) directly under its row: severity icon, one sentence in ink, and on the right one small button. `primary xs` when the app can fix it ("Fix kafka and kafka-ui…"), `default xs` when it explains ("See why").
5. No coloured bands. The icon carries the colour.
6. Click on a row opens its detail. The main action and ⋯ are separate click targets and stop the event.
7. Selection: hovering a row or focusing it shows a checkbox (`.check`) in the lead slot in place of the dot. With one or more rows checked, the header's right side is replaced by "{n} selected", `Start`, `Stop`, `Remove…`, and a ghost `Cancel`. Esc clears.
8. Keyboard: Up and Down move between rows; Enter opens; Space checks; the context menu key or Shift+F10 opens ⋯; Left and Right fold and unfold a group.
9. A list of more than 200 rows is virtualised (`@tanstack/react-virtual`). Row height is fixed, so this is cheap.
10. `.group-cap` is a bare muted caption with the count ("Needs action · 2"). No icon, no line.

### 6.6 Menu

Radix DropdownMenu; content class `.pop`, items `.menu-item`.

1. An item has a label and, under it, a one-line hint of when to use it (`.why`). Rule 3 of `AGENTS.md`. Items that need no hint (Copy name) have none.
2. Shortcut, if any, is muted on the right (`.kbd`).
3. Order: common first, then a separator, then copy and "Run it yourself", then a separator, then the destructive item (`.danger`), last, ending with "…".
4. Menus open toward the side with room and never cover their trigger.
5. The ⋯ trigger's accessible name is "More actions for {name}".

### 6.7 Sheet

Radix Dialog, content class `.sheet`, overlay `.overlay`. Mockup: `run-sheet`, `network-sheet`.

1. Slides in from the right, 480px, full height. The list behind stays visible and dimmed.
2. `.sheet-head` (48px): title, optional muted fact, close button. `.sheet-body` scrolls. `.sheet-foot` holds Cancel (ghost) and one primary button, right aligned; it is omitted when the sheet only shows information.
3. Opens with focus on the first field, or on the close button when there is none. Esc and a click on the overlay close it, unless a run is in progress; then it asks first.
4. Closing returns focus to the control that opened it.
5. Used for: Run, Pull, Start a Compose project, Test a connection, a network's members, a pod's detail, Activity, a Doctor finding's "See why".
6. One sheet at a time. A confirm dialog may open above a sheet.

### 6.8 Dialog

Radix AlertDialog, content class `.dialog`. Mockup: `confirm-dialog`.

1. For confirms only. 440px, upper third of the window.
2. Title is the question with the name in it ("Remove kafka-ui?"). One sentence says what happens and what is kept. Then the exact command in `.cmd` with a copy button (rule 7: says what it will run).
3. Buttons: Cancel (`default md`) then the action (`danger md` if it deletes, `primary md` if not). Focus starts on Cancel for a delete, on the action otherwise.
4. If the action can be undone, the sentence says how ("The old container is kept as kafka-ui-old until the new one runs"). If not, it says so.

### 6.9 Empty, loading, error

Mockup: `empty-state`, `machine-stopped`, `loading-error-toast`.

1. **Empty**: `.empty` centred in the content: a 22px icon, a title, one line, and the one or two buttons that fix it.
2. **Machine stopped**: every list shows the same empty state, "{name} is stopped. Your containers and data are kept." with `Start {name}` (primary). If the app cannot start that engine: "Start it from {Docker Desktop}." with `Open Docker Desktop`.
3. **Loading**: four skeleton rows on first load only. A refresh never clears the list or shows a spinner; the old rows stay until the new ones arrive.
4. **Error**: a `.banner.bad` above the list: what failed in plain words, the evidence as selectable text, and the next step as buttons (`Try again`, and a fix if there is one). The list below keeps the last good data.
5. **Search with no result**: "Nothing matches "{query}"." and a `Clear search` button.

### 6.10 Banner, Toast, Tooltip

1. `.banner` with `.bad`, `.warn` or `.info`: icon, title, body, actions on the right. Tinted fill, no border. Used at the top of a page or a sheet, never inside a row.
2. `<Toast>` (`.toast`, bottom right): the result of an action that finished off screen or can be undone ("Removed kafka-ui", `Undo`). It stays 6 seconds, pauses on hover, and is announced with `role="status"`. Errors are never toasts; they are banners.
3. `<Tooltip>` (`.tooltip`): after 500ms, for icon buttons (label and shortcut) and truncated text (the full value). Never for information the user needs to act.

### 6.11 Canvas and command

1. `.canvas` is the surface for logs, inspect output and command output: mono 12px, selectable, scrolls both ways. Log lines get `.t` on the timestamp, `.w` and `.e` on lines the app classifies as warning or error.
2. `.cmd` is one command on one line with a copy button. It scrolls sideways; it never wraps.

### 6.12 Command palette

Mockup: `command-palette`. Cmd+K.

1. `.palette`: a search field, then results grouped under captions: Containers, Images, Actions, Go to.
2. Typing a name finds the thing and the actions on it ("Restart kafka", "Logs of kafka"). Enter runs the highlighted one; actions that delete open their confirm.
3. Each action shows its shortcut on the right when it has one.
4. Empty query shows: the pages, then the five most recent actions.

## 7. Screens

Each screen below lists the header, the columns, the main action per row, the ⋯ menu and the states. Columns are right aligned and fixed unless marked "grows".

### 7.1 Containers (home)

Mockup: `containers`, `containers-row-menu`, `containers-new-menu`. Route `#/containers`.

1. Header: "Containers", summary "{n} · {m} need attention" (the second part only when m > 0). Search. `New` (primary) opens a menu: Run an image (Cmd+N), Pull an image (Cmd+P), Start a Compose project.
2. Row: dot, name, image (meta, grows), ports (110px), stats "{cpu}% · {mem}" (120px, mono, blank when stopped), state (112px), main action, ⋯.
3. Main action: `Stop` when running or restarting, `Start` when stopped.
4. Ports: each published port is `.port` (":8080"); click opens `http://localhost:8080` in the browser. More than two ports: show two and "+n" that opens the detail's Network tab.
5. Compose project: a group row with a chevron, the project name, its folder (meta), the first web port, "{running} of {total} running", `Stop` or `Start` for the whole project, ⋯. Its containers are child rows. Folded by default when everything in it is healthy; unfolded when anything needs attention. The fold state is remembered per project.
6. When a group is folded, its problems show under the group row, prefixed with the container ("api · health check is failing"). When unfolded, each problem shows under its own container.
7. Order: groups and single containers with problems first, then running, then stopped; alphabetical inside each.
8. Kubernetes pod containers sit in one folded group "Kubernetes" with no actions (they are managed by the cluster).
9. ⋯ for a container: Logs, Open a shell, Restart, separator, Copy name, Run it yourself, separator, Remove…. Hints as in the mockup.
10. ⋯ for a project: Rebuild and start ("After you change a Dockerfile"), Update images and start ("When a newer version of an image is out"), Restart ("After you change a setting in compose.yaml"), Show logs, Show in Finder, separator, Run it yourself, separator, Remove containers… ("To start clean. Volumes and data are kept").

### 7.2 Container detail

Mockup: `container-detail`. Route `#/containers/{id}/{tab}`.

1. Header: back, name, dot, state text, then `Open a shell`, `Restart`, `Stop` (or `Start`), ⋯ (Pause, Copy name, Run it yourself, Remove…).
2. Facts line (`.facts`): image, project, "Started 3 h ago", "{n} restarts", ports.
3. If Doctor has a finding for this container: one `.banner` with the title, the evidence and the fix button. Several findings: the worst one, and "and 2 more" linking to Doctor filtered by this container.
4. Tabs: Logs (default), Stats, Settings (environment, command, restart policy; was "Inspect"), Folders (mounts), Network, History (events; was "Activity"). The tab is part of the route.
5. Logs: toolbar on the tabs row, right side: filter field, `Follow` chip (on by default; scrolling up turns it off), copy button. The canvas fills the rest of the height. 5,000 lines are kept; older lines drop.
6. Open a shell opens Terminal.app with `docker exec -it`. It is not an in-app terminal in 1.0.

### 7.3 Images

Mockup: `images`. Route `#/images`.

1. Header: "Images", summary "{n} · {size}". Search. `Pull` (primary) opens the Pull sheet.
2. First block, caption "Space inside the VM": four `.tile`s: Build cache, Images, Stopped containers, Volumes. Each shows the size and, in its foot, what can be freed and one small button (`Clear`, `Remove unused`) or a link to the page that owns it. Volumes never get a clean-up button here.
3. Row: image icon, "name:tag" (tag muted), used-by (meta, grows: "Used by db, web" or "Not used"), short ID (104px, mono), size (76px), age (92px), main action `Run`, ⋯.
4. ⋯: Pull again ("To get the newest build of this tag"), Copy name, separator, Remove… (disabled with the reason as hint when a container uses it: "Used by db. Remove db first").
5. `Run` opens the Run sheet for that image.

### 7.4 Volumes

Mockup: `volumes`. Route `#/volumes`.

1. Header: "Volumes", summary. Search. `Remove unused…` (default) opens a confirm that lists what will go, with the total size.
2. Two groups: "In use" and "Not used".
3. Row: icon, name (a volume with no name shows its first 11 characters and a muted "no name"), used-by (grows), size (76px), no main action, ⋯.
4. ⋯: Show what's inside (opens a sheet that lists files, read-only), Copy name, separator, Remove… (disabled with the reason while in use).
5. There is no main action on a volume row on purpose: nothing about a volume is common enough, and the only action is destructive.

### 7.5 Networks

Mockup: `networks`, `network-sheet`. Route `#/networks`.

1. Header: "Networks", count. Search. `Test a connection` (default) opens its sheet. `New` (primary) opens a small dialog with one field (name).
2. Two groups: "Yours" and "Built in".
3. Row: icon, name, "Built in" chip where true, member containers as chips (grows; at most four, then "+n"), subnet (110px, mono), ⋯.
4. Click on a row opens its sheet: members with their address and a ghost `Disconnect` each, then "Add a container" with a select and `Connect`. Hint: "Connecting only adds. Nothing is restarted."
5. The teaching paragraph that is on this page today is removed. Its content appears only where it is true: as a problem line under `bridge` when a container on it needs name lookup, with the fix `Move to {network}…`.
6. Test a connection sheet: From, To, Port, `Check`; then the steps, each with a tick or a cross and one line.

### 7.6 Kubernetes

Mockup: `kubernetes`. Route `#/kubernetes/{tab}`. Read-only.

1. Header: "Kubernetes", summary "{nodes} · {version} · {running} of {total} pods running". Namespace select. `Open in k9s`.
2. Tabs: Pods, Deployments, Services, Events.
3. Pods is one list in two groups: "Need attention" then "Running". Row: dot, name, namespace (grows), ready (44px), plain-words status (150px), restarts (70px), age (50px), ⋯.
4. Status words: "Keeps crashing" (CrashLoopBackOff), "Can't download its image" (ImagePullBackOff, ErrImagePull), "Can't be placed on a node" (Pending, unschedulable), "Restarted, out of memory" (OOMKilled). The raw reason is in the tooltip and in the pod sheet.
5. Click on a pod opens a sheet: the plain-words reason, what to check, the last events, the logs.

### 7.7 Doctor

Mockup: `doctor`. Route `#/doctor`.

1. Header: "Doctor", "Checked {n} seconds ago". `Check again`.
2. Groups: "Needs action", "Worth knowing", then two folded lines: "Passed · {n}" and "Hidden by you · {n}".
3. Finding row (two lines, auto height): severity icon, title in ink, evidence in muted text (selectable), then one button, then ⋯.
4. Button by kind of fix: the app can fix it: `primary`, names what it fixes, ends with "…" ("Fix kafka and kafka-ui…"). Only the user can decide: `default`, "Show how" (opens a sheet with the explanation and the command to copy). Fixed on another page: `default`, "Open Images".
5. ⋯: Not an issue ("Hide it here and on its container. You can bring it back"), Run it yourself.
6. When nothing needs action: an `.empty` with a check icon, "Nothing needs action", and the passed count.
7. Each check declares which engines it applies to (E8). Checks that do not apply are not shown, not shown as passed.

### 7.8 Settings

Mockup: `settings-machines`. Route `#/settings/{section}`.

1. Layout `.settings`: a section list on the left (180px), the section on the right, 860px at most.
2. Sections:
   1. **General**: Theme (Light, Dark, System). Start OpenPier at login. Check for updates automatically.
   2. **Machines** (was Profiles; shown only when Colima is installed): the list of Colima VMs as rows (dot, name, facts, state, `Start` or `Stop`, ⋯: Restart, Edit folders, Delete…) and `New machine` (primary). Selecting a machine shows its settings below as `.setting` rows: CPU, Memory, Disk, Start when I log in, Kubernetes, Shared folders. Each row's description says the limit and the cost ("Your Mac has 10. Changing it restarts the VM.").
   3. **Engines**: every Docker context found, with its runtime, its address and whether it answers. Read-only. A hint says how to add one (`docker context create`).
   4. **Updates**: current version, `Check now`, release notes of the latest version.
   5. **About**: version, licence, links to the repo, the changelog and Discussions.
3. A setting applies when changed, except CPU, Memory and Disk, which show `Apply and restart…` because they restart the VM.

### 7.9 Setup (first run)

Mockup: `setup`. Shown in place of the whole app when no engine answers and none is installed.

1. A centred column, 520px: title, one sentence, then a checklist of steps (Homebrew, Colima, Docker command line tools, Start the first machine), each with its state (done, busy, to do) and one line.
2. One primary button, `Install and start`, runs the steps in order. Each step shows `Show output` while it runs.
3. A ghost button offers the other path: "Use Docker Desktop instead" (or OrbStack, or whichever engine is installed but stopped), which opens that app and waits for its context to answer.
4. If Homebrew is missing, the first step's button is "Open Terminal to install Homebrew" (it needs a password, so the app cannot do it).
5. When an engine answers, Setup closes by itself and Containers opens.
6. The Docker Desktop leftovers and "Bring your volumes over" are not part of Setup. They are Doctor findings after it.

### 7.11 Projects

The list, the project detail (Services, Logs, Ports, Settings) and the Start check sheet are specified in `07-projects-spec.md`, section 7. Mockup screens: `projects`, `project-detail`, `project-start-check`, `projects-empty`. They use only components of section 6. The app opens on the page it was on when it closed; on first run it opens on Containers.

### 7.10 Run, Pull, Compose start (sheets)

Mockup: `run-sheet`.

1. **Run {image}**: Name. Ports (Mac port, container port; pre-filled from what the image declares). "Settings the image needs" (environment variables the image is known to require, marked Required). "Keep its data" (a named volume for each path the image declares as data). Two folded lines: "More options" (restart policy, extra environment, extra folders, network) and "Show command".
2. A port that is taken shows a warning banner under the row with `Use {next free} instead`. The check runs as you type.
3. Foot: Cancel, `Run` (primary). On success the sheet closes, the new row is selected in the list, and a toast says "Started postgres".
4. On failure the sheet stays open with a `.banner.bad` at the top in plain words and the raw output behind "Show output".
5. **Pull**: one field ("nginx or postgres:16"), suggestion chips under it, a "Search Docker Hub" result list, and "Other registry" as a folded section. Progress shows as one line per layer collapsed into a single meter with "{done} of {total}".
6. **Start a Compose project**: the projects found on the Mac as rows (name, folder, `Start`), and `Choose a folder…`.

## 8. States every screen must handle

For each list screen, build and check all eight:

1. First load (skeleton).
2. Loaded with data.
3. Loaded, empty.
4. Search with no match.
5. Engine stopped.
6. Engine not reachable (error banner, last data kept).
7. An action running on a row (its button is busy, the dot is blue).
8. An action failed on a row (a problem line under the row with the plain-words reason and `Try again`).

The mocked backend (`preview/mock.ts`) gets one scenario per state, so each can be opened by URL and screenshotted.

## 9. Words

1. Sentence case everywhere. No full stop on labels, buttons or captions. Full stops in sentences.
2. Buttons are verbs: Start, Stop, Run, Pull, Remove…, Fix {thing}…, See why, Show how, Check again, Try again.
3. Use these words, not the Docker ones:

| Say | Not |
|---|---|
| Remove | rm, Delete (except a machine: "Delete") |
| Remove containers | Down |
| Rebuild and start | up --build |
| Update images and start | pull && up |
| Folders | Mounts, Binds |
| Settings (of a container) | Inspect, Env |
| History | Events |
| Machine | Profile, VM instance |
| Engine | Runtime, Context |
| Keeps restarting | Restart loop |
| Ran out of memory | OOMKilled |
| Out of date | Stale |

4. Engine and Machine are the only two nouns for "where containers run". Engine is any Docker the app can talk to. Machine is a VM the app can start and stop. Never "runtime", "profile", "context" or "instance" in the UI.
5. Numbers: sizes with one unit and at most three digits ("435 MB", "1.6 GB"); times relative ("3 h ago") with the exact time in the tooltip.
6. An error message has three parts: what happened, the evidence, the next step. Never a raw Docker error alone.

## 10. Keyboard

| Keys | Does |
|---|---|
| Cmd+K | Command palette |
| Cmd+1 to Cmd+6 | Projects, Containers, Images, Volumes, Networks, Kubernetes |
| Cmd+D | Doctor |
| Cmd+, | Settings |
| Cmd+E | Engine switcher |
| Cmd+B | Fold sidebar |
| Cmd+N | Run an image |
| Cmd+P | Pull an image |
| Cmd+F or / | Focus the search of the page |
| Cmd+[ and Cmd+] | Back, forward |
| Cmd+R | Refresh the page's data |
| Up, Down | Move in a list |
| Enter | Open the row |
| Space | Select the row |
| Left, Right | Fold, unfold a group |
| Esc | Close the top layer, else clear selection, else clear search |
| ? | Help and shortcuts |

Today's Cmd+0-7, Cmd+Shift+A (AI) and Cmd+Shift+N (New profile) are removed.

## 11. Accessibility

1. Every control is reachable with Tab in visual order, and shows the focus ring.
2. Lists are `role="table"` with rows, so VoiceOver reads "kafka, apache/kafka:3.8, Running, Stop button". Column headers exist for screen readers (`.sr-only`) even though they are not drawn.
3. Accessible names start with the visible words (rule 8). An icon button's name is its tooltip.
4. State is never colour alone: the dot always sits next to the state text.
5. After an action, focus stays on the row. If the row is gone (removed), focus moves to the next row, or the list's empty state.
6. Live changes are announced politely: a finished action ("Stopped kafka"), a new problem on a row.
7. Reduced motion: all transitions are off (in the CSS).
8. Minimum hit target 24x24; row height 36 makes every row target larger.
9. Text can be zoomed with Cmd+Plus to 150% without loss: sizes are in px for the mockup, and the app sets `zoom` on the root from a setting, so layout scales with it.

## 12. Motion

1. Sheet: slides 16px and fades in, 200ms. Dialog and palette: fade and scale from 0.98, 120ms. Menus: fade, 120ms.
2. Rows do not animate in or out. A removed row disappears; the toast says what happened.
3. The busy dot pulses. A busy button shows a 12px spinner.
4. Nothing else moves.

## 13. What is removed from the UI

1. The shortcuts list in the sidebar.
2. The Runtime select and the profile box, replaced by the engine switcher.
3. Today's Projects page (replaced by the one in `07-projects-spec.md`), the in-app terminal, the AI chat panel and its shortcut, the onboarding tour. See `03-review-product.md` P3.
4. The teaching paragraph on Networks.
5. The "Needs attention" block on Kubernetes that repeats the list.
6. Every native `<button>`, `<select>` and `<table>` rendered without a class.
