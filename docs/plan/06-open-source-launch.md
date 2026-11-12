# Open-source launch and releases

How to make the repo one that people trust in two minutes, and how to publish a release that installs and updates. These are tasks 6.1 to 6.6 of `05-implementation-plan.md`.

The workflow files below are written from the Tauri 2 and `tauri-action` documentation. **None of them has been run.** The first run of each is part of its task, and the task is not done until that run is green.

`<OWNER>` below is `BitVerseNomad`, the account that owns the repo today (decided, `03-review-product.md` P9.6). It is kept as a marker so that a later move to an organisation is one search and replace.

## 1. What must be true before anything is public

1. The old signing key files are removed, a new key is in use, and `SECURITY.md` says the old one is not trusted (task 0.1). The old key stays in the history; that was the owner's choice (P9.1).
2. `LICENSE` exists (section 2).
3. The three P0 security findings are closed (task 0.2).
4. The name is OpenPier everywhere (task 0.4).

## 2. Task 6.1: licence and community files

The licence is MIT (decided, P9.2).

| File | Content |
|---|---|
| `LICENSE` | MIT text, year 2026, holder "OpenPier contributors" |
| `SECURITY.md` | How to report privately (GitHub "Report a vulnerability"), what is in scope (the app, the updater, the install script), reply within 7 days. One note on the 2026 key rotation: releases before 1.0 were signed with a key that is no longer trusted |
| `CONTRIBUTING.md` | One page: what to install (Node 20, Rust stable, Xcode command line tools), `npm ci`, `npm run preview` (no engine needed), `npm run tauri dev`, the checks to run, "one PR, one change", where the design lives (`docs/plan/design/`), when reviews happen |
| `CODE_OF_CONDUCT.md` | Contributor Covenant 2.1, contact = the security contact |
| `ROADMAP.md` | Three lists: Now (1.0 scope from P3), Next, Later. Replaces every other roadmap file |
| `.github/ISSUE_TEMPLATE/bug.yml` | Fields: what happened, what you expected, engine and version (from Settings, About, "Copy details"), macOS version, steps |
| `.github/ISSUE_TEMPLATE/feature.yml` | Fields: the problem, who has it, what you do today |
| `.github/ISSUE_TEMPLATE/config.yml` | `blank_issues_enabled: false`, link to Discussions for questions |
| `.github/PULL_REQUEST_TEMPLATE.md` | What changed for the user, how it was checked, screenshots light and dark for UI |
| `.github/dependabot.yml` | npm, cargo, github-actions, weekly, grouped minor and patch |

Repo settings (owner, in the GitHub UI): description = the tagline, topics `docker`, `containers`, `colima`, `tauri`, `macos`, `desktop-app`; enable Discussions, private vulnerability reporting, secret scanning with push protection; protect `main` (PR required, CI required).

Done when: GitHub's "Community standards" page shows every item ticked.

## 3. CI on every pull request (task 0.6)

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
permissions:
  contents: read
jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test
      - run: npx playwright install --with-deps webkit chromium
      - run: npm run check
      - if: failure()
        uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: playwright-report/ }
  rust:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with: { components: "clippy, rustfmt" }
      - uses: Swatinem/rust-cache@v2
        with: { workspaces: src-tauri }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci && npm run build
      - run: cargo fmt --check
        working-directory: src-tauri
      - run: cargo clippy --all-targets -- -D warnings
        working-directory: src-tauri
      - run: cargo test
        working-directory: src-tauri
```

Notes:

1. `npm run check` only exists in a working state after task 0.3. Until then, leave that line out and add it in 0.3.
2. The Rust job builds the frontend first because `tauri::generate_context!` needs `../dist` to exist at compile time.
3. The Rust job runs on macOS because the code calls macOS paths. If `cargo clippy -D warnings` fails on day one, fix the warnings in the same PR or list them in `FOUND.md` and drop `-D warnings` until they are fixed. Do not add `#[allow]` to pass.

## 4. Task 6.2: the release workflow

Replaces `.github/workflows/release.yml` (broken today: see E5).

### 4.0 Install the updater plugin

It is not installed today (E5).

