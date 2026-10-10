# PRD_TRACEABILITY — Matriz de Rastreabilidade de Requisitos (Completa)

> **Documento:** Rastreabilidade Bidirecional Exaustiva (Requisito $\leftrightarrow$ Tarefas Técnicas)  
> **Status:** Ativo  
> **Framework:** Everything Claude Code (ECC)  
> **Regra:** Nenhum requisito sem destino; nenhuma nano task sem origem.  

---

## 1. Matriz Completa de Requisitos do PRD

| PRD Req ID | Módulo do PRD | Descrição do Requisito | Fase | Epic | Task | Micro Task | Nano Task | Arquivos Alvo | Teste Associado | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-001** | Mod 1: Conexão | Login com conta profissional Instagram via Facebook Login | Fase 5 | EPIC-003 | TASK-003 | MICRO-003.01 | **NANO-031** | `src/app/api/auth/meta/*` | Teste OAuth | `QUEUED` |
| **REQ-002** | Mod 1: Conexão | Armazenamento de token de longa duração e renovação 60d | Fase 5 | EPIC-003 | TASK-003 | MICRO-003.02 | **NANO-033** | `src/app/api/cron/refresh-token/*` | `graph.test.ts` | `QUEUED` |
| **REQ-003** | Mod 1: Conexão | Registro de Webhook da Meta e challenge | Fase 1 | EPIC-000 | TASK-000 | MICRO-000.01 | NANO-000 | `src/app/api/webhook/instagram/*` | `webhook.test.ts` | `IMPLEMENTED` |
| **REQ-004** | Mod 2: Editor | Easy Builder com fluxo Gatilho $\rightarrow$ Comentário $\rightarrow$ DM $\rightarrow$ Link | Fase 2 | EPIC-000 | TASK-000 | MICRO-000.02 | NANO-000 | `src/components/simple-builder/*` | `recipe.test.ts` | `IMPLEMENTED` |
| **REQ-005** | Mod 2: Editor | Seletor de publicação ou Reels específico para automação | Fase 2 | EPIC-001 | TASK-001 | MICRO-001.01 | **NANO-001** | `src/lib/meta/graph.ts`, `src/app/api/instagram/media/route.ts` | `graph.test.ts` / `routes.security.test.ts` | `IMPLEMENTED` |
| **REQ-006** | Mod 2: Editor | Grade visual estilo feed no seletor com capas e filtros | Fase 2 | EPIC-001 | TASK-001 | MICRO-001.02 | **NANO-003** | `src/components/simple-builder/PostPicker.tsx` | Vitest / Browser QA | `IMPLEMENTED` |
| **REQ-007** | Mod 2: Editor | Editor visual avançado em canvas React Flow | Fase 2 | EPIC-000 | TASK-000 | MICRO-000.03 | NANO-000 | `src/components/flow-editor/*` | `flow.test.ts` | `IMPLEMENTED` |
| **REQ-008** | Mod 3: Engine | Endpoint de Webhook com validação de assinatura HMAC SHA-256 | Fase 1 | EPIC-000 | TASK-000 | MICRO-000.04 | NANO-000 | `src/lib/meta/webhook.ts` | `engine.test.ts` | `IMPLEMENTED` |
| **REQ-009** | Mod 3: Engine | Roteador de gatilhos por palavra-chave | Fase 1 | EPIC-000 | TASK-000 | MICRO-000.05 | NANO-000 | `src/lib/engine/matcher.ts` | `engine.test.ts` | `IMPLEMENTED` |
| **REQ-010** | Mod 3: Engine | Filtrar disparo por ID do post específico (`mediaId`) | Fase 2 | EPIC-001 | TASK-001 | MICRO-001.02 | **NANO-004** | `src/lib/engine/matcher.ts` | `meta-contract.test.ts` | `IMPLEMENTED` |
| **REQ-011** | Mod 3: Engine | Executor de nós `FlowRunner` | Fase 1 | EPIC-000 | TASK-000 | MICRO-000.06 | NANO-000 | `src/lib/engine/engine.ts` | `engine.test.ts` | `IMPLEMENTED` |
| **REQ-012** | Mod 4: Rastreamento | Encurtador de links e cliques `/api/l/[code]` | Fase 1 | EPIC-000 | TASK-000 | MICRO-000.07 | NANO-000 | `src/app/api/l/[code]/*` | `routes.security.test.ts` | `IMPLEMENTED` |
| **REQ-013** | Mod 5: CRM | Cadastro de contatos com igsid e histórico de mensagens | Fase 3 | EPIC-004 | TASK-004 | MICRO-004.02 | **NANO-043** | `src/app/conversas/*`, `src/lib/engine/contacts.ts` | Vitest / Postgres | `IMPLEMENTED` |
| **REQ-014** | Mod 5: CRM | Gestão e aplicação de etiquetas (`Tags`) | Fase 3 | EPIC-004 | TASK-004 | MICRO-004.01 | **NANO-042** | `src/app/contatos/actions.ts` | `actions.security.test.ts` / Postgres | `IMPLEMENTED` |
| **REQ-015** | Invariante Meta | Respeitar janela de 24h para envio de DMs | Fase 1 | EPIC-000 | TASK-000 | MICRO-000.10 | NANO-000 | `src/lib/meta/window.ts` | `engine.test.ts` | `IMPLEMENTED` |
| **REQ-016** | Invariante Meta | Máximo de 3 botões fixos (`button template`) | Fase 1 | EPIC-000 | TASK-000 | MICRO-000.11 | NANO-000 | `src/lib/flow/recipe.ts` | `recipe.test.ts` | `IMPLEMENTED` |
| **REQ-017** | Invariante Meta | Título do botão com limite de 20 caracteres | Fase 1 | EPIC-000 | TASK-000 | MICRO-000.12 | NANO-000 | `src/lib/flow/recipe.ts` | `recipe.test.ts` | `IMPLEMENTED` |
| **REQ-018** | Mod 2: Catálogo | Nó de carrossel com até 10 cards e envio Send API | Fase 4 | EPIC-002 | TASK-002 | MICRO-002.02 | **NANO-023** | `src/lib/engine/engine.ts`, `graph.ts` | Vitest | `QUEUED` |
| **REQ-019** | QA & Homologação | Resposta sob carga < 3s e validação real com a Meta | Fase 6 | EPIC-005 | TASK-005 | MICRO-005.01 | **NANO-051 / 054** | `scripts/*`, `reports/*` | Stress & Smoke Test | `QUEUED` |
