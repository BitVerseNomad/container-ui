# Packaging & Hardening (W11 + W12) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build unsigned `.dmg` for Apple Silicon, publish to GitHub Releases via `tauri-action`, configure Tauri updater (stable channel), create Homebrew tap cask, validate CSP strict on real Mac.

**Architecture:** Tauri 2 built-in bundler → GitHub Actions `macos-14` (arm64) → upload `.dmg` + `latest.json` → Homebrew cask points to release asset. No code signing/notarization (no Apple Developer Program). CSP strict already in `tauri.conf.json` — validate on real machine.

**Tech Stack:** Tauri 2, Rust 1.99.1, Node 22.6+, Vite 5.4, GitHub Actions, Homebrew.

**Spec:** `docs/superpowers/specs/2026-11-04-packaging-hardening-design.md`

---

## Global Constraints

- **Version:** `0.1.0` in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` (all 3 identical)
- **Target:** `aarch64-apple-darwin` only (Apple Silicon)
- **No signing/notarization:** `tauri.conf.json` → `bundle.macos.signingIdentity` = `""` (empty)
- **Entitlements:** `src-tauri/entitlements.plist` required for WebKit JIT (`allow-jit`, `allow-unsigned-executable-memory`)
- **Updater channel:** `stable` (filter pré-releases in `latest.json`)
- **Homebrew tap:** `filipesousaduty/homebrew-colima-ui` (cask `colima-ui`, depends_on: `colima`, `docker`)
- **Icon:** Generate placeholder sage/green 1024×1024 PNG
- **CSP:** Validate on real Mac — zero `Refused to load script/style` in console

---

## Review Focus (5 failure modes)

| # | Input/Condition | Expected Behavior | Owner Task |
|---|-----------------|-------------------|------------|
| 1 | CSP strict no build release | App carrega sem erros CSP; zero `Refused to load` | Task 7 |
| 2 | Build release sem assinatura | `.dmg` abre com "Open Anyway" uma vez; depois roda normal | Task 5 |
| 3 | Auto-update stable channel | App v0.1.0 vê v0.2.0 (stable) mas ignora v0.2.1-beta | Task 6 |
| 4 | Homebrew cask install | `brew install --cask colima-ui` → app em `/Applications`; roda | Task 8 |
| 5 | Entitlements + Hardened Runtime | `docker`, `colima`, `kubectl`, `brew` subprocesses funcionam | Task 4 |

---

## File Map

| File | Responsibility |
|------|----------------|
| `package.json` | Version, scripts, Tauri config ref |
| `src-tauri/tauri.conf.json` | Bundle, updater, CSP, allowlist, target |
| `src-tauri/Cargo.toml` | Version, dependencies, bundle metadata |
| `src-tauri/entitlements.plist` | Hardened Runtime exceptions (WebKit JIT) |
| `src-tauri/icons/icon.png` | 1024×1024 placeholder (generated) |
| `.github/workflows/release.yml` | CI: build → upload assets → generate `latest.json` |
| `homebrew-colima-ui/Formula/colima-ui.rb` | Cask template (separate repo) |
| `scripts/validate-csp.mjs` | Smoke test CSP on real Mac (manual) |

---

## Tasks

### Task 1: Version Bump & Config Sync

**Files:**
- Modify: `package.json:version`
- Modify: `src-tauri/tauri.conf.json:version`
- Modify: `src-tauri/Cargo.toml:version`
- Test: `scripts/check-version-sync.mjs` (new)

**Interfaces:**
- Produces: `version = "0.1.0"` consistent across 3 files

- [ ] **Step 1: Write failing test** — `scripts/check-version-sync.mjs` asserts all 3 files have same version
- [ ] **Step 2: Run test** → FAIL (versions differ)
- [ ] **Step 3: Set all 3 to `0.1.0`**
- [ ] **Step 4: Run test** → PASS
- [ ] **Step 5: Commit** — `chore: bump version to 0.1.0`

---

### Task 2: Generate App Icon Placeholder

**Files:**
- Create: `src-tauri/icons/icon.png` (1024×1024 PNG, sage/green)
- Create: `scripts/generate-icon.mjs` (uses `sharp` or `canvas`)
- Test: `scripts/check-icon.mjs` (new)

**Interfaces:**
- Produces: `src-tauri/icons/icon.png` valid PNG, 1024×1024, sage theme

- [ ] **Step 1: Write failing test** — `scripts/check-icon.mjs` checks file exists, dimensions, not empty
- [ ] **Step 2: Run test** → FAIL (file missing)
- [ ] **Step 3: Implement `generate-icon.mjs`** — draws rounded rect sage background + white Docker whale silhouette (SVG → PNG via `sharp`)
- [ ] **Step 4: Run `node scripts/generate-icon.mjs`** → creates icon
- [ ] **Step 5: Run test** → PASS
- [ ] **Step 6: Commit** — `chore: add app icon placeholder`

---

### Task 3: Entitlements for Hardened Runtime (WebKit JIT)

**Files:**
- Create: `src-tauri/entitlements.plist`
- Modify: `src-tauri/tauri.conf.json:bundle.macos.entitlements`
- Test: `scripts/check-entitlements.mjs` (new)

**Interfaces:**
- Consumes: Tauri 2 bundle config
- Produces: `entitlements.plist` with `allow-jit`, `allow-unsigned-executable-memory`, `network.client`, `files.user-selected.read-write`

- [ ] **Step 1: Write failing test** — `scripts/check-entitlements.mjs` parses plist, asserts 4 keys present + true
- [ ] **Step 2: Run test** → FAIL (file missing)
- [ ] **Step 3: Create `entitlements.plist`** with exact XML from spec
- [ ] **Step 4: Update `tauri.conf.json`** → `bundle.macos.entitlements = "entitlements.plist"`
- [ ] **Step 5: Run test** → PASS
- [ ] **Step 6: Commit** — `feat: add entitlements for WebKit JIT`

---

### Task 4: Tauri Config for Unsigned Build + Updater (Stable)

**Files:**
- Modify: `src-tauri/tauri.conf.json` (bundle, updater, csp, target)
- Test: `scripts/check-tauri-config.mjs` (new)

**Interfaces:**
- Consumes: version from Task 1, entitlements from Task 3, icon from Task 2
- Produces: Valid `tauri.conf.json` for unsigned arm64 build + stable updater

- [ ] **Step 1: Write failing test** — `scripts/check-tauri-config.mjs` asserts:
  - `bundle.macos.signingIdentity == ""`
  - `bundle.macos.entitlements == "entitlements.plist"`
  - `bundle.targets == ["dmg"]`
  - `bundle.macos.providerShortName` absent or empty
  - `plugins.updater.endpoints[0]` contains `stable` filter logic
  - `csp` (release) strict, `devCsp` permissive
  - `tauri.target = "aarch64-apple-darwin"`
- [ ] **Step 2: Run test** → FAIL (config incomplete)
- [ ] **Step 3: Update `tauri.conf.json`** with all keys above
- [ ] **Step 4: Run test** → PASS
- [ ] **Step 5: Commit** — `feat: configure unsigned build + stable updater`

---

### Task 5: GitHub Actions Release Workflow

**Files:**
- Create: `.github/workflows/release.yml`
- Test: `scripts/check-workflow.mjs` (new) — validates YAML syntax, required steps

**Interfaces:**
- Consumes: `tauri.conf.json` config, version from Task 1
- Produces: Workflow that on tag `v*` → builds `.dmg` → uploads assets → generates `latest.json` for updater

- [ ] **Step 1: Write failing test** — `scripts/check-workflow.mjs` checks:
  - Trigger: `push: tags: ["v*"]`
  - Runner: `macos-14`
  - Steps: checkout, setup node/rust, `npm ci`, `npm run tauri build -- --target aarch64-apple-darwin`
  - Upload: `.dmg`, `.app.tar.gz`, `latest.json` to release
  - `latest.json` includes `"version"`, `"notes"`, `"pub_date"`, `"platforms"` with `aarch64-apple-darwin` → `{ "signature": "", "url": "..." }`
- [ ] **Step 2: Run test** → FAIL (workflow missing)
- [ ] **Step 3: Create `release.yml`** using `tauri-action/tauri-action@v0` (no sign/notarize args)
- [ ] **Step 4: Run test** → PASS
- [ ] **Step 5: Commit** — `ci: add release workflow for unsigned dmg`

---

### Task 6: Tauri Updater Plugin Config (Stable Channel)

**Files:**
- Modify: `src-tauri/tauri.conf.json:plugins.updater` (already in Task 4, but verify)
- Create: `src/lib/updater.ts` (logic to check stable-only)
- Create: `src/lib/updater.test.ts`
- Test: `npm test -- src/lib/updater.test.ts`

**Interfaces:**
- Consumes: `latest.json` from GitHub Releases
- Produces: `checkUpdate()` → `Update | null` (ignores pré-releases: versions with `-beta`, `-rc`, `-alpha`)

- [ ] **Step 1: Write failing test** — `updater.test.ts`:
  - `checkUpdate({ version: "0.2.0", platforms: {...} })` → returns update
  - `checkUpdate({ version: "0.2.1-beta", platforms: {...} })` → returns null
  - `checkUpdate({ version: "0.2.1-rc.1", platforms: {...} })` → returns null
- [ ] **Step 2: Run test** → FAIL
- [ ] **Step 3: Implement `updater.ts`** — semver parse, filter `-beta|-rc|-alpha`
- [ ] **Step 4: Run test** → PASS
- [ ] **Step 5: Commit** — `feat: updater stable channel filter`

---

### Task 7: CSP Validation Script (Manual Real-Mac)

**Files:**
- Create: `scripts/validate-csp.mjs`
- Test: Manual only (requires real Mac)

**Interfaces:**
- Consumes: Built `.app` from `npm run tauri build`
- Produces: Console output — PASS/FAIL with list of CSP violations

- [ ] **Step 1: Create `validate-csp.mjs`** — launches built app via `open -a`, attaches DevTools via `osascript` or logs CSP errors from `WKWebView` console (Tauri logs to stdout)
- [ ] **Step 2: Document usage** in `README.md` → "Validate CSP: `npm run tauri build && node scripts/validate-csp.mjs`"
- [ ] **Step 3: Commit** — `chore: add CSP validation script`

---

### Task 8: Homebrew Tap Cask Template

**Files:**
- Create: `homebrew-colima-ui/Formula/colima-ui.rb` (template, commit to separate repo later)
- Test: `scripts/check-cask.rb` (syntax check)

**Interfaces:**
- Consumes: Release `.dmg` URL pattern, version, sha256
- Produces: Valid cask file

- [ ] **Step 1: Create cask template** with:
  - `url "https://github.com/filipesousaduty/colima-ui/releases/download/v#{version}/colima-ui_#{version}_aarch64.dmg"`
  - `sha256` placeholder (filled on release)
  - `depends_on formula: ["colima", "docker"]`
  - `auto_updates true`
- [ ] **Step 2: Syntax check** — `ruby -c Formula/colima-ui.rb`
- [ ] **Step 3: Commit** — `chore: add Homebrew cask template`

---

### Task 9: End-to-End Build & Smoke Test (Integration)

**Files:**
- No new files — runs all above
- Test: `npm run tauri build` (local), then manual smoke

**Interfaces:**
- Consumes: All Tasks 1–8
- Produces: Working `.dmg` that installs, runs, passes CSP, updater checks stable

- [ ] **Step 1: Run `npm run tauri build`** — verify `.dmg` created in `src-tauri/target/release/bundle/dmg/`
- [ ] **Step 2: Install `.dmg`** — drag to `/Applications`, open → "Open Anyway" → app loads
- [ ] **Step 3: Run CSP validation** — `node scripts/validate-csp.mjs` → zero violations
- [ ] **Step 4: Test updater** — simulate `latest.json` with stable + beta → verify only stable triggers
- [ ] **Step 5: Test subprocesses** — start/stop VM, pull image, run container, Doctor checks
- [ ] **Step 6: Tag & push** — `git tag v0.1.0 && git push origin v0.1.0` → verify GitHub Action publishes release
- [ ] **Step 7: Commit** — `release: v0.1.0`

---

## SME Review Gates (after each task)

| Task | Engineering Review | PM Review | UX/UI Review |
|------|-------------------|-----------|--------------|
| 1 (Version) | ✅ Version sync correct | ✅ Versioning strategy | — |
| 2 (Icon) | ✅ PNG valid, dimensions | ✅ Brand consistency | ✅ Visual quality, sage theme |
| 3 (Entitlements) | ✅ Hardened Runtime correct | — | — |
| 4 (Tauri Config) | ✅ Config complete, secure | ✅ Release readiness | — |
| 5 (Workflow) | ✅ CI correct, artifacts | ✅ Automation complete | — |
| 6 (Updater) | ✅ Semver filter correct | ✅ Channel strategy | — |
| 7 (CSP) | ✅ Validation works | — | ✅ No broken UI |
| 8 (Cask) | ✅ Formula valid | ✅ Distribution ready | — |
| 9 (E2E) | ✅ All works on real Mac | ✅ v0.1.0 shippable | ✅ Polish check |

---

## Execution Order

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9
```

Each task: **dev → SME reviews (eng, pm, ux/ui) → commit** before next task.

---

## Self-Review Checklist

- [x] Spec coverage: All W11+W12 requirements mapped to tasks
- [x] Step granularity: Each step = one checkable action
- [x] Type consistency: Version string, paths, config keys match across tasks
- [x] Review Focus: 5 failure modes pinned to owning tasks
- [x] Proportion: Plan ~200 lines vs spec ~150 lines (appropriate)