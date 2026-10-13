# HANDOFF — Pacote Oficial de Transferência de Controle Operacional (ECC Standard)

> **Documento:** Protocolo Formal de Handoff entre Agentes de IA  
> **Data:** 12/10/2026  
> **O handoff anterior (`HANDOFF-002-ECC`, NANO-002, 29/09) está superado e fica no histórico do git.**

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
