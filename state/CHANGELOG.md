# CHANGELOG — Histórico Oficial de Mudanças Técnicas

> **Documento:** Registro de Alterações Atômicas  
> **Padrão:** Uma entrada por nano task ou ciclo de governança  

---

### [2026-09-28] — Governança e Preparação Completa para Execução
- **DATE:** 2026-09-28 22:35
- **AGENT:** `ANTIGRAVITY` (Arquiteto de Projeto & Orquestrador)
- **NANO TASK:** `PREPARATION_AND_ORCHESTRATION`
- **FILES CHANGED / CREATED:**
  - `docs/PROJECT_MAP.md`
  - `docs/CONTEXT.md`
  - `docs/ARCHITECTURE.md`
  - `docs/DESIGN.md`
  - `docs/RULES.md`
  - `docs/DECISIONS.md`
  - `docs/GLOSSARY.md`
  - `docs/PRD_ISSUES.md`
  - `execution/EXECUTION_RULES.md`
  - `execution/ROADMAP.md`
  - `execution/MASTER_PLAN.md`
  - `execution/TASK_QUEUE.md`
  - `execution/CURRENT_TASK.md`
  - `tasks/EPIC-001/TASK-001.md`
  - `PRD_TRACEABILITY.md`
  - `state/STATUS.md`
  - `state/CHANGELOG.md`
  - `state/BLOCKERS.md`
  - `reports/INITIAL_AUDIT.md`
- **CHANGE:** Auditoria estrutural completa do repositório, preservação integral do PRD, formalização do design system e tokens, fatiamento determinístico do Seletor de Mídia em 4 nano tasks (`NANO-001` a `NANO-004`) e autorização da `NANO-001`.
- **VALIDATION:**
  - 46 testes unitários no Vitest passando (`npm test`).
  - Verificação de tipos TypeScript com zero erros (`npx tsc --noEmit`).
- **RESULT:** Estado do projeto transicionado para `READY_FOR_EXECUTION`.

---

### [2026-09-29] — Conclusão e Validação da NANO-001
- **DATE:** 2026-09-29 02:55
- **AGENT:** `CLAUDE` (Claude Code) / Validado por `ANTIGRAVITY`
- **NANO TASK:** `NANO-001`
- **FILES CHANGED / CREATED:**
  - `src/lib/meta/graph.ts` (Adicionado tipo `InstagramMediaItem` e método `getUserMedia` com fallback defensivo)
  - `src/app/api/instagram/media/route.ts` (Criada route handler GET retornando dados normalizados)
  - `state/BLOCKERS.md` (Resolvido `BLK-003`)
  - `execution/TASK_QUEUE.md` (Movida `NANO-001` para `DONE` e `NANO-002` para `READY`)
- **CHANGE:** Implementação completa da busca de publicações do Instagram na Graph API v21.0 com suporte a dados mock ricos em ambiente offline/teste, expondo o endpoint `GET /api/instagram/media` para consumo no frontend.
- **VALIDATION:**
  - Level 1 (Local): `npx tsc --noEmit` concluiu com 0 erros.
  - Level 2 (Integração): `npm test` concluiu com 51/51 testes passando (100% verde).
  - Level 3 (Runtime/Requisito): Endpoint testado via runtime retornando status HTTP 200 e payload `{ success: true, data: [...] }`.
- **RESULT:** `NANO-001` aprovada e concluída. Próxima nano task autorizada: `NANO-002`.


## 2026-10-10 — Item 02: Banco Postgres real e remoção de TODOS os dados falsos
- **STATUS:** ✅ Concluído com 100% dos critérios comprovados.
- **BANCO:** Supabase Postgres conectado (`DATABASE_URL` com pgbouncer na porta 6543 e `DIRECT_URL` na porta 5432). Todas as 5 migrations aplicadas sem drift (`prisma migrate diff` = zero diferenças).
- **MOCKS/STORE:** Remoção completa e definitiva de `src/lib/storage/store.ts`, `store.test.ts` e diretório `.data/`. Eliminação de contas fictícias (`DEMO_ACCOUNT`, `movingfestival`, placeholder `17841400123456789`), fluxo demo "casamento", `MOCK_POSTS`, dados inventados no dashboard e ações com sucesso falso. Busca de dados falsos retorna rigorosamente ZERO ocorrências no código de produção.
- **PÁGINAS DINÂMICAS:** `/`, `/catalogo`, `/contatos`, `/conversas`, `/fluxos`, `/fluxos/[id]` e `/ajustes` convertidas para renderização dinâmica (`ƒ`), com fronteiras de erro (`error.tsx`, `global-error.tsx`) e `loading.tsx`.
- **SEGURANÇA & VALIDAÇÃO:** Integração completa com os contratos do Item 01 (`requireAuth`, `TrackedLink`, `invalidIdMessage`).
- **VALIDATION:**
  - `npx tsc --noEmit`: 0 erros.
  - `npm test`: 12 arquivos de teste, 173 testes passando (100% verde).
  - `npx next build`: Build de produção compilado com sucesso com Turbopack em 6.0s.
  - `npx prisma migrate status`: 5 migrations aplicadas, database schema up to date.
  - Auditoria regex de dados falsos: 0 ocorrências.

