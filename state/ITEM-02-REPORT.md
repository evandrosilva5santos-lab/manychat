# Item 02 — Banco Postgres real e remoção de TODOS os dados falsos (2026-10-10)

Status: ✅ concluído (100% dos critérios comprovados com evidência)  
Branch: `prod-readiness`  

---

## O que mudou

1. **Conexão Real com Banco Postgres (Supabase):**
   - Configurado `.env` com instâncias reais de conexão via pooler AWS (`aws-0-us-east-2.pooler.supabase.com`):
     - `DATABASE_URL` na porta 6543 (transaction pooling com `pgbouncer=true`).
     - `DIRECT_URL` na porta 5432 (session pooler para migrações DDL e deploy do Prisma).
   - Executadas 5 migrações (`init`, `trigger_position`, `simple_builder`, `webhook_queue_idempotency`, `tracked_links`).
   - `npx prisma migrate status` confirma: "Database schema is up to date!".
   - `npx prisma migrate diff` confirma: "No difference detected.".

2. **Remoção de 100% dos Dados Falsos, Mocks e Armazenamento JSON Local:**
   - **Excluído definitivamente:** `src/lib/storage/store.ts` e `src/lib/storage/store.test.ts`. O diretório `.data/` não é mais criado.
   - **Contas Fictícias Eliminadas:** Em `src/lib/account.ts`, removidos `DEMO_ACCOUNT`, `movingfestival`, status `"pending"` e placeholder `17841400123456789`. Contas são consultadas diretamente no Postgres com tipagem estrita `InstagramAccount`.
   - **Fluxo Demo "Casamento" Eliminado:** Em `src/lib/engine/matcher.ts`, removido qualquer fallback para fluxos demo. O motor consulta puramente gatilhos e fluxos `LIVE` no Postgres.
   - **Falsos Sucessos Eliminados:** Em `catalogo/actions.ts`, `fluxos/actions.ts` e `contatos/actions.ts`, removidos retornos que fingiam sucesso em caso de erro. Falhas agora retornam `{ ok: false, error }` honesto e tipado.
   - **Painel Dashboard (`src/app/page.tsx`):** Removidos valores fixos inventados (CTR "67%", "+18%", "412 envios", "@movingfestival"). Todas as métricas (contatos, automações ativas, mensagens enviadas por dia na última semana, janela de 24h) agora são computadas em tempo real via consultas Prisma no banco de dados com estados vazios honestos.
   - **Seletor de Publicações (`PostPicker.tsx`):** Removido `MOCK_POSTS` e seleção padrão `"post-1"`. A busca consome a rota real `/api/instagram/media`, tratando estados de carregamento, vazio ("Nenhuma publicação encontrada") e erro. URL personalizada valida estritamente `https://www.instagram.com/...`.
   - **Sidebar e Construtor:** Removidos avatar fixo e banner de permissão simulada.
   - **Seed Seguro (`prisma/seed.ts`):** Substituído por script técnico que se recusa a rodar em produção.

3. **Páginas Dinâmicas e Tratamento de Erros:**
   - Adicionadas fronteiras de erro e carregamento:
     - `src/app/error.tsx` e `src/app/global-error.tsx`.
     - `src/app/loading.tsx` e `src/app/fluxos/[id]/loading.tsx`.
   - Rotas convertidas para renderização dinâmica (`ƒ` no `next build`), garantindo atualização imediata após eventos do webhook.
   - Suporte ao parâmetro `mode=ADVANCED` em `/fluxos/novo`.

4. **Integração de Defesa em Profundidade com Item 01:**
   - Incorporados os contratos de autenticação e segurança (`requireAuth()`, `TrackedLink`, `invalidIdMessage`, `isSafeHttpsUrl`, `verifyWebhookSignature`).

---

## Evidências

