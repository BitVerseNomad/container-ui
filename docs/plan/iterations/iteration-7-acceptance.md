# Iteration 7: acceptance checklist

Walk this after `sh docs/plan/iterations/verify-iteration-7.sh` prints no `FAIL`. The script proves text and tests. It cannot prove a workflow runs, an update installs, or a picture looks right. Those are below.

Nothing in this iteration has been run on GitHub. "Not verified: never run" stays true until the owner steps are done.

## First, the cheats to look for in every work order

1. A test weakened, skipped or deleted: `git diff main -- '*.test.*' scripts/release-tools.test.mjs` shows only added tests (the counts in the work orders are at least 11 updater tests and 21 release tool tests).
2. `scripts/not-migrated.json` or `scripts/checks-pending/` changed. Neither should.
3. A TODO, "coming soon", or a placeholder such as `<OWNER>`, `<BUILDER_FILE>` left in a file: `grep -rn "<OWNER>\|<BUILDER_FILE>\|TODO" LICENSE SECURITY.md CODE_OF_CONDUCT.md ROADMAP.md CONTRIBUTING.md README.md docs/signing.md docs/plan/launch-checklist.md .github scripts/install.sh scripts/bump.mjs scripts/release-check.mjs` prints nothing.
4. A key, token or password anywhere: `git diff main | grep -iE "BEGIN .*PRIVATE|ghp_|TAURI_SIGNING_PRIVATE_KEY[:=] *[A-Za-z0-9]"` prints nothing (the workflow only refers to `secrets.`).
5. A push, a tag or a release made by the implementer: `git tag --list 'v*'` is unchanged, and `git log origin/main..HEAD` is the local work only.
6. Invented design: any colour, size or class in the Settings Updates change that is not in `docs/plan/design/openpier.css`. Any `style=` or native `<button>` there.

## WO-6.1 Community files

Open: the repo root, `.github/`, and (after the owner pushes) GitHub's Community standards page.

1. `LICENSE` is the standard MIT text, year 2026, "OpenPier contributors".
2. `SECURITY.md` says: report through "Report a vulnerability", reply within 7 days, scope is the app, the updater and the install script, and the old signing key is not trusted.
3. `CODE_OF_CONDUCT.md` points at Contributor Covenant 2.1 and does not copy its text.
4. `ROADMAP.md` has Now, Next, Later, Never. "Never" matches the five items in `08-feature-gaps.md` section 5. "Next" matches G6 to G14 in section 4, plus the Homebrew tap.
5. `CONTRIBUTING.md` fits one page and every command in it is one that exists in `package.json`.
6. Issue templates: open the three `.yml` files. Bug has five fields, Feature has three. Nothing asks for a container name or a path.
7. The PR template file name is in capitals in git. The old lowercase one is gone.
8. Cheat: a contact e-mail or a person's name added anywhere. There must be none.
9. Owner: on GitHub, Bug and Feature show on "New issue", blank issues do not, the Dependabot tab has no error, Community standards is fully ticked.

## WO-6.2a Updates in the app

Open: `npm run preview`, then these addresses.

