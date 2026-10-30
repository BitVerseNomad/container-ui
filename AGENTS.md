# AGENTS.md

How to work on this repo, for people and AI agents. The README is the pitch; this file is the rules.

## UX rules (every screen, every change)

1. **One main action per card or row**, the common one (Start when stopped, Stop when running). Everything else goes in the row's ⋯ menu.
2. **Actions are push buttons. Links only go somewhere** (another screen, a web page). Never a link next to a button for doing something.
3. **Every option says when you'd use it.** Menu items get a one-line hint ("After you change a Dockerfile"). Two options that differ only in a flag are one option plus a hinted menu item, or one option.
4. **Run it, don't make people copy it.** A command to copy is a last resort, only when the app truly can't run it (it needs a password, or it's the user's call).
5. **Plain words.** No Docker jargon in labels ("Remove containers", not "Down"). Name the thing the user sees, not the mechanism.
6. **Buttons never wrap.** Shorten the label, or give the row more room.
7. **Every fix asks first, says what it will run, and can be undone or tells you it can't.**
8. **Keyboard and VoiceOver work too.** Accessible names start with the visible words; focus goes somewhere sensible after every action.

## Test in the engine that ships

The app runs in WebKit (WKWebView), not Chromium. A change is done when it passes both:

    npm test && (cd src-tauri && cargo test)
    npm run check            # every browser check, in Chromium and WebKit

`PW_ENGINES=webkit sh scripts/check-all.sh` runs WebKit only. Checks click with the mouse and with the keyboard; never weaken an assertion to make one engine pass.

## Keep the README in step

The README sells the app to people who will only download it. When a change alters what a screen looks like or what it does:

1. Retake the screenshots: `npm run preview && node scripts/readme-shots.mjs`
2. Update the README text that describes it. Short, visual, the benefit first.
3. Add a line to `CHANGELOG.md`.

## Pull requests

1. Branch from `main`; one change per PR, with a before and after screenshot for any UI change.
2. Say what the user can now do, not how the code does it.
3. CI must pass in both engines. A maintainer reviews and merges.
