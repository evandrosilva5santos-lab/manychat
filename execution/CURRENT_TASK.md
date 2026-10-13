# CURRENT_TASK — Autorização Operacional de Execução

> **Documento:** Autorização Formal de Execução  
> **Status:** `AWAITING_OWNER` — nenhuma tarefa autorizada no momento  
> **Framework:** Everything Claude Code (ECC)  
> **Última revisão:** 12/10/2026 (saneamento de incoerências)  

---

## Situação

A esteira NANO de setembro (NANO-001 a NANO-004) está concluída — ver `execution/TASK_QUEUE.md`. A ficha da NANO-002 que ficava aqui foi removida; ela continua no histórico do git.

Antes de codar, o agente deve pedir ao dono qual destas tarefas autorizar (ordem sugerida em `state/STATUS.md`):

| Candidata | Origem | Observação |
| :--- | :--- | :--- |
| `INTEGRAR-ITENS-5-8` | branches `item-05-*`, `item-06-*`, `item-07-*`, `item-08-saas` | Trabalho pronto e nunca integrado: Sentry, opt-out "PARAR", retenção LGPD, exportar contato, acessibilidade, `vercel-build` só em produção. Conflita com o pacote Perfil seguro (callbacks já reimplementados). |
| `AGENDAR-TICK` | `src/app/api/webhook/instagram/tick` | Esperas (DELAY) e fila só andam se algo chamar `/tick`; `vercel.json` só agenda a renovação de token, 1x por dia. |
| `LOGIN-CLIENTE` | `menu-perfil-conta.md`, prompt 08b | `createUserSession` existe mas nada o chama: cliente não tem como entrar; só o operador via Basic Auth. |
| `MENU-PERFIL` | `menu-perfil-conta.md` | Rascunho em andamento em `../Manychat-novas-implementacoes` (sem commit). |

## Protocolo de Execução do Claude Code
1. Leia `CLAUDE.md` e `AGENTS.md`.
2. Execute o ciclo ECC: Research → Plan → Test → Implement → Review → Verify.
3. Modifique estritamente os arquivos permitidos pela tarefa autorizada.
4. Valide com `npm run verify` (e `npm run build` antes de produção).
5. Atualize `state/CHANGELOG.md`, `state/STATUS.md` e `execution/TASK_QUEUE.md`.
