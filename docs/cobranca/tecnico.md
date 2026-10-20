# Cobrança e assinatura — documentação técnica (ADR-010)

## Visão geral

```
/precos ─► /cadastro ─► /assinar ──(aceite: BillingConsent)──► Stripe Checkout (cartão, teste de 7 dias)
                                                                     │
Stripe ──webhook assinado──► /api/webhook/stripe ─► applyStripeEvent ─► gateway.normalizeEvent ─► applyBillingUpdate
                                                                                                    │ (1 transação)
                                     BillingEvent · Subscription · Invoice · PaymentAttempt · SubscriptionPayment · BillingNotice
                                                                                                    │
/plano, faixa global, motor, fila, Autoposter ◄── getEntitlements ◄── plan-rules.computeEntitlements (estado efetivo por data)
Vercel cron diário ─► /api/cron/billing ─► reconcileSubscriptions (grava vencimentos + avisos)
```

## Módulos (`src/lib/billing/`)

| Arquivo | Papel |
|---|---|
| `plan-rules.ts` | Regras puras: 7 estados, estado efetivo por datas, carência, cancelado com acesso, cortesia, suspensão manual, liberação temporária, limites (incluindo leads ativos), `downgradeProblems` |
| `entitlements.ts` | Lê plano e uso do banco; `assertWithinLimit`, `sendingBlockReason(accountId, contactId?)` (cota de DMs e de leads) |
| `gateway.ts` | Contrato `BillingGateway` e tipos neutros (`GatewaySubscription`, `GatewayInvoice`, `GatewayAttempt`, `BillingUpdate`) |
| `stripe-gateway.ts` | Adaptador Stripe: checkout, portal, cancelar/desfazer, troca de preço, fim do teste, cancelar já, criar preço, verificar webhook, normalizar evento |
| `billing-sync.ts` | Aplica eventos de forma idempotente; `syncGatewaySubscription` após ações do app |
| `stripe-billing.ts` | Entrada do webhook (`applyStripeEvent`): duplicado → curto-circuito; falha → `BillingEvent.status=failed` e relança |
| `subscription-actions.ts` | Ações do dono: cotação, aceite e checkout, cancelar, desfazer, trocar plano, abrir portal |
| `admin-ops.ts` | Ações do Super Admin com motivo e auditoria |
| `admin.ts` | Planos (validação Zod, inclusive benefícios, selo, combo, leads), assinatura via formulário, MRR, `auditData` |
| `notices.ts` | Textos dos avisos, motivo da recusa em português, gravação sem duplicar, e-mail opcional (Resend) |
| `reconcile.ts` | Cron diário: transições vencidas e avisos |
| `billing-cycle.ts` | Preço por ciclo, `perMonthLabel` (anual ÷ 12), rótulos |

## Modelo de dados (migration `20261014120000_assinatura_recorrente`)

- **Enum `SubscriptionStatus`:** recebe `EXPIRED` e `COMPLIMENTARY`.
- **`Product`:** `id`, `slug`, `name`, `isActive`. Inicial: `prod_instachat`.
- **`Plan` (campos novos):** `productId`, `highlightLabel`, `benefits[]`, `comboEligible`, `maxActiveContacts`, `legacyPriceIds[]`. `graceDays` passa a ter padrão 3.
- **`Subscription` (campos novos):**
  - `trialStartedAt`, `canceledAt`, `endedAt`;
  - `cardBrand`, `cardLast4`, `cardExpMonth`, `cardExpYear`;
  - `accessOverrideUntil` e `accessOverrideReason`;
  - `adminSuspendedAt` e `adminSuspendReason`.
- **`Workspace.trialConsumedAt`**.
- **`Invoice`:** espelho da fatura. `providerInvoiceId` único; status, valores, período, tentativas, próxima tentativa, links.
- **`PaymentAttempt`:** `providerAttemptId` único (`{fatura}:attempt:{n}` ou `{fatura}:paid`); status; `failureCode`; `failureMessage`.
- **`BillingNotice`:** `dedupeKey` único; `kind` (`payment_failed`, `payment_recovered`, `trial_ending`, `suspended`, `canceled`, `expired`); `emailStatus`.
- **`BillingConsent`:** aceite com `termsVersion`, IP, navegador, preço, dias de teste, `firstChargeAt`, `checkoutSessionId` único.
- **`BillingEvent` (campos novos):** `provider`, `status` (processed, ignored, failed), `workspaceId`, `objectId`, `error`, `attempts`, `processedAt`.

Dados (migration `20261014120100_planos_essencial_crescimento`, idempotente):
- produto instachat;
- planos Essencial (2990 / 28704 centavos, 2.000 leads) e Crescimento (5990 / 57504, 5.000 leads), com 7 dias de teste e 3 de carência;
- planos antigos com `isPublic=false`;
- cortesias antigas com `status=COMPLIMENTARY`.

