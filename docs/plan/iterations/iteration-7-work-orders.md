# Iteration 7: work orders

Read `../HANDOFF.md` first. It is the contract. Format of a work order: `README.md` in this folder.

## What this iteration delivers

1. The repo is one people can trust in two minutes: license, security and conduct files, issue and PR templates, a roadmap, dependency updates.
2. A tag push builds a draft release with a signed update, fixed-name `.dmg` files and checksums; the app can check for and install updates; one line installs it.
3. A README whose pictures are made by a script from the app, a launch checklist for the owner, and the ad-hoc signing story told honestly.

## Order

Work orders, in this order: WO-6.1, WO-6.2a, WO-6.2b, WO-6.3, WO-6.5, WO-6.4, WO-6.6. (WO-6.5 comes before WO-6.4 because the README first-launch text and `docs/signing.md` say the same thing, and 6.5 writes it first.)

Plan task 6.2 is split in two so each pull request can be read: WO-6.2a puts the updater into the app (plan 4.0), WO-6.2b is the config, the workflow and the release tools (plan 4.1 to 4.4).

## Rules that apply to every work order here

1. **You never push, never tag, never publish a release, never run a workflow, never touch a key or a secret, never open `private.key`.** (HANDOFF rules 8 and 10.) Every step that needs GitHub, a key or a secret is under "Owner steps" at the end of its work order. The owner does those by hand.
2. **The workflows cannot be run by you.** They are checked by: a YAML parse (`ruby -ryaml`), `actionlint` when it is installed, `scripts/release-check.mjs` (text rules), and a read against the docs listed in the work order. Every workflow in this iteration is marked **Not verified: never run.** Say so in the pull request. Do not write "tested" anywhere.
3. Plain English, no em dashes, no people's names. The only account name allowed is the repo owner's in URLs: `BitVerseNomad`.
4. **There are no GitHub pull requests** (iteration 2 convention). Where a step says "pull request", write it in the file `docs/plan/iterations/pr/wo-<id>.md`, with the "Pull request title" as its first line. Each work order is on branch `wo-<id>` and is merged locally with `git merge --no-ff`.
5. `scripts/check-all.sh` runs every `scripts/check-*.mjs` in both engines. Scripts in this iteration that are not browser checks or need the GitHub CLI are therefore named without that prefix (`release-check.mjs`, `release-draft-check.mjs`, `shots-fresh.mjs`). The one browser check this iteration adds is `scripts/check-updates.mjs`.
6. `scripts/not-migrated.json` must not change in this iteration. This iteration has no screen work except Settings, General and Updates (WO-6.2a), which are already off the list after iteration 3.

## Sources looked up for this iteration

1. Tauri 2 updater plugin: https://v2.tauri.app/plugin/updater/ (install, `createUpdaterArtifacts`, `plugins.updater.pubkey` and `endpoints`, `latest.json` format, signing variables).
2. Tauri 2 updater JavaScript API: https://v2.tauri.app/reference/javascript/updater/ (`check()`, `Update` with `version`, `currentVersion`, `body`, `downloadAndInstall`; `DownloadEvent` shapes).
3. Tauri 2 process plugin: https://v2.tauri.app/plugin/process/ (`relaunch()`, permission `process:default`).
4. `tauri-action`: https://github.com/tauri-apps/tauri-action (inputs `tagName`, `releaseName`, `releaseBody`, `releaseDraft`, `prerelease`, `args`, `uploadUpdaterJson` default true; outputs `releaseId`, `artifactPaths`, `appVersion`; current tag is `v1`, and `v1.0.0` is commit `1deb371b0cd8bd54025b384f1cd735e725c4060f`).
5. Dependabot options: https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference
6. Issue forms: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms
7. Contributor Covenant 2.1: https://www.contributor-covenant.org/version/2/1/code_of_conduct/

---

## WO-6.1 The repo says who may use it, how to report a problem, and how to help

**Needs:** iterations 1 to 6 merged.

**Why:** No `LICENSE`, no security policy, no templates (product review P6, P9.2). GitHub's "Community standards" page must show every item ticked.

