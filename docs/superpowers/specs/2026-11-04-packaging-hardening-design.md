# Packaging & Hardening — Design Doc (W11 + W12)

> **Status:** Draft for approval  
> **Branch:** `integration` (default)  
> **Goal:** Distribuir Colima UI via GitHub Releases + Homebrew tap, assinado e notarizado pela Apple, com CSP strict no build release.

---

## 1. Intent & Why

O app funciona bem no `integration`. Para distribuir a utilizadores reais:
- **App Bundle (.app + .dmg)** assinado com Developer ID Application
- **Notarização Apple** (stapler) → "Open Anyway" desaparece, Gatekeeper aceita
- **GitHub Releases** automáticos via `tauri-action` em runner Apple Silicon
- **Homebrew tap/cask** próprio → `brew install --cask colima-ui`
- **Auto-update** via Tauri updater plugin (verifica releases no GitHub)
- **CSP strict** no build release (já configurado; validar que carrega)

---

## 2. Goals / Non-Goals / Anti-Goals

| Goals | Non-Goals | Anti-Goals |
|-------|-----------|------------|
| Build `.dmg` universal (arm64) assinado + notarizado | Build x86_64 (só Apple Silicon) | Distribuir fora do GitHub/Homebrew (ex: Mac App Store) |
| Homebrew tap próprio com cask `colima-ui` | Atualizações via Sparkle (Tauri updater nativo) | Assinatura ad-hoc (não passa Gatekeeper) |
| Auto-update nativo Tauri (verifica GitHub Releases) | Delta updates (Tauri não suporta nativamente) | Requer Apple Developer *Program* (não gratuito) |
| CSP strict validado em machine real | Hardened Runtime entitlements customizadas além do padrão Tauri | — |

---

## 3. Constraints (from SPEC.md + AGENTS.md)

- **Stack:** Tauri 2, Rust 1.99.1, Node 22.6+, Vite 5.4
- **Runner CI:** GitHub Actions `macos-14` (Apple Silicon M1/M2)
- **Apple Developer Program:** obrigatório (99 USD/ano) — *owner tem?*
- **Entitlements:** Tauri gera padrão; adicionar `com.apple.security.cs.allow-jit` se needed para WebKit JIT
- **CSP:** `tauri.conf.json` já tem `csp` (release) e `devCsp` (dev) — não alterar sem testar
- **Allowlist:** `tauri.conf.json` → `allowlist` já restrito (só comandos permitidos)
- **Version bump:** `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` — **todos 3** iguais
- **Icons:** `tauri icon icon.png` (PNG 1024x1024) gera `.icns` + tamanhos

---

## 4. Approaches Considered

| Approach | Trade-offs | Decision |
|----------|------------|----------|
| **A. Tauri 2 built-in bundler + `tauri-action`** (recomendado) | Nativo, mantido, suporta notarização + updater + universal build | ✅ Escolhido |
| B. `create-dmg` + scripts manuais + `xcrun notarytool` | Controlo total; mais manutenção; duplicação do que Tauri já faz | ❌ |
| C. `electron-builder` style via `tauri-action` custom | Overkill; Tauri 2 já faz tudo | ❌ |
| D. Só `.app` zipado, sem notarização | Gatekeeper bloqueia; UX ruim ("Open Anyway") | ❌ Anti-goal |

---

## 5. How It Gets Built (decisions locked)

### 5.1 Apple Developer Setup (owner faz uma vez)
1. **Apple Developer Program** ativo (99 USD/ano)
2. **Certificados** no Keychain: "Developer ID Application" + "Developer ID Installer" (para .pkg se needed)
3. **App-specific password** para `notarytool` (ou keychain profile `notarytool store-credentials`)
4. **Team ID** (10 chars) → vai no `tauri.conf.json` → `bundle.macos.signingIdentity`

### 5.2 `tauri.conf.json` — keys críticas
```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: <NAME> (<TEAM_ID>)",
      "entitlements": "src-tauri/entitlements.plist",
      "providerShortName": "<TEAM_ID>",
      "certificateType": "developer-id"
    }
  },
  "plugins": {
    "updater": {
      "pubkey": "<BASE64_PUBKEY_FROM_TAURI_KEYGEN>",
      "endpoints": ["https://github.com/filipesousaduty/colima-ui/releases/latest/download/{{target}}/{{current_version}}.json"],
      "windows": { "installMode": "passive" }
    }
  }
}
```

