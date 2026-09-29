# TASK-002: Painel de Catálogo e Carrossel de Cards na Graph API

> **Epic:** `EPIC-002` (Catálogo de Cards & Carrossel Interativo)  
> **Fase:** `FASE 4` (Catálogo & Carrossel Interativo)  
> **Framework de Engenharia:** Metodologia ECC (Everything Claude Code)  
> **Prioridade:** P2 (Média)  
> **Origem:** `PRD.md` Módulo 2 e Módulo 5 / `SCHEMA.md` Entidade `CatalogItem` e `CarouselCard`  

---

## 1. Visão Geral da Decomposição ECC

```text
TASK-002: Implementação do Catálogo e Nós de Carrossel
├── MICRO-002.01: Modelagem e Endpoints do Catálogo
│   ├── NANO-021 [MEDIUM]: Criar Server Actions / rotas REST para CRUD de itens do catálogo em `src/app/catalogo/actions.ts`
│   └── NANO-022 [MEDIUM]: Criar interface visual de cards reutilizáveis em `src/app/catalogo/page.tsx`
└── MICRO-002.02: Integração com Graph API e Engine
    ├── NANO-023 [HIGH]: Implementar suporte ao nó `CAROUSEL` no `FlowRunner` (`src/lib/engine/engine.ts`)
    └── NANO-024 [HIGH]: Implementar envio de `generic template` com até 10 cards no `InstagramGraphClient` (`src/lib/meta/graph.ts`)
```

---

## 2. Especificação Detalhada das Nano Tasks

### NANO-021: CRUD de Itens do Catálogo
- **ID:** `NANO-021`
- **TITLE:** Criar Server Actions para criar, editar, listar e desativar itens do catálogo
- **RISK LEVEL:** `MEDIUM`
- **OBJECTIVE:** Permitir a persistência de cards com imagem, título, subtítulo e URL no banco via Prisma.
- **SOURCE REQUIREMENT:** `PRD.md` Módulo 2 / `SCHEMA.md` (`CatalogItem`).
- **BUSINESS CONTEXT:** O operador cadastra seus produtos/materiais uma vez só e reutiliza em múltiplos fluxos de automação.
- **TECHNICAL CONTEXT:** Modelo `CatalogItem` já existe no `prisma/schema.prisma`.
- **PRECONDITIONS:** `EPIC-001` concluído.
- **DEPENDENCIES:** `NANO-004`.
- **ALLOWED FILES:**
  - `src/app/catalogo/actions.ts`
  - `src/app/catalogo/schema.ts`
- **FORBIDDEN FILES:**
  - `PRD.md`
  - `src/lib/engine/*`
- **RESEARCH REQUIRED:** Sim (verificar schema Prisma para campos obrigatórios de `CatalogItem`).
- **RESEARCH QUESTIONS:** `CatalogItem` suporta botões com URL e postback simultâneos?
- **IMPLEMENTATION ACTION:** Criar validação Zod e funções assíncronas `createCatalogItem`, `updateCatalogItem`, `deleteCatalogItem`, `listCatalogItems`.
- **EXPECTED RESULT:** Itens do catálogo podem ser criados e consultados com segurança.
- **ACCEPTANCE CRITERIA:** Validação de campos (título máx. 80 chars, subtítulo máx. 80 chars, URL válida).
- **TEST STRATEGY:** Teste unitário com Vitest simulando chamadas à action.
- **VALIDATION STRATEGY:**
  - *Level 1:* `npx tsc --noEmit` sem erros.
  - *Level 2:* `npm test` verde.
  - *Level 3:* Atendimento ao schema Prisma.
