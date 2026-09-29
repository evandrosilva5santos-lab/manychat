# TASK-001: Seletor Visual de Posts do Instagram Conectado à Meta Graph API

> **Epic:** `EPIC-001` (Mídia & Gatilhos Específicos)  
> **Fase:** `FASE 2` (Editor Visual & Seletor de Mídia)  
> **Framework de Engenharia:** Metodologia ECC (Everything Claude Code)  
> **Prioridade:** P1 (Alta)  
> **Origem:** `PRD.md` Módulo 2 / Item 18 da Auditoria QA  

---

## 1. Visão Geral da Decomposição ECC

```text
TASK-001: Seletor Visual de Publicações do Instagram
├── MICRO-001.01: Backend Graph API e Rota de Mídia
│   ├── NANO-001 [HIGH]: Implementar método `getUserMedia` em `graph.ts` e endpoint `GET /api/instagram/media` com fallback mock
│   └── NANO-002 [MEDIUM]: Criar suite de testes unitários para a rota `/api/instagram/media` no Vitest
└── MICRO-001.02: Frontend Dinâmico e Validação de Webhook
    ├── NANO-003 [MEDIUM]: Conectar `PostPicker.tsx` com `fetch('/api/instagram/media')` exibindo loading e abas de filtro
    └── NANO-004 [HIGH]: Atualizar `matcher.ts` e `recipe.ts` para validar `mediaId` no webhook quando `scope === 'specific'`
```

---

## 2. Especificação Detalhada das Nano Tasks (25 Campos Canônicos)

### 🟢 NANO-001: Implementar método `getUserMedia` e Rota `GET /api/instagram/media`

- **ID:** `NANO-001`
- **TITLE:** Adicionar busca de mídia no `InstagramGraphClient` (`src/lib/meta/graph.ts`) e rota `GET /api/instagram/media` com fallback mock defensivo.
- **OBJECTIVE:** Permitir que o backend consulte as últimas publicações/reels da conta conectada da Meta via Graph API v21.0 ou retorne mock inteligente defensivo caso sem token/offline, servindo dados normalizados para a interface.
- **CONTEXT:** Atualmente o `src/lib/meta/graph.ts` possui métodos de envio de mensagens e perfil, mas não possui busca de posts (`/{ig-user-id}/media`). A rota `/api/instagram/media` fornecerá os dados formatados para o componente visual.
- **SOURCE REQUIREMENT:** `PRD.md` Seção 3 (Módulo 2), `docs/DECISIONS.md` (`ADR-004`) e `PRD_TRACEABILITY.md` (`REQ-005`).
- **BUSINESS CONTEXT:** O criador de conteúdo precisa selecionar a publicação exata sobre a qual fez o Reels para automatizar o envio da DM com o link correto, sem digitar IDs complexos ou links manualmente.
- **TECHNICAL CONTEXT:** `src/lib/meta/graph.ts` já implementa métodos de envio de mensagens e perfil. O endpoint `GET /{ig-user-id}/media` da Meta Graph API v21.0 retorna as mídias da conta. É necessário criar uma rota Next.js App Router em `src/app/api/instagram/media/route.ts`.
- **PRECONDITIONS:**
  - Repositório limpo com `npm test` passando 46/46 testes.
  - Porta `3007` disponível.
- **DEPENDENCIES:** Nenhuma (Primeira nano task da esteira).
- **ALLOWED FILES:**
  - `src/lib/meta/graph.ts`
  - `src/app/api/instagram/media/route.ts`
- **FORBIDDEN FILES:**
  - `PRD.md` (Imutável)
  - `src/components/simple-builder/PostPicker.tsx` (Alterado apenas na NANO-003)
  - `src/lib/engine/engine.ts`
  - `prisma/schema.prisma`
  - `package.json`
- **RESEARCH REQUIRED:** Sim.
- **RESEARCH QUESTIONS:**
  - Qual a estrutura de campos aceita por `GET /{ig-user-id}/media` na Graph API v21.0? (`id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count`).
  - Como o `InstagramGraphClient` trata fallback quando `!this.accessToken || process.env.NODE_ENV === "test"`? (Retorna objeto com `mock: true`).
