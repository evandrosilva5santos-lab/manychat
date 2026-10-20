# PRD — instachat pronto para vender: assinatura recorrente, teste grátis e operação comercial

> **Versão:** 1.0 · **Data:** 14/10/2026 · **Decisão:** ADR-010 · **Plano:** `docs/plans/2026-10-14-saas-assinatura-recorrente.md`
> **Auditoria:** `docs/auditoria/2026-10-14-startcrm-x-instachat.md` · **Telas:** `docs/design/2026-10-14-telas-assinatura.md`

> **Status de instalação (19/10/2026): ADIADO por decisão do dono.**
> O código desta entrega (Stripe, teste de 7 dias com cartão, cobrança recorrente e console de cobranças) está pronto e testado no branch `feat-login-duplo`, mas **não foi para produção**. Primeiro foi ao ar só o Autoposter (branch `deploy/autoposter`). Para instalar depois:
> 1. Integre o branch `feat-login-duplo` sobre o que já está em produção. As migrations `20261014120000_assinatura_recorrente` e `20261014120100_planos_essencial_crescimento` entram nesse deploy.
> 2. Siga `docs/cobranca/guia-cobranca.md`, seção "Antes de vender":
>    - ativar a conta Stripe;
>    - configurar as chaves e o webhook live;
>    - criar os preços em `/admin/planos`;
>    - ativar Smart Retries e configurar o Portal;
>    - definir `SUPERADMIN_EMAIL` e `PUBLIC_SIGNUP=on`.
> 3. Inclua o cron `/api/cron/billing` (`0 9 * * *`) no `vercel.json`.

## 1. Problema e oportunidade

O instachat já automatiza comentários e Direct do Instagram, mas ainda não se vende sozinho:
- o teste grátis começava sem cartão, o que atrai curiosos e não converte automaticamente;
- não havia cobrança recorrente com aceite claro, cancelamento pelo cliente nem recuperação de pagamento recusado;
- o Super Admin não tinha como operar a cobrança no dia a dia.

**Oportunidade:** vender no automático para perfis brasileiros com um preço de entrada baixo (R$ 29,90), cobrança no cartão e um teste que converte sozinho no 8º dia.

## 2. Personas

| Persona | Quem é | O que precisa |
|---|---|---|
| **Dono da conta** (cliente) | Pequeno negócio ou criador que vende pelo Instagram | Testar sem risco, saber quanto e quando paga, cancelar fácil, não perder dados |
| **Administrador/Atendente** do cliente | Equipe do cliente | Usar o produto; não mexe em cobrança (o atendente nem vê valores) |
| **Super Admin** (Start Inc.) | Dono do SaaS | Ver quem paga, quem está atrasado e por quê; agir (estender, liberar, suspender, cortesia) com rastro |

## 3. Modelo comercial

| Plano | Mensal | Anual (20% de desconto) | Leads ativos | Contas IG | Usuários | Teste | Carência |
|---|---:|---:|---:|---:|---:|---:|---:|
| instachat Essencial | R$ 29,90 | R$ 287,04 (R$ 23,92/mês) | 2.000 | 1 | 1 admin | 7 dias | 3 dias |
| instachat Crescimento | R$ 59,90 | R$ 575,04 (R$ 47,92/mês) | 5.000 | 1 | 1 admin | 7 dias | 3 dias |

- **Lead ativo:** contato do workspace que não pediu para sair (opt-out).
- **Acima do limite:** os contatos novos ficam guardados e as automações não iniciam para eles até o upgrade.
- **Vitrine:** o anual aparece como valor por mês, com o total do ano logo abaixo.
- **Configuração:** tudo é editável em `/admin/planos`: nome, preço, moeda, teste, carência, limites, benefícios, selo, vitrine, status e "pode entrar em combo".
- **Planos antigos** (Starter, Pro, Agência) saem da vitrine e continuam valendo para quem já assina.

## 4. Jornadas

1. **Compra e teste:**
   1. O cliente parte de `/precos` (mensal ou anual) e clica em "Testar 7 dias grátis".
   2. Cria a conta em `/cadastro` (passo 1 de 2).
   3. Em `/assinar` (passo 2 de 2), confere o resumo: plano, preço, recorrência, fim do teste, 1ª cobrança e R$ 0,00 hoje.
   4. Marca o aceite e cadastra o cartão no Stripe Checkout.
   5. Volta para `/plano?checkout=ok` e a assinatura aparece em teste.
