# Scorecard

The fixed test for every improvement loop. A fresh reviewer, who has not seen the code or the changes, does each task in the preview (`preview/index.html?scenario=running`) and scores it. A loop is kept only if the total goes up and no task's score goes down. Two loops in a row with no gain means stop.

Score the old and new builds together, by one reviewer, as A and B without saying which is newer. Totals from different reviewers drift by up to 8 points, so only the gap within one pair counts.

Do not change the tasks between loops. Add new tasks only at the end, and score them for the old build too, so totals stay comparable.

## Scores

1. **0**: can't be done in the app, or the app is wrong
2. **1**: works only by copying a command to Terminal, or the user gets stuck along the way
3. **2**: works in the app, with friction (unclear words, extra clicks, a missing next step)
4. **3**: works in the app, first try, and it's clear what happened

## Tasks (a developer who runs Compose projects every day)

1. Find the project service-search-service by typing "sss"
2. Start a Compose project that isn't running
3. Start blog, see why it fails, and get it running
4. See which container in the shop project is broken, and why
5. Read the shop project's logs
6. Watch a project's logs live while it restarts
7. Open a shell in a normal running container (web)
8. Open a shell in the worker container
9. Rebuild a project after changing its code
10. Add a project folder that the scan missed (the chooser returns `window.__pickFolder` when set)
11. Take a project down without losing its data
12. Learn the command behind something you just clicked
13. Run again a command you ran a few minutes ago
14. Get a crash-looping container (worker) working, or know exactly what to do
15. Find which container uses port 8080
16. Free disk space taken by unused images

## Design read (every loop that changes a screen)

A loop that changes what a screen looks like passes only when all of these hold:

1. Fresh-context reviewers, one per field (product, UX, visual, engineering, daily user, accessibility), score the new round above the last one, and none drops.
2. They get screenshots of every state of every changed screen: healthy, with problems, empty, stopped. A state nobody screenshotted is unreviewed. (The Doctor page with setup problems was missed for three rounds this way.)
3. Each new screen is compared side by side with home, as one app: same rows, buttons, marks and headings.