1. Run `npm run tauri add updater`. Check that it added: `tauri-plugin-updater` to `src-tauri/Cargo.toml`, `@tauri-apps/plugin-updater` to `package.json`, `.plugin(tauri_plugin_updater::Builder::new().build())` to the builder in `main.rs`, and `updater:default` to `src-tauri/capabilities/default.json`. Add by hand whatever it did not.
2. Settings, Updates: a "Check for updates" button that calls `check()`, shows the new version and its notes, and on confirm calls `downloadAndInstall()` then restarts. On start, check once when "Check for updates automatically" is on.
3. Unit test with the plugin mocked: no update, update found, download fails.

### 4.1 Config

`src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "createUpdaterArtifacts": true,
    "targets": ["app", "dmg"]
  },
  "plugins": {
    "updater": {
      "pubkey": "<the new public key from task 0.1>",
      "endpoints": [
        "https://github.com/<OWNER>/openpier/releases/latest/download/latest.json"
      ]
    }
  }
}
```

`latest.json` is produced and uploaded by `tauri-action`. Delete the hand-written `latest.yml` step.

### 4.2 Workflow

```yaml
name: Release
on:
  push:
    tags: ["v*"]
permissions:
  contents: write
jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - runner: macos-latest
            target: aarch64-apple-darwin
          - runner: macos-latest
            target: x86_64-apple-darwin
    runs-on: ${{ matrix.runner }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
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
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          # Only when the owner has an Apple Developer account (section 6):
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: "OpenPier ${{ github.ref_name }}"
          releaseDraft: true
          prerelease: false
          args: --target ${{ matrix.target }}
```

Why a draft: the owner reads the notes, downloads the `.dmg`, opens it, and only then presses Publish. `releases/latest/download/latest.json` only points at published releases, so users only get builds a person has tested.

Both architectures build on `macos-latest` (Apple Silicon); the Intel build is cross-compiled. The Intel `.dmg` is therefore not opened by CI. Open it on an Intel Mac, or under Rosetta, for the first release.

There is no Apple account (P9.3), so leave those six `env` lines out of the file; do not leave them empty.

### 4.3 How to cut a release

1. `npm version <patch|minor|major> --no-git-tag-version`, and set the same version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`. Add `scripts/bump.mjs <version>` that does all three and updates `CHANGELOG.md`'s heading.
2. PR, merge.
3. `git tag v<version> && git push origin v<version>`.
4. Wait for the draft. Run the checklist in 4.4. Publish.

Pushing a tag needs a token with the `workflow` scope when the push also changes workflow files. An earlier push from an agent session failed for that reason. Releases are cut by the owner.

### 4.4 Checklist before pressing Publish

1. The draft has, for each architecture: a `.dmg`, an `.app.tar.gz`, an `.app.tar.gz.sig`; and one `latest.json`.
2. `latest.json` has a non-empty `signature` for `darwin-aarch64` and `darwin-x86_64`, and its `version` equals the tag.
3. The `.dmg` opens on a Mac that never had the app, the app starts, Containers lists data.
4. From the previous published version, "Check for updates" finds this one after publishing, installs it, and restarts into it. This is the only real test of the updater. Do it for the first three releases at least.
5. Release notes say what changed for a user, in plain words.

Done when (task 6.2): one tag has gone through all five checks.

## 5. Task 6.3: install script and Homebrew

1. `scripts/install.sh`: detects architecture, downloads the latest `.dmg` from `https://github.com/<OWNER>/openpier/releases/latest/download/`, verifies a SHA-256 published in the release, copies the app to `/Applications`, and prints what it did. It never uses `sudo` and never changes Gatekeeper settings. Give the `.dmg` a stable name per architecture in the release (`OpenPier-arm64.dmg`, `OpenPier-x64.dmg`) with an extra upload step, so the URL does not change with the version.
2. README install line: `curl -fsSL https://raw.githubusercontent.com/<OWNER>/openpier/main/scripts/install.sh | sh`, with the manual path next to it (download the `.dmg`, drag to Applications).
3. Homebrew: a tap repo `<OWNER>/homebrew-openpier` with a cask. Update it from the release workflow with a second job after publishing. Do this after 1.0; a cask in `homebrew/cask` needs a notarised app and some adoption first.
4. CI job `install-smoke` (on release published): runs the install line on `macos-latest` and checks `/Applications/OpenPier.app` exists and its `Info.plist` version equals the tag.

