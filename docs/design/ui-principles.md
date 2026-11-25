# UI principles

The design rules that still hold. The eight UX rules and the test commands live in [AGENTS.md](../../AGENTS.md); they are not repeated here. Decisions behind this page: [ADR index](../adr/README.md). The original spec is `docs/plan/04-design-spec.md` at commit 29b538e.

## 1. How the design is built

1. Tokens come first: [0003](../adr/0003-design-tokens-and-design-system-gate.md). Never write a colour, size or shadow in a component.
2. Direction: [0010](../adr/0010-manifest-visual-direction.md). Cool grey, one cobalt accent, dense tables.
3. Lists are tables: a hairline under each row, a header row, columns of fixed width that line up. Rows are one line, facts joined with " · ", long values cut with the full value in a tooltip.
4. Nothing moves on touch. Hover and selection never change a size. A slot that may hold a status is reserved when empty.
5. Quiet at rest. A row's buttons show a hairline outline until the row is hovered or focused.
6. Colour means state (green, amber, red). State is never colour alone: the dot always sits next to text or has an aria-label.

## 2. Layout

1. Window: minimum 900x600, default 1180x760. The title bar is an overlay, so the macOS buttons sit on the sidebar.
2. Two columns: a sidebar (208 px, 52 px folded with Cmd+B) and the main area. The main area has a 48 px header, then scrolling content.
3. Sidebar, top to bottom: engine switcher, nav (Projects, Containers, Images, Volumes, Networks, Kubernetes), Doctor with a count of findings that need action, then Settings, Activity, Help. Kubernetes shows only when the engine has a cluster.
4. The engine switcher answers "which Docker am I looking at?". It lists engines grouped by runtime. A stopped engine the app can manage has a Start button; one it cannot manage shows no button.
5. The header never wraps. Left: title and a muted count. Right: search, secondary buttons, at most one primary button, last. At narrow widths the search shrinks, then buttons move into a ⋯ menu.
6. CPU, memory and disk of the machine sit in the header of every list page. A bar turns amber above 60 percent (memory) or 85 percent (disk).
7. A project, or a Compose group, shows its services as a row of blocks.
8. List order: things with problems first, then running, then stopped; alphabetical inside each. A group is folded when healthy and open when something needs attention.

## 3. Components

1. Button variants: default (a row's main action), primary (the one next step, at most one per region), danger (only in a confirm dialog), ghost (icon buttons, Cancel). Labels are 1 to 3 words and never wrap. A label that opens a confirm ends with "…".
2. Sheet: slides in from the right, 480 px, for anything with a field or a long result (Run, Pull, a network's members, a pod, Activity, "See why"). One sheet at a time.
3. Dialog: for confirms only. The title is the question with the name in it. It shows the exact command, and says how to undo or that it cannot be undone. Focus starts on Cancel for a delete.
4. Menu: common items first, then copy and "Run it yourself", then the destructive item last, ending with "…". The trigger's name is "More actions for {name}".
5. Inspector (the answer to "why"): the problem in one sentence, what the container said, what the app found, the fix as the primary button, then Open logs and Open a shell.
6. Banner for errors and warnings, toast for results. Errors are never toasts. A toast stays 6 seconds and may carry Undo.
7. Selecting rows: hover or focus shows a checkbox in place of the dot. With rows checked, the header shows "{n} selected" and bulk actions. Esc clears.
8. Lists over 200 rows are virtualised, with a fixed row height.
9. Use the app's own controls (`src/ui/op`), Radix for behaviour and `lucide-react` icons. Never a native select.

## 4. States every list screen must handle

1. First load: four skeleton rows, first load only. A refresh never clears the list.
2. Loaded with data.
3. Loaded, empty: one title, one line, and the button that fixes it.
4. Search with no match: "Nothing matches "{query}"." and Clear search.
5. Engine stopped: "{name} is stopped. Your containers and data are kept." and a Start button. If the app cannot start it, say how.
6. Engine not reachable: an error banner with what failed, the evidence and Try again. The last good data stays below.
7. An action running on a row: its button is busy and the dot is blue.
8. An action failed on a row: a problem line with the plain-words reason and Try again.

## 5. Words

1. Sentence case. No full stop on labels, buttons or captions.
2. Buttons are verbs: Start, Stop, Run, Pull, Remove…, Fix {thing}…, See why, Show how, Check again, Try again.
3. Say Remove (not rm), Remove containers (not Down), Folders (not Mounts), Settings of a container (not Inspect), History (not Events), Machine (not Profile), Engine (not Runtime or Context), Ran out of memory (not OOMKilled).
4. Kubernetes states in words: "Keeps crashing", "Can't download its image", "Can't be placed on a node". The raw reason goes in a tooltip.
5. Sizes with one unit and at most three digits ("435 MB"). Times relative ("3 h ago") with the exact time in the tooltip.
6. An error has three parts: what happened, the evidence, the next step. Never a raw Docker error alone.
7. The nouns for where containers run are in [0002](../adr/0002-engine-and-machine.md).

## 6. Keyboard and accessibility

1. Shortcuts: Cmd+K palette, Cmd+1 to 6 pages, Cmd+D Doctor, Cmd+, Settings, Cmd+E engine switcher, Cmd+B fold sidebar, Cmd+N Run, Cmd+P Pull, Cmd+F or / search, Cmd+[ and ] back and forward, Cmd+R refresh, ? Help. In lists: Up and Down move, Enter opens, Space selects, Left and Right fold. Esc closes the top layer, then clears selection, then clears search.
2. Focus is always visible: a 2 px accent ring on keyboard focus. Every control is reachable with Tab.
3. Lists are tables for VoiceOver. Accessible names start with the visible words.
4. After an action, focus stays on the row. If the row is gone, it moves to the next row or the empty state.
5. Finished actions and new problems are announced politely.
6. Reduced motion turns transitions off. Otherwise only opacity and transform move: sheets slide 16 px in 200 ms; dialogs, the palette and menus fade in 120 ms. Rows do not animate.