1. `http://localhost:4173/?scenario=design&update=none#/settings/updates`: click `Check now`. The text `You are up to date.` shows. The `Version` row of WO-3.9 is unchanged and stays first.
2. `...&update=available#/settings/updates`: click `Check now`. Row `OpenPier 1.1.0 is out`, `You have 1.0.0.`, a primary button `Install and restart…`, and the notes in a block under `What is new`.
3. Click `Install and restart…`: a confirm dialog `Install OpenPier 1.1.0?`. `Cancel` closes it and nothing happens.
4. Confirm: the button shows `Installing…` and a percent, then (in the preview) the restart is recorded. In the real app the app restarts.
5. `...&update=fails#/settings/updates`: after confirming, a bad banner says `Could not install the update.`, the evidence, and what to do; `Try again` is there; the app did not restart.
6. Compare the look with `docs/plan/design/shots/settings-machines-light.png`: same row style, spacing, button sizes. The Updates section must look like a sibling of the Machines section.
7. Keyboard: Tab to `Check now`, Enter works; focus is sensible after the dialog closes.
8. The words in 2 to 5 are the design (the work order quotes them; spec section 9). Read each once as the user: they are the ones in `UPDATER_WORDS`, and nowhere else in the code. The download shows a progress bar under the `Downloading…` line (compare with a `Progress` in the gallery, `#/dev/gallery`).
9. General: open `#/settings/general`. A row `Check for updates automatically` with a switch, on by default, same row style as Theme. Turn it off, reload with `&update=available`, open Updates: it still says nothing was checked (the button is `Check now`, no `OpenPier 1.1.0 is out`). Turn it on, reload: the update is announced without a click.
9a. Cheats: the plugin imported anywhere except `src/lib/updaterStore.ts`; the button labelled `Check for updates` instead of `Check now`; the startup check ignoring the switch; `scripts/check-settings.mjs` changed by this iteration (it must not be: its line says only "Updates shows the version"); the auto-check value kept in a loose `localStorage` key instead of the settings store (`openpier:settings`).
10. Rust: `src-tauri/capabilities/default.json` still has its old permissions plus exactly `updater:default` and `process:default`. No wider permission, and the content security policy in `tauri.conf.json` did not change.
11. Not verified until a real release exists: that `check()` finds a real update. Owner step.

## WO-6.2b The release workflow

Open: `.github/workflows/release.yml`, `src-tauri/tauri.conf.json`, `scripts/`.

1. `release.yml` triggers only on `v*` tags. It has two matrix legs (arm64 and x64), one at a time. It makes a draft. It passes the two signing secrets and nothing from Apple. No `latest.yml`.
2. Read the `tauri-action` step against https://github.com/tauri-apps/tauri-action: input names are real (`tagName`, `releaseName`, `releaseBody`, `releaseDraft`, `prerelease`, `args`).
3. If `ci.yml` pins actions by hash, `release.yml` pins them the same way; otherwise tags. No mixture.
4. `release.yml` uses Node 22, like `ci.yml` (decided).
5. `tauri.conf.json`: `createUpdaterArtifacts: true`, targets `app` and `dmg`, the endpoint ends in `/releases/latest/download/latest.json`, the public key is the new one, `identifier` is `dev.openpier.desktop`.
6. `scripts/bump.mjs`: read the code. It changes five version places and the changelog heading, all or none. Run it on a copy of the repo only (never on the real tree), with `1.0.0`, and look at the diff; then discard the copy.
7. `scripts/changelog-section.mjs 1.0.0` on that copy fails when the heading has no notes under it. A release without notes cannot build.
8. `scripts/release-draft-check.mjs` and `scripts/lib/draft.mjs`: the rules match checklist 4.4 items 1 and 2.
9. Cheats: `workflow_dispatch` added back; `continue-on-error`; secrets echoed in a `run:`; a signing key or password in any file.
10. Owner: first tag, then `node scripts/release-draft-check.mjs v<x.y.z>` prints only `ok`. Then checklist 4.4 items 3 to 5 by hand. This is the only proof the workflow works.

## WO-6.3 Install

1. Read `scripts/install.sh`: arch detection (arm64 and x64), downloads `OpenPier-<arch>.dmg` and its `.sha256`, refuses a mismatch before mounting, moves an old app to the Trash, copies, prints what it did and the one first-open step. No `sudo`, no `xattr`, no `spctl`.
2. The README install line and the script header are the same command.
3. `install-smoke.yml` runs on `release: published`, installs with the public line, and compares the app's version with the tag.
4. Cheat: the test suite for the script pointing at the real `/Applications`. It uses `OPENPIER_APPLICATIONS_DIR` and a temporary folder.
5. Owner: the smoke job is green after the first publish; one other person ran the line on a clean Mac.

## WO-6.5 Signing