## 2026-10-11 — Item 03: API da Meta (Instagram Login, Private Replies, Postbacks, Janela 24h & SimpleBuilder)
- **STATUS:** ✅ Concluído com 100% dos testes e tipos verdes.
- **FILES CHANGED / CREATED:**
  - `prisma/schema.prisma` (Tabela `PrivateReply`, status `WAITING_REPLY`, campos `triggerContext`, `negativeKeywords`, `cooldownSeconds`, `priority`)
  - `src/lib/meta/graph.ts` (Cliente unificado `graph.instagram.com/v21.0`, timeout, tipagem com code/subcode/retryable, private replies, mapped error codes 190/10/4/613)
  - `src/lib/meta/graph.test.ts` (21 testes cobrindo limites, private reply, generic template, códigos Meta)
  - `src/lib/meta/account-client.ts` e `account-client.test.ts` (Instanciação de client com token real e callback de expiração)
  - `src/lib/meta/webhook.ts` e `webhook.test.ts` (Validação Zod de payload, filtro `is_echo`, anti-auto-comentários, assinatura de `messaging_postbacks`)
  - `src/lib/meta/postback.ts` e `postback.test.ts` (Codificação e decodificação segura em JSON base64url para IDs arbitrários)
  - `src/lib/engine/runner.ts`, `runner.test.ts`, `runner.failures.test.ts` (Janela de 24h, private reply claim, QUESTION sem botões postback, `WAITING_REPLY`, resume on message/click)
  - `src/lib/engine/matcher.ts` e `matcher.test.ts` (Normalização NFD, limites de palavra em `CONTAINS`, `negativeKeywords`, cooldown e prioridade)
  - `src/lib/queue/worker.ts` (Roteamento de conta por `entry[].id`, dedup via `recordIncomingMessage`, passagem de `triggerContext`)
  - `src/lib/engine/tracked-links.ts` e `src/app/api/l/[code]/route.ts` (Redirecionamento seguro de cliques, gravação de cliques no banco, sanitização contra open-redirect)
  - `src/components/simple-builder/SimpleBuilder.tsx` (Correção responsiva do layout: cabeçalho sem quebras, alternância de abas "recipe" | "preview" em telas mobile/tablet e visualização side-by-side no desktop)
  - `docs/DECISIONS.md` (ADR-005 documentando adoção oficial de Instagram API with Instagram Login)
  - `docs/etapa-7-meta-app.md` (Atualização do guia para Instagram Login sem Página de Facebook)
- **VALIDATION:**
  - Level 1 (Local): `npx tsc --noEmit` concluiu com 0 erros.
  - Level 2 (Integração): `npm test` concluiu com 261/261 testes passando (100% verde em 18 suítes).
  - Level 3 (Banco): Supabase Postgres sincronizado com `npx prisma db push` sem perda de dados.

## 2026-10-11 — Multi-tenancy: Super Admin e isolamento por conta
- Adicionados `User`, `Workspace`, `UserSession` e a relação obrigatória `InstagramAccount.workspaceId`.
- Criada migration `20261011120000_multi_tenancy`: cria workspace legado e associa todas as contas históricas antes de exigir a chave estrangeira.
- Adicionados painel `/admin`, troca de conta ativa em cookie HTTP-only e impersonação limitada a `SUPERADMIN`.
- Todas as operações sensíveis de contatos, catálogo e fluxos agora verificam `accountId` da conta ativa; OAuth só vincula perfis ao workspace do ator autenticado.
- Validação: `npx tsc --noEmit`, 290 testes Vitest e `npm run build` aprovados.

---