### 1. Auditoria de Dados Falsos (Zero Matches)
Comando executado:
```bash
git grep -nE "MOCK_POSTS|DEMO_ACCOUNT|demo-account|demo-casamento|movingfestival|getStored|storage/store|memoryMessages|memoryTags|mock_mid|\"post-1\"|17841400123456789|Etapa [0-9]|Persistido localmente|Simulação" -- 'src/**' ':!src/**/*.test.*'
```
**Resultado:** Exit code 1 (ZERO correspondências encontradas no código de produção).

### 2. Suíte de Testes Automatizados (Vitest)
Comando: `npm test`
```text
Test Files  12 passed (12)
Tests       173 passed (173)
Duration    613ms
```
100% dos testes aprovados em 12 suites (segurança, engine, rotas, basic auth, flow, recipe).

### 3. Verificação de Tipos TypeScript
Comando: `npx tsc --noEmit`
**Resultado:** Exit code 0 (0 erros).

### 4. Build de Produção do Next.js (Turbopack)
Comando: `npx next build`
```text
▲ Next.js 16.3.6 (Turbopack)
✓ Compiled successfully in 6.0s
  Finished TypeScript in 3.8s
✓ Generating static pages using 7 workers (10/10) in 212ms
  Finalizing page optimization in 19ms

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ○ /ai
├ ƒ /ajustes
├ ƒ /api/instagram/media
├ ƒ /api/l/[code]
├ ƒ /api/webhook/instagram
├ ƒ /api/webhook/instagram/tick
├ ƒ /catalogo
├ ƒ /contatos
├ ƒ /conversas
├ ○ /direct
├ ƒ /fluxos
└ ƒ /fluxos/[id]
```
Todas as páginas de dados são dinâmicas (`ƒ`).

### 5. Sincronização do Banco de Dados
Comando: `npx prisma migrate status`
```text
5 migrations found in prisma/migrations
Database schema is up to date!
```
Comando: `npx prisma migrate diff --from-schema prisma/schema.prisma --to-config-datasource --exit-code`
```text
No difference detected.
```

---

## Critérios de Aceite

| Critério | Status | Evidência |
| :--- | :---: | :--- |
| O app roda contra Postgres real; `migrate status` limpo | ✅ | Supabase conectado, 5 migrations aplicadas, `migrate status` limpo |
| Busca por termos fictícios/mocks retorna ZERO | ✅ | `git grep` em `src` (excluindo testes) retornou 0 resultados |
| Pasta `.data/` e arquivo `store.ts` eliminados | ✅ | `store.ts` e `store.test.ts` apagados |
| Nenhuma tela mostra número, conta, post ou contato inventado | ✅ | Dashboard e páginas usam queries Prisma diretas com empty states |
| Páginas dinâmicas refletem dados novos sem rebuild | ✅ | `next build` comprova rotas `ƒ` dinâmicas |
| Testes automatizados verdes | ✅ | 173 testes passando no Vitest |
| `PRD_TRACEABILITY.md` atualizado | ✅ | REQ-005, REQ-006, REQ-010, REQ-013, REQ-014 marcados como IMPLEMENTED |
| NANO tasks sincronizadas | ✅ | NANO-001..004 marcadas como DONE em `TASK_QUEUE.md` |

---

## Agentes que revisaram
- `database-reviewer`: Validou migrações, índices do Prisma, pooler de conexões do Supabase e `migrate diff`.
- `silent-failure-hunter`: Conferiu que ações de catálogo, contatos, fluxos e conversas nunca retornam sucesso fingido ou capturam exceções sem reporte.
- `security-reviewer`: Garantiu que `requireAuth()` e validações do Item 01 fossem preservadas durante o merge com o Item 02.

---

## Não verificado / depende do dono
- O deploy na Vercel e o teste físico de envio com a conta Instagram de teste dependem da execução do Item 03 (API da Meta com Instagram Login).

---

## Próximo passo
- Avançar para o **Item 03** (`docs/prompts-execucao/03-api-meta-instagram-login.md`): Instagram Login, private reply para comentários, postbacks de botões e roteamento por `entry[].id`.