- **EXACT ACTION:**
  1. Em `src/lib/meta/graph.ts`:
     - Declarar e exportar o tipo:
       ```typescript
       export type InstagramMediaItem = {
         id: string;
         caption?: string;
         mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
         mediaUrl?: string;
         thumbnailUrl?: string;
         permalink?: string;
         timestamp?: string;
         likeCount?: number;
         commentsCount?: number;
       };
       ```
     - Adicionar o método na classe `InstagramGraphClient`:
       ```typescript
       async getUserMedia(igUserId?: string, limit = 25): Promise<{
         success: boolean;
         data: InstagramMediaItem[];
         mock?: boolean;
         error?: string;
       }>
       ```
     - Caso sem token ou em teste, retornar lista mock rica estruturada com `mock: true`.
     - Caso exista token, executar fetch em `${GRAPH_API_BASE}/${targetUserId}/media` com Bearer Token. Tratar `!response.ok` defensivamente com fallback.
  2. Em `src/app/api/instagram/media/route.ts`:
     - Implementar handler `export async function GET(req: Request)`.
     - Chamar `defaultGraphClient.getUserMedia()`.
     - Retornar `NextResponse.json(result, { status: result.success ? 200 : 500 })`.
- **EXPECTED RESULT:** Requisição HTTP `GET http://localhost:3007/api/instagram/media` retorna JSON com status 200 contendo `{ success: true, data: [...] }`.
- **ACCEPTANCE CRITERIA:**
  - Retorna array de posts com campos normalizados.
  - Não quebra caso a Meta esteja offline ou sem token (retorna fallback gracioso).
  - Zero erros de tipagem com `npx tsc --noEmit`.
  - Suíte de 46 testes existentes permanece 100% verde (`npm test`).
- **TEST STRATEGY:**
  - *Test Before:* `curl -s http://localhost:3007/api/instagram/media` falha com 404 (rota ainda não existe).
  - *Test After:* `curl -s http://localhost:3007/api/instagram/media` retorna 200 com JSON válido contendo `success: true`.
- **VALIDATION METHOD:**
  - Executar `npm run verify` (`vitest run && tsc --noEmit`).
  - Executar `curl -s http://localhost:3007/api/instagram/media` confirmando status 200 e payload esperado.
- **RISKS:** Conexão externa à Meta API cair ou ter timeout $\rightarrow$ mitigado pelo bloco `try/catch` com fallback para lista mock.
- **SECURITY CONSIDERATIONS:**
  - O `IG_ACCESS_TOKEN` nunca é exposto no payload retornado para o navegador.
  - Limite de quantidade (`limit = 25`) para evitar sobrecarga de memória.
- **PERFORMANCE CONSIDERATIONS:**
  - Busca de campos essenciais sem overhead de requisições N+1.
- **DESIGN CONSIDERATIONS:**
  - Nenhuma alteração visual nesta etapa (escopo restrito ao backend).
- **DOCUMENTATION IMPACT:** Atualizar `state/CHANGELOG.md` e mover para `DONE` em `execution/TASK_QUEUE.md`.
- **MEMORY IMPACT:** Se surgir comportamento inesperado na Meta API, registrar em `docs/PRD_ISSUES.md`.
- **NEXT NANO TASK:** `NANO-002`.

---

### 🟡 NANO-002: Testes Unitários para a Rota e Cliente de Mídia

- **ID:** `NANO-002`
- **TITLE:** Criar suíte de testes unitários para `getUserMedia` no Vitest
- **OBJECTIVE:** Garantir cobertura automatizada para o método `getUserMedia`, cobrindo cenários de sucesso mock, parsing de campos e tratamento de erros.
- **CONTEXT:** Toda nova funcionalidade deve ser blindada por testes antes de avançar para a interface visual.
- **SOURCE REQUIREMENT:** `docs/RULES.md` (`REG-TEST-002`) e metodologia ECC (Test-First/TDD).
- **BUSINESS CONTEXT:** Prevenir que futuras alterações quebrem a integração com a listagem de posts da Meta.
- **TECHNICAL CONTEXT:** Utilizar o framework Vitest já configurado no projeto (`vitest.config.mts`).
- **PRECONDITIONS:** `NANO-001` concluída e validada.
- **DEPENDENCIES:** `NANO-001`.
- **ALLOWED FILES:**
  - `src/lib/meta/graph.test.ts`
