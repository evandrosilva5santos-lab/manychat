# PROJECT_MAP — Mapeamento Estrutural e Arquivos Críticos

> **Documento:** Mapa Completo do Repositório  
> **Objetivo:** Permitir localização instantânea de qualquer módulo, componente ou contrato.  
> **Localização:** `/Users/evandro/Downloads/Manychat`  

---

## 1. Identidade e Portas do Projeto

- **Nome Oficial:** Fluxo (Instagram Automation Platform)
- **Porta Obrigatória:** `3007` (`http://localhost:3007`)
- **Comando de Dev:** `npm run dev`
- **Comando de Testes:** `npm test`
- **Comando de Tipos:** `npx tsc --noEmit`

---

## 2. Estrutura de Diretórios e Arquivos Críticos

### Raiz
- `package.json`: Definição de scripts (`dev`, `build`, `test`, `start`), dependências (`next`, `react`, `zod`, `@xyflow/react`, `prisma`).
- `tsconfig.json`: Configuração TypeScript estrita com alias `@/*` apontando para `src/*`.
- `vitest.config.mts`: Configuração do executor de testes Vitest.
- `PRD.md`: Documento de Requisitos do Produto (Inalterável).
- `PRD_TRACEABILITY.md`: Rastreabilidade de cada requisito para sua respectiva Nano Task.
- `AGENTS.md`: Contrato operacional universal de regras de execução de agentes de IA.
- `CLAUDE.md`: Instruções operacionais para o agente Claude Code.

---

### Pasta `docs/` (Arquivos de Referência e Contratos)
- `docs/CONTEXT.md`: Visão do negócio, problema, personas, casos de uso.
- `docs/PROJECT_MAP.md`: Este mapa de localização.
- `docs/ARCHITECTURE.md`: Arquitetura técnica (Current State vs Target State).
- `docs/DESIGN.md`: Contrato de UX/UI, tokens de design, paleta de cores e componentes.
- `docs/RULES.md`: Regras invariantes de código, Meta API, design e segurança.
- `docs/DECISIONS.md`: Registro de decisões de arquitetura (ADRs).
- `docs/GLOSSARY.md`: Termos técnicos e de negócio.
- `docs/PRD_ISSUES.md`: Inconsistências e ambiguidades detectadas.

---

### Pasta `execution/` (Orquestração e Fila de Tarefas)
- `execution/MASTER_PLAN.md`: Plano hierárquico (Fase $\rightarrow$ Epic $\rightarrow$ Task $\rightarrow$ Micro $\rightarrow$ Nano).
- `execution/ROADMAP.md`: Visão temporal das entregas.
- `execution/CURRENT_TASK.md`: Única tarefa autorizada para execução no momento.
- `execution/TASK_QUEUE.md`: Fila de tarefas por status (`READY`, `IN_PROGRESS`, `BLOCKED`, `DONE`).
- `execution/EXECUTION_RULES.md`: Protocolo passo a passo para o agente executor.

---

### Pasta `state/` (Persistência do Estado do Projeto)
- `state/STATUS.md`: Estado atual global do projeto e da esteira.
- `state/CHANGELOG.md`: Registro formal de alterações realizadas.
- `state/BLOCKERS.md`: Registro de impedimentos e dependências.
- `state/HANDOFF.md`: Pacote formal de transferência para o próximo agente.

---

### Pasta `tasks/` (Especificações Atômicas de Tarefas)
- `tasks/EPIC-001/TASK-001.md`: Ficha atômica completa do Seletor de Posts com suas micro e nano tasks.

---

### Pasta `reports/` (Auditorias e Validações)
- `reports/INITIAL_AUDIT.md`: Snapshot do estado inicial do projeto.
- `reports/VALIDATION.md`: Matriz de validação de consistência documental.
- `reports/FINAL_AUDIT.md`: Checklist de saída para concessão do `READY_FOR_EXECUTION`.

---

### Código-Fonte Frontend (`src/app` e `src/components`)
- `src/app/page.tsx`: Dashboard inicial com métricas de envios e taxas de abertura.
- `src/app/fluxos/page.tsx`: Lista de automações criadas com cards de status e botão de criar.
- `src/app/fluxos/[id]/page.tsx`: Página do editor de automação (alterna entre Easy Builder e React Flow).
- `src/app/contatos/page.tsx`: Painel de CRM de contatos com filtros por tags e modal de criação de contato.
- `src/app/conversas/page.tsx`: Histórico de mensagens recebidas e enviadas.
- `src/app/catalogo/page.tsx`: Catálogo de cards reutilizáveis para mensagens em carrossel.
- `src/app/ajustes/page.tsx`: Configurações de credenciais da Meta e status da conexão.
- `src/components/simple-builder/SimpleBuilder.tsx`: Easy Builder em formato de formulário progressivo.
- `src/components/simple-builder/PostPicker.tsx`: Componente de seleção visual de posts/reels do Instagram.
- `src/components/simple-builder/DmPreview.tsx`: Simulador interativo de smartphone com direct do Instagram.
- `src/components/flow-editor/FlowCanvas.tsx`: Canvas visual de nós `@xyflow/react`.
- `src/components/layout/Sidebar.tsx`: Barra lateral com links de navegação.

---

### Código-Fonte Backend e Integrações (`src/lib` e `src/app/api`)
- `src/lib/meta/graph.ts`: Cliente HTTP para chamadas à Meta Graph API v21.0.
- `src/lib/meta/webhook.ts`: Funções de verificação HMAC SHA-256 e parsing de eventos de webhook.
- `src/lib/meta/window.ts`: Verificador de regra de conformidade da janela de 24h da Meta.
- `src/lib/engine/engine.ts`: Motor de execução de nós (`FlowRunner`).
- `src/lib/engine/matcher.ts`: Roteador que associa comentários e mensagens recebidas aos fluxos ativos.
- `src/lib/flow/recipe.ts`: Schema Zod e compilador que traduz o Easy Builder em nós do React Flow.
- `src/app/api/webhook/instagram/route.ts`: Endpoint GET (challenge) e POST (eventos) da Meta.
- `src/app/api/l/[code]/route.ts`: Endpoint de rastreamento de cliques e redirecionamento.
- `src/proxy.ts`: Proxy HTTP para controle de acesso em ambiente local.
- `prisma/schema.prisma`: Definição de modelos de banco (`InstagramAccount`, `Contact`, `Flow`, `Trigger`, etc.).
