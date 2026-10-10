# HANDOFF — Pacote Oficial de Transferência de Controle Operacional (ECC Standard)

> **Documento:** Protocolo Formal de Handoff entre Agentes de IA  
> **Transmissão:** `ANTIGRAVITY` (Orquestrador) $\rightarrow$ `CLAUDE` (Claude Code - Executor)  
> **Framework:** Everything Claude Code (ECC)  
> **Data:** 29/09/2026 02:55 (Horário Local)  

---

- **HANDOFF ID:** `HANDOFF-002-ECC`
- **FROM AGENT:** `ANTIGRAVITY` (Arquiteto de Projeto & Orquestrador de Execução)
- **TO AGENT:** `CLAUDE` (Claude Code - Agente de Desenvolvimento e Execução Atômica)
- **DATE:** 2026-09-29
- **PROJECT STATUS:** `READY_FOR_EXECUTION`
- **CURRENT PHASE:** `FASE 2` (Editor Visual & Seletor de Mídia)
- **CURRENT EPIC:** `EPIC-001` (Seletor Visual de Publicações do Instagram)
- **CURRENT TASK:** `TASK-001` (Implementação Ponta a Ponta do Seletor de Posts)
- **CURRENT MICRO TASK:** `MICRO-001.01` (Backend Graph API e Rota de Mídia)
- **CURRENT NANO TASK:** `NANO-002` (Criar suíte de testes unitários para `getUserMedia` e rota `/api/instagram/media` no Vitest)
- **RISK LEVEL:** `MEDIUM`

---

## O QUE FOI VALIDADO DA ETAPA ANTERIOR (`NANO-001 VALIDATION`)
1. **PRD & Regras:** Método `getUserMedia` e endpoint `GET /api/instagram/media` aderentes aos Módulos 2 e 5 do PRD e às regras de `docs/RULES.md`.
2. **Level 1 (Tipos):** `npx tsc --noEmit` aprovado com 0 erros.
3. **Level 2 (Testes):** `npm test` aprovado com 51/51 testes passando (100% verde).
4. **Level 3 (Runtime):** Requisição `GET http://localhost:3007/api/instagram/media` validada com HTTP 200 e payload mock normalizado (`InstagramMediaItem`).
5. **Governança:** `BLK-003` resolvido, `NANO-001` arquivada em `DONE`, `CHANGELOG.md` e `TASK_QUEUE.md` atualizados.

---

## ARQUIVOS PERMITIDOS PARA A NANO-002 (`ALLOWED FILES`)
- `src/lib/meta/graph.test.ts`

---

## ARQUIVOS PROIBIDOS (`FORBIDDEN FILES`)
- `PRD.md` (Imutável)
- `src/components/*` (Alterado apenas na NANO-003)
- `src/lib/engine/*`
- `src/app/api/webhook/*`
- `prisma/*`
- `package.json`

---

## ESTRATÉGIA DE VALIDAÇÃO MANDATÓRIA (3 NÍVEIS)
- **Level 1 (Local):** `npx tsc --noEmit` conclui com 0 erros.
- **Level 2 (Integração):** `npm test` executa 5 suites de testes com 100% de aprovação (incluindo `src/lib/meta/graph.test.ts`).
- **Level 3 (Requisito):** Cobertura de cenários sem token (mock inteligente), cenários com token simulado (parâmetros de URL e headers) e tratamento de falhas HTTP da Meta sem lançar exceções não tratadas.

---

## PRÓXIMA AÇÃO E AÇÃO AUTORIZADA (`AUTHORIZED ACTION`)
O agente **Claude Code** está formalmente autorizado a iniciar a execução atômica da:

### 🟢 `NANO-002`: Criar suíte de testes unitários em `src/lib/meta/graph.test.ts` cobrindo `getUserMedia` e a rota `GET /api/instagram/media` no Vitest


## Handoff 2026-10-10 — Item 3 parcial
Ler [ITEM-03-REPORT.md](ITEM-03-REPORT.md) antes de retomar. Preservar alterações anteriores e concorrentes. Confirmar Instagram Login e ambiente de teste, coordenar webhook com responsável pelo Item 1, concluir dependências e implementar o restante. Não considerar o Item 3 concluído nem a integração homologada.