- **FORBIDDEN FILES:**
  - Todos os arquivos fora de testes.
- **RESEARCH REQUIRED:** Não.
- **RESEARCH QUESTIONS:** Nenhuma.
- **EXACT ACTION:** Criar arquivo `src/lib/meta/graph.test.ts` com testes cobrindo `defaultGraphClient.getUserMedia()`.
- **EXPECTED RESULT:** `npm test` executa 4 arquivos de teste com 100% de aprovação.
- **ACCEPTANCE CRITERIA:** Todos os testes novos passam sem warnings.
- **TEST STRATEGY:** TDD (escrever testes com asserções para o mock e validações).
- **VALIDATION METHOD:** `npm run verify` passando com 100% dos testes verdes.
- **RISKS:** Mocks mal formatados divergirem da API real $\rightarrow$ mitigado pelo schema de tipos TypeScript.
- **SECURITY CONSIDERATIONS:** Não incluir tokens reais em arquivos de teste.
- **PERFORMANCE CONSIDERATIONS:** Testes rápidos (< 200ms).
- **DESIGN CONSIDERATIONS:** N/A.
- **DOCUMENTATION IMPACT:** Registrar cobertura em `state/CHANGELOG.md`.
- **MEMORY IMPACT:** N/A.
- **NEXT NANO TASK:** `NANO-003`.

---

### 🟡 NANO-003: Conectar `PostPicker.tsx` com a Rota de Mídia Viva e Filtros

- **ID:** `NANO-003`
- **TITLE:** Integrar `PostPicker.tsx` com `fetch('/api/instagram/media')`, abas de filtro e skeleton animado
- **OBJECTIVE:** Fazer com que o seletor visual exiba as postagens reais retornadas pela API, com opção de filtrar por Reels, Carrossel ou Imagem, e skeleton suave de carregamento.
- **CONTEXT:** O componente atual possui UI estática com `MOCK_POSTS`. Deve consumir a API com reatividade.
- **SOURCE REQUIREMENT:** `PRD.md` Seção 3 (Módulo 2) e `docs/DESIGN.md` Seção 5.2.
- **BUSINESS CONTEXT:** Experiência de uso fluida para o infoprodutor selecionar o post sem fricção.
- **TECHNICAL CONTEXT:** Componente Client Component (`"use client"`) em `src/components/simple-builder/PostPicker.tsx`.
- **PRECONDITIONS:** `NANO-001` e `NANO-002` concluídas.
- **DEPENDENCIES:** `NANO-001`, `NANO-002`.
- **ALLOWED FILES:**
  - `src/components/simple-builder/PostPicker.tsx`
- **FORBIDDEN FILES:**
  - `src/lib/engine/*`
  - `src/app/api/webhook/*`
  - `prisma/*`
- **RESEARCH REQUIRED:** Sim (verificar se Tailwind v4 suporta `animate-pulse` nativo sem plugins).
- **RESEARCH QUESTIONS:** O componente `PostPicker` preserva a seleção ao fechar o modal? (Sim, via callback `onSelect`).
- **EXACT ACTION:**
  - Adicionar estado de loading (`isLoading: boolean`) e lista dinâmica (`posts: InstagramMediaItem[]`).
  - Adicionar `useEffect` que executa `fetch('/api/instagram/media')` ao montar o componente.
  - Implementar abas de filtro no modal: `Todos`, `Reels`, `Carrosséis`, `Fotos`.
  - Exibir skeleton de carregamento enquanto `isLoading === true`.
- **EXPECTED RESULT:** O modal abre exibindo os posts retornados pela API e permite filtrar e selecionar normalmente.
- **ACCEPTANCE CRITERIA:**
  - UI 100% responsiva conforme `docs/DESIGN.md`.
  - Botão de fallback manual ("Ou cole o link direto") preservado.
  - Zero erros de compilação ou console.