**Read first:**
1. `../06-open-source-launch.md` section 2.
2. `../08-feature-gaps.md` sections 4 and 5 (the "Next", "Later" and "never" lists that ROADMAP.md is made from).
3. `../03-review-product.md` P3 and P8.4.
4. `CONTRIBUTING.md` (today's file, you replace it), `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/feedback.md`.

### Starting state

Run each command. If the output differs, stop and report.

1. `ls LICENSE SECURITY.md CODE_OF_CONDUCT.md ROADMAP.md 2>&1 | grep -c "No such file"` prints `4`.
2. `ls .github/ISSUE_TEMPLATE` prints `feedback.md` and nothing else (it may print `bug.yml` etc. only if this work order was started before; then stop).
3. `ls .github` includes `pull_request_template.md` (lowercase) and `workflows`.
4. `git ls-files | grep -iE '\.key(\.pub)?$'` prints nothing (task 0.1 is done).
5. `grep -n "node-version" .github/workflows/ci.yml | head -3` prints `node-version: 22` on each job line (decided).
6. `test -f docs/security-model.md && echo yes || echo no` prints `yes` or `no`. Write which, you use it in step 2.
7. `test -f docs/problems.md && echo yes || echo no` prints `yes` or `no` (used in WO-6.4).

### Do not touch

1. Everything under `src/` and `src-tauri/`.
2. `.github/workflows/`.
3. Hard limits: no push, no tag, no release, no workflow run, no key or secret, never open `private.key`.

### Steps

1. Create `LICENSE` with exactly this content:

```
MIT License

Copyright (c) 2026 OpenPier contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

2. Create `SECURITY.md` with this content. If step 6 of Starting state printed `yes`, also add, after the "What is in scope" list, the line `The list of what the app may run, and what it refuses, is in [docs/security-model.md](docs/security-model.md).` If it printed `no`, add nothing.

````markdown
# Security

## Report a problem

Use GitHub's private reporting: open the **Security** tab of this repository and click **Report a vulnerability**. Please do not open a public issue for a security problem.

You will get a first reply within 7 days.

## What is in scope

1. The OpenPier app.
2. The updater (how the app checks for and installs a new version).
3. The install script, `scripts/install.sh`.

Out of scope: problems in Docker, Colima, OrbStack, Docker Desktop, Podman, Rancher Desktop or macOS themselves. Report those to their own projects.

## The signing key

A signing key that was committed to this repository before the first OpenPier release is public. It is not trusted. Releases from the first OpenPier release on are signed with a new key, and the app only trusts the new key.

Versions 0.1 and 0.2 had no working updater, so there is nothing to revoke. If you have one of them, replace it by hand with the latest release.

## Updates

Each update is signed. The app installs an update only when its signature matches the public key built into the app.
````

3. Create `CODE_OF_CONDUCT.md` with this content:

````markdown
# Code of conduct

OpenPier follows the [Contributor Covenant, version 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Read it there. It applies to every issue, pull request, discussion and review in this project.

In short:

1. Be kind and patient with people who are new.
2. Disagree about the work, never about the person.
3. No harassment, no insults, no personal attacks.
4. Do not publish other people's private information.

## Reporting

Report a problem privately: open the **Security** tab of this repository and click **Report a vulnerability**. Say that it is about conduct. Only the maintainers see it.

The maintainers decide what happens next, as the Covenant describes, and reply within 7 days.
````

4. Create `ROADMAP.md` with this content:

````markdown
# Roadmap

This is the only roadmap. If an idea is not here, open a feature request.

## Now

The first release. It is done when every item works on a real Mac.

1. Containers, images, volumes and networks, on any Docker engine you have.
2. Logs, a shell, stats and settings for a container.
3. Doctor: it tells you what is wrong in plain words and fixes it, after it asks.
4. Guided Run and Pull.
5. A switcher for every Docker engine on your Mac.
6. Machine controls for Colima: start, stop, resize, folders.
7. First-run setup that installs what is missing.
8. Kubernetes, read only.
9. Bring your volumes over from Docker Desktop.
10. Projects: several Compose projects side by side, without clashes.
11. Menu bar item, notifications, better logs, Copy details, a public list of every problem the app can explain, private registries, a page for each image, start at login.

## Next

In this order, by value for the effort.

1. Files: browse the files of a container or a volume, read only, and save a copy to your Mac.
2. Change a container: edit ports, environment, restart rule and memory limit, with the new command shown first.
3. Volume backup: save a volume to a file, restore it, copy it to another engine.
4. Build an image from a folder, with live output.
5. Push to a registry.
6. Local names for projects, such as `web.billing.localhost`, instead of `localhost:8081`.
7. Machine over time: CPU, memory and disk for the last hour.
8. A warning when an image runs under emulation on Apple Silicon.
9. Company networks: proxy, certificates and registry mirrors, set once.
10. A Homebrew tap (our own tap, not the official cask list, which needs a notarised app).

## Later

1. Kubernetes actions: restart, scale, logs across pods.
2. Security scan through an optional tool you install.
3. Machine controls for engines other than Colima, one engine at a time, when someone needs it.
4. Dev Container support.
5. One machine per project.
6. Windows and Linux.
7. Other languages.
8. A command-line companion.
9. Links that open the app on a container.
10. An in-app terminal.

## Never, unless we decide again in public

1. Telemetry without an explicit opt-in.
2. A plugin system.
3. A chat assistant.
4. Storing registry passwords or tokens in the app.
5. Managing fleets of remote servers.
````

5. Replace `CONTRIBUTING.md` with this content (`git rm` is not needed; overwrite the file):

````markdown
# Contributing to OpenPier

Thank you for helping. This page is all you need to start.

## What to install

1. Node 22.6 or newer (the tests run TypeScript directly).
2. Rust, stable (`rustup`).
3. Xcode command line tools: `xcode-select --install`.

## Run it

```
npm ci
npm run preview        # the app in your browser with fake data, no engine needed
npm run tauri dev      # the real app
```

`npm run preview` opens on http://localhost:4173. Add `?scenario=design` to see the data the design uses.

## Check your change

Run all of these before you open a pull request:

```
npm run lint
npx tsc --noEmit
npm test
cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
cd .. && npm run check
```

`npm run check` runs every browser check in Chromium and WebKit. The app ships in WebKit, so both must pass.

## One pull request, one change

1. Branch from `main`.
2. One change per pull request. Say what a user can now do, not how the code does it.
3. A change on screen needs a picture, light and dark, next to the mockup it should match.
4. Never weaken a test to make it pass. If a test is wrong, say why in its own commit.

## Where the design lives

`docs/plan/design/`: the stylesheet `openpier.css`, the mockup `mockup.html`, and pictures of every screen in `shots/`. The rules for every screen are in `AGENTS.md`. Do not add a colour, a size or a word that is not in the design.

## When reviews happen

One maintainer reviews, on weekends. Expect a first reply within 7 days. If a pull request waits longer, say so in a comment.

## Security and conduct

1. Security problems: see [SECURITY.md](SECURITY.md). Do not open a public issue.
2. Behaviour: see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
3. What we plan to build, and never will: [ROADMAP.md](ROADMAP.md).
````

6. `git rm .github/ISSUE_TEMPLATE/feedback.md`.

7. Create `.github/ISSUE_TEMPLATE/bug.yml`:

```yaml
name: Bug
description: Something is broken, or does not do what you expected
labels: ["bug"]
body:
  - type: textarea
    id: happened
    attributes:
      label: What happened
      description: Say what you saw. A screenshot helps a lot.
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: What you expected
    validations:
      required: true
  - type: textarea
    id: details
    attributes:
      label: Engine and version
      description: In OpenPier open Settings, then About, then click Copy details, and paste here. It holds no container names, no paths and no environment values.
    validations:
      required: true
  - type: input
    id: macos
    attributes:
      label: macOS version
      placeholder: "for example 15.1"
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps
      description: What to click, in order, to see it again.
    validations:
      required: true
```

8. Create `.github/ISSUE_TEMPLATE/feature.yml`:

```yaml
name: Feature
description: Something you need that OpenPier does not do
labels: ["enhancement"]
body:
  - type: textarea
    id: problem
    attributes:
      label: The problem
      description: What are you trying to do, and what stops you?
    validations:
      required: true
  - type: input
    id: who
    attributes:
      label: Who has it
      placeholder: "for example: anyone who runs several projects"
    validations:
      required: true
  - type: textarea
    id: today
    attributes:
      label: What you do today
    validations:
      required: true
```

9. Create `.github/ISSUE_TEMPLATE/config.yml`:

```yaml
blank_issues_enabled: false
contact_links:
  - name: Questions and ideas
    url: https://github.com/BitVerseNomad/openpier/discussions
    about: Ask a question or talk about an idea before you open an issue.
```

10. Rename the PR template. APFS ignores case, so go through a third name:
    `git mv .github/pull_request_template.md .github/pr-template.tmp && git mv .github/pr-template.tmp .github/PULL_REQUEST_TEMPLATE.md`
    Then overwrite `.github/PULL_REQUEST_TEMPLATE.md` with:

````markdown
## What changed for the user
<!-- One or two lines, in the user's words. What can they do now? -->

## How it was checked
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm test`
- [ ] `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` (in `src-tauri`)
- [ ] `npm run check` (Chromium and WebKit)

## Screenshots
<!-- Any change on screen: light and dark, next to the mockup picture it should match. Write "none" if nothing changed on screen. -->

## README
- [ ] The README and its pictures are still true (`node scripts/readme-shots.mjs`), or nothing on screen changed
````

11. Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      minor-and-patch:
        patterns: ["*"]
        update-types: ["minor", "patch"]
  - package-ecosystem: "cargo"
    directory: "/src-tauri"
    schedule:
      interval: "weekly"
    groups:
      minor-and-patch:
        patterns: ["*"]
        update-types: ["minor", "patch"]
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      minor-and-patch:
        patterns: ["*"]
        update-types: ["minor", "patch"]
```

12. Check your work with the commands in "Done when".

**Not verified:** the exact `package-ecosystem` names `cargo` and `github-actions`, and the `contact_links` keys in `config.yml`, were taken from GitHub's documentation index and general knowledge, not from a page that printed them. GitHub reports a bad file on the Dependabot tab and on the template chooser. Owner step 5 checks both.

### Tests to write first

None. The files are text. They are checked by the commands below and by `scripts/release-check.mjs` (WO-6.2b).

### Done when

1. `head -3 LICENSE` prints `MIT License`, an empty line, `Copyright (c) 2026 OpenPier contributors`.
2. `for f in .github/ISSUE_TEMPLATE/bug.yml .github/ISSUE_TEMPLATE/feature.yml .github/ISSUE_TEMPLATE/config.yml .github/dependabot.yml; do ruby -ryaml -e 'YAML.load_file(ARGV[0])' "$f" && echo "ok $f"; done` prints four `ok` lines.
3. `git ls-files .github | grep -i "pull_request_template.md"` prints `.github/PULL_REQUEST_TEMPLATE.md` (capitals) and nothing in lowercase.
4. `grep -c "Contributor Covenant" CODE_OF_CONDUCT.md` prints a number above 0.
5. `grep -E "^## (Now|Next|Later|Never)" ROADMAP.md | wc -l` prints `4`.
6. `grep -rn "—" LICENSE SECURITY.md CODE_OF_CONDUCT.md ROADMAP.md CONTRIBUTING.md .github/ISSUE_TEMPLATE .github/PULL_REQUEST_TEMPLATE.md` prints nothing.
7. The gate in `../HANDOFF.md` section 5.

### Owner steps

1. In the repository settings on GitHub: set the description to the tagline `The open-source desktop app for your containers. It works with the engine you already have, shows what is wrong in plain words, and fixes it.` and the topics `docker`, `containers`, `colima`, `tauri`, `macos`, `desktop-app`.
2. Turn on Discussions, private vulnerability reporting, and secret scanning with push protection.
3. Protect `main`: pull request required, CI required (after the CI workflow has run once, so its check name can be picked).
4. Decide if you can keep the promise "first reply within 7 days, reviews on weekends" (in `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`). If not, change the number in all three files.
5. Open https://github.com/BitVerseNomad/openpier/issues/new/choose and check that Bug and Feature show and blank issues do not. Open the Dependabot tab and check there is no error.
6. Open the "Community standards" page (Insights, Community Standards). Every item must be ticked. If one is not, tell the plan's author which one.
7. Optional: add a contact e-mail for conduct reports to `CODE_OF_CONDUCT.md`. Until then the private reporting form is the contact.

**Pull request title:** `wo-6.1: License, security policy, conduct, roadmap and templates`

---

## WO-6.2a The app can check for an update, install it and restart

**Needs:** iteration 3 (`src/settings/Updates.tsx` exists with a `Version` row and no `Check now`, WO-3.9) and iteration 6 (`src/lib/settings.ts` and `src/lib/useSetting.ts` exist, WO-8.11).

**Why:** The updater plugin is not installed, so the app never checks for updates (E5 item 4). WO-3.9 left `Check now`, the release notes and the General switch `Check for updates automatically` for this task.

**Words:** the texts quoted in steps 4, 9 and 10 are the design (spec section 9, first paragraph): build them letter for letter. The button is called `Check now` (the spec wins over `06`).

**Read first:**
1. https://v2.tauri.app/plugin/updater/ and https://v2.tauri.app/plugin/process/ (the API calls below come from these), https://v2.tauri.app/reference/javascript/updater/ (`check()`, `Update`, `DownloadEvent`).
2. `../04-design-spec.md` sections 6.8, 6.10, 7.8, 9.
3. `src/settings/Updates.tsx`, `src/settings/General.tsx`, `src/lib/settings.ts`, `src/lib/useSetting.ts`.
4. `src/ui/Banner.tsx`, `src/ui/ConfirmDialog.tsx`, `src/ui/Button.tsx`, `src/ui/Switch.tsx`, `src/ui/Progress.tsx` (components are imported from `src/ui` since iteration 5). Their props, from iteration 1 (WO-1.3a and WO-1.3b), are:
   1. `Banner(props: { tone: "bad" | "warn" | "info" | "ok"; title?: string; children?; actions?; className? })` (no `title` gives the one-line banner).
   2. `useConfirm(): (options: { title: string; body: ReactNode; command?: string; confirm: string; danger?: boolean }) => Promise<boolean>` (inside `ConfirmProvider`; its Cancel button is built in).
   3. `Switch(props: { checked: boolean; onChange: (checked: boolean) => void; "aria-labelledby": string; disabled?: boolean })`.
   4. `Button` with `variant`, `size`, `busy`, `icon`.
   5. `Progress(props: { value: number | null; max?: number; "aria-label": string })`, `max` defaults to 1; a `null` value shows as busy.
   Print the real files and use the real prop names. If one differs, use the real one and write the difference in the pull request.
5. `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`, `vite.preview.config.ts`, `preview/mock.ts`.

### Starting state

1. `grep -c "tauri-plugin-updater\|tauri-plugin-process" src-tauri/Cargo.toml` prints `0`.
2. `grep -rn "tauri::Builder::default()" src-tauri/src` prints exactly one line. Write the file name down: it is `<BUILDER_FILE>` below.
3. `cat src-tauri/capabilities/default.json` shows a `permissions` array. Write down its current items.
4. `grep -n "Version" src/settings/Updates.tsx` prints the one `Version` row of WO-3.9, and `grep -c "Check now" src/settings/Updates.tsx` prints `0`. If `Check now` is already there, stop and report.
5. `grep -n "Check for updates automatically" src/settings/General.tsx` prints either nothing (expected: WO-3.9 did not build it) or the row. Write which. If the row is there, step 8 only wires it; if not, step 8 adds it.
6. `ls src/lib/settings.ts src/lib/useSetting.ts` prints both. `grep -n "export function useSetting" src/lib/useSetting.ts` prints the signature `useSetting(name: string): [string | null, (value: string | null) => void]`.
7. `grep -n "tauri-apps" vite.preview.config.ts` prints the two alias lines `"@tauri-apps/api/core": mock,` and `"@tauri-apps/api/event": mock,` inside `resolve.alias`.
8. `sed -n 1,30p scripts/lib/check.mjs` prints `open(path, { width, height, colorScheme })` returning a Playwright page, `check(cond, message)` and `done()`.
9. `grep -n "Updates shows the version" scripts/check-settings.mjs` prints one line (WO-3.9's line; it asserts nothing about `Check now`, and this work order does not touch it).
10. `grep -n "initSettings" src/main.tsx` prints the call (WO-8.11).
11. `npm test` passes.

### Do not touch

1. Any other Settings section, any other screen.
2. `src-tauri/tauri.conf.json` (WO-6.2b does it).
3. Hard limits: no push, no tag, no release, no workflow run, no key or secret, never open `private.key`.

### Tests to write first

Write `src/lib/updater.test.ts` first, run it, see it fail because `./updater.ts` does not exist, then write the code. It runs under `node --test` like the other `src/lib/*.test.ts` files.

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createUpdater, UPDATER_WORDS } from "./updater.ts";
import type { DownloadEvent, UpdateHandle } from "./updater.ts";

const handle = (over: Partial<UpdateHandle> = {}): UpdateHandle => ({
  version: "1.1.0",
  currentVersion: "1.0.0",
  body: "Now you can see why a container stopped.",
  downloadAndInstall: async () => {},
  ...over,
});

test("Given no update is out, when checking, then the state is none", async () => {
  const u = createUpdater({ check: async () => null, relaunch: async () => {} });
  await u.checkNow();
  assert.deepEqual(u.getState(), { kind: "none" });
});

test("Given an update is out, when checking, then the state is available with versions and notes", async () => {
  const u = createUpdater({ check: async () => handle(), relaunch: async () => {} });
  await u.checkNow();
  assert.deepEqual(u.getState(), {
    kind: "available",
    version: "1.1.0",
    currentVersion: "1.0.0",
    notes: "Now you can see why a container stopped.",
  });
});

test("Given the check throws, when checking, then the state is failed during check with a title, the evidence and a next step", async () => {
  const u = createUpdater({ check: async () => { throw new Error("network down"); }, relaunch: async () => {} });
  await u.checkNow();
  assert.deepEqual(u.getState(), {
    kind: "failed",
    during: "check",
    title: "Could not check for updates",
    body: "Network down. Check your connection, then try again.",
  });
});

test("Given the evidence ends with a full stop, when it fails, then the body has no double full stop", async () => {
  const u = createUpdater({ check: async () => { throw new Error("timed out."); }, relaunch: async () => {} });
  await u.checkNow();
  const s = u.getState();
  assert.equal(s.kind === "failed" && s.body.includes(".."), false);
});

test("Given an update is available, when installing, then it reports percent from the progress events and relaunches once", async () => {
  let relaunched = 0;
  const seen: Array<number | null> = [];
  const events: DownloadEvent[] = [
    { event: "Started", data: { contentLength: 200 } },
    { event: "Progress", data: { chunkLength: 50 } },
    { event: "Progress", data: { chunkLength: 150 } },
    { event: "Finished" },
  ];
  let u!: ReturnType<typeof createUpdater>;
  u = createUpdater({
    check: async () =>
      handle({
        downloadAndInstall: async (on) => {
          for (const e of events) {
            on?.(e);
            const s = u.getState();
            if (s.kind === "installing") seen.push(s.percent);
          }
        },
      }),
    relaunch: async () => { relaunched += 1; },
  });
  await u.checkNow();
  await u.install();
  assert.deepEqual(seen, [null, 25, 100, 100]);
  assert.equal(relaunched, 1);
});

test("Given the download fails, when installing, then the state is failed during install and the app does not relaunch", async () => {
  let relaunched = 0;
  const u = createUpdater({
    check: async () => handle({ downloadAndInstall: async () => { throw new Error("disk full"); } }),
    relaunch: async () => { relaunched += 1; },
  });
  await u.checkNow();
  await u.install();
  assert.deepEqual(u.getState(), {
    kind: "failed",
    during: "install",
    title: "Could not install the update",
    body: "Disk full. Your current version still works. Try again.",
  });
  assert.equal(relaunched, 0);
});

test("Given the install failed, when installing again, then it tries the same update again", async () => {
  let calls = 0;
  const u = createUpdater({
    check: async () => handle({ downloadAndInstall: async () => { calls += 1; if (calls === 1) throw new Error("reset"); } }),
    relaunch: async () => {},
  });
  await u.checkNow();
  await u.install();
  await u.install();
  assert.equal(calls, 2);
});

test("Given a check is running, when checking again, then the plugin check is called once", async () => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const u = createUpdater({ check: async () => { calls += 1; await gate; return null; }, relaunch: async () => {} });
  const first = u.checkNow();
  const second = u.checkNow();
  release();
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});

test("Given nothing was checked, when installing, then nothing happens", async () => {
  const u = createUpdater({ check: async () => null, relaunch: async () => { throw new Error("must not relaunch"); } });
  await u.install();
  assert.deepEqual(u.getState(), { kind: "idle" });
});

test("Given a listener, when the state changes, then it is called, and not after it unsubscribes", async () => {
  const u = createUpdater({ check: async () => null, relaunch: async () => {} });
  let n = 0;
  const off = u.subscribe(() => { n += 1; });
  await u.checkNow(); // checking, then none
  assert.equal(n, 2);
  off();
  await u.checkNow();
  assert.equal(n, 2);
});

test("The words object has every state's text", () => {
  assert.equal(UPDATER_WORDS.checking, "Checking…");
  assert.equal(UPDATER_WORDS.upToDate, "You are up to date.");
  assert.equal(UPDATER_WORDS.downloading(null), "Downloading…");
  assert.equal(UPDATER_WORDS.downloading(40), "Downloading, 40%");
  assert.equal(UPDATER_WORDS.available("1.1.0"), "OpenPier 1.1.0 is out");
  assert.equal(UPDATER_WORDS.youHave("1.0.0"), "You have 1.0.0.");
});
```

### Steps

1. Install the plugins. Run, in this order:
   1. `npm install @tauri-apps/plugin-updater@^2 @tauri-apps/plugin-process@^2`
   2. `cd src-tauri && cargo add tauri-plugin-updater@2 tauri-plugin-process@2 && cd ..`
   (Plan 4.0 says `npm run tauri add updater`. That command edits files in ways that depend on the repo layout, so this recipe makes the same edits by hand. The result is the same: see the docs page above.)
2. In `<BUILDER_FILE>`, find `tauri::Builder::default()` and add two lines right after it, before `.invoke_handler(`:

   ```rust
   .plugin(tauri_plugin_updater::Builder::new().build())
   .plugin(tauri_plugin_process::init())
   ```

   Keep every other line as it is. (If iteration 6 already added `.plugin(...)` lines, put these two after them.)
3. In `src-tauri/capabilities/default.json`, add `"updater:default"` and `"process:default"` to the `permissions` array. Keep the items already there. (`updater:default` allows check, download, install; `process:default` allows exit and restart. Source: the two plugin pages above.)
4. Create `src/lib/updater.ts` in full:

```ts
// The update flow. The plugin is passed in (see updaterStore.ts) so this file can be tested without Tauri.
// The words are final (spec section 9: the work order's quoted text is the design). UPDATER_WORDS is the one place they live.

export type DownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

export type UpdateHandle = {
  version: string;
  currentVersion: string;
  body?: string;
  downloadAndInstall: (onEvent?: (event: DownloadEvent) => void) => Promise<void>;
};

export type UpdaterDeps = {
  check: () => Promise<UpdateHandle | null>;
  relaunch: () => Promise<void>;
};

export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "none" }
  | { kind: "available"; version: string; currentVersion: string; notes: string }
  | { kind: "installing"; percent: number | null }
  | { kind: "failed"; during: "check" | "install"; title: string; body: string };

// What happened (the title), the evidence, the next step (the body): spec section 9, rule 6.
const sentence = (evidence: string) => {
  const plain = evidence.replace(/\.+$/, "");
  return plain.charAt(0).toUpperCase() + plain.slice(1);
};

export const UPDATER_WORDS = {
  checking: "Checking…",
  upToDate: "You are up to date.",
  available: (version: string) => `OpenPier ${version} is out`,
  youHave: (current: string) => `You have ${current}.`,
  downloading: (percent: number | null) => (percent === null ? "Downloading…" : `Downloading, ${percent}%`),
  checkFailedTitle: "Could not check for updates",
  checkFailedBody: (evidence: string) => `${sentence(evidence)}. Check your connection, then try again.`,
  installFailedTitle: "Could not install the update",
  installFailedBody: (evidence: string) => `${sentence(evidence)}. Your current version still works. Try again.`,
} as const;

export type Updater = {
  getState: () => UpdateState;
  subscribe: (listener: () => void) => () => void;
  checkNow: () => Promise<void>;
  install: () => Promise<void>;
};

const evidenceOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function createUpdater(deps: UpdaterDeps): Updater {
  let state: UpdateState = { kind: "idle" };
  let handle: UpdateHandle | null = null;
  const listeners = new Set<() => void>();
  const set = (next: UpdateState) => {
    state = next;
    listeners.forEach((fn) => fn());
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async checkNow() {
      if (state.kind === "checking" || state.kind === "installing") return;
      set({ kind: "checking" });
      handle = null;
      try {
        const found = await deps.check();
        if (!found) {
          set({ kind: "none" });
          return;
        }
        handle = found;
        set({ kind: "available", version: found.version, currentVersion: found.currentVersion, notes: found.body ?? "" });
      } catch (e) {
        set({ kind: "failed", during: "check", title: UPDATER_WORDS.checkFailedTitle, body: UPDATER_WORDS.checkFailedBody(evidenceOf(e)) });
      }
    },
    async install() {
      const canInstall = state.kind === "available" || (state.kind === "failed" && state.during === "install");
      if (!canInstall || !handle) return;
      const current = handle;
      let total: number | null = null;
      let received = 0;
      set({ kind: "installing", percent: null });
      try {
        await current.downloadAndInstall((event) => {
          if (event.event === "Started") total = event.data.contentLength ?? null;
          if (event.event === "Progress") {
            received += event.data.chunkLength;
            if (total) set({ kind: "installing", percent: Math.min(100, Math.round((received * 100) / total)) });
          }
        });
        await deps.relaunch();
      } catch (e) {
        set({ kind: "failed", during: "install", title: UPDATER_WORDS.installFailedTitle, body: UPDATER_WORDS.installFailedBody(evidenceOf(e)) });
      }
    },
  };
}
```

   Run `node --experimental-strip-types --no-warnings --test src/lib/updater.test.ts`. Expected: `# pass 11`, `# fail 0`. (The install test expects `seen` to be `[null, 25, 100, 100]`: the first event is `Started`, where the state is still installing with `percent: null`; the two `Progress` events give 25 and 100; `Finished` leaves 100.)

5. Create `src/lib/updaterStore.ts` in full. This is the only file that imports the plugins:

```ts
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { createUpdater } from "./updater";

export const updater = createUpdater({ check: () => check(), relaunch: () => relaunch() });
```

   `check()` returns an `Update` with `version`, `currentVersion`, `body` and `downloadAndInstall(onEvent)`. That matches `UpdateHandle`. Run `npx tsc --noEmit`. If the types do not match, stop and report with the compiler output.

6. Create `src/lib/useUpdater.ts` in full:

```ts
import { useSyncExternalStore } from "react";
import { updater } from "./updaterStore";
import type { UpdateState } from "./updater";

export function useUpdater(): { state: UpdateState; checkNow: () => Promise<void>; install: () => Promise<void> } {
  const state = useSyncExternalStore(updater.subscribe, updater.getState);
  return { state, checkNow: updater.checkNow, install: updater.install };
}
```

7. Check once at start. The setting is `autoUpdateCheck` in the settings store of WO-8.11 (read it with `getSetting`; never read `localStorage` directly): `"0"` means off, anything else (including never set) means on. In the shell component that mounts once for the whole app (find it with `grep -rn "useEngines()" src/Shell.tsx src/App.tsx`; WO-8.12 uses the same place), add:

   ```tsx
   useEffect(() => {
     if (getSetting("autoUpdateCheck") !== "0") void updater.checkNow();
   }, []);
   ```

   with `import { getSetting } from "./lib/settings";` and `import { updater } from "./lib/updaterStore";`. The check runs once per start and its result waits in the store; Settings, Updates shows it when opened. Nothing else appears on screen. In the browser preview the fake plugin answers (step 8).

8. Preview support. The browser preview has no Tauri, so the two plugins need fakes. Create `preview/plugin-updater.ts`:

```ts
// Fake of @tauri-apps/plugin-updater for the browser preview.
// ?update=available  an update 1.1.0 is out (default is none)
// ?update=fails      an update is out and downloading it fails
const mode = typeof location !== "undefined" ? new URLSearchParams(location.search).get("update") ?? "none" : "none";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function check() {
  await sleep(300);
  if (mode !== "available" && mode !== "fails") return null;
  return {
    version: "1.1.0",
    currentVersion: "1.0.0",
    body: "Now you can see why a container stopped.",
    async downloadAndInstall(onEvent?: (e: unknown) => void) {
      onEvent?.({ event: "Started", data: { contentLength: 100 } });
      await sleep(300);
      onEvent?.({ event: "Progress", data: { chunkLength: 50 } });
      await sleep(300);
      if (mode === "fails") throw new Error("disk full");
      onEvent?.({ event: "Progress", data: { chunkLength: 50 } });
      onEvent?.({ event: "Finished" });
    },
  };
}
```

   Create `preview/plugin-process.ts`:

```ts
// Fake of @tauri-apps/plugin-process for the browser preview. Records that a restart was asked for.
export async function relaunch() {
  const w = window as unknown as { __relaunched?: number };
  w.__relaunched = (w.__relaunched ?? 0) + 1;
}
export async function exit() {}
```

   In `vite.preview.config.ts`, in `resolve.alias`, right after the line `"@tauri-apps/api/event": mock,` add:

```ts
        "@tauri-apps/plugin-updater": path.resolve(__dirname, "./preview/plugin-updater.ts"),
        "@tauri-apps/plugin-process": path.resolve(__dirname, "./preview/plugin-process.ts"),
```

9. **Settings, Updates.** Open `src/settings/Updates.tsx`. Keep its `Version` row exactly as it is. Under it add the rows of this table, using `useUpdater()` and `.setting` rows (`.text`, `.t`, `.d`), like the other sections. Take every text from `UPDATER_WORDS` where it has one.

   | State | What shows under the Version row |
   |---|---|
   | `idle` | A `.setting` row: `.t` `Updates`, and a Button `Check now` (default variant, size sm). |
   | `checking` | The same row with the Button `busy`; `.d` `Checking…`. |
   | `none` | The same row; `.d` `You are up to date.` |
   | `available` | The same row (button `Check now` stays). Then a `.setting` row: `.t` `OpenPier {version} is out`, `.d` `You have {currentVersion}.`, and a primary Button `Install and restart…`. Under it a `GroupCaption` `What is new` and the notes in a `Canvas` (selectable text). When the notes are empty, show the `.d` line `No release notes.` instead of the Canvas. |
   | `installing` | The `Install and restart…` Button becomes `Installing…` and is `busy`; `Check now` is disabled. `.d` line: `Downloading…` or `Downloading, {percent}%`. Under it `<Progress value={percent === null ? null : percent / 100} aria-label="Downloading the update" />`. |
   | `failed` | A `Banner tone="bad"` with `title` = the state's `title`, the state's `body` as children, and the action `Try again` (Button, xs): for `during: "check"` it calls `checkNow`; for `during: "install"` it calls `install`. |

   `Install and restart…` calls `const ask = useConfirm()` and `await ask({ title: "Install OpenPier {version}?", body: "OpenPier closes and opens again.", confirm: "Install and restart" })`; on `true` it calls `install()`. The dialog's Cancel is built in.

   The release notes go in a `Canvas` (spec 6.11), selectable.

   Do not use `style=`, a native `<button>`, or a colour. Run `npm run lint`.

10. **Settings, General: the switch.** Open `src/settings/General.tsx`.
    1. If Starting state 5 found the row, only bind it: its switch is `checked={autoCheck !== "0"}` and `onChange={(on) => setAutoCheck(on ? "1" : "0")}` with `const [autoCheck, setAutoCheck] = useSetting("autoUpdateCheck");` (import `useSetting` from `../lib/useSetting`).
    2. If not, add this row after the last existing `.setting` row of the section (copy the markup of the Theme row for the wrapper; import `Switch` from `../ui` and `useSetting` from `../lib/useSetting`). The setting is stored in the settings store of WO-8.11 (`src/lib/settings.ts`, key name `autoUpdateCheck`), never in a loose `localStorage` key:

    ```tsx
    <div className="setting">
      <div className="text">
        <div className="t" id="auto-update-title">Check for updates automatically</div>
        <div className="d">OpenPier looks for a new version when it opens.</div>
      </div>
      <Switch checked={autoCheck !== "0"} onChange={(on) => setAutoCheck(on ? "1" : "0")} aria-labelledby="auto-update-title" />
    </div>
    ```

    The title is from spec 7.8; the description is final.

11. Write the check lines for this work order in the new `scripts/check-updates.mjs` (step 12). Do not edit `scripts/check-settings.mjs`: WO-3.9's line says only "Updates shows the version" and stays true.

12. Write the browser check `scripts/check-updates.mjs` (runs in both engines). Use `open`, `check`, `done` from `scripts/lib/check.mjs`; `open(path)` returns the page. Lines, each `check(condition, message)`:

    1. Open `/?scenario=design&update=none#/settings/updates`. Click the button named `Check now`. Wait for text `You are up to date.`. Message: `updates: Check now says you are up to date when no update is out`.
    2. Open `/?scenario=design&update=available#/settings/updates`. Click `Check now`. Wait for `OpenPier 1.1.0 is out`. Messages: `updates: an update is announced with its version`; `updates: the current version is shown` (`You have 1.0.0.`); `updates: the release notes are shown` (`Now you can see why a container stopped.`).
    3. Click `Install and restart…`. A dialog named `Install OpenPier 1.1.0?` shows. Message: `updates: installing asks first`.
    4. Click `Cancel`. The dialog closes and `window.__relaunched` is `undefined`. Message: `updates: cancel installs nothing`.
    5. Click `Install and restart…` again, then the button `Install and restart` in the dialog. Wait up to 3 seconds until `window.__relaunched === 1`. Message: `updates: confirming installs and restarts once`.
    6. Open `/?scenario=design&update=fails#/settings/updates`. `Check now`, `Install and restart…`, confirm. Wait for text `Could not install the update`. Messages: `updates: a failed install says what happened and what to do` (the page also has `Your current version still works. Try again.`); `updates: a failed install does not restart` (`window.__relaunched` is `undefined`); `updates: Try again is offered` (a button named `Try again`).
    7. Keyboard: on the first page, focus the `Check now` button and press Enter. Wait for `You are up to date.`. Message: `updates: Check now works from the keyboard`.
    8. While installing (`update=available`, before it finishes), a `progress` element is on the page. Message: `updates: the download shows a progress bar`. To see it, make the fake download in `preview/plugin-updater.ts` wait 800 ms between events (raise both `sleep(300)` to `sleep(800)`) and read the element right after the confirm click.
    9. Open `/?scenario=design#/settings/general`. A switch named `Check for updates automatically` has `aria-checked="true"`. Click it: `aria-checked="false"`. Message: `updates: the automatic check switch is on by default and can be turned off`.

    Run `npm run check`. Expected: every line `ok`, no `FAIL`.

13. Run the gate.

### Done when

1. `node --experimental-strip-types --no-warnings --test src/lib/updater.test.ts 2>&1 | grep -E "^# (pass|fail)"` prints `# pass 11` and `# fail 0`.
2. `grep -c "tauri_plugin_updater::Builder::new().build()" <BUILDER_FILE>` prints `1`, and `grep -c "tauri_plugin_process::init()" <BUILDER_FILE>` prints `1`.
3. `grep -c '"updater:default"' src-tauri/capabilities/default.json` prints `1`; the same for `"process:default"`.
4. `grep -E "plugin-updater|plugin-process" package.json | wc -l` prints `2`; `grep -E "tauri-plugin-updater|tauri-plugin-process" src-tauri/Cargo.toml | wc -l` prints `2`.
5. `grep -c "Check now" src/settings/Updates.tsx` prints `1` or more; `grep -rn "Check for updates\"" src --include=*.tsx | grep -v automatically | grep -v test` prints nothing (the button label is `Check now`).
6. `PW_ENGINES=webkit sh scripts/check-all.sh 2>&1 | grep -E "check-updates|check-settings"` prints `webkit scripts/check-updates.mjs: 0` and `webkit scripts/check-settings.mjs: 0`.
7. `cd src-tauri && cargo clippy --all-targets -- -D warnings` passes, and `cargo test` passes.
8. The gate in `../HANDOFF.md` section 5.

**Not verified:** that `check()` and the real download work against a real release. Nothing in this repo can prove that before a release exists. WO-6.2b's checklist 4.4 item 4 is the real test. Say so in the pull request.

### Owner steps

1. After the first release is published, and again after the second: install the first one, open Settings, Updates, click `Check now`, see the new version, install, see the app restart on the new version. Do it for the first three releases at least.
2. Read the Updates and General texts once on a real Mac and send any word you would change to the plan's author.

**Pull request title:** `wo-6.2a: Check now, install and restart from Settings, Updates`

---

## WO-6.2b A tag builds a draft release with a signed update

**Needs:** WO-6.2a.

**Why:** The old workflow cannot produce a working update (E5): it writes a hand-made `latest.yml` with empty signatures and wrong names, and never passes the signing key. This replaces it with the documented `tauri-action` flow.

**Read first:**
1. `../06-open-source-launch.md` sections 4 and 6.
2. https://github.com/tauri-apps/tauri-action (inputs and outputs), https://v2.tauri.app/plugin/updater/ (`latest.json`, config).
3. `.github/workflows/release.yml` (you replace it), `.github/workflows/ci.yml`, `src-tauri/tauri.conf.json`, `scripts/check-version-sync.mjs`, `CHANGELOG.md` (top 40 lines).

### Starting state

1. `grep -c "latest.yml" .github/workflows/release.yml` prints a number above `0` (the old file is still there).
2. `node -p "const c=require('./src-tauri/tauri.conf.json'); [c.bundle.createUpdaterArtifacts, JSON.stringify(c.bundle.targets), c.bundle.macOS.signingIdentity, c.plugins.updater.endpoints[0]].join(' | ')"` prints `undefined | ["dmg"] | - | https://github.com/BitVerseNomad/...` (the repo name in the URL may be `container-ui` or `openpier`).
3. `node -p "require('./src-tauri/tauri.conf.json').plugins.updater.pubkey.slice(0,24)"` prints a string that is NOT `dW50cnVzdGVkIGNvbW1lbnQ6IG1p` followed by a key ending `...N0NU`. Check against the old key: `node -p "require('./src-tauri/tauri.conf.json').plugins.updater.pubkey === 'dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDdENzdERTZDN0U1NDJDNTQKUldSVUxGUitiTjUzZlVXcFB0K3NzL2xwN2krZzZXMStGR1daeitUdGJ4ajdDZ2NEdWhwYnB0RFIK'"` prints `false`. If it prints `true`, task 0.1 is not done: stop and report.
4. `node scripts/check-version-sync.mjs` prints three equal versions and exits 0. Write the version down.
5. `grep -n "node-version" .github/workflows/ci.yml | head -1` prints `node-version: 22` (decided: Node 22; `06` is already fixed). If it prints another number, stop and report.
6. `grep -n "uses:" .github/workflows/ci.yml` prints the `uses:` lines of CI. If they are commit hashes (40 hex characters, plan task 8.9), then `release.yml` must use the same hashes (step 4). If they are tags such as `@v4`, `release.yml` uses tags.
7. `grep -n "^## Unreleased" CHANGELOG.md` prints one line (WO-0.4 added it, with the two lines about the new name). If it prints nothing, stop and report: `bump.mjs` still works (it inserts a version heading above the newest entry), but the owner's notes would then not be under `## Unreleased`.
8. `grep -n "sha\|checksum" .github/workflows/release.yml` prints what the old workflow did about checksums (task 8.9 may have added some). Your new workflow replaces it; step 4 covers checksums.
9. `which actionlint ruby` prints a path for `ruby`. `actionlint` may be missing; that is fine.
10. `cargo` sees the same version as the others: `grep -m1 '^version' src-tauri/Cargo.toml`.

### Do not touch

1. `src-tauri/entitlements.plist`, `signingIdentity`, `hardenedRuntime` (WO-6.5 owns them).
2. Any file under `src/` except none (this work order edits no app code).
3. Hard limits: no push, no tag, no release, no workflow run, no key or secret, never open `private.key`. You write the workflow; the owner pushes the tag.

### Tests to write first

Write `scripts/release-tools.test.mjs` first (full content below). Run it; it fails because `scripts/lib/bump.mjs` and `scripts/lib/draft.mjs` do not exist. Then write them. Run: `node --test scripts/release-tools.test.mjs`. WO-6.3 appends install tests to the same file.

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  isVersion, setJsonVersion, setCargoTomlVersion, setCargoLockVersion,
  setChangelogHeading, changelogSection,
} from "./lib/bump.mjs";
import { checkDraft } from "./lib/draft.mjs";

test("Given a version string, when checked, then only x.y.z passes", () => {
  assert.equal(isVersion("1.0.0"), true);
  assert.equal(isVersion("v1.0.0"), false);
  assert.equal(isVersion("1.0"), false);
  assert.equal(isVersion("1.0.0-beta"), false);
});

test("Given a package.json text, when set, then only the first version changes and the layout stays", () => {
  const text = '{\n  "name": "openpier",\n  "version": "0.2.1",\n  "dep": { "version": "9.9.9" }\n}\n';
  assert.equal(
    setJsonVersion(text, "1.0.0", "package.json"),
    '{\n  "name": "openpier",\n  "version": "1.0.0",\n  "dep": { "version": "9.9.9" }\n}\n',
  );
});

test("Given a json text with no version, when set, then it throws", () => {
  assert.throws(() => setJsonVersion('{ "name": "x" }', "1.0.0", "x.json"), /could not find/);
});

test("Given a Cargo.toml, when set, then only the package version changes", () => {
  const text = '[package]\nname = "openpier"\nversion = "0.2.1"\n\n[dependencies]\nserde = { version = "1" }\n';
  assert.equal(
    setCargoTomlVersion(text, "1.0.0"),
    '[package]\nname = "openpier"\nversion = "1.0.0"\n\n[dependencies]\nserde = { version = "1" }\n',
  );
});

test("Given a Cargo.lock, when set, then only the openpier entry changes", () => {
  const text = 'name = "other"\nversion = "0.2.1"\n\n[[package]]\nname = "openpier"\nversion = "0.2.1"\n';
  assert.equal(
    setCargoLockVersion(text, "1.0.0", "openpier"),
    'name = "other"\nversion = "0.2.1"\n\n[[package]]\nname = "openpier"\nversion = "1.0.0"\n',
  );
});

test("Given a changelog with an Unreleased heading, when set, then it becomes the version and date", () => {
  const text = "# Changelog\n\n## Unreleased\n\n1. A thing.\n\n## 0.2.1 (2026-10-01)\n\n1. Old.\n";
  assert.equal(
    setChangelogHeading(text, "1.0.0", "2026-11-20"),
    "# Changelog\n\n## 1.0.0 (2026-11-20)\n\n1. A thing.\n\n## 0.2.1 (2026-10-01)\n\n1. Old.\n",
  );
});

test("Given a changelog with no Unreleased heading, when set, then a new heading goes above the newest entry", () => {
  const text = "# Changelog\n\nintro\n\n## Some entry\n\n1. A thing.\n";
  assert.equal(
    setChangelogHeading(text, "1.0.0", "2026-11-20"),
    "# Changelog\n\nintro\n\n## 1.0.0 (2026-11-20)\n\n## Some entry\n\n1. A thing.\n",
  );
});

test("Given a changelog that already has the version heading, when set, then it is unchanged", () => {
  const text = "# Changelog\n\n## 1.0.0 (2026-11-19)\n\n1. A thing.\n";
  assert.equal(setChangelogHeading(text, "1.0.0", "2026-11-20"), text);
});

test("Given a changelog, when reading a version's section, then it returns the text under its heading only", () => {
  const text = "# Changelog\n\n## 1.0.0 (2026-11-20)\n\n1. A thing.\n2. Another.\n\n## 0.2.1\n\n1. Old.\n";
  assert.equal(changelogSection(text, "1.0.0"), "1. A thing.\n2. Another.");
});

test("Given a changelog with an empty section, when reading it, then it throws", () => {
  const text = "# Changelog\n\n## 1.0.0 (2026-11-20)\n\n## 0.2.1\n\n1. Old.\n";
  assert.throws(() => changelogSection(text, "1.0.0"), /no notes/);
});

test("Given a changelog without the version, when reading it, then it throws", () => {
  assert.throws(() => changelogSection("# Changelog\n\n## 0.2.1\n\nx\n", "1.0.0"), /no section/);
});

const REPO = "BitVerseNomad/openpier";
const TAG = "v1.0.0";
const goodAssets = [
  "OpenPier_1.0.0_aarch64.dmg", "OpenPier_1.0.0_x64.dmg",
  "OpenPier_aarch64.app.tar.gz", "OpenPier_aarch64.app.tar.gz.sig",
  "OpenPier_x64.app.tar.gz", "OpenPier_x64.app.tar.gz.sig",
  "OpenPier-arm64.dmg", "OpenPier-arm64.dmg.sha256", "OpenPier-x64.dmg", "OpenPier-x64.dmg.sha256",
  "latest.json",
].map((name) => ({ name }));
const goodLatest = {
  version: "1.0.0",
  platforms: {
    "darwin-aarch64": { signature: "AAA", url: `https://github.com/${REPO}/releases/download/${TAG}/OpenPier_aarch64.app.tar.gz` },
    "darwin-x86_64": { signature: "BBB", url: `https://github.com/${REPO}/releases/download/${TAG}/OpenPier_x64.app.tar.gz` },
  },
};

test("Given a complete draft, when checked, then every result is ok", () => {
  const results = checkDraft({ repo: REPO, tag: TAG, assets: goodAssets, latestJson: goodLatest });
  assert.equal(results.every((r) => r.ok), true);
});

test("Given latest.json with an empty signature, when checked, then that platform fails", () => {
  const latest = structuredClone(goodLatest);
  latest.platforms["darwin-x86_64"].signature = "";
  const results = checkDraft({ repo: REPO, tag: TAG, assets: goodAssets, latestJson: latest });
  assert.equal(results.some((r) => !r.ok && /darwin-x86_64/.test(r.message)), true);
});

test("Given latest.json with another version, when checked, then the version result fails", () => {
  const latest = { ...goodLatest, version: "0.9.0" };
  const results = checkDraft({ repo: REPO, tag: TAG, assets: goodAssets, latestJson: latest });
  assert.equal(results.some((r) => !r.ok && /version/.test(r.message)), true);
});

test("Given a draft with a missing .sig, when checked, then the asset result fails", () => {
  const assets = goodAssets.filter((a) => a.name !== "OpenPier_x64.app.tar.gz.sig");
  const results = checkDraft({ repo: REPO, tag: TAG, assets, latestJson: goodLatest });
  assert.equal(results.some((r) => !r.ok && /\.sig/.test(r.message)), true);
});

test("Given no latest.json, when checked, then the checks do not crash and fail", () => {
  const results = checkDraft({ repo: REPO, tag: TAG, assets: goodAssets, latestJson: null });
  assert.equal(results.some((r) => !r.ok), true);
});
```

### Steps

1. Create `scripts/lib/bump.mjs` in full:

```js
// Pure helpers for scripts/bump.mjs and scripts/changelog-section.mjs. Tested in scripts/release-tools.test.mjs.

export const isVersion = (v) => /^\d+\.\d+\.\d+$/.test(v);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function replaceFirst(text, re, build, what) {
  const m = re.exec(text);
  if (!m) throw new Error(`bump: could not find ${what}`);
  return text.slice(0, m.index) + build(m) + text.slice(m.index + m[0].length);
}

// package.json and tauri.conf.json: the first "version" key, which is the top-level one.
export const setJsonVersion = (text, v, what) =>
  replaceFirst(text, /("version"\s*:\s*")[^"]*(")/, (m) => `${m[1]}${v}${m[2]}`, `"version" in ${what}`);

export const setCargoTomlVersion = (text, v) =>
  replaceFirst(text, /^(version\s*=\s*")[^"]*(")/m, (m) => `${m[1]}${v}${m[2]}`, "version in Cargo.toml");

export const setCargoLockVersion = (text, v, crate) =>
  replaceFirst(
    text,
    new RegExp(`(name = "${escapeRe(crate)}"\\nversion = ")[^"]*(")`),
    (m) => `${m[1]}${v}${m[2]}`,
    `crate ${crate} in Cargo.lock`,
  );

export function setChangelogHeading(text, v, date) {
  if (new RegExp(`^## ${escapeRe(v)}( |$)`, "m").test(text)) return text;
  const heading = `## ${v} (${date})`;
  const unreleased = /^## Unreleased[ \t]*$/m;
  if (unreleased.test(text)) return text.replace(unreleased, heading);
  const first = /^## /m.exec(text);
  if (!first) throw new Error("bump: CHANGELOG.md has no '## ' heading");
  return text.slice(0, first.index) + heading + "\n\n" + text.slice(first.index);
}

export function changelogSection(text, v) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => new RegExp(`^## ${escapeRe(v)}( |$)`).test(l));
  if (start === -1) throw new Error(`changelog: no section for ${v}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## "));
  const body = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
  if (!body) throw new Error(`changelog: no notes under the ${v} heading`);
  return body;
}
```

2. Create `scripts/bump.mjs` in full:

```js
#!/usr/bin/env node
// Usage: node scripts/bump.mjs 1.0.0
// Sets the version in package.json, package-lock.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml and
// src-tauri/Cargo.lock, and puts the version heading in CHANGELOG.md. All files or none.
import fs from "node:fs";
import path from "node:path";
import {
  isVersion, setJsonVersion, setCargoTomlVersion, setCargoLockVersion, setChangelogHeading,
} from "./lib/bump.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const version = process.argv[2];
if (!version || !isVersion(version)) {
  console.error("Usage: node scripts/bump.mjs <x.y.z>   (for example 1.0.0, no leading v)");
  process.exit(1);
}
const date = new Date().toISOString().slice(0, 10);
const file = (...p) => path.join(root, ...p);
const read = (f) => fs.readFileSync(f, "utf8");

const changes = [];
try {
  changes.push([file("package.json"), setJsonVersion(read(file("package.json")), version, "package.json")]);
  changes.push([file("src-tauri", "tauri.conf.json"), setJsonVersion(read(file("src-tauri", "tauri.conf.json")), version, "tauri.conf.json")]);
  changes.push([file("src-tauri", "Cargo.toml"), setCargoTomlVersion(read(file("src-tauri", "Cargo.toml")), version)]);
  changes.push([file("src-tauri", "Cargo.lock"), setCargoLockVersion(read(file("src-tauri", "Cargo.lock")), version, "openpier")]);
  if (fs.existsSync(file("package-lock.json"))) {
    const lock = JSON.parse(read(file("package-lock.json")));
    lock.version = version;
    if (lock.packages && lock.packages[""]) lock.packages[""].version = version;
    changes.push([file("package-lock.json"), JSON.stringify(lock, null, 2) + "\n"]);
  }
  changes.push([file("CHANGELOG.md"), setChangelogHeading(read(file("CHANGELOG.md")), version, date)]);
} catch (e) {
  console.error(String(e.message || e));
  process.exit(1);
}
for (const [f, text] of changes) {
  fs.writeFileSync(f, text);
  console.log("updated", path.relative(root, f));
}
console.log(`\nVersion is now ${version}. Write the release notes under its heading in CHANGELOG.md, then open a pull request.`);
```

3. Create `scripts/changelog-section.mjs` in full:

```js
#!/usr/bin/env node
// Usage: node scripts/changelog-section.mjs 1.0.0
// Prints the notes under the "## 1.0.0" heading of CHANGELOG.md. Fails when there is no heading or no notes,
// so a release cannot be built without notes.
import fs from "node:fs";
import path from "node:path";
import { changelogSection } from "./lib/bump.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/changelog-section.mjs <x.y.z>");
  process.exit(1);
}
try {
  console.log(changelogSection(fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8"), version));
} catch (e) {
  console.error(String(e.message || e));
  process.exit(1);
}
```

4. Create `scripts/lib/draft.mjs` in full:

```js
// Checklist 4.4 items 1 and 2 as code. Pure: scripts/release-draft-check.mjs fetches the data.
export function checkDraft({ repo, tag, assets, latestJson }) {
  const names = assets.map((a) => a.name);
  const results = [];
  const add = (ok, message) => results.push({ ok: Boolean(ok), message });
  const count = (re) => names.filter((n) => re.test(n)).length;

  add(count(/\.dmg$/) === 4, "four .dmg files: two Tauri names and the two fixed names");
  add(count(/\.app\.tar\.gz$/) === 2, "two .app.tar.gz update bundles");
  add(count(/\.app\.tar\.gz\.sig$/) === 2, "two .app.tar.gz.sig signatures");
  for (const f of ["OpenPier-arm64.dmg", "OpenPier-arm64.dmg.sha256", "OpenPier-x64.dmg", "OpenPier-x64.dmg.sha256", "latest.json"]) {
    add(names.includes(f), `the release has ${f}`);
  }

  const version = tag.replace(/^v/, "");
  add(latestJson && latestJson.version === version, `latest.json version is ${version}`);
  for (const key of ["darwin-aarch64", "darwin-x86_64"]) {
    const p = latestJson && latestJson.platforms && latestJson.platforms[key];
    add(p && typeof p.signature === "string" && p.signature.trim() !== "", `latest.json has a signature for ${key}`);
    add(
      p && typeof p.url === "string" && p.url.startsWith(`https://github.com/${repo}/releases/download/${tag}/`),
      `latest.json url for ${key} points at the ${tag} release`,
    );
  }
  return results;
}
```

5. Create `scripts/release-draft-check.mjs` in full. The owner runs it after the workflow; you never run it (it needs the GitHub CLI signed in).

```js
#!/usr/bin/env node
// Usage: node scripts/release-draft-check.mjs v1.0.0
// Reads the draft release for that tag with the GitHub CLI (read only) and prints ok or FAIL for checklist 4.4 items 1 and 2.
import { execFileSync } from "node:child_process";
import { checkDraft } from "./lib/draft.mjs";

const repo = "BitVerseNomad/openpier";
const tag = process.argv[2];
if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error("Usage: node scripts/release-draft-check.mjs v<x.y.z>");
  process.exit(1);
}
const gh = (args) => execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const releases = JSON.parse(gh(["api", `repos/${repo}/releases?per_page=30`]));
const matches = releases.filter((r) => r.tag_name === tag);
if (matches.length !== 1) {
  console.log(`FAIL exactly one release for ${tag} (found ${matches.length}); delete the extra draft by hand`);
  process.exit(1);
}
const release = matches[0];
console.log(`${release.draft ? "ok" : "FAIL"} the release is a draft (publish only after the checklist)`);
let latestJson = null;
const latest = release.assets.find((a) => a.name === "latest.json");
if (latest) {
  latestJson = JSON.parse(gh(["api", "-H", "Accept: application/octet-stream", `repos/${repo}/releases/assets/${latest.id}`]));
}
let bad = release.draft ? 0 : 1;
for (const r of checkDraft({ repo, tag, assets: release.assets, latestJson })) {
  console.log(`${r.ok ? "ok" : "FAIL"} ${r.message}`);
  if (!r.ok) bad += 1;
}
process.exit(bad ? 1 : 0);
```

6. Edit `src-tauri/tauri.conf.json`. Do not reformat the file. Make exactly these changes:
   1. In `bundle`, replace `"targets": ["dmg"],` with `"createUpdaterArtifacts": true,` on one line and `"targets": ["app", "dmg"],` on the next.
   2. In `plugins.updater`, set `endpoints` to the single item `"https://github.com/BitVerseNomad/openpier/releases/latest/download/latest.json"`.
   3. Delete the `"windows": { "installMode": "passive" }` entry in `plugins.updater` (the app is macOS only) and the comma before it.
   4. Leave `pubkey`, `signingIdentity`, `hardenedRuntime` as they are.
   Run `node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json','utf8'))"` (no output means valid).

7. Create `scripts/release-check.mjs` in full. It is the text check that stands in for running the workflows. WO-6.3 and WO-6.5 add rules to it (they append to the `rules` list).

```js
#!/usr/bin/env node
// Text rules for the release setup. Prints "ok <rule>" or "FAIL <rule>", exits 1 on any FAIL.
// This does not run any workflow. It only reads files.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const exists = (...p) => fs.existsSync(path.join(root, ...p));
const OLD_PUBKEY =
  "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDdENzdERTZDN0U1NDJDNTQKUldSVUxGUitiTjUzZlVXcFB0K3NzL2xwN2krZzZXMStGR1daeitUdGJ4ajdDZ2NEdWhwYnB0RFIK";
const conf = JSON.parse(read("src-tauri", "tauri.conf.json"));
const release = exists(".github", "workflows", "release.yml") ? read(".github", "workflows", "release.yml") : "";
const ci = exists(".github", "workflows", "ci.yml") ? read(".github", "workflows", "ci.yml") : "";

const nodeVersionOf = (yml) => (/node-version:\s*["']?(\d+)/.exec(yml) || [])[1];

const rules = [
  ["the bundle identifier is dev.openpier.desktop", () => conf.identifier === "dev.openpier.desktop"],
  ["tauri.conf.json asks for updater artifacts", () => conf.bundle.createUpdaterArtifacts === true],
  ["tauri.conf.json builds the app and the dmg", () => JSON.stringify(conf.bundle.targets) === JSON.stringify(["app", "dmg"])],
  [
    "the updater endpoint is the latest.json of the openpier repo",
    () => JSON.stringify(conf.plugins.updater.endpoints) === JSON.stringify(["https://github.com/BitVerseNomad/openpier/releases/latest/download/latest.json"]),
  ],
  ["the updater public key is set and is not the old leaked key", () => Boolean(conf.plugins.updater.pubkey) && conf.plugins.updater.pubkey !== OLD_PUBKEY],
  ["the three version numbers agree", () => { execFileSync("node", [path.join(root, "scripts", "check-version-sync.mjs")], { stdio: "ignore" }); return true; }],
  ["release.yml exists and runs only on version tags", () => /tags:\s*\[\s*["']v\*["']\s*\]/.test(release) && !release.includes("workflow_dispatch")],
  ["release.yml uses tauri-action and makes a draft", () => release.includes("tauri-apps/tauri-action") && /releaseDraft:\s*true/.test(release)],
  ["release.yml builds one architecture at a time", () => /max-parallel:\s*1/.test(release)],
  ["release.yml passes both signing secrets", () => release.includes("secrets.TAURI_SIGNING_PRIVATE_KEY }}") && release.includes("secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD")],
  ["release.yml has no Apple variables (there is no Apple account)", () => !release.includes("APPLE_")],
  ["release.yml has no hand-made latest.yml", () => !release.includes("latest.yml")],
  ["release.yml checks the tag against the three versions", () => release.includes("GITHUB_REF_NAME") && release.includes("Cargo.toml")],
  ["release.yml uses the same Node version as ci.yml", () => nodeVersionOf(release) !== undefined && nodeVersionOf(release) === nodeVersionOf(ci)],
  ["release.yml has no em dash", () => !release.includes("—")],
];

let bad = 0;
for (const [name, test] of rules) {
  let pass = false;
  try { pass = Boolean(test()); } catch { pass = false; }
  console.log(`${pass ? "ok" : "FAIL"} ${name}`);
  if (!pass) bad += 1;
}
process.exit(bad ? 1 : 0);
```

   Note for later work orders: the `rules` array is the only thing they edit.

8. Add npm scripts. In `package.json`, find the `"lint":` line in `scripts` and add these four lines after it (keep commas right):

```json
    "test:release": "node --test scripts/release-tools.test.mjs",
    "check:release": "node scripts/release-check.mjs",
    "bump": "node scripts/bump.mjs",
    "shots": "node scripts/readme-shots.mjs"
```

   (`shots` is used by WO-6.4; adding it here keeps `package.json` edits in one place.)

9. Replace `.github/workflows/release.yml` entirely. Write the file with this content. Action versions: if Starting state 6 showed commit hashes in `ci.yml`, replace `actions/checkout@v4`, `actions/setup-node@v4`, `dtolnay/rust-toolchain@stable` and `Swatinem/rust-cache@v2` with exactly the same `uses:` text `ci.yml` has for them (hash and trailing comment), and replace `tauri-apps/tauri-action@v1` with `tauri-apps/tauri-action@1deb371b0cd8bd54025b384f1cd735e725c4060f # v1.0.0`. If they were tags, keep the text below.

```yaml
name: Release

# Pushing a tag like v1.0.0 builds a DRAFT release. Nothing is public until a person presses Publish.
on:
  push:
    tags: ["v*"]

permissions:
  contents: write

jobs:
  build:
    strategy:
      fail-fast: false
      # One architecture at a time. Two jobs creating the same draft at once can make two drafts,
      # and each job merges its platform into the same latest.json.
      max-parallel: 1
      matrix:
        include:
          - runner: macos-latest
            target: aarch64-apple-darwin
            arch: arm64
          - runner: macos-latest
            target: x86_64-apple-darwin
            arch: x64
    runs-on: ${{ matrix.runner }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - uses: dtolnay/rust-toolchain@stable
        with: { targets: "${{ matrix.target }}" }
      - uses: Swatinem/rust-cache@v2
        with: { workspaces: src-tauri }
      - run: npm ci
      - name: Version in the tag matches the app
        run: |
          TAG="${GITHUB_REF_NAME#v}"
          CONF="$(node -p "require('./src-tauri/tauri.conf.json').version")"
          PKG="$(node -p "require('./package.json').version")"
          CARGO="$(grep -m1 '^version' src-tauri/Cargo.toml | cut -d'"' -f2)"
          for V in "$CONF" "$PKG" "$CARGO"; do
            test "$TAG" = "$V" || { echo "tag $TAG, found $V"; exit 1; }
          done
      - name: Release notes from CHANGELOG.md
        id: notes
        run: |
          {
            echo "body<<NOTES_EOF"
            node scripts/changelog-section.mjs "${GITHUB_REF_NAME#v}"
            echo "NOTES_EOF"
          } >> "$GITHUB_OUTPUT"
      - uses: tauri-apps/tauri-action@v1
        id: tauri
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: "OpenPier ${{ github.ref_name }}"
          releaseBody: ${{ steps.notes.outputs.body }}
          releaseDraft: true
          prerelease: false
          args: --target ${{ matrix.target }}
      - name: Add the fixed-name dmg and its checksum
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          RELEASE_ID: ${{ steps.tauri.outputs.releaseId }}
          ARCH_NAME: ${{ matrix.arch }}
          TARGET: ${{ matrix.target }}
        run: |
          set -eu
          DIR="src-tauri/target/${TARGET}/release/bundle/dmg"
          SRC="$(find "$DIR" -name '*.dmg' | head -1)"
          test -n "$SRC" || { echo "no dmg in $DIR"; exit 1; }
          OUT="$(mktemp -d)"
          NAME="OpenPier-${ARCH_NAME}.dmg"
          cp "$SRC" "$OUT/$NAME"
          (cd "$OUT" && shasum -a 256 "$NAME" > "$NAME.sha256")
          for F in "$NAME" "$NAME.sha256"; do
            curl -fsS -X POST \
              -H "Authorization: Bearer $GH_TOKEN" \
              -H "Accept: application/vnd.github+json" \
              -H "Content-Type: application/octet-stream" \
              --data-binary "@$OUT/$F" \
              "https://uploads.github.com/repos/${GITHUB_REPOSITORY}/releases/${RELEASE_ID}/assets?name=${F}" > /dev/null
            echo "uploaded $F"
          done
```

   Why: the Tauri-named `.dmg` has the version in its name; the install script needs a name that never changes (`OpenPier-arm64.dmg`, `OpenPier-x64.dmg`) and a SHA-256 next to it (plan 5.1). If a run fails after the upload step, the owner deletes the whole draft and pushes the tag again (an upload with a name that exists is refused).

10. Check the workflow text:
    1. `ruby -ryaml -e 'y = YAML.load_file(".github/workflows/release.yml"); puts y["jobs"]["build"]["steps"].length'` prints `9`.
    2. `command -v actionlint >/dev/null && actionlint .github/workflows/release.yml || echo "actionlint not installed"` prints nothing from actionlint, or the not-installed line.
    3. Read the file once against https://github.com/tauri-apps/tauri-action : the input names you used are `tagName`, `releaseName`, `releaseBody`, `releaseDraft`, `prerelease`, `args`; the outputs used are `releaseId`. Write in the pull request that you did this.

11. Add to `.github/workflows/ci.yml`, job `web`, after the step `- run: npm run check`, two steps in the same style as that file:

```yaml
      - run: npm run test:release
      - run: npm run check:release
```

12. Run `npm run test:release` (expected: all tests pass), `npm run check:release` (expected: every line `ok`), and the gate.

**Not verified: never run.** `release.yml` has never run. The things that can still be wrong: the tag `v1` of `tauri-action` building the Intel target on an Apple Silicon runner; `latest.json` merging both platforms when the two jobs run one after the other; the `.dmg` and `.app.tar.gz` file names (the draft check accepts any name that ends in `.dmg`, `.app.tar.gz`, `.app.tar.gz.sig`); `$GITHUB_OUTPUT` multi-line output; the upload with `curl`. The first tag push is the test. Say this in the pull request.

### Done when

1. `npm run test:release 2>&1 | grep -E "^# (pass|fail)"` prints `# pass 16` and `# fail 0`.
2. `npm run check:release` prints `ok` on all 15 lines and exits 0.
3. `ruby -ryaml -e 'YAML.load_file(".github/workflows/release.yml")'` prints nothing and exits 0.
4. `grep -c "latest.yml\|APPLE_\|workflow_dispatch" .github/workflows/release.yml` prints `0`.
5. `node -p "const c=require('./src-tauri/tauri.conf.json'); c.bundle.createUpdaterArtifacts + ' ' + c.bundle.targets.join(',')"` prints `true app,dmg`.
6. `node scripts/bump.mjs 9.9.9x 2>&1 | head -1` prints a `Usage:` line (bad version refused). Do NOT run it with a good version in this work order.
7. `git status --short` shows no change to `package-lock.json` beyond what `npm install` of WO-6.2a made (this work order adds no dependency).
8. The gate in `../HANDOFF.md` section 5.

### Owner steps

1. The two secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` exist (done in task 0.1). Check the names match exactly in the repo settings, Secrets and variables, Actions.
2. In the repo settings, Actions, General: Workflow permissions can stay on "Read repository contents"; the workflow asks for `contents: write` itself.
3. Cut the first release (plan 4.3). In order:
   1. `node scripts/bump.mjs <x.y.z>` (for example `1.0.0`), then write the release notes under the new heading in `CHANGELOG.md`. Today's wording must say what a user can now do.
   2. Pull request, merge.
   3. `git tag v<x.y.z> && git push origin v<x.y.z>`. A token with the `workflow` scope is needed when the push also changes workflow files.
   4. Wait for the two build jobs. Open Releases: there must be one draft.
   5. `node scripts/release-draft-check.mjs v<x.y.z>` (needs the GitHub CLI signed in). Every line must be `ok`.
   6. Run checklist 4.4 items 3 to 5 by hand: open the `.dmg` on a Mac that never had the app, open the Intel `.dmg` on an Intel Mac or under Rosetta, check the notes read well, then press Publish.
   7. From the previous published version, check that `Check now` finds this one and installs it (needs a previous version that has the updater, so this can only be done from the second release on).
4. If anything fails, write the exact failing step and its output into `docs/plan/FOUND.md`, delete the draft, fix, and push a new tag. Do not edit the tag.

**Pull request title:** `wo-6.2b: Tag builds a signed draft release with fixed-name dmg and checksums`

---

## WO-6.3 One line installs OpenPier, and a CI job proves it

**Needs:** WO-6.2b (names of the release files).

**Why:** Today's install script is Apple Silicon only, picks the first `.dmg` it finds, has no checksum, and clears the quarantine flag (plan 5.1, 6 item 1).

**Read first:**
1. `../06-open-source-launch.md` sections 5 and 6.
2. `scripts/install.sh` (today's file, you replace it).
3. WO-6.2b step 9 (the names `OpenPier-arm64.dmg`, `OpenPier-x64.dmg`, and the `.sha256` files).

### Starting state

1. `grep -c "xattr" scripts/install.sh` prints a number above `0` (the old script clears quarantine).
2. `sh -n scripts/install.sh && echo syntax-ok` prints `syntax-ok`.
3. `grep -n "REPO_URL\|BitVerseNomad" src/lib/links.ts` prints the repo URL constant `https://github.com/BitVerseNomad/openpier`. If it prints another name, stop and report.
4. `npm run test:release` passes (WO-6.2b).

### Do not touch

1. `src/` and `src-tauri/`.
2. Homebrew: not in this work order (plan 5.3 says after 1.0; it is in `ROADMAP.md` under Next).
3. Hard limits: no push, no tag, no release, no workflow run, no key or secret. Never run `scripts/install.sh` against the real `/Applications`: the tests below point it at a temporary folder.

### Tests to write first

Append these tests to `scripts/release-tools.test.mjs` (add the imports at the top of the file, next to the others). Run the file; the new tests fail because the old script does not read `OPENPIER_BASE_URL`.

```js
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const installScript = path.resolve(path.dirname(new URL(import.meta.url).pathname), "install.sh");

function serve(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openpier-serve-"));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  return dir;
}
function runInstall(dir) {
  const apps = fs.mkdtempSync(path.join(os.tmpdir(), "openpier-apps-"));
  const r = spawnSync("sh", [installScript], {
    encoding: "utf8",
    env: { ...process.env, OPENPIER_BASE_URL: `file://${dir}`, OPENPIER_APPLICATIONS_DIR: apps, OPENPIER_NO_OPEN: "1" },
  });
  return { ...r, apps };
}
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

test("Given a dmg whose checksum does not match, when installing, then it stops before mounting and installs nothing", () => {
  const junk = "not a real dmg";
  const files = {};
  for (const a of ["arm64", "x64"]) {
    files[`OpenPier-${a}.dmg`] = junk;
    files[`OpenPier-${a}.dmg.sha256`] = `${"0".repeat(64)}  OpenPier-${a}.dmg\n`;
  }
  const r = runInstall(serve(files));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /does not match its checksum/);
  assert.doesNotMatch(r.stdout, /Checksum ok/);
  assert.deepEqual(fs.readdirSync(r.apps), []);
});

test("Given a dmg with a matching checksum that is not a disk image, when installing, then the checksum passes and nothing is installed", () => {
  const junk = "not a real dmg";
  const files = {};
  for (const a of ["arm64", "x64"]) {
    files[`OpenPier-${a}.dmg`] = junk;
    files[`OpenPier-${a}.dmg.sha256`] = `${sha(junk)}  OpenPier-${a}.dmg\n`;
  }
  const r = runInstall(serve(files));
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /Checksum ok/);
  assert.deepEqual(fs.readdirSync(r.apps), []);
});

test("Given no checksum file, when installing, then it stops and installs nothing", () => {
  const files = { "OpenPier-arm64.dmg": "x", "OpenPier-x64.dmg": "x" };
  const r = runInstall(serve(files));
  assert.notEqual(r.status, 0);
  assert.deepEqual(fs.readdirSync(r.apps), []);
});

test("The install script never uses sudo, never touches the quarantine flag and never changes Gatekeeper", () => {
  const text = fs.readFileSync(installScript, "utf8");
  assert.doesNotMatch(text, /\bsudo\b/);
  assert.doesNotMatch(text, /xattr/);
  assert.doesNotMatch(text, /spctl/);
});

test("The install script prints the one step for a blocked first open", () => {
  const text = fs.readFileSync(installScript, "utf8");
  assert.match(text, /Privacy & Security/);
  assert.match(text, /Open Anyway/);
});
```

### Steps

1. Replace `scripts/install.sh` with this content (keep the executable bit: `chmod +x scripts/install.sh`):

```sh
#!/bin/sh
# Installs the latest OpenPier release into /Applications.
# Usage: curl -fsSL https://raw.githubusercontent.com/BitVerseNomad/openpier/main/scripts/install.sh | sh
# It checks the download against the SHA-256 published in the release. It never uses sudo
# and never changes macOS security settings.
#
# For tests only: OPENPIER_BASE_URL (where the .dmg and .sha256 are), OPENPIER_APPLICATIONS_DIR (instead of
# /Applications), OPENPIER_NO_OPEN=1 (do not open the app at the end).
set -eu

REPO="BitVerseNomad/openpier"
BASE="${OPENPIER_BASE_URL:-https://github.com/$REPO/releases/latest/download}"
APPS="${OPENPIER_APPLICATIONS_DIR:-/Applications}"
NAME="OpenPier"

[ "$(uname -s)" = "Darwin" ] || { echo "OpenPier is for Macs only." >&2; exit 1; }
case "$(uname -m)" in
  arm64) arch="arm64" ;;
  x86_64) arch="x64" ;;
  *) echo "OpenPier is built for Apple Silicon and Intel Macs only." >&2; exit 1 ;;
esac

dmg_name="$NAME-$arch.dmg"
tmp="$(mktemp -d)"
mounted=""
cleanup() {
  if [ -n "$mounted" ]; then hdiutil detach "$mounted" -quiet 2>/dev/null || true; fi
  rm -rf "$tmp"
}
trap cleanup EXIT

echo "Downloading $dmg_name..."
curl -fL --progress-bar "$BASE/$dmg_name" -o "$tmp/$dmg_name"
curl -fsSL "$BASE/$dmg_name.sha256" -o "$tmp/$dmg_name.sha256"

want="$(awk '{print $1}' "$tmp/$dmg_name.sha256")"
got="$(shasum -a 256 "$tmp/$dmg_name" | awk '{print $1}')"
if [ -z "$want" ] || [ "$want" != "$got" ]; then
  echo "The download does not match its checksum. Nothing was installed." >&2
  exit 1
fi
echo "Checksum ok."

mnt="$tmp/mnt"
mkdir "$mnt"
hdiutil attach "$tmp/$dmg_name" -nobrowse -quiet -mountpoint "$mnt"
mounted="$mnt"
[ -d "$mnt/$NAME.app" ] || { echo "The download has no $NAME.app inside. Nothing was installed." >&2; exit 1; }

if pgrep -f "$NAME.app/Contents/MacOS" >/dev/null 2>&1; then
  osascript -e "tell application \"$NAME\" to quit" >/dev/null 2>&1 || true
  sleep 2
fi
if [ -d "$APPS/$NAME.app" ]; then
  old="$HOME/.Trash/$NAME $(date +%Y%m%d-%H%M%S).app"
  mv "$APPS/$NAME.app" "$old" && echo "Moved the old app to the Trash."
fi

ditto "$mnt/$NAME.app" "$APPS/$NAME.app"
echo "Installed $APPS/$NAME.app."
echo "If macOS says it cannot open OpenPier: open System Settings, then Privacy & Security, scroll to the Security section and click Open Anyway. You only do this once."

command -v colima >/dev/null 2>&1 || echo "Colima is not installed yet. The app offers to install it when it opens."
if [ -z "${OPENPIER_NO_OPEN:-}" ]; then open "$APPS/$NAME.app"; fi
```

2. Run `npm run test:release`. Expected: all pass (21 tests). The two "not a real dmg" tests make `hdiutil attach` fail on junk; that mounts nothing.

3. Create `.github/workflows/install-smoke.yml` in full. It runs when the owner publishes a release. Use the same `uses:` form rule as WO-6.2b step 9 (this file has no actions, so there is nothing to pin).

```yaml
name: Install smoke

# After a release is published: install it with the public one-line command on a clean Mac
# and check the app is there with the tag's version.
on:
  release:
    types: [published]

permissions:
  contents: read

jobs:
  install:
    runs-on: macos-latest
    steps:
      - name: Install with the public line
        run: |
          for i in 1 2 3 4 5; do
            if curl -fsSL https://raw.githubusercontent.com/BitVerseNomad/openpier/main/scripts/install.sh | OPENPIER_NO_OPEN=1 sh; then
              exit 0
            fi
            echo "attempt $i failed, waiting 30 seconds"
            sleep 30
          done
          exit 1
      - name: The app is there and has the tag's version
        env:
          TAG: ${{ github.event.release.tag_name }}
        run: |
          test -d /Applications/OpenPier.app
          FOUND="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' /Applications/OpenPier.app/Contents/Info.plist)"
          echo "found $FOUND, tag $TAG"
          test "v$FOUND" = "$TAG"
```

   Validate: `ruby -ryaml -e 'YAML.load_file(".github/workflows/install-smoke.yml")'` prints nothing.

4. Add rules to `scripts/release-check.mjs`. Find the `rules` array and add these items before its closing `];`:

```js
  ["install.sh never uses sudo, xattr or spctl", () => { const t = read("scripts", "install.sh"); return !/\bsudo\b|xattr|spctl/.test(t); }],
  ["install.sh checks a SHA-256", () => read("scripts", "install.sh").includes("shasum -a 256")],
  ["install.sh and release.yml use the same fixed file names", () => ["OpenPier-arm64.dmg", "OpenPier-x64.dmg"].every((n) => read("scripts", "install.sh").includes(n.replace(/arm64|x64/, "$arch")) || read("scripts", "install.sh").includes(n)) && release.includes('NAME="OpenPier-${ARCH_NAME}.dmg"') && read("scripts", "install.sh").includes('dmg_name="$NAME-$arch.dmg"')],
  ["install-smoke.yml runs on a published release", () => /types:\s*\[published\]/.test(read(".github", "workflows", "install-smoke.yml"))],
  ["install.sh points at the openpier repo", () => read("scripts", "install.sh").includes('REPO="BitVerseNomad/openpier"')],
```

   Run `npm run check:release`. Expected: all `ok`. (The third rule is a text match on the two lines that build the file name in each file; if you change either line, change the rule.)

5. Run the gate.

**Not verified: never run.** `install-smoke.yml` has never run, and `install.sh` has never installed a real release (the tests stop before the install). `curl` does not add the macOS quarantine flag, so a copy installed this way is not blocked on first open; the printed note is there for a Mac where it is. Both facts are checked by the owner in step 2 below.

### Done when

1. `sh -n scripts/install.sh && echo ok` prints `ok`; `test -x scripts/install.sh && echo ok` prints `ok`.
2. `npm run test:release 2>&1 | grep -E "^# (pass|fail)"` prints `# pass 21` and `# fail 0`.
3. `grep -c "sudo\|xattr\|spctl" scripts/install.sh` prints `0`. (The words are not in comments either.)
4. `ruby -ryaml -e 'YAML.load_file(".github/workflows/install-smoke.yml")'` exits 0.
5. `npm run check:release` prints no `FAIL`.
6. The gate in `../HANDOFF.md` section 5.

### Owner steps

1. After the first release is published, the `Install smoke` workflow runs by itself. Open the Actions tab: it must be green. If it is red, copy the failing step and its output to the plan's author.
2. On a Mac that has never had OpenPier, run the line from the README. Check that the app opens, or that macOS blocks it and the printed text is enough to get past it. Write which one happened.
3. Ask one person who is not you to run the line on their Mac and tell you what they saw (launch checklist item 5).

**Pull request title:** `wo-6.3: Install with one line, checked against a published checksum`

---

## WO-6.5 Signing is honest: ad-hoc, with the manual first-open step written down

**Needs:** WO-6.2b, WO-6.3.

**Why:** There is no Apple Developer account (P9.3). The app is ad-hoc signed, macOS shows a "cannot be opened" screen on the first open of a downloaded `.dmg`, and the user must allow it once. The plan says to build exactly that and to keep the notarisation steps for the day an account exists (`06` section 6).

**Read first:**
1. `../06-open-source-launch.md` section 6.
2. `src-tauri/tauri.conf.json` (`bundle.macOS`), `src-tauri/entitlements.plist`, `scripts/check-entitlements.mjs`.

### Starting state

1. `node -p "JSON.stringify(require('./src-tauri/tauri.conf.json').bundle.macOS)"` prints `{"entitlements":"entitlements.plist","signingIdentity":"-","hardenedRuntime":true}`. If `signingIdentity` is not `-`, stop and report.
2. `node scripts/check-entitlements.mjs` exits 0 (the existing check on the entitlements file). If the file no longer exists, write that in the pull request and go on.
3. `grep -c "APPLE_" .github/workflows/release.yml` prints `0` (WO-6.2b).
4. `test ! -f docs/signing.md && echo none` prints `none`.

### Do not touch

1. `entitlements.plist`, `signingIdentity`, `hardenedRuntime`, `bundle.macOS`. This work order only writes down and checks them.
2. Hard limits: no push, no tag, no release, no workflow run, no key or secret. Do not create or import any certificate. Do not run `codesign` against anything outside the repo.

### Steps

1. Create `docs/signing.md` with this content:

````markdown
# Signing and first open

## What OpenPier does today

OpenPier has no Apple Developer account. The app is **ad-hoc signed** (`signingIdentity` is `-` in `src-tauri/tauri.conf.json`) and is not notarised.

What a person sees:

1. If they download the `.dmg` in a browser, macOS marks the app as downloaded. The first time they open it, macOS says it cannot open OpenPier. They allow it once.
2. If they use the install line from the README, the download comes from `curl`, which does not mark the app, so macOS does not stop it. The install script still prints the steps below, in case it does.

## The steps for the person (the same text is in the README)

1. Open OpenPier. macOS says it cannot open it. Click Done.
2. Open System Settings, then Privacy & Security.
3. Scroll to the Security section. Click Open Anyway next to OpenPier.
4. Type your Mac password, then click Open.

You do this once for each version that is installed by hand. An update that OpenPier installs itself does not ask again.

## Rules for the code

1. `scripts/install.sh` never uses `sudo`, never removes the quarantine flag and never changes Gatekeeper. `scripts/release-check.mjs` fails if it does.
2. `.github/workflows/release.yml` has no `APPLE_` variable. `scripts/release-check.mjs` fails if it does.
3. Update signatures (a different thing) use the minisign key in the repository secrets. They are checked by the app with the public key in `tauri.conf.json`. See `SECURITY.md`.

## If an Apple Developer account is ever bought (99 USD a year)

1. Create a "Developer ID Application" certificate. Export it as `.p12`. Convert it to base64 and store it in the repository secret `APPLE_CERTIFICATE`; store its password in `APPLE_CERTIFICATE_PASSWORD`.
2. Store the signing identity name in `APPLE_SIGNING_IDENTITY`.
3. Create an app-specific password for the Apple ID; store the Apple ID in `APPLE_ID`, the password in `APPLE_PASSWORD` and the team in `APPLE_TEAM_ID`.
4. Add these six lines under `env:` of the `tauri-apps/tauri-action` step in `.github/workflows/release.yml`, and remove the rule "release.yml has no Apple variables" from `scripts/release-check.mjs`:

```
APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
APPLE_ID: ${{ secrets.APPLE_ID }}
APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

5. `tauri-action` then signs and notarises. Check on a Mac with `spctl -a -vv /Applications/OpenPier.app`. Expected: `accepted` and `source=Notarized Developer ID`.
6. Then the README first-open section and the install script's last note can go, and a Homebrew cask in the official list becomes possible.

Source: `docs/plan/06-open-source-launch.md` section 6 and https://v2.tauri.app/distribute/sign/macos/ (the variable names). **Not verified:** the variable names against that page; check them before using this list.
````

2. Add rules to `scripts/release-check.mjs` (before the closing `];` of `rules`):

```js
  ["the app is ad-hoc signed with the hardened runtime", () => conf.bundle.macOS.signingIdentity === "-" && conf.bundle.macOS.hardenedRuntime === true],
  ["docs/signing.md has the four first-open steps", () => { const t = read("docs", "signing.md"); return ["Open Anyway", "Privacy & Security", "Open System Settings"].every((s) => t.includes(s)); }],
  ["docs/signing.md keeps the notarisation steps for later", () => read("docs", "signing.md").includes("spctl -a -vv /Applications/OpenPier.app")],
```

3. Run `npm run check:release` and the gate.

### Tests to write first

None. The rules above are the tests; add them first and see the second and third fail until `docs/signing.md` exists.

### Done when

1. `npm run check:release` prints no `FAIL` and now has 23 `ok` lines.
2. `grep -c "Open Anyway" docs/signing.md` prints `2` or more.
3. `git diff --stat src-tauri/tauri.conf.json src-tauri/entitlements.plist` prints nothing.
4. The gate in `../HANDOFF.md` section 5.

### Owner steps

1. After the first release is built, on the Mac you test on: `codesign -dv --verbose=2 /Applications/OpenPier.app 2>&1 | grep -i "Signature"`. Expected: `Signature=adhoc`. Write what you got.
2. Download the `.dmg` in a browser, open the app, and walk the four first-open steps with the real macOS. Write down the exact words macOS shows. If any step in `docs/signing.md` or the README differs, send the correct words to the plan's author.
3. Take a screenshot of the Privacy & Security screen with the Open Anyway button and save it as `docs/screenshots/first-open.png` (crop to the Security section, under 200 KB). WO-6.4 puts it in the README.

**Pull request title:** `wo-6.5: Write down ad-hoc signing and the first-open steps, and check them`

---

## WO-6.4 The README sells the app with pictures a script made

**Needs:** WO-6.5, and every screen work order of iterations 2 and 3 (the screens must exist before they can be photographed).

**Why:** The README is the front door. Its pictures must come from the app, so they cannot drift from it again (plan 7.2).

**Read first:**
1. `../06-open-source-launch.md` section 7.
2. `../03-review-product.md` P1, P2, P5.
3. `README.md` (today's file, you replace it), `scripts/readme-shots.mjs` (today's file, you replace it, it still points at `file://preview/index.html` and does not work), `scripts/mockup-pairs.json`, `scripts/check-mockup.mjs` (it only navigates; it cannot click, so the open sheets and menus below need their own steps), `scripts/lib/check.mjs`.
4. `../design/shots/problem-inspector-light.png`, `run-sheet-light.png`, `engine-switcher-light.png` (the pictures to match). `../04-design-spec.md` section 7.5 (Test a connection).

### Starting state

1. `grep -c "setup-installing" preview/mock.ts` prints a number above `0` (WO-3.10 defined that scenario; this work order uses it and does not define it).
2. `node -p "require('./scripts/mockup-pairs.json').filter(x=>['containers','doctor'].includes(x.mockup)).map(x=>x.mockup+' '+x.path).join(' | ')"` prints the `containers` and `doctor` rows. Their paths should be `/?scenario=design#/containers` and `/?scenario=design#/doctor`. If they differ, use the printed ones in step 1's list.
3. `test -f docs/problems.md && echo yes || echo no` prints `yes` or `no` (same as WO-6.1 Starting state 7).
4. `test -f docs/screenshots/first-open.png && echo yes || echo no` prints `yes` or `no`.
5. `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/ || true` prints `000` (nothing is running; the script starts the preview itself).
6. `ls docs/screenshots` prints the old files `doctor.png home.png images.png networks.png profiles.png setup.png volumes.png` (and maybe `first-open.png`).
7. `grep -c "Wharf\|Container UI\|colima-ui" README.md` prints a number (may be 0).
8. `npx playwright --version` prints `Version 1.59.1`. `npx playwright install webkit` has been run on this machine, or you run it now (it downloads a browser into the Playwright cache; that is allowed).

### Do not touch

1. `docs/plan/design/` and its pictures.
2. Hard limits: no push, no tag, no release, no workflow run, no key or secret.

### Steps

1. Replace `scripts/readme-shots.mjs` with this content. Each picture has a path and, for the sheets and menus, the clicks that open it. The clicks use accessible names and the words of the spec, not class names. The Setup picture uses the scenario `setup-installing` from WO-3.10 (it freezes the install state, as in the mockup). The Networks picture shows the `Test a connection` sheet (spec 7.5); it has no mockup pair, so it is compared with the spec by eye.

```js
#!/usr/bin/env node
// Writes the README pictures: docs/screenshots/<name>-<light|dark>.png, from the preview, in WebKit, 1280x800 at 2x.
// Usage: node scripts/readme-shots.mjs [--out <dir>]
// It starts `npm run preview` itself when nothing answers on http://localhost:4173.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { webkit } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BASE = "http://localhost:4173";

const D = "/?scenario=design";

// name: the file name. path: where to go. act: what to click before the picture (spec section and words in the comment).
export const SHOTS = [
  // 7.1 and 6.16: the first "See why" opens the inspector
  { name: "hero", path: `${D}#/containers`, act: async (p) => { await p.getByRole("button", { name: "See why" }).first().click(); await p.getByRole("dialog").waitFor(); } },
  { name: "containers", path: `${D}#/containers` },
  { name: "doctor", path: `${D}#/doctor` },
  // 7.3 and 7.10: Run on the postgres:16 row opens the sheet "Run postgres:16"
  { name: "run", path: `${D}#/images`, act: async (p) => { await p.locator(".row", { hasText: "postgres:16" }).getByRole("button", { name: /^Run/ }).first().click(); await p.getByRole("dialog", { name: "Run postgres:16" }).waitFor(); } },
  // 7.5: the sheet "Test a connection"
  { name: "networks", path: `${D}#/networks`, act: async (p) => { await p.getByRole("button", { name: "Test a connection" }).click(); await p.getByRole("dialog", { name: "Test a connection" }).waitFor(); } },
  // 5.3: the engine button opens the popover (scenario colima-and-desktop of iteration 4: default, work, Docker Desktop, OrbStack, as in the mockup)
  { name: "engine-switcher", path: "/?scenario=colima-and-desktop#/containers", act: async (p) => { await p.locator("button.engine").click(); await p.locator(".pop").first().waitFor(); } },
  // 7.9: Setup replaces the whole app; the scenario from WO-3.10 freezes step 2 as in the mockup
  { name: "setup", path: "/?scenario=setup-installing" },
];
export const THEMES = ["light", "dark"];

const outIndex = process.argv.indexOf("--out");
const out = outIndex === -1 ? path.join(root, "docs", "screenshots") : path.resolve(process.argv[outIndex + 1] || "");
if (outIndex !== -1 && !process.argv[outIndex + 1]) {
  console.error("--out needs a folder");
  process.exit(1);
}

const answers = async () => {
  try { return (await fetch(BASE)).ok; } catch { return false; }
};

let server = null;
const stopServer = () => {
  if (server) { try { process.kill(-server.pid); } catch { /* already gone */ } server = null; }
};
process.on("exit", stopServer);
process.on("SIGINT", () => { stopServer(); process.exit(130); });

