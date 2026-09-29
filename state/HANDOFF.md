# HANDOFF — Pacote Oficial de Transferência de Controle Operacional (ECC Standard)

> **Documento:** Protocolo Formal de Handoff entre Agentes de IA  
> **Transmissão:** `ANTIGRAVITY` (Orquestrador) $\rightarrow$ `CLAUDE` (Claude Code - Executor)  
> **Framework:** Everything Claude Code (ECC)  
> **Data:** 28/09/2026 22:41 (Horário Local)  

---

- **HANDOFF ID:** `HANDOFF-001-ECC`
- **FROM AGENT:** `ANTIGRAVITY` (Arquiteto de Projeto & Orquestrador de Execução)
- **TO AGENT:** `CLAUDE` (Claude Code - Agente de Desenvolvimento e Execução Atômica)
- **DATE:** 2026-09-28
- **PROJECT STATUS:** `READY_FOR_EXECUTION`
- **CURRENT PHASE:** `FASE 2` (Editor Visual & Seletor de Mídia)
- **CURRENT EPIC:** `EPIC-001` (Seletor Visual de Publicações do Instagram)
- **CURRENT TASK:** `TASK-001` (Implementação Ponta a Ponta do Seletor de Posts)
- **CURRENT MICRO TASK:** `MICRO-001.01` (Backend Graph API e Rota de Mídia)
- **CURRENT NANO TASK:** `NANO-001` (Adicionar método `getUserMedia` em `graph.ts` e rota `GET /api/instagram/media`)
- **RISK LEVEL:** `HIGH`

---

## O QUE FOI FEITO NESTA ETAPA DE PREPARAÇÃO (`WHAT WAS DONE`)
1. Auditoria completa 360° do repositório `/Users/evandro/Downloads/Manychat` (código, testes, banco e documentação).
2. Validação empírica: 46/46 testes unitários passando no Vitest (`npm test`) e zero erros de compilação TypeScript (`npx tsc --noEmit`).
3. Preservação integral do `PRD.md` original sem alterações de escopo.
4. Mapeamento detalhado da arquitetura e arquivos críticos (`docs/PROJECT_MAP.md`, `docs/CONTEXT.md`, `docs/ARCHITECTURE.md`).
5. Formalização completa do Design System, tokens de cor, escala tipográfica e proporção do Easy Builder (`docs/DESIGN.md`).
6. Criação de regras invariantes e inegociáveis de código, Meta API e limites (`docs/RULES.md`).
7. Registro de decisões de arquitetura (`docs/DECISIONS.md`: ADR-001 a ADR-004).
8. Criação do glossário oficial (`docs/GLOSSARY.md`) e registro de issues do PRD (`docs/PRD_ISSUES.md`).
9. Integração integral da metodologia **Everything Claude Code (ECC)** em `docs/ECC_INTEGRATION.md`.
10. Decomposição hierárquica completa em Fases, Epics, Tasks, Micro Tasks e Nano Tasks no padrão ECC de 25 campos (`tasks/EPIC-001/TASK-001.md`).
11. Matriz de classificação de risco (LOW, MEDIUM, HIGH, CRITICAL) adicionada em `execution/MASTER_PLAN.md`.
12. Elaboração da Matriz de Rastreabilidade Bidirecional (`PRD_TRACEABILITY.md`).
13. Atualização do contrato universal em `AGENTS.md` e do guia de inicialização em `CLAUDE.md`.
14. Autorização operacional da primeira tarefa atômica (`execution/CURRENT_TASK.md` apontando para `NANO-001`).

---

## O QUE NÃO FOI FEITO (`WHAT WAS NOT DONE`)
- Nenhuma linha de código de feature foi escrita nesta etapa (em estrito cumprimento da Regra Absoluta 00).
- `NANO-001` a `NANO-004` aguardam execução pelo Claude Code seguindo o ciclo ECC.

---

## ARQUIVOS PERMITIDOS PARA A NANO-001 (`ALLOWED FILES`)
- `src/lib/meta/graph.ts`
- `src/app/api/instagram/media/route.ts`

---

## ARQUIVOS PROIBIDOS (`FORBIDDEN FILES`)
- `PRD.md` (Imutável)
- `src/components/simple-builder/PostPicker.tsx` (Alterado apenas na NANO-003)
- `src/lib/engine/engine.ts`
- `prisma/schema.prisma`
- `package.json`

---

## ESTRATÉGIA DE VALIDAÇÃO MANDATÓRIA (3 NÍVEIS)
- **Level 1 (Local):** `npx tsc --noEmit` conclui com 0 erros.
- **Level 2 (Integração):** `npm test` conclui com 46/46 testes passando sem regressões.
- **Level 3 (Requisito PRD):** `curl -s http://localhost:3007/api/instagram/media` retorna 200 com JSON contendo `{"success": true, "data": [...]}`.

---

## PRÓXIMA AÇÃO E AÇÃO AUTORIZADA (`AUTHORIZED ACTION`)
O agente **Claude Code** está formalmente autorizado a iniciar a execução atômica da:

### 🟢 `NANO-001`: Implementar método `getUserMedia` em `src/lib/meta/graph.ts` e endpoint `GET /api/instagram/media` com fallback mock
