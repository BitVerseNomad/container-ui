# Colima UI — Highlights (Resumo Ultra-Compacto)

> **Branch:** `refactor/generic-containers` (15 commits desde `integration`, head `5fdef79`)  
> **Stack:** Tauri 2 + React 18 + TS 5.5 + Vite 5.4 | 79 testes UI + 135 Rust + 586 lógica pura = **OK**

---

## O que é
App desktop (Rust + React) para gerir [Colima](https://github.com/abiosoft/colima) — Docker no Mac. UI estilo Docker Desktop **com orientação**: explica erros e corrige.

**7 abas:** Containers, Images, Volumes, Networks (topo) + Doctor, Profiles (baixo).

---

## Estado do Código (vs `integration`)
- **Zero alterações de fonte commitadas** — 4.038 linhas de diff = só documentação
- **Não commitado:** 8 ficheiros editados + `src/lib/latest.ts` (novo) + prop `text` no `IconButton`
- 57 ficheiros TS/TSX + 12 UI lib + 3 CSS

---

## Design System
**Tokens (light/dark):** `--page --sidebar --card --border --ink --muted --primary --on-primary --danger --warn --btn --btn-edge --dot-ok --dot-bad --dot-warn`  
**Padrão `IconButton`:** dois modos — só ícone (default) ou ícone + label (`text` prop).

---

## UX Review (44 achados)
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

## Fixes Principais
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

## Trabalho Adiado
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
```