if (!(await answers())) {
  server = spawn("npm", ["run", "preview"], { cwd: root, stdio: "ignore", detached: true });
  for (let i = 0; i < 120 && !(await answers()); i += 1) await new Promise((r) => setTimeout(r, 500));
  if (!(await answers())) {
    console.error(`The preview did not start on ${BASE} within 60 seconds.`);
    process.exit(1);
  }
}

fs.mkdirSync(out, { recursive: true });
const browser = await webkit.launch();
let failed = 0;
for (const theme of THEMES) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: theme });
  for (const shot of SHOTS) {
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}${shot.path}`);
      await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
      await page.waitForSelector("#root *");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(600);
      if (shot.act) { await shot.act(page); await page.waitForTimeout(600); }
      const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const file = path.join(out, `${shot.name}-${theme}.png`);
      await page.screenshot({ path: file });
      console.log(`wrote ${path.relative(root, file)} (${theme}, background ${background})`);
    } catch (e) {
      console.error(`FAIL ${shot.name}-${theme}: ${String(e.message || e).split("\n")[0]}`);
      failed += 1;
    }
    await page.close();
  }
  await context.close();
}
await browser.close();
stopServer();
process.exit(failed ? 1 : 0);
```

   Run `node scripts/readme-shots.mjs`. Expected: 14 `wrote` lines (7 names, 2 themes), exit 0. The two backgrounds printed for a name must differ between light and dark. If a click cannot find its button (a name differs from the spec), stop and report the name that failed and the buttons the page has; do not change a screen to suit the script. Not verified: the button names in the clicks (`See why`, `Run`, `Test a connection`, the `.engine` button) were taken from the spec and the work orders of iterations 2 and 3, not from running the screens.