### [2026-10-12] — Pacote "Perfil seguro" (descarregar/excluir perfil, callbacks da Meta, isolamento entre clientes)
- **DATE:** 2026-10-12
- **AGENT:** `CLAUDE` (Claude Code — líder + agentes A, B, C, D em paralelo; revisão multiagente)
- **TASK:** `PERFIL-SEGURO` (plano `perfil-seguro.md`, design `docs/plans/2026-10-12-perfil-seguro-design.md`, ADR-007)
- **BRANCH / PASTA:** `feat-novas-implementacoes` em `../Manychat-novas-implementacoes`
- **MUDANÇAS PRINCIPAIS:**
  - Migração aditiva `20261012180000_perfil_seguro` (`metaUserId`, `connectedAt`, índice `WebhookEvent.accountId` com preenchimento, `DataDeletionRequest`) — aplicada no banco.
  - `src/lib/meta/account-lifecycle.ts`: descarregar (cancela webhooks na Meta, apaga credencial, encerra execuções) e exclusão em lotes retomável.
  - `POST /api/meta/deauthorize` e `POST /api/meta/data-deletion` (assinatura HMAC conferida antes do banco, `issued_at` ≤ 24 h, idempotente, teto de 8 KB real) + página pública `/exclusao-de-dados`.
  - Motor sem token global; perfil descarregado não processa; perfil expirado grava sem disparar; estado conferido antes de cada envio; espera não fica presa.
  - Tela de falhas e reenvio restritos ao perfil ativo; token de verificação do webhook só para SUPERADMIN.
  - Troca do token longo do Instagram: GET documentado com repetição por POST em "Unsupported request - method type"; log com `code`, `error_subcode`, `fbtrace_id`.
  - Telas: card "Perfil carregado" com zona de risco, `ConfirmDialog` acessível, faixa de estado (expirado/descarregado), "Pausado" nos fluxos, `/conectar` sem promessas técnicas, renovação manual salvando o token.
- **VALIDATION:**
  - Level 1: `npx tsc --noEmit` → 0 erros.
  - Level 2: `npm test` → 517/517.
  - Build: `npm run build` → OK.
  - Lint: nenhum erro novo (erros `no-explicit-any` pré-existentes em `runner.ts`, `page.tsx`, `fluxos/page.tsx`).
  - Level 3: callbacks em `localhost:3007` — assinatura inválida 400, corpo > 8 KB 400, GET 405, assinatura válida 200 com `{url, confirmation_code}`, repetição devolve o mesmo código, página de status "Nenhum dado encontrado"; pedido de teste apagado.
  - Revisões: código (0 CRITICAL/HIGH) e segurança (0 CRITICAL/HIGH); médios corrigidos.
- **RESULT:** `DONE` na branch; deploy pendente.
- **PENDÊNCIAS DO DONO:** cadastrar `https://instachat.startinc.com.br/api/auth/instagram/callback` e as URLs de desautorização/exclusão no painel da Meta (ver `docs/etapa-7-meta-app.md` §2.5); recarregar `@movingfestival` e `@loveu.sunset` (descarregadas pela tela em 12/10); validar retenção dos dados do negócio (ADR-007).

---

### [2026-10-12] — Marca instachat + saneamento de incoerências
- **AGENT:** `CLAUDE` (Claude Code) · **PASTA:** `/Users/evandro/Downloads/Manychat` (oficial), branch `feat-login-duplo`
- **INTEGRAÇÃO:** fast-forward de `feat-novas-implementacoes` (pacote Perfil seguro) para a pasta oficial; backup do estado anterior em `git stash` ("backup antes de trazer feat-novas-implementacoes").
- **MARCA:** logos diurno/noturno, símbolo e ícone em `design-system/assets/brand/` e `public/brand/`; `favicon.ico`, `icon.png`, `apple-icon.png`; `primary` vermelho (#DC1A44 claro / #FF5C7A escuro, 4,5:1) e token novo `brand` (#FB264D, só logo); componente `BrandWordmark`/`BrandSymbol`; "Fluxo" → "instachat" nos textos de marca; `proxy.ts` deixa `/brand/*` e ícones fora do Basic Auth (logo do `/conectar` público).
- **CORREÇÕES:** token inexistente `accent` trocado por `primary` em 6 telas (o botão de `ContactsClient` estava com texto branco sem fundo).
- **DOCUMENTOS:** `CLAUDE.md` e `execution/CURRENT_TASK.md` deixam de mandar refazer a NANO-002; `state/HANDOFF.md` e `state/STATUS.md` atualizados; `MASTER_PLAN`/`ROADMAP` marcados como históricos; `docs/DESIGN.md` com a paleta real do `tokens.css`, fonte e tema corretos; `README` com porta 3007; `PRD_TRACEABILITY` (REQ-001, 002, 018, 019) e `PRD_ISSUES` (002 e 003 resolvidas, 004–010 novas). PRD intocado (REG-DOC-002).
- **VALIDATION:** `npx tsc --noEmit` 0 erros; `npm test` 517/517; `npx eslint src` 82 erros / 36 avisos (pré-existentes).
- **PENDENTE DE APROVAÇÃO DO DONO:** remover worktrees já integrados e o stub do Stripe (bloqueado pelo modo de permissões).
