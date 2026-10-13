# STATUS — Estado Operacional do Projeto (Fluxo)

> **Documento:** Painel Central de Estado da Esteira  
> **Última Atualização:** 12/10/2026 (Horário Local)  
> **Governança:** Start Inc. / Orquestrador Antigravity  

---

## Estado atual (12/10/2026, 23h)
- **PRODUTO:** instachat (código interno "Fluxo"). Nome sempre em minúsculas, como no logotipo.
- **PASTA OFICIAL:** `/Users/evandro/Downloads/Manychat`, branch `feat-login-duplo` — já contém o pacote "Perfil seguro" (fast-forward de `feat-novas-implementacoes` em 12/10).
- **CONCLUÍDO:** login duplo Instagram/Facebook (ADR-006); pacote "Perfil seguro" (ADR-007); marca instachat; porte dos itens 6 e 8 (`vercel-build` só em produção, opt-out "PARAR", exportar/excluir contato, cabeçalhos de segurança). `tsc` 0 erros, 576 testes, build ok.
- **ANTES DO PRÓXIMO DEPLOY:** aplicar a migration de opt-out (BLK-008) — o `vercel-build` faz isso sozinho em produção.
- **NÃO INTEGRADO:** retenção LGPD (BLK-010, decisão), Sentry (BLK-011, falta DSN), acessibilidade (item 7, rascunho).
- **LACUNAS CONHECIDAS:** esperas (DELAY) só andam quando o QStash estiver chamando o `/tick` (`docs/agendador-qstash.md`); cliente não tem login próprio; páginas "Agentes de IA" e "Transmissão" são vitrines "Em breve" (ISSUE-009); 82 erros de lint (`no-explicit-any` antigos).
- **BLOQUEIOS EXTERNOS (dono):** criar a conta e o agendamento no QStash com `CRON_SECRET`; cadastrar `https://instachat.startinc.com.br/api/auth/instagram/callback` e as URLs de desautorização/exclusão no painel da Meta; adicionar a conta do Instagram como testadora; recarregar `@movingfestival` e `@loveu.sunset` (descarregadas pela tela em 12/10).
- **PRÓXIMO:** dono escolhe a próxima tarefa em `execution/CURRENT_TASK.md`; depois, deploy.

---

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

## Atualização 2026-10-11 — Multi-tenancy e Painel Super Admin
- **STATUS:** ✅ `DONE`
- **ENTREGAS:** `User`, `Workspace` e sessões opacas; migration com backfill sem apagar contas existentes; `InstagramAccount.workspaceId` obrigatório; resolução de conta ativa por sessão e cookie HTTP-only; proteção contra IDOR em contatos, fluxos e catálogo; OAuth vinculado ao workspace do ator autenticado; painel `/admin` protegido, métricas e impersonação controlada; seletor de conta no cabeçalho e estado vazio de conexão.
- **VALIDAÇÃO:** `npx tsc --noEmit` aprovado; `npm test -- --run` com **290/290** testes; `npm run build` aprovado.
