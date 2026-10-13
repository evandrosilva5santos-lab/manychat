# CLAUDE.md — Guia de Inicialização Rápida para Claude Code

> **Projeto:** instachat (código interno "Fluxo") — Instagram Automation Platform  
> **Pasta oficial:** `/Users/evandro/Downloads/Manychat` (os worktrees em `.claude/worktrees/` e `../Manychat-novas-implementacoes` não são a fonte da verdade)  
> **Porta de Dev:** `3007` (`http://localhost:3007`)  
> **Comando de Testes:** `npm test`  
> **Comando de Tipos:** `npx tsc --noEmit`  

---

## 🎯 Instrução Imediata de Execução

Você é o agente executor designado para este repositório.

### Passo 1: Leia o estado e a tarefa autorizada
1. `state/STATUS.md` — estado atual, bloqueios do dono e próximo passo.
2. `execution/CURRENT_TASK.md` — a tarefa autorizada agora (se estiver vazia, pergunte ao dono antes de codar).
3. `execution/TASK_QUEUE.md` — fila por estado.

A esteira NANO de setembro (NANO-001 a NANO-004) está concluída; não a reexecute.

### Passo 2: Respeite os arquivos permitidos
Altere somente os arquivos que a tarefa autorizada permite. Se precisar mexer em outro, registre em `state/BLOCKERS.md` e pare.

### Passo 3: Valide
- `npx tsc --noEmit`
- `npm test`
- `npm run build` antes de qualquer entrega para produção.

### Passo 4: Atualize o estado
- Registre o que fez em `state/CHANGELOG.md`.
- Atualize `execution/TASK_QUEUE.md` e `state/STATUS.md`.
- Prepare a próxima tarefa em `execution/CURRENT_TASK.md`.

Para regras detalhadas de governança, consulte `AGENTS.md`, `execution/EXECUTION_RULES.md` e `docs/RULES.md`. Marca e cores: `design-system/README.md` (seção Marca) e `design-system/tokens.css`.
