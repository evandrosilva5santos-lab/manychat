# STATUS — Estado Operacional do Projeto (Fluxo)

> **Documento:** Painel Central de Estado da Esteira  
> **Última Atualização:** 29/09/2026 02:55 (Horário Local)  
> **Governança:** Start Inc. / Orquestrador Antigravity  

---

- **PROJECT:** Fluxo (Instagram Automation Platform)
- **GLOBAL STATUS:** `READY_FOR_EXECUTION` (NANO-001 validada e aprovada; NANO-002 autorizada)
- **CURRENT PHASE:** `FASE 2` (Editor Visual & Seletor de Mídia)
- **CURRENT EPIC:** `EPIC-001` (Seletor Visual de Publicações do Instagram)
- **CURRENT TASK:** `TASK-001` (Implementação Ponta a Ponta do Seletor de Posts)
- **CURRENT MICRO TASK:** `MICRO-001.01` (Backend Graph API e Rota de Mídia)
- **CURRENT NANO TASK:** `NANO-002` (Criar suíte de testes unitários para `getUserMedia` e rota `/api/instagram/media` no Vitest)
- **RESPONSIBLE AGENT:** `CLAUDE` (Claude Code)
- **PROGRESS:** 
  - FASE 1: 100% Concluída
  - FASE 2: 75% Concluída (`NANO-001` [DONE], `NANO-002` [READY], `NANO-003` [BLOCKED], `NANO-004` [BLOCKED])
  - FASES 3 a 6: Fichas detalhadas e mapeadas
- **BLOCKERS:** Nenhum (BLK-001, BLK-002 e BLK-003 estão `RESOLVED`).
- **PENDING DECISIONS:** Nenhuma.
- **LAST VALIDATION:**
  - `NANO-001`: Level 1 TSC (0 erros), Level 2 Vitest (51/51 testes passando), Level 3 Runtime (HTTP 200 com payload `{ success: true, data: [...] }`).
- **LAST CHANGE:** `NANO-001` concluída e movida para `DONE` em `execution/TASK_QUEUE.md`.
- **NEXT ACTION:** Execução da `NANO-002` (`src/lib/meta/graph.test.ts`) pelo Claude Code.
- **LAST HANDOFF:** `HANDOFF-002-ECC` (Antigravity $\rightarrow$ Claude Code).


## Atualização 2026-10-11 — Item 03 (Instagram Business Login OAuth Oficial & Multi-Conta)
- **STATUS:** ✅ `DONE` (100% Concluído e Validado)
- **OAUTH & TOKENS:**
  - Fluxo completo de Instagram Business Login (`/api/auth/instagram/login` e `/api/auth/instagram/callback`).
  - Troca automática por Long-Lived Token (60 dias) com auto-subscrição de Webhooks (`comments`, `messages`, `messaging_postbacks`).
  - Tokens salvos no Supabase Postgres criptografados com **AES-256-GCM** via chave `TOKEN_ENCRYPTION_KEY`.
  - Suporte multi-conta via `account-client.ts`.
  - Painel de Ajustes (`/ajustes`) com botão de login 1-clique, cópia de URL de redirecionamento HTTPS e aviso guiado para resolução de erro na Meta.
- **QUALIDADE:**
  - `npx tsc --noEmit`: 0 erros.
  - `npm test`: 270 testes passando (100% verde).
  - `npm run build`: Sucesso (10/10 rotas estáticas e dinâmicas compiladas).

---


## Atualização 2026-10-11 — Item 03 (API da Meta: Instagram Login, Private Replies, Postbacks, Janela 24h & SimpleBuilder)
- **STATUS:** ✅ `DONE` (100% Concluído e Validado)
- **QUALIDADE:**
  - `npx tsc --noEmit`: 0 erros.
  - `npm test`: 261/261 testes passando (100% verde em 18 suítes).
  - Banco Supabase Postgres sincronizado sem perda de dados (`PrivateReply`, `WAITING_REPLY`, `negativeKeywords`, `cooldownSeconds`, `priority`, `triggerContext`).
- **ENTREGAS REALIZADAS:**
  1. **Graph API Instagram Login:** `GRAPH_API_BASE` fixado em `https://graph.instagram.com/v21.0` com `AbortSignal.timeout(10_000)` e retorno estruturado (`GraphResult`).
  2. **Private Reply Oficial:** Envio via `recipient: { comment_id }` em até 7 dias, deduplicado na tabela `PrivateReply`.
  3. **Janela de 24h e Transições de Status:** Runner valida janela antes de DMs comuns; status `WAITING_REPLY` ativado até o contato interagir; `lastInboundAt` atualiza apenas com DM/postback.
  4. **Nó QUESTION:** Botões `web_url` convertidos para `TrackedLink` (`/api/l/[code]`); avanço pela aresta padrão quando não há postback.
  5. **Webhook:** Roteamento por `entry[].id` (`igUserId`), filtro de `is_echo` e auto-comentários, payload de postback em JSON/base64url, inscrição obrigatória de `comments`, `messages` e `messaging_postbacks`.
  6. **Matcher:** Normalização NFD, limites de palavra em `CONTAINS` (`\b`), suporte a `negativeKeywords`, cooldown por contato/fluxo e ordenação determinística.
  7. **Tratamento de Códigos Meta:** 190 (`EXPIRED`), 10/2018278 (`WINDOW_CLOSED`), 4/613/32 (`RETRYABLE`).
  8. **Layout SimpleBuilder:** Responsividade completa mobile/tablet (`mobilePanel` tabs "recipe" | "preview") e desktop (lado a lado sem esmagamento do cabeçalho).
  9. **Documentação:** ADR-005 registrado em `docs/DECISIONS.md`, `docs/etapa-7-meta-app.md` atualizado para Instagram Login.
