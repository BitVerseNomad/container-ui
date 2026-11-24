# Iteration 6, part 2: work orders 8.9 to 8.15

Tasks 8.9 to 8.15 of `../08-feature-gaps.md` section 8. Another file holds 8.1 to 8.8. Read `../HANDOFF.md` and `README.md` (this folder) first.

## What this iteration delivers

1. A safer build: actions pinned by commit, dependency audits, checksums for each release, a written security model, and one versioned settings store.
2. Start at login (menu bar only), window size and position remembered, a private-registry screen with sign-in through Terminal, and an image detail page with layers and "Check for a newer one".
3. A keyboard and VoiceOver gate, with an automated keyboard check and a checklist the owner fills in before launch.

## The order

1. WO-8.9 supply chain (X4). Needs 0.6.
2. WO-8.10 security model page (X5). Needs 0.2 and WO-8.9 (same check style).
3. WO-8.11 versioned settings (X6). Needs 0.4.
4. WO-8.12 start at login and window state (G15). Needs 8.1 (menu bar, from part 1) and WO-8.11.
5. WO-8.14a image history on the allowlist and the "newer image" command (G17, backend). Needs 3.4.
6. WO-8.14b image detail page (G17, screen). Needs WO-8.14a.
7. WO-8.15a registries backend: read the list, open Terminal for sign-in (G10, backend). Needs 3.9 and WO-8.10.
8. WO-8.15b registries screen, Pull sheet sources, sign-in on a denied pull (G10, screen). Needs WO-8.15a, WO-8.11 and 3.3.
9. WO-8.13 keyboard and VoiceOver gate (G16). Needs every screen of this iteration, so it is last. The plan numbers it before 8.14 and 8.15; this order is on purpose, because the gate must see the screens those two add.

WO-8.14 and WO-8.15 are split in two each: a backend pull request and a screen pull request. Each half fits one review.

## What the earlier iterations leave (assumed by every work order)

1. Iterations 1 to 5 and 8.1 to 8.8 are merged. The gate is green.
2. `src-tauri/Cargo.toml` depends on `tauri`, `serde`, `serde_json` and whatever 8.1 and 8.2 added. The crates `sqlx`, `tokio`, `uuid`, `chrono`, `anyhow`, `lazy_static` and `dirs` are gone. Use `std::env::var("HOME")` for the home folder.
3. `main.rs` was split in WO-5.2. The functions named in this file (`docker_args_allowed`, `flags_ok`, `terminal_command`, `terminal_script`, `open_terminal`, `docker_pull`, `find_bin`, `exec`, `context_ok`, `NETSHOOT_IMAGE`) live in some module. Every Starting state below prints where. Write the module path you find into the pull request and use it as `crate::<module>::<name>`. A private item that another module must use becomes `pub(crate)`. That is the only change allowed to existing code besides the edits listed.
4. The app's identifier is `dev.openpier.desktop`.
5. Browser checks import `open`, `check` and `done` from `scripts/lib/check.mjs`. `const page = await open(path, opts)` returns a Playwright page (1280x800, light; `opts` may set `width`, `height`, `colorScheme`). `check(cond, message)` prints `ok` or `FAIL`. `await done()` closes the browser and exits 1 on any FAIL. Run one engine by hand with `PW_ENGINE=webkit node scripts/<name>.mjs` (`PW_ENGINES` is only for `check-all.sh`).
6. `scripts/check-all.sh` runs every `scripts/check-*.mjs` in Chromium and WebKit. A script that does not need a browser still runs there, twice, and must print `ok` or `FAIL` lines.
7. Pure logic tests are `src/**/*.test.ts` on `node --test` and import with a `.ts` extension (see `src/lib/registry.test.ts`). Component tests are `src/**/*.test.tsx` on vitest. Rust tests are named `given_..._when_..._then_...`.

8. There are no GitHub pull requests. The implementer does not push. Each work order is built on a branch `wo-<id>` and merged into local `main` with `git merge --no-ff wo-<id>`. Everywhere this file says "the pull request" or "Pull request title", it means the text file `docs/plan/iterations/pr/wo-<id>.md` (screenshots under `docs/plan/iterations/pr/wo-<id>/`). Its first line is the title given in each work order. Lines that say "write X in the pull request" go into that file. Lines about requesting reviewers on GitHub do not apply.
9. Components are imported from `src/ui` and use the props written in WO-1.3a and WO-1.3b of `iteration-1-work-orders.md`: `Banner` takes `tone`, `title`, `children`, `actions`; `Empty` takes `icon`, `title`, `children`, `actions`; `Switch` takes `checked`, `onChange`, `aria-labelledby`; `Tabs` takes `value`, `onChange`, `items`, `aria-label` and `TabPanel`; `Sheet` takes `open`, `onClose`, `title`, `fact`, `busy`, `footer`; `Menu` takes `trigger`, `label`; `MenuItem` takes `label`, `why`, `danger`, `disabled`, `onSelect`; `useToast()` takes `{ text, action }`; `useConfirm()` takes `{ title, body, command, confirm, danger }`; `Command` takes `text`; `Dot` takes `state` (`off`, `ok`, `warn`, `bad`, `busy`). Components are imported from `src/ui` (iteration 5 moved them there from `src/ui/op`) (iteration 5 moved them there from `src/ui/op`). Node is version 22 in CI and in docs.

Words on screen that this file fixes are quoted in each work order ("Words") and listed again in section "Words in this file" at the end. They are the design (spec section 9, first paragraph). Do not change them.

---

## WO-8.9 Pinned actions, dependency audits, release checksums (X4)

Needs: WO-0.6 (the `ci.yml` file). Part 1 may have added `nightly.yml` (8.7): it is pinned too.

Why: workflows use moving tags (`@v4`, `@v0`), nothing audits dependencies, and a release has no checksum to verify a download against (X4 in `../08-feature-gaps.md`).

Read first:
1. `../08-feature-gaps.md` section 6, row X4.
2. `../06-open-source-launch.md` sections 3 and 4.2 (the workflows) and 5 (the install script that will read `SHA256SUMS`).
3. Every file in `.github/workflows/`.

Starting state (run these, compare):
1. `git status --porcelain` prints nothing.
2. `ls .github/workflows` prints at least `ci.yml` and `release.yml`. Write the full list into the pull request.
3. `grep -rhoE "uses: [^ ]+" .github/workflows | sort -u` prints the actions in use. Expected to include `actions/checkout@v4`, `actions/setup-node@v4`, `dtolnay/rust-toolchain@stable`, `Swatinem/rust-cache@v2`. Any `uses:` line whose action is not written as `owner/repo@ref` (for example `docker://`) means stop and report.
4. `node --version` prints v22 or higher (the script uses the built-in `fetch`).
5. `ls src-tauri/Cargo.lock package-lock.json` prints both.
6. `grep -rn "Upload all assets to release" .github/workflows` prints one line in the release workflow. Note the file name.

Do not touch: workflow logic other than what the steps say. `permissions:` blocks stay as they are. No Dependabot file (not in the plan). The release workflow is replaced later by WO-6.2 (iteration 7); step 8 below adds what that work order must keep, and a check script fails if it is dropped.

Tests to write first: Step 1 (the check script) before the other steps. Run it, see it fail on the unpinned workflows, then do the rest.

Steps:

1. Create `scripts/check-supply-chain.mjs` with exactly this content:

```js
// Supply chain checks, no browser. Fails when:
// 1. a workflow action is not pinned to a 40 character commit id (with the old ref in a comment),
// 2. the audit workflow does not run npm audit and cargo audit,
// 3. a release workflow does not make and upload SHA256SUMS,
// 4. scripts/checksums.sh does not write a file that shasum can verify.
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

let failed = 0;
const check = (cond, message) => {
  console.log(cond ? "ok" : "FAIL", message);
  if (!cond) failed++;
};

const dir = ".github/workflows";
const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
const USES = /^\s*(?:-\s+)?uses:\s*(\S+?)@(\S+?)(?:\s+#\s*(\S.*))?$/;
for (const f of files) {
  const lines = readFileSync(join(dir, f), "utf8").split("\n");
  lines.forEach((line, i) => {
    const m = USES.exec(line);
    if (!m || m[1].startsWith("./")) return;
    const [, action, ref, comment] = m;
    check(/^[0-9a-f]{40}$/.test(ref), `${f}:${i + 1} ${action} is pinned to a commit`);
    check(Boolean(comment), `${f}:${i + 1} ${action} keeps its old ref in a comment`);
  });
}

const audit = existsSync(join(dir, "audit.yml")) ? readFileSync(join(dir, "audit.yml"), "utf8") : "";
check(audit.includes("npm audit --omit=dev"), "audit.yml runs npm audit --omit=dev");
check(audit.includes("cargo audit"), "audit.yml runs cargo audit");
check(/schedule:/.test(audit), "audit.yml also runs on a weekly schedule");

for (const f of files) {
  const text = readFileSync(join(dir, f), "utf8");
  if (!/tauri-action|action-gh-release/.test(text)) continue;
  check(text.includes("scripts/checksums.sh") && text.includes("SHA256SUMS"), `${f} makes and uploads SHA256SUMS`);
}

const tmp = mkdtempSync(join(tmpdir(), "openpier-sums-"));
mkdirSync(join(tmp, "in", "a"), { recursive: true });
mkdirSync(join(tmp, "in", "b"), { recursive: true });
writeFileSync(join(tmp, "in", "a", "OpenPier_1.0.0_arm64.dmg"), "arm");
writeFileSync(join(tmp, "in", "b", "OpenPier_1.0.0_x64.dmg"), "intel");
const run = spawnSync("sh", ["scripts/checksums.sh", join(tmp, "in"), join(tmp, "SHA256SUMS")], { encoding: "utf8" });
check(run.status === 0, "checksums.sh exits 0 on two dmg files");
const sums = existsSync(join(tmp, "SHA256SUMS")) ? readFileSync(join(tmp, "SHA256SUMS"), "utf8").trim().split("\n") : [];
check(sums.length === 2 && sums.every((l) => /^[0-9a-f]{64}  \S+\.dmg$/.test(l)), "SHA256SUMS has one 'hash  name' line per dmg");
mkdirSync(join(tmp, "dl"));
copyFileSync(join(tmp, "in", "a", "OpenPier_1.0.0_arm64.dmg"), join(tmp, "dl", "OpenPier_1.0.0_arm64.dmg"));
copyFileSync(join(tmp, "in", "b", "OpenPier_1.0.0_x64.dmg"), join(tmp, "dl", "OpenPier_1.0.0_x64.dmg"));
copyFileSync(join(tmp, "SHA256SUMS"), join(tmp, "dl", "SHA256SUMS"));
const verify = spawnSync("shasum", ["-a", "256", "-c", "SHA256SUMS"], { cwd: join(tmp, "dl"), encoding: "utf8" });
check(verify.status === 0, "shasum -c accepts the file next to the downloads");
const empty = spawnSync("sh", ["scripts/checksums.sh", join(tmp, "dl", "nothing"), join(tmp, "x")], { encoding: "utf8" });
check(empty.status !== 0, "checksums.sh fails when the folder does not exist");

process.exit(failed ? 1 : 0);
```

2. Run it: `node scripts/check-supply-chain.mjs`. Expected: exit 1, with `FAIL` lines for every unpinned action, `audit.yml`, and `checksums.sh`. Paste the output in the pull request.

3. Create `scripts/checksums.sh` with exactly this content:

```sh
#!/bin/sh
# Writes SHA256SUMS for every .dmg under a folder, in the format "hash  filename" that `shasum -a 256 -c` reads.
# Usage: sh scripts/checksums.sh <folder> <output file>
set -eu
dir="${1:?folder with the .dmg files}"
out="${2:?output file}"
[ -d "$dir" ] || { echo "no such folder: $dir" >&2; exit 1; }
list="$(mktemp)"
find "$dir" -type f -name '*.dmg' | sort > "$list"
[ -s "$list" ] || { echo "no .dmg files under $dir" >&2; rm -f "$list"; exit 1; }
names="$(sed 's|.*/||' "$list" | sort | uniq -d)"
[ -z "$names" ] || { echo "two files share a name: $names" >&2; rm -f "$list"; exit 1; }
: > "$out"
while IFS= read -r f; do
  hash="$(shasum -a 256 "$f" | cut -d' ' -f1)"
  printf '%s  %s\n' "$hash" "$(basename "$f")" >> "$out"
done < "$list"
rm -f "$list"
echo "wrote $out: $(wc -l < "$out" | tr -d ' ') files"
```

4. Create `scripts/pin-actions.mjs` with exactly this content:

```js
// Pins every GitHub Action in .github/workflows to a commit id and keeps the old ref in a comment.
// Usage: node scripts/pin-actions.mjs [--dry-run]
// Reads the GitHub API (read only). Set GITHUB_TOKEN to lift the limit of 60 requests an hour.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = ".github/workflows";
const dry = process.argv.includes("--dry-run");
const USES = /^(\s*(?:-\s+)?uses:\s*)([\w.-]+\/[\w.-]+(?:\/[\w./-]+)?)@([^\s#]+)(\s*#.*)?$/;
const SHA = /^[0-9a-f]{40}$/;
const cache = new Map();

async function resolve(repo, ref) {
  const key = `${repo}@${ref}`;
  if (cache.has(key)) return cache.get(key);
  const headers = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(ref)}`, { headers });
  if (!res.ok) throw new Error(`${key}: GitHub answered ${res.status}`);
  const { sha } = await res.json();
  if (!SHA.test(sha)) throw new Error(`${key}: no commit id in the answer`);
  cache.set(key, sha);
  return sha;
}

let changed = 0;
for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) {
  const lines = readFileSync(join(dir, f), "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = USES.exec(lines[i]);
    if (!m) continue;
    const [, prefix, action, ref] = m;
    if (SHA.test(ref)) continue;
    // The Rust toolchain action picks the toolchain from its ref. Pinned by commit it needs `toolchain:` instead.
    if (action.startsWith("dtolnay/rust-toolchain") && ref !== "master") {
      throw new Error(`${f}:${i + 1}: change @${ref} to @master and add "toolchain: ${ref}" under with:, then run this again`);
    }
    const repo = action.split("/").slice(0, 2).join("/");
    const sha = await resolve(repo, ref);
    lines[i] = `${prefix}${action}@${sha} # ${ref}`;
    console.log(`${f}:${i + 1} ${action}@${ref} -> ${sha.slice(0, 12)}`);
    changed++;
  }
  if (!dry) writeFileSync(join(dir, f), lines.join("\n"));
}
console.log(`${changed} line(s) ${dry ? "would change" : "changed"}`);
```

5. Prepare the Rust toolchain lines. In every workflow file, find each `uses: dtolnay/rust-toolchain@stable`. Replace it with `uses: dtolnay/rust-toolchain@master` and add `toolchain: stable` to the `with:` of that step. Example: `with: { components: "clippy, rustfmt" }` becomes `with: { toolchain: stable, components: "clippy, rustfmt" }`. A step with `targets: ...` becomes `with: { toolchain: stable, targets: "${{ matrix.target }}" }`. Why: the action reads the toolchain from the ref, and a commit id has no name (source: https://github.com/dtolnay/rust-toolchain, "the default is to match the @rev"; with a `toolchain` input the page says to use `@master`).

6. Pin: `node scripts/pin-actions.mjs --dry-run` and read the output (every action, one line each). Then `node scripts/pin-actions.mjs`. If it says "GitHub answered 403", wait ten minutes and run it again, or set `GITHUB_TOKEN`. Then `git diff .github/workflows`: every `uses:` line now reads `owner/repo@<40 hex> # <old ref>`. Nothing else in the diff except step 5.

7. Create `.github/workflows/audit.yml` with this content, then run `node scripts/pin-actions.mjs` again so its actions get pinned too:

```yaml
name: Audit
on:
  pull_request:
    paths:
      - package.json
      - package-lock.json
      - src-tauri/Cargo.toml
      - src-tauri/Cargo.lock
      - .github/workflows/audit.yml
  push:
    branches: [main]
  schedule:
    - cron: "17 5 * * 1"
permissions:
  contents: read
jobs:
  npm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      # Only what ships in the app. High and critical fail the job; lower ones are listed in the log.
      - run: npm audit --omit=dev --audit-level=high
  cargo:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@master
        with: { toolchain: stable }
      - run: cargo install cargo-audit --locked --version 0.23.0
      - run: cargo audit
        working-directory: src-tauri
```

Why `--audit-level=high`: a low or moderate advisory in a transitive package with no fix would block every pull request. The weekly run still lists them. Why `cargo audit` with no flags: it fails on known vulnerabilities and only warns for unmaintained crates.

Not verified: that `cargo-audit` 0.23.0 installs on the runner's stable Rust. Nobody can check this without pushing. The owner reads the first run of the Audit workflow (acceptance checklist). Do not add ignore rules to make it pass.

8. In the release workflow found in Starting state item 6, make three edits:
   1. In the job that holds the step named `Upload all assets to release`, add as the first step of that job (before every `download-artifact` step) `- uses: actions/checkout@v4` and run `node scripts/pin-actions.mjs` again afterwards so it is pinned. Reason: the job needs `scripts/checksums.sh` from the repo.
   2. Insert this step directly before the step named `Upload all assets to release`:
```yaml
      - name: Write SHA256SUMS
        run: sh scripts/checksums.sh artifacts SHA256SUMS
```
   3. In that step's `files: |` list add the line `SHA256SUMS` (same indent as the other file lines).
   WO-6.2 (iteration 7) replaces this file. It must keep the pins, the `SHA256SUMS` step and its upload. `scripts/check-supply-chain.mjs` fails if it does not.

9. Run `npm audit --omit=dev --audit-level=high`. Expected: exit 0. If it prints advisories and exits 1: stop and report with the full output. Do not run `npm audit fix`. If it prints a network error, say so in the pull request and go on.

10. Run `node scripts/check-supply-chain.mjs`. Expected: every line `ok`, exit 0.

Done when:
1. `node scripts/check-supply-chain.mjs` exits 0.
2. `grep -rnE "uses: [^ ]+@(v[0-9]|stable|master|main)" .github/workflows` prints nothing.
3. `grep -n "SHA256SUMS" .github/workflows/*.yml` prints at least two lines in the release workflow.
4. `npm audit --omit=dev --audit-level=high` exits 0 (or the network error is recorded).
5. The gate.

Pull request title: `wo-8.9: pin actions, audit dependencies, publish checksums`

---

## WO-8.10 The security model page (X5)

Needs: WO-0.2, WO-8.9.

Why: the allowlist is the app's main protection and nobody can read it as a whole (X5). One page says what the window may ask the backend to run, what is refused, and why. A check keeps the page true.

Read first:
1. `../08-feature-gaps.md` section 6 row X5 and the last paragraph of section 6 (CSP and the capability file stay as they are).
2. `../01-review-engineering.md` findings E2, E3, E4 (why the Lima commands were removed).
3. The module that holds `docker_args_allowed` (Starting state item 2), and `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`.

Starting state:
1. `ls docs/security-model.md` prints "No such file". If it exists, stop and report.
2. `grep -rn "fn docker_args_allowed" src-tauri/src` prints one line. Write the file in the pull request. Call it ALLOW_FILE.
3. `grep -rn "const DOCKER_SUBCOMMANDS" src-tauri/src` prints one line, in ALLOW_FILE.
4. `grep -rln "tauri::command" src-tauri/src` prints the files with commands. Write them down.
5. `grep -c "unsafe-inline" src-tauri/tauri.conf.json` prints `1` (the dev CSP only). The line `"csp":` has no `unsafe-inline`.

Do not touch: the Rust code, the CSP, the capability file. This work order only adds a page and a check.

Tests to write first: the check script (step 1). It fails until the page exists.

Steps:

1. Create `scripts/check-security-model.mjs` with exactly this content:

```js
// Keeps docs/security-model.md true. No browser.
// Fails when the page does not name: every docker command the allowlist accepts, every #[tauri::command],
// every permission in src-tauri/capabilities/*.json; or when the production CSP allows inline script or eval.
// `node scripts/check-security-model.mjs --list` prints what the page must name.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const SKIP_FILES = new Set(["lima.rs", "projects.rs"]);
const rsFiles = readdirSync("src-tauri/src").filter((f) => f.endsWith(".rs") && !SKIP_FILES.has(f));
const rs = Object.fromEntries(rsFiles.map((f) => [f, readFileSync(join("src-tauri/src", f), "utf8")]));

// Docker commands: the DOCKER_SUBCOMMANDS list and every `"name" =>` arm of docker_args_allowed.
const allowFile = rsFiles.find((f) => rs[f].includes("fn docker_args_allowed"));
const allowText = allowFile ? rs[allowFile] : "";
const docker = new Set();
const list = /const DOCKER_SUBCOMMANDS[^=]*=\s*&\[([\s\S]*?)\];/.exec(allowText);
for (const m of (list?.[1] ?? "").matchAll(/"([a-z-]+)"/g)) docker.add(`docker ${m[1]}`);
const fnStart = allowText.indexOf("fn docker_args_allowed");
const fnBody = allowText.slice(fnStart, allowText.indexOf("other =>", fnStart));
for (const m of fnBody.matchAll(/^\s*"([a-z-]+)"\s*=>(.*)$/gm)) {
  const subs = /matches!\(second,([^)]*)\)/.exec(m[2]);
  const eq = /second == "([a-z-]+)"/.exec(m[2]);
  if (subs) for (const s of subs[1].matchAll(/"([a-z-]+)"/g)) docker.add(`docker ${m[1]} ${s[1]}`);
  else if (eq) docker.add(`docker ${m[1]} ${eq[1]}`);
  else docker.add(`docker ${m[1]}`);
}

// Tauri commands, skipping any that sit under a cargo feature gate.
const commands = new Set();
for (const text of Object.values(rs)) {
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (!line.includes("#[tauri::command]")) return;
    const above = lines.slice(Math.max(0, i - 3), i).join("\n");
    if (above.includes('#[cfg(feature')) return;
    const m = /(?:pub(?:\([a-z]+\))?\s+)?(?:async\s+)?fn\s+(\w+)/.exec(lines.slice(i + 1, i + 4).join(" "));
    if (m) commands.add(m[1]);
  });
}

// Capability permissions.
const permissions = new Set();
for (const f of readdirSync("src-tauri/capabilities").filter((n) => n.endsWith(".json"))) {
  const j = JSON.parse(readFileSync(join("src-tauri/capabilities", f), "utf8"));
  for (const p of j.permissions ?? []) permissions.add(typeof p === "string" ? p : p.identifier);
}

if (process.argv.includes("--list")) {
  console.log("DOCKER\n" + [...docker].sort().join("\n"));
  console.log("\nCOMMANDS\n" + [...commands].sort().join("\n"));
  console.log("\nPERMISSIONS\n" + [...permissions].sort().join("\n"));
  process.exit(0);
}

let failed = 0;
const check = (cond, message) => {
  console.log(cond ? "ok" : "FAIL", message);
  if (!cond) failed++;
};

const page = existsSync("docs/security-model.md") ? readFileSync("docs/security-model.md", "utf8") : "";
check(page.length > 0, "docs/security-model.md exists");
for (const h of ["## What the window can ask for", "## Docker commands", "## Other commands", "## Refused on purpose", "## Window permissions", "## Content security policy", "## What stays out of the app"]) {
  check(page.includes(h), `page has the heading "${h}"`);
}
for (const d of docker) check(page.includes("`" + d + "`"), `page names \`${d}\``);
for (const c of commands) check(page.includes("`" + c + "`"), `page names the command \`${c}\``);
for (const p of permissions) check(page.includes("`" + p + "`"), `page names the permission \`${p}\``);

const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const csp = conf.app?.security?.csp ?? "";
check(csp.includes("script-src 'self'") && !/unsafe-(inline|eval)/.test(csp), "the production CSP has script-src 'self' and no unsafe-inline or unsafe-eval");
check(page.includes("script-src 'self'"), "page quotes the script-src rule");

process.exit(failed ? 1 : 0);
```

2. Run `node scripts/check-security-model.mjs --list`. Paste the output in the pull request. This is the list the page must cover.

3. Run `node scripts/check-security-model.mjs`. Expected: exit 1 (no page yet).

4. Create `docs/security-model.md`. Use these headings exactly, in this order. The text under each heading is below. Where a part says "from the list", write one entry per name that step 2 printed.

````markdown
# Security model

OpenPier is a window (a web page in a system webview) that asks a small Rust program to run commands. This page says what the window may ask for. The rule is simple: the window can do no more than the screens can.

## What the window can ask for

1. Only the commands listed on this page. Each one checks its own input in Rust before anything runs.
2. Programs are started with a list of arguments, never through a shell string. A name or image reference that starts with `-` is refused, so it cannot become a flag.
3. Every command has a time limit and an output size limit, so a stuck Docker socket cannot pile up processes.
4. The list is tested: `cargo test` has a test for each rule below, and `node scripts/check-security-model.mjs` fails when this page misses a command.

## Docker commands

The `docker` command accepts only these. Each has an exact set of flags. Anything else is refused with "is not available from the app".

(from the list: one line per `docker ...` entry, written as a bullet with the command in backticks, then in plain words what the screen uses it for. Group the lines under the bold words **Read**, **Change** and **Networks and volumes**.)

## Other commands

(from the list: a table with the columns Command, Runs, Input it checks. One row per name under COMMANDS in the list. The name is in backticks. "Runs" starts with the program it starts, for example "docker", "colima", "kubectl", "osascript", "aws", or "reads a file" or "nothing, only answers". "Input it checks" is one short sentence. For the rows below write exactly this text:)

| Command | Runs | Input it checks |
|---|---|---|
| `docker` | docker with `--context`, only the commands above | The engine name is one the app found, and the arguments pass the allowlist |
| `docker_check` | nothing | The same check as `docker`, so a fix never stops halfway on a refused step |
| `docker_pull` | `docker pull` | The engine name is known and the image name does not start with `-` |
| `kubectl` | kubectl, read only | Only `get` of nodes, namespaces, pods, deployments, services and events with `-o json`, and `logs` with a namespace and a tail limit |
| `open_terminal` | osascript, to open Terminal.app on one fixed command | The kind is one of a short list and the target is a plain name |

## Refused on purpose

These stay refused. Each line says why.

1. `docker login` and `docker logout`: a password would pass through the app. Sign-in happens in Terminal. The app only reads which registries have credentials, from the names in `~/.docker/config.json`, never the values, and never writes the file.
2. `docker exec`, `docker cp`, `docker build`, `docker commit`, `docker save` and `docker load`: they run code or move files. A shell in a container opens in Terminal instead.
3. `docker system prune`: too much at once. The app prunes by kind, after a confirm that lists what will go.
4. Any `docker run` that is not in the exact shape the Run sheet builds: no `--privileged`, no `--mount`, no `--env-file`, no host folders outside your home, no hidden folders, nothing under `~/Library`.
5. Reading any file the window names, handing out tokens, and building shell strings: the commands that did these were removed (findings E2, E3 and E4 in `docs/plan/01-review-engineering.md`).

## Window permissions

The window may use only the permissions in `src-tauri/capabilities/`. Any change that adds one needs a line in the pull request that says why.

(from the list: one bullet per name under PERMISSIONS, name in backticks, then what it lets the window do, in one short sentence.)

## Content security policy

The app ships with this policy in `src-tauri/tauri.conf.json`: `default-src 'self'; script-src 'self'; style-src 'self'; ...`. It allows no inline script, no `eval`, no remote scripts, no remote styles, and connections only to the app's own backend. A change that loosens it needs a line in the pull request that says why. The development policy is looser and is never used in a release.

## What stays out of the app

1. Registry passwords and tokens: the app never sees, stores or types one.
2. Telemetry: none, unless a person turns it on.
3. A plugin system and remote servers: not part of the product.
````

   Fill every "(from the list: ...)" marker with real lines and delete the marker text. The page must contain no word "TBD", no "(from the list" and no empty table.

5. Run `node scripts/check-security-model.mjs`. Expected: every line `ok`, exit 0.

6. Read the page once as a person who has not seen the code. Every sentence in "Refused on purpose" must be true: check each of the five against the code (items 1 to 4 against ALLOW_FILE; item 5 with `grep -rn "fs_read_text_file\|get_gh_token" src-tauri/src`, which prints nothing). If one is false, stop and report; do not edit the code.

Done when:
1. `node scripts/check-security-model.mjs` exits 0.
2. `grep -c "(from the list\|TBD" docs/security-model.md` prints `0`.
3. The gate.

Pull request title: `wo-8.10: write down what the window may ask the backend to run`

---

## WO-8.11 One versioned settings store (X6)

Needs: WO-0.4 (it renamed the keys to `openpier:*` and wrote the one-time copy from old names).

Why: settings are loose `localStorage` keys, renamed twice already (X6). One store with a `version` and a tested migration means a future rename cannot lose a setting.

Read first:
1. `../08-feature-gaps.md` section 6 row X6.
2. `../05-implementation-plan.md` task 0.4 item 3 (the key copy) and 3.9 note 5 (the theme script in `index.html`).
3. `src/main.tsx`, `index.html`.

Starting state:
1. `grep -rn "openpier:migrated" src --include=*.ts --include=*.tsx` prints the file of the 0.4 key copy. Write it down as KEYCOPY_FILE. Exactly one file that is not a test.
2. `grep -rn "localStorage" src --include=*.ts --include=*.tsx` prints every place the app stores something. Save the output; this is the list to convert. Each match has a key like `openpier:<name>` or `` `openpier:fold:${id}` ``. If a key does not start with `openpier:`, stop and report.
3. `ls src/lib/settings.ts` prints "No such file".
4. `grep -n "openpier:theme" index.html` prints the inline script line (from WO-3.9). Note it: it must keep working.
5. `ls scripts/check-settings.mjs` prints the file (WO-3.9 created it). This work order adds lines to it.
6. `grep -n "no-restricted-syntax" eslint.config.js` prints nothing, or prints rules you must not remove. Note which.

Do not touch: the key names (the part after `openpier:`). The inline script in `index.html`. Rust code.

Design in four lines (do not change):
1. One key, `openpier:settings`, holds `{ "version": 1, "values": { "<name>": "<string>" } }`.
2. Values are strings, like `localStorage` values, so every call site converts one to one.
3. The first run with no file collects every `openpier:*` key into `values` (the name is the key without `openpier:`). Old keys are left in place, so going back to an older build loses nothing.
4. `theme` is also written to its own key `openpier:theme`, because the inline script in `index.html` reads it before the app starts.

Tests to write first: `src/lib/settings.test.ts` (step 1), run it, see it fail because the module is missing.

Steps:

1. Create `src/lib/settings.test.ts` with exactly this content:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { SETTINGS_KEY, SETTINGS_VERSION, initSettings, getSetting, setSetting, removeSetting, subscribeSettings, migrateSettings, legacyValues } from "./settings.ts";

const memory = (start: Record<string, string> = {}) => {
  const m = new Map(Object.entries(start));
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
};

test("Given old openpier keys and no settings file, when initialised, then every value is collected under its short name", () => {
  const s = memory({ "openpier:theme": "dark", "openpier:sidebar-folded": "1", "openpier:migrated": "1", other: "x" });
  initSettings(s);
  assert.equal(getSetting("theme"), "dark");
  assert.equal(getSetting("sidebar-folded"), "1");
  assert.equal(getSetting("migrated"), null);
  assert.equal(getSetting("other"), null);
  const saved = JSON.parse(s.dump()[SETTINGS_KEY]);
  assert.equal(saved.version, SETTINGS_VERSION);
});

test("Given a collected file, when the app starts again, then the old keys are not read a second time", () => {
  const s = memory({ "openpier:theme": "dark" });
  initSettings(s);
  setSetting("theme", "light");
  s.setItem("openpier:theme", "dark");
  initSettings(s);
  assert.equal(getSetting("theme"), "light");
});

test("Given the old keys are still there, when settings are collected, then the old keys stay in place", () => {
  const s = memory({ "openpier:engine": "colima" });
  initSettings(s);
  assert.equal(s.dump()["openpier:engine"], "colima");
});

test("Given a value is set, when it is removed, then it reads as null and the file no longer holds it", () => {
  const s = memory();
  initSettings(s);
  setSetting("engine", "colima");
  removeSetting("engine");
  assert.equal(getSetting("engine"), null);
  assert.equal(JSON.parse(s.dump()[SETTINGS_KEY]).values.engine, undefined);
});

test("Given the theme is set, when saved, then the key the page script reads before start is updated too", () => {
  const s = memory();
  initSettings(s);
  setSetting("theme", "dark");
  assert.equal(s.dump()["openpier:theme"], "dark");
  removeSetting("theme");
  assert.equal(s.dump()["openpier:theme"], undefined);
});

test("Given a listener, when a value changes, then it is called once per change", () => {
  initSettings(memory());
  let n = 0;
  const off = subscribeSettings(() => void n++);
  setSetting("a", "1");
  setSetting("a", "2");
  off();
  setSetting("a", "3");
  assert.equal(n, 2);
});

test("Given a file that is not JSON, when initialised, then it starts again from the old keys", () => {
  const s = memory({ [SETTINGS_KEY]: "{not json", "openpier:engine": "colima" });
  initSettings(s);
  assert.equal(getSetting("engine"), "colima");
});

test("Given storage that throws, when a value is set, then the value still reads back in this run", () => {
  const broken = { length: 0, key: () => null, getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} };
  initSettings(broken);
  setSetting("a", "1");
  assert.equal(getSetting("a"), "1");
});

test("Given a file written by a newer app, when migrated, then it is kept as it is", () => {
  const raw = { version: SETTINGS_VERSION + 1, values: { a: "1" } };
  assert.deepEqual(migrateSettings(raw, {}), raw);
});

test("Given a version 1 file and a step to version 2, when migrated, then the step runs once and the version is 2", () => {
  const step = (f: { version: number; values: Record<string, string> }) => ({ version: 2, values: { ...f.values, added: "yes" } });
  const out = migrateSettings({ version: 1, values: { a: "1" } }, {}, [step], 2);
  assert.deepEqual(out, { version: 2, values: { a: "1", added: "yes" } });
});

test("Given a value that is not a string, when migrated, then the file is rebuilt from the old keys", () => {
  const out = migrateSettings({ version: 1, values: { a: 5 } }, { b: "2" });
  assert.deepEqual(out, { version: SETTINGS_VERSION, values: { b: "2" } });
});

test("Given legacy keys and noise, when collected, then only openpier keys other than the file and the marker are returned", () => {
  const s = memory({ "openpier:a": "1", "openpier:settings": "{}", "openpier:migrated": "1", "colima-ui:a": "2" });
  assert.deepEqual(legacyValues(s), { a: "1" });
});
```

2. Run `node --experimental-strip-types --no-warnings --test src/lib/settings.test.ts`. Expected: fails with "Cannot find module" (the right reason).

3. Create `src/lib/settings.ts` with exactly this content:

```ts
// One settings store for the whole app: one localStorage key holding { version, values }.
// Values are strings, like localStorage values. See docs/plan/iterations/iteration-6-part-2-work-orders.md, WO-8.11.

export const SETTINGS_KEY = "openpier:settings";
export const SETTINGS_VERSION = 1;
const PREFIX = "openpier:";
// The marker of the old-name copy (WO-0.4) and this file itself are not settings.
const NOT_SETTINGS = new Set([SETTINGS_KEY, `${PREFIX}migrated`]);
// The inline script in index.html reads the theme before the app starts, so it is also kept under its own key.
const MIRRORED = new Set(["theme"]);

export type SettingsFile = { version: number; values: Record<string, string> };
type Step = (file: SettingsFile) => SettingsFile;
type Store = { readonly length: number; key(i: number): string | null; getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

// STEPS[0] turns a version 1 file into version 2, STEPS[1] version 2 into 3, and so on. Empty while the version is 1.
const STEPS: Step[] = [];

const isFile = (raw: unknown): raw is SettingsFile => {
  if (typeof raw !== "object" || raw === null) return false;
  const f = raw as { version?: unknown; values?: unknown };
  if (!Number.isInteger(f.version) || (f.version as number) < 1) return false;
  if (typeof f.values !== "object" || f.values === null) return false;
  return Object.values(f.values).every((v) => typeof v === "string");
};

export function legacyValues(store: Store): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key || !key.startsWith(PREFIX) || NOT_SETTINGS.has(key)) continue;
    const value = store.getItem(key);
    if (value !== null) out[key.slice(PREFIX.length)] = value;
  }
  return out;
}

export function migrateSettings(raw: unknown, legacy: Record<string, string>, steps: Step[] = STEPS, target: number = SETTINGS_VERSION): SettingsFile {
  if (!isFile(raw)) return { version: target, values: { ...legacy } };
  if (raw.version >= target) return raw;
  let file: SettingsFile = raw;
  while (file.version < target) {
    const step = steps[file.version - 1];
    if (!step) return { version: target, values: { ...legacy } };
    file = step(file);
  }
  return file;
}

let store: Store | null = null;
let file: SettingsFile = { version: SETTINGS_VERSION, values: {} };
const listeners = new Set<() => void>();

const save = () => {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(file));
  } catch {
    // Storage is blocked or full: the values still work for this run.
  }
};

const mirror = (name: string, value: string | null) => {
  if (!MIRRORED.has(name)) return;
  try {
    if (value === null) store?.removeItem(`${PREFIX}${name}`);
    else store?.setItem(`${PREFIX}${name}`, value);
  } catch {
    // Same as save.
  }
};

export function initSettings(s: Store = localStorage): void {
  store = s;
  let raw: unknown = null;
  let legacy: Record<string, string> = {};
  try {
    const text = s.getItem(SETTINGS_KEY);
    raw = text === null ? null : JSON.parse(text);
  } catch {
    raw = null;
  }
  try {
    legacy = legacyValues(s);
  } catch {
    legacy = {};
  }
  file = migrateSettings(raw, legacy);
  save();
}

export const getSetting = (name: string): string | null => file.values[name] ?? null;

const change = (values: Record<string, string>) => {
  file = { ...file, values };
  save();
  listeners.forEach((l) => l());
};

export function setSetting(name: string, value: string): void {
  change({ ...file.values, [name]: value });
  mirror(name, value);
}

export function removeSetting(name: string): void {
  const { [name]: _gone, ...rest } = file.values;
  change(rest);
  mirror(name, null);
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
```

4. Run the test again. Expected: 12 tests pass, 0 fail.

5. Create `src/lib/useSetting.ts`:

```ts
import { useCallback, useSyncExternalStore } from "react";
import { getSetting, removeSetting, setSetting, subscribeSettings } from "./settings";

// [value, set]. A null value means "never set". Pass null to set to remove it.
export function useSetting(name: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(subscribeSettings, () => getSetting(name));
  const set = useCallback((v: string | null) => (v === null ? removeSetting(name) : setSetting(name, v)), [name]);
  return [value, set];
}
```
   Check whether the other `src/lib/*.ts` files import with or without an extension for TS modules that React components use; match the repo (`./settings` without extension is right for files that Vite and tsc read, and `.ts` for files that `node --test` imports).

6. Start the store. In `src/main.tsx`, find where KEYCOPY_FILE's function is called (the call from step 1 of Starting state), and add `initSettings();` on the next line, with `import { initSettings } from "./lib/settings";`. It must run before `ReactDOM.createRoot(...)`.

7. Convert every `localStorage` use found in Starting state item 2, except in KEYCOPY_FILE, `src/lib/settings.ts` and test files:
   1. `localStorage.getItem("openpier:<name>")` becomes `getSetting("<name>")`.
   2. `localStorage.setItem("openpier:<name>", v)` becomes `setSetting("<name>", v)`.
   3. `localStorage.removeItem("openpier:<name>")` becomes `removeSetting("<name>")`.
   4. A key built from a prefix and an id, such as `` `openpier:fold:${id}` ``, becomes `` `fold:${id}` `` in the same call.
   5. Inside a React component that reads a value to render it, use `const [value, setValue] = useSetting("<name>")` instead of reading on every render.
   6. Keep `try`/`catch` blocks that only existed to survive a blocked `localStorage`; they are harmless. Delete a `catch` only if the `try` now holds nothing that can throw.
   Do not change any other logic, key names or defaults. Write one line per file you changed in the pull request.

