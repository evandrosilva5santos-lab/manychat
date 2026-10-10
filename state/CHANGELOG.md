# CHANGELOG — Histórico Oficial de Mudanças Técnicas

> **Documento:** Registro de Alterações Atômicas  
> **Padrão:** Uma entrada por nano task ou ciclo de governança  

---

### [2026-09-28] — Governança e Preparação Completa para Execução
- **DATE:** 2026-09-28 22:35
- **AGENT:** `ANTIGRAVITY` (Arquiteto de Projeto & Orquestrador)
- **NANO TASK:** `PREPARATION_AND_ORCHESTRATION`
- **FILES CHANGED / CREATED:**
  - `docs/PROJECT_MAP.md`
  - `docs/CONTEXT.md`
  - `docs/ARCHITECTURE.md`
  - `docs/DESIGN.md`
  - `docs/RULES.md`
  - `docs/DECISIONS.md`
  - `docs/GLOSSARY.md`
  - `docs/PRD_ISSUES.md`
  - `execution/EXECUTION_RULES.md`
  - `execution/ROADMAP.md`
  - `execution/MASTER_PLAN.md`
  - `execution/TASK_QUEUE.md`
  - `execution/CURRENT_TASK.md`
  - `tasks/EPIC-001/TASK-001.md`
  - `PRD_TRACEABILITY.md`
  - `state/STATUS.md`
  - `state/CHANGELOG.md`
  - `state/BLOCKERS.md`
  - `reports/INITIAL_AUDIT.md`
- **CHANGE:** Auditoria estrutural completa do repositório, preservação integral do PRD, formalização do design system e tokens, fatiamento determinístico do Seletor de Mídia em 4 nano tasks (`NANO-001` a `NANO-004`) e autorização da `NANO-001`.
- **VALIDATION:**
  - 46 testes unitários no Vitest passando (`npm test`).
  - Verificação de tipos TypeScript com zero erros (`npx tsc --noEmit`).
- **RESULT:** Estado do projeto transicionado para `READY_FOR_EXECUTION`.

---

### [2026-09-29] — Conclusão e Validação da NANO-001
- **DATE:** 2026-09-29 02:55
- **AGENT:** `CLAUDE` (Claude Code) / Validado por `ANTIGRAVITY`
- **NANO TASK:** `NANO-001`
- **FILES CHANGED / CREATED:**
  - `src/lib/meta/graph.ts` (Adicionado tipo `InstagramMediaItem` e método `getUserMedia` com fallback defensivo)
  - `src/app/api/instagram/media/route.ts` (Criada route handler GET retornando dados normalizados)
  - `state/BLOCKERS.md` (Resolvido `BLK-003`)
  - `execution/TASK_QUEUE.md` (Movida `NANO-001` para `DONE` e `NANO-002` para `READY`)
- **CHANGE:** Implementação completa da busca de publicações do Instagram na Graph API v21.0 com suporte a dados mock ricos em ambiente offline/teste, expondo o endpoint `GET /api/instagram/media` para consumo no frontend.
- **VALIDATION:**
  - Level 1 (Local): `npx tsc --noEmit` concluiu com 0 erros.
  - Level 2 (Integração): `npm test` concluiu com 51/51 testes passando (100% verde).
  - Level 3 (Runtime/Requisito): Endpoint testado via runtime retornando status HTTP 200 e payload `{ success: true, data: [...] }`.
- **RESULT:** `NANO-001` aprovada e concluída. Próxima nano task autorizada: `NANO-002`.


## 2026-10-10 — Item 02: Banco Postgres real e remoção de TODOS os dados falsos
- **STATUS:** ✅ Concluído com 100% dos critérios comprovados.
- **BANCO:** Supabase Postgres conectado (`DATABASE_URL` com pgbouncer na porta 6543 e `DIRECT_URL` na porta 5432). Todas as 5 migrations aplicadas sem drift (`prisma migrate diff` = zero diferenças).
- **MOCKS/STORE:** Remoção completa e definitiva de `src/lib/storage/store.ts`, `store.test.ts` e diretório `.data/`. Eliminação de contas fictícias (`DEMO_ACCOUNT`, `movingfestival`, placeholder `17841400123456789`), fluxo demo "casamento", `MOCK_POSTS`, dados inventados no dashboard e ações com sucesso falso. Busca de dados falsos retorna rigorosamente ZERO ocorrências no código de produção.
- **PÁGINAS DINÂMICAS:** `/`, `/catalogo`, `/contatos`, `/conversas`, `/fluxos`, `/fluxos/[id]` e `/ajustes` convertidas para renderização dinâmica (`ƒ`), com fronteiras de erro (`error.tsx`, `global-error.tsx`) e `loading.tsx`.
- **SEGURANÇA & VALIDAÇÃO:** Integração completa com os contratos do Item 01 (`requireAuth`, `TrackedLink`, `invalidIdMessage`).
- **VALIDATION:**
  - `npx tsc --noEmit`: 0 erros.
  - `npm test`: 12 arquivos de teste, 173 testes passando (100% verde).
  - `npx next build`: Build de produção compilado com sucesso com Turbopack em 6.0s.
  - `npx prisma migrate status`: 5 migrations aplicadas, database schema up to date.
  - Auditoria regex de dados falsos: 0 ocorrências.

## 2026-10-10 — Item 3 (Codex), parcial
Correções independentes de matcher, parsing/HMAC, janela temporal e DELAY; 15 novos testes. Suíte direcionada: 50/50. Gates globais não passaram; nenhum deploy/merge. Detalhes e bloqueios: [ITEM-03-REPORT.md](ITEM-03-REPORT.md).
