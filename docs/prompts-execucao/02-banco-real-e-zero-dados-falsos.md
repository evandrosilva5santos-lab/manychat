# PROMPT 02 — Banco Postgres real e remoção de TODOS os dados falsos

> Prompt fracionado. **Antes leia `docs/prompts-execucao/00-PROMPT-MESTRE.md`** (seções 2, 2.1, 3, 7, 9 e 11).
> Onda A. Faça rebase sobre o item 1 antes do merge. Os itens 3, 4 e 5 dependem deste.

## Papel
Você garante que o "Fluxo" só mostra e grava **dados reais**: Postgres de verdade e Graph API de verdade. Erros aparecem como erros, nunca como sucesso ou dado inventado. Esta é uma exigência explícita do dono: "não quero dados falsos ou fictícios".

## Leitura obrigatória específica
`docs/etapa-1-banco.md`, `SCHEMA.md`, `prisma/schema.prisma`, `prisma/seed.ts`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md` (estados vazio/erro, PostPicker), `PRD_TRACEABILITY.md` (REQ-005, REQ-006, REQ-010, REQ-013, REQ-014), `execution/MASTER_PLAN.md` (NANO-003 e NANO-004 tratam do PostPicker e do `mediaId`).

## Pré-requisito
O dono precisa fornecer um Postgres real de **teste** (e depois o de produção) ou autorizar `vercel env pull`. Hoje o `.env` tem `DATABASE_URL` com placeholder `HOST:5432`, e o app nunca falou com banco algum.
1. Rode `npx prisma migrate deploy` no banco de teste.
2. Confira que `npx prisma migrate status` está limpo.
3. Rode `npx prisma migrate diff` (schema × banco) sem diferenças.

## Evidências da auditoria — remova ou corrija cada uma
- **Fallback JSON:** `src/lib/storage/store.ts` (grava `.data/fluxo_db.json` ou `/tmp`). É usado em `contacts.ts:59,139,183`, `runner.ts:52,124-125`, `matcher.ts:77-96`, `fluxos/actions.ts`, `catalogo/actions.ts`, `contatos/actions.ts`, `fluxos/page.tsx:38` e `fluxos/[id]/page.tsx:71,76`. **Apague o módulo e todos os usos.** O `store.test.ts` também sai, ou é reescrito sem o arquivo real.
- **Conta falsa** em `src/lib/account.ts`: `DEMO_ACCOUNT` (`:30-32`), criação de conta `igUserId:"pending"`/`"movingfestival"` (`:25`) e placeholder `17841400123456789` (`:5`). Até o item 8, resolva a conta pelo `IG_USER_ID` do ambiente ou pela única conta conectada no banco. Se não houver conta, mostre na interface o estado "Conecte seu Instagram em Ajustes".
- **Fluxo demo "casamento"** em `matcher.ts:84-96`. **CRÍTICO:** pode disparar DM de demonstração para seguidores reais. Remova.
- **Modo mock** em `src/lib/meta/graph.ts` (`:61,121,211,262,363,446,487`) retorna `success:true` e `mock_mid_*`; `checkUserFollows` retorna `true` (`:297`). O mock só pode existir em `NODE_ENV==="test"`. Fora disso, retorne `{success:false, code:"NO_TOKEN"}`.
- **PostPicker** (`src/components/simple-builder/PostPicker.tsx:26,116-120,141,211,255`):
  - remova o `MOCK_POSTS` e o padrão `"post-1"`;
  - busque `/api/instagram/media` com estados de carregando, vazio ("Nenhuma publicação encontrada") e erro;
  - URL personalizada aceita só `https://www.instagram.com/...`;
  - não permita publicar automação com `mediaId` inválido.
