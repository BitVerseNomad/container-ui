# UI and UX review

Reviewed on 2026-11-12 at commit `61fa3df`, from screenshots of every screen in WebKit at 1280x800, light and dark, with the mocked backend. The screenshots are in `current-ui/`. The fix for each finding is a section of `04-design-spec.md`; this file says what is wrong and why it matters to the person using the app.

The bar is `AGENTS.md` (eight UX rules) plus the look and feel of [OpenChamber](https://github.com/openchamber/openchamber), which the owner picked as the reference.

## Verdict

The interaction design from October is still in the code and it is sound: one main action per row, problems in plain words on the row, fixes that ask first. What the user sees today hides all of it, because the styling is gone and four half-finished layers sit on top of each other.

Score against the reference: 2 out of 10 on look, 5 out of 10 on flow. The flow score is what is left of the earlier work; the look score is the missing stylesheet.

## Findings

### U1. Most of the app renders with no styling (P0)

1. Seen in every screenshot: buttons are the browser's grey bevelled boxes (`01-containers-list-light.png`: New, Stop). Tables are raw HTML with no spacing or row lines (`18-images-list-light.png`). The disk summary on Images is run together as text: "TypeSizeCan be freedActions", "Build cache3.4 GB3.4 GB".
2. Text overlaps: on Containers the status word is drawn on top of the name ("Warning" over "kafka", "Error" over "shop").
3. Cause: see E6 in `01-review-engineering.md`.
4. What the user feels: "this app is broken", before they try anything.
5. Fix: the whole of `04-design-spec.md`. Nothing is patched; every screen is rebuilt on the same parts.

### U2. Drawers and dialogs are not drawers or dialogs (P0)

1. Seen in `06-run-panel-light.png`, `07-pull-panel-light.png`, `26-networks-test-light.png`: "Choose an image to run", "Pull image" and "Why can't one container reach another?" render in the page flow under the list, with a bare "Close" at the top.
2. The user clicks New, and nothing seems to happen, because the panel opened below the fold.
3. Fix: design spec section 6.7 (Sheet) and 6.8 (Dialog). One right-side sheet component, 480px, used by Run, Pull, Compose start, Test a connection and the pod detail.

### U3. Three different button looks on one screen (P1)

1. Seen in `01-containers-list-light.png`: "Stop" is a grey native button, "See why" is a white rounded button, "Fix kafka and kafka-ui…" is a grey native button with small text. In dark (`01-containers-list-dark.png`) "See why" and "Start" are solid blue while "Stop" is grey.
2. The eye cannot tell which is the main action. Rule 1 of `AGENTS.md` (one main action per row) holds in the code and is invisible on screen.
3. Fix: design spec section 6.1. Four variants, and a fixed rule for which one a row uses.

### U4. The sidebar spends half its height on a shortcuts list (P1)

1. Seen in every screenshot: twelve rows of shortcuts fill the lower half of the sidebar, permanently. In dark at 800px height they push Kubernetes half out of view and Profiles and Doctor off the screen (`22-volumes-list-dark.png`).
2. Doctor is the app's best feature and it is the one item you cannot reach without scrolling.
3. Fix: the shortcuts list moves to the Help dialog (`?` or Cmd+/) and each shortcut shows next to its command in the palette and in tooltips. Design spec section 5.2.

### U5. Two pickers at the top of the sidebar, both unclear (P1)

1. Seen: a grey box "default / Running" (the Colima profile), then a section "RUNTIME" with a select "Colima (0.8.1)".
2. A new user does not know what "default" is, or how "runtime" differs from it. They are two halves of one question: "which Docker am I looking at?"
3. Fix: one engine switcher. One control, one list, grouped by runtime. Design spec section 5.3.

### U6. The navigation mixes three kinds of things (P1)

1. Sidebar today: Projects, Containers, Images, Volumes, Networks, Kubernetes, then (off screen) Profiles and Doctor.
2. "Projects" (dev environments on Lima) sits first, above Containers. Compose projects, a different thing with the same word, live inside Containers. So "project" means two things.
3. "Profiles" is a settings page for one runtime (Colima) presented as a top-level destination for all of them.
4. Fix: design spec section 5.2. Five resource destinations, Doctor, and Settings. "Profiles" becomes "Machines" inside Settings. Dev environments leave the default navigation (product decision P3 in `03-review-product.md`).

### U7. Status is a word in front of the name, not a signal (P1)

1. Seen on Containers: each row starts with "Warning", "Error" or nothing, as plain text, then the name. Problem lines repeat the word: "Error  Can't reach Kafka".
2. In dark the problem lines get a full-width tinted band, so a list with three problems is mostly brown and red stripes.
3. OpenChamber's rule fits here: colour carries state only, and as little of it as possible. A 6px dot does the job of the word.
4. Fix: design spec section 6.4 (status dot) and 7.1 (container row).

### U8. The main action sits in the middle of the row (P1)

1. Seen on Containers: "Stop" is at about 75% of the width, then the port, then "Running", then the menu. The eye has to find it each time, and it moves when the port column is empty (kafka has no port, so the gap differs).
2. Fix: fixed columns, right aligned, in this order: ports, stats, state text, main action, menu. Design spec section 7.1.

### U9. Tables do not use the width (P1)

1. Seen on Images and Volumes: the table hugs its content on the left and leaves the right 40% of the window empty. Every row has two buttons ("Run", "Remove") in a column titled "Actions".
2. Rule 1 says one main action per row and the rest in the ⋯ menu. Images breaks it, Volumes shows a disabled "Remove" on rows where it can never work.
3. Fix: design spec sections 7.3 and 7.4. Full-width rows, one main action, a ⋯ menu, and a disabled action is replaced by the reason ("In use by db").

### U10. The Networks screen is a wall (P1)

1. Seen in `24-networks-list-light.png`: a paragraph of teaching text, a create field, and a row for `devnet` where six containers each carry a "Disconnect" button inline, wrapping onto two lines, next to a native select and a "Connect" button.
2. Seven buttons on one row; the destructive one is the most repeated control on the screen.
3. Fix: design spec section 7.5. A network row shows names as quiet chips; connect and disconnect live in the row's sheet.

### U11. Container detail has no header structure (P1)

1. Seen in `09-detail-logs-light.png`: a "← Containers" button, the name, "Running · Unhealthy", five actions of equal weight in a row (Open a shell, Restart, Stop, Pause, Remove), then "Healthunhealthy", "Restarts0Started 3 h ago" run together, then the tabs.
2. Remove has the same weight as Restart, and it is one pixel from Pause.
3. Fix: design spec section 7.2. One header row: back, name, state dot and text, main action, ⋯ menu. Facts in one muted line joined with " · ". The problem in one tinted banner with its fix.

### U12. Kubernetes repeats the list twice (P2)

1. Seen in `28-kubernetes-pods-light.png`: a "Needs attention" block lists four pods with an "Open" button each, then the pods table lists the same four again.
2. Fix: one list, problems first, the plain-words reason on the row. Design spec section 7.6.

### U13. Light and dark are two different designs (P1)

1. Light has no borders and no bands; dark has header rules, row bands and solid blue buttons. The active sidebar item is a black outline in light and a blue filled box in dark.
2. Fix: one set of semantic tokens with a light and a dark value each. A component never knows which theme is on. Design spec section 3.

### U14. Blue accent, pure white and pure black (P2)

1. Today: `#0066CC` on `#FAFAFA` and near-black. It reads as a default admin template.
2. The reference uses warm off-white and warm near-black with one burnt-orange accent, and almost no borders.
3. Fix: design spec section 3.1, adapted palette.

### U15. Focus is not visible (P1, accessibility)

1. In the screenshots taken after keyboard navigation there is no visible focus indicator on rows or native buttons in light.
2. OpenChamber removes focus rings and uses a fill instead. This app must not copy that: rule 8 of `AGENTS.md` and WCAG 2.4.7 require a visible focus indicator, and a hover-like fill alone fails for keyboard users on tinted rows.
3. Fix: design spec section 3.6. A 2px accent ring on `:focus-visible` only, so mouse users never see it.

### U16. No empty, loading or error pattern (P1)

1. Lists show nothing while loading and nothing when empty. An error from the backend is an alert string ("Failed to load projects: invoke undefined").
2. Fix: design spec section 6.9: one Empty, one Skeleton row, one error Banner, each with the next action.

### U17. Portuguese text in an English app (P2)

`src/Onboarding.tsx:17` says "Bem-vindo ao Wharf". Remove the onboarding file; first run is the Setup screen (design spec 7.9).

### U18. The sidebar promises shortcuts that do nothing (P1)

`src/Shell.tsx:152-160` lists ⌘K, ⌘N, ⌘P, ⌘D, ⌘⇧A and ⌘⇧N. Only ⌘K, ⌘0 to ⌘7, ⌘B and Escape are registered (`src/App.tsx:341-352`), and ⌘K sets a flag that nothing reads: `CommandPalette` is imported at `src/App.tsx:35` and never rendered. `HelpModal.tsx` and `ai/ChatPanel.tsx` are imported by no file. So there is no palette, no help and no chat in the app today. Prescription: the shortcut table in the Help dialog is generated from the array that registers the shortcuts (task 2.4), so the two cannot disagree.

### U19. There is no dark mode (P1)

No theme switch and no `prefers-color-scheme` rule exist. `src/ui/tokens.css:84` defines a `.dark` class that nothing sets. The dark screenshots in `current-ui/` were made by forcing that class, and only backgrounds change. Prescription: the app follows the system by default, with a three-way choice in Settings (System, Light, Dark). It does this by setting `data-theme` on the root element (design spec section 3, task 3.9).

### U20. The app opens on a screen that errors (P0)

The first tab is Projects (`src/App.tsx:56`). With one runtime detected there is no picker and no active runtime, so Projects shows "Failed to load projects" and Containers shows "Start your first VM" even when a VM is running (seen in the preview; see E7). With OrbStack picked the page prints a raw error string. Prescription: open on Containers, pick the engine automatically (task 4.2), and no raw error text on screen (design spec section 8).

### U21. The sidebar hides Doctor on a normal window (P1)

At 800px tall the shortcuts list pushes Doctor and Profiles off screen; at 900x640 it is worse. Prescription: the list is removed (it moves to Help), and the sidebar is checked at 600px tall (task 2.2).

## What already works and must survive the redesign

1. Problems in plain words on the row, with the evidence ("report-job · ran out of memory").
2. One fix button that names what it fixes ("Fix kafka and kafka-ui…").
3. Compose projects grouped, with "5 of 7 running".
4. Port links that open the browser (`:8082 ↗`).
5. Menu items with a one-line hint of when to use them.
6. Confirm dialogs that say what will run.
7. The Cmd+number tab shortcuts, and the command palette code (written, not wired in: see U18).

## Click counts for common tasks (target for the redesign)

| Task | Today | Target |
|---|---|---|
| See why a container is failing | 1 (See why) | 1 |
| Restart a container | 2 (⋯, Restart) | 2 |
| Read a container's logs | 2 (row, Logs tab is default) | 1 (row click opens detail on Logs) |
| Run an image | 3 (New, Run an image, pick) plus scroll to find the panel | 3, no scroll |
| Switch to another engine | 2 pickers, unclear which | 2 (switcher, pick) |
| Free disk space | 2 (Images, Clear build cache) | 2 |
| Open Doctor | scroll the sidebar, then click | 1 |
| Stop everything in a Compose project | 1 (Stop on the project row) | 1 |

Today's counts are from the code and screenshots, not from a usability test with real people.