2. Create `scripts/shots-fresh.mjs` in full. It compares the committed pictures with a fresh run.

```js
#!/usr/bin/env node
// Usage: node scripts/shots-fresh.mjs <folder with fresh pictures>
// Fails when a committed README picture differs from a fresh one by more than THRESHOLD of its pixels.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const NAMES = ["hero", "containers", "doctor", "run", "networks", "engine-switcher", "setup"];
const THEMES = ["light", "dark"];
const THRESHOLD = 0.005; // the default threshold of scripts/mockup-pairs.json (half a percent)
const CHANNEL_STEP = 16; // a pixel counts as different when a colour channel differs by more than this

const fresh = process.argv[2];
if (!fresh) {
  console.error("Usage: node scripts/shots-fresh.mjs <folder>");
  process.exit(1);
}
const raw = async (file) => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};

let bad = 0;
for (const name of NAMES) {
  for (const theme of THEMES) {
    const label = `${name}-${theme}.png`;
    const committed = path.join(root, "docs", "screenshots", label);
    const made = path.join(fresh, label);
    if (!fs.existsSync(committed) || !fs.existsSync(made)) { console.log(`FAIL ${label} is missing`); bad += 1; continue; }
    const a = await raw(committed);
    const b = await raw(made);
    if (a.width !== b.width || a.height !== b.height) { console.log(`FAIL ${label} has another size`); bad += 1; continue; }
    let different = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      if (
        Math.abs(a.data[i] - b.data[i]) > CHANNEL_STEP ||
        Math.abs(a.data[i + 1] - b.data[i + 1]) > CHANNEL_STEP ||
        Math.abs(a.data[i + 2] - b.data[i + 2]) > CHANNEL_STEP
      ) different += 1;
    }
    const share = different / (a.width * a.height);
    const ok = share <= THRESHOLD;
    console.log(`${ok ? "ok" : "FAIL"} ${label} differs in ${(share * 100).toFixed(2)}% of pixels (limit ${THRESHOLD * 100}%)`);
    if (!ok) bad += 1;
  }
}
process.exit(bad ? 1 : 0);
```

