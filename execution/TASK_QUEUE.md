# TASK_QUEUE — Fila Operacional de Execução

> **Documento:** Fila de Tarefas por Estado  
> **Status:** Ativo  
> **Regra:** Uma nano task só pode estar em um único estado por vez.  

---

## 🟢 READY (Pronta para Execução Imediata)

- [ ] **`NANO-001`**: Adicionar busca de mídia no `InstagramGraphClient` (`src/lib/meta/graph.ts`) e criar rota `GET /api/instagram/media` (`src/app/api/instagram/media/route.ts`) com fallback mock defensivo.

---

## 🟡 IN_PROGRESS (Em Execução Pelo Agente Autorizado)

*(Nenhuma tarefa em andamento no momento)*

---

## 🟣 VALIDATION (Em Fase de Validação / Testes)

*(Nenhuma tarefa aguardando validação no momento)*

---

## 🔴 BLOCKED (Aguardando Conclusão de Dependências)

- [ ] **`NANO-002`**: Criar suíte de testes unitários para a rota `/api/instagram/media` no Vitest. *(Bloqueada por: `NANO-001`)*
- [ ] **`NANO-003`**: Conectar `PostPicker.tsx` com `fetch('/api/instagram/media')` exibindo loading e abas de filtro. *(Bloqueada por: `NANO-001`, `NANO-002`)*
- [ ] **`NANO-004`**: Atualizar `matcher.ts` e `recipe.ts` para validar `mediaId` no webhook quando `scope === 'specific'`. *(Bloqueada por: `NANO-003`)*

---

## ⚪ DONE (Concluídas e Validadas)

*(Nenhuma nano task deste novo ciclo foi executada ainda — Projeto em estado de preparação de handoff)*
