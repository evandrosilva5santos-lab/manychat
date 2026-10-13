# HANDOFF — Pacote Oficial de Transferência de Controle Operacional (ECC Standard)

> **Documento:** Protocolo Formal de Handoff entre Agentes de IA  
> **Data:** 12/10/2026  
> **O handoff anterior (`HANDOFF-002-ECC`, NANO-002, 29/09) está superado e fica no histórico do git.**

---

- **HANDOFF ID:** `HANDOFF-003`
- **PASTA OFICIAL:** `/Users/evandro/Downloads/Manychat` (branch `feat-login-duplo`)
- **ESTADO:** `AWAITING_OWNER` — ver `state/STATUS.md` e `execution/CURRENT_TASK.md`.

## O que o próximo agente precisa saber
1. A esteira NANO (001–004) e os itens 1–4 estão concluídos; login duplo (ADR-006) e "Perfil seguro" (ADR-007) também.
2. A marca é **instachat**: arquivos em `design-system/assets/brand/`, componente `@/components/brand/BrandLogo`, regras em `design-system/README.md` › Marca.
3. Itens 5–8 têm trabalho pronto em branches que **não** foram integrados (lista em `execution/CURRENT_TASK.md`). Não reimplemente sem antes olhar esses branches.
4. `PRD.md` é imutável (REG-DOC-002); divergências vão para `docs/PRD_ISSUES.md`.

## Validação no momento do handoff
- `npx tsc --noEmit`: 0 erros.
- `npm test`: 517/517.
- `npx eslint src`: 82 erros / 36 avisos (dívida antiga, quase toda `no-explicit-any`).
