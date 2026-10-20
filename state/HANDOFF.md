# HANDOFF — Pacote Oficial de Transferência de Controle Operacional (ECC Standard)

> **Documento:** Protocolo Formal de Handoff entre Agentes de IA  
> **Data:** 12/10/2026  
> **O handoff anterior (`HANDOFF-002-ECC`, NANO-002, 29/09) está superado e fica no histórico do git.**

---

## HANDOFF-004 (19/10/2026): deploy só do Autoposter, Stripe adiado

> Seção viva: atualizada a cada etapa. Se o agente parar, continue daqui.

**Pedido do dono:** "Cache por enquanto a parte do Stripe, deixa a parte do Stripe para estar no PRD, para ser instalado. Faça o commit que já vá para o ar... preciso urgentemente testar a parte de postagem." E também: "vá documentando".
**Leitura adotada:** postagem = Autoposter (`/autoposter`). O deploy leva só o Autoposter. A cobrança recorrente e o Stripe (ADR-010) ficam sem deploy.

**Onde:**
- Worktree isolada em `/Users/evandro/Downloads/Manychat-deploy-autoposter`, branch `deploy/autoposter`, criada do HEAD `91fbf7f`.
- O `node_modules` dessa worktree é um symlink para o da pasta oficial e não deve ser commitado.
- A pasta oficial (`feat-login-duplo`) **não foi alterada**, exceto por este arquivo. Lá continuam sem commit o Stripe, a cobrança e o console admin.

**Entra no commit:**
1. `src/lib/autoposter/**`, `src/app/autoposter/**` e `src/app/api/cron/autoposter/route.ts`, copiados da pasta oficial.
2. Migrations `20261013180000_autoposter` e `20261013200000_autoposter_review_caption`.
   - A primeira faz `DROP TABLE IF EXISTS` das tabelas `autoposter_*` antigas, que vieram de `db push` e estavam vazias em 13/10, e depois as recria.
   - A segunda só faz `ADD COLUMN`.
3. `prisma/schema.prisma`: o schema do HEAD mais o bloco `// ── Autoposter` e três relações (`Workspace.autoposterProjects`, `InstagramAccount.autoposterProjectAccounts` e `InstagramAccount.autoposterTargets`). Não entra nenhum campo do ADR-010.
4. `src/lib/meta/account-client.ts`: extrai `resolveAccountToken`, que o runner usa. `graphClientForAccount` continua igual.
5. `vercel.json`: só o cron `/api/cron/autoposter` (`0 7 * * *`).

**Fica de fora:**
- Stripe e ADR-010:
  - `src/lib/billing/{stripe-*,gateway,billing-sync,reconcile,subscription-actions,admin-ops,notices}`
  - `/assinar`, `/api/cron/billing` e `scripts/stripe-*`
  - migrations `20261014*`
  - mudanças em `/plano`, `/precos`, `/cadastro` e `/admin`
- O layout do console admin.
- `src/lib/meta/graph.ts` e `conversation-history.ts`.
- Os pacotes novos do `package.json`, que só a vitrine de preços usa.

**Andamento:**
- [x] Worktree e cópia dos arquivos.
- [x] Schema montado; `prisma validate` ok.
- [x] `npx tsc --noEmit` com 0 erros. Na worktree nova é preciso rodar antes `npx prisma generate` e `npx next typegen`.
- [ ] `npm test`, lint e `npm run build`.
- [ ] Nota "Stripe adiado" no PRD `docs/prd/2026-10-14-prd-assinatura-saas.md`.
- [ ] Commit em `deploy/autoposter`.
- [ ] **Push e deploy aguardam a confirmação do dono**, porque a migration recria as tabelas `autoposter_*` no banco de produção.

**Para testar a postagem em produção:**
- O runner exige que o plano do workspace tenha o recurso do Autoposter (`getEntitlements`/`hasFeature`). Use um plano com o recurso ou cortesia.
- A publicação usa o token da conta Instagram conectada.
- O cron roda às 07:00 UTC. Para testar na hora, chame `/api/cron/autoposter` com o `CRON_SECRET`.

---

- **HANDOFF ID:** `HANDOFF-003`
- **PASTA OFICIAL:** `/Users/evandro/Downloads/Manychat` (branch `feat-login-duplo`)
- **ESTADO:** `AWAITING_OWNER` (deploy e passos de `docs/PASSOS-DO-DONO.md`) — ver `state/STATUS.md` e `execution/CURRENT_TASK.md`.

## O que o próximo agente precisa saber
1. A esteira NANO (001–004) e os itens 1–4 estão concluídos; login duplo (ADR-006) e "Perfil seguro" (ADR-007) também.
2. A marca é **instachat**: arquivos em `design-system/assets/brand/`, componente `@/components/brand/BrandLogo`, regras em `design-system/README.md` › Marca.
3. Dos itens 5–8, já foram portados: opt-out, exportar/excluir contato, `vercel-build` só em produção e cabeçalhos de segurança. Retenção (item 5), Sentry (item 6) e acessibilidade (item 7) seguem nos branches — olhe-os antes de reimplementar.
5. Mensagens de erro para o usuário: lance `UserFacingError` (`src/lib/user-error.ts`) e use `actionErrorMessage` nas Server Actions; nunca devolva `err.message` cru.
4. `PRD.md` é imutável (REG-DOC-002); divergências vão para `docs/PRD_ISSUES.md`.

## Validação no momento do handoff
- `npx tsc --noEmit`: 0 erros.
- `npm test`: 603/603.
- `npx eslint src`: 38 erros, todos `any` em `src/lib/engine/runner.ts` (dívida registrada).
