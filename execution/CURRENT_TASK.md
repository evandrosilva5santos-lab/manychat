# CURRENT_TASK — Autorização Operacional de Execução

> **Documento:** Autorização Formal de Execução  
> **Status:** `VALIDATION` — `PLANOS-E-COBRANCA` entregue no branch; aguarda preços, Stripe e deploy do dono  
> **Framework:** Everything Claude Code (ECC)  
> **Última revisão:** 12/10/2026 (saneamento de incoerências)  

---

## Tarefa autorizada: `PLANOS-E-COBRANCA`

- **Pedido do dono (13/10/2026):** "comite o login, depois siga para as outras etapas" (etapas do plano de planos/cobrança).
- **Decisão:** ADR-008. **Plano:** `docs/plans/2026-10-13-planos-e-cobranca.md`.
- **Arquivos permitidos (também usados):** `src/app/ajustes/actions.ts`, `src/app/contas/actions.ts`, `src/app/api/auth/instagram/login/route.ts` (papéis), `src/components/layout/Sidebar.tsx` (páginas públicas sem barra), `.env.example`.
- **Arquivos permitidos:** `prisma/schema.prisma` e nova migration; `src/lib/auth/**`, `src/lib/tenancy.ts`, `src/lib/billing/**`, `src/lib/meta/connect-account.ts`, `src/lib/engine/runner.ts` (só a checagem antes do envio); `src/app/login/**`, `src/app/api/auth/session/**`, `src/app/equipe/**`, `src/app/convite/**`, `src/app/plano/**`, `src/app/precos/**`, `src/app/cadastro/**`, `src/app/admin/**`, `src/app/fluxos/actions.ts` (só ativação), `src/app/api/webhook/stripe/**`, `src/app/api/billing/**`, `src/components/layout/UserMenu.tsx`, `src/proxy.ts`, testes correspondentes e documentos de estado.
- **Fora do escopo:** o trabalho do autoposter que está sem commit na pasta (não é tocado nem commitado).

## Situação anterior

A esteira NANO de setembro (NANO-001 a NANO-004) está concluída — ver `execution/TASK_QUEUE.md`. A ficha da NANO-002 que ficava aqui foi removida; ela continua no histórico do git.

Antes de codar, o agente deve pedir ao dono qual destas tarefas autorizar (ordem sugerida em `state/STATUS.md`):

| Candidata | Origem | Observação |
| :--- | :--- | :--- |
| `DEPLOY` | BLK-008 | Dono autoriza `vercel deploy --prod`; o build aplica a migration de opt-out. |
| `ATIVAR-QSTASH` (opcional) | `docs/agendador-qstash.md` | Só melhora esperas curtas; o cron diário e o webhook já retomam esperas. |
| `RETENCAO-LGPD` | `item-05-token-e-agendamentos` (ec6baa9) | Pronto no branch, **não portado**: conflita com ADR-007 e o texto de `/privacidade` (BLK-010). |
| `SENTRY` | `item-06-observabilidade-e-testes` | Pronto no branch; portar quando houver DSN (BLK-011). |
| `ACESSIBILIDADE` | `item-07-mobile-a11y-ux` (WIP) | Rascunho; refazer sobre o código atual. |
| `LOGIN-CLIENTE` | prompt 08b (decidir provedor: e-mail/senha, link mágico ou Instagram) | `createUserSession` existe mas nada o chama: cliente não tem como entrar; só o operador via Basic Auth. |

Já integrados em 12–13/10 (ver `state/CHANGELOG.md`): `vercel-build` só em produção, opt-out "PARAR", exportar/excluir contato, cabeçalhos de segurança, menu de perfil e `/contas`, retomada de esperas, limpeza de qualidade.

Passos que dependem só do dono: `docs/PASSOS-DO-DONO.md`.

## Protocolo de Execução do Claude Code
1. Leia `CLAUDE.md` e `AGENTS.md`.
2. Execute o ciclo ECC: Research → Plan → Test → Implement → Review → Verify.
3. Modifique estritamente os arquivos permitidos pela tarefa autorizada.
4. Valide com `npm run verify` (e `npm run build` antes de produção).
5. Atualize `state/CHANGELOG.md`, `state/STATUS.md` e `execution/TASK_QUEUE.md`.
