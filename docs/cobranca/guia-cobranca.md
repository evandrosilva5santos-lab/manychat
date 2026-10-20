# Guia de cobrança — teste, cobrança, falhas, cancelamentos e reativação

Este guia é para quem opera o instachat (Start Inc.). Ele explica o que acontece em cada situação e o que configurar antes de vender.

## Linha do tempo de um cliente

| Dia | O que acontece | Status |
|---|---|---|
| 0 | O cliente aceita os termos e cadastra o cartão. O Stripe gera uma fatura de R$ 0,00 | Teste grátis |
| 4 | O Stripe avisa que o teste termina em 3 dias, e o cliente recebe o aviso "Seu teste grátis está acabando" | Teste grátis |
| 7 | O teste acaba | — |
| 8 | Cobrança automática do plano no cartão | Ativo |
| +1 mês | Renovação na mesma data | Ativo |

## Pagamento recusado

1. **Na recusa:**
   - O status vira **Pagamento pendente** (`past_due`).
   - O cliente vê o aviso com o motivo em português (ex.: "saldo ou limite insuficiente") e a faixa amarela no topo.
   - Com e-mail configurado, também recebe por e-mail. O Stripe também manda o e-mail dele, se ativado.
2. **Novas tentativas:** o Stripe tenta de novo pela política do painel (Smart Retries).
3. **Durante a carência** (3 dias, configurável por plano): tudo continua funcionando.
4. **Depois da carência:**
   - Status **Suspensa**: as automações e os envios param.
   - Os dados e as mensagens recebidas continuam guardados.
   - Aviso "Automações pausadas".
5. **Pagamento aprovado** (o cliente troca o cartão em "Atualizar cartão e pagar" ou o Stripe consegue numa nova tentativa): volta para **Ativo** na hora e o cliente recebe "Pagamento confirmado".

Para acompanhar, use **Console → Cobranças**: faturas em aberto, tentativas recusadas, eventos do Stripe e avisos enviados.

## Cancelamento

- **Durante o teste:** nada é cobrado. O acesso vai até o fim do teste e a assinatura fica **Encerrada**.
- **Depois de pago:** o acesso vai até o fim do período já pago, não há nova cobrança e a assinatura fica **Encerrada** no fim. Não há reembolso proporcional automático; se precisar devolver, faça pelo painel do Stripe (Pagamentos → Reembolsar).
- **Desfazer:** o cliente pode desfazer enquanto o período não acaba.

## Reativação

- **Suspensa por falta de pagamento:** o cliente paga em "Atualizar cartão e pagar" e reativa na hora.
- **Encerrada:** o cliente clica em "Escolher plano" e assina de novo, sem novo teste. Os dados continuam.
- **Pelo Super Admin:** "Liberação temporária" (até 90 dias) libera o uso sem mexer na cobrança.

## Antes de vender (configuração no Stripe e no deploy)

1. **Ativar a conta Stripe** para receber em produção (hoje `charges_enabled=false`).
2. **Em modo live:** criar a chave `sk_live_` e o webhook para `https://instachat.startinc.com.br/api/webhook/stripe` com estes eventos:
   - `checkout.session.completed`;
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `customer.subscription.paused`, `customer.subscription.resumed`;
   - `invoice.created`, `invoice.finalized`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_succeeded`, `invoice.updated`, `invoice.voided`, `invoice.marked_uncollectible`;
   - `customer.updated`, `payment_method.attached`.

   Copie o `whsec_`.
3. **Variáveis na Vercel (produção):** `STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET` (live), `APP_URL`, `CRON_SECRET`, `SUPERADMIN_EMAIL` e, quando for abrir as vendas, `PUBLIC_SIGNUP=on`.
4. **Deploy** (aplica as migrations `20261014120000_assinatura_recorrente` e `20261014120100_planos_essencial_crescimento`).
5. **Preços:** em `/admin/planos`, clicar em "Criar preço mensal no Stripe" e "Criar preço anual no Stripe" nos dois planos (com a chave live).
6. **Painel do Stripe:**
   - **Cobranças → Assinaturas e e-mails:** Smart Retries ligado; e-mail de falha de pagamento com link para atualizar o cartão; lembrete de fim de teste.
   - **Depois de todas as tentativas:** marcar a assinatura como **não paga** (`unpaid`), não cancelar. Assim o cliente continua suspenso, e não encerrado, até pagar.
   - **Portal do cliente:** permitir atualizar a forma de pagamento e ver faturas. Desligar "cancelar" e "trocar de plano" no portal, porque essas ações são feitas no instachat.
   - **Formas de pagamento do Checkout:** só Cartão.
7. **Opcional:** `RESEND_API_KEY` e `BILLING_EMAIL_FROM` para mandar os avisos do instachat por e-mail.

## Testar sem cobrar ninguém (modo teste)

```bash
# 1) repassar eventos do Stripe (teste) para o app local
node scripts/stripe-dev-relay.mjs http://127.0.0.1:3017/api/webhook/stripe
# 2) simular o ciclo com relógio de teste (dias passam em segundos)
node scripts/stripe-simulate-lifecycle.mjs aprovado <workspaceId> <price_teste>
node scripts/stripe-simulate-lifecycle.mjs recusado <workspaceId> <price_teste> [sem-recuperacao]
node scripts/stripe-simulate-lifecycle.mjs cancelado-no-teste <workspaceId> <price_teste>
```
Cartão de teste no Checkout: `4242 4242 4242 4242`, validade futura e qualquer CVC. Os relógios de teste criados aparecem no painel do Stripe (modo teste) e podem ser apagados por lá.
