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
- **STATUS:** `RESOLVED` (NANO-004 em `DONE`; `matcher.ts` filtra por `mediaId`)
- **REQUIRED DECISION:** Definir regra estrita no matcher: fluxos com `scope: "specific"` e `mediaId` correspondente têm precedência absoluta sobre fluxos com `scope: "any"`.

---

### ISSUE-003: Armazenamento e Renovação de Token de Longa Duração (60 dias)
- **ID:** `ISSUE-003`
- **PRD REFERENCE:** Seção 3, Módulo 1 (Conexão & Onboarding)
- **ISSUE:** Tokens de acesso do Instagram gerados via Facebook Login expiram após 60 dias (`ig_refresh_token`). O PRD não especifica um worker de background para renovação periódica automática.
- **TYPE:** `DEPENDENCY`
- **IMPACT:** Automações param de funcionar silenciosamente após 60 dias caso não haja renovação.
- **EVIDENCE:** Método `refreshLongLivedToken` existe em `src/lib/meta/graph.ts`, mas não há cron job agendado para execução periódica.
- **STATUS:** `RESOLVED` (cron diário `/api/cron/refresh-tokens` em `vercel.json`)
- **REQUIRED DECISION:** Mapear a criação de job de verificação de expiração no Roadmap da Fase 6.

---

## Saneamento de 12/10/2026 (PRD imutável — divergências registradas aqui)

### ISSUE-004: PRD pede Facebook Login; o produto usa Instagram Login + Facebook Login
- **PRD REFERENCE:** Seção 3, Módulo 1 · **TYPE:** `OUTDATED_REQUIREMENT`
- **EVIDENCE:** ADR-005 (Instagram Login) e ADR-006 (login duplo).
- **STATUS:** `OPEN` — dono decide se publica uma v1.1 do PRD.

### ISSUE-005: Nome do produto
- **ISSUE:** O PRD chama o produto de "Fluxo"; a marca agora é **instachat** (minúsculo), com logos em `design-system/assets/brand/`.
- **STATUS:** `OPEN` — dono decide se publica uma v1.1 do PRD.

### ISSUE-006: Caixas do PRD desmarcadas para itens já entregues
- **ISSUE:** Módulos 1, 3, 4, 5 e 6 aparecem `[ ]`, mas webhook com HMAC, roteador, runner, links rastreados, contatos, etiquetas, proteção de rotas e criptografia de token estão implementados e testados (ver `PRD_TRACEABILITY.md`).
- **STATUS:** `OPEN` — só o dono pode marcar o PRD.

### ISSUE-007: REG-API-002 (fallback mock) contradiz a regra "zero dados falsos"
- **EVIDENCE:** REG-API-002 e ADR-004 pedem posts de demonstração; `docs/prompts-execucao/00-PROMPT-MESTRE.md` §3.1 proíbe dados fictícios em produção, e o código mostra estado de erro honesto.
- **STATUS:** `OPEN` — dono decide qual regra vale; o código segue "zero dados falsos".

### ISSUE-008: Cobrança — PRD/REG-SCOPE-001 proíbem, prompt 08 pede
- **EVIDENCE:** PRD §4 e REG-SCOPE-001 × `08-saas-pronto-para-vender.md` §8d. Hoje há só um stub `/api/webhook/stripe` (+ `src/lib/stripe`, dependência `stripe`) que registra eventos no log e não faz nada.
- **STATUS:** `OPEN` — remover o stub ou abrir o escopo de cobrança.

### ISSUE-009: Páginas fora do escopo no menu
- **EVIDENCE:** `/ai` ("Agentes de IA") e `/direct` ("Transmissão") são vitrines "Em breve"; PRD §4 exclui IA generativa e broadcast.
- **STATUS:** `OPEN` — dono decide se saem do menu.

### ISSUE-010: REG-SCOPE-002 e a esteira NANO
- **ISSUE:** REG-SCOPE-002 só autoriza a NANO de `CURRENT_TASK.md`; desde 10/10 o dono autoriza pacotes inteiros (itens 1–8, login duplo, Perfil seguro, marca).
- **STATUS:** `OPEN` — a regra segue válida; `CURRENT_TASK.md` registra o pacote autorizado.
