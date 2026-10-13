# STATUS — Estado Operacional do Projeto (Fluxo)

> **Documento:** Painel Central de Estado da Esteira  
> **Última Atualização:** 12/10/2026 (Horário Local)  
> **Governança:** Start Inc. / Orquestrador Antigravity  

---

## Estado atual (13/10/2026, tarde) — planos, equipe e cobrança
- **CONCLUÍDO NO BRANCH (sem deploy):** ADR-008 inteiro, fases 1 a 6 — login de cliente, equipe com papéis, planos com limites aplicados no servidor, Super Admin de planos e assinaturas, cobrança Stripe, `/precos` e `/cadastro`. Ver `state/CHANGELOG.md`.
- **STRIPE (modo teste, configurado em 13/10):** produtos e preços mensais em BRL — Starter R$ 97 (`price_1UQ7JfDM9Yh5kkSFue3rcLbu`), Pro R$ 197 (`price_1UQ7JgDM9Yh5kkSFkcM8aXgd`), Agência R$ 497 (`price_1UQ7JhDM9Yh5kkSFplnKM5jy`); webhook `we_1UQ7JhDM9Yh5kkSF7f5iyEfN` → `https://instachat.startinc.com.br/api/webhook/stripe`; portal `bpc_1UQ7JiDM9Yh5kkSFBetNrqxF` (padrão). `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` e `STRIPE_WEBHOOK_SECRET` na Vercel (produção) e no `.env` local. Preços editáveis em `/admin/planos`.
- **PARA COBRAR DE VERDADE:** ativar a conta no Stripe (hoje `charges_enabled=false`), repetir a configuração em modo live (chaves `sk_live`/`pk_live`, preços, webhook e portal) e trocar os `price_...` em `/admin/planos`. Só então `PUBLIC_SIGNUP=on`: em modo teste qualquer um assinaria com cartão de teste.
- **CORTESIA:** em `/admin/workspaces/[id]`, cliente grátis por 1, 3, 6, 9 meses ou indeterminado (fora do MRR; ao vencer, pausa as automações).
- **EFEITO DO DEPLOY:** a migration dá o plano Pro ativo (sem cobrança) a todo cliente existente e marca o workspace do Super Admin como interno — ninguém para de funcionar.
- **PENDENTE:** e-mails de cobrança e recuperação de senha dependem de um serviço de e-mail. (Workspace com plano bloqueado já não inicia fluxo nem responde em público: só grava o que chega.)

## Estado atual (13/10/2026, madrugada)
- **PRODUTO:** instachat (código interno "Fluxo"). Nome sempre em minúsculas, como no logotipo.
- **PASTA OFICIAL:** `/Users/evandro/Downloads/Manychat`, branch `feat-login-duplo` (commits locais, sem push).
- **CONCLUÍDO:** login duplo (ADR-006); Perfil seguro (ADR-007); marca instachat; porte dos itens 6 e 8 (`vercel-build` só em produção, opt-out "PARAR", exportar/excluir contato, cabeçalhos de segurança); menu de perfil (troca de perfil na sidebar, menu do usuário com Sair, `/contas`, `/sair`, aviso de token vencendo); esperas retomadas a cada webhook e pelo cron diário do `/tick`; erros internos fora da tela; cores só do design system. `tsc` 0 erros, 603 testes, build ok.
- **DEPLOY:** no ar em `https://instachat.startinc.com.br` desde 13/10/2026 03:09 UTC (`dpl_E1kECPNmU67KEKnF3tp9NqqCDKGc`, commit `0c9ad08`). Migration de opt-out aplicada; cron diário do `/tick` ativo.
- **NÃO INTEGRADO:** retenção LGPD (BLK-010, decisão), Sentry (BLK-011, falta DSN), acessibilidade do item 7 (rascunho), login de cliente (precisa decidir provedor).
- **DÍVIDA TÉCNICA:** 38 erros de lint, todos `any` no `src/lib/engine/runner.ts` (tipar exige reestruturar o motor e as checagens usadas pelos mocks).
- **PASSOS DO DONO:** `docs/PASSOS-DO-DONO.md` (3 URLs na Meta + testadora, recarregar 2 perfis, 4 decisões rápidas).

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
