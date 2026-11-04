# Working Method — OpenCode Sessions

> **Regra de ouro:** Iterações curtas, ciclos fechados, app funcional a cada passo.

## Princípios

1. **Uma iteração = um deliverable testável** (commit + testes passam + app roda)
2. **Executive summary no fim de cada iteração** (o que fez, o que planeia, blockers)
3. **Não deixar trabalho a meio** — se não dá para completar, reduz o scope
4. **Otimizar chamadas** — agrupar tool calls, evitar re-leituras, compress context regular
5. **Documentar decisões no repo** (docs/, não config do OpenCode)

## Checklist por Iteração

- [ ] Objetivo claro (1 frase)
- [ ] Scope cabível numa iteração
- [ ] Testes escritos primeiro (TDD)
- [ ] Implementação mínima
- [ ] `npm test && cargo test` passam
- [ ] `npm run tauri dev` roda nativamente
- [ ] Commit atómico com mensagem clara
- [ ] Executive summary escrito

## Executive Summary Template

```
## Iteração N — [Título]

**Feito:**
- [Item 1]
- [Item 2]

**Testes:** X passam (UI + Rust + logic)

**App:** `npm run tauri dev` ✅ funcional

**Próximo:** [Próximo deliverable pequeno]

**Blockers:** [Nenhum / Descrição]
```

## Notas

- Limite: ~1000 iterações/dia, chamadas OpenRouter limitadas
- Compress context proactivamente (`compress` tool)
- Skills: usar `brainstorming` → `writing-plans` → `executing-plans`/`subagent-driven-development`
- Estado persistente: `CONTEXT.md` + `docs/HIGHLIGHTS.md` + `docs/WORK_DOCUMENTATION.md`
- **Não mexer em config do OpenCode** (`.opencode/`, `opencode.json`)

---

*Este documento vive no repo para futuras sessões lerem.*