- **REVIEW STRATEGY:** Checar injeção de dados e sanitização de URLs.
- **SECURITY CONSIDERATIONS:** Bloquear URLs maliciosas (`javascript:` ou não-HTTPS).
- **PERFORMANCE CONSIDERATIONS:** Paginação caso o catálogo exceda 50 itens.
- **DESIGN CONSIDERATIONS:** N/A (Backend).
- **DOCUMENTATION IMPACT:** Registrar em `state/CHANGELOG.md`.
- **MEMORY IMPACT:** N/A.
- **NEXT TASK:** `NANO-022`.

---

### NANO-022: Interface Visual do Catálogo
- **ID:** `NANO-022`
- **TITLE:** Criar painel visual de gerenciamento de cards do catálogo (`/catalogo`)
- **RISK LEVEL:** `MEDIUM`
- **OBJECTIVE:** Interface intuitiva para visualização em grade dos cards cadastrados com upload/preview de imagem.
- **SOURCE REQUIREMENT:** `docs/DESIGN.md` e `docs/CONTEXT.md`.
- **BUSINESS CONTEXT:** Visão centralizada de produtos e ofertas da conta.
- **TECHNICAL CONTEXT:** Client component em `src/app/catalogo/page.tsx` e componentes em `src/app/catalogo/components/`.
- **PRECONDITIONS:** `NANO-021` concluída.
- **DEPENDENCIES:** `NANO-021`.
- **ALLOWED FILES:**
  - `src/app/catalogo/page.tsx`
  - `src/app/catalogo/CatalogClient.tsx`
- **FORBIDDEN FILES:**
  - `src/app/api/*`
  - `src/lib/meta/*`
- **RESEARCH REQUIRED:** Não.
- **RESEARCH QUESTIONS:** N/A.
- **IMPLEMENTATION ACTION:** Renderizar grade responsiva (1 col mobile, 3 cols desktop), modal de criação de card com preview e feedback de salvamento.
- **EXPECTED RESULT:** Usuário gerencia seus cards visuais com feedback imediato.
- **ACCEPTANCE CRITERIA:** Seguir paleta e classes do `docs/DESIGN.md`.
- **TEST STRATEGY:** Teste de renderização com Vitest.
- **VALIDATION STRATEGY:**
  - *Level 1:* Zero erros de console e tipos.
  - *Level 2:* Integração com `actions.ts`.
  - *Level 3:* UX de criação em menos de 1 minuto.
- **REVIEW STRATEGY:** Verificar estados de loading, skeleton e empty state.
- **SECURITY CONSIDERATIONS:** Escapar textos para evitar XSS.
- **PERFORMANCE CONSIDERATIONS:** Otimização de imagens com Next Image ou loading lazy.
- **DESIGN CONSIDERATIONS:** Cards no padrão surface-200 com cantos arredondados de 12px.
- **DOCUMENTATION IMPACT:** Registrar em `state/CHANGELOG.md`.
- **MEMORY IMPACT:** N/A.
- **NEXT TASK:** `NANO-023`.

---

### NANO-023: Suporte ao Nó CAROUSEL no FlowRunner
- **ID:** `NANO-023`
- **TITLE:** Processar nó de carrossel no motor de execução de fluxos
- **RISK LEVEL:** `HIGH`
- **OBJECTIVE:** Fazer com que o `FlowRunner` reconheça o nó `CAROUSEL` e despache os cards montados para a Meta API.
- **SOURCE REQUIREMENT:** `PRD.md` Módulo 3.
- **BUSINESS CONTEXT:** Enviar múltiplos produtos em sequência horizontal na DM do lead.
- **TECHNICAL CONTEXT:** `src/lib/engine/engine.ts`.
- **PRECONDITIONS:** `NANO-022` concluída.
- **DEPENDENCIES:** `NANO-022`.
- **ALLOWED FILES:**
  - `src/lib/engine/engine.ts`
  - `src/lib/engine/engine.test.ts`
- **FORBIDDEN FILES:**
  - `src/components/*`
