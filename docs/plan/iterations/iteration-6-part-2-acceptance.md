# Iteration 6, part 2: acceptance checklist

Walk this by eye after `sh docs/plan/iterations/verify-iteration-6-part-2.sh` prints no FAIL. Work orders are in `iteration-6-part-2-work-orders.md`. Each one has a pull request text file at `docs/plan/iterations/pr/wo-<id>.md` (no GitHub pull requests; merged with `git merge --no-ff`).

## Cheats to look for in every work order

1. A test weakened or deleted so it passes (compare test names with the work order).
2. `scripts/not-migrated.json` or `scripts/checks-pending/` growing.
3. `style=` attributes, new colours, a new CSS file or edits to `src/ui/openpier.css`.
4. Words on screen that differ from the "Words" lists.
5. A TODO, `skip`, `.only`, or `eslint-disable` added.
6. A threshold raised in `scripts/mockup-pairs.json` instead of the screen fixed.
7. A step that said "stop and report" done anyway.
8. The pull request file missing, or empty of the output the work order asked to paste.

## WO-8.9 Pinned actions, audits, checksums

1. Open `.github/workflows/`: every `uses:` reads `owner/repo@<40 hex> # <old ref>`.
2. `dtolnay/rust-toolchain` is `@<sha> # master` with `toolchain: stable` in `with:`.
3. `audit.yml` exists: npm audit (omit dev, level high), cargo audit, weekly schedule, Node 22.
4. The release workflow writes `SHA256SUMS` and uploads it.
5. Run `sh scripts/checksums.sh` on two fake dmg files and `shasum -a 256 -c` accepts the result.
6. Cheats: ignore rules added to make audits pass; `npm audit fix` run; SHAs typed by hand (the pull request text shows the `pin-actions.mjs` output).
7. Owner, by hand: read the first run of the Audit workflow after the work is pushed (cargo-audit 0.23.0 install is Not verified).

## WO-8.10 Security model page

1. Open `docs/security-model.md`. Seven headings in the order of the work order.
2. Every docker command, every `#[tauri::command]`, every permission appears in backticks.
3. Each of the five "Refused on purpose" lines is true (pick two and check against the code).
4. Plain English, no jargon, no names, no em dashes.
5. Cheats: Rust code or CSP edited; the check script changed to skip things.

## WO-8.11 Versioned settings

1. `src/lib/settings.ts`: one key `openpier:settings`, `{ version, values }`, string values, old keys left in place, `theme` mirrored.
2. `grep -rn localStorage src` shows only the settings file, the key copy from WO-0.4 and tests.
3. ESLint rule blocks new `localStorage` use.
4. In the preview: set a sidebar fold, reload, it stays.
5. The four earlier assertions were updated as written in step 7b (sidebar fold, theme, tray key, notify) and not deleted; the inline theme script is unchanged; the fold key is `"1"` or absent.
6. Cheats: key names changed; defaults changed; try/catch removed that was needed; an old assertion removed instead of updated.

## WO-8.12 Start at login and window state

1. Open `http://localhost:4173/?scenario=design#/settings/general` next to `docs/plan/design/shots/settings-machines-light.png`. Two new rows after Theme: `Start OpenPier at login` and `Start the selected machine with it`, same row style as the others.
2. The machine switch is disabled while login is off; shown only for Colima.
3. No other "start at login" control exists in Settings, Machines, and the `settings-machines` pair no longer masks one. `src-tauri/capabilities/default.json` gained exactly three `autostart:allow-*` entries, and the pull request file says why.
4. `Cargo.toml` has both plugins with the desktop target; plugin docs cited by URL in the work order.
5. Window state flags are SIZE, POSITION, MAXIMIZED (not VISIBLE).
6. By hand, owner only: switch the login item on, log out and in, the app is in the menu bar with no window; resize and move, quit, reopen: same size and place. If the window shows at login, the hide step did not work (Not verified).
7. Cheats: login started through a shell script or a hand-written LaunchAgent file; the other capability permissions widened.

## WO-8.14a Image history on the allowlist

1. In the allowlist file, `history` is one exact shape: `history --no-trunc --format {{json .}} <image>`. Nothing else for history passes.
2. `image_ref_ok` refuses an empty text, a leading `-`, spaces, `;`, `$`, backticks, newlines and `|`.
3. `image_remote_digest` runs `docker buildx imagetools inspect` with fixed arguments; a missing buildx gives the message that says `brew install docker-buildx`.
4. `docs/security-model.md` mentions `docker history` and `image_remote_digest`.
5. Cheats: other allowlist arms changed; `run_args_ok` touched; `login` added anywhere.

