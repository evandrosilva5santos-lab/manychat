# Perfil seguro

## Goal
O operador e o cliente controlam o perfil conectado (carregar, ver o estado real, descarregar, excluir dados), o motor nunca fala com a Meta sem o token do próprio perfil, e o Fluxo atende aos callbacks de desautorização e exclusão de dados da Meta. Design aprovado: `docs/plans/2026-10-12-perfil-seguro-design.md` (seção 7 prevalece).

## Tasks
Ondas: **1** (líder, sequencial) → **2** (três agentes em paralelo, arquivos disjuntos) → **3** (revisão) → **4** (verificação, sempre por último).

- [ ] **1. Banco** — migração aditiva `20261012180000_perfil_seguro`: `InstagramAccount.metaUserId` (índice) e `connectedAt`; `WebhookEvent` índice em `accountId` + preenchimento pelo prefixo `ig:{igUserId}:`; modelo `DataDeletionRequest` e enums. `npx prisma generate`. → Verify: `npx prisma validate`, `tsc` limpo, SQL só com `ADD COLUMN NULL` / `CREATE`.
- [ ] **2. Núcleo + conformidade Meta (agente A)** — `src/lib/meta/account-lifecycle.ts` (`disconnectAccount`, `requestAccountDeletion`, `runDeletion` em lotes de 5.000 com orçamento de 40 s, `resumePendingDeletions`), `src/lib/meta/signed-request.ts`, `POST /api/meta/deauthorize`, `POST /api/meta/data-deletion` (`after()`, `maxDuration = 60`), página `/exclusao-de-dados` (`noindex`), texto de `/privacidade`, retomada de pedidos no cron `refresh-tokens` e no `/tick` (que passa a comparar o segredo em tempo constante). → Verify: testes de assinatura (adulterada, algoritmo errado, secret errado, `issued_at` velho/futuro), idempotência (mesmo código), ordem de exclusão (cards de carrossel antes do catálogo), escopo PERSON × BUSINESS, limite de 20 contas.
- [ ] **3. Motor, fila, token e login (agente B)** — sem fallback para `defaultGraphClient` em `runner.ts`/`worker.ts`; `resolveAccount` sem `getCurrentAccount()`; descartado = não grava, expirado = grava sem gatilho; checagem de estado antes de cada envio; gravações de estado condicionais; `enqueueEvent` resolve `accountId` (cache por requisição, sem 5xx); `token-renewal`/`markExpired`/`onExpired` só em `CONNECTED`; tela de falhas com escopo por conta e reenvio só do perfil ativo e conectado; `oauth.ts` GET → POST só em "Unsupported request - method type" + log (`method`, `code`, `error_subcode`, `fbtrace_id`) + `fetchFacebookUserId`; `connect-account.ts` grava `metaUserId` e `connectedAt`. → Verify: testes novos para cada regra; os existentes continuam verdes.
- [ ] **4. Telas (agente C)** — `src/components/ui/ConfirmDialog.tsx` (requisitos U10); `ajustes/actions.ts` (`disconnectCurrentInstagramProfile` → próximo perfil conectado do mesmo workspace, `deleteCurrentInstagramProfile(confirmação)`, `renewMetaToken` salvando o token, `revealWebhookVerifyToken` só SUPERADMIN); `tenancy.ts` (prefere `CONNECTED`); `SettingsClient` com card "Perfil carregado" no topo + "Zona de risco", sem gradiente, selos em pt-BR; `AccountStatusBanner` no layout (duas variantes); "Pausado — …" no painel e em `/fluxos`; seletor distingue "Token expirado" × "Descarregado"; links do operador → `/ajustes`; "Reconectar" do `/admin` com convite; `/conectar` sem promessas técnicas, aviso acima dos botões, texto ≥ 12px. Textos exatos: seção 7.4 do design. → Verify: testes das actions; `tsc`; sem `window.confirm` em Ajustes.
- [ ] **5. Revisão** — `code-reviewer` + `security-reviewer` em paralelo sobre o diff inteiro; corrigir CRITICAL/HIGH. → Verify: relatório sem CRITICAL/HIGH abertos.
- [ ] **6. Documentação e governança** — `docs/etapa-7-meta-app.md` (URLs dos callbacks a cadastrar nos dois produtos), `state/CHANGELOG.md`, `state/STATUS.md`, `execution/TASK_QUEUE.md`, `PRD_TRACEABILITY.md`, ADR-007 em `docs/DECISIONS.md`. → Verify: entradas datadas 2026-10-12 com arquivos e validação.
- [ ] **7. Verificação final** — `npx tsc --noEmit`, `npm test`, `npm run build`, eslint sem erros nos arquivos tocados; dev em `:3007`; Chrome: Ajustes (card, abrir/cancelar os dois diálogos sem confirmar, foco e Esc), faixa de alerta, `/exclusao-de-dados` com e sem código, `/conectar` no celular (375px), callbacks com assinatura inválida → 400. Validação visual (contraste, foco, 44px). → Verify: capturas e GIF do fluxo; nenhuma conta real descarregada ou excluída.

## Orquestração (plan-orchestrate · Lang: typescript · ECC mode: plugin)

