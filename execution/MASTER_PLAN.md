# MASTER_PLAN — Plano Mestre de Execução Hierárquica (ECC Powered)

> **Documento:** Árvore de Execução Determinística com Matriz de Risco ECC  
> **Status:** Ativo  
> **Framework:** Everything Claude Code (ECC)  
> **Orquestrador:** Start Inc. / Antigravity  

---

## 1. Visão Geral das Fases & Epics

```text
FASE 1: Fundação & Motor Core [COMPLETED]
FASE 2: Editor Visual & Seletor de Mídia [IN_PROGRESS - CICLO ATUAL]
   └── EPIC-001: Seletor Visual de Publicações do Instagram (TASK-001)
FASE 3: CRM de Contatos & Conversas [READY]
   └── EPIC-004: CRM de Contatos, Histórico de Mensagens e Tags (TASK-004)
FASE 4: Catálogo & Carrossel Interativo [READY]
   └── EPIC-002: Catálogo de Cards e Nós de Carrossel (TASK-002)
FASE 5: Onboarding OAuth & Segurança [READY]
   └── EPIC-003: Onboarding OAuth Facebook Login e Renovação 60d (TASK-003)
FASE 6: QA Final, E2E & Produção [READY]
   └── EPIC-005: Homologação Final, Stress Test e Deploy Vercel (TASK-005)
```

---

## 2. Detalhamento de Todos os Epics e Nano Tasks

### EPIC-001: Seletor Visual de Mídia da Meta (Fase 2) — CICLO ATUAL
*Ficha completa:* [`tasks/EPIC-001/TASK-001.md`](file:///Users/evandro/Downloads/Manychat/tasks/EPIC-001/TASK-001.md)

| Nano Task | Título | Risk Level | Research | Test Strategy | Review | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`NANO-001`** | Adicionar `getUserMedia` em `graph.ts` e rota `GET /api/instagram/media` | `HIGH` | **SIM** | **SIM** (`curl` / status 200) | **SIM** | **`READY`** |
| **`NANO-002`** | Suíte de testes unitários para a rota no Vitest | `MEDIUM` | Não | **SIM** (TDD / Mock test) | **SIM** | `BLOCKED` |
| **`NANO-003`** | Conectar `PostPicker.tsx` com rota viva, loading e filtros | `MEDIUM` | **SIM** | **SIM** (UI interaction) | **SIM** | `BLOCKED` |
| **`NANO-004`** | Validar `mediaId` no webhook e matcher (`scope === 'specific'`) | `HIGH` | **SIM** | **SIM** (TDD no engine.test) | **SIM** | `BLOCKED` |

---

### EPIC-002: Catálogo de Cards e Carrossel Interativo (Fase 4)
*Ficha completa:* [`tasks/EPIC-002/TASK-002.md`](file:///Users/evandro/Downloads/Manychat/tasks/EPIC-002/TASK-002.md)

| Nano Task | Título | Risk Level | Research | Test Strategy | Review | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`NANO-021`** | Server Actions de CRUD para itens do catálogo (`actions.ts`) | `MEDIUM` | **SIM** | **SIM** (Vitest) | **SIM** | `QUEUED` |
| **`NANO-022`** | Painel visual de gerenciamento de cards (`/catalogo`) | `MEDIUM` | Não | **SIM** (UI Render) | **SIM** | `QUEUED` |
| **`NANO-023`** | Suporte ao nó `CAROUSEL` no `FlowRunner` (`engine.ts`) | `HIGH` | **SIM** | **SIM** (Unit Test) | **SIM** | `QUEUED` |
| **`NANO-024`** | Envio de `generic template` na Graph API (`graph.ts`) | `HIGH` | Não | **SIM** (Mock & Send) | **SIM** | `QUEUED` |

---

### EPIC-003: Onboarding OAuth Meta e Ciclo de Vida do Token (Fase 5)
*Ficha completa:* [`tasks/EPIC-003/TASK-003.md`](file:///Users/evandro/Downloads/Manychat/tasks/EPIC-003/TASK-003.md)

| Nano Task | Título | Risk Level | Research | Test Strategy | Review | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`NANO-031`** | Rotas OAuth `/api/auth/meta/login` e `/api/auth/meta/callback` | `CRITICAL` | **SIM** | **SIM** (Mock OAuth) | **SIM** (Security) | `QUEUED` |
| **`NANO-032`** | Persistência e vínculo da conta em `InstagramAccount` | `HIGH` | Não | **SIM** (Prisma upsert) | **SIM** | `QUEUED` |
| **`NANO-033`** | Rota de renovação de token 60d `/api/cron/refresh-token` | `HIGH` | **SIM** | **SIM** (Cron test) | **SIM** (Security) | `QUEUED` |
| **`NANO-034`** | Indicador de saúde e status da conexão em `/ajustes` | `MEDIUM` | Não | **SIM** (Visual test) | **SIM** | `QUEUED` |

---

### EPIC-004: CRM de Contatos, Histórico de Conversas e Tags (Fase 3)
*Ficha completa:* [`tasks/EPIC-004/TASK-004.md`](file:///Users/evandro/Downloads/Manychat/tasks/EPIC-004/TASK-004.md)

| Nano Task | Título | Risk Level | Research | Test Strategy | Review | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`NANO-041`** | Busca e filtro multi-tags em `ContactsClient.tsx` | `MEDIUM` | Não | **SIM** (Vitest) | **SIM** | `QUEUED` |
| **`NANO-042`** | Aplicação manual de etiquetas ao contato (`actions.ts`) | `MEDIUM` | Não | **SIM** (Action test) | **SIM** | `QUEUED` |
| **`NANO-043`** | Visualizador de chat cronológico em `src/app/conversas` | `HIGH` | Não | **SIM** (Render test) | **SIM** | `QUEUED` |
| **`NANO-044`** | Exportação de contatos para CSV em `actions.ts` | `MEDIUM` | Não | **SIM** (CSV format) | **SIM** | `QUEUED` |

---

### EPIC-005: Verificação de Qualidade, Stress Test e Deploy (Fase 6)
*Ficha completa:* [`tasks/EPIC-005/TASK-005.md`](file:///Users/evandro/Downloads/Manychat/tasks/EPIC-005/TASK-005.md)

| Nano Task | Título | Risk Level | Research | Test Strategy | Review | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`NANO-051`** | Stress test simulando 100 webhooks concorrentes com HMAC | `HIGH` | **SIM** | **SIM** (Latency < 1s) | **SIM** | `QUEUED` |
| **`NANO-052`** | Auditoria visual completa de contraste e dark/light mode | `MEDIUM` | Não | **SIM** (WCAG AA) | **SIM** | `QUEUED` |
| **`NANO-053`** | Validação de build de produção `npm run build` e Vercel | `HIGH` | Não | **SIM** (Prerender check)| **SIM** | `QUEUED` |
| **`NANO-054`** | Smoke test ponta a ponta com conta real do Instagram | `CRITICAL` | Não | **SIM** (E2E Real) | **SIM** (Full SRE)| `QUEUED` |