## WO-8.14b Image detail page

1. Open `/?scenario=design#/images`, click the postgres row. Compare with `docs/plan/design/shots/image-detail-light.png` and `image-detail-dark.png`.
2. Header: back, `postgres:16`, size and "used by", buttons `Look inside`, `Check for a newer one`, `Run` (primary, last), ⋯ menu.
3. Facts line under the header with id, platform, built time, layers, source.
4. Tabs `Layers` and `Settings it starts with`. Layers table: columns step and `Added`, 7 steps, note `The base system` on row 1, `Most of the size is here` on the biggest, muted note text, no tinted rows.
5. Settings tab: `Listens on 5432`, `Keeps data in /var/lib/postgresql/data`, `Sets 3 variables: LANG, PGDATA, PG_MAJOR`, `Starts with docker-entrypoint.sh postgres`.
6. Allowed differences from the mockup: no `Overview` or `Files` tab and no "Files added by step 3" list.
7. `Check for a newer one` on `&newer=1` shows the warn banner and `Pull`; `&buildx=1` shows the bad banner.
8. `Look inside` opens Terminal on `docker run --rm -it <image> sh` (check `window.__terminal`).
9. The page body is `.content.stack.top` (no `style=`); layer rows are `plain mono long` with the step number as lead; facts are `div.facts`. The no-shell image gap is listed in `docs/plan/FOUND.md`.
10. Cheats: `style=` for spacing; clickable layer rows; an invented Files tab; `mockup-pairs.json` threshold above 0.06.

## WO-8.15a Registries backend

1. `registry.rs`: only `IgnoredAny` for values; no write call before the test module; no password or token words.
2. `docker login` and `docker logout` are still absent from the allowlist file.
3. Sign-in lines: Docker Hub `docker login`; other host `docker login <host>`; AWS ECR region read from the host, piped to `docker login --username AWS --password-stdin`; public gallery uses `ecr-public` in `us-east-1`.
4. `open_terminal` accepts a pipe only for kind `login`; the shell-injection tests (`;`, `$()`, backticks) refuse.
5. `src/lib/registry.ts` agrees with the Rust lines.
6. Cheats: the file `~/.docker/config.json` opened or written by any code; a password field anywhere; the pipe allowed for every kind.

## WO-8.15b Registries screen

1. Open `/?scenario=design&registries=1#/settings/registries` next to `docs/plan/design/shots/settings-machines-light.png` (no Registries picture exists; spec 7.13 and the section list as a sixth `NavItem` after Engines). Same section list, row height, aligned columns, one quiet button per row.
2. Rows: Docker Hub, GitHub, AWS ECR, registry.example.com. States `Signed in`, `Not signed in`, `Managed by a helper`. AWS row: `AWS sign-ins last 12 hours.`
3. Intro line says OpenPier never sees your password. No "Signed in as" user name (decided: the row says `Signed in`).
4. `Sign in` opens Terminal and shows the toast `Terminal opened. Sign in there, then come back.`
5. Pull sheet, Other registry: caption `Signed in` with chips; AWS ECR shows the repository list; with `&registries=1&noaws=1` the muted explanation shows.
6. A denied pull shows `You are not signed in to GitHub` with a `Sign in` button and the command line.
7. Cheats: a copy-only sign-in; an input that takes a token; a user name read from the config; a new colour.

## WO-8.13 Keyboard and VoiceOver gate

1. `PW_ENGINE=webkit node scripts/check-keyboard.mjs` and the same with `chromium` print only `ok` lines. Any `ok (accepted: ...)` has a matching line in `docs/accessibility-pass.md` under "Problems found and not fixed".
2. `docs/accessibility-pass.md` lists 22 screens. Only the "Automated keyboard check" column may say `ok`; the other columns and the date still say `pending`.
3. `node scripts/check-a11y-pass.mjs` exits 0 and `--final` exits 1.
4. No visible word or layout changed by the fixes (spot check two fixed controls).
5. Cheats: the ACCEPTED list used to hide failures without a checklist line; `pending` replaced by `ok` for VoiceOver; focus ring removed or restyled.
6. Owner, before launch: do both passes by hand, fill the table, run `node scripts/check-a11y-pass.mjs --final`.
