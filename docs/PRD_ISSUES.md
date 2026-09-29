# PRD_ISSUES — Registro de Inconsistências e Gaps de Especificação

> **Documento:** Rastreamento de Divergências entre Requisitos, Código e APIs  
> **Status:** Ativo  
> **Governança:** Start Inc. / Orquestrador de Execução  

---

### ISSUE-001: Ausência de Especificação de Fallback para Falhas de API da Meta no Seletor de Posts
- **ID:** `ISSUE-001`
- **PRD REFERENCE:** Seção 3, Módulo 2 (Editor de Automações)
- **ISSUE:** O PRD cita a seleção de publicações para gatilhos específicos, mas não especifica como o sistema deve reagir caso a Graph API da Meta esteja indisponível, a conta esteja desconectada ou o rate limit seja atingido.
- **TYPE:** `MISSING_REQUIREMENT`
- **IMPACT:** A interface do usuário poderia travar ou exibir erro genérico sem permitir que o usuário configure o fluxo.
- **EVIDENCE:** O componente `PostPicker.tsx` utilizava apenas `MOCK_POSTS` sem tratamento de estados de erro de rede.
- **STATUS:** `RESOLVED_BY_DECISION`
- **REQUIRED DECISION:** Implementar fallback defensivo retornando posts de demonstração e permitindo inserção manual de URL/ID em caso de erro na Meta API (vide `ADR-004`).

---

### ISSUE-002: Validação de Escopo de Mídia Específica no Webhook
- **ID:** `ISSUE-002`
- **PRD REFERENCE:** Seção 3, Módulo 3 (Motor de Execução)
- **ISSUE:** O payload do webhook de comentário da Meta envia `entry.changes[0].value.media.id`, mas o PRD não detalha a regra de precedência quando existem dois fluxos com a mesma palavra-chave (um para qualquer post e outro para um post específico).
- **TYPE:** `AMBIGUITY`
- **IMPACT:** Se o usuário comentar em um post com fluxo específico, o fluxo genérico ("qualquer post") poderia disparar incorretamente.
- **EVIDENCE:** `src/lib/engine/matcher.ts` filtrava apenas por palavra-chave sem checar `trigger.mediaId`.
- **STATUS:** `OPEN`
- **REQUIRED DECISION:** Definir regra estrita no matcher: fluxos com `scope: "specific"` e `mediaId` correspondente têm precedência absoluta sobre fluxos com `scope: "any"`.

---

### ISSUE-003: Armazenamento e Renovação de Token de Longa Duração (60 dias)
- **ID:** `ISSUE-003`
- **PRD REFERENCE:** Seção 3, Módulo 1 (Conexão & Onboarding)
- **ISSUE:** Tokens de acesso do Instagram gerados via Facebook Login expiram após 60 dias (`ig_refresh_token`). O PRD não especifica um worker de background para renovação periódica automática.
- **TYPE:** `DEPENDENCY`
- **IMPACT:** Automações param de funcionar silenciosamente após 60 dias caso não haja renovação.
- **EVIDENCE:** Método `refreshLongLivedToken` existe em `src/lib/meta/graph.ts`, mas não há cron job agendado para execução periódica.
- **STATUS:** `PENDING`
- **REQUIRED DECISION:** Mapear a criação de job de verificação de expiração no Roadmap da Fase 6.
