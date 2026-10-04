# Shell, visual system and Overview: design

Date: 2026-10-04. Status: awaiting review. Sub-project 1 of the agreed roadmap (steps 1 and 2: shell and look, Overview with VM control and Homebrew install). Later steps: list UX and prune suggestions, run options and env editor, registries, Compose, full Colima settings.

## Intent

The user opens the app to (1) check the VM is up and what it is using, (2) find or start a container, and (3) pull or run something new. Freeing disk space is not a first-thing task. They liked the dashboard of another Colima UI and want its structure adapted, with readable Colima output, no window-level scrolling, VM start/stop/restart from the UI, and Colima installed via Homebrew when missing.

Success: on opening the app, within two seconds the user knows whether the VM is healthy, what is using it, and what needs attention; they can control the VM from the Overview; only the content area scrolls; Colima output is readable.

## Scope

In: app shell, visual system, Overview, environment check and Homebrew install, output cleaning, restyling existing screens with the new components.
Out (later sub-projects): search, filters, bulk select and usage columns on lists; prune suggestions; env-var editor and extra run options; registries; Compose; full Colima settings; toasts; cancelling an install; custom fonts; themes beyond light and dark. Docker Compose is not installed by this work.

Stack is unchanged: Tauri (Rust backend that launches `colima`, `docker`, `brew`) with a React frontend.

## 1. Shell and visual system

Layout. `html, body, #root` are `height: 100%; overflow: hidden`. The window is a 232px sidebar and a content column; the content column (`.content`) is the only scroller. Logs, tables, drawers and the output log scroll inside their own panes. Below 700px the sidebar becomes a top bar.

Sidebar. Brand block, icon navigation (Overview, Containers, Images, Volumes, Profiles), footer with the active profile and `runtime · N CPU · N GB`. The footer is a picker when two or more profiles exist and static text otherwise. The former "Colima" tab is renamed Profiles and starts with one line explaining that a profile is a separate Colima VM.

Page header. Every page: breadcrumb (`COLIMA / <profile>`, small, letter-spaced), title (about 28px, bold), VM status pill on the right (`VM running`, `VM stopped`, `Starting…`, `Stopping…`, `VM error`).

Light palette (sampled from the reference screenshots): page `#f3f5f3`, sidebar and table head `#e8ece8`, card `#f0f2f0`, border `#d3dad4`, ink `#1c2a27`, muted `#66726e`, primary `#397863`, danger `#a14b3f`. Dark palette: page `#121a18`, sidebar `#172321`, card `#1a2724`, border `#2b3a36`, ink `#e6eeea`, muted `#8fa09a`, primary `#5aa688` (text on primary `#0b1a15`), danger `#e07a6d`. Measured contrast: light ink 13.6, muted 4.57, white on primary 5.2, danger 5.3; dark ink 15.0, muted 6.5, on-primary 6.2, danger 6.1.

Type. System sans; titles bold about 28px; body 14px; monospace 13px for image references, IDs and ports.

Icons. A single `src/ui/icons.tsx` of about 14 inline SVG icons; no icon dependency.

Components (`src/ui/`): PageHeader, StatusPill, IconButton (tooltip and accessible label required), Card, Meter, DataTable (sticky header, hover state, visibly highlighted selected row), EmptyState, OutputLog.

Rules. One primary (green) button per screen. Danger red only on destructive actions. Sentence case, verb-first button labels, no exclamation marks.

Contrast thresholds (checked by a test, both modes): ink on page at least 7:1; muted on page, white on primary, danger on page at least 4.5:1.

## 2. Overview

VM card. Shows profile name, runtime, architecture, uptime. Running: Restart and Stop. Stopped: a single primary Start. Starting, stopping or restarting: the cleaned output log inline with a spinner. Failed: the failure headline and the log, with Retry. Data comes from `colima list --json`, polled every 3 seconds.

Meters. CPU, memory and disk, labelled "containers use". CPU and memory are the sum of one `docker stats --no-stream` call across all containers, every 5 seconds, against the VM allocation. Disk is `docker system df` total size against the VM disk, every 30 seconds. Polling pauses while the window is hidden.

Containers panel. Search box (matches name or image), running containers first then by name. Row: status dot, name over image, CPU and memory (running only), published ports, icon buttons for logs (opens the container detail on the Logs tab) and start or stop. Header buttons: Pull image (secondary) and Run image (primary). When the VM is stopped, Start in the VM card is the primary and Run image becomes secondary. Run image opens a searchable picker of local images, then the existing Run panel.

Needs attention. A quiet strip shown only when actionable: stopped containers, and unused images or build cache reported by `docker system df`. Each links to the relevant list. No prune action here.

Empty state. With no containers, an invitation to run an image.

## 3. Backend and onboarding

`env_check` returns `{ brew, colima, docker }`, each `null` or `{ path, version }`, found in `/opt/homebrew/bin`, `/usr/local/bin`, `/home/linuxbrew/.linuxbrew/bin`, then `PATH`.

States. Ready: normal app. Tools missing: the Overview is replaced by an install card listing what is missing and the exact command, for example `brew install colima docker`, which runs only on click. Homebrew missing: the card shows the official one-line installer with a copy button; the app never runs it. After a successful install the app re-checks and offers Start Colima as primary (Colima defaults, with a link to customize via New profile).

Install command `install_tools(names)` runs `brew install <names>` where names is a subset of `colima` and `docker`, streaming output on the `brew-progress` event.

Output protocol. Rust reads child output byte by byte and emits one event payload per frame, split on `\n` and `\r`. A frame that follows `\r` is prefixed with `\r`, meaning "replace the previous line". Events: `colima-progress`, `pull-progress`, `brew-progress`. On failure the last 30 frames are returned as the error.

Cleaning (`src/lib/logClean.ts`, pure). `cleanFrame(raw)` strips ANSI escape sequences and parses logfmt (`time=… level=info msg="…"`), logrus text (`INFO[0000] msg  key=value`) and Lima `> ` lines into `{ level, text }`; unknown lines are `plain`. `summarizeFailure(lines)` returns the message of the last error or fatal line, else the last non-empty line. OutputLog applies replace semantics, colours warn and error, collapses consecutive identical lines, scrolls inside its own pane, and has Copy raw output. Raw frames are kept for copying. OutputLog is used by the VM card, the install card, the Profiles tab and the Pull panel.

## 4. Structure, testing, delivery

Structure. New code in `src/ui/` (components, tokens.css, icons), `src/lib/` (logClean, usage aggregation, df parsing, env types) and `src/Overview.tsx`, plus a small Shell component. Existing screens keep their files and adopt the new components and tokens. In Rust only `env_check`, `install_tools` and the frame reader are new.

Testing, in order. (1) Test-first pure functions: cleanFrame and summarizeFailure with realistic Colima and Lima samples; stats and `docker system df` aggregation; contrast ratios. (2) Rust tests for frame splitting and version parsing; these cannot be run in the authoring sandbox and will be reported as unrun. (3) Headless browser checks on the preview at 1100x680 and 800x600 asserting the window never scrolls on any page. (4) Preview scenarios selectable with `?scenario=running|stopped|starting|failed|missing`, each reviewed from screenshots before handoff.

Delivery. Small commits per unit on the existing history, a new zip, an updated preview link, and a README changelog.

Risks. Rust is not compiled in the authoring sandbox, so changes there are kept small and listed. The preview uses simulated data, so real `brew` and `colima` behaviour is verified only on the user's machine. The real Colima output has not been seen; Copy raw output exists to close that gap.
