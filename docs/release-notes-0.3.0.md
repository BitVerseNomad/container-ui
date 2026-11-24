# Container UI 0.3.0

Container UI is a Mac app for running containers without Docker Desktop. It works with Colima and other container engines.

## What is new

1. **The app is called Container UI.** Your saved settings are kept.
2. **Containers page rebuilt.** Containers with problems show first. Each container has one status dot and one plain word, such as Running or Stopped. Ports, CPU and memory sit in fixed columns, so the rows line up.
3. **A clear view for each state.** The Containers page has its own view for loading, empty, engine stopped and the other states.
4. **Each container has its own page.** Logs, Stats, Settings, Folders, Network and History are tabs on that page. Back and forward work on every page.
5. **Run and Compose open in side sheets.** A Compose project opens in a sheet with live logs.
6. **The app picks its engine when it starts.** One engine switcher replaces the old profile box at the top of the sidebar.
7. **Keyboard shortcuts in one place.** The shortcut list, the Help screen and the command palette all use the same list.
8. **New window layout.** The sidebar shows usage meters, and Doctor stays in view.
9. **One design system.** Every colour, size and shadow comes from one set of design tokens.
10. **A stopped Colima no longer crashes the app.** Machines loads a machine that is not running, and New machine opens centred.
11. **Turn Kubernetes on and off** from the Machines page.
12. **Sign in to Amazon ECR from the app.** When an image needs a login, Container UI asks first, then runs the sign-in for you.
13. **Easier to read.** Dark mode follows your Mac, text contrast is higher, and names are no longer cut off in lists.
14. **Calmer output.** The command output window stays small, failed starts show one short reason with the full error under Show details, and buttons look like buttons.

## Install

1. Download the `.dmg` file from the release page.
2. Open the `.dmg` and drag Container UI to Applications.
3. Open Container UI from Applications.

If you used the old app before, remove it from Applications by hand. macOS sees Container UI as a new app, because its identifier changed to `dev.containerui.desktop`.

### Opening the app the first time

The app is not signed or notarized by Apple. The first time you open it, macOS says it cannot check the app. To allow it:

1. Try to open Container UI. macOS shows a warning, so close it.
2. Open System Settings, then Privacy & Security.
3. Scroll to the message about Container UI and click **Open Anyway**.
4. Confirm with your password if macOS asks. You only need to do this once.

The one-line installer in the README supports Apple Silicon Macs only.

## Known limits

1. The app is not signed by Apple, so macOS Gatekeeper needs the steps above.
2. The one-line installer works only on Apple Silicon Macs.