7b. Update the earlier assertions this change breaks. Once a value lives in `openpier:settings`, a test or check that reads or seeds the old key directly is wrong. Make each of these edits, in this order, and write one line per edit in the pull request. If a listed assertion cannot be found by its quoted text, stop and report.
   1. Sidebar fold (WO-2.2). The shell sets `.app.folded` from the setting `sidebar-folded`: `"1"` means folded; any other value or no value means open. Folding calls `setSetting("sidebar-folded", "1")`; unfolding calls `removeSetting("sidebar-folded")`. Old assertion in the Shell unit test: `localStorage "openpier:sidebar-folded" is "1"` after the Fold sidebar button is pressed. New assertion: `getSetting("sidebar-folded")` is `"1"`, and after pressing again it is `null`. Old assertion in `scripts/check-layout.mjs` (item "Cmd+B toggles `.app.folded`; a reload keeps it"): it reads `localStorage["openpier:sidebar-folded"]`. New assertion: it reads `JSON.parse(localStorage.getItem("openpier:settings")).values["sidebar-folded"]` and expects `"1"` after Cmd+B and `undefined` after the second Cmd+B; the reload line is unchanged.
   2. Theme (WO-3.9). The inline script in `index.html` is not changed: it still reads `openpier:theme`, which `setSetting("theme", ...)` keeps equal to the setting (the mirror in `settings.ts`). `THEME_KEY` stays `"openpier:theme"` and is used only by that mirror and by the inline script. Choosing a theme calls `setSetting("theme", value)`; choosing System calls `removeSetting("theme")`. Old assertion in `scripts/check-settings.mjs` (item "theme choice dark sets data-theme to dark at once and survives a reload"): `localStorage["openpier:theme"] === "dark"`. It stays true, and one assertion is added to the same item: `JSON.parse(localStorage.getItem("openpier:settings")).values.theme === "dark"`. Old assertion in the Settings unit test of the inline script: the script text contains `openpier:theme`. It stays as it is.
   3. Tray key (part 1, WO-8.1). `readKeepInMenuBar` becomes `getSetting("keep-in-menu-bar") !== "0"` and `writeKeepInMenuBar(on)` calls `setSetting("keep-in-menu-bar", on ? "1" : "0")`. Any test or check that seeds `localStorage["openpier:keep-in-menu-bar"]` now seeds the file: `page.addInitScript(() => localStorage.setItem("openpier:settings", JSON.stringify({ version: 1, values: { "keep-in-menu-bar": "0" } })))`. A seed of the old key after the first load is ignored on purpose, because the old keys are read only when no settings file exists.
   4. Notifications (part 1, WO-8.2). The stored value of the setting `notify` is the same JSON text as before. Old assertion in `scripts/check-notify.mjs`: after `localStorage.setItem("openpier:notify", JSON.stringify({ enabled: false }))` and a reload, `__tray.at(-1).notify.enabled === false`. New assertion: the same expectation, with the seed written by `page.addInitScript(() => localStorage.setItem("openpier:settings", JSON.stringify({ version: 1, values: { notify: JSON.stringify({ enabled: false }) } })))` before the page loads (no `setItem` of the old key, no reload needed). The first line of that check (default config `enabled === true`) is unchanged.
   5. Later work orders use the same store and never read `localStorage`: the auto-update check setting (WO-6.2a, `autoUpdateCheck`) is read with `getSetting` and written with `setSetting`.

8. Lock it down. In `eslint.config.js`, in the config object that applies to `src/**/*.{ts,tsx}`, add this rule (keep the rules already there; if `no-restricted-syntax` already exists, add this selector to its list):

```js
"no-restricted-syntax": ["error", { selector: "MemberExpression[object.name='localStorage']", message: "Use getSetting and setSetting from src/lib/settings.ts." }],
```
   Then add a new config object after it that turns the rule off for `src/lib/settings.ts`, KEYCOPY_FILE, `src/**/*.test.ts`, `src/**/*.test.tsx` and `src/test/**`:

```js
{ files: ["src/lib/settings.ts", "<KEYCOPY_FILE>", "src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**"], rules: { "no-restricted-syntax": "off" } },
```
   (write the real path of KEYCOPY_FILE.)

9. Run `npm run lint`. Expected: exit 0. A hit means a call site you missed: convert it.

10. Add a component test `src/lib/useSetting.test.tsx` (vitest):
    1. Name: `given a setting that is not set, when a component reads it and then sets it, then it re-renders with the new value`.
    2. Setup: `initSettings(memoryStore)` with an empty in-memory store (copy the helper from the settings test, without `dump`), render a component that shows `value ?? "none"` and has a button `Set` that calls `set("dark")`.
    3. Assert: shows `none`; after clicking `Set` shows `dark`.

11. Run the preview check below.

Browser check: add these lines to the existing `scripts/check-settings.mjs` (do not create it):
1. `check("old keys collect into one file")`: `const page = await open("/?scenario=design#/containers")` after `page.addInitScript(() => { if (!localStorage.getItem("seeded")) { localStorage.setItem("seeded", "1"); localStorage.removeItem("openpier:settings"); localStorage.setItem("openpier:sidebar-folded", "1"); } })`. After load, `JSON.parse(await page.evaluate(() => localStorage.getItem("openpier:settings")))` has `version === 1` and `values["sidebar-folded"] === "1"`.
2. `check("the sidebar comes back folded")`: the root `div.app` has the class `folded` after load.
3. `check("no code outside the store reads localStorage")` is covered by lint; do not duplicate it.

Done when:
1. `node --experimental-strip-types --no-warnings --test src/lib/settings.test.ts` prints `# pass 12` and `# fail 0`.
2. `grep -rn "localStorage" src --include=*.ts --include=*.tsx | grep -v "\.test\." | grep -v "src/lib/settings.ts"` prints only KEYCOPY_FILE lines.
3. `npm run lint` exits 0.
4. `node scripts/check-settings.mjs`-equivalent line appears as `ok` in `npm run check` output for both engines.
5. The gate.

Pull request title: `wo-8.11: keep every setting in one versioned store`

---

## WO-8.12 Start at login, and come back where you were (G15)

Needs: 8.1 (menu bar), WO-8.11.

Why: every desktop container tool starts at login in the menu bar and remembers its window (G15). Today closing the window is the end of the app and the window opens at the default size.

Read first:
1. `../08-feature-gaps.md` G15 and G1.
2. Official docs, read in full before the steps:
   1. https://v2.tauri.app/plugin/autostart/
   2. https://v2.tauri.app/plugin/window-state/
   3. https://docs.rs/tauri-plugin-window-state/latest/tauri_plugin_window_state/struct.Builder.html (the method `with_state_flags`)
   4. https://docs.rs/tauri-plugin-window-state/latest/tauri_plugin_window_state/struct.StateFlags.html (constants `SIZE`, `POSITION`, `MAXIMIZED`, `VISIBLE`)
3. The Settings, General file (Starting state item 4).

Starting state:
1. `grep -rn "TrayIconBuilder" src-tauri/src` prints at least one line (the menu bar from 8.1). If it prints nothing, stop: 8.1 is not merged.
2. `grep -n "tauri-plugin" src-tauri/Cargo.toml` prints plugin lines from earlier work (updater, maybe notification). Write them in the pull request. `grep -n "autostart\|window-state" src-tauri/Cargo.toml` prints nothing.
3. `rustc --version` prints 1.90 or newer (the plugins need it, per the docs above).
4. `grep -rln "Check for updates automatically" src --include=*.tsx` prints the General section file. Write it down as GENERAL_FILE. Exactly one file.
5. `grep -rn "start_profile" src/lib/machines` prints the machine driver function that starts a Colima machine. Write down its exported name as START_FN and its argument list.
6. `grep -rn "\"setup\"\|\.setup(" src-tauri/src/main.rs` prints where the builder is. Write it down.
7. `cat src-tauri/capabilities/default.json`: write down the `permissions` array.
8. `grep -rn "Start when I log in" src --include=*.tsx` prints nothing. The per-machine "Start when I log in" row was removed from the design: the two General rows of this work order are the only "start at login" controls. If it prints a line, stop and report.
9. `grep -n "log in" scripts/mockup-pairs.json` prints nothing. If the `settings-machines` row still masks that row, remove that mask in step 10 below.

Do not touch: the menu bar code from 8.1, the content security policy.

Tests to write first: the Rust test (step 3) and the browser check (step 9).

Steps:

1. Add the dependencies, with the exact commands from the docs, run in `src-tauri/`:
   1. `cargo add tauri-plugin-autostart --target 'cfg(any(target_os = "macos", windows, target_os = "linux"))'`
   2. `cargo add tauri-plugin-window-state --target 'cfg(any(target_os = "macos", windows, target_os = "linux"))'`
   Then in the repo root: `npm install @tauri-apps/plugin-autostart`. Window state needs no npm package: the plugin saves the window when it closes and restores it when it opens, with no call from the page.

2. Capability. Add these three strings to the `permissions` array of `src-tauri/capabilities/default.json`, keeping the existing ones: `"autostart:allow-enable"`, `"autostart:allow-disable"`, `"autostart:allow-is-enabled"`. Window state needs no permission (the page never calls it). The capability file gets wider by exactly these three: say so, with the reason, in the pull request.

3. Test first. Create `src-tauri/src/launch.rs` with only the test module and the function signature stubbed so that the test fails:

```rust
// Start at login: the autostart plugin starts the app with this argument, and the app then opens
// in the menu bar with no window.
pub const BACKGROUND_ARG: &str = "--background";

pub fn is_background_launch(args: &[String]) -> bool {
    args.iter().skip(1).any(|a| a == BACKGROUND_ARG)
}

#[tauri::command]
pub fn launched_at_login() -> bool {
    is_background_launch(&std::env::args().collect::<Vec<_>>())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn given_the_background_argument_when_checked_then_it_is_a_login_launch() {
        assert!(is_background_launch(&args(&["/Applications/OpenPier.app/Contents/MacOS/openpier", "--background"])));
    }

    #[test]
    fn given_no_argument_when_checked_then_it_is_a_normal_launch() {
        assert!(!is_background_launch(&args(&["/Applications/OpenPier.app/Contents/MacOS/openpier"])));
    }

    #[test]
    fn given_the_flag_as_the_program_name_when_checked_then_it_is_ignored() {
        assert!(!is_background_launch(&args(&["--background"])));
    }

    #[test]
    fn given_a_similar_argument_when_checked_then_it_is_a_normal_launch() {
        assert!(!is_background_launch(&args(&["openpier", "--background=1", "--bg"])));
    }
}
```
   Register the module: add `mod launch;` next to the other `mod` lines in `main.rs`, and `launch::launched_at_login` to the `generate_handler!` list. Run `cd src-tauri && cargo test launch`. Expected: 4 passed. (The function is tiny, so the test passes at once; the point is that the argument name is fixed by a test. Say so in the pull request.)

4. Register the plugins in the builder (the place from Starting state item 6). Use the forms from the docs. Add, before `.invoke_handler(...)`:

```rust
.plugin(
    tauri_plugin_window_state::Builder::default()
        // Not VISIBLE: a window closed to the menu bar must not come back hidden at the next start.
        .with_state_flags(tauri_plugin_window_state::StateFlags::SIZE | tauri_plugin_window_state::StateFlags::POSITION | tauri_plugin_window_state::StateFlags::MAXIMIZED)
        .build(),
)
```
   and, inside the `.setup(|app| { ... })` closure (create the closure if there is none; if 8.1 made one, add inside it, before `Ok(())`):

```rust
#[cfg(desktop)]
app.handle().plugin(tauri_plugin_autostart::init(
    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
    Some(vec![crate::launch::BACKGROUND_ARG]),
))?;
if crate::launch::is_background_launch(&std::env::args().collect::<Vec<_>>()) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}
```
   (`use tauri::Manager;` is needed for `get_webview_window`.) If `cargo check` says the argument list type is `Option<Vec<&'static str>>`, that is what the code above passes.

   Not verified: that the window stays hidden on macOS after the window-state plugin restores the window. Nobody can check this in the preview. The acceptance checklist has a by-hand step for the owner. If `window.hide()` has no effect, do not try other ways; report it.

5. Create `src/lib/login.ts`:

```ts
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { invoke } from "@tauri-apps/api/core";
import { getSetting, setSetting } from "./settings";

// Whether macOS will open OpenPier at login (a LaunchAgent the plugin writes).
export const loginEnabled = (): Promise<boolean> => isEnabled();
export const setLoginEnabled = (on: boolean): Promise<void> => (on ? enable() : disable());

// Also start the selected machine when OpenPier opens at login. Off until the person turns it on.
export const START_MACHINE_SETTING = "start-machine-at-login";
export const startMachineWanted = (): boolean => getSetting(START_MACHINE_SETTING) === "1";
export const setStartMachineWanted = (on: boolean): void => setSetting(START_MACHINE_SETTING, on ? "1" : "0");

// True when the app was started by the login item (see src-tauri/src/launch.rs).
export const launchedAtLogin = (): Promise<boolean> => invoke<boolean>("launched_at_login");

// Pure: should the app start the machine now? Only on a login launch, only once, only for a stopped machine OpenPier can start.
export function shouldStartMachine(opts: { atLogin: boolean; wanted: boolean; alreadyTried: boolean; engineKind: string; machineStopped: boolean }): boolean {
  return opts.atLogin && opts.wanted && !opts.alreadyTried && opts.engineKind === "colima" && opts.machineStopped;
}
```
   Add `src/lib/login.test.ts` (node test) with these tests: `given a login launch and the setting on and a stopped colima machine when asked then it starts`; `given a normal launch when asked then it does not start`; `given the setting off when asked then it does not start`; `given an engine that is not colima when asked then it does not start`; `given it already tried once when asked then it does not start again`. Import only `shouldStartMachine` (the other exports import `@tauri-apps/*`, which `node --test` cannot load: put `shouldStartMachine` in its own file `src/lib/loginRule.ts` and import that in the test and in `login.ts`, re-exporting it).

6. Start the machine at login. In the shell component that mounts once for the whole app (`src/Shell.tsx`; find it with `grep -rn "useEngines()" src/Shell.tsx src/App.tsx`), add one effect that runs when the selected engine and its machine state are first known:

```ts
const tried = useRef(false);
useEffect(() => {
  if (!engine || tried.current) return;
  void (async () => {
    const atLogin = await launchedAtLogin();
    const go = shouldStartMachine({ atLogin, wanted: startMachineWanted(), alreadyTried: tried.current, engineKind: engine.kind, machineStopped: engine.state === "stopped" });
    tried.current = true;
    if (go) await START_FN(/* the arguments you wrote down in Starting state item 5, for the selected engine */);
  })();
}, [engine]);
```
   `engine.state` is the field `list_engines` returns for "stopped" (read `src/lib/engines.ts` and use its real field and value; say which in the pull request). Start only if the effect finds the engine stopped on its first run.

7. Settings, General (GENERAL_FILE). Add two rows after the Theme row, built the same way as the "Check for updates automatically" row in that file (same component, same classes; copy its markup):
   1. Title `Start OpenPier at login`. Description `It opens in the menu bar, without a window.` A `Switch` (its `aria-labelledby` is the id of the title element); its on state comes from `loginEnabled()` (a query with key `["login-item"]`) and a change calls `setLoginEnabled(on)` then refreshes the query. While the call runs the switch is busy. If the call fails, show a `Banner` with `tone="bad"` and `title="Could not change the login item."`, the error text as children, and a `Try again` button in `actions`.
   2. Title `Start the selected machine with it`. Description `Starts {name} when OpenPier opens at login.` where `{name}` is the selected engine's name. A `Switch` (same `aria-labelledby` rule) bound to `useSetting(START_MACHINE_SETTING)`. Shown only when the selected engine is Colima; disabled (and its description unchanged) while the first switch is off.
   The `Switch` gets `aria-labelledby` set to the id of the row's title element (the `.t` element), so its accessible name is the title.

8. Preview. In `preview/mock.ts`, find `case "open_terminal":` in the `invoke` switch and add after it:

```ts
    case "plugin:autostart|is_enabled": return loginItem as T;
    case "plugin:autostart|enable": loginItem = true; return undefined as T;
    case "plugin:autostart|disable": loginItem = false; return undefined as T;
    case "launched_at_login": return flag("login") as T;
```
   and next to the other module-level `let` declarations add `let loginItem = false;`. In `vite.preview.config.ts` add the top-level key `optimizeDeps: { exclude: ["@tauri-apps/plugin-autostart"] }` so the plugin package calls the mock through the existing alias. Run `npm run preview` once and open `http://localhost:4173/?scenario=design#/settings/general`: the page must load with no console error mentioning `__TAURI_INTERNALS__`. If it does mention it, stop and report with the console text.

9. Browser check `scripts/check-login.mjs` (write it before steps 5 to 8; see it fail):
   1. `const page = await open("/?scenario=design#/settings/general")`.
   2. `check(await page.getByRole("switch", { name: "Start OpenPier at login" }).count() === 1, "general: the start at login switch exists")`.
   3. `check(await page.getByRole("switch", { name: "Start the selected machine with it" }).isDisabled(), "general: the machine switch is off and disabled while login is off")`.
   4. Click the first switch. `await page.waitForFunction(() => window.__calls?.includes("plugin:autostart|enable"))`. `check(true, "general: turning it on asks the login item plugin to enable")`. Then `check(await page.getByRole("switch", { name: "Start OpenPier at login" }).getAttribute("aria-checked") === "true", "general: the switch shows on")`.
   5. `check(await page.getByRole("switch", { name: "Start the selected machine with it" }).isEnabled(), "general: the machine switch is usable once login is on")`.
   6. Click it. `check((await page.evaluate(() => JSON.parse(localStorage.getItem("openpier:settings")).values["start-machine-at-login"])) === "1", "general: the choice is saved in the settings store")`.
   7. A second page: `addInitScript` sets `openpier:settings` to `{"version":1,"values":{"start-machine-at-login":"1"}}`, then `open("/?scenario=stopped&login=1#/containers")`. `await page.waitForFunction(() => window.__calls?.includes("start_profile"), null, { timeout: 8000 })`; `check(true, "login launch: a stopped machine is started when the setting is on")`.
   8. A third page, same init script, `open("/?scenario=stopped#/containers")` (no `login=1`). Wait 3 seconds. `check(!(await page.evaluate(() => window.__calls.includes("start_profile"))), "normal launch: the machine is not started")`.
   9. `await done()`.

10. Mockup pair. In `scripts/mockup-pairs.json`, if the row for `settings-machines` has a `mask` entry for the "Start when I log in" row (Starting state item 9), remove that entry and nothing else. Run `npm run check`.

Done when:
1. `cd src-tauri && cargo test launch` prints `4 passed`.
2. `grep -n "tauri-plugin-autostart\|tauri-plugin-window-state" src-tauri/Cargo.toml` prints two lines.
3. `grep -c "autostart:allow" src-tauri/capabilities/default.json` prints `3`.
4. `grep -rn "StateFlags::SIZE" src-tauri/src` prints one line.
5. `check-login.mjs` prints only `ok` in Chromium and WebKit (it is inside `npm run check`).
6. `node --experimental-strip-types --no-warnings --test src/lib/login.test.ts` prints `# fail 0`.
7. The gate.
8. By eye: Settings, General next to `settings-machines-light.png` for the row style.
9. By hand, the owner only (acceptance checklist): log out and in; the app opens in the menu bar with no window; resize and move the window, quit, reopen: same size and place.

Pull request title: `wo-8.12: start at login in the menu bar, and remember the window`

---

## WO-8.14a Image history on the allowlist, and the newer-image command (G17, backend)

Needs: WO-3.4 (Images), WO-8.10 (the page this work order must update).

Why: the image page needs the build steps of an image (`docker history`, read only) and a way to ask the registry whether the tag now points to something newer. Today `history` is refused (section 4b of `../08-feature-gaps.md`).

Read first:
1. `../08-feature-gaps.md` G17 and section 4b.
2. The allowlist module (Starting state item 1) in full: `docker_args_allowed`, `allowed_flags`, `flags_ok`, `run_args_ok`, and the tests for them.
3. Official docs for the two Docker commands:
   1. https://docs.docker.com/reference/cli/docker/image/history/
   2. https://docs.docker.com/reference/cli/docker/buildx/imagetools/inspect/