- **Painel** (`src/app/page.tsx`): remova o CTR "67%", o array `chartBars`, o "+18%", o "412 envios", o banner "Canal conectado: @movingfestival" e o loop N+1 de `getStoredMessages` (`:28-31`). Calcule as métricas a partir do banco (DMs enviadas, contatos novos, cliques em `TrackedLink`, automações ativas). Métrica sem fonte real deve sair da tela.
- **Sidebar:** remova o avatar fixo "Evandro Silva"/"E" e use os dados da conta. Os botões "Recolher" e "Ajuda" não fazem nada: implemente ou remova.
- **Ajustes:** mostre a conta real (`/me` da Graph API), não um placeholder.
- **SimpleBuilder:** o banner de permissões está fixo (`:472`) e o "Simulação: Permissões… verificadas com sucesso!" é um sucesso falso (`:482`). Troque por uma checagem real das permissões do token, ou remova.
- **Actions que mentem sucesso:**
  - `catalogo/actions.ts:207-223` monta um `mockItem` com `ok:true`;
  - `fluxos/actions.ts:31-51` (`createFlow`; `ownFlow` libera acesso em caso de erro), `:104` e `:249` ("Persistido localmente");
  - `contatos/actions.ts:92,132,225,258` e `listAllTags` com `memoryTags` (`:122-135`).
  - Em erro: retorne `{ok:false, error}` amigável e registre no log.
- **`/conversas`** já foi corrigida em 2026-10-10. Revise e alinhe as outras telas ao mesmo padrão.
- **Páginas estáticas:** `/`, `/contatos` e `/catalogo` saem como "○ Static" no `next build`. Torne-as dinâmicas (`await connection()` ou `export const dynamic = "force-dynamic"`) para refletirem dados do webhook.
- **Fronteiras de erro:** crie `src/app/error.tsx`, `src/app/global-error.tsx` e `loading.tsx` (raiz e `fluxos/[id]`).
- **`prisma/seed.ts`:** sem dados de demonstração; no máximo setup técnico, e nunca rodar em produção.
- **"Fluxo avançado"** abre o construtor simples (`/fluxos/novo?mode=ADVANCED` ignora o `mode`). Corrija.
- **Restos de desenvolvimento:** título "· ManyChat" em Contatos e rótulos "Etapa N" na interface. Remova.

## Arquivos que este item possui
`src/lib/storage/*` (remoção), `src/lib/account.ts`, os corpos de `src/app/**/actions.ts`, `src/app/**/page.tsx`, `src/app/error.tsx`, `src/app/loading.tsx`, `src/components/simple-builder/PostPicker.tsx`, os trechos de dados falsos de `SimpleBuilder.tsx`, `Sidebar.tsx` (só dados) e o modo mock de `src/lib/meta/graph.ts` (o item 3 refatora o resto de `graph.ts` depois).

## Agentes e skills
- **Agentes:** `silent-failure-hunter` (antes e depois), `database-reviewer`, `react-reviewer`, `typescript-reviewer`, `code-reviewer`, `tdd-guide`, `e2e-runner`.
- **Skills:** `prisma-patterns`, `postgres-patterns`, `database-migrations`, `error-handling-patterns`, `nextjs-app-router-patterns`, `react-best-practices`, `tdd-workflow`.

## Testes
- **Integração (Postgres de teste)** para cada action: banco vazio → lista vazia; erro de banco simulado → `{ok:false}`, nunca dado falso.
- **`graph.ts`:** fora de `test`, sem token, devolve `NO_TOKEN`; nunca `success:true`.
- **PostPicker:** carregando, vazio, erro e lista real (fetch simulado no teste unitário; real no navegador).
- **Painel:** os números batem com contagens feitas direto no banco de teste.
- **E2E (Playwright):**
  - banco vazio → telas com estados vazios honestos;
  - banco fora do ar → banner de erro em todas as telas (não só em Conversas).
- **Navegador (DevTools MCP)** em todas as páginas, em 375, 768 e 1440: console limpo, rede sem erros inesperados, screenshots.
- **Busca de dados falsos** (precisa retornar zero):
  ```
  rg -n "MOCK_POSTS|DEMO_ACCOUNT|demo-account|demo-casamento|movingfestival|getStored|storage/store|memoryMessages|memoryTags|mock_mid|\"post-1\"|17841400123456789|Etapa [0-9]|Persistido localmente|Simulação" src --glob '!**/*.test.*'
  ```

## Critérios de aceite
- [ ] O app roda contra Postgres real; `migrate status` limpo.
- [ ] A busca acima retorna zero; a pasta `.data/` não é mais criada.
- [ ] Nenhuma tela mostra número, conta, post ou contato inventado; erros aparecem como erros.
- [ ] Páginas dinâmicas refletem dados novos sem rebuild.
- [ ] Testes de integração e E2E verdes; QA de navegador com evidências.
- [ ] `PRD_TRACEABILITY.md` atualizado (REQ-005, REQ-006, REQ-010, REQ-013, REQ-014); NANO-003 e NANO-004 marcadas na fila.
