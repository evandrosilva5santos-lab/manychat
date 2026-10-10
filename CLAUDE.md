# CLAUDE.md — Guia de Inicialização Rápida para Claude Code

> **Projeto:** Fluxo (Instagram Automation Platform)  
> **Porta de Dev:** `3007` (`http://localhost:3007`)  
> **Comando de Testes:** `npm test`  
> **Comando de Tipos:** `npx tsc --noEmit`  

---

## 🎯 Instrução Imediata de Execução

Você é o agente executor designado para este repositório.
O projeto já foi integralmente auditado, mapeado e fatiado pelo Antigravity e está no estado **`READY_FOR_EXECUTION`**.

### Passo 1: Leia a Tarefa Autorizada
Abra e leia imediatamente o arquivo:
- `execution/CURRENT_TASK.md`

A tarefa atual autorizada é: **`NANO-002`** (Criar suíte de testes unitários para `getUserMedia` e a rota `GET /api/instagram/media` no Vitest em `src/lib/meta/graph.test.ts`).

### Passo 2: Verifique os Arquivos Permitidos
Na `NANO-002`, você SOMENTE tem autorização para modificar/criar:
- `src/lib/meta/graph.test.ts`

NÃO altere `PRD.md`, `PostPicker.tsx` ou qualquer outro arquivo nesta etapa.

### Passo 3: Execute a Ação
1. Em `src/lib/meta/graph.test.ts`:
   - Importe `InstagramGraphClient`, `defaultGraphClient` e `GET` de `src/app/api/instagram/media/route`.
   - Cubra cenários sem token (mock inteligente), cenários com fetch simulado (headers e query params) e tratamento defensivo de erro HTTP.
   - Teste a rota `GET` simulando requisições com status HTTP 200.

### Passo 4: Valide
- Execute `npx tsc --noEmit`.
- Execute `npm test`.

### Passo 5: Atualize o Estado
- Registre o que fez em `state/CHANGELOG.md`.
- Mova `NANO-002` para `DONE` em `execution/TASK_QUEUE.md`.
- Atualize `state/STATUS.md`.
- Prepare o próximo passo autorizando `NANO-003` em `execution/CURRENT_TASK.md`.

Para regras detalhadas de governança, consulte `AGENTS.md` e `execution/EXECUTION_RULES.md`.
