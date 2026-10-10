# TASK_QUEUE — Fila Operacional de Execução

> **Documento:** Fila de Tarefas por Estado  
> **Status:** Ativo  
> **Regra:** Uma nano task só pode estar em um único estado por vez.  

---

## 🟢 READY (Pronta para Execução Imediata)

- [ ] **`NANO-002`**: Criar suíte de testes unitários para a rota `/api/instagram/media` e método `getUserMedia` no Vitest (`src/lib/meta/graph.test.ts`).

---

## 🟡 IN_PROGRESS (Em Execução Pelo Agente Autorizado)

*(Nenhuma tarefa em andamento no momento)*

---

## 🟣 VALIDATION (Em Fase de Validação / Testes)

*(Nenhuma tarefa aguardando validação no momento)*

---

## 🔴 BLOCKED (Aguardando Conclusão de Dependências)

- [ ] **`NANO-003`**: Conectar `PostPicker.tsx` com `fetch('/api/instagram/media')` exibindo loading e abas de filtro. *(Bloqueada por: `NANO-002`)*
- [ ] **`NANO-004`**: Atualizar `matcher.ts` e `recipe.ts` para validar `mediaId` no webhook quando `scope === 'specific'`. *(Bloqueada por: `NANO-003`)*

---

## ⚪ DONE (Concluídas e Validadas)

- [x] **`NANO-001`**: Adicionar busca de mídia no `InstagramGraphClient` (`src/lib/meta/graph.ts`) e criar rota `GET /api/instagram/media` (`src/app/api/instagram/media/route.ts`) com fallback mock defensivo. *(Validado: Level 1 TSC, Level 2 Vitest, Level 3 Runtime HTTP 200)*


## Programa de produção — atualização 2026-10-10
- [ ] **ITEM-03 — PARCIAL / BLOCKED**: correções independentes aplicadas; 50 testes direcionados aprovados. Migração Instagram Login aguarda decisão explícita, pré-requisitos de dados/TrackedLink e coordenação do workspace. Gates globais falharam. Ver `state/ITEM-03-REPORT.md`. Relaciona NANO-002/004 (testes/matcher); OAuth e token continuam dependentes das etapas próprias.