Starting state:
1. `grep -rn "fn docker_args_allowed" src-tauri/src` prints one line. Write the file as ALLOW_FILE.
2. `grep -rn "fn exec\b\|fn exec(" src-tauri/src` and `grep -rn "fn find_bin" src-tauri/src` print one line each. Write the modules.
3. `grep -n "\"history\"" ALLOW_FILE` prints nothing.
4. `docker history --help` (read only) prints a usage with `--format` and `--no-trunc`. If `--format` is missing, stop and report.
5. `docker buildx imagetools inspect --help` prints a usage with `--format`. If it prints "unknown command", the docker CLI has no buildx plugin on this Mac: say so in the pull request and go on (the code handles it, step 6).

Do not touch: `run_args_ok` and every existing allowlist arm. The new arm is added; none is changed.

Tests to write first: steps 1 and 3.

Steps:

1. In the test module of ALLOW_FILE add these tests (they fail until step 2):

```rust
    fn s(list: &[&str]) -> Vec<String> {
        list.iter().map(|x| x.to_string()).collect()
    }

    #[test]
    fn given_history_in_the_exact_shape_when_checked_then_it_is_allowed() {
        assert!(docker_args_allowed(&s(&["history", "--no-trunc", "--format", "{{json .}}", "efec2006ec41"])).is_ok());
        assert!(docker_args_allowed(&s(&["history", "--no-trunc", "--format", "{{json .}}", "postgres:16"])).is_ok());
        assert!(docker_args_allowed(&s(&["history", "--no-trunc", "--format", "{{json .}}", "ghcr.io/acme/api:1.4"])).is_ok());
    }

    #[test]
    fn given_history_with_a_flag_image_or_extra_argument_when_checked_then_it_is_refused() {
        assert!(docker_args_allowed(&s(&["history", "--no-trunc", "--format", "{{json .}}", "--quiet"])).is_err());
        assert!(docker_args_allowed(&s(&["history", "--no-trunc", "--format", "{{json .}}", "-q"])).is_err());
        assert!(docker_args_allowed(&s(&["history", "--no-trunc", "--format", "{{json .}}", "a", "b"])).is_err());
        assert!(docker_args_allowed(&s(&["history", "--format", "{{json .}}", "a"])).is_err());
        assert!(docker_args_allowed(&s(&["history"])).is_err());
        assert!(docker_args_allowed(&s(&["history", "--no-trunc", "--format", "{{.ID}}", "a"])).is_err());
        assert!(docker_args_allowed(&s(&["history", "--no-trunc", "--format", "{{json .}}", "a b"])).is_err());
        assert!(docker_args_allowed(&s(&["history", "--no-trunc", "--format", "{{json .}}", "a;rm"])).is_err());
    }

    #[test]
    fn given_image_references_when_checked_then_only_plain_ones_pass() {
        for ok in ["postgres", "postgres:16", "efec2006ec41", "ghcr.io/acme/api:1.4", "localhost:5000/a/b", "a@sha256:0123456789abcdef"] {
            assert!(image_ref_ok(ok), "{ok}");
        }
        for bad in ["", "-x", "a b", "a;b", "a$b", "a`b`", "a\nb", "a|b"] {
            assert!(!image_ref_ok(bad), "{bad}");
        }
    }
```
   (Place `fn s` once; if a helper with the same job already exists in that module, use it and delete mine.)

2. Run `cd src-tauri && cargo test history`. Expected: compile error (`image_ref_ok` missing). Good.

3. In ALLOW_FILE:
   1. Add, near `run_name_ok`, the function:

```rust
// A plain image reference or id: not a flag, and only the characters a reference uses.
pub(crate) fn image_ref_ok(s: &str) -> bool {
    !s.is_empty() && !s.starts_with('-') && s.chars().all(|c| c.is_ascii_alphanumeric() || "._/:@-".contains(c))
}

// `docker history` in the one shape the image page builds. The format is fixed so the output is JSON lines.
fn history_args_ok(args: &[String]) -> bool {
    matches!(args, [h, nt, f, fmt, image] if h == "history" && nt == "--no-trunc" && f == "--format" && fmt == "{{json .}}" && image_ref_ok(image))
}
```
   2. In `docker_args_allowed`, in the `match first { ... }`, add the arm (before `"events" =>`): `"history" => history_args_ok(args),`
   3. In `allowed_flags`, add the arm: `"history" => (&["--no-trunc"], FMT),`
   4. In the condition that skips `flags_ok` for `run`, `events` and `update`, leave it alone: `history` goes through `flags_ok` too, and its flags are exactly those two.

4. Run `cd src-tauri && cargo test history` and `cargo test image_references`. Expected: 3 tests pass, 0 fail.

