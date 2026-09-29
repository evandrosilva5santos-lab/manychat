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

A tarefa atual autorizada é: **`NANO-001`** (Adicionar método `getUserMedia` em `src/lib/meta/graph.ts` e criar a rota `GET /api/instagram/media`).

### Passo 2: Verifique os Arquivos Permitidos
Na `NANO-001`, você SOMENTE tem autorização para modificar/criar:
- `src/lib/meta/graph.ts`
- `src/app/api/instagram/media/route.ts`

NÃO altere `PRD.md`, `PostPicker.tsx` ou qualquer outro arquivo nesta etapa.

### Passo 3: Execute a Ação
1. Em `src/lib/meta/graph.ts`:
   - Adicione o tipo `InstagramMediaItem`.
   - Adicione o método `getUserMedia` na classe `InstagramGraphClient` com suporte a fallback mock e chamada real à Meta Graph API v21.0.
2. Em `src/app/api/instagram/media/route.ts`:
   - Crie o handler `export async function GET(req: Request)` que chama `defaultGraphClient.getUserMedia()` e retorna `NextResponse.json(...)`.

### Passo 4: Valide
- Execute `npx tsc --noEmit`.
- Execute `npm test`.
- Teste localmente com `curl http://localhost:3007/api/instagram/media`.

### Passo 5: Atualize o Estado
- Registre o que fez em `state/CHANGELOG.md`.
- Mova `NANO-001` para `DONE` em `execution/TASK_QUEUE.md`.
- Atualize `state/STATUS.md`.
- Prepare o próximo passo autorizando `NANO-002` em `execution/CURRENT_TASK.md`.

Para regras detalhadas de governança, consulte `AGENTS.md` e `execution/EXECUTION_RULES.md`.