### 5.3 Entitlements (`src-tauri/entitlements.plist`)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.network.client</key><true/>
  <key>com.apple.security.files.user-selected.read-write</key><true/>
</dict>
</plist>
```
*Nota:* `allow-jit` + `allow-unsigned-executable-memory` necessários para WebKit JIT no WKWebView.

### 5.4 GitHub Actions (`.github/workflows/release.yml`)
- Trigger: `push` tag `v*.*.*`
- Jobs: `tauri-action` (matrix: `macos-14` arm64)
- `tauri-action` faz: build → sign → notarize → staple → upload assets (`.dmg`, `.app.tar.gz`, `latest.json` para updater)
- Secrets needed: `APPLE_CERTIFICATE` (base64 .p12), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` (app-specific), `APPLE_TEAM_ID`

### 5.5 Homebrew Tap (repo separado `homebrew-colima-ui`)
- Template cask:
```ruby
cask "colima-ui" do
  version "0.x.x"
  sha256 "..."
  url "https://github.com/filipesousaduty/colima-ui/releases/download/v#{version}/colima-ui_#{version}_aarch64.dmg"
  name "Colima UI"
  desc "Docker Desktop alternative for Colima"
  homepage "https://github.com/filipesousaduty/colima-ui"
  depends_on formula: "colima"
  depends_on formula: "docker"
  auto_updates true
end
```
- Atualização: script `brew bump-cask-pr` no release workflow ou manual

### 5.6 Version bump process
```bash
# 1. Bump versão nos 3 ficheiros
# package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml
# 2. Commit + tag
git tag v0.2.0 && git push origin v0.2.0
# 3. GitHub Action corre, publica release
```

---

## 6. Review Focus (5 failure modes most likely to bite)

| Input/Condition | Expected Behavior | Test |
|-----------------|-------------------|------|
| **CSP strict no build release** | App carrega sem erros de CSP no console; zero `Refused to load script/style` | `npm run tauri build` → abrir `.app` real → DevTools Console clean |
| **Notarização + stapler** | `spctl -a -v /Applications/Colima\ UI.app` → `accepted`; `xcrun stapler validate` → OK | Script de verificação pós-build |
| **Auto-update (updater plugin)** | App verifica release no GitHub; baixa `.dmg`; instala na próxima abertura | Simular release `v0.2.1` → abrir app `v0.2.0` → update prompt |
| **Homebrew cask install** | `brew install --cask colima-ui` instala `.app` em `/Applications`; roda; `brew upgrade` funciona | Testar em Mac limpo (ou VM) |
| **Entitlements + Hardened Runtime** | Zero crashes por sandbox; `docker`, `colima`, `kubectl`, `brew` subprocesses funcionam | Smoke test: start/stop VM, pull image, run container, Doctor checks |

---

## 7. What's Left to the Builder

- Gerar chave updater: `cargo install tauri-cli && tauri keygen` → publica `pubkey` no `tauri.conf.json`
- Criar `src-tauri/entitlements.plist` com conteúdo acima
- Configurar secrets no GitHub repo (owner faz)
- Criar repo `homebrew-colima-ui` + cask template
- Validar CSP em machine real (obrigatório — não roda no CI)
- Documentar processo de release no `README.md` / `CONTRIBUTING.md`

---

## 8. Decisions Needed from Owner

1. **Apple Developer Program ativo?** (Team ID, certificados, app-specific password)
2. **Repo Homebrew:** `filipesousaduty/homebrew-colima-ui` ou org separada?
3. **Versão inicial para v1.0?** (ex: `0.1.0` vs `1.0.0` — semver)
4. **Auto-update:** canal `latest` (padrão) ou `stable`/`beta`?
5. **Ícone:** tem `icon.png` 1024x1024? (senão gerar placeholder)

---

**Próximo passo após aprovação:** invocar `writing-plans` para plano de implementação tarefa-a-tarefa (W11 + W12).