| # | Tarefa | Tags | Cadeia |
|---|---|---|---|
| 1 | Banco | db, migration | `ecc:architect,ecc:database-reviewer,ecc:typescript-reviewer` |
| 2 | Núcleo + conformidade Meta | impl, security, db | `ecc:tdd-guide,ecc:typescript-reviewer,ecc:security-reviewer` |
| 3 | Motor, fila, token e login | impl, security | `ecc:tdd-guide,ecc:typescript-reviewer,ecc:security-reviewer` |
| 4 | Telas | impl | `ecc:tdd-guide,ecc:typescript-reviewer` |
| 5 | Revisão | review, security | `ecc:typescript-reviewer,ecc:code-reviewer,ecc:security-reviewer` |
| 6 | Documentação | docs | `ecc:doc-updater` |
| 7 | Verificação final | test, build | `ecc:tdd-guide,ecc:e2e-runner` |

Justificativa: tarefas com escrita sensível (callbacks públicos, exclusão, tokens) fecham com `security-reviewer`; a migração passa por `database-reviewer` antes do revisor de TypeScript; a verificação é validada pelo `e2e-runner` (Chrome).

```bash
/ecc:orchestrate custom "ecc:architect,ecc:database-reviewer,ecc:typescript-reviewer" "[Plan: perfil-seguro.md#step-1] Migração aditiva perfil_seguro: InstagramAccount.metaUserId (índice) e connectedAt, índice WebhookEvent.accountId com preenchimento por prefixo ig:{igUserId}:, modelo DataDeletionRequest; Acceptance: prisma validate ok; SQL só ADD COLUMN NULL/CREATE; tsc limpo"
/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer,ecc:security-reviewer" "[Plan: perfil-seguro.md#step-2] account-lifecycle (descarregar, exclusão em lotes retomável), signed-request, POST /api/meta/deauthorize e /api/meta/data-deletion, página /exclusao-de-dados, privacidade, retomada no cron e no /tick; Acceptance: testes de assinatura adulterada/antiga/secret errado; mesmo código em repetição; cards de carrossel apagados antes do catálogo"
/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer,ecc:security-reviewer" "[Plan: perfil-seguro.md#step-3] Motor sem fallback de token global, webhook de perfil descarregado descartado e expirado gravado sem gatilho, checagem antes de cada envio, accountId na fila, falhas por conta, token só em CONNECTED, troca do token longo GET com repetição POST, metaUserId/connectedAt no connect; Acceptance: testes novos por regra; suíte existente verde"
/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: perfil-seguro.md#step-4] ConfirmDialog acessível, actions de descarregar/excluir/renovar, card Perfil carregado com Zona de risco, faixa de alerta com duas variantes, Pausado nos fluxos, seletor com estado real, links do operador e do admin, /conectar sem promessas técnicas; Acceptance: testes das actions; sem window.confirm em Ajustes; textos da seção 7.4"
/ecc:orchestrate custom "ecc:typescript-reviewer,ecc:code-reviewer,ecc:security-reviewer" "[Plan: perfil-seguro.md#step-5] Revisar o diff completo da branch feat-novas-implementacoes contra o design aprovado; Acceptance: nenhum CRITICAL/HIGH aberto"
/ecc:orchestrate custom "ecc:doc-updater" "[Plan: perfil-seguro.md#step-6] Atualizar etapa-7 (URLs dos callbacks), CHANGELOG, STATUS, TASK_QUEUE, PRD_TRACEABILITY e ADR-007; Acceptance: entradas datadas 2026-10-12 com arquivos e validação"
/ecc:orchestrate custom "ecc:tdd-guide,ecc:e2e-runner" "[Plan: perfil-seguro.md#step-7] tsc, testes, build, eslint e validação no Chrome em :3007 sem descarregar contas reais; Acceptance: tudo verde; capturas e GIF; callbacks inválidos respondem 400"
```

Execução: o líder roda a tarefa 1; as tarefas 2, 3 e 4 rodam como agentes em paralelo com as cadeias acima (implementação com TDD, revisão de TypeScript e de segurança ao final); depois 5 → 6 → 7.

## Done When
- [ ] Descarregar e excluir funcionam pela tela com diálogos acessíveis; o motor não envia nada por perfil não conectado; os dois callbacks da Meta respondem conforme o contrato; testes, tipos e build verdes; validação no Chrome registrada.

## Notes
- **Contrato entre agentes** (A fornece, C consome) em `src/lib/meta/account-lifecycle.ts`:
  - `disconnectAccount(accountId: string, opts: { reason: "USER" | "META_DEAUTHORIZE" | "META_DATA_DELETION"; notifyMeta: boolean }): Promise<void>`
  - `requestAccountDeletion(accountId: string, opts: { actorId?: string }): Promise<{ code: string; status: "PENDING" | "COMPLETED" | "FAILED" }>` (descarrega, cria pedido `APP`/`BUSINESS`, roda os lotes dentro do orçamento)
- Arquivos são disjuntos entre A, B e C; ninguém edita `prisma/schema.prisma` depois da tarefa 1.
- Proibido durante a validação: descarregar/excluir `loveu.sunset` ou `movingfestival`, mandar DM, alterar o painel da Meta.
- Em aberto com o dono: retenção dos dados do negócio (Decision Log #11) e cadastro das URLs dos callbacks no painel da Meta.