2. **Cobrança:** no 8º dia o Stripe cobra o cartão e a assinatura fica ativa. A partir daí renova na mesma data a cada mês (ou ano).
3. **Falha:**
   1. A cobrança é recusada e a assinatura fica com pagamento pendente.
   2. O cliente recebe o aviso no app (faixa no topo, aviso em Plano e cobrança, e-mail se configurado).
   3. O Stripe tenta de novo.
   4. A carência é de 3 dias; depois disso, a assinatura é suspensa.
   5. "Atualizar cartão e pagar" abre o portal seguro e o pagamento aprovado reativa na hora.
4. **Upgrade:** em "Trocar de plano", a troca vale na hora e a diferença proporcional é cobrada; se o banco recusar, o plano não muda.
5. **Downgrade:** a troca vale na hora e a diferença vira crédito; é recusada se o uso atual não cabe no plano menor.
6. **Cancelamento:**
   - "Cancelar assinatura" pede confirmação.
   - No teste não há cobrança. Depois de pago, o acesso vai até o fim do período e não há nova cobrança.
   - "Desfazer cancelamento" fica disponível até o fim do período.
7. **Reativação:**
   - Assinatura encerrada: "Escolher plano" leva ao checkout de novo, sem novo teste, e os dados continuam.
   - Suspensa por falta de pagamento: basta pagar.

## 5. Regras de negócio

1. **Teste:**
   - Sem cartão, não há teste.
   - Um teste por workspace e por dono.
   - Quem já testou vê "a cobrança acontece hoje" antes de pagar.
2. **Aceite:** o texto do aceite é o mesmo na tela e no botão do Stripe. Fica gravado com a versão dos termos (`2026-10-14`), o IP, o navegador, o preço, os dias de teste e a data prevista da 1ª cobrança.
3. **Estados:**

   | Estado | Significado | Opera? |
   |---|---|---|
   | `trialing` | Em teste | Sim |
   | `active` | Em dia | Sim |
   | `past_due` | Recusada, dentro da carência | Sim, com aviso |
   | `canceled` | Cancelamento agendado | Sim, até o fim do período |
   | `expired` | Acabou | Não |
   | `suspended` | Carência vencida ou suspensão manual | Não |
   | `complimentary` | Cortesia | Sim, até a data |

4. **Carência:** começa na primeira recusa, não renova a cada tentativa e é configurável por plano (padrão 3 dias).
5. **Dados:** nunca são apagados por inadimplência, só os recursos pagos são pausados. As mensagens recebidas continuam sendo gravadas.
6. **Liberação temporária:** feita pelo Super Admin, por até 90 dias. Libera o uso sem mexer na cobrança.
7. **Suspensão manual:** feita pelo Super Admin, vence qualquer outro estado e não é desfeita pela sincronização com o gateway.
8. **Cortesia:** cliente grátis e fora do MRR. Se o cliente pagava no cartão, a cobrança é encerrada na hora, com confirmação explícita.
9. **Preço novo:** vale para novos assinantes. Quem já assina continua no preço antigo (`legacyPriceIds`).

## 6. Permissões por papel

| Ação | Dono | Admin | Atendente | Super Admin |
|---|:-:|:-:|:-:|:-:|
| Ver plano, uso e status | ✓ | ✓ | — (só aviso) | ✓ |
| Ver faturas e pagamentos | ✓ | ✓ | — | ✓ |
| Contratar, cancelar, trocar plano, atualizar cartão | ✓ | — | — | — (age pelo console) |
| Estender teste, liberar, suspender, cortesia, trocar plano do cliente | — | — | — | ✓ (com motivo) |
| Criar e editar planos e preços | — | — | — | ✓ |

Tudo é conferido no servidor (`requireWorkspaceRole`, `requireSuperAdmin`). A tela só esconde o que o servidor já recusaria.

## 7. Requisitos funcionais

- **RF01:** Vitrine `/precos` com mensal e anual (valor por mês no anual), benefícios e selo.
- **RF02:** Cadastro cria pessoa e workspace e leva ao checkout com o plano e o ciclo escolhidos.
- **RF03:** `/assinar` com resumo completo, aceite obrigatório (botão desabilitado sem aceite) e checkout seguro.
- **RF04:** Área de assinatura com:
  - plano, preço e status;
  - fim do teste e próxima cobrança;
  - cartão mascarado;
  - cancelar, desfazer, trocar de plano e atualizar cartão;
  - faturas (com link), pagamentos e avisos.
