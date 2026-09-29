# CURRENT_TASK — Autorização Operacional de Execução

> **Documento:** Autorização Formal de Execução  
> **Status:** `READY_FOR_EXECUTION`  
> **Framework:** Everything Claude Code (ECC)  
> **Agente Autorizado:** `CLAUDE` (Claude Code)  
> **Orquestrador Emissor:** `ANTIGRAVITY`  

---

## 🎯 Ficha Canônica da Nano Task Autorizada

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

## 🛑 Protocolo de Execução do Claude Code
1. Leia `CLAUDE.md` e `AGENTS.md`.
2. Execute o ciclo ECC: Research $\rightarrow$ Plan $\rightarrow$ Test $\rightarrow$ Implement $\rightarrow$ Review $\rightarrow$ Verify.
3. Altere estritamente os `ALLOWED FILES`.
4. Valide com `npm run verify`.
5. Atualize `state/CHANGELOG.md`, `state/STATUS.md` e prepare `state/HANDOFF.md`.