1. `docs/signing.md` is honest: ad-hoc, not notarised, what a person sees, the four steps, and the later notarisation list marked "Not verified" for the variable names.
2. `tauri.conf.json` `bundle.macOS` is unchanged: `signingIdentity` is `-`, `hardenedRuntime` true, same entitlements file.
3. Owner: on a Mac, `codesign -dv --verbose=2 /Applications/OpenPier.app 2>&1 | grep Signature` prints `Signature=adhoc`. Download the `.dmg` in a browser and walk the four steps with the real macOS. If the real words differ, fix `docs/signing.md`, README and `scripts/install.sh` together.
4. Owner: save the screenshot as `docs/screenshots/first-open.png`.

## WO-6.4 README and pictures

Open: `README.md` in GitHub (after the push) in light and in dark appearance. Before the push, open the 14 PNGs in `docs/screenshots/`.

1. Order is: name and tagline, three badges, hero picture, three lines (what it is, who it is for, what it is not), Install (one line, manual path, first-open note with the four steps), What it does (six items), Works with, How it compares (with the caveat sentence), Development (four commands), More (roadmap, security, license).
2. No feature the app does not have. No "coming soon". Each of the six items names a screen that exists after iteration 3.
3. Pictures, compare each with the mockup picture in `docs/plan/design/shots/`:
   1. `hero-light.png` with `problem-inspector-light.png`: Containers list with a problem open in the inspector.
   2. `containers-*` with `containers-*`: table columns, tinted problem lines, primary button is the header's `New`.
   3. `doctor-*` with `doctor-*`.
   4. `run-*` with `run-sheet-*`: the sheet `Run postgres:16` over the Images list.
   5. `networks-*` has no mockup pair and no mockup picture: compare it with `04-design-spec.md` section 7.5, last item: the sheet `Test a connection` with From, To, Port and `Check`.
   6. `engine-switcher-*` with `engine-switcher-*`: the menu open from the header.
   7. `setup-*` with `setup-*`.
4. In the pictures: no debug text, no scrollbars in odd places, no mouse cursor, no open menu left over from another shot. Light and dark differ (not two copies of the same picture). Same size for all 14.
5. `Works with` has only engines someone really tried on a Mac (owner decision). `How it compares` is the table from `03-review-product.md` P2, same caveat.
6. Run `node scripts/readme-shots.mjs --out /tmp/x && node scripts/shots-fresh.mjs /tmp/x` yourself: 14 `ok` lines. Then change one word in a screen on purpose, rerun: the matching picture must report a difference (proves the check can fail). Revert.
7. Cheats: pictures cropped or edited by hand (the script is the only source: rerun and compare file sizes); a click in `scripts/readme-shots.mjs` that uses a class name where a button name was given, or a screen changed so that the script's click works; a raised threshold in `shots-fresh.mjs` (it must be 0.005); the CI job `shots-fresh` missing or set to `continue-on-error`.
8. Not verified: that `shots-fresh` is green on the macOS runner. First CI run decides; a failure under 5 percent is a font difference to discuss, not to hide.

## WO-6.6 Launch checklist

1. `docs/plan/launch-checklist.md`: 12 numbered launch items in the order of `06` section 8, each with its proof. Item 10 has the exact sentence for old installs. Item 11 (tables are true today) is the one addition: it is there because the README claims engines.
2. Read it as the owner at 2 am: can each item be done and proved without asking anyone?

## What this iteration did NOT prove

1. No workflow was run: `release.yml`, `install-smoke.yml`, `shots-fresh` and the `ci.yml` changes.
2. The updater has never updated anything.
3. The `.dmg` has never been opened on a clean Mac, and the Intel build has never been opened on an Intel Mac.
4. The first-open words were written from the current macOS flow and are not checked on this Mac.
5. The names of `tauri-action`'s output files (`.app.tar.gz`, `.sig`) are assumed; the draft check will say if they differ.

## Sign-off

All boxes above ticked, the script has no `FAIL`, and the owner has seen items 3.9, 6.2b.10, 6.3.5, 6.5.3 and 6.5.4 with their own eyes: then iteration 7 is done and the launch checklist is the owner's next document.
