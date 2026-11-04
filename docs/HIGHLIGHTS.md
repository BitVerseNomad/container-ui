# Colima UI — Highlights (Resumo Ultra-Compacto)

> **Branch actual:** `refactor/generic-containers` (head `8fe2356`, 3 commits desde `integration`)  
> **Branch base:** `integration` (**110 commits** à frente de `main`)  
> **Stack:** Tauri 2 + React 18 + TS 5.5 + Vite 5.4 | 79 testes UI + 135 Rust + 586 lógica pura = **OK**

---

## O que é
App desktop (Rust + React) para gerir [Colima](https://github.com/abiosoft/colima) — Docker no Mac. UI estilo Docker Desktop **com orientação**: explica erros e corrige.

**7 abas:** Containers, Images, Volumes, Networks (topo) + Doctor, Profiles (baixo).

---

## Trabalho Feito (Todas as Sessões)

### `integration` (110 commits, trabalho principal)
| Área | Entregas |
|------|----------|
| **Containers** | Home = lista containers; agrupa por Compose; 1 linha por app; New menu; start/stop/shell/logs; fix per-row |
| **Doctor** | Painel com fixes comuns; redimensiona VM 1-click; portas; memory; connection doctor (localhost leak) |
| **Kubernetes** | Tab só aparece se perfil tem K8s; pod problems em português; `kubectl` read-only; `k9s` no Terminal; installável via Rust |
| **Observability** | Health, restart, exit-code detection; timeline eventos Docker (janela bounded); volume sizes; heaviest containers |
| **Networking** | Tab Networks; connection doctor; network commands allowlist; probe command (Rust) |
| **Compose** | Spotlight find projects; run/rebuild/logs/add folders; toolbar button; row actions claras |
| **Registries** | Pull panel: GHCR, ECR, Artifact Registry, qualquer host; sorting; official detection; private registry (feat/registries) |
| **Profiles** | Switch/start/stop na sidebar; row Logs/Shell; moveu abaixo de Setup |
| **Run Panel** | Guiado; montagens read-only default; network option (host recusado); generic guidance logic |
| **Volumes** | Mostra o que usa; bulk remove nunca toca named volumes; usage helpers |
| **Ports** | Bind 127.0.0.1 default; opt-in para externo; one-click links |
| **Install/Release** | App instala Colima; GitHub releases; one-line install; CSP release build; icons |
| **A11y/UX** | Landmarks, table scopes, modal side panels; muted text 4.5:1; retry repete op; stale VM failures limpam |
| **Tests** | Fixtures Colima/Docker reais; jsdom render Containers; browser checks reportam crashes |

### `refactor/generic-containers` (esta branch — só docs)
- **69beb6d** — 12 design docs + SME reviews (iterações 01–12, W1–W14) — 4.038 linhas
- **5fdef79** — HIGHLIGHTS.md v1 (EN)
- **8fe2356** — HIGHLIGHTS.md v2 (PT, ultra-compacto, **este ficheiro**)

### Outras branches (WIP/deferred)
| Branch | Estado |
|--------|--------|
| `feat/registries` | My registries tab (component/tabs feitos; mock/checks pendentes) — 3 commits |
| `feat/private-pull` | Pull de registry privado no Pull panel — 1 commit |
| `feat/shell-overview`, `feat/guided-run`, `feat/kubernetes`, `feat/networking`, `feat/observability` | Sem commits novos vs `integration` |
| `fix/review-findings` | Sem commits novos |

---

## Estado do Código (vs `integration`)
- **Zero alterações de fonte commitadas** em `refactor/generic-containers` — diff = só docs
- **Não commitado (working tree):** 8 ficheiros editados + `src/lib/latest.ts` (novo) + prop `text` no `IconButton`
- 57 ficheiros TS/TSX + 12 UI lib + 3 CSS

---

## Design System
**Tokens (light/dark):** `--page --sidebar --card --border --ink --muted --primary --on-primary --danger --warn --btn --btn-edge --dot-ok --dot-bad --dot-warn`  
**Padrão `IconButton`:** dois modos — só ícone (default) ou ícone + label (`text` prop).

---

## UX Review (esta sessão — 44 achados)
Revisão completa: 57 src + 12 UI contra **25 categorias Vercel Web Interface Guidelines**.

| Severidade | Qtd | Principais |
|------------|-----|------------|
| **Crítico** | 8 | Acessibilidade (labels, ARIA, foco) |
| **Alto** | 18 | Estados de foco, validação forms, hover |
| **Médio** | 9 | Timing animações, hierarquia conteúdo |
| **Baixo** | 9 | Polish, edge cases |

**Princípios:** Simples por default, complexo quando necessário. Inspiração: Google (Material 3), Apple (HIG), Tesla.  
**Idioma:** Português.

---

## Fixes Principais (esta sessão)
- **Profiles.tsx:140** — bug concatenação nome (`Name: Name: valor`) corrigido. Testes passam.
- Busca adicionada em Images, Volumes, Networks.
- Filtro/ordenação/remoção em massa em Volumes.

---

## Documentação no Repo
| Ficheiro | Para que serve |
|----------|----------------|
| `CONTEXT.md` | Estado da sessão (carrega auto) |
| `docs/HIGHLIGHTS.md` | **Este ficheiro** — visão rápida |
| `docs/WORK_DOCUMENTATION.md` | Registo detalhado (254 linhas, 10 secções) |
| `docs/EXECUTION_PLAN.md` | Status itens W1–W14 |
| `docs/SPEC.md` | Spec completa |
| `docs/temporary/` | Research, screenshots, 12 design docs + SME reviews |

---

## Limitações Conhecidas
- `invoke` Tauri falha no browser dev server (normal — só funciona no app nativo)
- Testes completos (start/stop, images, volumes, networks, profiles) precisam app Tauri nativo
- Sem cobertura: `Setup.tsx`, `ConnectionTest.tsx`, `ContainerDetail.tsx`
- Valores de forms não persistem em snapshots após `browser.fill`

---

## Trabalho Adiado (W2–W14)
- **W2:** Merge `feat/registries` (4 conflitos, mecânicos mas grandes)
- **W4 resto:** Filtro/ordenação/bulk em Images/Networks, sugestões prune
- **W5–W14:** Run panel, Compose, settings Colima, diagnostics, notificações, command palette, packaging, image build, registries, terminal, remote, onboarding, i18n, Doctor

---

## Como Usar (ordem de leitura)
1. `CONTEXT.md` → 2. `docs/HIGHLIGHTS.md` → 3. `docs/WORK_DOCUMENTATION.md` → 4. `docs/EXECUTION_PLAN.md` → 5. `docs/temporary/`

---

## Comandos Rápidos
```bash
npm test && cd src-tauri && cargo test    # todos os testes
npm run tauri dev                          # roda app
npm run preview                            # build preview
git log --oneline integration..HEAD        # commits desta branch
git log --oneline main..integration        # 110 commits trabalho principal
```