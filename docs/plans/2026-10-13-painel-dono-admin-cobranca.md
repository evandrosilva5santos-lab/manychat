# PRD + plano — Visões Super Admin / Admin da conta e modelos de pagamento

> 13/10/2026 · Autorizado pelo dono no chat ("faça o PRD e aplique tudo… não me peça opinião, execute, resolva e me entregue tudo testado").
> Base: ADR-008 (planos, equipe e cobrança) já no branch. Este documento fecha as lacunas.

## 1. Problema
- Só existe preço **mensal no cartão** (Stripe). O dono do SaaS não consegue vender anual nem registrar quem paga por Pix/boleto/transferência.
- O **Super Admin** (dono do SaaS) não tem menu próprio: `/admin` e `/admin/planos` ficam escondidos; não dá para criar cliente com login, redefinir senha, filtrar clientes, ver pagamentos nem auditoria.
- O **Admin da conta** (dono do workspace) só convida por link; sem serviço de e-mail, colaborador não consegue entrar. Menus não mudam por papel; o selo do menu mostra "Operador/Cliente" em vez de Dono/Admin/Operador. Recursos do plano (IA, Transmissão, Autoposter) não são aplicados.

## 2. Usuários
| Persona | Quem é | Precisa |
|---|---|---|
| Super Admin | dono do SaaS (Start Inc.) | vender e cobrar, criar clientes, ver MRR, pagamentos, auditoria |
| Dono da conta (OWNER) | cliente que assina | plano e cobrança, equipe, conexões |
| Admin (ADMIN) | gestor indicado pelo dono | equipe e configurações, sem cobrança |
| Operador (OPERATOR) | atendente/colaborador | conversas, contatos, posts; sem configurações |

## 3. Requisitos
### R1 — Modelos de pagamento (Super Admin)
- Plano com **preço mensal e anual** (`priceYearlyCents`, `stripeYearlyPriceId`, opcionais).
- Assinatura com **forma de cobrança**: `STRIPE` (cartão recorrente), `MANUAL` (Pix/boleto/transferência fora do Stripe) ou `COMPLIMENTARY` (cortesia), e **ciclo** `MONTHLY`/`YEARLY`.
- **Pagamentos manuais**: Super Admin registra pagamento (valor, método PIX/BOLETO/TRANSFER/CASH/OTHER, data, referência, período coberto). Registrar estende `currentPeriodEnd`, marca ACTIVE e grava auditoria. Histórico por cliente.
- `/plano` do cliente mostra ciclo, forma de cobrança, próximo vencimento e histórico de pagamentos; checkout Stripe permite escolher mensal/anual quando houver preço anual.
### R2 — Console do Super Admin
- Sidebar: item **Admin** (escudo) só para Super Admin, com submenu: Visão geral, Clientes, Planos, Pagamentos, Auditoria.
- **Clientes**: filtros por status, plano e forma de cobrança; busca; **"Novo cliente"** cria workspace + dono com e-mail e senha inicial + plano/ciclo/forma de cobrança.
- Em cada cliente: **redefinir senha** de qualquer membro, registrar pagamento, trocar forma de cobrança/ciclo; limites por cliente em campos (não JSON cru).
- **Pagamentos**: lista global (manuais e eventos do Stripe) com filtros; **Auditoria** global paginada.
### R3 — Visão do dono/admin da conta
- `/equipe`: além do convite, **"Adicionar colaborador"** com nome, e-mail, papel e senha inicial (limite do plano respeitado).
- **Minha conta** (`/minha-conta`): trocar a própria senha.
- Selo do menu mostra o papel real (Super Admin / Dono / Admin / Operador). Sidebar e menu escondem Ajustes/Plano/Equipe-gestão para OPERATOR; "Plano e cobrança" só para OWNER/ADMIN.
- **Recursos do plano aplicados** no servidor e na UI: IA, Transmissão e Autoposter exigem o recurso do plano; sem ele, tela de upgrade em vez da ferramenta.

## 4. Fora do escopo
E-mail transacional, Stripe em modo live, cobrança de excedente, NF-e.

## 5. Plano (tarefas)
- [ ] T1 Schema + migration aditiva (R1) → Verificar: `prisma migrate status` limpo, `tsc` 0.
- [ ] T2 Regras de pagamento manual e ciclo (lib/billing) com testes → Verificar: vitest.
- [ ] T3 `/admin/planos` com preço anual; `/admin/workspaces/[id]` forma de cobrança, ciclo, pagamentos, limites em campos, redefinir senha → Verificar: navegador.
- [ ] T4 Console: layout `/admin` com submenu, Clientes (filtros + novo cliente), Pagamentos, Auditoria → Verificar: navegador.
- [ ] T5 `/plano` do cliente: ciclo, forma, vencimento, histórico; checkout mensal/anual → Verificar: navegador.
- [ ] T6 Equipe: adicionar colaborador com senha; `/minha-conta` troca de senha → Verificar: login com o colaborador criado.
- [ ] T7 Papéis na UI (selo, sidebar, menu) + `hasFeature` aplicado (IA, Transmissão, Autoposter) → Verificar: navegador como OPERATOR e plano sem recurso.
- [ ] T8 Verificação final: `tsc`, `vitest`, `eslint`, teste no navegador das 3 visões; governança atualizada.

## 6. Orquestração (plan-orchestrate, modo plugin)
| Passo | Escopo de arquivos | Cadeia |
|---|---|---|
| A (T1–T3, T5) | `prisma/**` (só bloco de billing), `src/lib/billing/**`, `src/app/admin/planos/**`, `src/app/admin/workspaces/**`, `src/app/plano/**` | `ecc:tdd-guide,ecc:database-reviewer,ecc:typescript-reviewer` |
| B (T4) | `src/app/admin/page.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/clientes/**`, `src/app/admin/pagamentos/**`, `src/app/admin/auditoria/**`, `src/lib/admin/**` | `ecc:tdd-guide,ecc:typescript-reviewer,ecc:security-reviewer` |
| C (T6–T7) | `src/app/equipe/**`, `src/app/minha-conta/**`, `src/lib/team/**`, `src/components/layout/Sidebar.tsx`, `UserMenu.tsx`, páginas `ai`/`direct`/`autoposter` (só o portão de recurso) | `ecc:tdd-guide,ecc:typescript-reviewer,ecc:security-reviewer` |
| D (T8) | verificação no navegador + governança | dono da sessão |
