# TASK_QUEUE — Fila Operacional de Execução

> **Documento:** Fila de Tarefas por Estado  
> **Status:** Ativo  
> **Regra:** Uma nano task só pode estar em um único estado por vez.  

---

## 🟢 READY (Pronta para Execução Imediata)

*(Nenhuma tarefa pendente nesta fila.)*

---

## 🟡 IN_PROGRESS (Em Execução Pelo Agente Autorizado)

*(Nenhuma tarefa em andamento no momento)*

---

## 🟣 VALIDATION (Em Fase de Validação / Testes)

*(Nenhuma tarefa aguardando validação no momento)*

---

## 🔴 BLOCKED (Aguardando Conclusão de Dependências)

*(Nenhuma tarefa bloqueada no momento)*

---

## ⚪ DONE (Concluídas e Validadas)

- [x] **`PERFIL-SEGURO`** (2026-10-12): descarregar/excluir perfil, callbacks de desautorização e exclusão de dados da Meta, motor sem token global, isolamento da tela de falhas. Plano `perfil-seguro.md`, ADR-007.

- [x] **`ITEM-01`**: Segurança, basic auth no proxy, requireAuth em server actions e links rastreados.
- [x] **`ITEM-02`**: Banco Postgres real (Supabase), remoção de 100% de dados falsos/mocks/store.ts, páginas dinâmicas, zero falhas silenciosas.
- [x] **`MULTI-TENANCY-ADMIN`**: Workspaces, isolamento por conta, painel Super Admin e seletor multi-conta.
- [x] **`NANO-001`**: Adicionar busca de mídia no `InstagramGraphClient` (`src/lib/meta/graph.ts`) e criar rota `GET /api/instagram/media` (`src/app/api/instagram/media/route.ts`).
- [x] **`NANO-002`**: Criar suíte de testes unitários para a rota `/api/instagram/media` e método `getUserMedia` no Vitest (`src/lib/meta/graph.test.ts`).
- [x] **`NANO-003`**: Conectar `PostPicker.tsx` com `fetch('/api/instagram/media')` exibindo loading, empty e abas de filtro reais.
- [x] **`NANO-004`**: Atualizar `matcher.ts` e `recipe.ts` para validar `mediaId` no webhook quando `scope === 'specific'` contra Postgres real.