## 6. Task 6.5: signing and notarisation

Decided (P9.3): no Apple Developer account. Item 1 below is what to build. Item 2 is kept for the day that changes.

1. **Without an Apple Developer account**: the app is ad-hoc signed. macOS shows "cannot be opened" on first launch and the user must allow it in System Settings, Privacy and Security. The README must say so, with a screenshot, above the fold. The install script must not remove the quarantine flag silently; it prints the one step the user has to do.
2. **With the account** (99 USD a year): create a "Developer ID Application" certificate, export it as `.p12`, base64 it into `APPLE_CERTIFICATE`; create an app-specific password for `APPLE_PASSWORD`. `tauri-action` then signs and notarises. Check with `spctl -a -vv /Applications/OpenPier.app` (expect "accepted, source=Notarized Developer ID").

## 7. Task 6.4: README and screenshots

### 7.1 Structure (in this order, nothing else)

1. Name, tagline, three badges (CI, latest release, licence).
2. One hero screenshot: Containers, with one problem row open. Light and dark with a `<picture>` element.
3. Three lines: what it is, who it is for, what it is not.
4. Install: the one line, then the manual path, then the first-launch note if not notarised.
5. "What it does": six items at most, each one line and one small screenshot (Containers, Doctor, Run, Networks test, engine switcher, Setup).
6. "Works with": the engine table from P2's last column, honest about which have machine controls (Colima only in 1.0).
7. "How it compares": the P2 table, with its caveat sentence.
8. Development: four commands and a link to `CONTRIBUTING.md`.
9. Roadmap, security, licence: one line and a link each.

No feature the app does not have. No "coming soon" in the feature list; that is what `ROADMAP.md` is for.

### 7.2 Screenshots by script

`scripts/readme-shots.mjs`: opens the preview with the `design` mock scenario in WebKit at 1280x800, device scale factor 2, and writes `docs/screenshots/<name>-<light|dark>.png` for the screens in 7.1. Run it in the release PR. The CI job `shots-fresh` fails when the files differ from a fresh run by more than the `check-mockup` threshold, so the README cannot drift from the app again.

## 8. Task 6.6: launch

In order. Stop at the first one that fails.

1. All of section 1 is true.
2. Community standards page is fully ticked (section 2).
3. CI badge is green on `main`.
4. One release went through checklist 4.4, including a real update from the previous version.
5. Install line passes on a clean Mac (the `install-smoke` job, plus one person who is not the owner).
6. `docs/research/evaluation-kit.md` scenarios were run on a real Mac after phase 3 (P8.2).
7. Three to five engineers used it while someone watched; the top problems are fixed or in `ROADMAP.md` (P8.1).
8. Name check done: trademarks and the domain (P4.2).
9. The repo is renamed from `container-ui` to `openpier` in GitHub settings, and every URL in the app, the updater endpoint and the install script uses the new name.
10. Old installs: versions 0.1 and 0.2 look for updates at the old repo with the old key, so they will never see 1.0. Say in the 1.0 notes that older installs must be replaced by hand.
11. Then, and only then: the first public post. Lead with the one thing nobody else does (it tells you what is wrong and fixes it), one GIF of that, and the comparison table with its caveat.

## 9. After launch

1. Reply to every issue within the time `CONTRIBUTING.md` promises. Promise a time you can always meet.
2. Label `good first issue` on five small, well-described issues before the post goes out.
3. Where the measures in `03-review-product.md` P7 are read, since the app has no telemetry: downloads per version from the GitHub Releases API, time to first review and contributors from GitHub Insights, "it told me why" from issue titles by hand once a month. The share of Doctor findings where the user clicks the fix cannot be collected without an opt-in; until one exists, drop it.
4. One release every two to four weeks while there is something to ship. Each release notes entry names what a user can now do.