- **TEST STRATEGY:** Teste visual no browser em `http://localhost:3007/fluxos/[id]`.
- **VALIDATION METHOD:** `npm run verify` e inspeção visual da UI no navegador.
- **RISKS:** Imagens externas com CORS bloqueado $\rightarrow$ mitigado usando `img` padrão ou proxies locais.
- **SECURITY CONSIDERATIONS:** Sanitização de URLs de imagens externas.
- **PERFORMANCE CONSIDERATIONS:** Imagens com `loading="lazy"`.
- **DESIGN CONSIDERATIONS:** Seguir rigorosamente o padrão de grade de 3 colunas e cards de 68px de `docs/DESIGN.md`.
- **DOCUMENTATION IMPACT:** Registrar atualização de UI em `state/CHANGELOG.md`.
- **MEMORY IMPACT:** N/A.
- **NEXT NANO TASK:** `NANO-004`.

---

### 🟢 NANO-004: Validação de `mediaId` no Webhook e Matcher

- **ID:** `NANO-004`
- **TITLE:** Ajustar `matcher.ts` para verificar `mediaId` em comentários quando `scope === 'specific'`
- **OBJECTIVE:** Garantir que automações vinculadas a uma publicação específica só disparem se o comentário foi realizado exatamente naquele `mediaId`.
- **CONTEXT:** O motor precisa distinguir se a automação deve disparar para qualquer post ou apenas para o post selecionado.
- **SOURCE REQUIREMENT:** `docs/PRD_ISSUES.md` (`ISSUE-002`) e `PRD_TRACEABILITY.md` (`REQ-010`).
- **BUSINESS CONTEXT:** Evitar disparos indevidos em posts aleatórios da conta quando o criador configurou o fluxo para um único vídeo.
- **TECHNICAL CONTEXT:** `src/lib/engine/matcher.ts` processa eventos de webhook e localiza o fluxo ativo correspondente.
- **PRECONDITIONS:** `NANO-003` concluída.
- **DEPENDENCIES:** `NANO-003`.
- **ALLOWED FILES:**
  - `src/lib/engine/matcher.ts`
  - `src/lib/engine/engine.test.ts`
- **FORBIDDEN FILES:**
  - `src/components/*`
  - `src/app/globals.css`
- **RESEARCH REQUIRED:** Sim (analisar como `matcher.ts` lida com `trigger.scope` e `trigger.mediaId`).
- **RESEARCH QUESTIONS:** O webhook de comentário sempre envia `entry[0].changes[0].value.media.id`? (Sim, padrão Meta Graph API v21.0).
- **EXACT ACTION:**
  - No `matcher.ts`, dentro da verificação de gatilhos do tipo comentário:
    - Se `trigger.scope === 'specific'`, verificar se `eventMediaId === trigger.mediaId`. Caso discorde, ignorar o fluxo.
  - No `src/lib/engine/engine.test.ts`, adicionar cenários de teste validando o filtro por post específico.
- **EXPECTED RESULT:** Comentários no post específico ativam o fluxo; comentários em outros posts não ativam.
- **ACCEPTANCE CRITERIA:**
  - Testes unitários cobrem match positivo e match negativo por `mediaId`.
  - 100% dos testes passando no Vitest (`npm test`).
- **TEST STRATEGY:** TDD (escrever testes com asserções de match específico antes e fazê-los passar).
- **VALIDATION METHOD:** `npm run verify` com nova suite de matching por `mediaId` passando 100%.
- **RISKS:** Quebrar fluxos que usam `scope === 'any'` $\rightarrow$ mitigado por testes de regressão.
- **SECURITY CONSIDERATIONS:** Validação de string segura sem risco de bypass.
- **PERFORMANCE CONSIDERATIONS:** Checagem em memória $O(1)$ sem consultas extras ao banco.
- **DESIGN CONSIDERATIONS:** N/A.
- **DOCUMENTATION IMPACT:** Registrar encerramento do `EPIC-001` em `state/CHANGELOG.md`.
- **MEMORY IMPACT:** Fechar `ISSUE-002` em `docs/PRD_ISSUES.md`.
- **NEXT NANO TASK:** Conclusão do EPIC-001 e Handoff para o EPIC-002.