- **RF05:** Faixa global de cobrança: sem plano, pagamento pendente, suspensa, liberação temporária.
- **RF06:** Webhook idempotente para assinatura, fatura, tentativa, pagamento e avisos.
- **RF07:** Cron diário que grava carência e cancelamento vencidos, cortesia e liberação expiradas, e avisa o cliente.
- **RF08:** Console do Super Admin com:
  - indicadores de assinatura e receita;
  - filtros por status, plano e forma de cobrança;
  - aba Cobranças (faturas em aberto, tentativas, eventos, avisos);
  - ações rápidas com motivo;
  - criação de preço no Stripe.
- **RF09:** Limite de leads ativos aplicado no motor.
- **RF10:** Termos de Uso com a seção de assinatura (`/termos#assinatura`).

## 8. Requisitos não funcionais

- **Segurança:**
  - O cartão nunca passa pelo instachat; só bandeira, final e validade ficam no banco.
  - Webhook com assinatura conferida.
  - O cron exige `CRON_SECRET` e falha fechado em produção.
  - Toda ação tem autorização no servidor.
- **Confiabilidade:** transação única por evento, chaves únicas (evento, tentativa, fatura, pagamento, aviso), assinatura relida no gateway e reprocessamento de eventos com falha.
- **Isolamento:** toda consulta é escopada ao workspace do usuário. Super Admin é papel global.
- **Observabilidade:** a trilha de eventos (`BillingEvent`) mostra status, erro e tentativas no console. Os logs não carregam dados sensíveis.
- **Acessibilidade e responsividade:**
  - Diálogo de confirmação acessível, papéis ARIA em alertas e avisos.
  - Botões com 44 px ou mais.
  - Layout em 390 px sem rolagem horizontal.
  - Movimento reduzido respeitado nas animações da vitrine.
- **Evolução:** gateway desacoplado (`BillingGateway`); `Product` e `comboEligible` preparam produtos adicionais e combos.

## 9. Critérios de aceite (cobrança) e como foram verificados

| Critério | Verificação |
|---|---|
| Escolher o plano, cadastrar o cartão e iniciar 7 dias de teste | Navegador: `/precos` → `/cadastro` → `/assinar` → Stripe Checkout (sessão `subscription`, `payment_method_collection: always`, R$ 0 hoje). Aceite gravado |
| Nenhuma cobrança antes do fim do teste | Stripe test clock: fatura de R$ 0,00 no dia 0 |
| 1ª cobrança automática no 8º dia | Test clock avançado 8 dias: fatura de R$ 29,90 paga, assinatura `ACTIVE` local |
| Pagamento aprovado libera na hora | Webhook → `ACTIVE`, pagamento no histórico, aviso de recuperação |
| Recusa ativa a recuperação e respeita a carência | Cartão de teste recusado → `PAST_DUE` com carência de 3 dias, aviso com o motivo; cron depois da carência → `SUSPENDED` + aviso; troca de cartão + pagamento → `ACTIVE` |
| Cancelar no teste não cobra | Test clock: cancelado no dia 0, avançado 8 dias, só a fatura de R$ 0,00 → `EXPIRED` |
| Cancelar depois de pago mantém o acesso até o fim | Navegador: "Cancelar assinatura" → `CANCELED`, "Acesso até 21/11/2026" → "Desfazer" → `ACTIVE` |
| Acesso aplicado no backend | `computeEntitlements` + `sendingBlockReason` (motor, fila, DM manual), `hasFeature` (Autoposter), `assertWithinLimit` |
| Eventos duplicados não duplicam nada | Testes de duplicidade e corrida (P2002) + chaves únicas. No relay, os mesmos eventos reenviados viram "duplicado" |
| Cliente e Super Admin veem o histórico e o status | `/plano` (faturas, pagamentos, avisos) e `/admin/workspaces/[id]` + `/admin/cobrancas` |

## 10. Métricas de sucesso

- Conversão do teste em pagante: meta ≥ 40% no 8º dia.
- Recuperação de recusas dentro da carência: meta ≥ 60%.
- Cancelamento voluntário mensal: meta ≤ 5%.
- MRR e recebido no mês (visão geral do console).
- Eventos de webhook com falha: 0 por mais de 24 h.

## 11. Riscos, dependências e decisões técnicas

- **Dependências do dono:**
  - ativar a conta Stripe e criar os preços em modo live;
  - configurar Smart Retries, e-mails, portal e eventos do webhook;
  - fazer o deploy das migrations;
  - opcional: serviço de e-mail (Resend).
- **Decisões:** ver ADR-010. Gateway Stripe; cancelar no fim do período; upgrade com cobrança imediata; downgrade com crédito; um teste por cliente.
- **Riscos:** ver a auditoria, seção 6.
- **Fora do escopo:** Pix e boleto recorrentes, combo Autoposter, NFS-e, recuperação de senha por e-mail.