3. Remove the old pictures: `git rm docs/screenshots/home.png docs/screenshots/doctor.png docs/screenshots/images.png docs/screenshots/networks.png docs/screenshots/profiles.png docs/screenshots/setup.png docs/screenshots/volumes.png`. Add the 14 new files: `git add docs/screenshots`.

4. Look at three of the new pictures (open them: `hero-light.png`, `run-dark.png`, `engine-switcher-light.png`) and compare each with its mockup picture in `docs/plan/design/shots/`. If any debug text shows in a picture, stop and report. Do not crop by hand.

5. Replace `README.md` with the text below. Rules for this step:
   1. Copy the text exactly. Do not add a feature, a badge or a sentence.
   2. If Starting state 3 printed `no`, delete the line that starts with `Every problem the app can explain` (it links `docs/problems.md`).
   3. If Starting state 4 printed `no`, delete the line `![...]` that begins `![The macOS screen` (the image of the first-open screen), and leave the four steps. Say so in the pull request: the owner adds the picture later (WO-6.5 owner step 3).

````markdown
# OpenPier

**The open-source desktop app for your containers. It works with the engine you already have, shows what is wrong in plain words, and fixes it.**

[![CI](https://github.com/BitVerseNomad/openpier/actions/workflows/ci.yml/badge.svg)](https://github.com/BitVerseNomad/openpier/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/BitVerseNomad/openpier)](https://github.com/BitVerseNomad/openpier/releases/latest)
[![License: MIT](https://img.shields.io/github/license/BitVerseNomad/openpier)](LICENSE)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/hero-dark.png">
  <img alt="Containers: every container on one screen, with one problem open and the button that fixes it" src="docs/screenshots/hero-light.png">
</picture>

OpenPier is a small native Mac app for containers: list them, run them, read their logs, and find out why one broke.
It is for developers on a Mac who use Colima, OrbStack, Docker Desktop or Rancher Desktop, and who know `docker ps`.
It is not a new container engine, and it does not manage servers or clusters.

## Install

    curl -fsSL https://raw.githubusercontent.com/BitVerseNomad/openpier/main/scripts/install.sh | sh

Or by hand: download the `.dmg` for your Mac from the [latest release](https://github.com/BitVerseNomad/openpier/releases/latest), open it, and drag OpenPier to Applications.

**First open.** OpenPier is not signed by an Apple Developer account, so macOS may say it cannot open it. You allow it once:

1. Open OpenPier. macOS says it cannot open it. Click Done.
2. Open System Settings, then Privacy & Security.
3. Scroll to the Security section. Click Open Anyway next to OpenPier.
4. Type your Mac password, then click Open.

![The macOS screen in Privacy & Security with the Open Anyway button](docs/screenshots/first-open.png)

## What it does

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/containers-dark.png">
  <img alt="Containers" src="docs/screenshots/containers-light.png" width="420">
</picture>

1. **Containers.** See every container and what is wrong with it, in plain words.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/doctor-dark.png">
  <img alt="Doctor" src="docs/screenshots/doctor-light.png" width="420">
</picture>

2. **Doctor.** Check your whole setup. Every fix asks first and says what it will run.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/run-dark.png">
  <img alt="Run" src="docs/screenshots/run-light.png" width="420">
</picture>

3. **Run.** Start an image from a guided form that warns you about a port clash before you run it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/networks-dark.png">
  <img alt="Test a connection" src="docs/screenshots/networks-light.png" width="420">
</picture>

4. **Networks.** Test whether one container can reach another, and see why not.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/engine-switcher-dark.png">
  <img alt="Engine switcher" src="docs/screenshots/engine-switcher-light.png" width="420">
</picture>

5. **Engines.** Switch between the Docker engines on your Mac from one place.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/setup-dark.png">
  <img alt="First-run setup" src="docs/screenshots/setup-light.png" width="420">
</picture>

6. **Setup.** On a fresh Mac, install what is missing with one click.

Every problem the app can explain is listed in [docs/problems.md](docs/problems.md).

## Works with

| Engine | Containers, images, volumes, networks | Machine controls (start, stop, resize) |
|---|---|---|
| Colima | Yes | Yes |
| Docker Desktop | Yes | No, open its own app |
| OrbStack | Yes | No, open its own app |
| Rancher Desktop | Yes | No, open its own app |
| Podman | Yes, through a Docker context | No, open its own app |
| Any other Docker context | Yes | No |

## How it compares

| Tool | Open source | Desktop app | Works on an engine you already run | Explains and fixes problems |
|---|---|---|---|---|
| Docker Desktop | No | Yes | No (its own) | No |
| OrbStack | No | Yes | No (its own) | No |
| Podman Desktop | Yes | Yes (Electron) | Partly (Podman first; Docker engine through an extension) | No |
| Rancher Desktop | Yes | Yes (Electron) | No (its own VM) | No |
| Portainer CE | Yes | No (web, runs as a container) | Yes | No |
| lazydocker | Yes | No (terminal) | Yes | No |
| OpenPier | Yes | Yes (native webview, about 6 MB) | Yes | Yes |

"Explains and fixes problems: No" means we found no such feature listed for that tool. It is not proof that it has none.

## Development

    npm ci
    npm run preview
    npm run tauri dev
    npm run check

`npm run preview` needs no engine. More in [CONTRIBUTING.md](CONTRIBUTING.md).

## More

1. [Roadmap](ROADMAP.md): what is now, next, later, and never.
2. [Security](SECURITY.md): how to report a problem, and what we promise.
3. [License](LICENSE): MIT.
````

6. Replace the check of the README text. Add these rules to `scripts/release-check.mjs` (before the closing `];` of `rules`):

```js
  ["README starts with the name and has the badges", () => { const t = read("README.md"); return t.startsWith("# OpenPier") && (t.match(/!\[(CI|Latest release|License: MIT)\]/g) || []).length === 3; }],
  ["README has the sections in the order of the plan", () => { const t = read("README.md"); const heads = ["## Install", "## What it does", "## Works with", "## How it compares", "## Development", "## More"].map((h) => t.indexOf(h)); return heads.every((i, n) => i > -1 && (n === 0 || i > heads[n - 1])); }],
  ["README says Open Anyway", () => read("README.md").includes("Open Anyway")],
  ["README install line is the public one-line command", () => read("README.md").includes("curl -fsSL https://raw.githubusercontent.com/BitVerseNomad/openpier/main/scripts/install.sh | sh")],
  ["README has no old name and no coming-soon", () => !/Wharf|Container UI|colima-ui|coming soon/i.test(read("README.md"))],
  ["README has no em dash", () => !read("README.md").includes("—")],
  ["README picture files all exist", () => { const refs = [...read("README.md").matchAll(/docs\/screenshots\/[a-z-]+\.png/g)].map((m) => m[0]); return refs.length >= 14 && refs.every((f) => f === "docs/screenshots/first-open.png" || exists(f)); }],
```

7. Add the CI job. In `.github/workflows/ci.yml`, add a job after the last job, with the same indentation as the others. Use the same `uses:` form as the other jobs for `actions/checkout` and `actions/setup-node`, and the Node version from the `web` job:

```yaml
  shots-fresh:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright install webkit
      - run: node scripts/readme-shots.mjs --out "$RUNNER_TEMP/shots"
      - run: node scripts/shots-fresh.mjs "$RUNNER_TEMP/shots"
```

   `ruby -ryaml -e 'YAML.load_file(".github/workflows/ci.yml")'` must exit 0.

8. Run `node scripts/shots-fresh.mjs <a folder made by a second run>`: run `node scripts/readme-shots.mjs --out /tmp/openpier-shots-2` then `node scripts/shots-fresh.mjs /tmp/openpier-shots-2`. Expected: 14 `ok` lines. (Two runs on the same machine must match.)

9. `npm run check:release`, then the gate.

**Not verified: never run in CI.** `shots-fresh` runs on `macos-latest`; the committed pictures were made on the owner's Mac. Font drawing can differ between macOS versions, so the first CI run may fail even when nothing is wrong. If it fails with a share under 5%, report it with the numbers and do not raise the threshold yourself.

### Tests to write first

None for the script itself; step 8 is its test (two runs match). The README rules in step 6 are added first and fail until the README is replaced.

### Done when

1. `ls docs/screenshots | wc -l` prints `14` (or `15` with `first-open.png`).
2. `node scripts/shots-fresh.mjs /tmp/openpier-shots-2` prints 14 `ok` lines and exits 0.
3. `npm run check:release` prints no `FAIL`.
4. `grep -c "<picture>" README.md` prints `7`.
5. `grep -n "^## " README.md` prints, in this order: Install, What it does, Works with, How it compares, Development, More.
6. `ruby -ryaml -e 'YAML.load_file(".github/workflows/ci.yml")'` exits 0.
7. By eye: `hero-light.png` next to `docs/plan/design/shots/problem-inspector-light.png`; `containers-dark.png` next to `containers-dark.png` in the design shots. Same layout, same words.
8. The gate in `../HANDOFF.md` section 5.

### Owner steps

1. Read the README on GitHub after the push (the `<picture>` dark mode switch only works there). Check both themes by switching your GitHub appearance.
2. Delete from "Works with" any engine you have not run the app against on a real Mac. Product review P8.3: do not claim an engine nobody tried.
3. Check the "How it compares" table once more against each tool's own page on the day you launch. The caveat sentence stays.
4. Add `docs/screenshots/first-open.png` (WO-6.5 owner step 3) and, if the image line was left out, add it back above the first screenshot line:
   `![The macOS screen in Privacy & Security with the Open Anyway button](docs/screenshots/first-open.png)`
5. After any later change on screen: run `node scripts/readme-shots.mjs`, commit the pictures in the same pull request (the `shots-fresh` job fails otherwise).

**Pull request title:** `wo-6.4: README with pictures made by a script, and a job that keeps them true`

---

## WO-6.6 The launch checklist, written down for the owner

**Needs:** WO-6.1 to WO-6.5.

**Why:** Launch is the owner's work, in a fixed order, stopping at the first failure (`06` section 8). A written list with a proof for each item stops steps being skipped.

**Read first:** `../06-open-source-launch.md` sections 1, 8 and 9.

### Starting state

1. `test ! -f docs/plan/launch-checklist.md && echo none` prints `none`.
2. `ls LICENSE SECURITY.md CODE_OF_CONDUCT.md ROADMAP.md README.md CONTRIBUTING.md scripts/install.sh docs/signing.md` prints all nine, no error.
3. `ls docs/research/evaluation-kit.md` prints the file (task 0.5).

### Do not touch

1. Everything except the one new file.
2. Hard limits: no push, no tag, no release, no workflow run, no key or secret.

### Steps

1. Create `docs/plan/launch-checklist.md` with this content:

````markdown
# Launch checklist

For the owner. In order. Stop at the first item that fails, fix it, and start that item again. Tick an item only with its proof.

## Before anything is public

1. **The old key is gone and a new one is in use.** Proof: `git ls-files | grep -iE '\.key(\.pub)?$'` prints nothing; `SECURITY.md` has the section "The signing key".
2. **`LICENSE` exists.** Proof: the file starts with `MIT License`.
3. **The three security findings of the engineering review are closed** (task 0.2). Proof: the pull request of task 0.2 is merged, and its tests are in `cargo test`.
4. **The name is OpenPier everywhere** (task 0.4). Proof: the grep in task 0.4 prints only the two kept old-name lines.

## The launch, in order

1. **All four items above are true.**
2. **Community standards is fully ticked.** Proof: the page in Insights shows every item ticked. Repo settings of WO-6.1 are done: description, topics, Discussions, private vulnerability reporting, secret scanning, branch protection.
3. **The CI badge is green on `main`.** Proof: the badge in the README.
4. **One release went through the whole release checklist, including a real update.** Proof: `node scripts/release-draft-check.mjs v<x.y.z>` printed only `ok` before you pressed Publish; the `.dmg` opened on a Mac that never had the app; the Intel `.dmg` opened on an Intel Mac or under Rosetta; from the previous version, `Check now` found the new one, installed it and restarted into it.
5. **The install line works on a clean Mac.** Proof: the `Install smoke` job is green, and one person who is not you ran the line and the app opened (or they got past the first-open screen with the README steps).
6. **The evaluation scenarios were run on a real Mac after phase 3.** Proof: the notes from `docs/research/evaluation-kit.md`, with what failed.
7. **Three to five engineers used it while someone watched.** Proof: their top problems are fixed or written in `ROADMAP.md`.
8. **The name check is done.** Proof: trademark and domain search written down (product review P4.2).
9. **The repo is renamed to `openpier`** in the GitHub settings. Proof: `git grep -n "container-ui"` prints nothing outside `CHANGELOG.md` and `docs/`; the updater endpoint in `src-tauri/tauri.conf.json` and the address in `scripts/install.sh` use `openpier`. (GitHub redirects the old address, but do not rely on it for the updater.)
10. **Old installs are told.** Versions 0.1 and 0.2 look for updates at the old address with the old key, so they will never see the new version. Put this in the release notes: `Versions 0.1 and 0.2 cannot update themselves to this version. Download the .dmg from this page and replace the app by hand.`
11. **The "Works with" and "How it compares" tables in the README are true today.** Proof: you tried each engine listed; you read each tool's own page again.
12. **Then, and only then, the first public post.** Lead with the one thing nobody else does: it tells you what is wrong and fixes it. One GIF of that, and the comparison table with its caveat sentence.

## After launch

1. Reply to every issue within the time `CONTRIBUTING.md` promises (7 days). Promise only what you can always meet.
2. Label five small, well-described issues `good first issue` before the post goes out.
3. Read the measures from `docs/plan/03-review-product.md` section P7 where they live: downloads per version from the GitHub Releases API, time to first review and contributors from GitHub Insights, and "it told me why" from issue titles, by hand, once a month. There is no telemetry.
4. One release every two to four weeks while there is something to ship. Each release note names what a user can now do.
5. A Homebrew tap (our own, not the official cask list) is in `ROADMAP.md` under Next.
````

2. Add a rule to `scripts/release-check.mjs` (before the closing `];`):

```js
  ["docs/plan/launch-checklist.md has the 12 launch items", () => { const t = read("docs", "plan", "launch-checklist.md"); const part = t.split("## The launch, in order")[1].split("## After launch")[0]; return (part.match(/^\d+\. \*\*/gm) || []).length === 12; }],
```

3. `npm run check:release` and the gate.

### Tests to write first

The rule in step 2 first; it fails until the file exists.

### Done when

1. `npm run check:release` prints no `FAIL`.
2. `grep -c "—" docs/plan/launch-checklist.md` prints `0`.
3. The gate in `../HANDOFF.md` section 5.

### Owner steps

The checklist file is the owner's steps. Walk it top to bottom. Report each failure to the plan's author with the item number.

**Pull request title:** `wo-6.6: Launch checklist for the owner`
