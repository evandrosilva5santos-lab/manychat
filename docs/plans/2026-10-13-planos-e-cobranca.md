# Planos, equipe e cobrança — plano de execução

> Decisão registrada: ADR-008 (`docs/DECISIONS.md`). Autorizado pelo dono em 13/10/2026.

## 1. O que veio do STARTCRM

**Reaproveitado:** planos no banco editáveis pelo Super Admin (`platform_plans`); plano efetivo = plano + ajustes da empresa (`get_organization_effective_limits`); papel da plataforma (`super_admin`) separado do papel na empresa (`user_organizations`); empresa interna sem limite e fora do MRR; auditoria das ações do admin com antes/depois; checagem no servidor na ordem usuário → empresa → recurso → permissão (`access-guard.ts`); pagamento que ativa o plano sozinho e sem duplicar (`cakto-plan-provisioning.ts`).

**Evitado (problemas encontrados lá):**

| Problema | Onde | Como o instachat resolve |
|---|---|---|
| Recurso sem decisão fica liberado | `FeatureGate.tsx`, `planMenuFeatures.ts` (`!== false`) | Lista do que está liberado; fora dela, bloqueado |
| Limites declarados e não aplicados | só `max_connections` é checado | Cada limite tem ponto de checagem no servidor e teste |
| Plano em 3 lugares | `organizations.plan_id`, `subscriptions`, campos Cakto | `Subscription` é a única fonte |
| Recursos gravados duas vezes, com OU | colunas `feature_*` + `extra_features.menu_features` | Uma lista `features` no plano |
| Papel em duas tabelas | `user_roles` + `user_organizations` | `User.role` só para plataforma; `WorkspaceMember.role` no workspace |
| Suspensão só no navegador | `useOrganizationStatus` | Motor e server actions consultam o status |
| Auditoria que "nunca lança erro" | `logAdminAction` | Auditoria na mesma transação |
| Tela para virar Super Admin sozinho | `SuperAdminRoute.tsx` | Super Admin só por `SITE_USER`/`SUPERADMIN_EMAIL` |

## 2. Papéis

| Pode… | OWNER | ADMIN | OPERATOR |
|---|---|---|---|
| Plano e cobrança | ✅ | — | — |
| Convidar e remover membros | ✅ | ✅ (não remove o dono) | — |
| Conectar ou desconectar Instagram | ✅ | ✅ | — |
| Criar, ativar e parar fluxos | ✅ | ✅ | — |
| Conversas, contatos, direct | ✅ | ✅ | ✅ |

## 3. Planos iniciais (valores editáveis em `/admin/planos`)

| | Starter | Pro | Agência |
|---|---|---|---|
| Contas do Instagram | 1 | 3 | 10 |
| Fluxos ativos | 10 | ilimitado | ilimitado |
| DMs/mês | 5.000 | 25.000 | 100.000 |
| Membros | 2 | 5 | 15 |
| Recursos extras | — | IA, Transmissão, Autoposter | IA, Transmissão, Autoposter |
| Preço | a definir | a definir | a definir |

Teste grátis: 14 dias no plano Pro (`trialDays` editável).

## 4. Fases

| Fase | Entrega |
|---|---|
| 1 · Login de cliente e equipe | e-mail e senha, `WorkspaceMember`, convites por link, acesso por membro em `tenancy.ts`, tela `/equipe` |
| 2 · Planos e direitos | `Plan`, `Subscription`, `src/lib/billing/entitlements.ts`, workspace `INTERNAL` |
| 3 · Aplicação dos limites | OAuth, fluxos ativos, membros, motor (status e DMs/mês), tela `/plano` com uso |
| 4 · Super Admin | `/admin/planos`, plano e ajustes por workspace, auditoria transacional, MRR |
| 5 · Cobrança | checkout e portal do Stripe, webhook idempotente, status da assinatura |
| 6 · Vender | `/precos`, `/cadastro` com teste grátis, onboarding |

## 5. Pendências do dono
- Preços e `stripePriceId` de cada plano.
- No limite: bloquear (implementado) ou cobrar excedente.
- Retenção de dados após cancelamento (BLK-010).
- Serviço de e-mail (para link mágico, recuperação de senha e avisos de cobrança).