## Idempotência e ordem dos eventos

1. `isDuplicateEvent(eventId)`: se o evento já foi processado ou ignorado, retorna `duplicate` sem consultar o Stripe.
2. O adaptador relê a assinatura no Stripe (com `default_payment_method` e o cartão padrão do cliente expandidos). Evento velho não regride o estado.
3. Uma transação faz:
   - upsert de `BillingEvent`;
   - upsert de `Subscription`;
   - `trialConsumedAt`;
   - upsert de `Invoice`;
   - upsert de `PaymentAttempt` (chave estável);
   - upsert de `SubscriptionPayment` (por fatura);
   - `BillingNotice` (sem repetir chave).
4. Dois envios simultâneos: o segundo bate na chave primária de `BillingEvent` (P2002) e vira `duplicate`.
5. Assinatura antiga encerrada (`canceled`) com outra assinatura viva no workspace: não sobrescreve (`isStale`).
6. O aviso de recuperação vale quando a fatura paga tinha tentativa recusada, mesmo que `subscription.updated` (active) chegue antes de `invoice.paid`.

## Mapeamento de status (gateway → local)

| Stripe | Local |
|---|---|
| `trialing` | `TRIALING` (`CANCELED` se `cancel_at_period_end`) |
| `active` | `ACTIVE` (`CANCELED` se `cancel_at_period_end`) |
| `past_due` | `PAST_DUE` |
| `unpaid`, `paused` | `SUSPENDED` |
| `canceled` | `EXPIRED` |
| `incomplete*` | Não grava (checkout ainda não concluído) |

**Estado efetivo** (`resolveStatus`), em ordem de prioridade:
1. Suspensão manual.
2. Cortesia (vencida vira `EXPIRED`).
3. Manual vencido: `PAST_DUE` dentro da carência, depois `SUSPENDED`.
4. `TRIALING` vencido: no gateway, segura a carência e depois vira `SUSPENDED`; sem gateway, vira `EXPIRED`.
5. `PAST_DUE` com carência vencida vira `SUSPENDED`.
6. `CANCELED` com período vencido vira `EXPIRED`.

A liberação temporária faz `canOperate=true` em qualquer estado, exceto suspensão manual.

## Onde o acesso é aplicado (servidor)

- **Motor:** `src/lib/engine/runner.ts`. Ao iniciar uma execução, checa o plano e o limite de leads do contato; a cada envio, checa o plano.
- **Fila:** `src/lib/queue/worker.ts`.
- **DM manual:** `src/app/conversas/actions.ts`.
- **Limites na criação:** conectar conta, membros, ativar fluxo (`assertWithinLimit`).
- **Recursos:** IA, Transmissão e Autoposter (`hasFeature` em `access/context.ts`, `requireAutoposterActor` e runner do Autoposter).

## Rotas novas

- `GET /assinar`: checkout com aceite. Só o dono e só cliente.
- `GET/POST /api/cron/billing`: exige `Authorization: Bearer $CRON_SECRET` (sem o segredo, 401; em produção sem segredo configurado, 503).
- `GET /admin/cobrancas`: só Super Admin.

## Variáveis de ambiente

| Variável | Obrigatória | Uso |
|---|---|---|
| `STRIPE_SECRET_KEY` | sim | API do Stripe (`sk_live_` em produção) |
| `STRIPE_WEBHOOK_SECRET` | sim | Assinatura do webhook (`whsec_`) |
| `APP_URL` | sim | Volta do checkout e do portal |
| `CRON_SECRET` | sim (produção) | Crons |
| `PUBLIC_SIGNUP` | para vender | `on` abre o cadastro público |
| `SUPERADMIN_EMAIL` | recomendada | E-mail do operador (evita o padrão `@fluxo.local`) |
| `RESEND_API_KEY`, `BILLING_EMAIL_FROM` | opcionais | Avisos de cobrança por e-mail |

## Testes

- **Unitários e de integração** (Vitest, Prisma e Stripe simulados):
  - `plan-rules.test.ts` (31);
  - `billing-sync.test.ts`;
  - `stripe-gateway.test.ts`;
  - `stripe-billing.test.ts`;
  - `subscription-actions.test.ts`;
  - `admin-ops.test.ts`;
  - `reconcile.test.ts`;
  - `signup.test.ts`;
  - `plano/actions.test.ts`;
  - `admin.test.ts`.
- **De ponta a ponta:**
  - `scripts/stripe-dev-relay.mjs` repassa eventos de teste ao webhook local;
  - `scripts/stripe-simulate-lifecycle.mjs` simula os cenários `aprovado`, `recusado [sem-recuperacao]` e `cancelado-no-teste` com test clocks.
  - Ambos só rodam com `sk_test_`.
