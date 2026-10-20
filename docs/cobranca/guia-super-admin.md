# Console do Super Admin — operação comercial

Acesso: **/admin**, só para Super Admin. Toda ação é conferida no servidor e gravada na **Auditoria** com quem fez, quando e o motivo.

## Abas

| Aba | Para quê |
|---|---|
| **Visão geral** | MRR, recebido no mês, ativos, em teste, pagamento pendente, suspensos, cancelados e cortesias (cada número abre a lista filtrada) |
| **Clientes** | Busca e filtros por status (todos os 7), plano e forma de cobrança. "Novo cliente" cria cliente e dono com senha |
| **Planos** | Nome, preço mensal e anual, teste, carência, limites (inclusive leads ativos), benefícios, selo, vitrine, ativo e combo. Botões **Criar preço mensal/anual no Stripe** |
| **Pagamentos** | Todos os pagamentos (cartão e manuais), com totais |
| **Cobranças** | Faturas em aberto, tentativas recusadas (com motivo), eventos do Stripe (processado, ignorado ou falhou) e avisos enviados aos clientes |
| **Auditoria** | Histórico de ações administrativas |

## Ficha do cliente (Clientes → nome do cliente)

- **Situação:** plano, status efetivo, cobrança, "pago até", uso contra limites.
- **Ações na assinatura** (todas pedem motivo):
  - **Estender teste grátis:** soma dias; com cartão, adia a primeira cobrança no Stripe também.
  - **Liberação temporária:** deixa usar até uma data (máximo 90 dias), mesmo com pagamento pendente ou suspenso. Não mexe na cobrança. "Encerrar liberação" desfaz.
  - **Suspender / Reativar cliente:** pausa os recursos pagos agora. Não apaga dados nem cancela a cobrança no Stripe.
  - **Conceder / Revogar cortesia:** 1, 3, 6, 9 ou 12 meses, ou tempo indeterminado. Se o cliente paga no cartão, é preciso marcar "Encerrar a cobrança no cartão", que encerra a assinatura do Stripe na hora, sem reembolso automático.
  - **Trocar plano:** com cartão, troca também no Stripe e a diferença vira crédito (não cobra agora).
  - **Sincronizar com o Stripe:** relê a assinatura no Stripe e corrige divergências.
- **Cobrança no cartão:** cartão mascarado, data do cancelamento, fim da carência, suspensão manual, liberação e o **aceite dos termos** (data, versão, valor).
- **Faturas, tentativas de cobrança e avisos** do cliente.
- **Formulário completo** (forma de cobrança manual, ciclo, ajustes de limite por cliente) e **Registrar pagamento** (Pix, boleto, transferência).

## Rotina sugerida

- **Diária:** em **Cobranças**, conferir faturas em aberto e eventos com falha. Se um evento falhar mais de uma vez, abrir o cliente e usar **Sincronizar com o Stripe**.
- **Ao mudar preço:**
  1. Salvar o plano.
  2. Clicar em **Criar preço no Stripe**.
  3. Quem já assina continua no preço antigo; para migrar um cliente, use **Trocar plano** na ficha dele.
- **Cliente pediu prazo:** **Liberação temporária** com o motivo.