5. Tests for the newer-image command. In a new file `src-tauri/src/image.rs`, write the tests first (at the bottom), with the functions stubbed by `todo!()` so they fail:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn given_a_reference_when_building_the_command_then_it_asks_the_registry_for_the_manifest_digest() {
        assert_eq!(
            remote_digest_args("postgres:16").unwrap(),
            vec!["buildx", "imagetools", "inspect", "--format", "{{json .Manifest}}", "postgres:16"]
        );
    }

    #[test]
    fn given_a_bad_reference_when_building_the_command_then_it_is_refused() {
        for bad in ["", "-x", "a b", "a;rm", "--help"] {
            assert!(remote_digest_args(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn given_buildx_output_when_parsed_then_the_digest_is_returned() {
        let out = r#"{"mediaType":"application/vnd.oci.image.index.v1+json","digest":"sha256:abc123","size":1234}"#;
        assert_eq!(parse_manifest_digest(out).unwrap(), "sha256:abc123");
    }

    #[test]
    fn given_output_without_a_digest_when_parsed_then_it_is_an_error() {
        assert!(parse_manifest_digest("{}").is_err());
        assert!(parse_manifest_digest("not json").is_err());
        assert!(parse_manifest_digest(r#"{"digest":"abc"}"#).is_err());
    }

    #[test]
    fn given_a_missing_buildx_message_when_explained_then_it_says_what_to_install() {
        let m = explain_failure("docker: 'buildx' is not a docker command.");
        assert!(m.contains("buildx"));
        assert!(!m.contains("is not a docker command"));
    }
}
```

6. Write `src-tauri/src/image.rs` above the tests:

```rust
// Asks a registry which digest a tag points to now. Read only: it sends no credentials of its own
// (docker uses the sign-in it already has) and changes nothing on this Mac.
use crate::allow::image_ref_ok; // use the real module path of ALLOW_FILE

pub fn remote_digest_args(image: &str) -> Result<Vec<String>, String> {
    if !image_ref_ok(image) {
        return Err(format!("Invalid image name: \"{image}\""));
    }
    Ok(["buildx", "imagetools", "inspect", "--format", "{{json .Manifest}}", image].iter().map(|s| s.to_string()).collect())
}

pub fn parse_manifest_digest(out: &str) -> Result<String, String> {
    let v: serde_json::Value = serde_json::from_str(out.trim()).map_err(|_| "The registry's answer could not be read".to_string())?;
    match v.get("digest").and_then(|d| d.as_str()) {
        Some(d) if d.starts_with("sha256:") && d.len() > 7 => Ok(d.to_string()),
        _ => Err("The registry's answer had no digest".to_string()),
    }
}

pub fn explain_failure(raw: &str) -> String {
    if raw.contains("buildx") && raw.contains("not a docker command") {
        return "Checking needs docker buildx, which is not installed. Install it with: brew install docker-buildx".to_string();
    }
    raw.trim().to_string()
}

#[tauri::command]
pub async fn image_remote_digest(image: String) -> Result<String, String> {
    let args = remote_digest_args(&image)?;
    let out = crate::exec::exec("docker", args, true).await.map_err(|e| explain_failure(&e))?; // use the real path of `exec`
    parse_manifest_digest(&out)
}
```
   Replace `crate::allow` and `crate::exec` by the modules you wrote down. Add `mod image;` and `image::image_remote_digest` to `main.rs` (module list and `generate_handler!`). If `docker buildx imagetools inspect --format` rejects `{{json .Manifest}}` (Starting state item 5, when buildx exists: run `docker buildx imagetools inspect --format '{{json .Manifest}}' hello-world:latest`, which only reads), stop and report with the output.

   Not verified: the exact field names of `.Manifest` in the buildx template output. The docs page above lists the template fields; the test uses `digest`. If the docs say otherwise, stop and report.

7. Run `cd src-tauri && cargo test image` . Expected: 5 passed in `image::tests` plus the history tests, 0 failed. Then `cargo fmt --check && cargo clippy --all-targets -- -D warnings`.

8. Update `docs/security-model.md` (WO-8.10): add the bullet `` `docker history` `` under **Read** (text: "the build steps of an image, for the image page"), and in "Other commands" a row: `` `image_remote_digest` `` | docker `buildx imagetools inspect`, read only | The image name is a plain reference. Run `node scripts/check-security-model.mjs`. Expected: exit 0.

9. Mock: in `preview/mock.ts`, in `dockerCmd`, add before `case "images":`:

```ts
    case "history": {
      const ref = args[args.length - 1];
      const img = db.images.find((i) => `${i.Repository}:${i.Tag}` === ref || i.ID === ref);
      if (!img) throw `Error response from daemon: No such image: ${ref}`;
      return lines(historyOf(img.Repository));
    }
```
   and, near the other module-level constants, add `historyOf` (data in step 1 of WO-8.14b, which owns the mock data). Do this mock step in WO-8.14b, not here: this work order ends with Rust and docs only.

Done when:
1. `cd src-tauri && cargo test history` prints `test result: ok` with at least 2 passed; `cargo test image` prints at least 6 passed in total over both commands; `0 failed` everywhere.
2. `grep -n "\"history\"" ALLOW_FILE` prints at least 2 lines (the arm and `allowed_flags`).
3. `node scripts/check-security-model.mjs` exits 0.
4. The gate.

Pull request title: `wo-8.14a: allow docker history and ask a registry for a newer image`

---

## WO-8.14b The image detail page (G17, screen)

Needs: WO-8.14a, WO-3.4, WO-8.11 (not used here, but the settings store is the only storage).

Why: today an image row has `Run` and `Remove` only and nothing shows what is inside (J15, G17). Done when for `postgres:16`: layers with sizes, "Listens on 5432", where it keeps data, and `Look inside` opens a shell.

Read first:
1. `../08-feature-gaps.md` G17.
2. `../04-design-spec.md` sections 7.12, 6.1, 6.3, 6.5, 6.9, 9.
3. Mockup screen `image-detail` (`../design/shots/image-detail-light.png` and `-dark.png`; markup in `../design/mockup.html`, search `const imageDetail`).
4. `src/ContainerDetail*.tsx` (the detail page of WO-3.2: copy how it builds its header and tabs), `src/lib/shell.ts`, `src/api.ts`.

Starting state:
1. `grep -rn "images" src/lib/router.ts` prints the routes line with `#/images/<id>/<overview|layers|files|settings>` (WO-2.1). Write the route parser's output shape: `useRoute()` gives `{ page, id, tab }`.
2. `grep -rln "export default function Images\|export function Images" src` prints one file. Write it down as IMAGES_FILE.
3. `grep -rn "image-detail" scripts/mockup-pairs.json` prints nothing.
4. `grep -n "export function useEngine\b\|export function useEngine(" src/lib/engines.ts` prints one line.
5. `grep -n "export const docker\b\|export async function dockerJson" src/api.ts` prints both.
6. `grep -rn "parseBytes\|formatBytes" src/containerInfo.ts | head -3` prints both exports.
7. `grep -n "export function Tabs\|export function TabPanel" src/ui/*.tsx` prints both (WO-1.3a). Props: `Tabs { value, onChange, items: {value,label}[], aria-label, children }`, `TabPanel { value, children }`.
8. `grep -n "design" preview/mock.ts` prints the `scenario === "design"` data (WO-1.5). Write the postgres image row's `ID` and `Size`.
9. `grep -n "function dockerCmd" preview/mock.ts` prints one line.

Do not touch: the Images list layout (only its row click, step 8). The Run sheet. `src/ui/container-ui.css`.

Words (do not change; all other words are from the mockup or spec section 9):
1. Header buttons: `Look inside`, `Check for a newer one`, `Run`. More menu `More actions for {name}`: `Pull again` (hint "To get the newest build of this tag"), `Copy name`, separator, `Remove…` (disabled with the hint "Used by {names}. Remove {names} first" when in use).
2. Tabs: `Layers`, `Settings it starts with`. Default tab: Layers.
3. Layer table: caption (accessible name) `Layers of {name}`; header cells `What this step did` and `Added`.
4. Step notes: row 1 `The base system`; the largest step `Most of the size is here`; a `VOLUME` step `Data lives here. Keep it in a volume`.
5. Settings sentences: `Listens on 5432`, `Listens on 3306 and 33060`, `Listens on 80, 443 and 8080`, `Keeps data in /var/lib/postgresql/data`, `Keeps data in /a and /b`, `Sets 3 variables: PG_MAJOR, PGDATA, LANG`, `Sets 1 variable: PGDATA`, `Starts with docker-entrypoint.sh postgres`. Nothing declared: `Empty` with title `Nothing declared` and line `This image sets no ports, folders, variables or start command.`
6. Check for a newer one: while running the button is busy. Result as a `Banner` (`tone`): info, title `{name} is up to date`; warn, title `A newer {name} is available`, with a primary `Pull` button; info, title `Nothing to compare`, body `This image was not pulled from a registry.`; bad, title `Could not check`, body the plain text from the command, `Try again` button.
7. After `Pull` succeeds: toast `Pulled {name}`; the banner closes.
8. Not found: `Empty` with title `This image is gone`, line `It was removed, or this engine does not have it.`, button `Back to Images`.
9. Facts line: `{12 character id} · {os}/{architecture} · Built {relative time} · {n} layers · {From Docker Hub | From {host} | Built on this Mac}`; `1 layer` when n is 1.
10. Header summary: `{size} · used by {names joined by ", "}` or `{size} · not used`.

Scope (decided, not a gap): the mockup's `Overview` and `Files` tabs and the "Files added by step 3" list are not built in this release. They need an image export (`../08-feature-gaps.md` G17 item 5, after the first release). The route `#/images/<id>/overview` and `#/images/<id>/files` show the Layers tab. The `image-detail` mockup row says so in its `why`.

Layout (from `container-ui.css` section 11): the page body is `<div className="content stack top">`. Nothing else sets spacing. No `style=` anywhere on the page.

Tests to write first: steps 1 and 2.

Steps:

1. Pure logic first. Create `src/lib/imageDetail.test.ts` with these tests, then run them and see them fail (module missing):

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { cleanStep, layerRows, describeImage, sourceOf, usedBy, agoText, digestOf, compareDigest, type HistoryLine, type InspectJson } from "./imageDetail.ts";

test("Given a classic history line, when cleaned, then the shell wrapper and the nop marker go", () => {
  assert.equal(cleanStep('/bin/sh -c #(nop)  CMD ["postgres"]'), 'CMD ["postgres"]');
  assert.equal(cleanStep("/bin/sh -c #(nop) ADD file:abc in / "), "ADD file:abc in /");
});

test("Given a BuildKit RUN line, when cleaned, then RUN and the buildkit marker go", () => {
  assert.equal(cleanStep("RUN /bin/sh -c apt-get install -y gnupg less # buildkit"), "apt-get install -y gnupg less");
  assert.equal(cleanStep("RUN /bin/sh -c set -eux;   apt-get update # buildkit"), "set -eux; apt-get update");
});

test("Given instruction lines, when cleaned, then the instruction word stays", () => {
  assert.equal(cleanStep("COPY docker-entrypoint.sh /usr/local/bin/ # buildkit"), "COPY docker-entrypoint.sh /usr/local/bin/");
  assert.equal(cleanStep("VOLUME [/var/lib/postgresql/data]"), "VOLUME /var/lib/postgresql/data");
  assert.equal(cleanStep("EXPOSE 5432"), "EXPOSE 5432");
});

const hist = (createdBy: string, size: string | number): HistoryLine => ({ CreatedBy: createdBy, Size: size, CreatedAt: "2026-09-30T10:00:00Z" });

test("Given history newest first, when rows are built, then they run oldest first and are numbered from 1", () => {
  const rows = layerRows([hist("EXPOSE 5432", "0B"), hist("debian", "97MB")]);
  assert.deepEqual(rows.map((r) => [r.n, r.step]), [[1, "debian"], [2, "EXPOSE 5432"]]);
});

test("Given sizes as numbers, decimal strings and units, when rows are built, then each is in bytes", () => {
  const rows = layerRows([hist("c", 1000), hist("b", "2000"), hist("a", "97MB")]);
  assert.deepEqual(rows.map((r) => r.bytes), [97_000_000, 2000, 1000]);
});

test("Given several steps, when rows are built, then the first is the base, the biggest says so, and VOLUME says data lives there", () => {
  const rows = layerRows([hist("EXPOSE 5432", 0), hist("VOLUME [/data]", 0), hist("RUN /bin/sh -c big # buildkit", "311MB"), hist("debian", "97MB")]);
  assert.equal(rows[0].note, "The base system");
  assert.equal(rows[1].note, "Most of the size is here");
  assert.equal(rows[2].note, "Data lives here. Keep it in a volume");
  assert.equal(rows[3].note, "");
});

test("Given one step only, when rows are built, then it is the base and nothing else", () => {
  assert.equal(layerRows([hist("debian", "5MB")])[0].note, "The base system");
});

test("Given every step is empty, when rows are built, then no step claims most of the size", () => {
  const rows = layerRows([hist("b", 0), hist("a", 0)]);
  assert.deepEqual(rows.map((r) => r.note), ["The base system", ""]);
});

const insp = (config: InspectJson["Config"]): InspectJson => ({ Id: "sha256:x", Config: config });

test("Given exposed ports, when described, then they read in order in words", () => {
  assert.deepEqual(describeImage(insp({ ExposedPorts: { "5432/tcp": {} } })), ["Listens on 5432"]);
  assert.deepEqual(describeImage(insp({ ExposedPorts: { "33060/tcp": {}, "3306/tcp": {} } })), ["Listens on 3306 and 33060"]);
  assert.deepEqual(describeImage(insp({ ExposedPorts: { "8080/tcp": {}, "80/tcp": {}, "443/tcp": {} } })), ["Listens on 80, 443 and 8080"]);
  assert.deepEqual(describeImage(insp({ ExposedPorts: { "5353/udp": {} } })), ["Listens on 5353 (UDP)"]);
});

test("Given declared volumes, when described, then each folder is named", () => {
  assert.deepEqual(describeImage(insp({ Volumes: { "/var/lib/postgresql/data": {} } })), ["Keeps data in /var/lib/postgresql/data"]);
  assert.deepEqual(describeImage(insp({ Volumes: { "/b": {}, "/a": {} } })), ["Keeps data in /a and /b"]);
});

test("Given variables, when described, then only their names show", () => {
  assert.deepEqual(describeImage(insp({ Env: ["PGDATA=/x", "LANG=en_US", "PG_MAJOR=16"] })), ["Sets 3 variables: LANG, PGDATA, PG_MAJOR"]);
  assert.deepEqual(describeImage(insp({ Env: ["TOKEN=secret"] })), ["Sets 1 variable: TOKEN"]);
  const many = Array.from({ length: 8 }, (_, i) => `V${i}=x`);
  assert.deepEqual(describeImage(insp({ Env: many })), ["Sets 8 variables: V0, V1, V2, V3, V4, V5 and 2 more"]);
});

test("Given an entrypoint and a command, when described, then the start line joins them", () => {
  assert.deepEqual(describeImage(insp({ Entrypoint: ["docker-entrypoint.sh"], Cmd: ["postgres"] })), ["Starts with docker-entrypoint.sh postgres"]);
  assert.deepEqual(describeImage(insp({ Cmd: ["sh", "-c", "echo hi"] })), ["Starts with sh -c echo hi"]);
});

test("Given nothing declared or nulls, when described, then the list is empty", () => {
  assert.deepEqual(describeImage(insp({ ExposedPorts: null, Volumes: null, Env: null, Cmd: null, Entrypoint: null })), []);
  assert.deepEqual(describeImage({ Id: "x" }), []);
});

test("Given repo digests, when asked where it came from, then the host is named", () => {
  assert.equal(sourceOf({ Id: "x", RepoDigests: ["postgres@sha256:aa"] }), "From Docker Hub");
  assert.equal(sourceOf({ Id: "x", RepoDigests: ["ghcr.io/acme/api@sha256:aa"] }), "From ghcr.io");
  assert.equal(sourceOf({ Id: "x", RepoDigests: ["acme/api@sha256:aa"] }), "From Docker Hub");
  assert.equal(sourceOf({ Id: "x", RepoDigests: [] }), "Built on this Mac");
  assert.equal(sourceOf({ Id: "x" }), "Built on this Mac");
});

test("Given containers, when asking who uses an image, then names match by reference or id", () => {
  const ps = [{ Names: "db", Image: "postgres:16" }, { Names: "web", Image: "efec2006ec41" }, { Names: "x", Image: "redis:7" }];
  assert.deepEqual(usedBy("postgres:16", "efec2006ec41", ps), ["db", "web"]);
  assert.deepEqual(usedBy("nginx:latest", "aaaaaaaaaaaa", ps), []);
});

test("Given times, when written as ago, then the largest whole unit is used", () => {
  const now = Date.parse("2026-11-12T12:00:00Z");
  assert.equal(agoText("2026-09-30T12:00:00Z", now), "6 weeks ago");
  assert.equal(agoText("2026-11-12T09:00:00Z", now), "3 hours ago");
  assert.equal(agoText("2026-11-11T11:00:00Z", now), "1 day ago");
  assert.equal(agoText("2026-11-12T11:59:40Z", now), "just now");
  assert.equal(agoText("not a date", now), "");
});

test("Given repo digests and a remote digest, when compared, then same means up to date, different means newer", () => {
  const i: InspectJson = { Id: "x", RepoDigests: ["postgres@sha256:aaa", "other/postgres@sha256:bbb"] };
  assert.equal(compareDigest(i, "sha256:aaa"), "same");
  assert.equal(compareDigest(i, "sha256:ccc"), "newer");
  assert.equal(compareDigest({ Id: "x", RepoDigests: [] }, "sha256:aaa"), "none");
  assert.equal(compareDigest({ Id: "x" }, "sha256:aaa"), "none");
  assert.equal(digestOf("postgres@sha256:aaa"), "sha256:aaa");
});
```

2. Create `src/lib/imageDetail.ts`. Its exported names and what each does (write the bodies so the tests pass; imports use `./containerInfo.ts` for `parseBytes` only if that file imports no React; if it does, copy the 12-line unit parser into this file instead, with a comment):

   1. Types:
```ts
export type HistoryLine = { CreatedBy: string; Size: string | number; CreatedAt?: string; Comment?: string };
export type InspectJson = {
  Id: string;
  RepoTags?: string[] | null;
  RepoDigests?: string[] | null;
  Architecture?: string;
  Os?: string;
  Created?: string;
  Size?: number;
  RootFS?: { Layers?: string[] | null };
  Config?: { Env?: string[] | null; ExposedPorts?: Record<string, object> | null; Volumes?: Record<string, object> | null; Cmd?: string[] | null; Entrypoint?: string[] | null } | null;
};
export type LayerRow = { n: number; step: string; bytes: number; note: string };
```
   2. `cleanStep(createdBy: string): string`: in this order: trim; remove a leading `RUN `; remove a leading `/bin/sh -c `; remove a leading `#(nop)` and following spaces; remove a trailing ` # buildkit`; for a line that starts with `VOLUME [` remove the brackets; collapse runs of spaces to one; trim.
   3. `layerRows(newestFirst: HistoryLine[]): LayerRow[]`: reverse, number from 1, `bytes` from `Size` (number as is; numeric string as bytes; otherwise the unit parser, decimal units: KB 1e3, MB 1e6, GB 1e9, B), `step` from `cleanStep`. Notes by the priority: row 1 `The base system`; else the row with the largest `bytes` (first on a tie, only when that is above 0) `Most of the size is here`; else a step starting with `VOLUME ` `Data lives here. Keep it in a volume`; else empty. Exactly one note per row, as in the test.
   4. `describeImage(i: InspectJson): string[]`: in this order ports, folders, variables, start. Ports: keys like `5432/tcp`; sort by number; tcp shows the number, udp shows `5353 (UDP)`; joined `a`, `a and b`, `a, b and c`. Folders: sorted keys joined the same way after `Keeps data in `. Variables: names (text before the first `=`), sorted, up to 6 shown then ` and {n} more`: `Sets {n} variable(s): ...` with `variable` singular for 1. Start: `Starts with ` plus Entrypoint then Cmd joined with spaces, only when at least one is non-empty.
   5. `sourceOf(i)`: first entry of `RepoDigests` before `@`; its first path segment is a host when it contains `.` or `:` or equals `localhost`: `From {host}`; otherwise `From Docker Hub`; no entries: `Built on this Mac`.
   6. `usedBy(ref, id, ps: { Names: string; Image: string }[]): string[]`: names whose `Image` equals `ref`, or equals `id`, or is a prefix of `id` with length of at least 4.
   7. `agoText(iso, nowMs)`: under 60 seconds `just now`; minutes `{n} minute(s) ago`; hours; days; weeks (7 days, up to 8 weeks); months (30 days); years. Singular `1 day ago`. A date that does not parse: empty string.
   8. `digestOf(repoDigest: string): string`: the part after `@`.
   9. `compareDigest(i, remote): "same" | "newer" | "none"`: `none` when there are no repo digests; `same` when any repo digest's digest equals `remote`; else `newer`.

3. Run `node --experimental-strip-types --no-warnings --test src/lib/imageDetail.test.ts`. Expected: 17 tests pass, 0 fail.

4. Mock data. In `preview/mock.ts`:
   1. Next to the other module-level data add `historyOf` and `inspectOf`:

```ts
// Image detail data. Only postgres has the full story (the mockup's `image-detail` screen); the rest get one plain step.
const POSTGRES_HISTORY = [
  ["EXPOSE 5432", "0B"], ["VOLUME [/var/lib/postgresql/data]", "0B"], ["COPY docker-entrypoint.sh /usr/local/bin/ # buildkit", "14kB"],
  ["RUN /bin/sh -c mkdir /docker-entrypoint-initdb.d # buildkit", "0B"], ["RUN /bin/sh -c apt-get install -y postgresql-16 # buildkit", "311MB"],
  ["RUN /bin/sh -c apt-get install -y gnupg less # buildkit", "9MB"], ["debian:bookworm-slim", "97MB"],
];
const historyOf = (repo: string) =>
  (repo === "postgres" ? POSTGRES_HISTORY : [[`ADD ${repo} in /`, "5MB"]]).map(([CreatedBy, Size]) => ({ CreatedBy, Size, CreatedAt: new Date(now - 42 * 864e5).toISOString() }));
const inspectOf = (img: { Repository: string; Tag: string; Size: string; ID: string }) => ({
  Id: `sha256:${img.ID}${"0".repeat(52)}`,
  RepoTags: [`${img.Repository}:${img.Tag}`],
  RepoDigests: [`${img.Repository}@sha256:${img.ID}${"a".repeat(52)}`],
  Architecture: "arm64", Os: "linux", Created: new Date(now - 42 * 864e5).toISOString(),
  Size: Math.round(parseFloat(img.Size) * 1e6),
  RootFS: { Layers: Array.from({ length: img.Repository === "postgres" ? 14 : 1 }, (_, i) => `sha256:${i}`) },
  Config: img.Repository === "postgres"
    ? { Env: ["PG_MAJOR=16", "PGDATA=/var/lib/postgresql/data", "LANG=en_US.utf8"], ExposedPorts: { "5432/tcp": {} }, Volumes: { "/var/lib/postgresql/data": {} }, Entrypoint: ["docker-entrypoint.sh"], Cmd: ["postgres"] }
    : { Env: null, ExposedPorts: null, Volumes: null, Entrypoint: null, Cmd: null },
});
let remoteNewer = false; // &newer=1: the registry has a newer postgres:16 than the local copy.
```
   2. In `dockerCmd`, in `case "image":` add as the first line of the case: `if (sub === "inspect" && args.includes("{{json .}}")) { const ref = args[args.length - 1]; const img = db.images.find((i) => `${i.Repository}:${i.Tag}` === ref || i.ID === ref); if (!img) throw `Error response from daemon: No such image: ${ref}`; return JSON.stringify(inspectOf(img)); }`. The mock already passes the full argument list to `dockerCmd` for `image` commands, so `{{json .}}` is present (check with `grep -n '"image" ||' preview/mock.ts`).
   3. Add `case "history":` as in WO-8.14a step 9 (it was left for this work order).
   4. In the `invoke` switch add this case (exactly):
```ts
    case "image_remote_digest": {
      await sleep(600);
      if (flag("buildx")) throw "Checking needs docker buildx, which is not installed. Install it with: brew install docker-buildx";
      const img = db.images.find((i) => `${i.Repository}:${i.Tag}` === a.image);
      if (!img) throw "Error: no such image";
      return (flag("newer") ? "sha256:" + "f".repeat(64) : `sha256:${img.ID}${"a".repeat(52)}`) as T;
    }
```
   5. In the `docker_pull` mock nothing changes.
   6. In scenario `design` make sure the postgres image row has `ID: "efec2006ec41"` and `Size: "435MB"` (edit the design scenario data if it differs; this is the data of the mockup). Write what you changed in the pull request.

5. Create `src/ImageDetail.tsx`. Props: `{ id: string }`. Exports `default function ImageDetail`. Structure (component names are from `src/ui`; use their real props by reading the files, and copy the header and tabs usage from the container detail page):

```
<Page header>                      // the detail header, like the container detail page
  back button, aria-label "Back to Images", goes to #/images
  <h1>{name}</h1> where name is "repo:tag" (the first RepoTag; else the 12 character id)
  <span class="sub">{summary}</span>      // Words 10
  spacer
  <Button onClick={lookInside} disabled={!ref}>Look inside</Button>
  <Button busy={checking} onClick={check} disabled={!ref}>Check for a newer one</Button>
  <Button variant="primary" onClick={run}>Run</Button>
  <Menu trigger={<MoreButton name={name} />} label={`More actions for ${name}`} align="end"> MenuItem entries from Words 1 </Menu>
<div className="content stack top">
  {banner for the check result, Words 6}
  <Facts items={[{label:"Image",value:id12},{label:"Platform",value:"linux/arm64"},{label:"Built",value:agoText(...)},{label:"Layers",value:"14"},{label:"Source",value:sourceOf(...)}]} />   // Words 9
  <Tabs value={tab} onChange={(t) => go(`/images/${id}/${t}`)} aria-label="Image" items={[{value:"layers",label:"Layers"},{value:"settings",label:"Settings it starts with"}]}>
    <TabPanel value="layers">
      <List aria-label={`Layers of ${name}`}>
        <RowHead><span className="lead"/><span className="name">What this step did</span><span className="meta grow"/><span className="col size">Added</span></RowHead>
        for each row of layerRows(history):
        <Row lead={n} name={step} nameClass="plain mono long" title={step} meta={note}><Col kind="size" mono>{formatBytes(bytes)}</Col></Row>   // lead is the step number; no onOpen, no action, no menu
      </List>
    </TabPanel>
    <TabPanel value="settings">: one <div className="setting"><div className="text"><div className="t">{sentence}</div></div></div> per describeImage() sentence; or <Empty icon="info" title="Nothing declared">This image sets no ports, folders, variables or start command.</Empty> (Words 5)
```
   Rules:
   1. Layer rows use `List`, `RowHead`, `Row` and `Col` from `src/ui` (WO-1.3b) with no `onOpen`. `Row` gets `nameClass="plain mono long"` (the step text is plain, mono, and may be long) and `lead={n}` with `n` a number, so the step number is drawn in the small mono lead. The facts use `Facts` (it draws `div.facts` with one span per fact; the labels `Image`, `Platform`, `Built`, `Layers`, `Source` are read by screen readers only). Open `src/ui/Row.tsx`: if a number given as `lead` does not get the class `num` on `span.lead` (the mockup draws `lead num`), stop and report; do not add a class and do not use `style=`. The `Icon` name for the empty state must exist in `IconName` (WO-1.3a); use the closest existing one and say which in the pull request.
   2. Data: `useQuery({ queryKey: [engine.id, "image-inspect", id], queryFn })` where `queryFn` is `dockerJson<InspectJson>(engine.id, ["image", "inspect", id]).then((r) => r[0])`; history: `useQuery({ queryKey: [engine.id, "image-history", id], queryFn: () => dockerJson<HistoryLine>(engine.id, ["history", "--no-trunc", id]) })`. Careful: `dockerJson` appends `--format {{json .}}` after the args, so the history call becomes `["history", "--no-trunc", id, "--format", "{{json .}}"]`, which the allowlist refuses (the image must be last). Write the history call with `docker()` directly: `docker(engine.id, ["history", "--no-trunc", "--format", "{{json .}}", id])` and split lines like `dockerJson` does. Do the same for `image inspect` only if its list refuses the order: `image inspect` has no position rule, so `dockerJson` is fine there. `docker ps -a` for `usedBy`: reuse the query the Images list already uses (copy its key) or `dockerJson<{ Names: string; Image: string }>(engine.id, ["ps", "-a"])`.
   3. The size and layer count come from the inspect result (`Size`, `RootFS.Layers.length`). Format with `formatBytes` from `src/containerInfo.ts`. If it prints something other than `435 MB` for the design scenario, change the mock number in step 4.6 until it does. Do not change the formatter.
   4. `lookInside`: the backend has no `open_terminal` kind for an image yet (`terminal_command` accepts `k9s`, `shell`, `bash` and `debug`), so this work order adds it. Do these three things, in this order:
   1. Rust, in the module that holds `terminal_command`: add an arm `("image", Some(image)) if crate::allow::image_ref_ok(image) => Ok(format!("{} --context {} run --rm -it {} sh", find_bin("docker"), context, image)),` (use the real module path of `image_ref_ok`). Test first, in the test module of that file: `given_an_image_when_asked_for_a_look_inside_then_the_command_is_a_throwaway_shell` asserts `terminal_command("image", "colima", Some("postgres:16"))` equals `Ok(format!("{} --context colima run --rm -it postgres:16 sh", find_bin("docker")))`; `given_a_bad_image_when_asked_for_a_look_inside_then_it_is_refused` asserts `Err` for `"-x"`, `"a b"`, `"a;rm"` and `None`. The command is plain text, so `terminal_script` accepts it (`:` and `/` are allowed). `--rm` removes the container on exit, which is what "throwaway" means.
   2. Images with no shell (distroless, scratch) make `docker run ... sh` fail with "executable file not found". Do not add a fallback in this work order. Say so in the pull request, and add one line to `docs/plan/FOUND.md`: `Look inside has no fallback for images with no shell (docker run --rm -it <image> sh fails). G17 item 2 asks for the same fallback as src/lib/shell.ts, which needs a container to borrow from.` This is a reported gap, not a decision.
   3. Front end: `lookInside` calls `activity.ran("run", dockerLine(engine.id, ["run", "--rm", "-it", ref, "sh"]), () => invoke("open_terminal", { kind: "image", context: engine.id, target: ref }), ref)`, like `src/lib/shell.ts`.
   Add `docs/security-model.md` nothing (the `open_terminal` row already says "kind is one of a short list"); but update its "Input it checks" cell to mention `image` and run `node scripts/check-security-model.mjs`.
   5. `check`: sets `checking`, calls `invoke<string>("image_remote_digest", { image: ref })`, compares with `compareDigest(inspect, digest)`: `same` shows the info banner "up to date", `newer` the warn banner with `Pull`, `none` the "Nothing to compare" banner. A thrown error shows the bad banner with the thrown text and `Try again`. `Pull` runs `invoke("docker_pull", { context: engine.id, image: ref })`, then invalidates the queries `[engine.id, "images"]`, `[engine.id, "image-inspect", id]`, shows the toast and closes the banner. If the app's Images list uses a different query key, invalidate that one (find it in IMAGES_FILE).
   6. `Run`: opens the Run sheet for `ref` exactly as the Images row's `Run` does (copy the call from IMAGES_FILE).
   7. `Remove…`: same confirm and command as the Images row's menu (copy from IMAGES_FILE; after success `go("/images")`).
   8. Loading: four `SkeletonRows`. Error from the inspect query for "No such image": the `Empty` of Words 8; any other error: a `Banner` bad with `Try again`.

6. Route it. Find where the app renders pages from `useRoute()` (`grep -rn "page === \"images\"\|case \"images\"" src`). When `route.id` is set on the images page, render `<ImageDetail id={route.id} />` instead of IMAGES_FILE's component. `tab` values other than `layers` and `settings` act as `layers`.

7. In IMAGES_FILE, make a click on a row (not on its buttons or menu) call `go(`/images/${image.ID}/layers`)`, as the Containers rows do (copy that code). The row keeps its `Run` button and its menu, which already stop the click.

8. Component test `src/ImageDetail.test.tsx` (vitest), with the backend mocked like `src/lib/shell.test.tsx` does. Tests:
   1. `given an image with history when the page opens then the layers show oldest first with sizes and notes`: asserts the table named `Layers of postgres:16` has 7 rows, the first note `The base system`, a `311 MB` cell, the note `Most of the size is here`.
   2. `given the settings tab when opened then it says what the image listens on and where it keeps data`: asserts `Listens on 5432` and `Keeps data in /var/lib/postgresql/data`.
   3. `given Look inside when clicked then Terminal opens on a throwaway shell of the image`: asserts one `open_terminal` call with `kind: "image"` and `target: "postgres:16"`.
   4. `given the registry has a newer image when checking then a Pull button is offered`: asserts the warn banner text and the `Pull` button.
   5. `given buildx is missing when checking then the bad banner explains it`.

9. Browser check `scripts/check-image-detail.mjs`:
   1. `const page = await open("/?scenario=design#/images")`; click the `postgres:16` row name. `check(location hash ends with "/layers", "images: a click on a row opens its detail on Layers")`.
   2. `check(heading "postgres:16" is visible, "detail: the title is the image name")`.
   3. `check((await page.locator('[aria-label="Layers of postgres:16"] [role=row]').count()) === 8, "layers: seven steps and a header row")`.
   4. `check(text "Most of the size is here" appears once, ...)`, and `check` the cell `311 MB`.
   5. Click the tab `Settings it starts with`; `check(text "Listens on 5432" visible, "settings: says what it listens on")`; `check(text "Keeps data in /var/lib/postgresql/data" visible, "settings: says where it keeps data")`.
   6. Click `Look inside`; `check` that `window.__terminal` has an entry with `kind === "image"` and `target === "postgres:16"`.
   7. Click `Check for a newer one`; `check(text "postgres:16 is up to date" visible, "check: says up to date")`. A second page at `/?scenario=design&newer=1#/images/efec2006ec41/layers`: after the click, `check(text "A newer postgres:16 is available" visible)` and a `Pull` button. A third page with `&buildx=1`: the bad banner text contains `brew install docker-buildx`.
   8. `check(await page.getByRole("button", { name: "Run" }).count() === 1 && primary class, "detail: Run is the one primary button")`.
   9. `check(no element with a style attribute under .content, "detail: no inline styles")`.
   10. `await done()`.

10. Mockup row. Add to `scripts/mockup-pairs.json` one object (keep the file's format and the other rows):

```json
{ "mockup": "image-detail", "path": "/?scenario=design#/images/efec2006ec41/layers", "themes": ["light", "dark"], "threshold": 0.06, "mask": [".facts"], "why": "The mockup also draws the Overview and Files tabs and the folders added by step 3 (they need an image export, after the first release), and the fact line holds a time that changes." }
```
    Run `npm run check`. If the difference is above `0.06`, look at the diff picture the script writes, fix the screen, and do not raise the threshold.

11. Remove from `scripts/not-migrated.json` any file this work order rebuilt or created (none should be in it; confirm). The file must not grow.

Done when:
1. `node --experimental-strip-types --no-warnings --test src/lib/imageDetail.test.ts` prints `# pass 17` and `# fail 0`.
2. `npx vitest run src/ImageDetail.test.tsx` prints `5 passed`.
3. `check-image-detail.mjs` prints only `ok` in Chromium and WebKit, and `npm run check` is green including the new mockup row.
4. `cd src-tauri && cargo test terminal` passes, including the two `image` tests.
5. `node scripts/check-security-model.mjs` exits 0.
6. By eye against `../design/shots/image-detail-light.png` and `-dark.png`, WebKit, 1280x800: header buttons in the order Look inside, Check for a newer one, Run (primary, last), the facts line under the header, tabs, the layers table with the columns step and Added, the step note in muted text, no tinted rows. The only differences allowed: the missing `Overview` and `Files` tabs and the missing list "Files added by step 3".
7. The gate.

Pull request title: `wo-8.14b: look inside an image, see its layers, check for a newer one`

---

## WO-8.15a Registries backend: read the list, sign in through Terminal (G10, backend)

Needs: WO-3.9 (Settings), WO-8.10 (the page this work order updates).

Why: G10 lets a person use company registries and AWS. The app must never see a password or token: the list comes from the names in `~/.docker/config.json`, and signing in happens in the person's Terminal.

Read first:
1. `../08-feature-gaps.md` G10 and section 4b rows `login, logout`.
2. `../04-design-spec.md` section 7.13.
3. `src/lib/registry.ts` and `src/lib/registry.test.ts` (today's host and login-command rules; the Rust code must agree with them).
4. The module that holds `terminal_command`, `terminal_script`, `open_terminal` (Starting state item 1).
5. Official docs: https://docs.docker.com/reference/cli/docker/login/ (config file, `credsStore`, `credHelpers`) and https://docs.aws.amazon.com/AmazonECR/latest/userguide/registry_auth.html (the ECR sign-in line and the 12 hour token).

Hard rules (from the spec; a check script and the tests enforce them):
1. The app never reads a value from `auths` or `credHelpers`. It reads the key names only.
2. The app never writes `~/.docker/config.json` or any file in `~/.docker`.
3. No registry password or token is typed, stored, passed as an argument or placed in an environment variable by the app. Sign in is a command the person runs in Terminal.

Starting state:
1. `grep -rn "fn terminal_command\|fn terminal_script\|fn open_terminal" src-tauri/src` prints three lines (one file or two). Write down the file as TERMINAL_FILE.
2. `grep -rn "fn find_bin" src-tauri/src` prints one line.
3. `ls src-tauri/src/registry.rs` prints "No such file".
4. `grep -n "\"debug\"" TERMINAL_FILE` prints the `terminal_command` arm for `debug`.
5. `grep -rn "dirs::" src-tauri/src` prints nothing (the crate is gone). Use `std::env::var("HOME")`.
6. `ls ~/.docker/config.json` may exist. Do NOT open it. The tests use text written inside the test.

Do not touch: `docker_pull`, the allowlist (login and logout stay refused: `grep -n "\"login\"" ALLOW_FILE` prints nothing and must still print nothing after this work order).

Tests to write first: step 1.

Steps:

1. Create `src-tauri/src/registry.rs` containing only the tests and stubs (`todo!()` bodies) so they fail. The tests:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    const CONFIG: &str = r#"{
      "auths": { "https://index.docker.io/v1/": { "auth": "c2VjcmV0LXVzZXI6c2VjcmV0LXBhc3M=" }, "ghcr.io": {}, "123456789012.dkr.ecr.eu-west-1.amazonaws.com": { "auth": "QVdTOnRva2Vu" } },
      "credsStore": "osxkeychain",
      "credHelpers": { "registry.example.com": "ecr-login" }
    }"#;

    #[test]
    fn given_a_config_when_read_then_hosts_come_from_auths_and_cred_helpers() {
        let out = registries_from_config(CONFIG).unwrap();
        let hosts: Vec<(&str, &str)> = out.iter().map(|r| (r.host.as_str(), r.how)).collect();
        assert_eq!(
            hosts,
            vec![
                ("123456789012.dkr.ecr.eu-west-1.amazonaws.com", "stored"),
                ("https://index.docker.io/v1/", "stored"),
                ("ghcr.io", "stored"),
                ("registry.example.com", "helper"),
            ]
        );
    }

    #[test]
    fn given_a_config_with_secrets_when_read_then_no_value_is_in_the_answer() {
        let out = serde_json::to_string(&registries_from_config(CONFIG).unwrap()).unwrap();
        for secret in ["c2VjcmV0", "QVdTOnRva2Vu", "ecr-login", "osxkeychain"] {
            assert!(!out.contains(secret), "{secret}");
        }
    }

    #[test]
    fn given_empty_or_missing_sections_when_read_then_the_list_is_empty() {
        assert!(registries_from_config("{}").unwrap().is_empty());
        assert!(registries_from_config(r#"{"auths": null, "credHelpers": null}"#).unwrap().is_empty());
        assert!(registries_from_config(r#"{"auths": {}}"#).unwrap().is_empty());
    }

    #[test]
    fn given_text_that_is_not_json_when_read_then_the_error_does_not_repeat_the_text() {
        let err = registries_from_config("{ \"auths\": { \"x\": secret-token-123").unwrap_err();
        assert!(!err.contains("secret-token-123"));
    }

    #[test]
    fn given_a_host_that_is_in_both_sections_when_read_then_it_is_listed_once_as_a_helper() {
        let out = registries_from_config(r#"{"auths":{"a.example.com":{}},"credHelpers":{"a.example.com":"x"}}"#).unwrap();
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].how, "helper");
    }

    #[test]
    fn given_registry_hosts_when_building_the_sign_in_line_then_each_has_its_own_form() {
        let c = |h: &str| login_command("/bin/docker", "/bin/aws", h).unwrap();
        assert_eq!(c("docker.io"), "/bin/docker login");
        assert_eq!(c("index.docker.io"), "/bin/docker login");
        assert_eq!(c("ghcr.io"), "/bin/docker login ghcr.io");
        assert_eq!(c("registry.example.com:8443"), "/bin/docker login registry.example.com:8443");
        assert_eq!(
            c("123456789012.dkr.ecr.eu-west-1.amazonaws.com"),
            "/bin/aws ecr get-login-password --region eu-west-1 | /bin/docker login --username AWS --password-stdin 123456789012.dkr.ecr.eu-west-1.amazonaws.com"
        );
        assert_eq!(
            c("123456789012.dkr.ecr.cn-north-1.amazonaws.com.cn"),
            "/bin/aws ecr get-login-password --region cn-north-1 | /bin/docker login --username AWS --password-stdin 123456789012.dkr.ecr.cn-north-1.amazonaws.com.cn"
        );
        assert_eq!(
            c("public.ecr.aws"),
            "/bin/aws ecr-public get-login-password --region us-east-1 | /bin/docker login --username AWS --password-stdin public.ecr.aws"
        );
    }

    #[test]
    fn given_hosts_that_are_not_registry_names_when_building_the_sign_in_line_then_they_are_refused() {
        for bad in ["", "-x.io", "a b.io", "ghcr.io;rm -rf", "https://ghcr.io", "ghcr.io/acme", "evil.com`id`", "a|b.io", "nodot", "a..b.io", "x.io:99999x", "123456789012.dkr.ecr.eu west.amazonaws.com", "12345.dkr.ecr.eu-west-1.amazonaws.com;ls"] {
            assert!(login_command("/bin/docker", "/bin/aws", bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn given_hosts_when_building_the_sign_out_line_then_it_is_docker_logout_with_the_host() {
        assert_eq!(logout_command("/bin/docker", "docker.io").unwrap(), "/bin/docker logout");
        assert_eq!(logout_command("/bin/docker", "ghcr.io").unwrap(), "/bin/docker logout ghcr.io");
        assert!(logout_command("/bin/docker", "a b").is_err());
    }

    #[test]
    fn given_an_ecr_host_when_listing_repositories_then_the_aws_command_is_fixed() {
        assert_eq!(
            ecr_repositories_args("123456789012.dkr.ecr.eu-west-1.amazonaws.com").unwrap(),
            vec!["ecr", "describe-repositories", "--region", "eu-west-1", "--registry-id", "123456789012", "--query", "repositories[].repositoryName", "--output", "json"]
        );
        assert!(ecr_repositories_args("ghcr.io").is_err());
        assert!(ecr_repositories_args("public.ecr.aws").is_err());
    }

    #[test]
    fn given_aws_output_when_parsed_then_names_come_back_sorted() {
        assert_eq!(parse_repository_names(r#"["shop/worker","shop/api"]"#).unwrap(), vec!["shop/api", "shop/worker"]);
        assert!(parse_repository_names("not json").is_err());
        assert!(parse_repository_names(r#"{"a":1}"#).is_err());
    }

    #[test]
    fn given_aws_failures_when_explained_then_the_message_is_plain() {
        assert!(explain_aws_failure("sh: aws: command not found").contains("not installed"));
        assert!(explain_aws_failure("Unable to locate credentials. You can configure credentials by running \"aws configure\".").contains("aws configure"));
        assert!(explain_aws_failure("An error occurred (ExpiredTokenException)").contains("expired"));
    }

    #[test]
    fn the_registry_module_never_writes_files() {
        let src = include_str!("registry.rs");
        let before_tests = src.split("#[cfg(test)]").next().unwrap();
        for forbidden in ["fs::write", "File::create", "OpenOptions", "remove_file", "rename("] {
            assert!(!before_tests.contains(forbidden), "{forbidden}");
        }
    }
}
```
   Run `cd src-tauri && cargo test registry`. Expected: fails to compile or panics at `todo!()`. Good.

2. Write the module body above the tests:

```rust
// Which registries the Mac has credentials for, and the sign-in line for Terminal.
// The app never reads a credential: only the key names of `auths` and `credHelpers` are deserialised
// (serde's IgnoredAny drops every value as it goes), and nothing here writes any file.
use serde::de::IgnoredAny;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
pub struct RegistryEntry {
    pub host: String,
    /// "stored" when the key is in `auths`, "helper" when it is in `credHelpers`.
    pub how: &'static str,
}

#[derive(Deserialize, Default)]
struct DockerConfig {
    #[serde(default)]
    auths: Option<BTreeMap<String, IgnoredAny>>,
    #[serde(default, rename = "credHelpers")]
    cred_helpers: Option<BTreeMap<String, IgnoredAny>>,
}

pub fn registries_from_config(json: &str) -> Result<Vec<RegistryEntry>, String> {
    let cfg: DockerConfig = serde_json::from_str(json).map_err(|_| "Docker's sign-in file could not be read".to_string())?;
    let mut by_host: BTreeMap<String, &'static str> = BTreeMap::new();
    for host in cfg.auths.unwrap_or_default().into_keys() {
        by_host.insert(host, "stored");
    }
    for host in cfg.cred_helpers.unwrap_or_default().into_keys() {
        by_host.insert(host, "helper");
    }
    Ok(by_host.into_iter().map(|(host, how)| RegistryEntry { host, how }).collect())
}

#[tauri::command]
pub fn list_registries() -> Result<Vec<RegistryEntry>, String> {
    let home = std::env::var("HOME").map_err(|_| "No home folder".to_string())?;
    let path = std::path::Path::new(&home).join(".docker").join("config.json");
    match std::fs::read_to_string(&path) {
        Ok(text) => registries_from_config(&text),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(vec![]),
        Err(_) => Err("Docker's sign-in file could not be opened".to_string()),
    }
}

// A registry host: letters, digits, dots and hyphens, an optional :port, no slash, and a dot, a port or "localhost".
pub fn host_ok(h: &str) -> bool {
    let (name, port) = match h.rsplit_once(':') {
        Some((n, p)) if !p.is_empty() && p.len() <= 5 && p.chars().all(|c| c.is_ascii_digit()) => (n, Some(p)),
        Some(_) => return false,
        None => (h, None),
    };
    let edge = |c: Option<char>| c.map_or(false, |c| c.is_ascii_alphanumeric());
    !name.is_empty()
        && name.len() <= 253
        && edge(name.chars().next())
        && edge(name.chars().last())
        && !name.contains("..")
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
        && (name.contains('.') || port.is_some() || name == "localhost")
}

enum Kind<'a> {
    Hub,
    Ecr { region: &'a str },
    EcrPublic,
    Other,
}

// 123456789012.dkr.ecr.<region>.amazonaws.com, or the .com.cn form.
fn ecr_parts(h: &str) -> Option<(&str, &str)> {
    let parts: Vec<&str> = h.split('.').collect();
    let tail_ok = parts.len() == 6 && parts[4] == "amazonaws" && parts[5] == "com" || parts.len() == 7 && parts[4] == "amazonaws" && parts[5] == "com" && parts[6] == "cn";
    let region_ok = !parts.get(3).map_or(true, |r| r.is_empty()) && parts[3].chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    let account_ok = parts[0].len() == 12 && parts[0].chars().all(|c| c.is_ascii_digit());
    (tail_ok && region_ok && account_ok && parts[1] == "dkr" && parts[2] == "ecr").then(|| (parts[0], parts[3]))
}

fn kind_of(host: &str) -> Kind<'_> {
    match host {
        "docker.io" | "index.docker.io" => Kind::Hub,
        "public.ecr.aws" => Kind::EcrPublic,
        h => ecr_parts(h).map_or(Kind::Other, |(_, region)| Kind::Ecr { region }),
    }
}

pub fn login_command(docker: &str, aws: &str, host: &str) -> Result<String, String> {
    if !host_ok(host) {
        return Err(format!("\"{host}\" is not a registry address"));
    }
    Ok(match kind_of(host) {
        Kind::Hub => format!("{docker} login"),
        Kind::Ecr { region } => format!("{aws} ecr get-login-password --region {region} | {docker} login --username AWS --password-stdin {host}"),
        Kind::EcrPublic => format!("{aws} ecr-public get-login-password --region us-east-1 | {docker} login --username AWS --password-stdin {host}"),
        Kind::Other => format!("{docker} login {host}"),
    })
}

pub fn logout_command(docker: &str, host: &str) -> Result<String, String> {
    if !host_ok(host) {
        return Err(format!("\"{host}\" is not a registry address"));
    }
    Ok(match kind_of(host) {
        Kind::Hub => format!("{docker} logout"),
        _ => format!("{docker} logout {host}"),
    })
}

pub fn ecr_repositories_args(host: &str) -> Result<Vec<String>, String> {
    let (account, region) = host_ok(host).then(|| ecr_parts(host)).flatten().ok_or_else(|| format!("\"{host}\" is not an AWS registry address"))?;
    Ok(["ecr", "describe-repositories", "--region", region, "--registry-id", account, "--query", "repositories[].repositoryName", "--output", "json"].iter().map(|s| s.to_string()).collect())
}

pub fn parse_repository_names(out: &str) -> Result<Vec<String>, String> {
    let mut names: Vec<String> = serde_json::from_str(out.trim()).map_err(|_| "The list of repositories could not be read".to_string())?;
    names.sort();
    Ok(names)
}

pub fn explain_aws_failure(raw: &str) -> String {
    if raw.contains("command not found") || raw.contains("No such file") {
        return "The aws command is not installed. Install the AWS command line tool, then try again.".to_string();
    }
    if raw.contains("Unable to locate credentials") {
        return "The aws command is not signed in. Run aws configure in Terminal, then try again.".to_string();
    }
    if raw.contains("ExpiredToken") || raw.contains("expired") {
        return "Your AWS sign-in has expired. Sign in to AWS again, then try again.".to_string();
    }
    raw.trim().to_string()
}

#[tauri::command]
pub async fn ecr_repositories(host: String) -> Result<Vec<String>, String> {
    let args = ecr_repositories_args(&host)?;
    let out = crate::exec::exec("aws", args, true).await.map_err(|e| explain_aws_failure(&e))?; // use the real path of `exec`
    parse_repository_names(&out)
}
```
   `exec`'s first parameter is `&'static str`: `"aws"` fits. If `exec` finds binaries through `path_env()` (it should: GUI apps lack the shell PATH), `aws` in `/opt/homebrew/bin` or `/usr/local/bin` is found; if not, say so in the pull request.

3. Register: `mod registry;` in `main.rs`, and `registry::list_registries, registry::ecr_repositories` in `generate_handler!`.

4. Run `cd src-tauri && cargo test registry`. Expected: 12 passed, 0 failed.

5. Terminal kinds. In TERMINAL_FILE:
   1. Tests first, in its test module (they fail first):

```rust
    #[test]
    fn given_a_login_kind_when_building_then_the_registry_line_is_returned() {
        let c = terminal_command("login", "colima", Some("ghcr.io")).unwrap();
        assert_eq!(c, format!("{} login ghcr.io", find_bin("docker")));
        let e = terminal_command("login", "colima", Some("123456789012.dkr.ecr.eu-west-1.amazonaws.com")).unwrap();
        assert!(e.contains(" | ") && e.contains("--password-stdin"));
    }

    #[test]
    fn given_a_logout_kind_when_building_then_it_is_docker_logout() {
        assert_eq!(terminal_command("logout", "colima", Some("ghcr.io")).unwrap(), format!("{} logout ghcr.io", find_bin("docker")));
    }

    #[test]
    fn given_a_bad_registry_when_building_then_it_is_refused() {
        assert!(terminal_command("login", "colima", Some("a;b.io")).is_err());
        assert!(terminal_command("login", "colima", None).is_err());
        assert!(terminal_command("logout", "colima", Some("-x.io")).is_err());
    }

    #[test]
    fn given_a_sign_in_line_with_one_pipe_when_made_a_script_then_it_is_accepted_only_by_the_pipe_form() {
        let line = "/bin/aws ecr get-login-password --region eu-west-1 | /bin/docker login --username AWS --password-stdin h.example.com";
        assert!(terminal_script(line).is_none());
        assert!(terminal_script_allowing(line, &['|']).is_some());
        assert!(terminal_script_allowing("a; rm -rf /", &['|']).is_none());
        assert!(terminal_script_allowing("a $(id)", &['|']).is_none());
    }
```
   2. Edit `terminal_script`: rename its body to `fn terminal_script_allowing(command: &str, extra: &[char]) -> Option<String>`, where the plain check is `command.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | '/' | '.' | '_' | '-' | ':') || extra.contains(&c))`, and keep `fn terminal_script(command: &str) -> Option<String> { terminal_script_allowing(command, &[]) }`.
   3. In `terminal_command` add two arms before the final `_ => Err(...)`:

```rust
        ("login", Some(host)) => crate::registry::login_command(&find_bin("docker"), &find_bin("aws"), host),
        ("logout", Some(host)) => crate::registry::logout_command(&find_bin("docker"), host),
```
   4. In `open_terminal`, replace `let script = terminal_script(&command).ok_or("That command isn't safe to open")?;` with:

```rust
    // Only a registry sign-in may contain one pipe (the AWS token goes to docker login on its standard input).
    let extra: &[char] = if kind == "login" { &['|'] } else { &[] };
    let script = terminal_script_allowing(&command, extra).ok_or("That command isn't safe to open")?;
```
   5. The `context` check at the top of `terminal_command` (`context_ok`) still applies: sign-in is opened with the selected engine's name, which is checked and then not used in the line. That is intended; do not remove the check.

6. Run `cd src-tauri && cargo test terminal`. Expected: the four new tests pass and the older terminal tests still pass. Then `cargo fmt --check && cargo clippy --all-targets -- -D warnings`.

7. TypeScript side of the rules the Rust code must agree with. In `src/lib/registry.ts`:
   1. In `loginCommand`, before the `ECR_HOST` test, add: `if (h === "docker.io" || h === "index.docker.io") return "docker login";`
   2. Change `ECR_HOST` to `/^\d{12}\.dkr\.ecr\.([a-z0-9-]+)\.amazonaws\.com(\.cn)?$/` (the match group 1 is still the region).
   3. Add and export `logoutCommand(host: string): string | null`: null when `!isRegistryHost(h)`; `"docker logout"` for the two Hub names; else `` `docker logout ${h}` ``.
   4. Add and export `hostOf(ref: string): string`: the first `/`-separated part when it is a registry host by the rule of `isRegistryHost`, else `"docker.io"`. Examples: `hostOf("ghcr.io/acme/api:1")` is `ghcr.io`; `hostOf("postgres:16")` and `hostOf("acme/api")` are `docker.io`; `hostOf("localhost:5000/a")` is `localhost:5000`.
   Tests first in `src/lib/registry.test.ts` (add; do not change existing tests; if an existing test asserted `docker login docker.io`, report it):
   - `Given the Docker Hub name, when building the sign-in line, then it is a bare docker login`
   - `Given a China ECR host, when building the sign-in line, then the region is read and the aws line is returned`
   - `Given a host, when building the sign-out line, then it is docker logout with the host, bare for Docker Hub`
   - `Given image references, when asking for the host, then a registry prefix is returned and everything else is Docker Hub`
   The expected Rust and TypeScript lines match, except that the TypeScript lines use the bare names `docker` and `aws` (the Rust ones use their full paths).

8. Mock. In `preview/mock.ts`, in the `invoke` switch next to `case "open_terminal":`:

```ts
    case "list_registries": return (flag("noregistries") ? [] : flag("registries")
      ? [{ host: "https://index.docker.io/v1/", how: "stored" }, { host: "ghcr.io", how: "stored" }, { host: "123456789012.dkr.ecr.eu-west-1.amazonaws.com", how: "stored" }, { host: "registry.example.com", how: "helper" }]
      : [{ host: "https://index.docker.io/v1/", how: "stored" }]) as T;
    case "ecr_repositories": if (flag("noaws")) throw "The aws command is not installed. Install the AWS command line tool, then try again."; return ["shop/api", "shop/worker"] as T;
```
   The existing `open_terminal` mock already records `{ kind, context, target }` in `window.__terminal`; keep it.

9. Documentation of the surface. Update `docs/security-model.md`: in "Other commands" add rows for `list_registries` (reads one file, `~/.docker/config.json`; "Input it checks": "none; it reads only the key names of `auths` and `credHelpers`, never the values, and never writes the file"), `ecr_repositories` (runs `aws ecr describe-repositories`, read only; "The host must be an AWS registry address; the arguments are fixed") and update the `open_terminal` row ("kind is one of a short list: `k9s`, `shell`, `bash`, `debug`, `image`, `login`, `logout`; the registry address passes the same check as a pull"). Run `node scripts/check-security-model.mjs`. Expected: exit 0.

10. Add the read-only proof to the check scripts: in `scripts/check-security-model.mjs` do not edit. Add `scripts/check-registry-rules.mjs`:
    1. Reads `src-tauri/src/registry.rs` and everything before `#[cfg(test)]`.
    2. `check(src.includes("IgnoredAny"), "registries: values are dropped with IgnoredAny")`.
    3. `check(!/fs::write|File::create|OpenOptions|remove_file|rename\(|set_permissions/.test(src), "registries: the module never writes files")`.
    4. `check(!/password|token|secret/i.test(src.replace(/password-stdin|get-login-password|--password-stdin/g, "")), "registries: no password or token handling in the module")`.
    5. The allowlist still refuses login: read the file that holds `fn docker_args_allowed` and `check(!/"login"|"logout"/.test(allowText), "allowlist: login and logout are still refused")`.
    6. process.exit with the same small `check` helper as `check-supply-chain.mjs` (this script needs no browser).

Done when:
1. `cd src-tauri && cargo test registry` prints `12 passed` and `0 failed`; `cargo test terminal` has the four new tests passing.
2. `node --experimental-strip-types --no-warnings --test src/lib/registry.test.ts` prints `# fail 0`.
3. `node scripts/check-registry-rules.mjs` and `node scripts/check-security-model.mjs` exit 0.
4. `grep -n "\"login\"" ALLOW_FILE` prints nothing.
5. The gate.

Pull request title: `wo-8.15a: list signed-in registries and open Terminal to sign in`

---

## WO-8.15b Registries screen, sources in Pull, sign-in on a denied pull (G10, screen)

Needs: WO-8.15a, WO-8.11, WO-3.3 (Pull sheet), WO-3.9 (Settings).

Why: the backend can list and open sign-in; the person needs the screen (J13). "Done when" of G10: with a registry signed in from Terminal, the app lists it, pulls a private image, and explains an expired sign-in with a working `Sign in`.

Read first:
1. `../08-feature-gaps.md` G10 items 2 to 5.
2. `../04-design-spec.md` sections 7.13, 7.8, 7.10 (item 5), 6.1, 6.9, 6.10, 9.
3. The Settings files (WO-3.9) and the Pull sheet file (Starting state items 1 and 2), and `src/lib/registry.ts`.

Starting state:
1. `grep -rln "docker_pull" src --include=*.tsx --include=*.ts | grep -v "\.test\."` prints the Pull sheet file (and maybe a lib file). Write it down as PULL_FILE.
2. `grep -n "loginCommand\|isAuthError\|PRESETS" PULL_FILE` prints the three uses (login hint, auth failure line, host chips). If it prints fewer, the Pull sheet was rewritten: note where each of the three jobs is now.
3. `grep -rn "registries" src/lib/router.ts` prints the route text including `registries`.
4. `grep -rln "Engines" src --include=*.tsx | grep -i setting` prints the Settings file that lists the sections. Write it down as SETTINGS_FILE.
5. `grep -rn "registries" SETTINGS_FILE` prints nothing (no Registries section yet).
6. `grep -rn "More actions for" src --include=*.tsx | head -2` prints a use of the row menu. This is the shape of `Menu` to copy.
7. `grep -n "list_registries" preview/mock.ts` prints the mock from WO-8.15a.
8. `grep -rn "export const activity\|ran(" src/lib/activity.ts | head -3` prints `activity.ran`.

Decisions (from the plan's author; build exactly this):
1. Settings gets a sixth section, Registries, after Engines. It is a `NavItem` like the other five. There is no mockup picture of Settings, Registries: build it from the parts of `settings-machines` (section list, `List` rows) and spec 7.13. Compare by eye with `settings-machines-light.png` for row height and columns.
2. Spec 7.13 says "Signed in as {user}". The app must not read a user name (it is inside the credential values). The row says `Signed in`.
3. Spec G10 item 3 says the row tells when an AWS sign-in expires. The app cannot read when a sign-in happened. It uses its own record: the time when the person last pressed Sign in on that row from this app (setting `registry-signin:<host>`, milliseconds since 1970 as text).
4. The per-machine "Start when I log in" row is gone from the design (WO-8.12's two General rows are the only login controls). Nothing in this work order touches it.

Words (do not change):
1. Section name in the list: `Registries`.
2. Intro line above the list: `Registries this Mac can sign in to. OpenPier never sees your password: sign-in happens in Terminal.`
3. Row state text: `Signed in`, `Not signed in`, `Managed by a helper`.
4. Row buttons: `Sign in`, `Sign out`. The ⋯ menu title `More actions for {name}`. Menu items: `Sign in again` (hint `Gets a new token`, AWS rows only), `Show the command` (hint `What Terminal will run`), `Copy the command` , separator, `Sign out` (hint `Removes the saved sign-in from this Mac`).
5. Notes: AWS row without record `AWS sign-ins last 12 hours.`; with a record under 12 hours `AWS sign-ins last 12 hours. You signed in from here {ago}.`; 12 hours or more `AWS sign-ins last 12 hours. You signed in from here {ago}, so it has probably expired.`; helper row `A credential helper signs in for you.`
6. Names: `Docker Hub` (docker.io), `GitHub` (ghcr.io), `AWS ECR` (…dkr.ecr…), `AWS public gallery` (public.ecr.aws), `Google Artifact Registry` (…-docker.pkg.dev), any other host shows the host.
7. Add form above the list: field label `Registry address`, placeholder `registry.example.com`, button `Sign in`. Invalid text shows the reason from `checkHost` under the field.
8. Empty (no rows cannot happen: Docker Hub and GitHub always show). Error reading the file: `Banner` bad, title `Could not read Docker's sign-in file`, body the error text, `Try again`.
9. After pressing `Sign in`: a toast `Terminal opened. Sign in there, then come back.`
10. Pull sheet, signed-in sources: caption `Signed in`; one chip per signed-in registry other than Docker Hub, labelled with its name from item 6. A selected AWS ECR registry shows a list captioned `Repositories in {host}` (from `ecr_repositories`); its failure text shows as a muted line under the caption; a click on a name fills the image path.
11. Denied pull: title `You are not signed in to {name}`, body `The registry refused the pull. Sign in, then try again.`, button `Sign in`, and under it the command in `.cmd` with a copy button. For an AWS ECR host add the line `AWS sign-ins last 12 hours.`

Tests to write first: steps 1 and 3.

Steps:

1. Create `src/lib/registries.test.ts`, run it, see it fail (module missing):

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHost, nameOf, registryRows, signInTarget, checkHost, expiryNote } from "./registries.ts";

test("Given the key Docker writes for Docker Hub, when normalised, then it is docker.io", () => {
  assert.equal(normalizeHost("https://index.docker.io/v1/"), "docker.io");
  assert.equal(normalizeHost("index.docker.io"), "docker.io");
  assert.equal(normalizeHost("https://ghcr.io"), "ghcr.io");
  assert.equal(normalizeHost("Registry.Example.com:8443/"), "registry.example.com:8443");
});

test("Given hosts, when named, then known registries get their names", () => {
  assert.equal(nameOf("docker.io"), "Docker Hub");
  assert.equal(nameOf("ghcr.io"), "GitHub");
  assert.equal(nameOf("123456789012.dkr.ecr.eu-west-1.amazonaws.com"), "AWS ECR");
  assert.equal(nameOf("public.ecr.aws"), "AWS public gallery");
  assert.equal(nameOf("europe-west1-docker.pkg.dev"), "Google Artifact Registry");
  assert.equal(nameOf("registry.example.com"), "registry.example.com");
});

const NOW = Date.parse("2026-11-12T12:00:00Z");

test("Given nothing signed in, when rows are built, then Docker Hub and GitHub show as not signed in", () => {
  const rows = registryRows([], {}, NOW);
  assert.deepEqual(rows.map((r) => [r.host, r.state]), [["docker.io", "out"], ["ghcr.io", "out"]]);
});

test("Given entries, when rows are built, then signed in ones keep their state and the rest follow in order", () => {
  const rows = registryRows(
    [{ host: "ghcr.io", how: "stored" }, { host: "https://index.docker.io/v1/", how: "stored" }, { host: "registry.example.com", how: "helper" }, { host: "123456789012.dkr.ecr.eu-west-1.amazonaws.com", how: "stored" }],
    {}, NOW,
  );
  assert.deepEqual(rows.map((r) => [r.host, r.state]), [
    ["docker.io", "in"], ["123456789012.dkr.ecr.eu-west-1.amazonaws.com", "in"], ["ghcr.io", "in"], ["registry.example.com", "helper"],
  ]);
});

test("Given the same registry under two keys, when rows are built, then it shows once", () => {
  const rows = registryRows([{ host: "https://index.docker.io/v1/", how: "stored" }, { host: "index.docker.io", how: "stored" }], {}, NOW);
  assert.equal(rows.filter((r) => r.host === "docker.io").length, 1);
});

test("Given each row, when built, then it carries the command Terminal will run", () => {
  const rows = registryRows([{ host: "123456789012.dkr.ecr.eu-west-1.amazonaws.com", how: "stored" }], {}, NOW);
  const ecr = rows.find((r) => r.host.includes("ecr"))!;
  assert.equal(ecr.signIn, "aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.eu-west-1.amazonaws.com");
  assert.equal(ecr.signOut, "docker logout 123456789012.dkr.ecr.eu-west-1.amazonaws.com");
  assert.equal(rows.find((r) => r.host === "docker.io")!.signIn, "docker login");
});

test("Given an AWS row, when the note is written, then it says when the sign-in lasts until", () => {
  const h = "123456789012.dkr.ecr.eu-west-1.amazonaws.com";
  assert.equal(expiryNote(h, undefined, NOW), "AWS sign-ins last 12 hours.");
  assert.equal(expiryNote(h, NOW - 2 * 36e5, NOW), "AWS sign-ins last 12 hours. You signed in from here 2 hours ago.");
  assert.equal(expiryNote(h, NOW - 14 * 36e5, NOW), "AWS sign-ins last 12 hours. You signed in from here 14 hours ago, so it has probably expired.");
  assert.equal(expiryNote("ghcr.io", NOW, NOW), "");
});

test("Given an AWS host, when the main button is chosen, then it is Sign in, even when signed in", () => {
  const rows = registryRows([{ host: "123456789012.dkr.ecr.eu-west-1.amazonaws.com", how: "stored" }], {}, NOW);
  assert.equal(rows.find((r) => r.host.includes("ecr"))!.main, "Sign in");
  assert.equal(registryRows([{ host: "ghcr.io", how: "stored" }], {}, NOW).find((r) => r.host === "ghcr.io")!.main, "Sign out");
});

test("Given a failed pull, when asking where to sign in, then the host of the image is returned with its name", () => {
  assert.deepEqual(signInTarget("ghcr.io/acme/private:1"), { host: "ghcr.io", name: "GitHub" });
  assert.deepEqual(signInTarget("acme/private"), { host: "docker.io", name: "Docker Hub" });
});

test("Given text typed as a registry address, when checked, then only a bare host passes", () => {
  assert.equal(checkHost("ghcr.io").ok, true);
  assert.equal(checkHost(" registry.example.com:8443 ").ok, true);
  assert.equal(checkHost("").ok, false);
  assert.equal(checkHost("https://ghcr.io").ok, false);
  assert.equal(checkHost("ghcr.io/acme").ok, false);
  assert.equal(checkHost("nodot").ok, false);
});
```

2. Create `src/lib/registries.ts`. Exports and rules (write the bodies so the tests pass; import `loginCommand`, `logoutCommand`, `hostOf` from `./registry.ts`, and `agoText` from `./imageDetail.ts`):
   1. `export type RegistryEntry = { host: string; how: "stored" | "helper" };`
   2. `export type RegistryRow = { host: string; name: string; state: "in" | "helper" | "out"; main: "Sign in" | "Sign out"; signIn: string; signOut: string; note: string; aws: boolean };`
   3. `normalizeHost(key)`: lower-case; remove `https://` or `http://`; remove everything from the first `/`; `index.docker.io` becomes `docker.io`.
   4. `nameOf(host)`: Words 6.
   5. `expiryNote(host, signedAtMs | undefined, nowMs)`: only for private ECR hosts (`.dkr.ecr.`); Words 5; hours as whole numbers with `1 hour ago` singular, using `agoText(new Date(ms).toISOString(), nowMs)`.
   6. `registryRows(entries, signedAt: Record<string, number>, nowMs)`: normalise and dedupe (a `helper` entry wins over `stored`); add `docker.io` and `ghcr.io` as `out` when absent; order: `docker.io` first, then the other signed-in or helper rows by host, then `out` rows by host. `main` is `Sign in` for `out` rows and for AWS rows, else `Sign out`. `signIn` is `loginCommand(host)`; `signOut` is `logoutCommand(host)` (never null for rows built here; fall back to `docker login ${host}`). `note`: the helper line for helper rows, `expiryNote` for ECR rows, else empty. `aws` is true for ECR and public ECR hosts.
   7. `signInTarget(ref)`: `{ host: hostOf(ref), name: nameOf(hostOf(ref)) }`.
   8. `checkHost(text)`: `{ ok: true; host } | { ok: false; reason }`: trim and lower-case; reuse the host rules of `checkRef` (the same reasons for an empty text, a scheme, spaces or a slash; `Docker reads "x" as ...` for a bare word without a dot). Export the reasons from `registry.ts` if that is the clean way (add `checkHostOnly` to `registry.ts` and call it from both).

3. Run `node --experimental-strip-types --no-warnings --test src/lib/registries.test.ts`. Expected: 9 pass, 0 fail.

4. Create `src/lib/useRegistries.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { RegistryEntry } from "./registries";

// Not per engine: the sign-in file belongs to this Mac. Refetches when the window gets focus again,
// which is when the person comes back from Terminal.
export const useRegistries = () =>
  useQuery({ queryKey: ["registries"], queryFn: () => invoke<RegistryEntry[]>("list_registries"), refetchOnWindowFocus: true, refetchInterval: 10_000 });
```
   And `src/lib/signIn.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import { activity } from "./activity";
import { loginCommand, logoutCommand } from "./registry";
import { setSetting } from "./settings";

export const SIGNIN_PREFIX = "registry-signin:";

// Opens Terminal on the sign-in line. The app never handles the password: the person types it there.
export async function openSignIn(ctx: string, host: string): Promise<void> {
  const line = loginCommand(host) ?? `docker login ${host}`;
  await activity.ran("login", line, () => invoke("open_terminal", { kind: "login", context: ctx, target: host }), host);
  setSetting(`${SIGNIN_PREFIX}${host}`, String(Date.now()));
}

export async function openSignOut(ctx: string, host: string): Promise<void> {
  const line = logoutCommand(host) ?? `docker logout ${host}`;
  await activity.ran("logout", line, () => invoke("open_terminal", { kind: "logout", context: ctx, target: host }), host);
}
```
   Check the `activity.ran` signature in `src/lib/activity.ts` and match it exactly (the call in `src/lib/shell.ts` is the model).

5. Create `src/Registries.tsx` (the Settings section). Default export `Registries`. Structure:

```
<div>
  <div className="toolbar"><span className="muted grow">{Words 2}</span></div>
  {error: <Banner tone="bad" title="Could not read Docker's sign-in file" actions={<Button>Try again</Button>}>{error text}</Banner>}
  <form onSubmit={signInOther}>                      // Words 7
    <FormRow label="Registry address" htmlFor="registry-host" hint={reason or undefined}>
      <Fields>
        <Field id="registry-host" size="md" placeholder="registry.example.com" invalid={reason} />   // no width: it fills the row
        <Button variant="primary" type="submit">Sign in</Button>
      </Fields>
    </FormRow>
  </form>
  <List aria-label="Registries">
    <RowHead menuGap><span className="lead"/><span className="name">Registry</span><span className="meta grow">Address</span><span className="col state">State</span><span className="act"/></RowHead>
    for each row of registryRows(...):
    <Row lead={<Dot state={row.state === "out" ? "off" : "ok"} label={Words 3} />} name={row.name} meta={row.host + (row.note ? " · " + row.note : "")}
         action={<Button size="xs">{row.main}</Button>}
         menu={<Menu trigger={<MoreButton name={row.name} />} label={`More actions for ${row.name}`} align="end">items of Words 4; "Sign in again" only when row.aws && row.state !== "out"</Menu>}>
      <Col kind="state">{Words 3}</Col>
    </Row>
  </List>
</div>
```
   Details:
   1. The list follows the Machines list in the Settings, Machines file (WO-3.9): read it and use the same `List`, `RowHead`, `Row` and `Col` usage.
   2. `Sign in` calls `openSignIn(engine.id, row.host)` then shows the toast (Words 9). `Sign out` calls `openSignOut`. `Show the command` opens a `Sheet` (`open`, `onClose`, `title="Command for {name}"`) with the text `Terminal will run:` and `<Command text={row.signIn} />` in its body. `Copy the command` copies `row.signIn` and calls `useToast()({ text: "Copied" })`. `Sign out` is not offered in this item. The toast for `Sign in` is `useToast()({ text: "Terminal opened. Sign in there, then come back." })`. Confirm nothing: `Sign out` only opens Terminal, so it needs no `useConfirm`.  Words for the copy toast: `Copied`.
   3. `signedAt` comes from `getSetting("registry-signin:" + host)` for each row (`Number(...)` or undefined), read with `useSetting` inside a small row component so a new sign-in updates the note.
   4. The add form: `onSubmit` runs `checkHost(text)`; invalid shows the reason as the field's hint with `aria-invalid`; valid calls `openSignIn(engine.id, host)`, clears the field.
   5. Loading: `SkeletonRows` (four) on first load only.

6. Add the section. In SETTINGS_FILE the sections are drawn as `NavItem`s (WO-3.9). Add a sixth one after Engines: `<NavItem href="#/settings/registries" label="Registries" current={section === "registries"} />`, and render `<Registries />` when the route's section is `registries`. Copy exactly how Engines is wired. The nav keeps its order General, Machines, Engines, Registries, Updates, About.

7. Pull sheet (PULL_FILE). Three edits, each by finding the quoted code:
   1. Where `loginCommand(` builds the hint "Private images need you to sign in first" with a copy button: replace the copy button and the `pre.cmd` with a primary-less `Button` `Sign in` that calls `openSignIn(engine.id, host.trim())` (disabled while `host` fails `checkHost`), and show the command with `<Command text={...} />` (rule 7 of AGENTS.md: it says what it will run). Delete the copy-only path. Reason: AGENTS.md rule 4, "Run it, don't make people copy it".
   2. Where `authHint` renders the line "Sign in to {host} first": replace its contents with Words 11: title, body, `Sign in` button (primary xs, as problem lines do), the command as `<Command text={...} />` (it has its own copy button), and the AWS line for ECR hosts. Build the block as `<Banner tone="warn" title="You are not signed in to {name}" actions={<Button size="xs" variant="primary">Sign in</Button>}>` with the body text and the `Command` as children. The host and name come from `signInTarget(target)`; show the block for Docker Hub pulls as well when `isAuthError(failure)` (today it only shows in the other-registry mode: remove that condition, keep `isAuthError`).
   3. Where `PRESETS.map` renders the host chips: above them add the `Signed in` caption and one chip per signed-in registry from `useRegistries()` (hosts normalised, Docker Hub excluded, name from `nameOf`). A chip click fills the host exactly as a preset chip does. When the filled host is an ECR host, run `useQuery({ queryKey: ["ecr-repos", host], queryFn: () => invoke<string[]>("ecr_repositories", { host }), enabled: isEcr(host), retry: false })` and render Words 10. A click on a name sets the image path (the field the path chip uses).
   Do not change anything else in the sheet.

8. Browser check `scripts/check-registries.mjs`:
   1. `const page = await open("/?scenario=design&registries=1#/settings/registries")`.
   2. `check(heading or nav item "Registries" is current, "registries: the section opens from the route")`.
   3. `check(rows named Docker Hub, GitHub, AWS ECR and registry.example.com exist, ...)` (names from Words 6, rows by `[role=row]` text).
   4. `check(the AWS ECR row text contains "AWS sign-ins last 12 hours.", "registries: an AWS row says how long a sign-in lasts")`.
   5. `check(the registry.example.com row text contains "Managed by a helper")`.
   6. Click `Sign out` on the GitHub row. `check(window.__terminal has an entry with kind "logout" and target "ghcr.io", "registries: Sign out opens Terminal on docker logout")`.
   7. Click `Sign in` on the AWS ECR row. `check(__terminal has kind "login" and target "123456789012.dkr.ecr.eu-west-1.amazonaws.com")`; `check(the AWS row note now contains "You signed in from here", "registries: the row remembers when you signed in")`; `check(a toast with "Terminal opened. Sign in there, then come back." is visible)`.
   8. Type `https://ghcr.io` in `Registry address`, press Enter: `check(the reason text is visible and no new __terminal entry)`. Type `registry.example.org`, press Enter: `check(__terminal has target "registry.example.org")`.
   9. `check(window.__calls does not contain "docker" calls with args ["login"...], "registries: the app never asks the backend to run docker login")`: read `window.__calls` (names only) and assert it never contains `"docker_login"`; also assert no `invoke("docker", ...)` was called with `args[0] === "login"` by wrapping: `page.addInitScript` is not needed, the mock records names only, so assert on the `open_terminal` entries only.
   10. Pull sheet: `open("/?scenario=design&registries=1#/images")`, open Pull with the button `Pull`, switch to `Other registry`, `check(the caption "Signed in" and chips "GitHub" and "AWS ECR" exist)`; click the `AWS ECR` chip, `check(text "shop/api" visible and "Repositories in 123456789012.dkr.ecr.eu-west-1.amazonaws.com" visible)`; click `shop/api`, `check(the Image path field value is "shop/api")`.
   11. `/?scenario=design&registries=1&noaws=1`: same steps, `check(the line "The aws command is not installed." is visible)`.
   12. Denied pull: with the image `ghcr.io/acme/private:1` typed in the Other registry fields (host `ghcr.io`, path `acme/private`, tag `1`), click Pull. `check(text "You are not signed in to GitHub" visible, "pull: a denied pull says you are not signed in")`; click the `Sign in` button in that block and `check(__terminal has kind "login" and target "ghcr.io", "pull: the Sign in button opens Terminal")`.
   13. `await done()`.

9. Component test `src/Registries.test.tsx` (vitest):
   1. `given registries in the config when the section opens then each shows its name and state`.
   2. `given Sign in on a row when clicked then Terminal is asked to open with the login kind and the host`.
   3. `given an address with a scheme when submitted then no Terminal opens and the reason shows`.
   4. `given the file cannot be read when the section opens then the bad banner shows with Try again`.

10. `scripts/not-migrated.json` must not grow. If `PULL_FILE` or `SETTINGS_FILE` are in it (they should not be after iteration 3), say so and do not change the list.

Done when:
1. `node --experimental-strip-types --no-warnings --test src/lib/registries.test.ts` prints `# pass 9`, `# fail 0`.
2. `npx vitest run src/Registries.test.tsx` prints `4 passed`.
3. `check-registries.mjs` prints only `ok` in Chromium and WebKit (inside `npm run check`).
4. `grep -rn "navigator.clipboard.writeText(login" src | grep -v "\.test\."` prints at most the copy buttons next to a `Command` (a copy button is fine; a copy as the only way to sign in is not).
5. `node scripts/check-registry-rules.mjs` exits 0.
6. The gate.
7. By eye (no mockup picture exists): Settings, Registries next to `../design/shots/settings-machines-light.png`: same section list, same row height and column alignment, state text right aligned, one quiet button per row, no tinted rows, no new colours.

Pull request title: `wo-8.15b: see your registries, sign in through Terminal, pull from private ones`

---

## WO-8.13 Keyboard and VoiceOver pass, the gate before launch (G16)

Needs: every screen work order of iterations 2 to 5 and WO-8.12, 8.14b and 8.15b of this file.

Why: rule 8 of `AGENTS.md` asks for keyboard and VoiceOver. G16 makes it an exit check: one pass through every screen with the keyboard only, and one with VoiceOver, with the problems fixed or listed. This work order adds the automated keyboard part and the written checklist. The VoiceOver pass is done by a person (the owner); an agent cannot run VoiceOver.

Read first:
1. `../08-feature-gaps.md` G16.
2. `../04-design-spec.md` sections 6.5 (rule 8), 6.7, 10, 11.
3. `../../../AGENTS.md` rule 8.
4. `scripts/lib/check.mjs`, and the check scripts of WO-2.4 (the shortcut walk) as a model.

Starting state:
1. `ls scripts/check-keyboard.mjs docs/accessibility-pass.md` prints "No such file" twice.
2. `grep -n "go(\|#/" src/lib/router.ts | head -20` prints the route list. Write the routes that exist. The route list in Step 2 below must match them; remove from the script the ones that do not exist at your start and say which.
3. `ls scripts/checks-pending 2>/dev/null` prints nothing or an empty folder (it must be empty after iteration 3). If it holds files, stop and report.
4. `grep -c "focus-visible" src/ui/container-ui.css` prints a number above 0 (the focus ring is in the stylesheet).

Do not touch: `container-ui.css` and its copy. If a fix needs a style change, stop at that fix and report it as "needs a CSS change first" (spec section 0, rule 1).

Tests to write first: `scripts/check-keyboard.mjs` itself (step 1). Run it. It will probably fail: those failures are the work.

Steps:

1. Create `scripts/check-keyboard.mjs` with this content:

```js
// Keyboard-only walk through every page, in Chromium and WebKit. Fails when a page has a control that:
// has no name, shows no focus ring, is hidden but focusable, or traps the keyboard; or when a sheet does not
// trap focus, close on Escape and give focus back.
import { open, check, done } from "./lib/check.mjs";

const PAGES = [
  ["containers", "/?scenario=design#/containers"],
  ["images", "/?scenario=design#/images"],
  ["image detail", "/?scenario=design#/images/efec2006ec41/layers"],
  ["volumes", "/?scenario=design#/volumes"],
  ["networks", "/?scenario=design#/networks"],
  ["kubernetes", "/?scenario=design#/kubernetes"],
  ["projects", "/?scenario=design#/projects"],
  ["doctor", "/?scenario=design#/doctor"],
  ["settings general", "/?scenario=design#/settings/general"],
  ["settings machines", "/?scenario=design#/settings/machines"],
  ["settings engines", "/?scenario=design#/settings/engines"],
  ["settings registries", "/?scenario=design&registries=1#/settings/registries"],
  ["settings updates", "/?scenario=design#/settings/updates"],
  ["settings about", "/?scenario=design#/settings/about"],
];

const MAX_STOPS = 120;

async function walk(page) {
  const stops = [];
  for (let i = 0; i < MAX_STOPS; i++) {
    await page.keyboard.press("Tab");
    const s = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { body: true };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const labelled = el.getAttribute("aria-labelledby");
      const name = (el.getAttribute("aria-label") || (labelled && labelled.split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ")) || el.textContent || el.getAttribute("title") || el.getAttribute("placeholder") || "").trim();
      const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none";
      return { body: false, tag: el.tagName, name, ring, visible: r.width > 0 && r.height > 0 && cs.visibility !== "hidden", key: `${el.tagName}|${name}|${Math.round(r.x)}|${Math.round(r.y)}` };
    });
    if (s.body) { stops.push(s); break; }
    if (stops.some((x) => x.key === s.key)) { stops.push({ ...s, again: true }); break; }
    stops.push(s);
  }
  return stops;
}

for (const [label, path] of PAGES) {
  const page = await open(path);
  await page.waitForSelector(".content", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  const stops = (await walk(page)).filter((s) => !s.body && !s.again);
  const last = (await walk(page)).slice(-1)[0];
  check(stops.length >= 3, `${label}: the keyboard reaches at least 3 controls (${stops.length})`);
  const unnamed = stops.filter((s) => !s.name);
  check(unnamed.length === 0, `${label}: every control the keyboard reaches has a name${unnamed.length ? " (" + unnamed.map((s) => s.tag).join(", ") + ")" : ""}`);
  const noRing = stops.filter((s) => !s.ring);
  check(noRing.length === 0, `${label}: every control shows a focus ring${noRing.length ? " (" + noRing.slice(0, 3).map((s) => s.name).join(", ") + ")" : ""}`);
  check(stops.every((s) => s.visible), `${label}: the keyboard never lands on something you cannot see`);
  check(Boolean(last) && (last.body || last.again), `${label}: Tab comes back to the start, no keyboard trap`);
  const odd = await page.evaluate(() => document.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])').length);
  check(odd === 0, `${label}: no tabindex above 0`);
  const landmarks = await page.evaluate(() => ({ main: document.querySelectorAll("main, [role=main]").length, nav: [...document.querySelectorAll("nav")].every((n) => n.getAttribute("aria-label") || n.getAttribute("aria-labelledby")) }));
  check(landmarks.main === 1, `${label}: exactly one main landmark`);
  check(landmarks.nav, `${label}: every nav has a name`);
  const tables = await page.evaluate(() => [...document.querySelectorAll('[role="table"]')].filter((t) => !t.getAttribute("aria-label") && !t.getAttribute("aria-labelledby")).length);
  check(tables === 0, `${label}: every list that is a table has a name`);
  await page.close?.();
}

// A sheet by keyboard: opens, holds focus, closes on Escape, gives focus back.
{
  const page = await open("/?scenario=design#/images");
  await page.waitForSelector(".content");
  await page.keyboard.press("Meta+p");
  const sheet = page.locator(".sheet");
  await sheet.waitFor({ timeout: 4000 }).catch(() => {});
  check((await sheet.count()) === 1, "pull sheet: Cmd+P opens it");
  check(await page.evaluate(() => !!document.activeElement?.closest(".sheet")), "pull sheet: focus moves inside on open");
  let escaped = false;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if (!(await page.evaluate(() => !!document.activeElement?.closest(".sheet")))) { escaped = true; break; }
  }
  check(!escaped, "pull sheet: Tab never leaves it");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check((await page.locator(".sheet").count()) === 0, "pull sheet: Escape closes it");
  check(await page.evaluate(() => document.activeElement !== document.body && !document.activeElement?.closest(".sheet")), "pull sheet: focus goes back to a control, not to the page");
}

// A live region exists for finished actions.
{
  const page = await open("/?scenario=design#/containers");
  await page.waitForSelector(".content");
  check((await page.locator('[role="status"], [aria-live]').count()) >= 1, "containers: a live region announces finished actions");
}

await done();
```
   If `open` returns `{ page }`, adapt every `await open(...)` line (not the logic) and say so. If `Meta+p` does not open the sheet because the shortcut is bound differently at your start (read the shortcuts table in WO-2.4's work), use the real key.

2. Run `npm run preview` in one terminal, then `PW_ENGINE=webkit node scripts/check-keyboard.mjs`. Paste the FAIL lines in the pull request (the "before" list). Do the same with Chromium.

3. Fix every FAIL, one pull request commit per kind of failure, with the smallest change:
   1. Unnamed control: add `aria-label` (visible words first, rule 8) in the component that renders it; for an icon button the label is its tooltip text.
   2. No focus ring: the cause is almost always `outline: none` in a component or a `style=`; remove it so the stylesheet's `:focus-visible` rule applies. If the stylesheet itself lacks the ring for that class, stop and report ("needs a CSS change first").
   3. Hidden but focusable: add `tabIndex={-1}` or `hidden` to the element, or unmount it when closed.
   4. Trap or no way back: fix the focus trap in the component that holds it (Radix gives one for free: use `Sheet`, `ConfirmDialog` and `Menu` from `src/ui`, never a hand-made overlay).
   5. Table without a name, nav without a name: add `aria-label`.
   Fixes must not change visible words or layout. Write each fix as one line in the pull request: file, what.

4. When a failure cannot be fixed within this work order (it needs a CSS change, a design decision or a big rewrite), add one line to `docs/accessibility-pass.md` under "Problems found and not fixed" (step 5) with the page, what is wrong and why it was left, and make the check pass by listing it in an `ACCEPTED` array at the top of `scripts/check-keyboard.mjs`: `const ACCEPTED = []; // entries: "<page label>: <message prefix>"` and skip a FAIL whose message starts with an entry. Each entry needs its line in the checklist, and the script prints `ok (accepted: ...)` for it, so it is never silent.

5. Create `docs/accessibility-pass.md` with exactly this content:

````markdown
# Keyboard and VoiceOver pass

The gate before the first release (G16 in `docs/plan/08-feature-gaps.md`). Two passes over every screen: one with the keyboard only, one with VoiceOver. Problems are fixed or listed below.

Run `node scripts/check-a11y-pass.mjs --final` before launch. It fails while any cell below says `pending`.

## How to do the keyboard pass (no mouse, no trackpad)

1. Put the mouse away. Open OpenPier.
2. On each screen below: press Tab from the top. Every control must take focus in the order you read the page, and show a blue ring.
3. Use the arrow keys in lists, Enter to open a row, Space to select it, Esc to go back or close.
4. Open every sheet and dialog from the keyboard. Focus must move into it and stay in it. Esc closes it and focus goes back to the button that opened it.
5. Do one task from start to end by keyboard only: run an image, then stop it, then remove it.
6. Write `ok` in the cell, or the problem in one line.

## How to do the VoiceOver pass

1. Turn VoiceOver on with Cmd+F5. Open OpenPier. Move with Control+Option+Right and Left (VO keys), press Control+Option+Space to press a control.
2. On each screen: listen to the title, then the first three rows. A row must read like "kafka, apache/kafka:3.8, Running, Stop button". A button must say what it does ("More actions for kafka"), never "button" alone.
3. Open a sheet. VoiceOver must say the sheet's title, and must not read the page behind it.
4. Do an action (Stop a container). VoiceOver must say the result without you looking ("Stopped kafka").
5. Colour must never be the only signal: a red dot always has a word next to it.
6. Write `ok` in the cell, or the problem in one line. Turn VoiceOver off with Cmd+F5.

## Results

Date of the pass: pending

| Screen | Automated keyboard check | Keyboard by hand | VoiceOver | Problems found |
|---|---|---|---|---|
| Containers | pending | pending | pending | pending |
| Container detail | pending | pending | pending | pending |
| Images | pending | pending | pending | pending |
| Image detail | pending | pending | pending | pending |
| Volumes | pending | pending | pending | pending |
| Networks | pending | pending | pending | pending |
| Kubernetes | pending | pending | pending | pending |
| Projects | pending | pending | pending | pending |
| Project detail | pending | pending | pending | pending |
| Doctor | pending | pending | pending | pending |
| Settings, General | pending | pending | pending | pending |
| Settings, Machines | pending | pending | pending | pending |
| Settings, Engines | pending | pending | pending | pending |
| Settings, Registries | pending | pending | pending | pending |
| Settings, Updates | pending | pending | pending | pending |
| Settings, About | pending | pending | pending | pending |
| Setup | pending | pending | pending | pending |
| Run sheet | pending | pending | pending | pending |
| Pull sheet | pending | pending | pending | pending |
| Command palette | pending | pending | pending | pending |
| Help | pending | pending | pending | pending |
| Activity | pending | pending | pending | pending |

## Problems found and not fixed

None yet.
````
   Then fill the column `Automated keyboard check` for each screen that `check-keyboard.mjs` covers with `ok` (only after the script passes), and the `Date of the pass` line is left `pending` for the owner. Do not write `ok` in any other column.

6. Create `scripts/check-a11y-pass.mjs`:

```js
// Reads docs/accessibility-pass.md. Without --final: the table must exist and name every screen.
// With --final: no cell may say "pending" (the owner has done both passes).
import { readFileSync } from "node:fs";

const final = process.argv.includes("--final");
let failed = 0;
const check = (cond, message) => {
  console.log(cond ? "ok" : "FAIL", message);
  if (!cond) failed++;
};

const text = readFileSync("docs/accessibility-pass.md", "utf8");
const rows = text.split("\n").filter((l) => l.startsWith("|") && !/^\|[-| ]+\|$/.test(l)).slice(1);
const SCREENS = ["Containers", "Container detail", "Images", "Image detail", "Volumes", "Networks", "Kubernetes", "Projects", "Project detail", "Doctor", "Settings, General", "Settings, Machines", "Settings, Engines", "Settings, Registries", "Settings, Updates", "Settings, About", "Setup", "Run sheet", "Pull sheet", "Command palette", "Help", "Activity"];
for (const s of SCREENS) check(rows.some((r) => r.split("|")[1].trim() === s), `checklist has a row for ${s}`);
check(rows.every((r) => r.split("|").length === 7), "every row has five cells");
if (final) {
  check(!/Date of the pass: pending/.test(text), "the pass has a date");
  for (const r of rows) {
    const cells = r.split("|").slice(1, -1).map((c) => c.trim());
    check(!cells.slice(1).includes("pending"), `${cells[0]}: no cell is pending`);
  }
}
process.exit(failed ? 1 : 0);
```
   Note: its name is `check-a11y-pass.mjs`, so `check-all.sh` runs it without `--final` in both engines. Run `node scripts/check-a11y-pass.mjs`. Expected: exit 0. Run `node scripts/check-a11y-pass.mjs --final`. Expected: exit 1 (the owner has not done the passes yet). Paste both results in the pull request. The second one failing is correct.

7. Check that the old `check-a11y.mjs` (brought back by WO-3.11) still passes: it is part of `npm run check`.

Done when:
1. `check-keyboard.mjs` prints only `ok` lines (accepted entries print `ok (accepted: ...)`) in Chromium and WebKit; each accepted entry has a line under "Problems found and not fixed".
2. `node scripts/check-a11y-pass.mjs` exits 0 and `node scripts/check-a11y-pass.mjs --final` exits 1.
3. `grep -c "pending" docs/accessibility-pass.md` prints a number above 0: the owner's cells are not filled by the agent.
4. The gate.
5. Handoff line for the launch checklist (iteration 7): "Before launch the owner does the two passes by hand and `node scripts/check-a11y-pass.mjs --final` passes."

Pull request title: `wo-8.13: keyboard walk for every screen and the VoiceOver checklist`

---

## Words in this file

These words are part of the design (spec section 9, first paragraph). They are also quoted in the work order that uses them.

1. Settings, General (WO-8.12): `Start OpenPier at login`, `It opens in the menu bar, without a window.`, `Start the selected machine with it`, `Starts {name} when OpenPier opens at login.`, `Could not change the login item.`
2. Image detail (WO-8.14b): the "Words" list of that work order, items 1 to 10.
3. Registries (WO-8.15b): the "Words" list of that work order, items 1 to 11.