- **RESEARCH REQUIRED:** Sim (verificar limites da Meta para generic templates: máx 10 elementos, máx 3 botões por elemento).
- **RESEARCH QUESTIONS:** O que fazer se o fluxo tiver mais de 10 cards? (Travar e enviar apenas os primeiros 10 conforme invariante da Meta).
- **IMPLEMENTATION ACTION:** Adicionar `case "CAROUSEL":` no `FlowRunner.executeNode()`.
- **EXPECTED RESULT:** Mensagem em carrossel despachada corretamente para o contato.
- **ACCEPTANCE CRITERIA:** Respeitar limite de 10 cards e janela de 24h.
- **TEST STRATEGY:** Testes unitários cobrindo o dispatch do carrossel no `engine.test.ts`.
- **VALIDATION STRATEGY:**
  - *Level 1:* Testes do engine passando.
  - *Level 2:* Gravação da mensagem no log de `Message` com type `OUT`.
  - *Level 3:* Conformidade com a Send API da Meta.
- **REVIEW STRATEGY:** Fresh context review focado em idempotência e tratamento de erro de envio.
- **SECURITY CONSIDERATIONS:** Validar permissão da conta e sanitizar payloads de botões.
- **PERFORMANCE CONSIDERATIONS:** Montagem assíncrona do payload sem bloquear o event loop.
- **DESIGN CONSIDERATIONS:** N/A.
- **DOCUMENTATION IMPACT:** Registrar em `state/CHANGELOG.md`.
- **MEMORY IMPACT:** N/A.
- **NEXT TASK:** `NANO-024`.

---

### NANO-024: Envio de Generic Template na Graph API
- **ID:** `NANO-024`
- **TITLE:** Integrar método `sendGenericTemplateMessage` com validação de limites da Meta
- **RISK LEVEL:** `HIGH`
- **OBJECTIVE:** Disparar a chamada HTTP real para `https://graph.facebook.com/v21.0/me/messages` com `template_type: "generic"`.
- **SOURCE REQUIREMENT:** `API_CONTRACTS.md` e `docs/RULES.md`.
- **BUSINESS CONTEXT:** Entrega confiável do carrossel no direct do Instagram.
- **TECHNICAL CONTEXT:** `src/lib/meta/graph.ts`.
- **PRECONDITIONS:** `NANO-023` concluída.
- **DEPENDENCIES:** `NANO-023`.
- **ALLOWED FILES:**
  - `src/lib/meta/graph.ts`
  - `src/lib/meta/graph.test.ts`
- **FORBIDDEN FILES:**
  - Qualquer outro arquivo.
- **RESEARCH REQUIRED:** Não.
- **RESEARCH QUESTIONS:** N/A.
- **IMPLEMENTATION ACTION:** Adicionar validação de payload no método `sendGenericTemplateMessage` já existente e cobrir com testes no Vitest.
- **EXPECTED RESULT:** Resposta HTTP 200 da Meta com message_id ou fallback mock em ambiente de teste.
- **ACCEPTANCE CRITERIA:** Tratar códigos de erro 100/190 da Meta com mensagens amigáveis.
- **TEST STRATEGY:** Testes no Vitest validando a formatação do JSON e o modo mock.
- **VALIDATION STRATEGY:**
  - *Level 1:* `npm test` verde.
  - *Level 2:* `npx tsc --noEmit` código 0.
  - *Level 3:* Conformidade com o PRD Módulo 2.
- **REVIEW STRATEGY:** Verificar expiração de token.
- **SECURITY CONSIDERATIONS:** Token não exposto.
- **PERFORMANCE CONSIDERATIONS:** Timeout de 5s para evitar requisições travadas.
- **DESIGN CONSIDERATIONS:** N/A.
- **DOCUMENTATION IMPACT:** Concluir `EPIC-002` em `execution/TASK_QUEUE.md`.
- **MEMORY IMPACT:** Registrar limites aprendidos em `docs/RULES.md`.
- **NEXT TASK:** Início do `EPIC-003`.
